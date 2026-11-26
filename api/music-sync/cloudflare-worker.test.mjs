import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import worker, { MusicRoom } from './cloudflare-worker.mjs';

const origin = 'https://simoouahbi.github.io';
const config = JSON.parse(readFileSync(new URL('../../wrangler.jsonc', import.meta.url), 'utf8'));
const clientOrigins = config.vars.ALLOWED_ORIGINS.split(',').map((value) => value.trim());
const roomId = 'a'.repeat(48);
const deviceId = 'b'.repeat(24);
const clientId = 'c'.repeat(32);

class MemoryStorage {
  values = new Map();

  async get(key) {
    const value = this.values.get(key);
    return value === undefined ? undefined : structuredClone(value);
  }

  async put(key, value) {
    this.values.set(key, structuredClone(value));
  }

  async delete(key) {
    return this.values.delete(key);
  }
}

function createEnvironment() {
  const rooms = new Map();
  const env = {
    ALLOWED_ORIGINS: origin,
    ASSETS: { fetch: async () => new Response('site asset') },
    MUSIC_ROOMS: {
      idFromName: (name) => name,
      get: (name) => {
        if (!rooms.has(name)) {
          const ctx = { storage: new MemoryStorage() };
          rooms.set(name, new MusicRoom(ctx, env));
        }
        return { fetch: (request) => rooms.get(name).fetch(request) };
      },
    },
  };
  return env;
}

function apiRequest(path, { method = 'GET', body, headers = {} } = {}) {
  return new Request(`https://relay.example${path}`, {
    method,
    headers: { Origin: origin, ...headers },
    body,
  });
}

function pairedQuery() {
  return `roomId=${roomId}&deviceId=${deviceId}&clientId=${clientId}`;
}

test('health endpoint returns 200 and static assets fall through when bound', async () => {
  const env = createEnvironment();
  const root = await worker.fetch(new Request('https://relay.example/'), env);
  assert.equal(root.status, 200);
  assert.deepEqual(await root.json(), {
    service: 'ECO-SYS music sync',
    status: 'ok',
    health: '/healthz',
    frontend: 'https://simoouahbighalinoa.github.io',
  });

  const health = await worker.fetch(new Request('https://relay.example/healthz'), env);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });

  const asset = await worker.fetch(new Request('https://relay.example/about.html'), env);
  assert.equal(await asset.text(), 'site asset');

  delete env.ASSETS;
  const missingAsset = await worker.fetch(new Request('https://relay.example/about.html'), env);
  assert.equal(missingAsset.status, 404);
});

test('relay rejects unconfigured origins and answers preflight for allowed origins', async () => {
  const env = createEnvironment();
  const rejected = await worker.fetch(new Request('https://relay.example/v1/library', {
    headers: { Origin: 'https://not-allowed.example' },
  }), env);
  assert.equal(rejected.status, 403);

  const preflight = await worker.fetch(apiRequest('/v1/library', { method: 'OPTIONS' }), env);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);
});

test('all nine configured Pages clients are allowed by the relay', async () => {
  const env = createEnvironment();
  env.ALLOWED_ORIGINS = clientOrigins.join(',');
  assert.equal(clientOrigins.length, 9);

  for (const clientOrigin of clientOrigins) {
    const response = await worker.fetch(new Request('https://relay.example/v1/library', {
      method: 'OPTIONS',
      headers: { Origin: clientOrigin },
    }), env);
    assert.equal(response.status, 204, clientOrigin);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), clientOrigin);
  }
});

