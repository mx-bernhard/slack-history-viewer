import { hydrateRoot } from 'react-dom/client';
import { App } from './App';
import { UserProvider } from './contexts/user-context';
import { EmojiProvider } from './contexts/emoji-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from './api/query-client';
import './index.css';
import { StrictMode } from 'react';

const queryClient = createQueryClient();

hydrateRoot(
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  document.getElementById('root')!,
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <EmojiProvider>
          <App />
        </EmojiProvider>
      </UserProvider>
    </QueryClientProvider>
  </StrictMode>
);
