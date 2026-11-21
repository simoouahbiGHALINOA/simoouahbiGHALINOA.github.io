import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { GitHubIdentity, ProtectedUser } from '../database.js';

const STATE_COOKIE = 'eco_github_oauth_state';
const SESSION_COOKIE = 'eco_protected_user_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const STATE_MAX_AGE_SECONDS = 10 * 60;

type OAuthConfiguration = {
  clientId: string;
  clientSecret: string;
  callbackUrl: URL;
  frontendUrl: URL;
};

type AuthDatabase = {
  saveUser(identity: GitHubIdentity): Promise<ProtectedUser>;
  createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;
};

type GitHubProfilePayload = {
  id: number;
  login: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  html_url: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readOAuthConfiguration(): OAuthConfiguration | null {
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  const callbackValue = process.env.GITHUB_CALLBACK_URL?.trim();
  const frontendValue = process.env.FRONTEND_URL?.trim();
  if (!clientId || !clientSecret || !callbackValue || !frontendValue) return null;

  const callbackUrl = new URL(callbackValue);
  const frontendUrl = new URL(frontendValue);
  if (!['http:', 'https:'].includes(callbackUrl.protocol) || !['http:', 'https:'].includes(frontendUrl.protocol)) {
    throw new Error('GitHub callback and frontend URLs must use HTTP or HTTPS.');
  }
  if (callbackUrl.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(callbackUrl.hostname)) {
    throw new Error('The GitHub callback URL must use HTTPS outside local development.');
  }
  return { clientId, clientSecret, callbackUrl, frontendUrl };
}

function useSecureCookies(): boolean {
  return process.env.FRONTEND_URL?.trim().startsWith('https://') ?? false;
}

function makeStateCookie(state: string, maxAge: number): string {
  const secure = useSecureCookies() ? '; Secure' : '';
  return `${STATE_COOKIE}=${state}; Path=/auth/github/callback; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function makeSessionCookie(token: string, maxAge: number): string {
  const secure = useSecureCookies();
  const sameSite = secure ? 'None' : 'Lax';
  const secureAttribute = secure ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${maxAge}${secureAttribute}`;
}

function readCookie(request: IncomingMessage, name: string): string | null {
  const cookies = request.headers.cookie?.split(';') ?? [];
  for (const cookie of cookies) {
    const separator = cookie.indexOf('=');
    if (separator < 0 || cookie.slice(0, separator).trim() !== name) continue;
    return cookie.slice(separator + 1).trim();
  }
  return null;
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isValidOAuthState(cookieState: string | null, queryState: string | null): boolean {
  if (!cookieState || !queryState) return false;
  const cookieBytes = Buffer.from(cookieState);
  const queryBytes = Buffer.from(queryState);
  return cookieBytes.length === queryBytes.length && timingSafeEqual(cookieBytes, queryBytes);
}

function sendJson(response: ServerResponse, status: number, payload: unknown, headers: Record<string, string> = {}): void {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

function protectedUsersUrl(configuration: OAuthConfiguration, authStatus?: string): string {
  const url = new URL('/protectedUSERS_root_path_secure/', configuration.frontendUrl);
  if (authStatus) url.searchParams.set('auth', authStatus);
  return url.toString();
}

function clearStateCookie(): string {
  return makeStateCookie('', 0);
}

function clearSessionCookie(): string {
  const secure = useSecureCookies();
  const sameSite = secure ? 'None' : 'Lax';
  const secureAttribute = secure ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=0${secureAttribute}`;
}

function redirect(response: ServerResponse, location: string, cookies: string[] = []): void {
  response.writeHead(302, {
    Location: location,
    'Cache-Control': 'no-store',
    ...(cookies.length ? { 'Set-Cookie': cookies } : {}),
  });
  response.end();
}

function parseGitHubProfile(value: unknown): GitHubProfilePayload | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'number' || !Number.isSafeInteger(value.id) || value.id < 1) return null;
  if (typeof value.login !== 'string' || typeof value.html_url !== 'string') return null;
  if (value.name !== undefined && value.name !== null && typeof value.name !== 'string') return null;
  if (value.email !== undefined && value.email !== null && typeof value.email !== 'string') return null;
  if (value.avatar_url !== undefined && value.avatar_url !== null && typeof value.avatar_url !== 'string') return null;

  return {
    id: value.id,
    login: value.login,
    name: typeof value.name === 'string' ? value.name : null,
    email: typeof value.email === 'string' ? value.email : null,
    avatar_url: typeof value.avatar_url === 'string' ? value.avatar_url : null,
    html_url: value.html_url,
  };
}

export function startGitHubLogin(response: ServerResponse): void {
  const configuration = readOAuthConfiguration();
  if (!configuration) {
    sendJson(response, 503, { error: 'GitHub sign-in is not configured on this API.' });
    return;
  }

  const state = randomBytes(32).toString('hex');
  const authorizationUrl = new URL('https://github.com/login/oauth/authorize');
  authorizationUrl.searchParams.set('client_id', configuration.clientId);
  authorizationUrl.searchParams.set('redirect_uri', configuration.callbackUrl.toString());
  authorizationUrl.searchParams.set('scope', 'read:user');
  authorizationUrl.searchParams.set('state', state);
  redirect(response, authorizationUrl.toString(), [makeStateCookie(state, STATE_MAX_AGE_SECONDS)]);
}

export async function completeGitHubLogin(
  request: IncomingMessage,
  response: ServerResponse,
  database: AuthDatabase,
): Promise<void> {
  const configuration = readOAuthConfiguration();
  if (!configuration) {
    sendJson(response, 503, { error: 'GitHub sign-in is not configured on this API.' });
    return;
  }

  const callbackUrl = new URL(request.url ?? '/', configuration.callbackUrl);
  const state = callbackUrl.searchParams.get('state');
  const savedState = readCookie(request, STATE_COOKIE);
  if (!isValidOAuthState(savedState, state)) {
    redirect(response, protectedUsersUrl(configuration, 'invalid_state'), [clearStateCookie()]);
    return;
  }

  const code = callbackUrl.searchParams.get('code');
  if (!code || callbackUrl.searchParams.has('error')) {
    redirect(response, protectedUsersUrl(configuration, 'github_cancelled'), [clearStateCookie()]);
    return;
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Simoouahbi-ECO-API',
    },
    body: JSON.stringify({
      client_id: configuration.clientId,
      client_secret: configuration.clientSecret,
      code,
      redirect_uri: configuration.callbackUrl.toString(),
    }),
  });
  if (!tokenResponse.ok) {
    console.error(`GitHub token exchange failed with status ${tokenResponse.status}.`);
    redirect(response, protectedUsersUrl(configuration, 'github_login_failed'), [clearStateCookie()]);
    return;
  }

  const tokenPayload: unknown = await tokenResponse.json();
  const accessToken = isRecord(tokenPayload) && typeof tokenPayload.access_token === 'string'
    ? tokenPayload.access_token
    : null;
  if (!accessToken) {
    console.error('GitHub token exchange did not return an access token.');
    redirect(response, protectedUsersUrl(configuration, 'github_login_failed'), [clearStateCookie()]);
    return;
  }

  const profileResponse = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'Simoouahbi-ECO-API',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!profileResponse.ok) {
    console.error(`GitHub profile request failed with status ${profileResponse.status}.`);
    redirect(response, protectedUsersUrl(configuration, 'github_login_failed'), [clearStateCookie()]);
    return;
  }

  const profile = parseGitHubProfile(await profileResponse.json());
  if (!profile) {
    console.error('GitHub returned an invalid user profile.');
    redirect(response, protectedUsersUrl(configuration, 'github_login_failed'), [clearStateCookie()]);
    return;
  }

  const user = await database.saveUser({
    githubId: String(profile.id),
    username: profile.login,
    displayName: profile.name ?? null,
    email: profile.email ?? null,
    avatarUrl: profile.avatar_url ?? null,
    profileUrl: profile.html_url,
  });
  const previousSession = readCookie(request, SESSION_COOKIE);
  if (previousSession) await database.deleteSession(hashSessionToken(previousSession));

  const sessionToken = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await database.createSession(user.id, hashSessionToken(sessionToken), expiresAt);
  redirect(response, protectedUsersUrl(configuration), [
    clearStateCookie(),
    makeSessionCookie(sessionToken, SESSION_MAX_AGE_SECONDS),
  ]);
}

export async function getCurrentProtectedUser(
  request: IncomingMessage,
  response: ServerResponse,
  getUser: (tokenHash: string) => Promise<ProtectedUser | null>,
): Promise<void> {
  const sessionToken = readCookie(request, SESSION_COOKIE);
  if (!sessionToken) {
    sendJson(response, 401, { error: 'Authentication required.' });
    return;
  }

  const user = await getUser(hashSessionToken(sessionToken));
  if (!user) {
    sendJson(response, 401, { error: 'Your session has expired. Sign in again.' }, { 'Set-Cookie': clearSessionCookie() });
    return;
  }

  sendJson(response, 200, { user });
}

export async function logoutProtectedUser(
  request: IncomingMessage,
  response: ServerResponse,
  deleteSession: (tokenHash: string) => Promise<void>,
): Promise<void> {
  const sessionToken = readCookie(request, SESSION_COOKIE);
  if (sessionToken) await deleteSession(hashSessionToken(sessionToken));
  sendJson(response, 200, { ok: true }, { 'Set-Cookie': clearSessionCookie() });
}
