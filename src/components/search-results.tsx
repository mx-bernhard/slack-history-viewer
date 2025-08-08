import { useChatsQuery } from '../api/use-queries';
import { useEmoji } from '../contexts/emoji-context';
import { useUsers } from '../contexts/user-context';
import { useStore } from '../store';
import { parseSlackMessage } from '../utils/message-parser';

const formatTimestamp = (timestamp: string): string => {
  try {
    return new Date(Math.floor(parseFloat(timestamp) * 1000)).toLocaleString();
  } catch {
    console.warn('Error formatting timestamp:', timestamp);
    return timestamp;
  }
};

const SearchResults = () => {
  const {
    actions: { setSelectedResult },
    searchResults,
  } = useStore(({ searchQuery, actions, searchResults }) => ({
    searchQuery,
    searchResults,
    actions,
  }));

  const { getUserById } = useUsers();
  const { data: chats } = useChatsQuery();
  const { parseEmoji } = useEmoji();

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
    return <div style={{ padding: '10px' }}>-</div>;
  }

  if (searchResults.length === 0) {
    return <div style={{ padding: '10px' }}>No results found.</div>;
  }

  return (
    <div className="search-results-list">
      {searchResults.map(result => {
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
              setSelectedResult(result.id, result.chatId);
            }}
            style={{ cursor: 'pointer' }}
            title={`Go to message in chat ${result.chatId}`}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ')
                setSelectedResult(result.id, result.chatId);
            }}
          >
            {/* Basic styling - consider moving to CSS */}
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

export default SearchResults;
