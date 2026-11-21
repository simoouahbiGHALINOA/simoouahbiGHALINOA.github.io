// SPDX-License-Identifier: MIT

import 'dotenv/config';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import {
  createProtectedUserSession,
  deleteProtectedUserSession,
  disconnectDatabase,
  getDatabaseProvider,
  getProfileClickCount,
  getProtectedUserForSession,
  recordProfileClick,
  upsertGitHubUser,
} from './database.js';
import {
  completeGitHubLogin,
  getCurrentProtectedUser,
  logoutProtectedUser,
  startGitHubLogin,
} from './protectedUSERS_root_path_secure/githubAuth.js';

const port = Number(process.env.PORT ?? 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .map((origin) => origin.toLowerCase())
    .filter(Boolean),
);

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.has(origin.toLowerCase())) {
    sendJson(response, 403, { error: 'Origin is not allowed.' });
    return;
  }
  if (origin) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type');

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  if (pathname === '/auth/github') {
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET, OPTIONS');
      sendJson(response, 405, { error: 'Method not allowed.' });
      return;
    }
    startGitHubLogin(response);
    return;
  }
  if (pathname === '/auth/github/callback') {
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET, OPTIONS');
      sendJson(response, 405, { error: 'Method not allowed.' });
      return;
    }
    await completeGitHubLogin(request, response, {
      createSession: createProtectedUserSession,
      deleteSession: deleteProtectedUserSession,
      saveUser: upsertGitHubUser,
    });
    return;
  }
  if (pathname === '/api/auth/me') {
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET, OPTIONS');
      sendJson(response, 405, { error: 'Method not allowed.' });
      return;
    }
    await getCurrentProtectedUser(request, response, getProtectedUserForSession);
    return;
  }
  if (pathname === '/api/auth/logout') {
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST, OPTIONS');
      sendJson(response, 405, { error: 'Method not allowed.' });
      return;
    }
    if (!origin || !allowedOrigins.has(origin.toLowerCase())) {
      sendJson(response, 403, { error: 'A trusted frontend origin is required.' });
      return;
    }
    await logoutProtectedUser(request, response, deleteProtectedUserSession);
    return;
  }
  if (pathname === '/healthz' && request.method === 'GET') {
    await getProfileClickCount();
    sendJson(response, 200, { status: 'ok', databaseProvider: getDatabaseProvider() });
    return;
  }
  if (pathname !== '/api/profile-clicks') {
    sendJson(response, 404, { error: 'Not found.' });
    return;
  }
  if (request.method === 'GET') {
    sendJson(response, 200, { count: await getProfileClickCount() });
    return;
  }
  if (request.method === 'POST') {
    sendJson(response, 200, { count: await recordProfileClick() });
    return;
  }

  response.setHeader('Allow', 'GET, POST, OPTIONS');
  sendJson(response, 405, { error: 'Method not allowed.' });
}

const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error: unknown) => {
    console.error('API request failed.', error);
    if (!response.headersSent) {
      sendJson(response, 500, { error: 'The request could not be completed.' });
    } else {
      response.destroy();
    }
  });
});

async function start(): Promise<void> {
  await getProfileClickCount();
  server.listen(port, '0.0.0.0', () => {
    console.log(`Simoouahbi API listening on port ${port} (${getDatabaseProvider()}).`);
  });
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close((error) => {
      if (error) {
        console.error('Unable to close the API server cleanly.', error);
        process.exitCode = 1;
      }
      void disconnectDatabase().catch((disconnectError: unknown) => {
        console.error('Unable to close the database connection cleanly.', disconnectError);
        process.exitCode = 1;
      });
    });
  });
}

void start().catch((error: unknown) => {
  console.error('API startup failed.', error);
  process.exitCode = 1;
});
