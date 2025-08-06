import { getAllChats, getMessagesForChat } from './data-loader.js';

export interface SearchResultDocument {
  id: string;
  chatId: string;
  ts: string;
  user: string;
  text: string;
  highlightPhrases: string[];
}

const HL_PRE_MARKER = '@@SLACK_HL_START@@';
const HL_POST_MARKER = '@@SLACK_HL_END@@';

const HIGHLIGHT_EXTRACT_REGEX = new RegExp(
  `${HL_PRE_MARKER}(.*?)${HL_POST_MARKER}`,
  'g'
);

const solrHost = process.env.SLACK_SOLR_HOST ?? 'localhost';
const solrPort = process.env.SLACK_SOLR_PORT ?? '8983';
const solrCore = process.env.SLACK_SOLR_CORE ?? 'slack_messages';

const solrApiBase = `http://${solrHost}:${solrPort}/solr/${solrCore}`;

console.log(`Connecting to Solr: ${solrApiBase}`);

// Ping Solr to check connection on startup (optional but good practice)
// Wrap ping in an async function to use await
async function checkSolrConnection(): Promise<void> {
  try {
    const response = await fetch(solrApiBase + '/admin/ping?wt=json', {
      method: 'GET',
      headers: { accept: 'application/json; charset=utf-8' },
    });
    console.log('Successfully pinged Solr:', response.statusText);
  } catch (err: unknown) {
    // Type err as unknown and handle appropriately
    if (err instanceof Error) {
      console.error(`Error pinging Solr: ${err.message}`);
    } else {
      console.error(`Error pinging Solr: ${String(err)}`);
    }
  }
}

// Call the async function - use void for fire-and-forget
void checkSolrConnection();

