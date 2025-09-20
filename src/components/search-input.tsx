import type { ChangeEvent } from 'react';
import { useCallback } from 'react';
import { useStore } from '../store.js';
import type { SearchResultDocument } from '../types.js';

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
      searchQuery,
      searchResults,
      currentResultIndex,
      limit,
    }) => ({
      setSearchQueryInput,
      searchQueryInput,
      navigateToResult,
      searchQuery,

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
    [setSearchQueryInput]
  );

  const onLimitChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const numberValue = parseInt(event.target.value);
      if (typeof numberValue !== 'number') return;
      setLimit(numberValue);
    },
    [setLimit]
  );

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
        title="Fields: chat_type_s (channel, dm), ts_dt (timestamp of message), text_txt_en (actual message), url_ss (links in message), channel_name_s (name of channel or dm partner(s)), user_name_s, user_display_name_s, user_real_name_s, chat_id_s, user_s"
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
