/**
 * Persistence for Document Pack Organizer — folders + document metadata in localStorage,
 * file blobs in IndexedDB (avoids localStorage size limits).
 */

const STORAGE_KEY = "visanova-document-pack";
const DB_NAME = "visanova-document-pack-db";
const DB_VERSION = 1;
const STORE_NAME = "files";

export interface StoredFolder {
  id: string;
  name: string;
  createdAt: string; // ISO string
}

export interface StoredDocument {
  id: string;
  name: string;
  folderId: string;
  dateAdded: string; // ISO string
  size: string;
  sizeBytes: number;
  mimeType?: string;
  hasFile: boolean;
}

export interface StoredData {
  folders: StoredFolder[];
  documents: StoredDocument[];
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

export async function saveFileBlob(docId: string, file: File): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(file, docId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function getFileBlob(docId: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(docId);
    req.onsuccess = () => {
      db.close();
      resolve(req.result ?? null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function deleteFileBlob(docId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(docId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export function loadFromStorage(): StoredData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredData;
    if (!parsed.folders || !parsed.documents) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveToStorage(data: StoredData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("[DocumentPack] Failed to save to localStorage:", e);
  }
}
