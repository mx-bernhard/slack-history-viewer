import { ChangeEvent, useCallback } from 'react';
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
    limit,
    setLimit,
  } = useStore(
    ({
      actions: { setSearchQueryInput, navigateToResult, setLimit },
      searchQueryInput,
      searchQuery, // Assuming the final debounced query is here
      searchResults, // Assuming this holds the timestamps or can derive length
      currentResultIndex,
      limit,
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
      limit,
      setLimit,
    })
  );

  const onSearchQueryChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setSearchQueryInput(event.target.value);
    },
    []
  );

  const onLimitChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const numberValue = parseInt(event.target.value);
    if (typeof numberValue !== 'number') return;
    setLimit(numberValue);
  }, []);

  // Determine if navigation should be shown
  const totalResults = searchResults.length;
  const showNav = searchQuery !== '' && totalResults > 0;
  const isPrevDisabled = currentResultIndex <= 0;
  const isNextDisabled = currentResultIndex >= totalResults - 1;

  return (
    <div className="search-input-container">
      <input
        className="search-input input"
        type="search"
        value={searchQueryInput}
        onChange={onSearchQueryChange}
        placeholder="Search messages..."
        title="Fields: chat_type_s (channel, dm), ts_dt (timestamp of message), text_txt_en (actual message), channel_name_s (name of channel or dm partner(s)), user_name_s, user_display_name_s, user_real_name_s, chat_id_s, user_s"
        style={{ marginRight: showNav ? '8px' : '0' }}
      />
      <input
        className="input limit-input"
        type="number"
        value={limit}
        onChange={onLimitChange}
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
