import { QueryClient, useQueryClient } from '@tanstack/react-query';
import pDebounce from 'p-debounce';
import { createContext, ReactNode, useContext, useState } from 'react';
import {
  create,
  StoreApi,
  UseBoundStore,
  useStore as useZustandStore,
} from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { createSearchQuery } from './api/use-queries';
import { useIsClient } from './components/use-is-client';
import { SearchResultDocument } from './server/search-indexer';
import { getId } from './components/message-view';

export interface SlackHistoryViewerStore {
  searchQueryInput: string;
  searchQuery: string;
  searchResults: Error | SearchResultDocument[] | 'loading' | null;
  currentResultIndex: number; // -1 indicates no selection or focus
  selectedChatId: string | null;
  actions: {
    setSelectedChatId: (chatId: string | null) => void;
    setSearchQueryInput: (query: string) => void;
    navigateToResult: (direction: 'prev' | 'next') => void;
    setSelectedResult: (id: string, chatId: string) => void;
    getCurrentTargetId: () => string | null;
    getSearchResults: () => SearchResultDocument[] | null;
    isCurrentSearchResult: (chatId: string, ts: string) => boolean;
  };
}

const StoreContext = createContext<UseBoundStore<
  StoreApi<SlackHistoryViewerStore>
> | null>(null);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const isClient = useIsClient();
  const queryClient = useQueryClient();
  const [store] = useState(() => createStore({ queryClient }));

  return (
    isClient && (
      <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
    )
  );
};

const createStore = ({ queryClient }: { queryClient: QueryClient }) =>
  create<SlackHistoryViewerStore>((set, get) => {
    return {
      searchQuery: '',
      searchQueryInput: '',
      searchResults: null,
      currentResultIndex: -1,
      selectedChatId: null,
      actions: {
        isCurrentSearchResult: (chatId: string, ts: string) => {
          const { searchResults, currentResultIndex } = get();
          if (!(searchResults instanceof Array)) return false;
          const currentSearchResult = searchResults[currentResultIndex];
          const isCurrentSearchResult =
            currentSearchResult != null &&
            currentSearchResult.id === getId(chatId, ts);
          return isCurrentSearchResult;
        },
        getSearchResults: () => {
          const { searchResults } = get();
          if (searchResults == null || searchResults instanceof Error)
            return null;
          if (searchResults === 'loading') return null;
          return searchResults;
        },
        setSelectedChatId: chatId => {
          set({ selectedChatId: chatId });
        },
        setSearchQueryInput: (() => {
          const setSearchQuery = pDebounce(
            (query: string) => createSearchQuery(queryClient)(query),
            300
          );
          return (query: string) => {
            // Reset results and index when query changes
            set({
              searchQueryInput: query,
              currentResultIndex: -1,
            });
            const promise = setSearchQuery(query);
            set({ searchResults: 'loading' });
            promise.then(
              searchDocuments => {
                set({ searchResults: searchDocuments, searchQuery: query });
              },
              (error: unknown) => {
                if (error instanceof Error) {
                  set({ searchResults: error, searchQuery: '' });
                } else {
                  set({
                    searchResults: new Error('Unknown error ' + String(error)),
                  });
                }
              }
            );
          };
        })(),
        navigateToResult: direction => {
          const { searchResults, currentResultIndex } = get();
          if (searchResults == null || searchResults instanceof Error) return;
          if (searchResults.length === 0) return;

          let nextIndex = currentResultIndex;
          if (currentResultIndex === -1) {
            // If nothing selected, 'next' goes to 0, 'prev' goes to last
            nextIndex = direction === 'prev' ? searchResults.length - 1 : 0;
          } else {
            nextIndex =
              direction === 'prev'
                ? Math.max(0, currentResultIndex - 1)
                : Math.min(searchResults.length - 1, currentResultIndex + 1);
          }

          if (nextIndex !== currentResultIndex) {
            const searchResult = searchResults[nextIndex];
            if (typeof searchResult === 'object') {
              set({
                currentResultIndex: nextIndex,
                selectedChatId: searchResult.chatId,
              });
            }
          }
          // Note: Scrolling is triggered by components reacting to currentResultIndex change
        },
        setSelectedResult: (id, chatId) => {
          const searchResults = get().actions.getSearchResults();
          if (searchResults == null) return;
          const index = searchResults.findIndex(sr => sr.id === id);
          if (index !== -1) {
            set({ currentResultIndex: index, selectedChatId: chatId });
          }
          // Note: Scrolling is triggered by components reacting to currentResultIndex change
        },
        getCurrentTargetId: () => {
          const { currentResultIndex } = get();
          const searchResults = get().actions.getSearchResults();
          if (searchResults == null) return null;
          if (
            currentResultIndex >= 0 &&
            currentResultIndex < searchResults.length
          ) {
            return searchResults[currentResultIndex]?.id ?? null;
          }
          return null;
        },
      },
    };
  });

export const useStore = <TSlice,>(
  selector: (state: SlackHistoryViewerStore) => TSlice
) => {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error('Store not found');
  }
  return useZustandStore(store, useShallow(selector));
};
