import { apiClient } from '../api/api-client';
import { searchQuery } from '../api/use-queries';
import { defaultLimit } from '../components/constants';
import { routerToInternalResultIndex } from './-result-index';

// there is no paging implemented for this in the backend, assume 1000 is enough
const maxThreadMessages = 1000;

export const queryResultIndexLoader = async ({
  deps: { query, resultIndex: _resultIndex, limit },
}: {
  deps: {
    query: string | undefined;
    resultIndex: number | undefined;
    limit: number | undefined;
  };
}) => {
  const resultIndex = routerToInternalResultIndex(_resultIndex);
  if (query == null) {
    return {
      searchResults: null,
      searchResult: null,
      messageIndex: null,
      threadMessageIndex: null,
    };
  }
  const searchResults = await searchQuery(query, limit ?? defaultLimit);
  const searchResult = resultIndex != null ? searchResults[resultIndex] : null;
  if (searchResult == null) {
    return {
      searchResults,
      searchResult,
      messageIndex: null,
      threadMessageTs: null,
    };
  }
  if (searchResult.threadTs == null) {
    return {
      searchResults,
      searchResult,
      messageIndex: searchResult.messageIndex,
      threadMessageTs: null,
    };
  }
  const threadMessages = await apiClient.searchMessages(
    'thread_ts_s: ' +
      searchResult.threadTs +
      ' AND chat_id_s: ' +
      searchResult.chatId,
    maxThreadMessages
  );

  const threadMessageIndex = threadMessages.findIndex(
    message => message.ts === searchResult.ts
  );
  const threadStartingMessage = threadMessages.at(-1);

  if (threadMessageIndex !== -1) {
    return {
      messageIndex: threadStartingMessage?.messageIndex ?? -1,
      searchResults,
      searchResult,
      threadMessageTs: searchResult.threadTs,
    };
  }
  return {
    searchResults,
    searchResult,
    messageIndex: searchResult.messageIndex,
    threadMessageTs: null,
  };
};
