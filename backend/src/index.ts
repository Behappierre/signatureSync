import { buildServer } from './server/index.js';
import { env } from './config/env.js';

const start = async () => {
  try {
    const server = await buildServer();
    
    const port = env.PORT;
    const host = env.HOST;
    
    await server.listen({ port, host });
    server.log.info(`Server running on http://${host}:${port}`);
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
};

start();