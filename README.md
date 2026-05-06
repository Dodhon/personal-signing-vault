# Personal Signing Vault

Local-first personal software for signing PDFs and keeping a tamper-evident evidence bundle.

## Initial Scope

- Import a PDF.
- Add a typed, drawn, or saved signature.
- Place signature, name, and date fields.
- Export a flattened signed PDF.
- Generate a signing certificate with timestamps, document hashes, and action history.
- Store signed documents and certificate metadata in a local encrypted vault.

## Run Locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Current Prototype

- React + Vite browser app.
- Local PDF preview with PDF.js.
- Multiple draggable field boxes for signature, date, printed name, and custom text.
- Local PDF export with pdf-lib.
- SHA-256 evidence hashes through Web Crypto.
- Sample waiver for testing the signing workflow.

## Non-Goals

- Multi-party routing.
- Remote signer identity proofing.
- Notarization.
- Regulated enterprise signing workflows.
- Replacing legal review for documents that require special execution formalities.

## Legal Note

This project is intended to help preserve evidence of intent, association with the signed record, and record retention. It does not guarantee that every recipient, jurisdiction, or document type will accept an electronic signature.