// Assuming SQLite check for already processed files happens in data-loader or needs adding there
export async function buildSearchIndex(): Promise<void> {
  console.log('Starting Solr indexing process...');
  const startTime = Date.now();
  // Explicitly type counters
  let totalMessagesAttempted: number = 0;
  let totalMessagesSuccessfullyIndexed: number = 0;
  let buildHadErrors: boolean = false;
  const batchSize: number = 1000; // Index documents in batches
  let documentsBatch: Record<string, unknown>[] = [];
  const markAsProcessedBatch: (() => Promise<void>)[] = [];
  let processedInfoBatch: { chatId: string; ts: string }[] = []; // Track IDs for SQLite update

  try {
    console.log('Fetching chats to index...');
    const chats = await getAllChats();
    if (chats.length === 0) {
      console.warn('No new chats found to index.');
      return;
    }

    console.log(`Processing ${String(chats.length)} chats for indexing...`);
    for (const chat of chats) {
      try {
        const messages = await getMessagesForChat(chat.id, {
          unprocessedOnly: true,
        });
        totalMessagesAttempted += messages.length;

        for (const { message, markAsProcessed } of messages) {
          if (
            message.text != null &&
            message.text.trim() !== '' &&
            message.subtype == null
          ) {
            const docId = `${chat.id}_${message.ts}`;

            // Prepare document for Solr
            // Using dynamic field conventions (_s for string, _l for long, _txt_en for text, _dt for timestamp iso format)
            // Solr automatically handles types for dynamic fields if schema is schemaless
            const solrDoc = {
              id: docId,
              chatId_s: chat.id,
              chat_id_s: chat.id,
              ts_l: Math.floor(parseFloat(message.ts) * 1000),
              ts_dt: new Date(
                Math.floor(parseFloat(message.ts) * 1000)
              ).toISOString(),
              user_id_s: message.user ?? 'Unknown',
              user_display_name_s:
                message.user_profile?.display_name ?? 'Unknown',
              user_name_s: message.user_profile?.name ?? 'Unknown',
              user_real_name_s: message.user_profile?.real_name ?? 'Unknown',
              [messageField]: message.text,
              chat_type_s: chat.type,
              channel_name_s: chat.name,
            };
            documentsBatch.push(solrDoc);
            markAsProcessedBatch.push(markAsProcessed);
            // Also add minimal info to the batch for SQLite tracking
            processedInfoBatch.push({ chatId: chat.id, ts: message.ts });

            // If batch is full, send it to Solr
            if (documentsBatch.length >= batchSize) {
              console.log(
                `Indexing batch of ${documentsBatch.length.toString()} documents...`
              );
              const currentDocsToAdd = [...documentsBatch]; // Copy batches before async call
              documentsBatch = []; // Reset batch for next iteration
              processedInfoBatch = [];

              const success = await callSolrUpdate(currentDocsToAdd);
              if (!success) {
                console.error(
                  `Error indexing batch to Solr or marking as processed.`
                );
                buildHadErrors = true;
              } else {
                totalMessagesSuccessfullyIndexed += currentDocsToAdd.length;
                // Mark this batch as processed in SQLite *after* successful Solr add
                await Promise.all(markAsProcessedBatch.map(m => m()));
              }
            }
          }
        }
        // TODO: If tracking is done at chat/file level, update SQLite here.
        // Current implementation tracks at message level.
      } catch (error: unknown) {
        console.error(
          `Error processing chat ${chat.id} for Solr indexing:`,
          error
        );
        buildHadErrors = true;
      }
    }

    // Index any remaining documents in the last batch
    if (documentsBatch.length > 0) {
      console.log(
        `Indexing final batch of ${documentsBatch.length.toString()} documents...`
      );
      const finalDocsToAdd = [...documentsBatch];

      const success = await callSolrUpdate(finalDocsToAdd);
      if (!success) {
        console.error(
          'Error indexing final batch to Solr or marking as processed.'
        );
        buildHadErrors = true;
      } else {
        totalMessagesSuccessfullyIndexed += finalDocsToAdd.length;
      }
    }

    // Commit changes to make them searchable in Solr
    // Only commit if no *fatal* errors occurred during batch processing
    if (!buildHadErrors) {
      // Or adjust condition based on desired resilience
      try {
        console.log('Committing changes to Solr index...');
        await commitIndex();
        console.log('Solr commit successful.');
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

async function callSolrUpdate(json: unknown) {
  const jsonStringBody = JSON.stringify(json);
  const updateResponse = await fetch(solrApiBase + '/update/json?wt=json', {
    method: 'POST',
    headers: {
      accept: 'application/json; charset=utf-8',
      'content-length': String(Buffer.byteLength(jsonStringBody)),
      'content-type': 'application/json',
    },
    body: jsonStringBody,
  });
  if (updateResponse.status >= 400 && updateResponse.status < 500) {
    throw new Error(
      'Error ' +
        String(updateResponse.status) +
        ': Could not add documents to solr. Response: ' +
        updateResponse.statusText
    );
  }
  if (updateResponse.status !== 200) {
    console.error('!!!! Could not update index: ' + updateResponse.statusText);
    return false;
  }

  return true;
}

async function commitIndex() {
  await callSolrUpdate({ commit: {} });
}

export async function searchMessages(
  query: string,
  limit = 50
): Promise<SearchResultDocument[]> {
  console.log(
    `Performing Solr search for query: "${query}" with limit: ${String(limit)}`
  );
  const startTime = Date.now();

  interface SolrDoc {
    id: string;
    chatId_s?: string;
    ts_l?: number;
    ts_dt?: string;
    user_s?: string;
    [messageField]?: string;
  }

  try {
    interface SolrQueryResponse {
      response: {
        numFound: number;
        docs: SolrDoc[];
      };
      highlighting?: Record<
        string,
        undefined | Record<string, undefined | string[]>
      >;
    }

    // Assert type to include highlighting
    const search = {
      q: query,
      df: messageField,
      hl: String(true),
      'hl.fl': messageField,
      'hl.fragsize': String(0),
      'hl.simple.pre': HL_PRE_MARKER,
      'hl.simple.post': HL_POST_MARKER,
      start: String(0),
      rows: String(limit),
      sort: 'ts_l desc',
      wt: 'json',
    };
    const queryParams = new URLSearchParams(Object.entries(search)).toString();
    const response = await fetch(solrApiBase + '/select?' + queryParams, {
      method: 'GET',
    });
    if (response.status !== 200) {
      throw new Error('Could not search: ' + response.statusText);
    }
    const result = (await response.json()) as SolrQueryResponse;
    const highlights = result.highlighting ?? {};

    const finalDocs: SearchResultDocument[] = result.response.docs.map(
      (doc: SolrDoc) => {
        const timestampMilliseconds = doc.ts_l ?? 0;
        const timestampSeconds = timestampMilliseconds / 1000;

        const highlightedSnippets = highlights[doc.id]?.[messageField];
        let highlightPhrases: string[] = [];

        // If highlights exist for this doc, extract terms between markers
        if (highlightedSnippets && highlightedSnippets.length > 0) {
          const snippet = highlightedSnippets[0]; // fragsize=0 means one snippet
          // assert(snippet !== undefined);
          let match;
          // Use regex to find all occurrences and extract the captured group (.*?)
          while ((match = HIGHLIGHT_EXTRACT_REGEX.exec(snippet)) !== null) {
            // Add the captured group (the text between markers)
            if (match[1]) {
              highlightPhrases.push(match[1]);
            }
          }
          // Deduplicate phrases
          highlightPhrases = [...new Set(highlightPhrases)];
        }

        return {
          id: doc.id,
          chatId: doc.chatId_s ?? '',
          ts: timestampSeconds.toFixed(6),
          user: doc.user_s ?? 'Unknown',
          // Return the ORIGINAL text
          text: doc[messageField] ?? '',
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
