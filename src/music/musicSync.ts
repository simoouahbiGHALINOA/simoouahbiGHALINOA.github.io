export interface MusicSyncPairing {
  roomId: string;
  deviceId: string;
}

export interface MusicSyncState {
  volumePercent: number;
  muted: boolean;
  playing: boolean;
}

export interface MusicSyncLibraryTrack {
  id: string;
  title: string;
  artist: string;
  kind: 'file' | 'url';
  audioUrl: string;
}

export interface MusicSyncLocalTrack {
  id: string;
  title: string;
  artist: string;
  audioUrl?: string;
  file?: Blob;
}

export type MusicSyncCommand =
  | { type: 'play' | 'pause' | 'mute' | 'unmute'; senderId: string }
  | { type: 'volume'; value: number; senderId: string };

export interface MusicSyncConnection {
  clientId: string;
  close: () => void;
  lease: (action: 'acquire' | 'heartbeat' | 'release') => Promise<{ granted: boolean; ownerClientId: string | null }>;
  sendCommand: (command: { type: MusicSyncCommand['type']; value?: number }) => Promise<void>;
  readLibrary: () => Promise<MusicSyncLibraryTrack[]>;
  syncLibrary: (tracks: MusicSyncLocalTrack[]) => Promise<MusicSyncLibraryTrack[]>;
  deleteTrack: (trackId: string) => Promise<void>;
}

export const MUSIC_SYNC_STORAGE_KEY = 'eco:music-sync-pairing';
const relayUrl = (import.meta.env.VITE_MUSIC_SYNC_URL?.trim() ||
  'https://simoouahbighalinoa-github-io.simoouahbi-483.workers.dev').replace(/\/+$/, '');

export function isMusicSyncConfigured() {
  return Boolean(relayUrl);
}

export function isMusicSyncAudioUrl(audioUrl: string) {
  try {
    const url = new URL(audioUrl, `${relayUrl}/`);
    return url.origin === new URL(relayUrl).origin &&
      /^\/v1\/library\/audio\/[a-zA-Z0-9_-]{1,128}$/.test(url.pathname);
  } catch {
    return false;
  }
}

function isHexCode(value: unknown, length: number): value is string {
  return typeof value === 'string' && value.length === length && /^[a-f0-9]+$/i.test(value);
}

export function parseMusicSyncCode(value: string): MusicSyncPairing | null {
  const [roomId, deviceId, extra] = value.trim().split('.');
  if (extra !== undefined || !isHexCode(roomId, 48) || !isHexCode(deviceId, 24)) return null;
  return { roomId: roomId.toLowerCase(), deviceId: deviceId.toLowerCase() };
}

function randomHexCode(bytes: number) {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(values, (value) => value.toString(16).padStart(2, '0')).join('');
}

export function createMusicSyncCode() {
  return `${randomHexCode(24)}.${randomHexCode(12)}`;
}

export function createAdditionalDeviceCode(pairing: MusicSyncPairing) {
  return `${pairing.roomId}.${randomHexCode(12)}`;
}

export function readMusicSyncCode() {
  try {
    const stored = window.localStorage.getItem(MUSIC_SYNC_STORAGE_KEY);
    return stored ? parseMusicSyncCode(stored) : null;
  } catch {
    return null;
  }
}

export function saveMusicSyncCode(pairing: MusicSyncPairing | null) {
  if (pairing) {
    window.localStorage.setItem(MUSIC_SYNC_STORAGE_KEY, `${pairing.roomId}.${pairing.deviceId}`);
  } else {
    window.localStorage.removeItem(MUSIC_SYNC_STORAGE_KEY);
  }
}

export function getMusicSyncCode(pairing: MusicSyncPairing) {
  return `${pairing.roomId}.${pairing.deviceId}`;
}

export function createMusicSyncClientId() {
  try {
    const key = 'eco:music-sync-client';
    const existing = window.sessionStorage.getItem(key);
    if (isHexCode(existing, 32)) return existing;
    const clientId = randomHexCode(16);
    window.sessionStorage.setItem(key, clientId);
    return clientId;
  } catch {
    return randomHexCode(16);
  }
}

