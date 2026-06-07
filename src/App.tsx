import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  archiveNote,
  createNote,
  listNotes,
  resumeNote,
  updateNoteBody,
} from "./db";
import type { Note } from "./types";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

type LoadState = "loading" | "ready" | "error";
type SaveState = "saving" | "saved" | "error";

function clockOf(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

function startOfDay(timestamp: number) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function dayWord(timestamp: number) {
  const today = startOfDay(Date.now());
  const noteDay = startOfDay(timestamp);
  const diff = Math.round((today - noteDay) / DAY);

  if (diff <= 0) {
    return "Today";
  }
  if (diff === 1) {
    return "Yesterday";
  }
  if (diff < 7) {
    return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(timestamp);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
  }).format(timestamp);
}

function stamp(timestamp: number) {
  return `${dayWord(timestamp)} · ${clockOf(timestamp)}`;
}

function App() {
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [archivedNotes, setArchivedNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [fresh, setFresh] = useState(false);
  const latestRevisions = useRef<Record<string, number>>({});
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const draftRef = useRef("");
  const creatingDraft = useRef(false);

  const editorValue = activeNote?.body ?? draft;
  const editorTimestamp = activeNote?.updatedAt ?? Date.now();
  const hasContent = editorValue.trim().length > 0;

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

  useEffect(() => {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    editor.style.height = "auto";
    editor.style.height = `${editor.scrollHeight}px`;
  }, [editorValue]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setArchiveOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function focusEditor() {
    requestAnimationFrame(() => editorRef.current?.focus());
  }

  function flashFresh() {
    setFresh(true);
    window.setTimeout(() => setFresh(false), 420);
  }

  async function createActiveFromDraft(initialBody: string) {
    if (creatingDraft.current || !initialBody.trim()) {
      return;
    }

    creatingDraft.current = true;
    setSaveStates((currentStates) => ({ ...currentStates, draft: "saving" }));

    try {
      const created = await createNote(initialBody);
      latestRevisions.current[created.id] = created.revision;

      const latestBody = draftRef.current;
      let note = created;

      if (latestBody !== created.body) {
        const nextRevision = created.revision + 1;
        latestRevisions.current[created.id] = nextRevision;
        note = await updateNoteBody(created.id, latestBody, nextRevision);
      }

      setActiveNote(note);
      setDraft("");
      draftRef.current = "";
      setArchivedNotes((currentNotes) => currentNotes.filter((item) => item.id !== note.id));
      setSaveStates((currentStates) => ({
        ...currentStates,
        draft: "saved",
        [note.id]: "saved",
      }));
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setSaveStates((currentStates) => ({ ...currentStates, draft: "error" }));
    } finally {
      creatingDraft.current = false;
    }
  }

  function handleDraftChange(body: string) {
    setDraft(body);
    draftRef.current = body;

    if (body.trim()) {
      void createActiveFromDraft(body);
    }
  }

  async function handleEdit(noteId: string, body: string) {
    const nextRevision = (latestRevisions.current[noteId] ?? 0) + 1;
    latestRevisions.current[noteId] = nextRevision;

    setActiveNote((currentNote) =>
      currentNote?.id === noteId
        ? { ...currentNote, body, revision: nextRevision, updatedAt: Date.now() }
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

  async function handleNewNote() {
    if (!hasContent) {
      setDraft("");
      setActiveNote(null);
      flashFresh();
      focusEditor();
      return;
    }

    try {
      setErrorMessage("");

      if (activeNote) {
        const archived = await archiveNote(activeNote.id);
        setArchivedNotes((currentNotes) => [archived, ...currentNotes]);
      } else if (draft.trim()) {
        const note = await createNote(draft);
        const archived = await archiveNote(note.id);
        setArchivedNotes((currentNotes) => [archived, ...currentNotes]);
      }

      setActiveNote(null);
      setDraft("");
      draftRef.current = "";
      flashFresh();
      focusEditor();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  const handleResume = useCallback(
    async (noteId: string) => {
      try {
        setErrorMessage("");

        if (!activeNote && draft.trim()) {
          const note = await createNote(draft);
          await archiveNote(note.id);
          setDraft("");
          draftRef.current = "";
        }

        const resumed = await resumeNote(noteId);
        latestRevisions.current[resumed.id] = resumed.revision;
        const notes = await listNotes();
        setActiveNote(resumed);
        setArchivedNotes(notes.filter((note) => note.archived));
        setArchiveOpen(false);
        flashFresh();
        focusEditor();
      } catch (error: unknown) {
        setErrorMessage(error instanceof Error ? error.message : String(error));
      }
    },
    [activeNote, draft],
  );

  function handleEditorChange(body: string) {
    if (activeNote) {
      void handleEdit(activeNote.id, body);
      return;
    }

    handleDraftChange(body);
  }

  function handleEditorKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void handleNewNote();
    }
  }

  function saveLabel() {
    if (!activeNote) {
      return loadState === "loading" ? "loading" : "idle";
    }

    const saveState = saveStates[activeNote.id] ?? "saved";

    if (saveState === "saving") {
      return "saving";
    }
    if (saveState === "error") {
      return "save failed";
    }
    return "saved";
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand" aria-label="Hashiri">
          <span className="word">hashiri</span>
          <span className="kanji">走り</span>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={handleNewNote}
            title="Keep this note and start a new one (Command+Enter)"
          >
            <span className="plus" aria-hidden="true">
              +
            </span>
            New
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => setArchiveOpen(true)}
          >
            Archive <span className="count">{archivedNotes.length}</span>
          </button>
        </div>
      </header>

      <main className="stage">
        <section className={`sheet${fresh ? " fresh" : ""}`} aria-label="Current note">
          <div className="meta">
            <span className={`dot${hasContent ? "" : " idle"}`} aria-hidden="true" />
            <span>{stamp(editorTimestamp)}</span>
            <span className="save-state" aria-live="polite">
              {saveLabel()}
            </span>
          </div>
          <textarea
            ref={editorRef}
            className="editor"
            value={editorValue}
            rows={1}
            placeholder="Write a thought..."
            onChange={(event) => handleEditorChange(event.target.value)}
            onKeyDown={handleEditorKeyDown}
            autoFocus
          />
          {loadState === "error" && (
            <p className="status error">IndexedDB could not be opened: {errorMessage}</p>
          )}
          {loadState === "ready" && errorMessage && (
            <p className="status error">Could not save: {errorMessage}</p>
          )}
        </section>
      </main>

      <button
        type="button"
        className="backdrop"
        data-open={archiveOpen || undefined}
        aria-label="Close archive"
        hidden={!archiveOpen}
        onClick={() => setArchiveOpen(false)}
      />
      <aside
        className="panel"
        data-open={archiveOpen || undefined}
        aria-hidden={!archiveOpen}
        inert={!archiveOpen}
        aria-label="Archive"
      >
        <div className="panel-head">
          <div className="title">
            Archive<span className="count">{archivedNotes.length}</span>
          </div>
          <button type="button" className="close" onClick={() => setArchiveOpen(false)}>
            Close
          </button>
        </div>
        <div className="panel-body">
          {archivedNotes.length > 0 ? (
            archivedNotes.map((note) => (
              <button
                type="button"
                className="arc"
                key={note.id}
                onClick={() => void handleResume(note.id)}
              >
                <span className="time">
                  <span>{stamp(note.updatedAt)}</span>
                  <span className="resume">Resume -&gt;</span>
                </span>
                <span className="body">{note.body}</span>
              </button>
            ))
          ) : (
            <div className="panel-empty">
              <div className="mark">archive</div>
              <h3>Nothing kept yet.</h3>
              <p>
                When you start a new note, the one in front of you rests here -
                findable, never in the way.
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

export default App;
