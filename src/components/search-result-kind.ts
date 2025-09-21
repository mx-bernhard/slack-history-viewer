import type { SearchResultDocument } from '../types';

export const getCurrentSearchResultMessageKind = ({
  chatId,
  messageTs,
  searchResults,
  searchResultIndex,
}: {
  chatId: string;
  messageTs: string;
  searchResults: SearchResultDocument[];
  searchResultIndex: number | null;
}) => {
  if (searchResultIndex == null) {
    return 'none';
  }
  const currentSearchResult = searchResults[searchResultIndex];
  if (currentSearchResult == null || currentSearchResult.chatId != chatId) {
    return 'none';
  }
  return currentSearchResult.ts === messageTs
    ? 'message'
    : currentSearchResult.threadTs === messageTs
      ? 'thread-starter'
      : 'none';
};

export const getCurrentSearchResultMessageKindOfCurrentChat = ({
  chatId,
  messageTs,
  searchResults,
  searchResultIndex,
}: {
  chatId: string | null;
  messageTs: string;
  searchResults: SearchResultDocument[];
  searchResultIndex: number | null;
}) => {
  return chatId != null
    ? getCurrentSearchResultMessageKind({
        chatId,
        messageTs,
        searchResults,
        searchResultIndex,
      })
    : 'none';
};
