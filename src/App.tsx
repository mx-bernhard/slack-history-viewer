import './App.css';
import ChatList from './components/chat-list';
import { ErrorBoundary } from './components/error-boundary';
import { MessageView } from './components/message-view';
import { SearchInput } from './components/search-input';
import SearchResults from './components/search-results';
import { useIsClient } from './components/use-is-client';
import { StoreProvider, useStore } from './store';

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
