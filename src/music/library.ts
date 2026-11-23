const DATABASE_NAME = 'eco-browser-music-v1';
const STORE_NAME = 'device-tracks';

export interface StoredDeviceTrack {
  id: string;
  title: string;
  artist: string;
  file: Blob;
  storage: 'opfs' | 'indexeddb';
}

interface StoredDeviceTrackRecord {
  id: string;
  title: string;
  artist: string;
  file?: Blob;
  fileName?: string;
  originalName?: string;
  fileType?: string;
  storage?: 'opfs' | 'indexeddb';
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

async function openPrivateMusicDirectory(): Promise<FileSystemDirectoryHandle | null> {
  const storage = navigator.storage;
  if (!storage || typeof storage.getDirectory !== 'function') return null;
  const root = await storage.getDirectory();
  return root.getDirectoryHandle('eco-music', { create: true });
}

async function cleanUpPrivateFiles(
  directory: FileSystemDirectoryHandle,
  fileNames: string[],
): Promise<void> {
  for (const fileName of fileNames) {
    try {
      await directory.removeEntry(fileName);
    } catch (error) {
      console.error(`Could not clean up ${fileName} from the private music file system.`, error);
    }
  }
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
  const records = await new Promise<StoredDeviceTrackRecord[]>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as StoredDeviceTrackRecord[]);
    request.onerror = () => {
      database.close();
      reject(request.error ?? new Error('The saved music could not be read.'));
    };
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('The saved music could not be read.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Reading the saved music was cancelled.'));
    };
  });
  const needsPrivateFileSystem = records.some((record) => !record.file && record.fileName);
  const directory = needsPrivateFileSystem ? await openPrivateMusicDirectory() : null;

  return Promise.all(records.map(async (record) => {
    if (record.file) {
      return { ...record, file: record.file, storage: 'indexeddb' as const };
    }
    if (!record.fileName || !directory) {
      throw new Error('A saved music file is missing from this browser’s private file system.');
    }
    const handle = await directory.getFileHandle(record.fileName);
    const storedFile = await handle.getFile();
    const file = new File([storedFile], record.originalName ?? record.fileName, {
      type: record.fileType ?? storedFile.type,
      lastModified: storedFile.lastModified,
    });
    return { ...record, file, storage: 'opfs' as const };
  }));
}

export async function addDeviceTracks(files: File[]): Promise<StoredDeviceTrack[]> {
  const directory = await openPrivateMusicDirectory();
  const records: StoredDeviceTrackRecord[] = [];
  const createdFileNames: string[] = [];

  if (directory) {
    try {
      for (const file of files) {
        const id = crypto.randomUUID();
        const extension = file.name.match(/(\.[a-z0-9]{1,10})$/i)?.[1]?.toLowerCase() ?? '.audio';
        const fileName = `${id}${extension}`;
        const handle = await directory.getFileHandle(fileName, { create: true });
        createdFileNames.push(fileName);
        const writable = await handle.createWritable();
        try {
          await writable.write(file);
          await writable.close();
        } catch (error) {
          if (writable.abort) {
            try {
              await writable.abort();
            } catch (abortError) {
              console.error('Could not abort a failed private audio file write.', abortError);
            }
          }
          throw error;
        }
        records.push({
          id,
          title: file.name.replace(/\.[^.]+$/, '') || file.name,
          artist: 'Your device',
          fileName,
          originalName: file.name,
          fileType: file.type,
          storage: 'opfs',
        });
      }
    } catch (error) {
      await cleanUpPrivateFiles(directory, createdFileNames);
      throw error;
    }
  } else {
    files.forEach((file) => {
      records.push({
        id: crypto.randomUUID(),
        title: file.name.replace(/\.[^.]+$/, '') || file.name,
        artist: 'Your device',
        file,
        storage: 'indexeddb',
      });
    });
  }

  let database: IDBDatabase | undefined;
  try {
    const activeDatabase = await openDatabase();
    database = activeDatabase;
    await new Promise<void>((resolve, reject) => {
      const transaction = activeDatabase.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      records.forEach((record) => store.put(record));
      transaction.oncomplete = () => {
        resolve();
      };
      transaction.onerror = () => reject(transaction.error ?? new Error('The selected music could not be saved.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Saving the selected music was cancelled.'));
    });
  } catch (error) {
    if (directory) await cleanUpPrivateFiles(directory, createdFileNames);
    throw error;
  } finally {
    database?.close();
  }

  return records.map((record, index) => ({
    id: record.id,
    title: record.title,
    artist: record.artist,
    file: files[index],
    storage: directory ? 'opfs' : 'indexeddb',
  }));
}

export async function removeDeviceTrack(id: string): Promise<void> {
  const database = await openDatabase();
  const record = await new Promise<StoredDeviceTrackRecord | undefined>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result as StoredDeviceTrackRecord | undefined);
    request.onerror = () => {
      database.close();
      reject(request.error ?? new Error('The selected music could not be read.'));
    };
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('The selected music could not be read.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Reading the selected music was cancelled.'));
    };
  });

  if (record?.fileName) {
    const directory = await openPrivateMusicDirectory();
    if (!directory) {
      throw new Error('This browser cannot access the private file system used by this track.');
    }
    await directory.removeEntry(record.fileName);
  }

  const databaseForDelete = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = databaseForDelete.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => {
      databaseForDelete.close();
      resolve();
    };
    transaction.onerror = () => {
      databaseForDelete.close();
      reject(transaction.error ?? new Error('The selected music could not be removed.'));
    };
    transaction.onabort = () => {
      databaseForDelete.close();
      reject(transaction.error ?? new Error('Removing the selected music was cancelled.'));
    };
  });
}
