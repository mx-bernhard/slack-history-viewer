import fs from 'fs/promises';
import { glob } from 'glob';
import { groupBy, sortBy } from 'lodash-es';
import { limitFunction } from 'p-limit';
import path from 'path';
import { Database, open } from 'sqlite';
import sqlite3 from 'sqlite3';
import {
  ChatInfo,
  SlackChannel,
  SlackDM,
  SlackGroup,
  SlackMessage,
  SlackMPIM,
  SlackUser,
} from '../types.js';

let internalDataBasePath: string | null = null;

let dbInstance: Database | null = null;
const dbFilename: string =
  process.env.SLACK_DB_FILENAME ?? './processed_messages.db';

function getDb(): Database {
  if (dbInstance === null) {
    throw new Error(
      'Database has not been initialized. Call initDataLoader first.'
    );
  }
  return dbInstance;
}

export async function initDataLoader(basePath: string): Promise<void> {
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

  try {
    const verboseSqlite3 = sqlite3.verbose();
    console.log(`Initializing SQLite tracking database at: ${dbFilename}`);
    dbInstance = await open({
      filename: dbFilename,
      mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
      driver: verboseSqlite3.Database,
    });

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

    throw new Error('SQLite DB initialization failed');
  }
}

function getDataBasePath(): string {
  if (internalDataBasePath === null) {
    throw new Error(
      'Data loader has not been initialized. Call initDataLoader first.'
    );
  }
  return internalDataBasePath;
}

const MAX_CACHE_SIZE = 50;

const messageCache = new Map<string, SlackMessage[]>();

function pruneCache() {
  if (messageCache.size > MAX_CACHE_SIZE) {
    const oldestKey = messageCache.keys().next().value as unknown as
      | string
      | undefined;
    if (oldestKey != null && typeof oldestKey === 'string') {
      messageCache.delete(oldestKey);
    }
  }
}

let allChatsCache: ChatInfo[] | null = null;
let allChatsCacheTimestamp: number | null = null;
const ALL_CHATS_CACHE_DURATION = 5 * 60 * 1000;

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  const basePath = getDataBasePath();
  try {
    const fullPath = path.join(basePath, filePath);

    const data = await fs.readFile(fullPath, 'utf-8');

    if (data.trim().length <= 2) return null;
    return JSON.parse(data) as T;
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null;
    } else {
      console.error(`Error reading data file ${filePath}:`, error);

      throw error;
    }
  }
}

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

const createUserMap = async () => {
  const users = (await loadUsers()) ?? [];
  const userMap = new Map<string, SlackUser>(users.map(u => [u.id, u]));
  return userMap;
};

export const createGetUserNickname = async () => {
  const userMap = await createUserMap();
  return (
    userId: string
  ): {
    userId: string;
    realName: string;
    name: string;
    displayName: string;
  } => {
    const member = userMap.get(userId);
    const realName = member?.profile.real_name ?? userId;
    const name = member?.name ?? realName;
    const displayName = (() => {
      const candidate = member?.profile.display_name?.trim();
      return candidate != null && candidate !== '' ? candidate : name;
    })();
    return { userId, realName, name, displayName };
  };
};

export async function getAllChats(): Promise<ChatInfo[]> {
  const now = Date.now();
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
  const [channels, groups, dms, mpims] = await Promise.all([
    loadChannels(),
    loadGroups(),
    loadDms(),
    loadMpims(),
  ]);
  const getUserNickname = await createGetUserNickname();
  const allChats: ChatInfo[] = [];

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
      let chatName = item.name;
      let otherMemberIdsForAvatar: string[] = [];

      if (type === 'dm') {
        if (item.members && item.members.length === 2) {
          const otherUserId = item.members.find(
            (memberId: string) => memberId !== currentUserIdForDms
          );
          if (otherUserId != null) {
            chatName = getUserNickname(otherUserId).displayName;
            otherMemberIdsForAvatar = [otherUserId];
          } else {
            console.warn(
              `Could not determine other user for DM ${
                item.id
              }. Members: ${item.members.join(', ')} Owner: ${currentUserIdForDms ?? 'Unknown'}`
            );
            chatName =
              chatName ??
              item.members
                .map(member => getUserNickname(member).displayName)
                .join(' & ');
          }
        } else if (item.members) {
          chatName =
            chatName ??
            item.members
              .map(member => getUserNickname(member).displayName)
              .join(' & ');
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
            .map(member => getUserNickname(member).displayName)
            .filter((name: string) => !!name)
            .join(', ');

          if (generatedName) {
            chatName = generatedName;
          }
          otherMemberIdsForAvatar = otherMemberIds;
        }
      }

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

  processList(channels, 'channel');
  processList(groups, 'group');
  processList(dms, 'dm');
  processList(mpims, 'mpim');

  const validChats = allChats.filter(chat => chat.name);
  validChats.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  );

  allChatsCache = validChats;
  allChatsCacheTimestamp = now;
  console.log(`Cached ${String(validChats.length)} chats.`);

  return validChats;
}

const debugLog = process.env.DEBUG_DATA_LOADER != null;

async function findChatDirectoryPath(chatId: string): Promise<string | null> {
  const basePath = getDataBasePath();
  const chats = await getAllChats();
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

  let chatNameForLog = '[Name Not Available]';
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
      `[getMessagesForChat] Error accessing message directory ${chatDirPath} or reading files:`,
      error
    );

    messageCache.set(chatId, []);
    pruneCache();
    return [];
  }
}

export async function isFileProcessed(path: string): Promise<boolean> {
  const db = getDb();
  const result = await db.get<{ '1': number } | undefined>(
    'SELECT 1 FROM processed_files WHERE path = ?',
    [path]
  );
  return result != null;
}

const markFilesAsProcessed = (() => {
  const batchSize = 100;

  const markFilesAsProcessedInDb = async (files: { path: string }[]) => {
    const db = getDb();
    try {
      await db.run('BEGIN TRANSACTION');

      const stmt = await db.prepare(
        'INSERT OR IGNORE INTO processed_files (path) VALUES (?)'
      );

      for (const file of files) {
        await stmt.run(file.path);
      }

      await stmt.finalize();
      await db.run('COMMIT');
      files.length = 0;
    } catch (error) {
      console.error('Error marking files as processed in SQLite:', error);
      try {
        await db.run('ROLLBACK');
        console.log('SQLite transaction rolled back.');
      } catch (rollbackError) {
        console.error('Error rolling back SQLite transaction:', rollbackError);
      }

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
