import { createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { zodValidator } from '@tanstack/zod-adapter';
import * as z from 'zod';
import { App } from '../components/App';

import './styles.css';

const searchSchema = z.object({
  query: z.string().optional(),
  resultIndex: z.number().min(1).optional().catch(undefined),
  threadTs: z.string().optional(),
  limit: z.number().min(1).optional().catch(undefined),
});

const RootLayout = () => {
  return (
    <>
      <App />
      <TanStackRouterDevtools />
    </>
  );
};

export const Route = createRootRoute({
  component: RootLayout,

  validateSearch: zodValidator(searchSchema),
});
