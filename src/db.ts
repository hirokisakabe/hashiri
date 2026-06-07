import type { Note } from "./types";

const DB_NAME = "hashiri";
const DB_VERSION = 1;
const NOTE_STORE = "notes";

let dbPromise: Promise<IDBDatabase> | null = null;

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("error", () => reject(transaction.error));
    transaction.addEventListener("abort", () => reject(transaction.error));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(NOTE_STORE)) {
        const store = db.createObjectStore(NOTE_STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    });

    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });

  return dbPromise;
}

export async function listActiveNotes(): Promise<Note[]> {
  const db = await openDatabase();
  const transaction = db.transaction(NOTE_STORE, "readonly");
  const store = transaction.objectStore(NOTE_STORE);
  const notes = await requestToPromise<Note[]>(store.getAll());

  return notes
    .filter((note) => !note.archived)
    .sort((first, second) => second.updatedAt - first.updatedAt);
}

export async function createNote(body: string): Promise<Note> {
  const db = await openDatabase();
  const now = Date.now();
  const note: Note = {
    id: crypto.randomUUID(),
    body,
    createdAt: now,
    updatedAt: now,
    archived: false,
  };
  const transaction = db.transaction(NOTE_STORE, "readwrite");

  transaction.objectStore(NOTE_STORE).add(note);
  await transactionDone(transaction);

  return note;
}

export async function updateNoteBody(id: string, body: string): Promise<Note> {
  const db = await openDatabase();
  const transaction = db.transaction(NOTE_STORE, "readwrite");
  const store = transaction.objectStore(NOTE_STORE);
  const existing = await requestToPromise<Note | undefined>(store.get(id));

  if (!existing) {
    throw new Error(`Note ${id} was not found.`);
  }

  const updated: Note = {
    ...existing,
    body,
    updatedAt: Date.now(),
  };

  store.put(updated);
  await transactionDone(transaction);

  return updated;
}
