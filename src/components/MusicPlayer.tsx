import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Disc3, ListMusic, Music2, Pause, Play, Plus, SkipBack, SkipForward, Trash2, Upload, X } from 'lucide-react';
import { PUBLIC_PLAYLIST } from '../music/playlist';
import { addDeviceTracks, readDeviceTracks, removeDeviceTrack, type StoredDeviceTrack } from '../music/library';

const PLAYER_KEY = 'eco-starter:player';
const PRIVATE_URLS_KEY = 'eco-starter:private-urls';

interface PlayerTrack {
  id: string;
  title: string;
  artist: string;
  src: string;
  kind: 'public' | 'device' | 'private-url';
}

interface SavedPlayer {
  trackId: string;
  currentTime: number;
  wasPlaying: boolean;
}

interface PrivateUrlTrack {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
}

function readSavedPlayer(): SavedPlayer | null {
  try {
    const saved = window.localStorage.getItem(PLAYER_KEY);
    if (!saved) return null;
    const value = JSON.parse(saved) as Partial<SavedPlayer>;
    if (
      typeof value.trackId !== 'string' ||
      typeof value.currentTime !== 'number' ||
      !Number.isFinite(value.currentTime)
    ) return null;
    return { trackId: value.trackId, currentTime: Math.max(0, value.currentTime), wasPlaying: value.wasPlaying === true };
  } catch {
    return null;
  }
}

function readPrivateUrls(): PrivateUrlTrack[] {
  try {
    const saved = window.localStorage.getItem(PRIVATE_URLS_KEY);
    if (!saved) return [];
    const value: unknown = JSON.parse(saved);
    if (!Array.isArray(value)) return [];
    return value.filter((track): track is PrivateUrlTrack =>
      typeof track?.id === 'string' &&
      typeof track?.title === 'string' &&
      typeof track?.artist === 'string' &&
      typeof track?.audioUrl === 'string',
    );
  } catch {
    return [];
  }
}

function savePlayer(trackId: string, currentTime: number, wasPlaying: boolean) {
  try {
    window.localStorage.setItem(PLAYER_KEY, JSON.stringify({ trackId, currentTime, wasPlaying }));
  } catch {
    throw new Error('Your browser could not save the playback position.');
  }
}

