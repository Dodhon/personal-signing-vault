# Multiple Signing Fields Plan

Plan level: L1

## Executive Summary

Objective: extend Personal Signing Vault from one combined signature placement into multiple independent document boxes. A human signer should be able to add, select, drag, remove, and export signature, date, printed-name, and custom text boxes on the PDF preview while preserving the local-first signing/evidence model.

## Constraints

- Runtime/environment: React + Vite + TypeScript browser app; local dev server already runs at `http://127.0.0.1:5173/`.
- Budget/cost: no paid services.
- Security/compliance: no document/signature uploads; no new credentials; no legal-enforceability overclaims.
- Performance: field operations should stay immediate for first-page PDFs.
- Tooling/dependency: keep existing `pdfjs-dist`, `pdf-lib`, Web Crypto, and npm scripts; no new dependency needed.
- Timeline: same-turn implementation and push.

## Assumptions

- v1 still signs only page 1.
- Field resizing can wait; this pass focuses on adding, selecting, dragging, deleting, and exporting multiple boxes.
- Signature field content is supplied by the existing draw/type signature controls.
- Printed-name/date fields derive from signer name and today's date; custom text fields use a local editable value.

## Current Repo State

- `src/App.tsx` owns document state, one `placement`, one draggable `.signature-box`, and PDF export drawing signature/name/date from that single placement.
- `src/styles.css` styles the one signature box and inspector controls.
- `README.md` already names placing signature, name, and date fields as initial scope.
- Existing untracked `demo-artifacts/` are local proof artifacts and should remain untracked.

## Plan Lifecycle Status

- Status: implemented and validated.
- Working branch: `feature/signing-vault-mvp`.
- Merge target: `main`.
- PR URL: pending.
- Merge commit: pending.
- Evidence: `npm run build`; Browser/IAB reload confirmed updated controls; Playwright journey loaded sample PDF, added text/date fields, drew a signature, dragged a text field, exported the signed PDF, downloaded certificate JSON, verified five fields and 64-character hashes, and logged no browser console/page errors.

## Domains

Frontend/UI/UX, E2E/browser validation, GitHub branch workflow.

## Skill Hooks

- `$intent-dev-work-router`: triggered by the feature implementation request.
- `$frontend-design`: triggered by building web UI controls.
- `$planning`: triggered by the non-trivial stateful UI/export change.
- `$github-cli-workflow`: triggered by the explicit GitHub push request.

## Intended Operator Contract

- Operator class: dual.
- Agent subtype: browser/computer-use agent for validation; human signer for real use.
- Primary interface: web UI.
- Output contract: signed PDF and JSON certificate containing a normalized `fields[]` evidence list.
- Failure/retry behavior: export disabled until a PDF exists, at least one field exists, and required signature/text inputs are present; failed PDF operations display existing status/error affordances.
- Role-specific validation: shell build plus browser journey that adds multiple fields, drags one, exports, and verifies certificate metadata.

## Functional Requirements

- FR1: Add field boxes for signature, date, printed name, and custom text.
- FR2: Select any field and display its properties in the inspector.
- FR3: Drag each field independently on the first-page preview.
- FR4: Remove a selected field.
- FR5: Export all placed fields into the flattened signed PDF.
- FR6: Include all exported fields in the certificate JSON with type, label, value preview, page number, and placement.

## Non-Functional Requirements

- NFR1: Preserve local-only execution and existing no-upload posture.
- NFR2: Keep UI dense, operational, and consistent with the existing app shell.
- NFR3: Keep generated demo artifacts out of git.
- NFR4: Preserve TypeScript build validation.
- NFR5: Push only source/docs changes to GitHub after validation.

## Non-Goals

- Multi-page field placement.
- Field resizing.
- Multi-party routing.
- Remote identity proofing.
- Cloud storage or deployment.

## Success Metrics

- A sample signing session can export at least four independent fields: signature, printed name, date, and custom text.
- Certificate JSON contains a `fields` array with at least four entries and 64-character original/signed hashes.
- `npm run build` passes.
- Branch sync proof returns `0 0` after push.

## Architecture

```text
fieldDefinitions[]
  |-- preview overlay maps field -> draggable box
  |-- inspector maps active field -> controls/remove
  '-- export maps field -> pdf-lib draw operation + certificate fields[]
```

## Implementation Tasks

- E1: Add field types, defaults, helper functions, active field state, and content validation.
- E2: Replace single preview signature box with mapped draggable field boxes.
- E3: Add field add/remove/property controls in the inspector.
- E4: Update PDF export and certificate schema to iterate over fields.
- E5: Update CSS for field palette, selected field, field list, and compact controls.
- E6: Build, browser-test, commit, push, and verify branch sync.

## Validation

- V1: `npm run build` passed.
- V2: Browser/IAB check at `http://127.0.0.1:5173/` after reload confirmed updated controls were visible.
- V3: Playwright E2E journey loaded sample, added text/date fields, drew signature, dragged a field, exported signed PDF, and downloaded certificate.
- V4: Certificate JSON contained five fields including `signature`, `date`, `printedName`, and `text`; original/signed hashes were 64 characters; no console/page errors.
- V5: `git rev-list --left-right --count origin/feature/signing-vault-mvp...feature/signing-vault-mvp` pending until push.

## Rollback

- Revert the feature commit on `feature/signing-vault-mvp` and push the revert.
- Before commit, restore changed files with a targeted reverse patch if validation fails.

## Top 10 Reader Questions

1. Does this support multiple boxes? Yes, fields are independent records.
2. Does it support signature/date/printed name? Yes.
3. Can users add other boxes? Yes, through custom text fields.
4. Can boxes be dragged? Yes, each field is draggable on page 1.
5. Can boxes be resized? Not in this pass.
6. Does export flatten all boxes? Yes.
7. Does the certificate record all boxes? Yes, via `fields[]`.
8. Does anything upload documents? No.
9. Does this alter the public repo? Only after validation and push.
10. Are demo artifacts pushed? No.

## Ready for Execution

- [x] Functional and non-functional requirements are explicit.
- [x] Scope remains first-page local self-signing.
- [x] No new external service or dependency is required.
