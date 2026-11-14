import { createServer, isRunnableDevEnvironment } from 'vite';

const [, , entry] = process.argv;
if (entry == null) {
  console.error('Usage: run-with-vite <entry-file>');
  process.exit(1);
}

const viteServer = await createServer({
  server: { middlewareMode: true, hmr: { port: 24679 } },
  appType: 'custom',
});

const environment = viteServer.environments.ssr;
if (!isRunnableDevEnvironment(environment)) {
  throw new Error('ssr environment is not runnable.');
}

await environment.runner.import(entry);
