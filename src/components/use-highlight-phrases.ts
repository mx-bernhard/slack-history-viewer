import { useStore } from '../store.js';

const emptyStringArray: string[] = [];

export const useHighlightPhrases = (messageTs: string) => {
  return useStore(({ currentResultIndex, searchResults }) => {
    if (!(searchResults instanceof Array)) {
      return { highlightPhrases: emptyStringArray, mode: 'none' as const };
    }
    const searchResultIndex =
      currentResultIndex !== -1
        ? searchResults.findIndex(sr => sr.ts === messageTs)
        : -1;
    const highlightPhrases =
      searchResultIndex !== -1
        ? (searchResults[searchResultIndex]?.highlightPhrases ??
          emptyStringArray)
        : emptyStringArray;

    return {
      highlightPhrases,
      mode:
        searchResultIndex === currentResultIndex && currentResultIndex !== -1
          ? ('current' as const)
          : searchResultIndex !== -1
            ? ('any' as const)
            : ('none' as const),
    };
  });
};