export default function MusicPlayer() {
  const audio = useRef<HTMLAudioElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const restoredTime = useRef(0);
  const restoredTrack = useRef('');
  const playAfterLoad = useRef(false);
  const playTrackRef = useRef<() => void>(() => {});
  const activeTrackRef = useRef<PlayerTrack | undefined>(undefined);
  const objectUrls = useRef(new Set<string>());
  const lastSavedSecond = useRef(-1);
  const [deviceTracks, setDeviceTracks] = useState<(StoredDeviceTrack & { src: string })[]>([]);
  const [privateUrls, setPrivateUrls] = useState<PrivateUrlTrack[]>([]);
  const [activeId, setActiveId] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [needsResume, setNeedsResume] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [urlTitle, setUrlTitle] = useState('');
  const [urlValue, setUrlValue] = useState('');
  const [progress, setProgress] = useState(0);

  const tracks = useMemo<PlayerTrack[]>(() => [
    ...PUBLIC_PLAYLIST.map((track) => ({ ...track, src: track.audioUrl, kind: 'public' as const })),
    ...privateUrls.map((track) => ({ id: track.id, title: track.title, artist: track.artist, src: track.audioUrl, kind: 'private-url' as const })),
    ...deviceTracks.map((track) => ({ id: track.id, title: track.title, artist: track.artist, src: track.src, kind: 'device' as const })),
  ], [deviceTracks, privateUrls]);
  const activeTrack = tracks.find((track) => track.id === activeId) ?? tracks[0];
  const activeIndex = Math.max(0, tracks.findIndex((track) => track.id === activeTrack?.id));
  activeTrackRef.current = activeTrack;

  useEffect(() => {
    let active = true;
    const loadLibrary = async () => {
      try {
        const [storedTracks] = await Promise.all([readDeviceTracks()]);
        if (!active) return;
        const loadedTracks = storedTracks.map((track) => {
          const src = URL.createObjectURL(track.file);
          objectUrls.current.add(src);
          return { ...track, src };
        });
        setDeviceTracks(loadedTracks);
        setPrivateUrls(readPrivateUrls());
        const saved = readSavedPlayer();
        restoredTrack.current = saved?.trackId ?? '';
        restoredTime.current = saved?.currentTime ?? 0;
        setNeedsResume(Boolean(saved?.wasPlaying));
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : 'The music library could not be loaded.');
      } finally {
        if (active) setIsReady(true);
      }
    };
    void loadLibrary();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isReady || !tracks.length) return;
    const restored = tracks.find((track) => track.id === restoredTrack.current);
    setActiveId((current) => current || restored?.id || tracks[0].id);
  }, [isReady, tracks]);

  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    element.pause();
    element.removeAttribute('src');
    element.load();
    setIsPlaying(false);
    setProgress(0);
    if (playAfterLoad.current && activeTrack) {
      playAfterLoad.current = false;
      window.setTimeout(() => playTrackRef.current(), 0);
    };
  }, [activeTrack?.id, activeTrack?.src]);

  useEffect(() => () => {
    objectUrls.current.forEach((src) => URL.revokeObjectURL(src));
    objectUrls.current.clear();
  }, []);

  useEffect(() => {
    const saveBeforeLeaving = () => {
      const element = audio.current;
      const track = activeTrackRef.current;
      if (!element || !track) return;
      try {
        savePlayer(track.id, element.currentTime, !element.paused);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'The playback position could not be saved.');
      }
    };
    window.addEventListener('pagehide', saveBeforeLeaving);
    return () => window.removeEventListener('pagehide', saveBeforeLeaving);
  }, []);

  const selectTrack = useCallback((index: number, continuePlaying = false) => {
    const next = tracks[index];
    if (!next) return;
    try {
      savePlayer(next.id, 0, continuePlaying);
      restoredTrack.current = next.id;
      restoredTime.current = 0;
      playAfterLoad.current = continuePlaying;
      setNeedsResume(false);
      setActiveId(next.id);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The selected track could not be saved.');
    }
  }, [tracks]);

  const play = useCallback(async () => {
    const element = audio.current;
    if (!element || !activeTrack) return;
    try {
      if (element.getAttribute('src') !== activeTrack.src || element.readyState < 1) {
        const metadataLoaded = new Promise<void>((resolve, reject) => {
          let settled = false;
          const cleanUp = () => {
            element.removeEventListener('loadedmetadata', onLoaded);
            element.removeEventListener('error', onError);
          };
          const onLoaded = () => {
            if (settled) return;
            settled = true;
            cleanUp();
            if (restoredTrack.current === activeTrack.id && restoredTime.current > 0 && Number.isFinite(element.duration)) {
              element.currentTime = Math.min(restoredTime.current, Math.max(0, element.duration - 1));
            }
            restoredTrack.current = '';
            restoredTime.current = 0;
            resolve();
          };
          const onError = () => {
            if (settled) return;
            settled = true;
            cleanUp();
            reject(new Error('The audio metadata could not be loaded.'));
          };
          element.addEventListener('loadedmetadata', onLoaded);
          element.addEventListener('error', onError);
          element.src = activeTrack.src;
          element.load();
          if (element.readyState >= 1) onLoaded();
        });
        const playbackStarted = element.play();
        await Promise.all([metadataLoaded, playbackStarted]);
      } else {
        await element.play();
      }
      setIsPlaying(true);
      setNeedsResume(false);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error && error.name === 'NotAllowedError'
        ? 'Press Play to resume. Your browser blocks automatic playback.'
        : 'This track could not be played. Check that the audio file or URL is available.');
    }
  }, [activeTrack]);
  playTrackRef.current = () => { void play(); };

  const savePrivateUrls = (next: PrivateUrlTrack[]) => {
    try {
      window.localStorage.setItem(PRIVATE_URLS_KEY, JSON.stringify(next));
      setPrivateUrls(next);
      setMessage('');
    } catch {
      setMessage('Your browser could not save this private playlist.');
    }
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const audioFiles = Array.from(files).filter((file) => file.type.startsWith('audio/'));
    if (!audioFiles.length) {
      setMessage('Choose one or more audio files.');
      return;
    }
    try {
      const added = await addDeviceTracks(audioFiles);
      const next = added.map((track) => {
        const src = URL.createObjectURL(track.file);
        objectUrls.current.add(src);
        return { ...track, src };
      });
      setDeviceTracks((current) => [...current, ...next]);
      setMessage(`${next.length} track${next.length === 1 ? '' : 's'} saved privately on this device.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The selected music could not be saved.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const addUrl = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const parsed = new URL(urlValue.trim());
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Use an http or https audio URL.');
      const track: PrivateUrlTrack = {
        id: `url-${crypto.randomUUID()}`,
        title: urlTitle.trim() || parsed.pathname.split('/').pop() || 'Saved audio link',
        artist: 'Saved on this device',
        audioUrl: parsed.href,
      };
      savePrivateUrls([...privateUrls, track]);
      setUrlTitle('');
      setUrlValue('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Enter a valid audio URL.');
    }
  };

  const deleteTrack = async (track: PlayerTrack) => {
    try {
      if (track.kind === 'device') {
        await removeDeviceTrack(track.id);
        const removed = deviceTracks.find((item) => item.id === track.id);
        if (removed) {
          URL.revokeObjectURL(removed.src);
          objectUrls.current.delete(removed.src);
        }
        setDeviceTracks((current) => current.filter((item) => item.id !== track.id));
      } else if (track.kind === 'private-url') {
        savePrivateUrls(privateUrls.filter((item) => item.id !== track.id));
      }
      if (track.id === activeId) {
        const nextTracks = tracks.filter((item) => item.id !== track.id);
        setActiveId(nextTracks[0]?.id ?? '');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The track could not be removed.');
    }
  };

  const togglePlayback = () => {
    if (!audio.current) return;
    if (isPlaying) {
      if (activeTrack) {
        try {
          savePlayer(activeTrack.id, audio.current.currentTime, false);
        } catch (error) {
          setMessage(error instanceof Error ? error.message : 'The playback position could not be saved.');
        }
      }
      audio.current.pause();
      return;
    }
    void play();
  };

  const onTimeUpdate = () => {
    const element = audio.current;
    if (!element || !activeTrack) return;
    setProgress(Number.isFinite(element.duration) && element.duration > 0 ? element.currentTime / element.duration : 0);
    const second = Math.floor(element.currentTime);
    if (second === lastSavedSecond.current) return;
    lastSavedSecond.current = second;
    try {
      savePlayer(activeTrack.id, element.currentTime, !element.paused);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The playback position could not be saved.');
    }
  };

  return (
    <div className="music-player" id="listen">
      <audio
        ref={audio}
        preload="none"
        onTimeUpdate={onTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          if (tracks.length > 1) selectTrack((activeIndex + 1) % tracks.length, true);
        }}
        onError={() => {
          if (activeTrack) setMessage(`Could not load “${activeTrack.title}”. Check the audio URL or file.`);
        }}
      />
      {isOpen && (
        <section className="playlist-popover" aria-label="Music library">
          <div className="playlist-heading">
            <div>
              <span className="eyebrow">YOUR LISTENING SPACE</span>
              <h2>Music library</h2>
            </div>
            <button type="button" className="icon-button" aria-label="Close music library" onClick={() => setIsOpen(false)}><X size={18} /></button>
          </div>
          <p className="privacy-note">Your device tracks and saved links stay in this browser. Nothing is uploaded or synced to an account.</p>
          <div className="track-list">
            {tracks.length ? tracks.map((track, index) => (
              <div className={`track-row ${track.id === activeTrack?.id ? 'selected' : ''}`} key={track.id}>
                <button type="button" className="track-select" onClick={() => selectTrack(index, Boolean(audio.current && !audio.current.paused))} aria-current={track.id === activeTrack?.id ? 'true' : undefined}>
                  <span className="track-art"><Music2 size={16} /></span>
                  <span className="track-label"><strong>{track.title}</strong><small>{track.artist} · {track.kind === 'public' ? 'Public playlist' : 'Private to this device'}</small></span>
                </button>
                {track.kind !== 'public' && <button type="button" className="icon-button remove-track" aria-label={`Remove ${track.title}`} onClick={() => void deleteTrack(track)}><Trash2 size={15} /></button>}
              </div>
            )) : <p className="empty-library">No tracks yet. Add music you have permission to use.</p>}
          </div>
          <div className="add-music">
            <button type="button" className="secondary-button" onClick={() => fileInput.current?.click()}><Upload size={15} /> Add audio files</button>
            <input ref={fileInput} className="visually-hidden" type="file" accept="audio/*" multiple onChange={(event) => void addFiles(event.currentTarget.files)} />
            <form className="url-form" onSubmit={addUrl}>
              <label htmlFor="track-title">Save an audio URL to this device</label>
              <input id="track-title" value={urlTitle} onChange={(event) => setUrlTitle(event.target.value)} placeholder="Track title (optional)" />
              <div className="url-entry">
                <input aria-label="Audio URL" type="url" required value={urlValue} onChange={(event) => setUrlValue(event.target.value)} placeholder="https://example.com/song.mp3" />
                <button type="submit" className="icon-button" aria-label="Add audio URL"><Plus size={18} /></button>
              </div>
            </form>
          </div>
          {message && <p className="player-message" role="status">{message}</p>}
        </section>
      )}
      <button type="button" className="now-playing" onClick={() => setIsOpen((open) => !open)} aria-expanded={isOpen} aria-label="Open music library">
        <span className="record-icon"><Disc3 size={19} /></span>
        <span className="now-playing-text"><strong>{activeTrack?.title ?? 'Your music'}</strong><small>{activeTrack?.artist ?? (isReady ? 'Add your first track' : 'Loading library…')}</small></span>
      </button>
      <div className="player-controls">
        <button type="button" className="player-icon" aria-label="Previous track" title="Previous track" disabled={tracks.length < 2} onClick={() => selectTrack((activeIndex - 1 + tracks.length) % tracks.length, Boolean(audio.current && !audio.current.paused))}><SkipBack size={16} /></button>
        <button type="button" className="play-button" aria-label={isPlaying ? 'Pause music' : needsResume ? 'Resume music' : 'Play music'} title={isPlaying ? 'Pause' : needsResume ? 'Resume' : 'Play'} disabled={!activeTrack} onClick={togglePlayback}>{isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}</button>
        <button type="button" className="player-icon" aria-label="Next track" title="Next track" disabled={tracks.length < 2} onClick={() => selectTrack((activeIndex + 1) % tracks.length, Boolean(audio.current && !audio.current.paused))}><SkipForward size={16} /></button>
      </div>
      <div className="player-progress" aria-label="Track progress">
        <span style={{ width: `${progress * 100}%` }} />
      </div>
      <button type="button" className="player-icon library-toggle" aria-label="Manage playlist" title="Manage playlist" onClick={() => setIsOpen((open) => !open)}><ListMusic size={18} /></button>
      <span className="visually-hidden" role="status">{message || (needsResume ? 'Playback position restored. Press Play to resume.' : '')}</span>
    </div>
  );
}
