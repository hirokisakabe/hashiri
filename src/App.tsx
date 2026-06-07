import { FormEvent, useEffect, useMemo, useState } from "react";
import { createNote, listActiveNotes, updateNoteBody } from "./db";
import type { Note } from "./types";

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
});

type LoadState = "loading" | "ready" | "error";

function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const noteCountLabel = useMemo(() => `${notes.length} memo`, [notes.length]);

  useEffect(() => {
    let isMounted = true;

    listActiveNotes()
      .then((storedNotes) => {
        if (!isMounted) {
          return;
        }
        setNotes(storedNotes);
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

    const note = await createNote(body);
    setNotes((currentNotes) => [note, ...currentNotes]);
    setDraft("");
  }

  async function handleEdit(noteId: string, body: string) {
    setNotes((currentNotes) =>
      currentNotes.map((note) => (note.id === noteId ? { ...note, body } : note)),
    );
    setSavingIds((currentIds) => new Set(currentIds).add(noteId));

    try {
      const updated = await updateNoteBody(noteId, body);
      setNotes((currentNotes) =>
        currentNotes
          .map((note) => (note.id === noteId ? updated : note))
          .sort((first, second) => second.updatedAt - first.updatedAt),
      );
    } finally {
      setSavingIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(noteId);
        return nextIds;
      });
    }
  }

  return (
    <main className="app-shell">
      <section className="stream-panel" aria-labelledby="app-title">
        <header className="stream-header">
          <div>
            <p className="eyebrow">Hashiri</p>
            <h1 id="app-title">One running stream</h1>
          </div>
          <p className="counter" aria-live="polite">
            {noteCountLabel}
          </p>
        </header>

        <form className="composer" onSubmit={handleCreate}>
          <label htmlFor="new-note">新しいメモ</label>
          <textarea
            id="new-note"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="今の考えを書き足す"
            rows={4}
          />
          <div className="composer-actions">
            <p>保存先の選択はありません。</p>
            <button type="submit" disabled={!draft.trim()}>
              追加
            </button>
          </div>
        </form>

        {loadState === "loading" && <p className="status">読み込み中</p>}
        {loadState === "error" && (
          <p className="status error">IndexedDB を開けませんでした: {errorMessage}</p>
        )}
        {loadState === "ready" && notes.length === 0 && (
          <p className="empty">まだメモはありません。最初の走り書きを追加してください。</p>
        )}
        {loadState === "ready" && notes.length > 0 && (
          <ol className="note-stream" aria-label="アクティブストリーム">
            {notes.map((note) => (
              <li key={note.id} className="note-item">
                <textarea
                  aria-label="メモ本文"
                  value={note.body}
                  onChange={(event) => handleEdit(note.id, event.target.value)}
                  rows={Math.max(3, note.body.split("\n").length + 1)}
                />
                <footer>
                  <time dateTime={new Date(note.updatedAt).toISOString()}>
                    {dateFormatter.format(note.updatedAt)}
                  </time>
                  <span aria-live="polite">
                    {savingIds.has(note.id) ? "保存中" : "保存済み"}
                  </span>
                </footer>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

export default App;
