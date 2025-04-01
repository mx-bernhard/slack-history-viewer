import fs from 'fs/promises';
import { glob } from 'glob'; // Need glob to find files
import { groupBy, sortBy } from 'lodash-es';
import { limitFunction } from 'p-limit';
import path from 'path';
import { Database, open } from 'sqlite'; // Import sqlite wrapper
import sqlite3 from 'sqlite3'; // Import sqlite3 driver
import {
  ChatInfo,
  SlackChannel,
  SlackDM,
  SlackGroup,
  SlackMessage,
  SlackMPIM,
  SlackUser,
} from '../types.js';

// Module-level variable to store the base path. Needs initialization.
let internalDataBasePath: string | null = null;
// Module-level variable for the SQLite database instance
let dbInstance: Database | null = null;
const dbFilename: string =
  process.env.SLACK_DB_FILENAME ?? './processed_messages.db';

// Function to get the SQLite DB instance, ensuring it's initialized
function getDb(): Database {
  if (dbInstance === null) {
    throw new Error(
      'Database has not been initialized. Call initDataLoader first.'
    );
  }
  return dbInstance;
}

// Initialization function - MUST be called before other data loading functions
export async function initDataLoader(basePath: string): Promise<void> {
  // Make async
  if (internalDataBasePath !== null || dbInstance !== null) {
    console.warn(
      'Data loader or DB already initialized. Ignoring subsequent calls.'
    );
    return;
  }
  internalDataBasePath = basePath;
  console.log(
    `Data Loader initialized with base path: ${internalDataBasePath}`
  );

  // Initialize SQLite Database
  try {
    // Use verbose mode for easier debugging of SQLite errors initially
    const verboseSqlite3 = sqlite3.verbose();
    console.log(`Initializing SQLite tracking database at: ${dbFilename}`);
    dbInstance = await open({
      filename: dbFilename,
      mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
      driver: verboseSqlite3.Database,
    });

    // Ensure the tracking table exists
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS processed_files (
        path TEXT NOT NULL,
        indexed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
        PRIMARY KEY (path)
      )
    `);
    console.log('SQLite tracking database initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize SQLite tracking database:', error);
    // If DB fails to init, we probably shouldn't continue.
    throw new Error('SQLite DB initialization failed');
  }
}

// Helper to ensure initialization
function getDataBasePath(): string {
  if (internalDataBasePath === null) {
    throw new Error(
      'Data loader has not been initialized. Call initDataLoader first.'
    );
  }
  return internalDataBasePath;
}

// --- In-Memory Cache Setup ---
const MAX_CACHE_SIZE = 50; // Store messages for up to 50 chats in memory
// Use a Map to store cached messages [chatId, messages[]]
// The order of insertion matters for LRU-like behavior when pruning
const messageCache = new Map<string, SlackMessage[]>();

// Function to prune the cache if it exceeds the size limit
function pruneCache() {
  if (messageCache.size > MAX_CACHE_SIZE) {
    // Delete the oldest entry (first key in Map iteration order)
    const oldestKey = messageCache.keys().next().value as unknown as
      | string
      | undefined;
    if (oldestKey != null && typeof oldestKey === 'string') {
      messageCache.delete(oldestKey);
      // console.log(`Cache pruned, removed: ${oldestKey}`); // Debug log
    }
  }
}
// --- End Cache Setup ---

// --- Cache for getAllChats result ---
let allChatsCache: ChatInfo[] | null = null;
let allChatsCacheTimestamp: number | null = null;
const ALL_CHATS_CACHE_DURATION = 5 * 60 * 1000; // Cache for 5 minutes
// --- End Chat Cache Setup ---

// Helper function to read and parse a JSON file
async function readJsonFile<T>(filePath: string): Promise<T | null> {
  const basePath = getDataBasePath(); // Use the initialized path
  try {
    const fullPath = path.join(basePath, filePath);
    // console.log(`Attempting to read: ${fullPath}`); // Debugging line
    const data = await fs.readFile(fullPath, 'utf-8');
    // Handle potentially empty files that contain just '[]' or '{}' etc. but are valid JSON
    if (data.trim().length <= 2) return null;
    return JSON.parse(data) as T;
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      // File not found is expected for some types (e.g., groups.json might be empty array `[]`)
      // console.warn(`Data file not found, returning null: ${filePath}`);
      return null;
    } else {
      console.error(`Error reading data file ${filePath}:`, error);
      // Re-throw other errors
      throw error;
    }
  }
}

// Loaders for specific data types
export const loadUsers = (): Promise<SlackUser[] | null> =>
  readJsonFile<SlackUser[]>('users.json');
export const loadChannels = (): Promise<SlackChannel[] | null> =>
  readJsonFile<SlackChannel[]>('channels.json');
export const loadGroups = (): Promise<SlackGroup[] | null> =>
  readJsonFile<SlackGroup[]>('groups.json');
export const loadDms = (): Promise<SlackDM[] | null> =>
  readJsonFile<SlackDM[]>('dms.json');
export const loadMpims = (): Promise<SlackMPIM[] | null> =>
  readJsonFile<SlackMPIM[]>('mpims.json');

// Function to get a consolidated list of all chats (with caching)
export async function getAllChats(): Promise<ChatInfo[]> {
  const now = Date.now();
  // Check cache validity - explicitly check timestamp is not null and greater than 0
  if (
    allChatsCache &&
    allChatsCacheTimestamp != null &&
    allChatsCacheTimestamp > 0 &&
    now - allChatsCacheTimestamp < ALL_CHATS_CACHE_DURATION
  ) {
    if (debugLog) {
      console.log('Returning cached chat list.');
    }
    return allChatsCache;
  }

  console.log('Fetching and processing fresh chat list...');
  // Load all data concurrently
  const [channels, groups, dms, mpims, users] = await Promise.all([
    loadChannels(),
    loadGroups(),
    loadDms(),
    loadMpims(),
    loadUsers(),
  ]);
  const actualUsers = users ?? [];

  const userMap = new Map<string, SlackUser>(actualUsers.map(u => [u.id, u]));

  const allChats: ChatInfo[] = [];

  // Use a union type for the list items
  type ProcessItemType = SlackChannel | SlackGroup | SlackDM | SlackMPIM;
  const userIdForDms = sortBy(
    groupBy(
      [
        ...(dms?.flatMap(d => d.members ?? []) ?? []),
        ...(mpims?.flatMap(m => m.members ?? []) ?? []),
      ],
      id => id
    ),
    array => array.length
  );
  const currentUserIdForDms = userIdForDms.at(-1)?.[0];
  const processList = (
    list: ProcessItemType[] | null,
    type: ChatInfo['type']
  ) => {
    list?.forEach((item: ProcessItemType) => {
      let chatName = item.name; // Start with potential existing name
      let otherMemberIdsForAvatar: string[] = []; // Array to store IDs for avatar

      const getUserNickname = (userId: string): string => {
        const member = userMap.get(userId);
        const displayName = member?.profile.display_name?.trim();
        return displayName != null && displayName !== ''
          ? displayName
          : (member?.name ?? member?.profile.real_name ?? userId);
      };

      // Generate display names and identify other members for DMs/MPIMs
      if (type === 'dm') {
        if (item.members && item.members.length === 2) {
          const otherUserId = item.members.find(
            (memberId: string) => memberId !== currentUserIdForDms
          );
          if (otherUserId != null) {
            chatName = getUserNickname(otherUserId);
            otherMemberIdsForAvatar = [otherUserId]; // Store the single other user ID
          } else {
            console.warn(
              `Could not determine other user for DM ${
                item.id
              }. Members: ${item.members.join(', ')} Owner: ${currentUserIdForDms ?? 'Unknown'}`
            );
            chatName =
              chatName ?? item.members.map(getUserNickname).join(' & ');
            // Cannot reliably determine a single avatar
          }
        } else if (item.members) {
          // DM with self or unknown owner, use all members for name, no specific avatar
          chatName = chatName ?? item.members.map(getUserNickname).join(' & ');
        }
      } else if (type === 'mpim') {
        if (item.members) {
          const otherMemberIds =
            currentUserIdForDms != null
              ? item.members.filter(
                  (memberId: string) => memberId !== currentUserIdForDms
                )
              : item.members;
          const membersToName =
            otherMemberIds.length > 0 ? otherMemberIds : item.members;
          const generatedName = membersToName
            .map(getUserNickname)
            .filter((name: string) => !!name)
            .join(', ');

          if (generatedName) {
            chatName = generatedName;
          }
          // Store all *other* members for potential group avatar logic (or just for info)
          otherMemberIdsForAvatar = otherMemberIds;
        }
      }

      // Fallback name if needed
      chatName = chatName ?? item.id;

      allChats.push({
        id: item.id,
        technicalName: item.name,
        name: chatName,
        type: type,
        isArchived: item.is_archived ?? false,
        otherMemberIds:
          otherMemberIdsForAvatar.length > 0
            ? otherMemberIdsForAvatar
            : undefined,
      });
    });
  };

  // Process lists...
  processList(channels, 'channel');
  processList(groups, 'group');
  processList(dms, 'dm');
  processList(mpims, 'mpim');

  const validChats = allChats.filter(chat => chat.name);
  validChats.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );

  // Store in cache
  allChatsCache = validChats;
  allChatsCacheTimestamp = now;
  console.log(`Cached ${String(validChats.length)} chats.`); // Convert length to string

  return validChats;
}

const debugLog = process.env.DEBUG_DATA_LOADER != null;
// Helper function to find the message directory path
async function findChatDirectoryPath(chatId: string): Promise<string | null> {
  const basePath = getDataBasePath();
  const chats = await getAllChats(); // Use cached version if available
  const chatInfo = chats.find(c => c.id === chatId);

  if (chatInfo == null) {
    console.warn(
      `[findChatDirectoryPath] Could not find chat info for ID: ${chatId}`
    );
    return null;
  }
  const nameCandidates = [
    chatInfo.name,
    chatInfo.technicalName,
    chatInfo.id,
  ].filter(name => name != null);
  for (const nameCandidate of nameCandidates) {
    const namePath = path.join(basePath, nameCandidate);
    try {
      // Check if directory exists
      const stats = await fs.stat(namePath);
      if (stats.isDirectory()) {
        if (debugLog) {
          console.log(
            `[findChatDirectoryPath] Found directory using name: ${namePath}`
          );
        }
        return namePath;
      }
    } catch (error: unknown) {
      // Ignore ENOENT (file not found), log other errors
      if (
        !(error instanceof Error && 'code' in error && error.code === 'ENOENT')
      ) {
        console.error(
          `[findChatDirectoryPath] Error checking name path ${namePath}:`,
          error
        );
      }
    }
  }

  // If neither found
  let chatNameForLog = '[Name Not Available]'; // Default value
  if (typeof chatInfo.name === 'string' && chatInfo.name.trim() !== '') {
    chatNameForLog = chatInfo.name;
  }
  console.warn(
    `[findChatDirectoryPath] Could not find message directory for chat ID: ${chatId} using name '${chatNameForLog}' or ID.`
  );
  return null;
}

const dummyResolve = () => Promise.resolve();

interface SlackMessageAndMarkProcessed {
  message: SlackMessage;
  markAsProcessed: () => Promise<void>;
}

// Function to load messages for a specific chat (with caching and improved directory finding)
export async function getMessagesForChat(
  chatId: string,
  options: {
    unprocessedOnly?: boolean;
  } = {}
): Promise<SlackMessageAndMarkProcessed[]> {
  if (!(options.unprocessedOnly ?? false) && messageCache.has(chatId)) {
    const cachedMessages = messageCache.get(chatId) ?? [];
    messageCache.delete(chatId);
    messageCache.set(chatId, cachedMessages);
    return cachedMessages.map(m => ({
      message: m,
      markAsProcessed: dummyResolve,
    }));
  }

  const chatDirPath = await findChatDirectoryPath(chatId);

  if (chatDirPath == null) {
    // Error logged in findChatDirectoryPath
    // Cache empty result
    messageCache.set(chatId, []);
    pruneCache();
    return [];
  }

  try {
    const globPattern = path.join(chatDirPath, '*.json').replace(/\\/g, '/');
    if (debugLog) {
      console.log(
        `[getMessagesForChat] Globbing for messages in: ${globPattern}`
      );
    }
    const allMessageFiles = await glob(globPattern);
    const messageFiles =
      (options.unprocessedOnly ?? false)
        ? (
            await Promise.all(
              allMessageFiles.map(
                async messageFile =>
                  [messageFile, await isFileProcessed(messageFile)] as const
              )
            )
          )
            .filter(([_, isProcessed]) => !isProcessed)
            .map(([messageFile]) => messageFile)
        : allMessageFiles;

    if (messageFiles.length === 0) {
      if (debugLog) {
        console.warn(
          `[getMessagesForChat] No message files found for chat ID: ${chatId} in resolved path: ${chatDirPath}`
        );
      }
      messageCache.set(chatId, []);
      pruneCache();
      return [];
    }

    const allMessages: SlackMessageAndMarkProcessed[] = [];
    for (const filePath of messageFiles) {
      try {
        const data = await fs.readFile(filePath, 'utf-8');
        if (data.trim().length > 2) {
          const messages = JSON.parse(data) as unknown;
          if (Array.isArray(messages)) {
            const markAsProcessed = (() => {
              let notMarkedAsProcessed = messages.length;
              return async () => {
                notMarkedAsProcessed--;
                if (notMarkedAsProcessed === 0) {
                  await markFilesAsProcessed([{ path: filePath }]);
                }
              };
            })();
            messages.forEach(msg => {
              if (
                typeof msg === 'object' &&
                msg !== null &&
                typeof (msg as { ts?: unknown }).ts === 'string'
              ) {
                allMessages.push({
                  message: msg as SlackMessage,
                  markAsProcessed,
                } as SlackMessageAndMarkProcessed);
              }
            });
          } else {
            console.warn(
              `Parsed data from ${filePath} is not an array, skipping.`
            );
          }
        }
      } catch (err) {
        console.error(
          `Error reading or parsing message file ${filePath}:`,
          err
        );
      }
    }

    // Sort messages by timestamp ASCENDING (oldest first)
    allMessages.sort(
      (a, b) => parseFloat(a.message.ts) - parseFloat(b.message.ts)
    );
    if (!(options.unprocessedOnly ?? false)) {
      messageCache.set(
        chatId,
        allMessages.map(m => m.message)
      );
    }
    pruneCache();

    return allMessages;
  } catch (error) {
    console.error(
      `[getMessagesForChat] Error accessing message directory ${chatDirPath} or reading files:`, // Modified error message
      error
    );
    // Cache empty result on error
    messageCache.set(chatId, []);
    pruneCache();
    return [];
  }
}

// --- SQLite Tracking Functions ---

// Checks if a *single* file has been processed.
export async function isFileProcessed(path: string): Promise<boolean> {
  const db = getDb();
  const result = await db.get<{ '1': number } | undefined>(
    'SELECT 1 FROM processed_files WHERE path = ?',
    [path]
  );
  return result != null;
}

// Marks a *batch* of files as processed. Assumes input files are valid.
// Input should be the minimal info needed: { path: string }[]
const markFilesAsProcessed = (() => {
  const batchSize = 100;

  const markFilesAsProcessedInDb = async (files: { path: string }[]) => {
    const db = getDb();
    try {
      // Use a transaction for bulk inserts
      await db.run('BEGIN TRANSACTION');

      // Prepare statement for efficiency
      // Using INSERT OR IGNORE to avoid errors if a message somehow already exists
      const stmt = await db.prepare(
        'INSERT OR IGNORE INTO processed_files (path) VALUES (?)'
      );

      for (const file of files) {
        await stmt.run(file.path);
      }

      await stmt.finalize();
      await db.run('COMMIT');
      files.length = 0; // Reset the batch
    } catch (error) {
      console.error('Error marking files as processed in SQLite:', error);
      try {
        await db.run('ROLLBACK');
        console.log('SQLite transaction rolled back.');
      } catch (rollbackError) {
        console.error('Error rolling back SQLite transaction:', rollbackError);
      }
      // Re-throw the original error so the caller knows the operation failed
      throw error;
    }
  };

  const markFilesAsProcessedLimited = limitFunction(markFilesAsProcessedInDb, {
    concurrency: 1,
  });

  const batchedFiles: { path: string }[] = [];

  const markFilesAsProcessedResetBatch = async () => {
    const filesToProcess = [...batchedFiles];
    batchedFiles.length = 0;
    await markFilesAsProcessedLimited(filesToProcess);
  };

  let timeout: NodeJS.Timeout | null = null;

  const fn = async (files: { path: string }[]): Promise<void> => {
    batchedFiles.push(...files);
    if (batchedFiles.length < batchSize) {
      if (timeout != null) {
        timeout.close();
      }
      timeout = setTimeout(() => {
        console.log('Batch timeout, marking files as processed.');
        markFilesAsProcessedResetBatch().catch((err: unknown) => {
          console.log(err);
        });
      }, 10000);
      return;
    }
    const filesToProcess = [...batchedFiles];
    batchedFiles.length = 0;
    await markFilesAsProcessedLimited(filesToProcess).catch((err: unknown) => {
      console.log(err);
    });
  };

  return fn;
})();
