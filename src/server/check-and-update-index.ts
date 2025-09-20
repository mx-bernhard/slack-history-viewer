import { sortBy } from 'lodash-es';
import path from 'path';
import { assert } from 'typed-assert';
import {
  findChatDirectoryPath,
  getFiles,
  getMessagesForChat,
} from './data-loader.js';
import { callSolrUpdate, search } from './solr-api.js';

/**
 * In order to provide jumping to an index with a big integer value from a search result (our list
 * only knows list index values from 0 to n), we need to be able to identify search results by chat
 * id and this index. This index is also used when supplying start-solr-query-parameter, so random
 * access an index is easy.
 *
 * But we also need to know which start value to use given a search result entry. So we need to
 * enumerate all messages of one chat from 0 to n. This was easy if we only had to do it once. But
 * we want to be able to continuously add messages and give the new messages the next higher message
 * index.
 *
 * first time (for each chat id):
 *
 * - load messages and add them to solr without a proper message index (it's set to -1)
 * - take the existing data, compute the highest index which yields the value 0, take the position 0
 *   and start updating message index by supplying an incrementally rising index value
 * - don't give non-null thread_ts values (except the thread starter message) an index. We will have
 *   to load threads differently and they are not part of the chat message index. When a thread is
 *   requested, query by thread_ts value and show that ordered in the thread panel. This will not
 *   scale well for very long threads but this is usually not the case. We could still introduce the
 *   same mechanism in a later version of this app if long threads become an issue.
 *
 * subsequent times (for each chat id):
 *
 * - new messages are available with unknown timestamp, could be after the last processed or in the
 *   middle.
 * - we optimize for new messages that are added chronologically after the last processed message
 * - we re-process many messages if the newest messages are not at the end
 * - index the new messages without properly set message index
 * - compute the highest index which is set to a value like 123456
 * - load the item at 123456 by querying with rows: 1 and start: 123456 and ordered by "ts_dt asc".
 * - a) if this value has message index of 123456, then earlier values did not shift. Take the
 *   position 123456+1 and start updating message index by supplying incrementally rising index
 *   values starting from 123456+1 and taking messages from all new files that have been indexed
 *   just now, sort them with "ts_dt asc" only using non-thread-messages.
 * - b) if this value has not message index of 123456, reprocess all messages by loading them all
 *   and start updating the message index for all of the messages for this chat id. This usually
 *   does not happen often or in most cases ever, so, optimizing this is just overcomplicating the
 *   implementation.
 */
export const checkAndUpdateMessageIndex = async (chatId: string) => {
  const chatIdAndIndexes = await search({
    // {!collapse} aggregates multiple values into one with an aggregate - here max
    fq: '{!collapse field=chat_id_s max=message_index_l}',
    q: 'thread_message_b: false AND chat_id_s: ' + chatId,
    fl: 'chat_id_s, message_index_l, ts_dt',
    rows: 2,
    start: 0,
  });

  assert(
    chatIdAndIndexes.response.numFound <= 1 &&
      chatIdAndIndexes.response.numFoundExact
  );

  const { messageIndexOfLastValidMessage, timestampOfLastValidMessage } =
    await (async () => {
      const {
        chat_id_s: chatIdResponseValue,
        ts_dt: ts,
        message_index_l,
      } = chatIdAndIndexes.response.docs[0] ?? {
        chat_id_s: chatId,
        ts_dt: 0,
        message_index_l: null,
      };
      const highestMessageIndex = message_index_l;
      assert(chatIdResponseValue === chatId);
      const everythingInvalidFallback = {
        messageIndexOfLastValidMessage: -1,
        timestampOfLastValidMessage: new Date(0),
      };
      if (highestMessageIndex == null || highestMessageIndex < 0)
        return everythingInvalidFallback;
      const result = await search({
        q: 'thread_message_b: false AND chat_id_s: ' + chatId,
        rows: 1,
        start: highestMessageIndex,
        sort: 'ts_dt asc',
      });
      return result.response.docs.length === 1 &&
        result.response.docs[0]?.ts_dt === ts
        ? {
            messageIndexOfLastValidMessage: highestMessageIndex,
            timestampOfLastValidMessage: new Date(
              result.response.docs[0].ts_dt
            ),
          }
        : everythingInvalidFallback;
    })();

  const numFound = await (async () => {
    const result = await search({
      q: 'chat_id_s: ' + chatId,
      rows: 0,
      start: 0,
    });
    return result.response.numFoundExact ? result.response.numFound : null;
  })();

  if (numFound === messageIndexOfLastValidMessage + 1) {
    // search index did not change for this chat id and message index is still fine (note: this is a
    // heuristic, there could be errors in the middle), no reprocessing required
    return;
  }

  const chatDirectoryPath = await findChatDirectoryPath(chatId);
  if (chatDirectoryPath == null) {
    console.warn('Could not find files for ' + chatId);
    return;
  }

  // If there is a mismatch between the solr position of the document, it means documents were
  // inserted that shifted positions. In that case we need to process all of them. Otherwise we just
  // take everything from highest message index which should be much less
  const files = await getFiles(chatDirectoryPath, 'all');
  const fileToProcess = sortBy(
    files.map(file => {
      return {
        day: /[0-9]{4}-[0-9]{2}-[0-9]{2}/.exec(path.parse(file).name)?.[0],
        file,
      };
    }),
    fileAndDay => fileAndDay.day
  )
    .filter(
      ({ day }) => day == null || new Date(day) > timestampOfLastValidMessage
    )
    .map(({ file }) => file);
  const messagesToProcess = (
    await getMessagesForChat(chatId, fileToProcess)
  ).filter(
    m => m.message.thread_ts == null || m.message.thread_ts === m.message.ts
  );
  console.log(
    'Updating message_index_l for chat id ' +
      chatId +
      ` affecting ${String(messagesToProcess.length)} messages`
  );
  if (messagesToProcess.length === 0) return;
  await callSolrUpdate(
    messagesToProcess.map((message, index) => {
      const newIndex = index + messageIndexOfLastValidMessage + 1;
      const id = `${chatId}_${message.message.ts}`;
      return { id, message_index_l: { set: newIndex } };
    })
  );
};
