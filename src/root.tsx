import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { queryClient } from './api/query-client';
import { EmojiProvider } from './contexts/emoji-context';
import { UserProvider } from './contexts/user-context';
import { routeTree } from './routeTree.gen';

import { StoreProvider } from './store';

import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import './components/index.css';

const router = createRouter({ routeTree });
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export type RegisteredRouter = typeof router;

const theme = createTheme({
  cssVariables: true,
  defaultColorScheme: 'dark',
  colorSchemes: { dark: true, light: true },
});

export const Root = () => (
  <StrictMode>
    <CssBaseline enableColorScheme />
    <ThemeProvider theme={theme}>
      <EmojiProvider>
        <QueryClientProvider client={queryClient}>
          <UserProvider>
            <StoreProvider>
              <RouterProvider router={router} />
            </StoreProvider>
          </UserProvider>
        </QueryClientProvider>
      </EmojiProvider>
    </ThemeProvider>
  </StrictMode>
);
