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
    request.addEventListener("error", () => {
      dbPromise = null;
      reject(request.error);
    });
  });

  return dbPromise;
}

async function readAllNotes(db: IDBDatabase): Promise<Note[]> {
  const transaction = db.transaction(NOTE_STORE, "readonly");
  const store = transaction.objectStore(NOTE_STORE);

  return requestToPromise<Note[]>(store.getAll());
}

async function normalizeActiveNotes(db: IDBDatabase, notes: Note[]): Promise<Note[]> {
  const activeNotes = notes
    .filter((note) => !note.archived)
    .sort((first, second) => second.updatedAt - first.updatedAt);

  if (activeNotes.length <= 1) {
    return notes;
  }

  const activeNoteId = activeNotes[0].id;
  const transaction = db.transaction(NOTE_STORE, "readwrite");
  const store = transaction.objectStore(NOTE_STORE);
  const normalizedNotes = notes.map((note) => {
    if (note.archived || note.id === activeNoteId) {
      return note;
    }

    const archivedNote: Note = { ...note, archived: true };
    store.put(archivedNote);
    return archivedNote;
  });

  await transactionDone(transaction);
  return normalizedNotes;
}

export async function listNotes(): Promise<Note[]> {
  const db = await openDatabase();
  const notes = await normalizeActiveNotes(db, await readAllNotes(db));

  return notes
    .sort((first, second) => second.updatedAt - first.updatedAt);
}

export async function createNote(body: string): Promise<Note> {
  const db = await openDatabase();
  const now = Date.now();
  const existingNotes = await readAllNotes(db);
  const note: Note = {
    id: crypto.randomUUID(),
    body,
    createdAt: now,
    updatedAt: now,
    revision: 1,
    archived: false,
  };
  const transaction = db.transaction(NOTE_STORE, "readwrite");
  const store = transaction.objectStore(NOTE_STORE);

  existingNotes
    .filter((existingNote) => !existingNote.archived)
    .forEach((existingNote) => {
      store.put({ ...existingNote, archived: true });
    });

  store.add(note);
  await transactionDone(transaction);

  return note;
}

export async function updateNoteBody(
  id: string,
  body: string,
  revision: number,
): Promise<Note> {
  const db = await openDatabase();
  const transaction = db.transaction(NOTE_STORE, "readwrite");
  const store = transaction.objectStore(NOTE_STORE);
  const existing = await requestToPromise<Note | undefined>(store.get(id));

  if (!existing) {
    throw new Error(`Note ${id} was not found.`);
  }

  if ((existing.revision ?? 0) > revision) {
    return existing;
  }

  const updated: Note = {
    ...existing,
    body,
    updatedAt: Date.now(),
    revision,
  };

  store.put(updated);
  await transactionDone(transaction);

  return updated;
}

export async function archiveNote(id: string): Promise<Note> {
  const db = await openDatabase();
  const transaction = db.transaction(NOTE_STORE, "readwrite");
  const store = transaction.objectStore(NOTE_STORE);
  const existing = await requestToPromise<Note | undefined>(store.get(id));

  if (!existing) {
    throw new Error(`Note ${id} was not found.`);
  }

  const archived: Note = {
    ...existing,
    archived: true,
    updatedAt: Date.now(),
    revision: (existing.revision ?? 0) + 1,
  };

  store.put(archived);
  await transactionDone(transaction);

  return archived;
}