test('paired library uploads and serves an audio file with byte-range support', async () => {
  const env = createEnvironment();
  const manifestResponse = await worker.fetch(apiRequest(`/v1/library?${pairedQuery()}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tracks: [
        { id: 'song-1', title: 'Song', artist: 'Artist', kind: 'file', fileFingerprint: '5:audio/mpeg:Song:1' },
        { id: 'url-1', title: 'Remote', artist: 'Artist', kind: 'url', audioUrl: 'https://cdn.example/song.mp3' },
      ],
    }),
  }), env);
  assert.equal(manifestResponse.status, 200);
  assert.deepEqual(await manifestResponse.json(), { missingFiles: ['song-1'] });

  const pendingLibraryResponse = await worker.fetch(apiRequest(`/v1/library?${pairedQuery()}`), env);
  const pendingLibrary = await pendingLibraryResponse.json();
  assert.deepEqual(pendingLibrary.tracks.map((track) => track.id), ['url-1']);

  const uploadResponse = await worker.fetch(apiRequest(`/v1/library/song-1/file?${pairedQuery()}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'audio/mpeg' },
    body: new Blob(['music']),
  }), env);
  assert.equal(uploadResponse.status, 204);

  const libraryResponse = await worker.fetch(apiRequest(`/v1/library?${pairedQuery()}`), env);
  const library = await libraryResponse.json();
  assert.equal(library.tracks.length, 2);
  const fileTrack = library.tracks.find((track) => track.id === 'song-1');
  assert.match(fileTrack.audioUrl, /\/v1\/library\/audio\/song-1\?/);

  const audioResponse = await worker.fetch(apiRequest(fileTrack.audioUrl), env);
  assert.equal(audioResponse.status, 200);
  assert.equal(await audioResponse.text(), 'music');

  const rangeResponse = await worker.fetch(apiRequest(fileTrack.audioUrl, {
    headers: { Range: 'bytes=1-3' },
  }), env);
  assert.equal(rangeResponse.status, 206);
  assert.equal(rangeResponse.headers.get('Content-Range'), 'bytes 1-3/5');
  assert.equal(await rangeResponse.text(), 'usi');

  const deleteResponse = await worker.fetch(apiRequest(`/v1/library/song-1?${pairedQuery()}`, {
    method: 'DELETE',
  }), env);
  assert.equal(deleteResponse.status, 204);
  const missingAudio = await worker.fetch(apiRequest(fileTrack.audioUrl), env);
  assert.equal(missingAudio.status, 404);
});

test('large audio files are chunked and byte ranges can cross chunk boundaries', async () => {
  const env = createEnvironment();
  const chunkSize = 4 * 1024 * 1024;
  const bytes = new Uint8Array(chunkSize + 5);
  bytes.set([65, 66, 67, 68, 69], chunkSize - 2);
  const manifestResponse = await worker.fetch(apiRequest(`/v1/library?${pairedQuery()}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tracks: [{
        id: 'chunked-song',
        title: 'Chunked',
        artist: 'Artist',
        kind: 'file',
        fileFingerprint: `${bytes.byteLength}:audio/mpeg:Chunked:1`,
      }],
    }),
  }), env);
  assert.deepEqual(await manifestResponse.json(), { missingFiles: ['chunked-song'] });

  const uploadResponse = await worker.fetch(apiRequest(`/v1/library/chunked-song/file?${pairedQuery()}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'audio/mpeg' },
    body: new Blob([bytes]),
  }), env);
  assert.equal(uploadResponse.status, 204);

  const libraryResponse = await worker.fetch(apiRequest(`/v1/library?${pairedQuery()}`), env);
  const library = await libraryResponse.json();
  const fileTrack = library.tracks.find((track) => track.id === 'chunked-song');
  const rangeResponse = await worker.fetch(apiRequest(fileTrack.audioUrl, {
    headers: { Range: `bytes=${chunkSize - 2}-${chunkSize + 2}` },
  }), env);
  assert.equal(rangeResponse.status, 206);
  assert.equal(await rangeResponse.text(), 'ABCDE');
});

test('playback lease and command state are persisted in the room', async () => {
  const env = createEnvironment();
  const identity = { roomId, deviceId, clientId };
  const lease = await worker.fetch(apiRequest('/v1/lease', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...identity, action: 'acquire' }),
  }), env);
  assert.deepEqual(await lease.json(), { granted: true, ownerClientId: clientId });

  const command = await worker.fetch(apiRequest('/v1/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...identity, command: { type: 'volume', value: 160 } }),
  }), env);
  assert.equal(command.status, 200);

  const state = await worker.fetch(apiRequest(`/v1/state?${pairedQuery()}`), env);
  assert.deepEqual(await state.json(), { volumePercent: 160, muted: false, playing: false });
});
