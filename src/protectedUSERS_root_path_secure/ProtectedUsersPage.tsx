import { useEffect, useState } from 'react';
import { ArrowLeft, Github, LogOut, ShieldCheck } from 'lucide-react';

type ProtectedUser = {
  id: string;
  githubId: string;
  username: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  profileUrl: string;
  createdAt: string;
  lastLoginAt: string;
};

type PageState = 'loading' | 'signed-out' | 'signed-in' | 'error';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '') ?? '';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readProtectedUser(value: unknown): ProtectedUser | null {
  if (!isRecord(value) || !isRecord(value.user)) return null;
  const user = value.user;
  if (
    typeof user.id !== 'string'
    || typeof user.githubId !== 'string'
    || typeof user.username !== 'string'
    || (user.displayName !== null && typeof user.displayName !== 'string')
    || (user.email !== null && typeof user.email !== 'string')
    || (user.avatarUrl !== null && typeof user.avatarUrl !== 'string')
    || typeof user.profileUrl !== 'string'
    || typeof user.createdAt !== 'string'
    || typeof user.lastLoginAt !== 'string'
  ) {
    return null;
  }
  return {
    id: user.id,
    githubId: user.githubId,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    profileUrl: user.profileUrl,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export default function ProtectedUsersPage() {
  const [pageState, setPageState] = useState<PageState>('loading');
  const [user, setUser] = useState<ProtectedUser | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const authNotice = new URLSearchParams(window.location.search).get('auth');

  useEffect(() => {
    if (!API_BASE_URL) {
      setErrorMessage('The API URL is not configured. Set VITE_API_BASE_URL for this frontend.');
      setPageState('error');
      return;
    }

    const controller = new AbortController();
    void fetch(`${API_BASE_URL}/api/auth/me`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          setPageState('signed-out');
          return;
        }
        if (!response.ok) throw new Error(`The API returned ${response.status}.`);
        const account = readProtectedUser(await response.json());
        if (!account) throw new Error('The API returned an invalid user profile.');
        setUser(account);
        setPageState('signed-in');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error('Unable to load the protected GitHub account.', error);
        setErrorMessage('The account could not be loaded. Check the API connection and try again.');
        setPageState('error');
      });

    return () => controller.abort();
  }, []);

  async function handleSignOut() {
    setIsSigningOut(true);
    setErrorMessage('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`The API returned ${response.status}.`);
      setUser(null);
      setPageState('signed-out');
    } catch (error: unknown) {
      console.error('Unable to sign out of the protected GitHub account.', error);
      setErrorMessage('Sign-out failed. Check the API connection and try again.');
    } finally {
      setIsSigningOut(false);
    }
  }

  const loginUrl = API_BASE_URL ? `${API_BASE_URL}/auth/github` : '';

  return (
    <main className="protected-users-page">
      <a className="protected-users-back" href="/">
        <ArrowLeft size={16} /> Back to ECO
      </a>
      <section className="protected-users-card" aria-labelledby="protected-users-title">
        <div className="protected-users-heading">
          <span className="protected-users-icon"><ShieldCheck size={23} /></span>
          <p className="eyebrow">PRIVATE ACCOUNT AREA</p>
          <h1 id="protected-users-title">Protected Users</h1>
          <p>Sign in with GitHub to create or open your account profile stored by the ECO API.</p>
        </div>

        {authNotice && pageState !== 'signed-in' && (
          <p className="protected-users-alert" role="alert">GitHub sign-in did not complete. Please try again.</p>
        )}
        {errorMessage && <p className="protected-users-alert" role="alert">{errorMessage}</p>}
        {pageState === 'loading' && <p className="protected-users-status" role="status">Checking your sign-in…</p>}
        {pageState === 'signed-out' && (
          <div className="protected-users-actions">
            {loginUrl
              ? <a className="primary-button" href={loginUrl}><Github size={18} /> Continue with GitHub</a>
              : <p className="protected-users-alert">GitHub sign-in is unavailable until the API URL is configured.</p>}
            <p>First sign-in creates your protected user record. Later sign-ins update the same record.</p>
          </div>
        )}
        {pageState === 'signed-in' && user && (
          <div className="protected-user-profile">
            {user.avatarUrl && <img className="protected-user-avatar" src={user.avatarUrl} alt="" />}
            <div className="protected-user-name">
              <h2>{user.displayName || user.username}</h2>
              <a href={user.profileUrl} target="_blank" rel="noreferrer">@{user.username}</a>
            </div>
            <dl>
              <div><dt>GitHub account ID</dt><dd>{user.githubId}</dd></div>
              <div><dt>Email</dt><dd>{user.email || 'No public email shared'}</dd></div>
              <div><dt>Account created</dt><dd>{new Date(user.createdAt).toLocaleDateString()}</dd></div>
              <div><dt>Last sign-in</dt><dd>{new Date(user.lastLoginAt).toLocaleString()}</dd></div>
            </dl>
            <p className="protected-users-storage-note">Your GitHub access token is not stored. Your profile is in MongoDB collection <code>protected_users</code>.</p>
            <button className="secondary-button" type="button" onClick={handleSignOut} disabled={isSigningOut}>
              <LogOut size={16} /> {isSigningOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