export function connectMusicSync(
  pairing: MusicSyncPairing,
  clientId: string,
  handlers: {
    onCommand: (command: MusicSyncCommand) => void;
    onOwner: (clientId: string | null) => void;
    onState: (state: MusicSyncState) => void;
    onLibraryChange: () => void;
    onConnectionChange: (connected: boolean) => void;
    onError: (message: string) => void;
  },
): MusicSyncConnection | null {
  if (!relayUrl) return null;
  const eventUrl = new URL(`${relayUrl}/v1/events`);
  eventUrl.searchParams.set('roomId', pairing.roomId);
  eventUrl.searchParams.set('deviceId', pairing.deviceId);
  eventUrl.searchParams.set('clientId', clientId);
  const events = new EventSource(eventUrl);
  events.onopen = () => handlers.onConnectionChange(true);
  events.onerror = () => handlers.onConnectionChange(false);
  events.addEventListener('owner', (event) => {
    try {
      const data: unknown = JSON.parse((event as MessageEvent<string>).data);
      if (typeof data === 'object' && data !== null && 'clientId' in data &&
        (typeof data.clientId === 'string' || data.clientId === null)) {
        handlers.onOwner(data.clientId);
      }
    } catch {
      handlers.onError('The music sync service sent invalid owner data.');
    }
  });
  events.addEventListener('state', (event) => {
    try {
      const data: unknown = JSON.parse((event as MessageEvent<string>).data);
      if (typeof data === 'object' && data !== null &&
        'volumePercent' in data && typeof data.volumePercent === 'number' && Number.isInteger(data.volumePercent) &&
        'muted' in data && typeof data.muted === 'boolean' &&
        'playing' in data && typeof data.playing === 'boolean') {
        handlers.onState({
          volumePercent: data.volumePercent,
          muted: data.muted,
          playing: data.playing,
        });
      }
    } catch {
      handlers.onError('The music sync service sent invalid playback state.');
    }
  });
  events.addEventListener('command', (event) => {
    try {
      const data: unknown = JSON.parse((event as MessageEvent<string>).data);
      if (typeof data !== 'object' || data === null || !('type' in data) ||
        typeof data.type !== 'string' || !('senderId' in data) || typeof data.senderId !== 'string') return;
      if (data.type === 'volume' && 'value' in data && typeof data.value === 'number' && Number.isInteger(data.value) &&
        data.value >= 0 && data.value <= 200) {
        handlers.onCommand({ type: 'volume', value: data.value, senderId: data.senderId });
      } else if (['play', 'pause', 'mute', 'unmute'].includes(data.type)) {
        handlers.onCommand({
          type: data.type as 'play' | 'pause' | 'mute' | 'unmute',
          senderId: data.senderId,
        });
      }
    } catch {
      handlers.onError('The music sync service sent an invalid command.');
    }
  });
  events.addEventListener('library', handlers.onLibraryChange);

  const request = async (path: string, method: string, body?: BodyInit, contentType?: string) => {
    const target = /^https?:\/\//i.test(path) ? path : `${relayUrl}${path}`;
    const response = await fetch(target, {
      method,
      headers: contentType ? { 'Content-Type': contentType } : undefined,
      body,
    });
    if (!response.ok) {
      let message = 'The music sync request failed.';
      try {
        const result: unknown = await response.json();
        if (typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string') {
          message = result.error;
        }
      } catch {
        message = `The music sync request failed with status ${response.status}.`;
      }
      throw new Error(message);
    }
    return response.status === 204 ? null : response.json() as Promise<unknown>;
  };

  const pairedPath = (path: string) => {
    const url = new URL(`${relayUrl}${path}`);
    url.searchParams.set('roomId', pairing.roomId);
    url.searchParams.set('deviceId', pairing.deviceId);
    url.searchParams.set('clientId', clientId);
    return url.toString();
  };

  const readLibrary = async () => {
    const response = await fetch(pairedPath('/v1/library'));
    if (!response.ok) throw new Error(`The shared library could not be loaded (HTTP ${response.status}).`);
    const result: unknown = await response.json();
    if (typeof result !== 'object' || result === null || !('tracks' in result) || !Array.isArray(result.tracks)) {
      throw new Error('The music sync service returned an invalid library.');
    }
    return result.tracks.filter((track): track is MusicSyncLibraryTrack =>
      typeof track?.id === 'string' &&
      typeof track?.title === 'string' &&
      typeof track?.artist === 'string' &&
      (track?.kind === 'file' || track?.kind === 'url') &&
      typeof track?.audioUrl === 'string',
    ).map((track) => ({
      ...track,
      audioUrl: new URL(track.audioUrl, `${relayUrl}/`).toString(),
    }));
  };

  const syncLibrary = async (tracks: MusicSyncLocalTrack[]) => {
    const manifest = tracks.map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      kind: track.file ? 'file' : 'url',
      ...(track.file
        ? { fileFingerprint: `${track.file.size}:${track.file.type}:${track.title}:${track.file instanceof File ? track.file.lastModified : 0}` }
        : { audioUrl: track.audioUrl }),
    }));
    const response = await request(
      pairedPath('/v1/library'),
      'PUT',
      JSON.stringify({ tracks: manifest }),
      'application/json',
    );
    if (typeof response !== 'object' || response === null || !('missingFiles' in response) ||
      !Array.isArray(response.missingFiles)) {
      throw new Error('The music sync service returned an invalid upload list.');
    }
    const missingIds = new Set(response.missingFiles.filter((id): id is string => typeof id === 'string'));
    for (const track of tracks) {
      if (!track.file || !missingIds.has(track.id)) continue;
      await request(
        pairedPath(`/v1/library/${encodeURIComponent(track.id)}/file`),
        'PUT',
        track.file,
        track.file.type || 'audio/mpeg',
      );
    }
    return readLibrary();
  };

  return {
    clientId,
    close: () => events.close(),
    lease: async (action) => {
      const result = await request('/v1/lease', 'POST', JSON.stringify({ action, ...pairing, clientId }), 'application/json') as { granted?: unknown; ownerClientId?: unknown };
      return {
        granted: result.granted === true,
        ownerClientId: typeof result.ownerClientId === 'string' ? result.ownerClientId : null,
      };
    },
    sendCommand: async (command) => {
      await request('/v1/command', 'POST', JSON.stringify({ command, ...pairing, clientId }), 'application/json');
    },
    readLibrary,
    syncLibrary,
    deleteTrack: async (trackId) => {
      await request(pairedPath(`/v1/library/${encodeURIComponent(trackId)}`), 'DELETE');
    },
  };
}
