import * as Solr from 'solr-client';

import { getAllChats, getMessagesForChat } from './data-loader.js';

// --- Keep Interfaces ---
export interface SearchResultDocument {
  id: string; // Unique ID (chatId_ts)
  chatId: string;
  ts: string; // Timestamp string
  user: string;
  text: string;
  highlightPhrases: string[];
}

// --- Define markers for internal extraction ---
const HL_PRE_MARKER = '@@SLACK_HL_START@@';
const HL_POST_MARKER = '@@SLACK_HL_END@@';
// Regex to find text between markers
const HIGHLIGHT_EXTRACT_REGEX = new RegExp(
  `${HL_PRE_MARKER}(.*?)${HL_POST_MARKER}`,
  'g'
);

// --- Solr Client Initialization ---
const solrHost = process.env.SOLR_HOST ?? 'localhost';
const solrPort = process.env.SOLR_PORT ?? '8983';
const solrCore = process.env.SOLR_CORE ?? 'slack_messages'; // Core name from docker-compose

const solrClient = Solr.createClient({
  host: solrHost,
  port: solrPort,
  core: solrCore,
  path: '/solr', // Base path for Solr API
});

console.log(
  `Connecting to Solr: http://${solrHost}:${solrPort}/solr/${solrCore}`
);

// Ping Solr to check connection on startup (optional but good practice)
// Wrap ping in an async function to use await
async function checkSolrConnection(): Promise<void> {
  try {
    const obj = await solrClient.ping(); // Await the promise
    console.log('Successfully pinged Solr:', obj);
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
            // Using dynamic field conventions (_s for string, _l for long, _txt_en for text)
            // Solr automatically handles types for dynamic fields if schema is schemaless
            const solrDoc = {
              id: docId, // Solr unique key
              chatId_s: chat.id,
              ts_l: Math.floor(parseFloat(message.ts) * 1000), // Store as milliseconds epoch long for sorting/range queries
              user_s: message.user ?? 'Unknown',
              text_txt_en: message.text, // Use text_en for English language analysis
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

              try {
                await solrClient.add(currentDocsToAdd);
                totalMessagesSuccessfullyIndexed += currentDocsToAdd.length;
                // Mark this batch as processed in SQLite *after* successful Solr add
                await Promise.all(markAsProcessedBatch.map(m => m()));
              } catch (batchError) {
                console.error(
                  `Error indexing batch to Solr or marking as processed:`,
                  batchError
                );
                buildHadErrors = true;
                // Decide on error handling: retry? Skip batch? Stop?
                // For now, we just mark an error and continue to the next batch.
              }
            }
          }
        }
        // TODO: If tracking is done at chat/file level, update SQLite here.
        // Current implementation tracks at message level.
      } catch (chatError: unknown) {
        console.error(
          `Error processing chat ${chat.id} for Solr indexing:`,
          chatError
        );
        buildHadErrors = true; // Mark that an error occurred during chat processing
      }
    }

    // Index any remaining documents in the last batch
    if (documentsBatch.length > 0) {
      console.log(
        `Indexing final batch of ${documentsBatch.length.toString()} documents...`
      );
      const finalDocsToAdd = [...documentsBatch]; // Copy batches

      try {
        await solrClient.add(finalDocsToAdd);
        totalMessagesSuccessfullyIndexed += finalDocsToAdd.length;
      } catch (batchError) {
        console.error(
          `Error indexing final batch to Solr or marking as processed:`,
          batchError
        );
        buildHadErrors = true;
      }
    }

    // Commit changes to make them searchable in Solr
    // Only commit if no *fatal* errors occurred during batch processing
    if (!buildHadErrors) {
      // Or adjust condition based on desired resilience
      try {
        console.log('Committing changes to Solr index...');
        await solrClient.commit();
        console.log('Solr commit successful.');
      } catch (commitError) {
        console.error('Error committing changes to Solr:', commitError);
        buildHadErrors = true; // Mark error if commit fails
      }
    } else {
      console.warn('Skipping final Solr commit due to errors during indexing.');
    }

    // **TODO**: Perform final SQLite updates if necessary after successful commit.

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
    // We might need to handle partial batch failures and SQLite rollbacks depending on requirements
  }
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
    user_s?: string;
    text_txt_en?: string;
  }

  const solrQuery = solrClient
    .query()
    .q(query) // Use raw query
    // Request highlighting with custom markers for extraction
    .hl({
      on: true,
      fl: 'text_txt_en',
      simplePre: HL_PRE_MARKER,
      simplePost: HL_POST_MARKER,
      fragsize: 0, // Important: Get whole field content for extraction
    })
    .start(0)
    .rows(limit)
    .sort({ ts_l: 'desc' });

  try {
    // Assert type to include highlighting
    const result = (await solrClient.search(solrQuery)) as {
      response: { numFound: number; docs: SolrDoc[] };
      highlighting?: Record<
        string,
        undefined | Record<string, undefined | string[]>
      >;
    };
    const highlights = result.highlighting ?? {};

    const finalDocs: SearchResultDocument[] = result.response.docs.map(
      (doc: SolrDoc) => {
        const timestampMilliseconds = doc.ts_l ?? 0;
        const timestampSeconds = timestampMilliseconds / 1000;

        const highlightedSnippets = highlights[doc.id]?.text_txt_en;
        let highlightPhrases: string[] = [];

        // If highlights exist for this doc, extract terms between markers
        if (highlightedSnippets && highlightedSnippets.length > 0) {
          const snippet = highlightedSnippets[0]; // fragsize=0 means one snippet
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
          text: doc.text_txt_en ?? '',
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
