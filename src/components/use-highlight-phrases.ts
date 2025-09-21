import { useStore } from '../store';

const emptyStringArray: string[] = [];

export const useHighlightPhrases = (messageTs: string) => {
  const { searchResult, isAnySearchResult } = useStore(
    ({ searchResults, actions: { getCurrentSearchResult } }) => ({
      searchResult: getCurrentSearchResult(),
      isAnySearchResult: searchResults.some(sr => sr.ts === messageTs),
      searchResults,
    })
  );

  if (searchResult == null || !isAnySearchResult) {
    return { highlightPhrases: emptyStringArray, mode: 'none' as const };
  }
  const highlightPhrases = searchResult.highlightPhrases;

  return {
    highlightPhrases,
    mode:
      messageTs === searchResult.ts ? ('current' as const) : ('any' as const),
  };
};
