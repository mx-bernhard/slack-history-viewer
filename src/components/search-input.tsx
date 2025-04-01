import { ChangeEvent } from 'react';
import { SearchResultDocument } from '../server/search-indexer';
import { useStore } from '../store';

const constantArray: SearchResultDocument[] = [];

export const SearchInput = () => {
  const {
    searchQueryInput,
    setSearchQueryInput,
    navigateToResult,
    searchQuery,
    searchResults,
    currentResultIndex,
  } = useStore(
    ({
      actions: { setSearchQueryInput, navigateToResult },
      searchQueryInput,
      searchQuery, // Assuming the final debounced query is here
      searchResults, // Assuming this holds the timestamps or can derive length
      currentResultIndex,
    }) => ({
      setSearchQueryInput,
      searchQueryInput,
      navigateToResult,
      searchQuery,
      // Derive total results from searchResults (assuming it's an array or similar)
      searchResults: Array.isArray(searchResults)
        ? searchResults
        : constantArray,
      currentResultIndex,
    })
  );

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchQueryInput(event.target.value);
  };

  // Determine if navigation should be shown
  const totalResults = searchResults.length;
  const showNav = searchQuery !== '' && totalResults > 0;
  const isPrevDisabled = currentResultIndex <= 0;
  const isNextDisabled = currentResultIndex >= totalResults - 1;

  return (
    <div className="search-input-container">
      <input
        className="search-input"
        type="search"
        value={searchQueryInput}
        onChange={handleChange}
        placeholder="Search messages..."
        style={{ marginRight: showNav ? '8px' : '0' }}
      />
      {showNav && (
        <div className="search-nav">
          <button
            className="search-nav-button"
            onClick={() => {
              navigateToResult('prev');
            }}
            disabled={isPrevDisabled}
            aria-label="Previous search result"
          >
            ‹
          </button>
          <span className="search-nav-counter">
            {currentResultIndex + 1} of {totalResults}
          </span>
          <button
            className="search-nav-button"
            onClick={() => {
              navigateToResult('next');
            }}
            disabled={isNextDisabled}
            aria-label="Next search result"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
};
