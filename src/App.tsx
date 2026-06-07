import { FormEvent, useEffect, useRef, useState } from "react";
import { archiveNote, createNote, listNotes, updateNoteBody } from "./db";
import type { Note } from "./types";

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
});

type LoadState = "loading" | "ready" | "error";
type SaveState = "saving" | "saved" | "error";

function App() {
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [archivedNotes, setArchivedNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const latestRevisions = useRef<Record<string, number>>({});

  useEffect(() => {
    let isMounted = true;

    listNotes()
      .then((storedNotes) => {
        if (!isMounted) {
          return;
        }
        latestRevisions.current = Object.fromEntries(
          storedNotes.map((note) => [note.id, note.revision ?? 0]),
        );
        setActiveNote(storedNotes.find((note) => !note.archived) ?? null);
        setArchivedNotes(storedNotes.filter((note) => note.archived));
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : String(error));
        setLoadState("error");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();

    if (!body) {
      return;
    }

    try {
      setErrorMessage("");
      const note = await createNote(body);
      latestRevisions.current[note.id] = note.revision;
      setActiveNote(note);
      setArchivedNotes((currentNotes) =>
        activeNote ? [activeNote, ...currentNotes] : currentNotes,
      );
      setSaveStates((currentStates) => ({ ...currentStates, [note.id]: "saved" }));
      setDraft("");
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleEdit(noteId: string, body: string) {
    const nextRevision = (latestRevisions.current[noteId] ?? 0) + 1;
    latestRevisions.current[noteId] = nextRevision;

    setActiveNote((currentNote) =>
      currentNote?.id === noteId
        ? { ...currentNote, body, revision: nextRevision }
        : currentNote,
    );
    setSaveStates((currentStates) => ({ ...currentStates, [noteId]: "saving" }));

    try {
      const updated = await updateNoteBody(noteId, body, nextRevision);
      setActiveNote((currentNote) =>
        currentNote?.id === noteId && updated.revision >= currentNote.revision
          ? updated
          : currentNote,
      );
      if (latestRevisions.current[noteId] === nextRevision) {
        setSaveStates((currentStates) => ({ ...currentStates, [noteId]: "saved" }));
      }
    } catch {
      if (latestRevisions.current[noteId] === nextRevision) {
        setSaveStates((currentStates) => ({ ...currentStates, [noteId]: "error" }));
      }
    }
  }

  async function handleArchiveCurrent() {
    if (!activeNote) {
      return;
    }

    try {
      setErrorMessage("");
      const archived = await archiveNote(activeNote.id);
      setActiveNote(null);
      setArchivedNotes((currentNotes) => [archived, ...currentNotes]);
      setSaveStates((currentStates) => ({ ...currentStates, [archived.id]: "saved" }));
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function getSaveLabel(noteId: string) {
    const saveState = saveStates[noteId] ?? "saved";

    if (saveState === "saving") {
      return "保存中";
    }
    if (saveState === "error") {
      return "保存失敗";
    }
    return "保存済み";
  }

  return (
    <main className="app-shell">
      <section className="stream-panel" aria-label="Hashiri">
        {activeNote ? (
          <section className="current-note" aria-label="現在のメモ">
            <textarea
              aria-label="現在のメモ本文"
              value={activeNote.body}
              onChange={(event) => handleEdit(activeNote.id, event.target.value)}
              rows={Math.max(8, activeNote.body.split("\n").length + 2)}
            />
            <footer>
              <time dateTime={new Date(activeNote.updatedAt).toISOString()}>
                {dateFormatter.format(activeNote.updatedAt)}
              </time>
              <span aria-live="polite">{getSaveLabel(activeNote.id)}</span>
              <button type="button" onClick={handleArchiveCurrent}>
                新しいメモを始める
              </button>
            </footer>
          </section>
        ) : (
          <form className="composer" onSubmit={handleCreate}>
            <textarea
              id="new-note"
              aria-label="新しいメモ"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="今の考えを書き足す"
              rows={8}
            />
            <div className="composer-actions">
              <button type="submit" disabled={!draft.trim()}>
                作成
              </button>
            </div>
          </form>
        )}

        {loadState === "loading" && <p className="status">読み込み中</p>}
        {loadState === "error" && (
          <p className="status error">IndexedDB を開けませんでした: {errorMessage}</p>
        )}
        {loadState === "ready" && errorMessage && (
          <p className="status error">保存できませんでした: {errorMessage}</p>
        )}
        {loadState === "ready" && !activeNote && archivedNotes.length === 0 && (
          <p className="empty">まだメモはありません。最初の走り書きを追加してください。</p>
        )}
        {loadState === "ready" && archivedNotes.length > 0 && (
          <section className="archive-section" aria-label="アーカイブ">
            <button
              type="button"
              className="archive-toggle"
              onClick={() => setShowArchive((currentValue) => !currentValue)}
            >
              {showArchive ? "アーカイブを隠す" : "アーカイブを表示"}
            </button>

            {showArchive && (
              <ol className="note-stream" aria-label="アーカイブされたメモ">
                {archivedNotes.map((note) => (
                  <li key={note.id} className="note-item archived-note">
                    <p>{note.body}</p>
                    <footer>
                      <time dateTime={new Date(note.updatedAt).toISOString()}>
                        {dateFormatter.format(note.updatedAt)}
                      </time>
                    </footer>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </section>
    </main>
  );
}

export default App;
