import ListIcon from '@mui/icons-material/List';
import { useNavigate, useRouterState, useSearch } from '@tanstack/react-router';
import type { ChangeEvent } from 'react';
import { useCallback } from 'react';
import { store, useStore } from '../store';
import { logCatch } from '../utils/log-catch';

import { useLocation } from '@tanstack/react-router';
import { defaultLimit } from './constants';
import { Link } from './link';
import './search-input.css';

export const SearchInput = () => {
  const { searchResults, searchResultIndex } = useStore(
    ({ searchResults, searchResultIndex }) => ({
      searchResults,
      searchResultIndex,
    })
  );
  const routerState = useRouterState();

  const navigate = useNavigate();
  const location = useLocation();

  const onSearchQueryInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { searchResultIndex, searchResults } = store.getState();
      const sr =
        searchResultIndex != null ? searchResults[searchResultIndex] : null;
      if (event.target.value === '') {
        if (sr != null) {
          navigate({
            to: '/main/$chatId',
            params: {
              chatId: sr.chatId,
            },
          }).catch(logCatch);
        } else {
          navigate({
            to: '/main',
          }).catch(logCatch);
        }
      } else {
        const wasNotSearching =
          (routerState.location.search.query ?? '') === '';
        navigate({
          replace: !wasNotSearching,
          to: '/search',
          search: {
            ...routerState.location.search,
            query: event.target.value,
          },
        }).catch(logCatch);
      }
    },
    [navigate, routerState]
  );
  const onLimitChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const numberValue = parseInt(event.target.value);
      if (typeof numberValue !== 'number') return;
      navigate({
        to: location.pathname,
        search: { ...location.search, limit: numberValue },
      }).catch(logCatch);
    },
    [location.pathname, location.search, navigate]
  );

  const { resultIndex, query, threadTs, limit } = useSearch({
    from: '__root__',
    select: ({ query, resultIndex, threadTs, limit }) => ({
      query,
      resultIndex,
      threadTs,
      limit,
    }),
  });

  const handlePrevClick = useCallback(() => {
    navigate({
      to: '/search',
      search: {
        query,
        resultIndex:
          resultIndex != null ? resultIndex - 1 : searchResults.length,
        limit,
      },
    }).catch(logCatch);
  }, [limit, navigate, query, resultIndex, searchResults.length]);

  const handleNextClick = useCallback(() => {
    const newResultIndex = (() => {
      if (resultIndex == null) return 1;
      if (resultIndex < searchResults.length) return resultIndex + 1;
      return undefined;
    })();
    navigate({
      to: '/search',
      search: { query, resultIndex: newResultIndex, limit },
    }).catch(logCatch);
  }, [limit, navigate, query, resultIndex, searchResults.length]);

  const showNav = searchResults.length > 1;
  const searchNavCounter =
    searchResultIndex != null
      ? `${String(searchResultIndex + 1)} of ${String(searchResults.length)}`
      : String(searchResults.length);

  return (
    <div className="search-input-container">
      <Link className="icon" to="/search" search={{ query, threadTs, limit }}>
        <ListIcon fontSize="large" className="icon-image" />
      </Link>
      <input
        className="search-input input"
        type="search"
        value={location.search.query ?? ''}
        onChange={onSearchQueryInputChange}
        placeholder="Search messages..."
        title="Fields: chat_type_s (channel, dm), ts_dt (timestamp of message), text_txt_en (actual message), url_ss (links in message), channel_name_s (name of channel or dm partner(s)), user_name_s, user_display_name_s, user_real_name_s, chat_id_s, user_s"
      />
      <input
        className="input limit-input"
        type="number"
        value={location.search.limit ?? defaultLimit}
        onChange={onLimitChange}
      />
      {showNav && (
        <div className="search-nav">
          <button
            className="search-nav-button"
            onClick={handlePrevClick}
            aria-label="Previous search result"
          >
            ‹
          </button>
          <span className="search-nav-counter">{searchNavCounter}</span>
          <button
            className="search-nav-button"
            onClick={handleNextClick}
            aria-label="Next search result"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
};
