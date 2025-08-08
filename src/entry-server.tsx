import ReactDOMServer from 'react-dom/server';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from './api/query-client.js';
import { App } from './App.js';
import { UserProvider } from './contexts/user-context.js';
import { EmojiProvider } from './contexts/emoji-context.js';
import { StrictMode } from 'react';

export function render(url: string): string {
  const queryClient = createQueryClient();

  console.log(`[SSR Render] Rendering for URL: ${url}`);

  const html = ReactDOMServer.renderToString(
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

  return html;
}
