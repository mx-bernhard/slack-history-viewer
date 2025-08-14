import compression from 'compression';
import 'dotenv/config';
import express, { Request, Response } from 'express';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { identity, sortBy, uniq } from 'lodash-es';
import * as memoizePkg from 'micro-memoize';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  findChatDirectoryPath,
  getAllChats,
  getDataBasePath,
  getFiles,
  getMessagesForChat,
  initDataLoader,
  loadUsers,
} from './src/server/data-loader.js';
import {
  buildSearchIndex,
  searchMessages,
  SolrQueryResponse,
} from './src/server/search-indexer.js';
import { search } from './src/server/solr-api.js';

const memoize =
  memoizePkg.default as unknown as typeof memoizePkg.default.default;

interface SearchQuery {
  q?: string;
  limit?: string;
}

interface SsrModule {
  render: (url: string) => Promise<string>;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

const projectRoot = isProduction ? path.resolve(__dirname, '..') : __dirname;
const dataDir: string =
  process.env.SLACK_HISTORY_DATA_PATH ?? path.resolve(projectRoot, 'data');

async function createServer() {
  try {
    const stats = await fsPromises.stat(dataDir);
    if (!stats.isDirectory()) {
      throw new Error(`Specified data path is not a directory: ${dataDir}`);
    }
    console.log(`Server using data directory: ${dataDir}`);

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
    process.exit(1);
  }

  const app = express();
  app.use(compression());

  app.use('/data', express.static(dataDir));

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
    '/api/messages/:chatId/count',
    async (
      req: Request<{ chatId: string }>,
      res: Response<{ total: number } | { error: string }>
    ) => {
      try {
        const { chatId } = req.params;
        const searchResponse = await search({
          q: 'thread_message_b: false AND chat_id_s: ' + chatId,
          rows: 0,
          start: 0,
        });
        res.json({ total: searchResponse.response.numFound });
      } catch {
        res.status(500).json({ error: 'Failed to compute messages meta info' });
      }
    }
  );

  const extractFilePaths = (searchResponse: SolrQueryResponse) =>
    uniq(searchResponse.response.docs.map(doc => doc.file_path_s));

  const getThread = memoize(
    async (chatId: string, threadTs: string) => {
      const threadSearchResponse = await search({
        q: `chat_id_s: ${chatId} AND thread_ts_s: ${threadTs}`,
        rows: 10000,
        start: 0,
      });
      const filePaths = extractFilePaths(threadSearchResponse);
      const basePath = getDataBasePath();
      const messageInfos = (
        await getMessagesForChat(
          chatId,
          filePaths.map(filePath => path.join(basePath, filePath))
        )
      ).map(messageInfo => messageInfo.message);
      const threadMessages = messageInfos.filter(
        msg => msg.thread_ts === threadTs
      );
      return threadMessages;
    },
    { isPromise: true, maxSize: 300 }
  );
  app.get(
    '/api/messages/:chatId',
    async (
      req: Request<
        { chatId: string },
        object,
        object,
        { start?: string; rows?: string } | { threadTs?: string } | object
      >,
      res: Response
    ) => {
      const { chatId } = req.params;
      const query = req.query;
      try {
        if ('rows' in query && 'start' in query) {
          const { rows: rowsQueryParam, start: startQueryParam } = query;

          if (rowsQueryParam != null && startQueryParam != null) {
            const rows = Number(rowsQueryParam);
            const start = Number(startQueryParam);
            const searchResponse = await search({
              q: `chat_id_s: ${chatId} AND message_index_l: [${String(start)} TO ${String(start + rows)}]`,
              rows: rows,
              start: 0,
            });
            const filePaths = extractFilePaths(searchResponse);
            const messageIds = new Set(
              searchResponse.response.docs.map(m => m.id)
            );
            const basePath = getDataBasePath();
            const messageInfos = await getMessagesForChat(
              chatId,
              filePaths.map(filePath => path.join(basePath, filePath))
            );
            const messagesWithinRequestWindow = messageInfos
              .map(message => message.message)
              .filter(
                message =>
                  (message.thread_ts === message.ts ||
                    message.thread_ts == null) &&
                  messageIds.has(`${chatId}_${message.ts}`)
              );

            res
              .contentType('application/json')
              .send(
                JSON.stringify(
                  messagesWithinRequestWindow,
                  undefined,
                  undefined
                )
              );
          } else {
            res
              .status(400)
              .send({ error: 'No query values rows and start without value' });
          }
          return;
        }
        if ('thread-ts' in query) {
          const threadTs = query['thread-ts'];
          if (threadTs == null || typeof threadTs !== 'string') {
            res
              .status(400)
              .json({ error: 'No proper thread-ts value supplied.' });
            return;
          }
          const chatThreads = await getThread(chatId, threadTs);
          res.json(chatThreads);
          return;
        }
        const chatDirectoryPath = await findChatDirectoryPath(chatId);
        if (chatDirectoryPath == null) {
          res
            .status(400)
            .json({ error: 'Could not find chat files for ' + chatId });
          return;
        }
        const allMessagesOfChat = await getMessagesForChat(
          chatId,
          sortBy(await getFiles(chatDirectoryPath, 'all'), identity)
        );
        res.json(allMessagesOfChat.map(m => m.message));
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

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
      root: projectRoot,
    });

    app.use(vite.middlewares);

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
    app.use(
      express.static(path.resolve(projectRoot, 'client'), {
        index: false,
      })
    );

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

    buildSearchIndex().catch((err: unknown) => {
      console.error('Background search index build failed:', err);
    });
  });
}

createServer().catch((err: unknown) => {
  console.error('Server startup failed:', err);
});
