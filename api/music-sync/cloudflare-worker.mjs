const ROOM_ID_PATTERN = /^[a-f0-9]{48}$/i;
const DEVICE_ID_PATTERN = /^[a-f0-9]{24}$/i;
const CLIENT_ID_PATTERN = /^[a-f0-9]{32}$/i;
const TRACK_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
const MAX_JSON_BYTES = 64 * 1024;
const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
const AUDIO_CHUNK_BYTES = 4 * 1024 * 1024;
const LEASE_MS = 10_000;
const DEFAULT_STATE = { volumePercent: 100, muted: false, playing: false };
const encoder = new TextEncoder();

function jsonResponse(status, value) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function isHex(value, pattern) {
  return typeof value === 'string' && pattern.test(value);
}

function readPairing(values, { requireClient = false } = {}) {
  const { roomId, deviceId, clientId } = values;
  if (!isHex(roomId, ROOM_ID_PATTERN) ||
      !isHex(deviceId, DEVICE_ID_PATTERN) ||
      (requireClient && !isHex(clientId, CLIENT_ID_PATTERN)) ||
      (clientId && !isHex(clientId, CLIENT_ID_PATTERN))) {
    return null;
  }
  return {
    roomId: roomId.toLowerCase(),
    deviceId: deviceId.toLowerCase(),
    clientId: clientId?.toLowerCase() ?? '',
  };
}

function readPairingFromUrl(url, options) {
  return readPairing({
    roomId: url.searchParams.get('roomId'),
    deviceId: url.searchParams.get('deviceId'),
    clientId: url.searchParams.get('clientId'),
  }, options);
}

function allowedOrigins(env) {
  return new Set((env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().toLowerCase())
    .filter(Boolean));
}

function withCors(response, origin) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Accept, Content-Type, Range');
  headers.set('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range, ETag');
  headers.append('Vary', 'Origin');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function validateTrack(value) {
  if (!value || typeof value !== 'object' ||
      typeof value.id !== 'string' || !TRACK_ID_PATTERN.test(value.id) ||
      typeof value.title !== 'string' || value.title.length > 300 ||
      typeof value.artist !== 'string' || value.artist.length > 300 ||
      !['file', 'url'].includes(value.kind)) return false;
  if (value.kind === 'file') {
    return value.fileFingerprint === undefined ||
      (typeof value.fileFingerprint === 'string' && value.fileFingerprint.length <= 512);
  }
  if (typeof value.audioUrl !== 'string' || value.audioUrl.length > 2048) return false;
  try {
    return ['http:', 'https:'].includes(new URL(value.audioUrl).protocol);
  } catch {
    return false;
  }
}

function getRoomIdFromRequest(request) {
  const url = new URL(request.url);
  if (request.method === 'POST' && ['/v1/lease', '/v1/command'].includes(url.pathname)) {
    return request.clone().json().then((body) => body?.roomId);
  }
  return Promise.resolve(url.searchParams.get('roomId'));
}

function parseByteRange(value, size) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match) return { invalid: true };
  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!suffixLength || !size) return { invalid: true };
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
      start < 0 || start >= size || end < start) return { invalid: true };
  end = Math.min(end, size - 1);
  return { start, end, length: end - start + 1 };
}

function audioChunkKey(trackId, index) {
  return `audio:${trackId}:${index}`;
}

function storedAudioBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new TypeError('The shared audio chunk has an unsupported storage format.');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/') {
      return jsonResponse(200, {
        service: 'ECO-SYS music sync',
        status: 'ok',
        health: '/healthz',
        frontend: 'https://simoouahbighalinoa.github.io',
      });
    }
    if (url.pathname === '/healthz') {
      return jsonResponse(200, { status: 'ok' });
    }

    if (!url.pathname.startsWith('/v1/')) {
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response('Not found.', { status: 404 });
    }

    const origin = request.headers.get('Origin');
    const origins = allowedOrigins(env);
    if (!origin || !origins.has(origin.toLowerCase())) {
      return jsonResponse(403, { error: 'A configured client origin is required.' });
    }
    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }), origin);
    }

    let roomId;
    try {
      roomId = await getRoomIdFromRequest(request);
    } catch {
      return withCors(jsonResponse(400, { error: 'Request body must be valid JSON.' }), origin);
    }
    if (!isHex(roomId, ROOM_ID_PATTERN)) {
      return withCors(jsonResponse(400, { error: 'A valid room code is required.' }), origin);
    }

    try {
      const id = env.MUSIC_ROOMS.idFromName(roomId.toLowerCase());
      const room = env.MUSIC_ROOMS.get(id);
      return withCors(await room.fetch(request), origin);
    } catch (error) {
      console.error('Music relay request failed.', error);
      return withCors(jsonResponse(503, { error: 'The music sync service is temporarily unavailable.' }), origin);
    }
  },
};

