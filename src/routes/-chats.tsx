import { useSearch } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';
import { ChatList } from '../components/chat-list';
import type { SearchResultDocument } from '../types';
import { Link } from '../components/link';
import {
  internalToRouterResultIndex,
  routerToInternalResultIndex,
} from './-result-index';

export const Chats = ({
  selectedChatId,
  searchResults,
}: {
  selectedChatId: string | null;
  searchResults: SearchResultDocument[];
}) => {
  const { query, resultIndex, limit } = useSearch({
    strict: false,
    select: ({ query, resultIndex, limit }) => ({
      query,
      resultIndex: routerToInternalResultIndex(resultIndex),
      limit,
    }),
  });
  const filterChat = useMemo(
    () =>
      (query?.trim().length ?? 0) > 0
        ? (chatId: string): boolean =>
            searchResults.some(searchResult => searchResult.chatId === chatId)
        : null,
    [query, searchResults]
  );

  const additionalChatInfo = useCallback(
    (chatId: string) => {
      if (searchResults.length === 0) return '';
      const resultsWithinChatId = searchResults
        .map((sr, i) => [sr, i] as const)
        .filter(([sr]) => sr.chatId === chatId);
      const resultIndexWithinChatId = resultsWithinChatId.findIndex(
        ([, index]) => index === resultIndex
      );
      const nextIndexWithinChatId =
        (resultIndexWithinChatId !== -1
          ? resultIndexWithinChatId + 1
          : resultsWithinChatId.length - 1) % resultsWithinChatId.length;
      const nextResultIndex = resultsWithinChatId[nextIndexWithinChatId]?.[1];
      const amountOfPrefix =
        resultIndexWithinChatId != -1
          ? `${String(nextIndexWithinChatId + 1)} of `
          : '';
      return (
        <Link
          to="/search"
          search={{
            query,
            resultIndex: internalToRouterResultIndex(nextResultIndex),
            limit,
          }}
        >
          <span className="chat-list-additional-info">{` (${amountOfPrefix}${String(searchResults.filter(sr => sr.chatId === chatId).length)})`}</span>
        </Link>
      );
    },
    [limit, query, resultIndex, searchResults]
  );
  return (
    <div className="sidebar">
      <ChatList
        selectedChatId={selectedChatId}
        filterChat={filterChat}
        additionalChatInfo={additionalChatInfo}
      />
    </div>
  );
};
