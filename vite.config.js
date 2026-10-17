import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { buildContent } from './scripts/build-content.mjs';

// Re-encrypts content/ into public/data whenever you start the dev server, build,
// or save a change inside content/ while the dev server is running.
function chelseadleContent() {
  let command = 'build';
  return {
    name: 'chelseadle-content',
    config(_, env) {
      command = env.command;
    },
    async buildStart() {
      try {
        await buildContent();
      } catch (e) {
        if (command === 'build') throw e;
        console.error(`\n${e.message}\n`);
      }
    },
    configureServer(server) {
      const contentDir = path.resolve('content');
      server.watcher.add(contentDir);
      let queue = Promise.resolve();
      server.watcher.on('all', (_event, file) => {
        if (!path.resolve(file).startsWith(contentDir + path.sep)) return;
        queue = queue
          .then(() => buildContent())
          .then(() => server.ws.send({ type: 'full-reload' }))
          .catch((e) => console.error(`\n${e.message}\n`));
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), chelseadleContent()],
});
