import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import express, { Request, Response } from 'express';
import {
  getAllChats,
  getMessagesForChat,
  initDataLoader,
  loadUsers,
} from './src/server/data-loader.js';
import {
  buildSearchIndex,
  searchMessages,
} from './src/server/search-indexer.js';
import 'dotenv/config';

// Define type for expected search query parameters
interface SearchQuery {
  q?: string;
  limit?: string;
}

// Define the expected shape of the SSR module
interface SsrModule {
  render: (url: string) => Promise<string>;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

const projectRoot = isProduction ? path.resolve(__dirname, '..') : __dirname;
const dataDir: string =
  process.env.SLACK_HISTORY_DATA_PATH ?? path.resolve(projectRoot, 'data');

async function createServer() {
  // Check if data directory exists and Initialize Data Loader
  try {
    const stats = await fsPromises.stat(dataDir);
    if (!stats.isDirectory()) {
      throw new Error(`Specified data path is not a directory: ${dataDir}`);
    }
    console.log(`Server using data directory: ${dataDir}`);
    // Initialize the data loader with the verified path
    await initDataLoader(dataDir);
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      console.error(`Error: Data directory not found at ${dataDir}.`);
      console.error(
        'Please ensure the path is correct or set the SLACK_HISTORY_DATA_PATH environment variable.'
      );
    } else {
      console.error(`Error accessing data directory ${dataDir}:`, error);
    }
    process.exit(1); // Exit if data directory is invalid
  }

  const app = express();

  // Common middleware (API endpoints, static data dir)
  app.use('/data', express.static(dataDir));

  // --- API Endpoints ---
  app.get('/api/chats', async (_req: Request, res: Response) => {
    try {
      const chats = await getAllChats();
      res.json(chats);
    } catch (error) {
      console.error('Error fetching chats:', error);
      res.status(500).json({ error: 'Failed to load chat list' });
    }
  });

  app.get(
    '/api/messages/:chatId',
    async (req: Request<{ chatId: string }>, res: Response) => {
      const { chatId } = req.params;
      try {
        const messages = (await getMessagesForChat(chatId)).map(m => m.message);
        res.json(messages);
      } catch (error) {
        console.error(`Error fetching messages for chat ${chatId}:`, error);
        res
          .status(500)
          .json({ error: `Failed to load messages for chat ${chatId}` });
      }
    }
  );

  app.get('/api/users', async (_req: Request, res: Response) => {
    try {
      const users = await loadUsers();
      res.json(users ?? []);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to load user list' });
    }
  });

  app.get(
    '/api/search',
    async (
      req: Request<object, object, object, SearchQuery>,
      res: Response
    ) => {
      const query = req.query.q;
      const limit = parseInt(req.query.limit ?? '50', 10);
      if (query == null || query.trim() === '') {
        res.status(400).json({ error: 'Missing query parameter "q"' });
        return;
      }
      if (isNaN(limit)) {
        res.status(400).json({ error: 'Invalid limit parameter' });
        return;
      }
      try {
        const results = await searchMessages(query, limit);
        res.json(results);
      } catch (error: unknown) {
        console.error(`Error searching for query "${query}":`, error);
        const message =
          error instanceof Error ? error.message : 'Failed to execute search';
        res.status(500).json({ error: message });
      }
    }
  );

  // --- Environment-Specific Middleware & SSR ---
  if (!isProduction) {
    // === DEVELOPMENT ===
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
      root: projectRoot,
    });

    // Use vite's connect instance as middleware for HMR etc.
    app.use(vite.middlewares);

    // Development SSR Handler (uses vite)
    app.use(async (req, res, next) => {
      const url = req.originalUrl;
      if (
        url.startsWith('/api') ||
        url.match(
          /\.(js|css|json|ico|svg|png|jpg|jpeg|gif|woff|woff2|ttf|eot)$/
        )
      ) {
        next();
        return;
      }
      try {
        let template = fs.readFileSync(
          path.resolve(projectRoot, 'index.html'),
          'utf-8'
        );
        template = await vite.transformIndexHtml(url, template);
        const ssrModule = (await vite.ssrLoadModule(
          '/src/entry-server.tsx'
        )) as SsrModule;
        const render = ssrModule.render;

        if (typeof render !== 'function')
          throw new Error('Could not load render function');

        const appHtml = await render(url);
        const html = template.replace(`<!--ssr-outlet-->`, appHtml);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e: unknown) {
        console.error(`[SSR-Dev] Error handling request ${url}:`, e);
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // === PRODUCTION ===
    // Serve static files from dist/client
    app.use(
      express.static(path.resolve(projectRoot, 'client'), {
        index: false,
      })
    );

    // Production SSR Handler (reads built files)
    app.use(async (req, res, next) => {
      const url = req.originalUrl;
      if (
        url.startsWith('/api') ||
        url.match(
          /\.(js|css|json|ico|svg|png|jpg|jpeg|gif|woff|woff2|ttf|eot)$/
        )
      ) {
        next();
        return;
      }
      try {
        let template: string;
        let render: ((url: string) => Promise<string>) | undefined;

        const templatePath = path.resolve(projectRoot, 'client/index.html');
        try {
          template = fs.readFileSync(templatePath, 'utf-8');
        } catch (err) {
          console.error(
            `[SSR-Prod] Failed to read template at ${templatePath}`,
            err
          );
          throw new Error(`Could not read index.html template.`);
        }

        const serverEntryPath = path.resolve(
          projectRoot,
          'server/entry-server.js'
        );
        try {
          const ssrModule = (await import(
            pathToFileURL(serverEntryPath).toString()
          )) as SsrModule;
          render = ssrModule.render;
        } catch (err) {
          console.error(
            `[SSR-Prod] Failed to import server entry at ${serverEntryPath}`,
            err
          );
          throw new Error(`Could not import server entry point.`);
        }

        if (typeof render !== 'function')
          throw new Error('Could not load render function');

        const appHtml = await render(url);
        const html = template.replace(`<!--ssr-outlet-->`, appHtml);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e: unknown) {
        console.error(`[SSR-Prod] Error handling request ${url}:`, e);
        next(e);
      }
    });
  }

  // --- Start Server ---
  app.listen(5173, () => {
    console.log('-------------------------------------------');
    console.log(
      `Server running in ${isProduction ? 'production' : 'development'} mode.`
    );
    console.log('Server listening at http://localhost:5173');
    if (!isProduction) {
      console.log('API Endpoints:');
      console.log('  Chat list: /api/chats');
      console.log('  Messages:  /api/messages/:chatId');
      console.log('  Users:     /api/users');
      console.log('  Search:    /api/search?q={query}');
    }
    console.log('-------------------------------------------');

    // Trigger index build only in development? Or always?
    // Let's assume it should always run if data changes
    buildSearchIndex().catch((err: unknown) => {
      console.error('Background search index build failed:', err);
    });
  });
}

createServer().catch((err: unknown) => {
  console.error('Server startup failed:', err);
});
