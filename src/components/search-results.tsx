import { useChatsQuery } from '../api/use-queries';
import { useEmoji } from '../contexts/emoji-context'; // Import emoji context hook
import { useUsers } from '../contexts/user-context';
import { useStore } from '../store';
import { parseSlackMessage } from '../utils/message-parser'; // Correct relative path from components/ to utils/

// Helper function to format timestamp
const formatTimestamp = (timestamp: string): string => {
  try {
    const date = new Date(parseFloat(timestamp) * 1000);
    if (isNaN(date.getTime())) {
      // Check if date is valid
      console.warn('Invalid timestamp for formatting:', timestamp);
      return timestamp; // Return raw timestamp if invalid
    }
    return date.toLocaleString(); // Adjust format as needed
  } catch {
    console.warn('Error formatting timestamp:', timestamp);
    return timestamp; // Fallback to raw timestamp on error
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

  const { getUserById } = useUsers(); // Only need getUserById now
  const { data: chats } = useChatsQuery();
  const { parseEmoji } = useEmoji(); // Get the emoji parser function

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
        const user = getUserById(result.user);
        const chat = chats?.find(chat => chat.id === result.chatId);
        const userName =
          (user?.profile.real_name ?? user?.name ?? 'User') +
          ` (${result.user})`;

        const formattedTime = formatTimestamp(result.ts);
        // Use the new parser, passing both functions
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
              <span
                className="search-result-user"
                style={{ fontWeight: 'bold', marginRight: '8px' }}
              >
                {userName}
              </span>
              <span className="search-result-time">{formattedTime}</span>
              <span className="search-result-time">{`${chat?.name ?? 'Unknown'} (${chat?.id ?? 'Unknown'})`}</span>
            </div>
            <div className="search-result-text">{parsedText}</div>
          </div>
        );
      })}
    </div>
  );
};

export default SearchResults;
