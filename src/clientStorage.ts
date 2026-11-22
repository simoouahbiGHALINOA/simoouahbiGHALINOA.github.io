const PREFIX = 'eco';

export const ECO_STORAGE_KEYS = {
  theme: `${PREFIX}:theme`,
  sessionVisit: `${PREFIX}:session:visit`,
  cookieTheme: `${PREFIX}-theme`,
} as const;

export function readSessionPreference(key: string): string | null {
  try {
    return window.sessionStorage.getItem(`${PREFIX}:session:${key}`);
  } catch {
    return null;
  }
}

export function writeSessionPreference(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(`${PREFIX}:session:${key}`, value);
  } catch {
    // Session storage can be blocked by browser privacy settings.
  }
}

export function setEcoCookie(name: string, value: string, days = 365): void {
  if (!name.startsWith(`${PREFIX}-`) || /[;\r\n]/.test(value)) return;
  const expires = new Date();
  expires.setUTCDate(expires.getUTCDate() + days);
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
}

export function readEcoCookie(name: string): string | null {
  if (!name.startsWith(`${PREFIX}-`)) return null;
  const prefix = `${name}=`;
  const match = document.cookie.split('; ').find((item) => item.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}
