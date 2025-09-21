import { createFileRoute, getRouteApi } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Chats } from '../-chats';
import { Messages } from '../-messages';
import { queryResultIndexLoader } from '../-query-result-index-loader';
import { routerToInternalResultIndex } from '../-result-index';
import { SearchResults } from '../../components/search-results';
import { useStore } from '../../store';

export const Route = createFileRoute('/search/')({
  component: RouteComponent,
  loaderDeps: ({ search: { query, resultIndex, limit } }) => ({
    query,
    resultIndex,
    limit,
  }),
  loader: queryResultIndexLoader,
});

function RouteComponent() {
  const { useLoaderData, useSearch } = getRouteApi('/search/');
  const { searchResults, searchResult } = useLoaderData();

  const { setSearchResults, setSearchResultIndex } = useStore(
    ({ actions: { setSearchResults, setSearchResultIndex } }) => ({
      setSearchResults,
      setSearchResultIndex,
    })
  );
  const { resultIndex, threadTs } = useSearch({
    select: ({ resultIndex, threadTs }) => ({
      resultIndex: routerToInternalResultIndex(resultIndex),
      threadTs,
    }),
  });

  useEffect(() => {
    setSearchResults(searchResults ?? []);
    setSearchResultIndex(resultIndex ?? null);
  }, [resultIndex, searchResults, setSearchResultIndex, setSearchResults]);

  if (searchResult != null) {
    return (
      <>
        <Chats
          selectedChatId={searchResult.chatId}
          searchResults={searchResults}
        />
        <Messages
          selectedChatId={searchResult.chatId}
          threadTs={threadTs ?? searchResult.threadTs}
          scrollToMessageIndex={searchResult.messageIndex}
        />
      </>
    );
  } else {
    return (
      <div className="content-view">
        <SearchResults searchResults={searchResults} />
      </div>
    );
  }
}
