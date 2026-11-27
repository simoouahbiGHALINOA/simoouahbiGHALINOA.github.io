import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Disc3, ListMusic, Music2, Pause, Play, Plus, Share2, SkipBack, SkipForward, Trash2, Upload, Volume2, X } from 'lucide-react';
import { PUBLIC_PLAYLIST } from '../music/playlist';
import { addDeviceTracks, chooseAudioFiles, readDeviceTracks, removeDeviceTrack, type StoredDeviceTrack } from '../music/library';
import {
  connectMusicSync,
  createMusicSyncClientId,
  createMusicSyncCode,
  isMusicSyncAudioUrl,
  isMusicSyncConfigured,
  parseMusicSyncCode,
  readMusicSyncCode,
  saveMusicSyncCode,
  type MusicSyncConnection,
  type MusicSyncLibraryTrack,
  type MusicSyncPairing,
} from '../music/musicSync';

const PLAYER_KEY = 'eco-starter:player';
const PRIVATE_URLS_KEY = 'eco-starter:private-urls';

interface PlayerTrack {
  id: string;
  title: string;
  artist: string;
  src: string;
  kind: 'public' | 'device' | 'private-url' | 'shared';
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

interface AudioEnhancerGraph {
  context: AudioContext;
  source: MediaElementAudioSourceNode;
  gain: GainNode;
  bass: BiquadFilterNode;
  clarity: BiquadFilterNode;
  highShelf: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  limiter: DynamicsCompressorNode;
}

function canEnhanceTrack(track: PlayerTrack | undefined) {
  if (!track) return false;
  if (track.kind === 'device') return true;
  try {
    const url = new URL(track.src, window.location.href);
    return url.origin === window.location.origin ||
      (track.kind === 'shared' && isMusicSyncAudioUrl(url.href));
  } catch {
    return false;
  }
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

function hasAudibleVideo() {
  return Array.from(document.querySelectorAll('video')).some(
    (video) => !video.paused && !video.ended && !video.muted && video.volume > 0,
  );
}

export default function MusicPlayer() {
  const audio = useRef<HTMLAudioElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const restoredTime = useRef(0);
  const restoredTrack = useRef('');
  const shouldAutoplayOnLoad = useRef(true);
  const playAfterLoad = useRef(false);
  const nativeFallbackPending = useRef(false);
  const playTrackRef = useRef<() => void>(() => {});
  const pausedByVideoRef = useRef(false);
  const activeTrackRef = useRef<PlayerTrack | undefined>(undefined);
  const audioEnhancer = useRef<AudioEnhancerGraph | null>(null);
  const objectUrls = useRef(new Set<string>());
  const lastSavedSecond = useRef(-1);
  const [deviceTracks, setDeviceTracks] = useState<(StoredDeviceTrack & { src: string })[]>([]);
  const [privateUrls, setPrivateUrls] = useState<PrivateUrlTrack[]>([]);
  const [sharedTracks, setSharedTracks] = useState<MusicSyncLibraryTrack[]>([]);
  const [activeId, setActiveId] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [needsResume, setNeedsResume] = useState(false);
  const [volumePercent, setVolumePercent] = useState(100);
  const [useNativePlayback, setUseNativePlayback] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeLibraryTab, setActiveLibraryTab] = useState<'playlist' | 'add' | 'share'>('playlist');
  const [syncPairing, setSyncPairing] = useState<MusicSyncPairing | null>(readMusicSyncCode);
  const [pendingPairing, setPendingPairing] = useState<MusicSyncPairing | null>(null);
  const [syncCodeInput, setSyncCodeInput] = useState('');
  const [syncConnectionStatus, setSyncConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'unconfigured'>('unconfigured');
  const [syncUploadStatus, setSyncUploadStatus] = useState<'idle' | 'uploading' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [urlTitle, setUrlTitle] = useState('');
  const [urlValue, setUrlValue] = useState('');
  const [progress, setProgress] = useState(0);
  const [syncClientId] = useState(createMusicSyncClientId);
  const syncConnection = useRef<MusicSyncConnection | null>(null);

  const tracks = useMemo<PlayerTrack[]>(() => [
    ...PUBLIC_PLAYLIST.map((track) => ({ ...track, src: track.audioUrl, kind: 'public' as const })),
    ...privateUrls.map((track) => ({ id: track.id, title: track.title, artist: track.artist, src: track.audioUrl, kind: 'private-url' as const })),
    ...deviceTracks.map((track) => ({ id: track.id, title: track.title, artist: track.artist, src: track.src, kind: 'device' as const })),
    ...sharedTracks
      .filter((track) => !deviceTracks.some((local) => local.id === track.id) && !privateUrls.some((local) => local.id === track.id))
      .map((track) => ({ id: track.id, title: track.title, artist: track.artist, src: track.audioUrl, kind: 'shared' as const })),
  ], [deviceTracks, privateUrls, sharedTracks]);
  const activeTrack = tracks.find((track) => track.id === activeId) ?? tracks[0];
  const activeIndex = Math.max(0, tracks.findIndex((track) => track.id === activeTrack?.id));
  const enhancementSupported = canEnhanceTrack(activeTrack);
  const audioProcessingEnabled = enhancementSupported && !useNativePlayback;
  const volumeBoost = Math.max(0, Math.min(1, (volumePercent - 100) / 100));
  const volumeGain = 1 + volumeBoost * 9;
  const volumeBass = volumeBoost * 18;
  activeTrackRef.current = activeTrack;

  const switchToNativePlayback = useCallback(() => {
    const element = audio.current;
    if (element && activeTrack) {
      restoredTrack.current = activeTrack.id;
      restoredTime.current = Number.isFinite(element.currentTime) ? element.currentTime : 0;
      playAfterLoad.current = playAfterLoad.current || !element.paused;
    }
    nativeFallbackPending.current = true;
    setUseNativePlayback(true);
    if (element) element.volume = Math.min(volumePercent, 100) / 100;
    setMessage('Volume boost is unavailable for this track; standard volume is available.');
  }, [activeTrack, volumePercent]);

  const switchToEnhancedPlayback = useCallback(() => {
    const element = audio.current;
    if (element && activeTrack) {
      restoredTrack.current = activeTrack.id;
      restoredTime.current = Number.isFinite(element.currentTime) ? element.currentTime : 0;
      playAfterLoad.current = !element.paused;
    }
    setUseNativePlayback(false);
    setMessage('');
  }, [activeTrack]);

  const enableAudioEnhancement = useCallback((gainLevel = volumeGain, bassLevel = volumeBass) => {
    const element = audio.current;
    if (!element || !activeTrack) return false;
    if (useNativePlayback) return false;
    if (!canEnhanceTrack(activeTrack)) {
      setMessage('Volume boost is unavailable for this track; standard volume is available.');
      return false;
    }
    let context: AudioContext | null = null;
    let source: MediaElementAudioSourceNode | null = null;
    try {
      let graph = audioEnhancer.current;
      if (!graph) {
        const audioContext = new AudioContext();
        context = audioContext;
        const mediaSource = audioContext.createMediaElementSource(element);
        source = mediaSource;
        const lowShelf = audioContext.createBiquadFilter();
        lowShelf.type = 'lowshelf';
        lowShelf.frequency.value = 110;
        lowShelf.gain.value = bassLevel;
        const clarity = audioContext.createBiquadFilter();
        clarity.type = 'peaking';
        clarity.frequency.value = 2800;
        clarity.Q.value = 0.9;
        clarity.gain.value = 2;
        const highShelf = audioContext.createBiquadFilter();
        highShelf.type = 'highshelf';
        highShelf.frequency.value = 7500;
        highShelf.gain.value = 1;
        const compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.value = -18;
        compressor.knee.value = 12;
        compressor.ratio.value = 6;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;
        const gain = audioContext.createGain();
        gain.gain.value = gainLevel;
        const limiter = audioContext.createDynamicsCompressor();
        limiter.threshold.value = -1.5;
        limiter.knee.value = 0;
        limiter.ratio.value = 20;
        limiter.attack.value = 0.001;
        limiter.release.value = 0.08;
        mediaSource.connect(lowShelf);
        lowShelf.connect(clarity);
        clarity.connect(highShelf);
        highShelf.connect(compressor);
        compressor.connect(gain);
        gain.connect(limiter);
        limiter.connect(audioContext.destination);
        graph = { context: audioContext, source: mediaSource, gain, bass: lowShelf, clarity, highShelf, compressor, limiter };
        audioEnhancer.current = graph;
        audioContext.addEventListener('statechange', () => {
          if (audioContext.state !== 'running' && audioContext.state !== 'closed' && !element.paused && document.visibilityState === 'visible') {
            void audioContext.resume().then(() => {
              if (audioContext.state !== 'running') switchToNativePlayback();
            }).catch(switchToNativePlayback);
          }
        });
      }
      if (!graph) throw new Error('The audio processing graph could not be created.');
      const boost = Math.max(0, Math.min(1, (gainLevel - 1) / 9));
      const now = graph.context.currentTime;
      graph.gain.gain.setTargetAtTime(gainLevel, now, 0.04);
      graph.bass.gain.setTargetAtTime(bassLevel, now, 0.04);
      graph.clarity.gain.setTargetAtTime(2 * boost, now, 0.04);
      graph.highShelf.gain.setTargetAtTime(boost, now, 0.04);
      graph.compressor.threshold.setTargetAtTime(-18 * boost, now, 0.04);
      graph.compressor.knee.setTargetAtTime(12 * boost, now, 0.04);
      graph.compressor.ratio.setTargetAtTime(1 + 5 * boost, now, 0.04);
      graph.limiter.threshold.setTargetAtTime(-1.5 * boost, now, 0.04);
      graph.limiter.ratio.setTargetAtTime(1 + 19 * boost, now, 0.04);
      const graphContext = graph.context;
      if (graphContext.state !== 'running') {
        void graphContext.resume().then(() => {
          if (graphContext.state !== 'running') switchToNativePlayback();
        }).catch(switchToNativePlayback);
      }
      setMessage('');
      return true;
    } catch {
      const graph = audioEnhancer.current;
      if (graph) {
        graph.source.disconnect();
        void graph.context.close();
        audioEnhancer.current = null;
      } else if (source) {
        source.disconnect();
      }
      if (context) {
        void context.close();
      }
      switchToNativePlayback();
      return false;
    }
  }, [activeTrack, switchToNativePlayback, useNativePlayback, volumeBass, volumeGain]);

  useEffect(() => {
    if (enhancementSupported || volumePercent <= 100) return;
    setVolumePercent(100);
    if (audio.current) audio.current.volume = 1;
  }, [enhancementSupported, volumePercent]);

  useEffect(() => {
    if (audioProcessingEnabled) return;
    const graph = audioEnhancer.current;
    if (!graph) return;
    graph.source.disconnect();
    audioEnhancer.current = null;
    void graph.context.close();
  }, [audioProcessingEnabled]);

  useEffect(() => () => {
    const graph = audioEnhancer.current;
    if (!graph) return;
    graph.source.disconnect();
    void graph.context.close();
    audioEnhancer.current = null;
  }, []);

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
        shouldAutoplayOnLoad.current = true;
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
      nativeFallbackPending.current = false;
      window.setTimeout(() => playTrackRef.current(), 0);
    } else {
      nativeFallbackPending.current = false;
    }
  }, [activeTrack?.id, activeTrack?.src, audioProcessingEnabled]);

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
    const saveWhenHidden = () => {
      if (document.visibilityState === 'hidden') saveBeforeLeaving();
    };
    window.addEventListener('pagehide', saveBeforeLeaving);
    window.addEventListener('beforeunload', saveBeforeLeaving);
    document.addEventListener('visibilitychange', saveWhenHidden);
    return () => {
      window.removeEventListener('pagehide', saveBeforeLeaving);
      window.removeEventListener('beforeunload', saveBeforeLeaving);
      document.removeEventListener('visibilitychange', saveWhenHidden);
    };
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

  const play = useCallback(async (enhance = false) => {
    const element = audio.current;
    if (!element || !activeTrack) return;
    if (hasAudibleVideo()) {
      pausedByVideoRef.current = true;
      setMessage('Music paused while a video has sound. Mute or pause the video to resume music.');
      return;
    }
    if (enhance && volumePercent > 100 && enhancementSupported && !useNativePlayback) {
      playAfterLoad.current = true;
    }
    const enhancementStarted = enhance && volumePercent > 100 && enableAudioEnhancement();
    if (enhance && volumePercent > 100 && !enhancementStarted && enhancementSupported && !useNativePlayback) {
      playAfterLoad.current = true;
      return;
    }
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
      const autoplayBlocked = error instanceof Error && error.name === 'NotAllowedError';
      const sharedPlaybackError = element.error?.code === 2
        ? 'The browser could not download the shared audio (media error 2).'
        : element.error?.code === 3
          ? 'The shared audio downloaded but could not be decoded (media error 3). Try a standard MP3 or WAV.'
          : element.error?.code === 4
            ? 'The shared file is missing or its format is unsupported (media error 4).'
            : 'This shared audio could not be loaded. Confirm the original site finished uploading it.';
      setNeedsResume(autoplayBlocked);
      setMessage(autoplayBlocked
        ? 'Autoplay was blocked. Click or tap anywhere to start music.'
        : activeTrack.kind === 'shared'
          ? sharedPlaybackError
          : 'This track could not be played. Check that the audio file or URL is available.');
    }
  }, [activeTrack, enableAudioEnhancement, enhancementSupported, useNativePlayback, volumePercent]);
  playTrackRef.current = () => { void play(true); };

  const pairMusicSync = (code: string) => {
    const pairing = parseMusicSyncCode(code);
    if (!pairing) {
      setMessage('That pairing code is not valid. Copy the full code from the other site.');
      return;
    }
    setPendingPairing(pairing);
  };

  const confirmSyncPairing = () => {
    const pairing = pendingPairing;
    if (!pairing) return;
    try {
      saveMusicSyncCode(pairing);
      setSyncPairing(pairing);
      setSyncCodeInput('');
      setPendingPairing(null);
      setMessage('Pairing saved. Connecting to the shared music room…');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'This browser could not save the pairing code.');
    }
  };

  const createMusicRoom = () => {
    const code = createMusicSyncCode();
    pairMusicSync(code);
  };

  const copyMusicSyncCode = async () => {
    if (!syncPairing) return;
    try {
      await navigator.clipboard.writeText(`${syncPairing.roomId}.${syncPairing.deviceId}`);
      setMessage('Pairing code copied. Paste it into the other site.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The pairing code could not be copied. Select and copy it manually.');
    }
  };

  const disconnectMusicSync = () => {
    try {
      saveMusicSyncCode(null);
      setSyncPairing(null);
      setSharedTracks([]);
      setSyncCodeInput('');
      setMessage('This browser is disconnected. Tracks already shared remain in the room.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'This browser could not disconnect from the music room.');
    }
  };

  useEffect(() => {
    if (!syncPairing) {
      syncConnection.current?.close();
      syncConnection.current = null;
      setSyncConnectionStatus(isMusicSyncConfigured() ? 'disconnected' : 'unconfigured');
      setSharedTracks([]);
      return;
    }

    setSyncConnectionStatus('connecting');
    const connection = connectMusicSync(syncPairing, syncClientId, {
      onCommand: () => {},
      onOwner: () => {},
      onState: () => {},
      onLibraryChange: () => {
        const activeConnection = syncConnection.current;
        if (activeConnection) {
          void activeConnection.readLibrary().then(setSharedTracks).catch((error: unknown) => {
            setMessage(error instanceof Error ? error.message : 'The shared library could not be refreshed.');
          });
        }
      },
      onConnectionChange: (connected) => setSyncConnectionStatus(connected ? 'connected' : 'disconnected'),
      onError: setMessage,
    });
    if (!connection) {
      setSyncConnectionStatus('unconfigured');
      setMessage('Shared music is not configured on this site.');
      return;
    }
    syncConnection.current = connection;
    return () => {
      connection.close();
      if (syncConnection.current === connection) syncConnection.current = null;
    };
  }, [syncClientId, syncPairing]);

  useEffect(() => {
    const connection = syncConnection.current;
    if (!connection || syncConnectionStatus !== 'connected') {
      setSyncUploadStatus('idle');
      return;
    }
    const localTracks = [
      ...privateUrls.map((track) => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        audioUrl: track.audioUrl,
      })),
      ...deviceTracks.map((track) => ({
        id: track.id,
        title: track.title,
        artist: track.artist,
        file: track.file,
      })),
    ];
    const hasImportedFiles = deviceTracks.length > 0;
    setSyncUploadStatus(hasImportedFiles ? 'uploading' : 'idle');
    let active = true;
    void connection.syncLibrary(localTracks).then((syncedTracks) => {
      if (!active) return;
      setSharedTracks(syncedTracks);
      setSyncUploadStatus(hasImportedFiles ? 'ready' : 'idle');
    }).catch((error: unknown) => {
      if (!active) return;
      setSyncUploadStatus(hasImportedFiles ? 'error' : 'idle');
      setMessage(error instanceof Error ? error.message : 'Your saved music could not be shared.');
    });
    return () => { active = false; };
  }, [deviceTracks, privateUrls, syncConnectionStatus]);

  useEffect(() => {
    const synchronizeAudio = () => {
      const element = audio.current;
      if (hasAudibleVideo()) {
        if (!element || element.paused) return;
        pausedByVideoRef.current = true;
        const track = activeTrackRef.current;
        if (track) {
          try {
            savePlayer(track.id, element.currentTime, false);
          } catch (error) {
            setMessage(error instanceof Error ? error.message : 'The playback position could not be saved.');
          }
        }
        element.pause();
        setMessage('Music paused while a video has sound. Mute or pause the video to resume music.');
        return;
      }

      if (pausedByVideoRef.current) {
        pausedByVideoRef.current = false;
        playTrackRef.current();
      }
    };
    const mediaEvents = ['play', 'playing', 'pause', 'ended', 'volumechange'];
    mediaEvents.forEach((event) => document.addEventListener(event, synchronizeAudio, true));
    synchronizeAudio();
    return () => {
      mediaEvents.forEach((event) => document.removeEventListener(event, synchronizeAudio, true));
    };
  }, []);

  useEffect(() => {
    if (!isReady || !activeTrack || !shouldAutoplayOnLoad.current) return;
    const restored = tracks.find((track) => track.id === restoredTrack.current);
    if (restored && restored.id !== activeTrack.id) return;
    shouldAutoplayOnLoad.current = false;
    void play();
  }, [activeTrack, isReady, play, tracks]);

  useEffect(() => {
    const resumeAfterInteraction = (event: PointerEvent) => {
      if (volumePercent > 100 && enhancementSupported) enableAudioEnhancement();
      const target = event.target;
      const clickedPlayer = target instanceof Node && audio.current?.parentElement?.contains(target);
      if (needsResume && !clickedPlayer) playTrackRef.current();
    };
    window.addEventListener('pointerdown', resumeAfterInteraction, { once: true });
    return () => window.removeEventListener('pointerdown', resumeAfterInteraction);
  }, [enableAudioEnhancement, enhancementSupported, needsResume, volumePercent]);

  const savePrivateUrls = (next: PrivateUrlTrack[]) => {
    try {
      window.localStorage.setItem(PRIVATE_URLS_KEY, JSON.stringify(next));
      setPrivateUrls(next);
      setMessage('');
    } catch {
      setMessage('Your browser could not save this private playlist.');
    }
  };

  const addFiles = async (files: ArrayLike<File> | null) => {
    if (!files || files.length === 0) return;
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
      const storageLocation = added[0]?.storage === 'opfs' ? 'the browser File System (OPFS)' : 'IndexedDB';
      setMessage(`${next.length} track${next.length === 1 ? '' : 's'} saved privately in ${storageLocation} on this device.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The selected music could not be saved.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const openAudioPicker = async () => {
    try {
      const files = await chooseAudioFiles();
      if (files === null) {
        fileInput.current?.click();
        return;
      }
      await addFiles(files);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setMessage(error instanceof Error ? error.message : 'The selected audio files could not be opened.');
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
        if (syncConnection.current) await syncConnection.current.deleteTrack(track.id);
        await removeDeviceTrack(track.id);
        const removed = deviceTracks.find((item) => item.id === track.id);
        if (removed) {
          URL.revokeObjectURL(removed.src);
          objectUrls.current.delete(removed.src);
        }
        setDeviceTracks((current) => current.filter((item) => item.id !== track.id));
      } else if (track.kind === 'private-url') {
        if (syncConnection.current) await syncConnection.current.deleteTrack(track.id);
        savePrivateUrls(privateUrls.filter((item) => item.id !== track.id));
      } else if (track.kind === 'shared') {
        const connection = syncConnection.current;
        if (!connection) throw new Error('Connect to the shared music room before removing a shared track.');
        await connection.deleteTrack(track.id);
        setSharedTracks(await connection.readLibrary());
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
        key={audioProcessingEnabled ? 'enhanced-track' : 'direct-track'}
        ref={audio}
        crossOrigin={activeTrack && isMusicSyncAudioUrl(activeTrack.src) ? 'anonymous' : undefined}
        loop={tracks.length === 1}
        preload="none"
        onVolumeChange={() => {
          if (volumePercent > 100 && audioProcessingEnabled) {
            enableAudioEnhancement(volumeGain, volumeBass);
          }
        }}
        onTimeUpdate={onTimeUpdate}
        onPlay={() => {
          setIsPlaying(true);
          setNeedsResume(false);
          if (!nativeFallbackPending.current) playAfterLoad.current = false;
        }}
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
              <h2>Music library</h2>
            </div>
            <button type="button" className="icon-button" aria-label="Close music library" onClick={() => setIsOpen(false)}><X size={18} /></button>
          </div>
          <nav className="music-tabs" aria-label="Music library sections">
            <button type="button" aria-pressed={activeLibraryTab === 'playlist'} onClick={() => setActiveLibraryTab('playlist')}><Music2 size={15} />Playlist</button>
            <button type="button" aria-pressed={activeLibraryTab === 'add'} onClick={() => setActiveLibraryTab('add')}><Upload size={15} />Add music</button>
            <button type="button" aria-pressed={activeLibraryTab === 'share'} onClick={() => setActiveLibraryTab('share')}><Share2 size={15} />Share/connect</button>
          </nav>
          <div className="player-notice-slot" role="status" aria-live="polite" aria-atomic="true">
            {message && <p className="player-message" title={message}>{message}</p>}
          </div>
          <div className={`playlist-panel playlist-panel-${activeLibraryTab}`} key={activeLibraryTab}>
            {activeLibraryTab === 'playlist' && (
              <>
                <p className="panel-description">Choose a track to play. Your music stays on this device unless you share it.</p>
                <div className="track-list">
                  {tracks.length ? tracks.map((track, index) => (
                    <div className={`track-row ${track.id === activeTrack?.id ? 'selected' : ''}`} key={track.id}>
                      <button type="button" className="track-select" onClick={() => selectTrack(index, Boolean(audio.current && !audio.current.paused))} aria-current={track.id === activeTrack?.id ? 'true' : undefined}>
                        <span className="track-art"><Music2 size={16} /></span>
                        <span className="track-label"><strong>{track.title}</strong><small>{track.artist} · {track.kind === 'public' ? 'Public playlist' : track.kind === 'shared' ? 'Shared music room' : syncPairing ? 'Shared music room' : 'Private to this device'}</small></span>
                      </button>
                      {track.kind !== 'public' && <button type="button" className="icon-button remove-track" aria-label={`Remove ${track.title}`} onClick={() => void deleteTrack(track)}><Trash2 size={15} /></button>}
                    </div>
                  )) : <p className="empty-library">No tracks yet. Add music you have permission to use.</p>}
                </div>
              </>
            )}
            {activeLibraryTab === 'add' && (
              <div className="add-music-panel">
                <button type="button" className="secondary-button" onClick={() => void openAudioPicker()}><Upload size={15} /> Add audio files</button>
                <input ref={fileInput} className="visually-hidden" type="file" accept="audio/*" multiple onChange={(event) => void addFiles(event.currentTarget.files)} />
                <p className="storage-note">Audio files save on this device. Pairing uploads imported audio to the shared room.</p>
                <form className="url-form" onSubmit={addUrl}>
                  <label htmlFor="track-title">Save an audio URL to this device</label>
                  <input id="track-title" value={urlTitle} onChange={(event) => setUrlTitle(event.target.value)} placeholder="Track title (optional)" />
                  <div className="url-entry">
                    <input aria-label="Audio URL" type="url" required value={urlValue} onChange={(event) => setUrlValue(event.target.value)} placeholder="https://example.com/song.mp3" />
                    <button type="submit" className="icon-button" aria-label="Add audio URL"><Plus size={18} /></button>
                  </div>
                </form>
              </div>
            )}
            {activeLibraryTab === 'share' && (
              <div className="music-sync-settings">
                <h3>Share music across clients</h3>
                {syncUploadStatus === 'uploading' && <p className="sync-status" role="status">Uploading imported audio. Keep this site open.</p>}
                {syncUploadStatus === 'ready' && <p className="sync-status" role="status">Shared audio is ready on connected sites.</p>}
                <p>{!isMusicSyncConfigured()
                  ? 'Shared music is not configured on this site.'
                  : syncPairing
                    ? `Room connected · ${syncConnectionStatus}`
                    : 'Create a room or enter a code to join an existing room.'}</p>
                {pendingPairing ? (
                  <div className="pairing-confirmation" role="group" aria-labelledby="sync-confirm-title">
                    <h4 id="sync-confirm-title">Confirm room connection</h4>
                    <p className="privacy-note">Anyone with this code can listen to or remove shared tracks.</p>
                    <div className="sync-actions">
                      <button type="button" className="secondary-button" onClick={() => setPendingPairing(null)}>Cancel</button>
                      <button type="button" className="secondary-button" onClick={confirmSyncPairing}>Confirm &amp; connect</button>
                    </div>
                    <output className="pairing-code-display" aria-label="Pairing code to share">{`${pendingPairing.roomId}.${pendingPairing.deviceId}`}</output>
                  </div>
                ) : syncPairing ? (
                  <>
                    <div className="sync-actions">
                      <button type="button" className="secondary-button" onClick={() => void copyMusicSyncCode()}>Copy pairing code</button>
                      <button type="button" className="secondary-button" onClick={disconnectMusicSync}>Disconnect room</button>
                    </div>
                    <output className="pairing-code-display" aria-label="Private pairing code">{`${syncPairing.roomId}.${syncPairing.deviceId}`}</output>
                  </>
                ) : (
                  <>
                    <label className="visually-hidden" htmlFor="music-sync-code">Paste a private pairing code</label>
                    <input
                      id="music-sync-code"
                      className="sync-code-input"
                      value={syncCodeInput}
                      onChange={(event) => setSyncCodeInput(event.currentTarget.value)}
                      placeholder="Paste a room code"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <div className="sync-actions">
                      <button type="button" className="secondary-button" disabled={!isMusicSyncConfigured()} onClick={createMusicRoom}>Create a room</button>
                      <button type="button" className="secondary-button" disabled={!isMusicSyncConfigured() || !syncCodeInput.trim()} onClick={() => pairMusicSync(syncCodeInput)}>Join a room</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      )}
      <button type="button" className="now-playing" onClick={() => setIsOpen((open) => !open)} aria-expanded={isOpen} aria-label="Open music library">
        <span className="record-icon"><Disc3 size={19} /></span>
        <span className="now-playing-text"><strong>{activeTrack?.title ?? 'Your music'}</strong><small>{activeTrack?.artist ?? (isReady ? 'Add your first track' : 'Loading library…')}</small></span>
      </button>
      <div className="player-controls">
        <button type="button" className="player-icon" aria-label="Previous track" title="Previous track" disabled={tracks.length < 2} onClick={() => selectTrack((activeIndex - 1 + tracks.length) % tracks.length, Boolean(audio.current && !audio.current.paused))}><SkipBack size={16} /></button>
        <button type="button" className="play-button" aria-label={isPlaying ? 'Pause music' : needsResume ? 'Resume music' : 'Play music'} title={isPlaying ? 'Pause' : needsResume ? 'Resume' : 'Play'} disabled={!activeTrack} onClick={() => {
          if (isPlaying) {
            togglePlayback();
          } else {
            void play(true);
          }
        }}>{isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}</button>
        <button type="button" className="player-icon" aria-label="Next track" title="Next track" disabled={tracks.length < 2} onClick={() => selectTrack((activeIndex + 1) % tracks.length, Boolean(audio.current && !audio.current.paused))}><SkipForward size={16} /></button>
      </div>
      <label className="volume-control">
        <Volume2 size={16} aria-hidden="true" />
        <input
          type="range"
          min="0"
          max={enhancementSupported ? 200 : 100}
          step="10"
          value={Math.min(volumePercent, enhancementSupported ? 200 : 100)}
          aria-label="Volume"
          onChange={(event) => {
            const nextPercent = Number(event.currentTarget.value);
            const boost = Math.max(0, Math.min(1, (nextPercent - 100) / 100));
            setVolumePercent(nextPercent);
            if (audio.current) audio.current.volume = Math.min(nextPercent, 100) / 100;
            if (nextPercent > 100 && enhancementSupported && useNativePlayback) switchToEnhancedPlayback();
            else if (nextPercent > 100 && audioProcessingEnabled) enableAudioEnhancement(1 + boost * 9, boost * 18);
            else if (audioEnhancer.current) enableAudioEnhancement(1, 0);
          }}
        />
        <output>{Math.min(volumePercent, enhancementSupported ? 200 : 100)}%</output>
      </label>
      <div className="player-progress" aria-label="Track progress">
        <span style={{ width: `${progress * 100}%` }} />
      </div>
      <button type="button" className="player-icon library-toggle" aria-label="Manage playlist" title="Manage playlist" onClick={() => setIsOpen((open) => !open)}><ListMusic size={18} /></button>
      <span className="visually-hidden" role="status">{message || (needsResume ? 'Playback position restored. Click or tap anywhere to resume.' : '')}</span>
    </div>
  );
}
