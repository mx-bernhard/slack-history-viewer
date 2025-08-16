import { isNotNull, isNotUndefined } from 'typed-assert';
import {
  findChatDirectoryPath,
  getAllChats,
  getFiles,
  getMessagesForChat,
  markFilesAsProcessed,
} from './data-loader.js';
import { createExtractInfos } from './extract-infos.js';
import {
  callSolrUpdate,
  checkSolrConnection,
  commitIndex,
  search,
} from './solr-api.js';
import { checkAndUpdateMessageIndex as checkAndUpdateMessageIndex } from './check-and-update-index.js';

export interface SearchResultDocument {
  id: string;
  chatId: string;
  ts: string;
  tsDt: string;
  messageIndex: number;
  threadTsDt: string | null;
  threadTs: string | null;
  userDisplayName: string | null;
  userName: string;
  userRealName: string;
  userId: string;
  text: string;
  highlightPhrases: string[];
}

const HL_PRE_MARKER = '@@SLACK_HL_START@@';
const HL_POST_MARKER = '@@SLACK_HL_END@@';

const HIGHLIGHT_EXTRACT_REGEX = new RegExp(
  `${HL_PRE_MARKER}(.*?)${HL_POST_MARKER}`,
  'g'
);

await checkSolrConnection();
interface SolrDoc {
  id: string;
  chat_id_s: string;
  ts_dt: string;
  ts_s: string;
  user_id_s: string;
  [messageField]: string;
  user_display_name_s?: string;
  user_name_s: string;
  chat_type_s: string;
  user_real_name_s: string;
  channel_name_s: string;
  url_ss: string[];
  file_path_s: string;
  thread_message_b: boolean;
  thread_ts_dt: string | null;
  thread_ts_s: string | null;
  message_index_l: number;
}

export async function buildSearchIndex(): Promise<void> {
  console.log('Starting Solr indexing process...');
  const startTime = Date.now();

  let totalMessagesAttempted: number = 0;
  let totalMessagesSuccessfullyIndexed: number = 0;
  let buildHadErrors: boolean = false;
  const batchSize: number = 1000;
  const { submitBatch, getDocumentsBatch } = (() => {
    let documentsBatch: SolrDoc[] = [];
    return {
      getDocumentsBatch: () => {
        return documentsBatch;
      },
      submitBatch: async () => {
        console.log(
          `Submitting batch of ${documentsBatch.length.toString()} documents...`
        );
        const currentDocsToAdd = [...documentsBatch];
        documentsBatch = [];

        const success = await callSolrUpdate(currentDocsToAdd);
        if (!success) {
          console.error(`Error submitting batch to Solr.`);
          buildHadErrors = true;
        } else {
          totalMessagesSuccessfullyIndexed += currentDocsToAdd.length;
        }
      },
    };
  })();

  try {
    console.log('Fetching chats to index...');
    const chats = await getAllChats();
    const extractInfos = createExtractInfos();
    if (chats.length === 0) {
      console.warn('No chats found to index.');
      return;
    }

    console.log(`Processing ${String(chats.length)} chats for indexing...`);

    for (const chat of chats) {
      try {
        const chatDirectoryPath = await findChatDirectoryPath(chat.id);
        if (chatDirectoryPath == null) continue;
        const unprocessedFiles = await getFiles(
          chatDirectoryPath,
          'unprocessed'
        );
        const messages = await getMessagesForChat(chat.id, unprocessedFiles);
        totalMessagesAttempted += messages.length;

        for (const { message, filePath } of messages) {
          const docId = `${chat.id}_${message.ts}`;
          isNotNull(filePath);
          const solrDoc: SolrDoc = {
            id: docId,
            chat_id_s: chat.id,
            ts_dt: new Date(
              Math.floor(parseFloat(message.ts) * 1000)
            ).toISOString(),
            ts_s: message.ts,
            user_id_s: message.user ?? 'Unknown',
            user_display_name_s: message.user_profile?.display_name,
            user_name_s: message.user_profile?.name ?? 'Unknown',
            user_real_name_s: message.user_profile?.real_name ?? 'Unknown',
            [messageField]: message.text ?? '',
            chat_type_s: chat.type,
            channel_name_s: chat.name,
            file_path_s: filePath,
            message_index_l: -1,
            thread_message_b:
              message.thread_ts != null && message.thread_ts !== message.ts,
            thread_ts_dt:
              message.thread_ts != null
                ? new Date(
                    Math.floor(parseFloat(message.thread_ts) * 1000)
                  ).toISOString()
                : null,
            thread_ts_s: message.thread_ts ?? null,
            ...extractInfos(message),
          };
          getDocumentsBatch().push(solrDoc);

          if (getDocumentsBatch.length >= batchSize) {
            await submitBatch();
          }
        }
        if (unprocessedFiles.length > 0) {
          await submitBatch();
          await commitIndex();
          await checkAndUpdateMessageIndex(chat.id);
          await markFilesAsProcessed({ filePaths: unprocessedFiles });
        }
      } catch (error: unknown) {
        console.error(
          `Error processing chat ${chat.id} for Solr indexing:`,
          error
        );
        buildHadErrors = true;
      }
    }

    if (getDocumentsBatch().length > 0) {
      console.log(
        `Submitting final batch of ${getDocumentsBatch().length.toString()} documents...`
      );
      await submitBatch();
      await commitIndex();
    }

    if (!buildHadErrors) {
      try {
        await commitIndex();
      } catch (commitError) {
        console.error('Error committing changes to Solr:', commitError);
        buildHadErrors = true;
      }
    } else {
      console.warn('Skipping final Solr commit due to errors during indexing.');
    }

    const duration = Date.now() - startTime;
    if (buildHadErrors) {
      console.warn(
        `Solr indexing completed in ${duration.toString()}ms with some errors. Attempted: ${totalMessagesAttempted.toString()}, Successfully Indexed (in Solr): ${totalMessagesSuccessfullyIndexed.toString()}. Index may be incomplete or contain duplicates if SQLite updates failed.`
      );
    } else {
      console.log(
        `Solr indexing completed successfully in ${duration.toString()}ms. Attempted: ${totalMessagesAttempted.toString()}, Successfully Indexed (in Solr): ${totalMessagesSuccessfullyIndexed.toString()}.`
      );
    }
  } catch (error: unknown) {
    console.error('Fatal error during Solr indexing process:', error);
  }
}

