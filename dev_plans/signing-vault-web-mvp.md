# Personal Signing Vault Web MVP Plan

Plan level: L1

## Executive Summary

Objective: build the first usable web app for Personal Signing Vault on `feature/signing-vault-mvp`. The app should let a human signer import a PDF, capture a signature, place visible signature/name/date marks on the first page, export a signed PDF, and produce an evidence certificate with document hashes.

## Constraints

- Runtime/environment: local browser app built with React + Vite; no server required for v1.
- Budget/cost: no paid services.
- Security/compliance: no secrets, no cloud document upload, no claim that the app guarantees enforceability.
- Performance: typical waiver PDFs should load and export interactively in a modern desktop browser.
- Tooling/dependency: use npm, Vite, React, TypeScript, PDF.js for preview rendering, pdf-lib for PDF mutation, and Web Crypto for SHA-256 hashing.
- Timeline: same-day MVP scaffold and browser-validated prototype.

## Assumptions

- v1 handles self-signing only.
- v1 signs the first PDF page only.
- v1 stores no uploaded PDF or signature material in git.
- Browser-local execution is acceptable for the first prototype.

## Current Repo State

- `README.md` defines initial scope and non-goals.
- `.gitignore` excludes local document/signature material and PDFs.
- No app scaffold exists yet.
- Current branch: `feature/signing-vault-mvp`.

## Plan Lifecycle Status

- Status: implemented and pushed.
- Working branch: `feature/signing-vault-mvp`.
- Merge target: `main`.
- PR URL: pending.
- Evidence: `npm run build`, `npm audit --json`, Playwright typed-signature browser journey against `http://127.0.0.1:5173/`, and follow-up Playwright drawn-signature browser journey verifying visible drawn preview plus `signatureMode: "draw"` certificate export.
- Browser artifacts: desktop and mobile screenshots reviewed from `/tmp/personal-signing-vault-qa/`.

## Domains

Frontend/UI/UX, E2E/browser validation, GitHub branch workflow.

## Skill Hooks

- `$intent-dev-work-router`: triggered by "make the website" implementation request.
- `$frontend-app-builder`: triggered by new web app build.
- `$frontend-design`: triggered by production-grade interface requirement.
- `$planning`: triggered by non-trivial implementation and explicit FR/NFR requirement.

## Intended Operator Contract

- Operator class: dual.
- Agent subtype: browser app acting as a local signing assistant.
- Primary interface: web UI.
- Output contract: signed PDF download, JSON certificate download, visible evidence metadata in UI.
- Failure/retry behavior: empty upload state, disabled exports until required inputs exist, visible error messages for PDF load/sign/export failures, reset by reloading or choosing a new file.
- Role-specific validation: browser journey imports a sample PDF, captures/places signature, exports evidence state; shell validation runs install/build.

## Functional Requirements

- FR1: Import a PDF from local disk.
- FR2: Render the first page preview.
- FR3: Capture a drawn signature or typed signature.
- FR4: Place signature, signer name, and date marks on the preview.
- FR5: Export a flattened signed PDF.
- FR6: Generate a JSON certificate with original hash, signed hash, timestamp, signer name, page number, and placement coordinates.
- FR7: Keep the primary workflow usable from the first screen.

## Non-Functional Requirements

- NFR1: Do not upload documents or signatures anywhere.
- NFR2: Keep document/signature artifacts out of git.
- NFR3: Avoid legal overclaims in UI copy.
- NFR4: Use semantic controls, visible focus states, and responsive layout.
- NFR5: Follow repo-local ignore rules and npm build validation.

## Non-Goals

- Multi-party routing.
- Remote identity proofing.
- Notarization.
- Cloud vault sync.
- Multi-page signing.
- Enterprise audit/compliance workflow.

## Architecture

```text
Browser UI
  |-- PDF upload input
  |-- PDF.js preview canvas
  |-- signature capture canvas / typed signature
  |-- placement state
  |-- Web Crypto SHA-256
  '-- pdf-lib export
        |-- signed PDF Blob
        '-- certificate JSON Blob
```

## Implementation Tasks

- E1: Add Vite + React + TypeScript scaffold.
- E2: Build app shell: workflow rail, PDF workspace, inspector, status/action bar.
- E3: Implement PDF upload, first-page preview, and original SHA-256 hash.
- E4: Implement signature capture, typed fallback, and draggable placement.
- E5: Implement signed PDF export via pdf-lib and signed hash computation.
- E6: Implement certificate JSON export and copy-safe UI evidence panel.
- E7: Add responsive styling and accessible empty/error/disabled states.

## Validation

- V1: `npm install`
- V2: `npm run build`
- V3: Start local dev server and open app.
- V4: Browser journey: load app, upload generated sample PDF, draw/type signature, move placement, export signed PDF, verify certificate data updates.
- V5: Desktop and mobile viewport screenshots show no clipped primary controls or unreadable text.

## Rollback

- Undo by reverting the implementation commit on `feature/signing-vault-mvp`.
- If needed before commit, remove `package*.json`, `index.html`, `tsconfig*.json`, `vite.config.ts`, `src/`, and `dev_plans/signing-vault-web-mvp.md`, then run `git status`.

## Evidence Links

- Vite guide: https://vite.dev/guide/
- PDF.js examples: https://mozilla.github.io/pdf.js/examples/
- pdf-lib API docs: https://pdf-lib.js.org/docs/api/classes/pdfdocument
- MDN Web Crypto `SubtleCrypto.digest`: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest

## Ready for Execution

- [x] Product frame exists from prior step.
- [x] Branch exists and is synced.
- [x] FR/NFR and validation are explicit.
- [x] Scope is bounded to local-first self-signing MVP.
