import { isEqual } from 'lodash-es';
import type { ReactNode } from 'react';
import { createContext, useRef } from 'react';
import type { StoreApi, UseBoundStore } from 'zustand';
import { create, useStore as useZustandStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { SearchResultDocument } from './types';

export interface SlackHistoryViewerStore {
  searchResults: SearchResultDocument[];
  searchResultIndex: number | null;
  actions: {
    setSearchResults: (searchResults: SearchResultDocument[]) => void;
    setSearchResultIndex: (searchResultIndex: number | null) => void;
    getCurrentSearchResult: () => SearchResultDocument | null;
  };
}

type SlackHistoryViewerStoreApi = UseBoundStore<
  StoreApi<SlackHistoryViewerStore>
>;

const StoreContext = createContext<SlackHistoryViewerStoreApi | null>(null);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  return (
    <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
  );
};

const createStore = () =>
  create<SlackHistoryViewerStore>((set, get) => {
    return {
      searchResultIndex: null,
      searchResults: [],
      limit: 50,
      actions: {
        getCurrentSearchResult: () => {
          const index = get().searchResultIndex;
          if (index == null) return null;
          return get().searchResults[index] ?? null;
        },
        setSearchResultIndex: index => {
          set({ searchResultIndex: index });
        },
        setSearchResults: searchResults => {
          set({ searchResults });
        },
      },
    };
  });

export const store = createStore();

const useDeep = <S, U>(selector: (state: S) => U): ((state: S) => U) => {
  const selectedRef = useRef<U | 'uninitialized'>('uninitialized');
  const newSelector = (state: S): U => {
    const newSelected = selector(state);
    if (!isEqual(selectedRef.current, newSelected)) {
      selectedRef.current = newSelected;
    }
    return selectedRef.current as U;
  };
  return newSelector;
};

export const useStore = <TSlice,>(
  selector: (state: SlackHistoryViewerStore) => TSlice,
  mode: 'shallow' | 'deep' = 'shallow'
) => {
  return useZustandStore(
    store,
    (mode === 'shallow' ? useShallow : useDeep)(selector)
  );
};

export const useStoreApi = (): SlackHistoryViewerStoreApi => store;