const messageField = 'text_txt_en';

export interface SolrSearchArgs {
  q: string;
  fl?: string;
  fq?: string;
  df?: string;
  hl?: boolean;
  'hl.fl'?: string;
  'hl.fragsize'?: number;
  'hl.simple.pre'?: string;
  'hl.simple.post'?: string;
  start: number;
  rows: number;
  sort?: string;
  wt?: string;
}

export interface SolrQueryResponse {
  response: {
    numFound: number;
    numFoundExact: boolean;
    docs: SolrDoc[];
  };
  highlighting?: Record<
    string,
    undefined | Record<string, undefined | string[]>
  >;
}

export async function searchMessages(
  query: string,
  limit = 50
): Promise<SearchResultDocument[]> {
  console.log(
    `Performing Solr search for query: "${query}" with limit: ${String(limit)}`
  );
  const startTime = Date.now();

  try {
    const result = await search({
      q: query,
      df: messageField,
      hl: true,
      'hl.fl': messageField,
      'hl.fragsize': 0,
      'hl.simple.pre': HL_PRE_MARKER,
      'hl.simple.post': HL_POST_MARKER,
      start: 0,
      rows: limit,
      sort: 'ts_dt desc',
      wt: 'json',
    });
    const highlights = result.highlighting ?? {};

    const finalDocs: SearchResultDocument[] = result.response.docs.map(
      (doc: SolrDoc) => {
        const highlightedSnippets = highlights[doc.id]?.[messageField];
        let highlightPhrases: string[] = [];

        if (highlightedSnippets && highlightedSnippets.length > 0) {
          const snippet = highlightedSnippets[0];
          isNotUndefined(snippet);
          let match;

          while ((match = HIGHLIGHT_EXTRACT_REGEX.exec(snippet)) !== null) {
            if (match[1] != null) {
              highlightPhrases.push(match[1]);
            }
          }

          highlightPhrases = [...new Set(highlightPhrases)];
        }

        return {
          id: doc.id,
          chatId: doc.chat_id_s,
          ts: doc.ts_s,
          tsDt: doc.ts_dt,
          threadTs: doc.thread_ts_s,
          threadTsDt: doc.thread_ts_dt,
          userDisplayName: doc.user_display_name_s ?? null,
          userName: doc.user_name_s,
          userRealName: doc.user_real_name_s,
          userId: doc.user_id_s,
          messageIndex: doc.message_index_l,
          text: doc[messageField],
          highlightPhrases,
        } satisfies SearchResultDocument;
      }
    );

    return finalDocs;
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    console.error(
      `Error performing Solr search for query "${query}" after ${duration.toString()}ms:`,
      error
    );
    return [];
  }
}
