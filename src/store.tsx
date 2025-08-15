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
import { apiClient } from './api/api-client';

export interface SlackHistoryViewerStore {
  searchQueryInput: string;
  searchQuery: string;
  searchResults: Error | SearchResultDocument[] | 'loading' | null;
  currentResultIndex: number;
  limit: number;
  selectedChatId: string | null;
  messageIndex: number | null;
  threadMessageIndex: number | null;
  selectedThreadTs?: string | null;
  actions: {
    setSelectedChatId: (chatId: string | null) => void;
    setSelectedThreadTs: (threadTs: string | null) => void;
    setSearchQueryInput: (query: string) => void;
    setLimit: (value: number) => void;
    navigateToResult: (direction: 'prev' | 'next') => void;
    setSelectedResult: (id: string) => void;
    getSearchResults: () => SearchResultDocument[];
    getCurrentSearchResultMessageKind: (
      chatId: string,
      ts: string
    ) => 'message' | 'thread-starter' | 'none';
    getCurrentSearchResultMessageKindOfCurrentChat: (
      messageTs: string
    ) => 'message' | 'thread-starter' | 'none';
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

const maxThreadMessages = 1000;
const createStore = ({ queryClient }: { queryClient: QueryClient }) =>
  create<SlackHistoryViewerStore>((set, get) => {
    return {
      searchQuery: '',
      searchQueryInput: '',
      searchResults: null,
      currentResultIndex: -1,
      selectedChatId: null,
      limit: 50,
      selectedThreadTs: null,
      messageIndex: null,
      threadMessageIndex: null,
      actions: {
        getCurrentSearchResultMessageKindOfCurrentChat: (messageTs: string) => {
          const {
            actions: { getCurrentSearchResultMessageKind },
            selectedChatId,
          } = get();

          return selectedChatId != null
            ? getCurrentSearchResultMessageKind(selectedChatId, messageTs)
            : 'none';
        },
        getCurrentSearchResultMessageKind: (
          chatId: string,
          messageTs: string
        ) => {
          const {
            currentResultIndex,
            actions: { getSearchResults },
          } = get();
          const currentSearchResult = getSearchResults()[currentResultIndex];
          if (
            currentSearchResult == null ||
            currentSearchResult.chatId != chatId
          ) {
            return 'none';
          }
          return currentSearchResult.ts === messageTs
            ? 'message'
            : currentSearchResult.threadTs === messageTs
              ? 'thread-starter'
              : 'none';
        },
        getSearchResults: () => {
          const { searchResults } = get();
          if (searchResults == null || searchResults instanceof Error)
            return [];
          if (searchResults === 'loading') return [];
          return searchResults;
        },
        setSelectedChatId: chatId => {
          set({
            selectedChatId: chatId,
            selectedThreadTs: null,
            messageIndex: null,
          });
        },
        setSelectedThreadTs: (threadTs: string | null) => {
          set({ selectedThreadTs: threadTs });
        },
        setSearchQueryInput: (() => {
          const setSearchQuery = pDebounce(
            (query: string) =>
              createSearchQuery(queryClient)(query, get().limit),
            300
          );
          return (query: string) => {
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
        setLimit(value) {
          set({ limit: value });
        },
        navigateToResult: direction => {
          const {
            searchResults,
            currentResultIndex,
            actions: { setSelectedResult },
          } = get();
          if (searchResults == null || searchResults instanceof Error) return;
          if (searchResults.length === 0) return;

          let nextIndex = currentResultIndex;
          if (currentResultIndex === -1) {
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
              setSelectedResult(searchResult.id);
            }
          }
        },
        setSelectedResult: id => {
          const searchResults = get().actions.getSearchResults();
          if (searchResults.length === 0) return;
          const index = searchResults.findIndex(sr => sr.id === id);
          if (index !== -1) {
            const searchResult = searchResults[index];
            if (searchResult == null) return;
            const searchResultThreadTs = searchResult.threadTs;
            if (searchResultThreadTs != null) {
              (async () => {
                const threadMessages = await apiClient.searchMessages(
                  'thread_ts_s: ' +
                    searchResultThreadTs +
                    ' AND chat_id_s: ' +
                    searchResult.chatId,
                  maxThreadMessages
                );

                const threadMessageIndex = threadMessages.findIndex(
                  message => message.ts === searchResult.ts
                );
                const threadStartingMessage = threadMessages.at(-1);

                if (threadMessageIndex !== -1) {
                  set({
                    currentResultIndex: index,
                    messageIndex: threadStartingMessage?.messageIndex ?? -1,
                    selectedChatId: searchResult.chatId,
                    selectedThreadTs: searchResult.threadTs,
                    threadMessageIndex,
                  });
                }
              })().catch((err: unknown) => {
                console.error(err);
              });
            } else {
              set({
                currentResultIndex: index,
                selectedChatId: searchResult.chatId,
                selectedThreadTs: null,
                messageIndex: searchResult.messageIndex,
                threadMessageIndex: null,
              });
            }
          }
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
