const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '') || null;

export function isProfileClickTrackingConfigured() {
  return apiBaseUrl !== null;
}

async function requestCount(method: 'GET' | 'POST'): Promise<number> {
  if (!apiBaseUrl) {
    throw new Error('Profile-click tracking API is not configured.');
  }

  const response = await fetch(`${apiBaseUrl}/api/profile-clicks`, {
    method,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Profile-click tracking API returned ${response.status}.`);
  }

  const payload: unknown = await response.json();
  if (
    !payload
    || typeof payload !== 'object'
    || !('count' in payload)
    || typeof payload.count !== 'number'
    || !Number.isSafeInteger(payload.count)
    || payload.count < 0
  ) {
    throw new Error('Profile-click tracking API returned an invalid count.');
  }

  return payload.count;
}

export function getProfileClickCount() {
  return requestCount('GET');
}

export function recordProfileClick() {
  return requestCount('POST');
}
