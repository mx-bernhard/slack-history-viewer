import { useLocation, useNavigate } from '@tanstack/react-router';
import { useChatsQuery } from '../api/use-queries';
import { useEmoji } from '../contexts/emoji-context';
import { useUsers } from '../contexts/user-context';
import { logCatch } from '../utils/log-catch';
import { parseSlackMessage } from '../utils/message-parser';
import { toDate } from '../utils/to-date';
import type { SearchResultDocument } from '../types';
import { internalToRouterResultIndex } from '../routes/-result-index';

import './search-results.css';

const formatTimestamp = (timestamp: string): string => {
  try {
    return toDate(timestamp).toLocaleString();
  } catch {
    console.warn('Error formatting timestamp:', timestamp);
    return timestamp;
  }
};

export const SearchResults = ({
  searchResults,
}: {
  searchResults: Error | SearchResultDocument[] | 'loading' | null;
}) => {
  const { getUserById } = useUsers();
  const { data: chats } = useChatsQuery();
  const { parseEmoji } = useEmoji();
  const navigate = useNavigate();
  const { search } = useLocation();

  if (searchResults === 'loading') {
    return <div style={{ padding: '10px' }}>Searching...</div>;
  }

  if (searchResults instanceof Error) {
    return (
      <div style={{ padding: '10px', color: 'red' }}>
        Error: {searchResults.message}
      </div>
    );
  }
  if (searchResults == null) {
    return (
      <div className="search-results-no-search">
        Start by typing in the search box above.
      </div>
    );
  }

  if (searchResults.length === 0) {
    return <div className="search-results-no-results">No results found.</div>;
  }

  return (
    <div className="search-results-list">
      {searchResults.map((result, resultIndex) => {
        const chat = chats?.find(chat => chat.id === result.chatId);
        const userName =
          result.userDisplayName ??
          result.userRealName + ` (${result.userName})`;

        const formattedTime = formatTimestamp(result.ts);

        const parsedText = parseSlackMessage(
          result.text || '',
          getUserById,
          parseEmoji
        );

        return (
          <div
            key={result.id}
            className="search-result-item"
            onClick={() => {
              navigate({
                to: '/search',
                search: {
                  ...search,
                  resultIndex: internalToRouterResultIndex(resultIndex),
                },
              }).catch(logCatch);
            }}
            style={{ cursor: 'pointer' }}
            title={`Go to message in chat ${result.chatId}`}
            role="button"
            tabIndex={0}
          >
            <div
              className="search-result-header"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '4px',
                fontSize: '0.9em',
                color: '#888',
              }}
            >
              <span className="search-result-user">
                <span
                  style={{ fontWeight: 'bold', marginRight: '8px' }}
                  title={result.userId}
                >
                  {userName}
                </span>
                <span title={chat?.id}>
                  {['group', 'channel'].includes(chat?.type ?? '') ? '#' : ''}
                  {chat?.name ?? 'Unknown'}
                </span>
              </span>
              <span className="search-result-time">{formattedTime}</span>
            </div>
            <div className="search-result-text">{parsedText}</div>
          </div>
        );
      })}
    </div>
  );
};
