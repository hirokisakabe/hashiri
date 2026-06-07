# Hashiri Product Concept

## Core Concept

Hashiri is a web note app for writing thoughts into one continuous stream.

It does not ask users to decide where a note belongs. There are no folders, tags, categories, notebooks, projects, spaces, or other grouping concepts. A note is either in the active stream or archived out of view.

The intended feeling is close to paper notes: write quickly, keep moving, and archive items when they no longer need attention.

## Product Constraints

Hashiri should make the desired workflow the only workflow.

- The app has one active note stream.
- New notes are added to the stream without choosing a destination.
- Archive is the primary way to remove notes from the active view.
- Search is not part of the first MVP. If added later, it can help recover old notes but must not become an organizing structure.
- The interface must not expose folders, tags, categories, notebooks, projects, spaces, or comparable organization features.

## MVP Operations

The MVP provides four core operations.

- Write: create a new note in the active stream.
- Edit: update the content of an existing active or archived note.
- Archive: move a note out of the active stream without deleting it.
- View archive: browse archived notes separately from the active stream.

Deletion, pinning, reminders, sharing, rich text, and sync are intentionally deferred unless they become necessary after the first usable version.

## Initial Storage

The first implementation should use IndexedDB only.

This keeps the MVP local-first, private by default, and small enough to build before adding account or server complexity. Login, cloud database storage, and cross-device sync are outside the first implementation.

Because IndexedDB is local to a browser profile on one device, the MVP does not guarantee that notes written on one device appear on another.

## Mobile Scope

Hashiri should be usable in mobile browsers from the first MVP, but only as a responsive single-device web app.

The initial mobile scope includes:

- writing notes from a phone browser,
- editing active or archived notes,
- archiving notes,
- viewing the archive.

The initial mobile scope excludes:

- account login,
- device-to-device sync,
- installable native iOS or Android apps,
- push notifications,
- conflict resolution for any future sync feature.

## Non-Goals

Hashiri should not add organization features that weaken the core constraint.

- No folders.
- No tags.
- No categories.
- No notebooks.
- No nested hierarchy.
- No project or workspace switcher.
- No automatic classification that becomes a hidden folder system.
- No cloud sync in the first MVP.
- No authentication in the first MVP.

## Future Considerations

Future versions may revisit sync, export, search, and backup, but only if they preserve the single-stream model and do not introduce user-managed organization structures.
