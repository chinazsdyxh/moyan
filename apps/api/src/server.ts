import { config } from './config.js';
import { buildApp } from './app.js';

let app: Awaited<ReturnType<typeof buildApp>> | undefined;

try {
  app = await buildApp({ logger: true });
  await app.listen({ host: '0.0.0.0', port: config.port });
} catch (error) {
  app?.log.error(error);
  process.exit(1);
}

