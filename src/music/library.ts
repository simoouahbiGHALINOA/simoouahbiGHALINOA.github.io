const DATABASE_NAME = 'eco-browser-music-v1';
const STORE_NAME = 'device-tracks';

export interface StoredDeviceTrack {
  id: string;
  title: string;
  artist: string;
  file: Blob;
}

interface AudioFileHandle {
  getFile(): Promise<File>;
}

interface AudioFilePickerWindow extends Window {
  showOpenFilePicker?: (options: {
    multiple: boolean;
    types: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<AudioFileHandle[]>;
}

export async function chooseAudioFiles(): Promise<File[] | null> {
  const pickerWindow = window as AudioFilePickerWindow;
  if (!pickerWindow.showOpenFilePicker) return null;
  const handles = await pickerWindow.showOpenFilePicker({
    multiple: true,
    types: [{
      description: 'Audio files',
      accept: {
        'audio/*': ['.aac', '.flac', '.m4a', '.mp3', '.oga', '.ogg', '.opus', '.wav', '.weba'],
      },
    }],
  });
  return Promise.all(handles.map((handle) => handle.getFile()));
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('This browser does not support private, on-device music storage.'));
      return;
    }

    const request = window.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('The music library could not be opened.'));
  });
}

export async function readDeviceTracks(): Promise<StoredDeviceTrack[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as StoredDeviceTrack[]);
    request.onerror = () => reject(request.error ?? new Error('The saved music could not be read.'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error('The saved music could not be read.'));
  });
}

export async function addDeviceTracks(files: File[]): Promise<StoredDeviceTrack[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const tracks = files.map((file) => ({
      id: crypto.randomUUID(),
      title: file.name.replace(/\.[^.]+$/, '') || file.name,
      artist: 'Your device',
      file,
    }));

    tracks.forEach((track) => store.put(track));
    transaction.oncomplete = () => {
      database.close();
      resolve(tracks);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('The selected music could not be saved.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Saving the selected music was cancelled.'));
    };
  });
}

export async function removeDeviceTrack(id: string): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('The selected music could not be removed.'));
    };
  });
}
