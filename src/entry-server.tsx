// src/entry-server.tsx (Temporary Minimal Version for Debugging)

import ReactDOMServer from 'react-dom/server';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from './api/query-client.js'; // Added .js
import { App } from './App.js'; // Added .js
import { UserProvider } from './contexts/user-context.js'; // Added .js
import { EmojiProvider } from './contexts/emoji-context.js'; // Added .js
import { StrictMode } from 'react';

// Note: Making this async to align with potential future prefetching
// Although currently it doesn't await anything.
// Make synchronous for now until actual async logic (prefetching) is added
export function render(url: string): string {
  // Create a fresh query client for each SSR request
  const queryClient = createQueryClient();

  console.log(`[SSR Render] Rendering for URL: ${url}`);

  // Render the app with providers
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

  // TODO: Consider adding dehydrated state for TanStack Query if prefetching is added
  // const dehydratedState = dehydrate(queryClient);
  // Inject <script>...</script> with state into html string

  return html;
}
