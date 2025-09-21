import { Outlet, useSearch } from '@tanstack/react-router';
import { SearchInput } from './search-input';
import { useIsClient } from './use-is-client';

import './App.css';
import './index.css';
import { Link } from './link';

function InternalApp() {
  const { limit } = useSearch({
    from: '__root__',
    select: ({ limit }) => ({ limit }),
  });

  return (
    <div className="app-container">
      <div className="search-bar">
        <Link to="/main" search={{ limit }} className="icon">
          <img src="/slack.svg" className="icon-image" />
        </Link>
        <SearchInput />
      </div>
      <div className="main-content">
        <Outlet />
      </div>
    </div>
  );
}

export const App = () => {
  const isClient = useIsClient();
  return isClient && <InternalApp />;
};
