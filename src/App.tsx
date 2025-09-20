import './App.css';
import ChatList from './components/chat-list.js';
import { ErrorBoundary } from './components/error-boundary.js';
import { MessageView } from './components/message-view.js';
import { SearchInput } from './components/search-input.js';
import SearchResults from './components/search-results.js';
import { useIsClient } from './components/use-is-client.js';
import { StoreProvider, useStore } from './store.js';

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
  const { searchResults, currentResultIndex } = useStore(
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
      <h1>Slack History Viewer</h1>
      <div style={{ padding: '0 15px' }}>
        <SearchInput />
      </div>
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
              <MessageView />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