export class MusicRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.listeners = new Map();
  }

  async fetch(request) {
    try {
      return await this.route(request);
    } catch (error) {
      if (error instanceof RangeError) {
        return jsonResponse(413, { error: error.message });
      }
      if (error instanceof SyntaxError) {
        return jsonResponse(400, { error: 'Request body must be valid JSON.' });
      }
      console.error('Music room request failed.', error);
      return jsonResponse(500, { error: 'The music room could not complete the request.' });
    }
  }

  async route(request) {
    const url = new URL(request.url);
    const { pathname } = url;
    if (pathname === '/v1/events' && request.method === 'GET') {
      const pairing = readPairingFromUrl(url, { requireClient: true });
      if (!pairing) return jsonResponse(400, { error: 'A valid client ID and pairing code are required.' });
      return this.openEvents(request, pairing);
    }

    if (['/v1/lease', '/v1/command'].includes(pathname) && request.method === 'POST') {
      const body = await this.readJson(request);
      const pairing = readPairing(body, { requireClient: true });
      if (!pairing) return jsonResponse(400, { error: 'A valid client ID and pairing code are required.' });
      return pathname === '/v1/lease'
        ? this.handleLease(body, pairing)
        : this.handleCommand(body, pairing);
    }

    const pairing = readPairingFromUrl(url);
    if (!pairing) return jsonResponse(400, { error: 'A valid pairing code is required.' });

    if (pathname === '/v1/state' && request.method === 'GET') {
      return jsonResponse(200, await this.getState());
    }
    if (pathname === '/v1/library' && request.method === 'GET') {
      return this.readLibrary(pairing);
    }
    if (pathname === '/v1/library' && request.method === 'PUT') {
      return this.syncLibrary(request, pairing);
    }

    const audioMatch = pathname.match(/^\/v1\/library\/audio\/([a-zA-Z0-9_-]{1,128})$/);
    if (audioMatch && request.method === 'GET') {
      return this.readAudio(request, pairing, audioMatch[1]);
    }
    const fileMatch = pathname.match(/^\/v1\/library\/([a-zA-Z0-9_-]{1,128})\/file$/);
    if (fileMatch && request.method === 'PUT') {
      return this.saveAudioFile(request, pairing, fileMatch[1]);
    }
    const trackMatch = pathname.match(/^\/v1\/library\/([a-zA-Z0-9_-]{1,128})$/);
    if (trackMatch && request.method === 'DELETE') {
      return this.deleteTrack(pairing, trackMatch[1]);
    }
    return jsonResponse(404, { error: 'Not found.' });
  }

  async readJson(request) {
    const contentLength = Number(request.headers.get('Content-Length') ?? 0);
    if (contentLength > MAX_JSON_BYTES) throw new RangeError('Request body is too large.');
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) {
      throw new RangeError('Request body is too large.');
    }
    return JSON.parse(text);
  }

  async getState() {
    return (await this.ctx.storage.get('state')) ?? DEFAULT_STATE;
  }

  async getTracks() {
    return (await this.ctx.storage.get('tracks')) ?? [];
  }

  broadcast(eventName, value, deviceId) {
    const message = encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(value)}\n\n`);
    for (const [key, listener] of this.listeners) {
      if (deviceId && listener.deviceId !== deviceId) continue;
      try {
        listener.controller.enqueue(message);
      } catch {
        clearInterval(listener.keepAlive);
        this.listeners.delete(key);
      }
    }
  }

  async openEvents(request, pairing) {
    await this.releaseExpiredLease();
    const state = await this.getState();
    const lease = await this.ctx.storage.get('lease');
    let listener;
    const stream = new ReadableStream({
      start: (controller) => {
        const key = `${pairing.deviceId}:${pairing.clientId}`;
        const prior = this.listeners.get(key);
        if (prior) {
          clearInterval(prior.keepAlive);
          try { prior.controller.close(); } catch { /* The previous stream may already be closed. */ }
        }
        controller.enqueue(encoder.encode('retry: 3000\n\n'));
        controller.enqueue(encoder.encode(`event: owner\ndata: ${JSON.stringify({
          clientId: lease && lease.expiresAt > Date.now() ? lease.clientId : null,
        })}\n\n`));
        controller.enqueue(encoder.encode(`event: state\ndata: ${JSON.stringify(state)}\n\n`));
        listener = {
          controller,
          deviceId: pairing.deviceId,
          keepAlive: setInterval(() => {
            try {
              controller.enqueue(encoder.encode(': keep-alive\n\n'));
            } catch {
              clearInterval(listener.keepAlive);
              this.listeners.delete(key);
            }
          }, 15_000),
        };
        this.listeners.set(key, listener);
      },
      cancel: () => {
        const key = `${pairing.deviceId}:${pairing.clientId}`;
        if (this.listeners.get(key) === listener) {
          clearInterval(listener.keepAlive);
          this.listeners.delete(key);
        }
      },
    });
    return new Response(stream, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-transform',
        'Content-Type': 'text/event-stream; charset=utf-8',
      },
    });
  }

  async releaseExpiredLease() {
    const lease = await this.ctx.storage.get('lease');
    if (!lease || lease.expiresAt > Date.now()) return lease ?? null;
    await this.ctx.storage.delete('lease');
    const state = { ...(await this.getState()), playing: false };
    await this.ctx.storage.put('state', state);
    this.broadcast('owner', { clientId: null });
    this.broadcast('state', state);
    return null;
  }

  async handleLease(body, pairing) {
    if (!['acquire', 'heartbeat', 'release'].includes(body.action)) {
      return jsonResponse(400, { error: 'Invalid music lease request.' });
    }
    let lease = await this.releaseExpiredLease();
    const now = Date.now();
    let granted = false;
    if (body.action === 'release') {
      if (lease?.clientId === pairing.clientId) {
        await this.ctx.storage.delete('lease');
        const state = { ...(await this.getState()), playing: false };
        await this.ctx.storage.put('state', state);
        this.broadcast('owner', { clientId: null }, pairing.deviceId);
        this.broadcast('state', state);
        lease = null;
        granted = true;
      }
    } else if (body.action === 'heartbeat') {
      if (lease?.clientId === pairing.clientId) {
        lease = { clientId: pairing.clientId, deviceId: pairing.deviceId, expiresAt: now + LEASE_MS };
        await this.ctx.storage.put('lease', lease);
        granted = true;
      }
    } else if (!lease || lease.clientId === pairing.clientId) {
      lease = { clientId: pairing.clientId, deviceId: pairing.deviceId, expiresAt: now + LEASE_MS };
      await this.ctx.storage.put('lease', lease);
      granted = true;
      this.broadcast('owner', { clientId: pairing.clientId }, pairing.deviceId);
    }
    return jsonResponse(200, { granted, ownerClientId: lease?.clientId ?? null });
  }

  async handleCommand(body, pairing) {
    const command = body.command;
    if (!command || !['play', 'pause', 'mute', 'unmute', 'volume'].includes(command.type) ||
        (command.type === 'volume' && (!Number.isInteger(command.value) || command.value < 0 || command.value > 200))) {
      return jsonResponse(400, { error: 'The music command is invalid.' });
    }
    const state = await this.getState();
    if (command.type === 'play' || command.type === 'pause') state.playing = command.type === 'play';
    if (command.type === 'mute' || command.type === 'unmute') state.muted = command.type === 'mute';
    if (command.type === 'volume') state.volumePercent = command.value;
    await this.ctx.storage.put('state', state);
    this.broadcast('command', { type: command.type, value: command.value, senderId: pairing.clientId });
    this.broadcast('state', state);
    return jsonResponse(200, { sent: true });
  }

  async readLibrary(pairing) {
    const tracks = (await this.getTracks())
      .sort((left, right) => left.title.localeCompare(right.title))
      .map((track) => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        kind: track.kind,
        audioUrl: track.kind === 'file'
          ? `/v1/library/audio/${encodeURIComponent(track.id)}?roomId=${pairing.roomId}&deviceId=${pairing.deviceId}`
          : track.audioUrl,
      }));
    return jsonResponse(200, { tracks });
  }

  async syncLibrary(request, pairing) {
    const body = await this.readJson(request);
    if (!body || !Array.isArray(body.tracks) || body.tracks.length > 500 ||
        !body.tracks.every(validateTrack)) {
      return jsonResponse(400, { error: 'The shared library must contain up to 500 valid tracks.' });
    }
    const tracks = await this.getTracks();
    const missingFiles = [];
    for (const incoming of body.tracks) {
      const index = tracks.findIndex((track) => track.id === incoming.id);
      const existing = index === -1 ? null : tracks[index];
      const fingerprintChanged = existing?.fileFingerprint !== incoming.fileFingerprint;
      if (existing?.kind === 'file' &&
          (incoming.kind !== 'file' || fingerprintChanged)) {
        await this.deleteAudioFile(existing);
      }
      const fileStored = incoming.kind === 'file' &&
        !fingerprintChanged &&
        existing?.fileStored === true;
      if (incoming.kind === 'file' && !fileStored) missingFiles.push(incoming.id);
      const next = {
        id: incoming.id,
        title: incoming.title,
        artist: incoming.artist,
        kind: incoming.kind,
        ...(incoming.kind === 'url' ? { audioUrl: incoming.audioUrl } : {
          fileFingerprint: incoming.fileFingerprint ?? '',
          fileStored,
          ...(fileStored ? {
            contentType: existing.contentType,
            fileSize: existing.fileSize,
            fileChunkCount: existing.fileChunkCount,
          } : {}),
        }),
      };
      if (index === -1) tracks.push(next);
      else tracks[index] = next;
    }
    await this.ctx.storage.put('tracks', tracks);
    this.broadcast('library', {});
    return jsonResponse(200, { missingFiles });
  }

  async saveAudioFile(request, pairing, trackId) {
    const tracks = await this.getTracks();
    const track = tracks.find((entry) => entry.id === trackId);
    if (!track) return jsonResponse(404, { error: 'The shared track was not found.' });
    if (track.kind !== 'file') return jsonResponse(400, { error: 'Only audio file tracks can be uploaded.' });
    if (!request.body) return jsonResponse(400, { error: 'The audio upload is empty.' });
    const contentLength = Number(request.headers.get('Content-Length') ?? 0);
    const declaredSize = Number(track.fileFingerprint?.split(':', 1)[0]);
    if (!Number.isSafeInteger(declaredSize) || declaredSize < 1) {
      return jsonResponse(400, { error: 'The shared track is missing a valid audio file size.' });
    }
    if (declaredSize > MAX_AUDIO_BYTES || contentLength > MAX_AUDIO_BYTES) {
      return jsonResponse(413, { error: 'Audio uploads cannot exceed 100 MB.' });
    }
    if (contentLength && contentLength !== declaredSize) {
      return jsonResponse(400, { error: 'The audio upload size does not match the shared track.' });
    }
    const contentType = request.headers.get('Content-Type') || 'audio/mpeg';
    if (!contentType.startsWith('audio/') && contentType !== 'application/octet-stream') {
      return jsonResponse(400, { error: 'The uploaded file must have an audio content type.' });
    }
    const chunkCount = Math.ceil(declaredSize / AUDIO_CHUNK_BYTES);
    let writtenChunks = 0;
    let totalBytes = 0;
    let pending = new Uint8Array(AUDIO_CHUNK_BYTES);
    let pendingLength = 0;
    const reader = request.body.getReader();

    try {
      await this.deleteAudioFile(track);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (totalBytes + value.byteLength > declaredSize) {
          throw new RangeError('The audio upload is larger than its declared size.');
        }
        totalBytes += value.byteLength;
        let offset = 0;
        while (offset < value.byteLength) {
          const bytesToCopy = Math.min(AUDIO_CHUNK_BYTES - pendingLength, value.byteLength - offset);
          pending.set(value.subarray(offset, offset + bytesToCopy), pendingLength);
          pendingLength += bytesToCopy;
          offset += bytesToCopy;
          if (pendingLength === AUDIO_CHUNK_BYTES) {
            await this.ctx.storage.put(audioChunkKey(trackId, writtenChunks), pending);
            writtenChunks += 1;
            pending = new Uint8Array(AUDIO_CHUNK_BYTES);
            pendingLength = 0;
          }
        }
      }
      if (totalBytes !== declaredSize) {
        throw new RangeError('The audio upload is smaller than its declared size.');
      }
      if (pendingLength > 0) {
        await this.ctx.storage.put(audioChunkKey(trackId, writtenChunks), pending.slice(0, pendingLength));
        writtenChunks += 1;
      }
      track.fileStored = true;
      track.fileSize = declaredSize;
      track.fileChunkCount = writtenChunks;
      track.contentType = contentType;
      await this.ctx.storage.put('tracks', tracks);
      this.broadcast('library', {});
      return new Response(null, { status: 204 });
    } catch (error) {
      try {
        await this.deleteAudioChunks(trackId, chunkCount);
        track.fileStored = false;
        delete track.fileSize;
        delete track.fileChunkCount;
        delete track.contentType;
        await this.ctx.storage.put('tracks', tracks);
      } catch (cleanupError) {
        console.error('The partial audio upload could not be cleared.', cleanupError);
      }
      const message = error instanceof Error ? error.message : 'The audio upload could not be stored.';
      if (!(error instanceof RangeError)) console.error('The audio upload failed.', error);
      return jsonResponse(error instanceof RangeError ? 400 : 507, {
        error: `${message} Any partial upload was cleared when possible.`,
      });
    }
  }

  async readAudio(request, pairing, trackId) {
    const tracks = await this.getTracks();
    const track = tracks.find((entry) => entry.id === trackId && entry.kind === 'file' && entry.fileStored === true);
    if (!track || !Number.isSafeInteger(track.fileSize) || !Number.isSafeInteger(track.fileChunkCount)) {
      return jsonResponse(404, { error: 'The shared audio file was not found.' });
    }

    const range = parseByteRange(request.headers.get('Range'), track.fileSize);
    if (range?.invalid) {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${track.fileSize}` },
      });
    }
    const start = range?.start ?? 0;
    const end = range?.end ?? track.fileSize - 1;
    const firstChunk = Math.floor(start / AUDIO_CHUNK_BYTES);
    const lastChunk = Math.floor(end / AUDIO_CHUNK_BYTES);
    let nextChunk = firstChunk;
    const body = new ReadableStream({
      pull: async (controller) => {
        if (nextChunk > lastChunk) {
          controller.close();
          return;
        }
        const stored = await this.ctx.storage.get(audioChunkKey(trackId, nextChunk));
        if (!stored) {
          controller.error(new Error('A shared audio chunk is missing.'));
          return;
        }
        const bytes = storedAudioBytes(stored);
        const chunkStart = nextChunk === firstChunk ? start % AUDIO_CHUNK_BYTES : 0;
        const chunkEnd = nextChunk === lastChunk
          ? end % AUDIO_CHUNK_BYTES + 1
          : bytes.byteLength;
        controller.enqueue(bytes.slice(chunkStart, chunkEnd));
        nextChunk += 1;
      },
    });
    const headers = new Headers({
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, no-store',
      'Content-Type': track.contentType ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });
    if (range) {
      headers.set('Content-Length', String(range.length));
      headers.set('Content-Range', `bytes ${range.start}-${range.end}/${track.fileSize}`);
      return new Response(body, { status: 206, headers });
    }
    headers.set('Content-Length', String(track.fileSize));
    return new Response(body, { status: 200, headers });
  }

  async deleteAudioChunks(trackId, chunkCount) {
    const keys = Array.from({ length: chunkCount }, (_, index) => audioChunkKey(trackId, index));
    await Promise.all(keys.map((key) => this.ctx.storage.delete(key)));
  }

  async deleteAudioFile(track) {
    if (Number.isSafeInteger(track.fileChunkCount) && track.fileChunkCount > 0) {
      await this.deleteAudioChunks(track.id, track.fileChunkCount);
    }
    track.fileStored = false;
    delete track.fileSize;
    delete track.fileChunkCount;
    delete track.contentType;
  }

  async deleteTrack(pairing, trackId) {
    const tracks = await this.getTracks();
    const index = tracks.findIndex((track) => track.id === trackId);
    if (index === -1) return jsonResponse(404, { error: 'The shared track was not found.' });
    const [track] = tracks.splice(index, 1);
    if (track.kind === 'file') await this.deleteAudioFile(track);
    await this.ctx.storage.put('tracks', tracks);
    this.broadcast('library', {});
    return new Response(null, { status: 204 });
  }
}
