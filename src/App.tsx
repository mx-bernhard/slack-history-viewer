import './App.css';
import ChatList from './components/chat-list';
import { MessageView } from './components/message-view'; // Import MessageView with named import
import { SearchInput } from './components/search-input'; // Import SearchInput
import SearchResults from './components/search-results'; // Import SearchResults
import { useIsClient } from './components/use-is-client';
import { StoreProvider, useStore } from './store';
import { ErrorBoundary } from './components/error-boundary'; // Import ErrorBoundary

export const App = () => {
  const isClient = useIsClient();
  return (
    isClient && (
      <StoreProvider>
        <ErrorBoundary>
          <InternalApp />
        </ErrorBoundary>
      </StoreProvider>
    )
  );
};

function InternalApp() {
  const { selectedChatId, searchResults, currentResultIndex } = useStore(
    ({ currentResultIndex, selectedChatId, searchResults }) => ({
      selectedChatId,
      currentResultIndex,
      searchResults,
    })
  );
  const showSearchResult =
    searchResults === 'loading' ||
    searchResults instanceof Error ||
    ((searchResults?.length ?? 0) > 0 && currentResultIndex === -1);
  return (
    <div className="app-container">
      {/* Added a container for potential layout */}
      <h1>Slack History Viewer</h1>
      {/* Add Search Input above the main content */}
      <div style={{ padding: '0 15px' }}>
        <SearchInput />
      </div>
      {/* Use flexbox for layout */}
      <div className="main-content">
        {showSearchResult ? (
          <div className="content-view">
            <SearchResults />
          </div>
        ) : (
          <>
            <div className="sidebar">
              <ChatList />
            </div>
            <div className="content-view">
              {selectedChatId != null && <MessageView key={selectedChatId} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
