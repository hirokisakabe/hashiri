# Hashiri

Hashiri is a web note app concept built around one uninterrupted stream of running notes.

This repository contains the first local-only web app slice for a single active note stream.

The product concept, MVP scope, and non-goals are defined in [docs/product-concept.md](docs/product-concept.md).

## Development

```sh
npm install
npm run dev
```

Node.js `^20.19.0 || >=22.12.0` is required by the Vite toolchain.

The app stores notes in the browser's IndexedDB for the current browser profile.
