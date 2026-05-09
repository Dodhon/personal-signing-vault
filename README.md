# Personal Signing Vault

Local-first personal software for signing the first page of a PDF and downloading a signed PDF plus an evidence certificate.

## MVP Scope

- Import a PDF.
- Add a typed or drawn signature.
- Place signature, name, date, and custom text fields on page 1.
- Export a flattened signed PDF.
- Generate a signing certificate with timestamps, document hashes, field coordinates, and a minimal action log.
- Keep the workflow local to the browser. Nothing is uploaded by the app.

## Run Locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Deploy to Cloudflare Pages

Use Cloudflare Pages with Git integration so each push can build and deploy automatically.

Cloudflare project settings:

- Framework preset: `React (Vite)`
- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `/`
- Environment variables: none required for the current MVP

Cloudflare should copy the static files in `public/` into `dist/` during the Vite build, including the `_headers` file used for basic security headers.

## Current Prototype

- React + Vite browser app.
- Local PDF preview with PDF.js.
- Multiple draggable field boxes for signature, date, printed name, and custom text.
- Requires a visible signature field before export.
- Local PDF export with pdf-lib.
- SHA-256 evidence hashes through Web Crypto.
- Sample waiver for testing the signing workflow.

## Non-Goals

- Multi-party routing.
- Multi-page signing.
- Remote signer identity proofing.
- Notarization.
- Encrypted vault storage.
- Regulated enterprise signing workflows.
- Replacing legal review for documents that require special execution formalities.

## Legal Note

This project is intended to help preserve evidence of intent, association with the signed record, and record retention. It does not guarantee that every recipient, jurisdiction, or document type will accept an electronic signature.
