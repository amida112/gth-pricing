# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # Install dependencies
npm start         # Dev server at http://localhost:3000
npm run build     # Production build
```

No test suite is configured.

## Architecture

This is a single-page React 18 app (Create React App) for managing wood pricing at GTH. All UI components live in one file: `src/App.js`. The backend is a Google Apps Script web app accessed via `src/api.js`.

### Data model

Prices are stored in a flat object keyed by a composite string built by `bpk(woodId, attrs)`:
```
"walnut||quality:Fas||thickness:2F"  →  { price: 18.5, updated: "2026-03-11" }
```
Attributes in the key are always sorted alphabetically. This key format is used throughout for all price lookups and updates.

### State (managed in `App`)

| State | Description |
|-------|-------------|
| `wts` | Wood types array (id, name, nameEn, icon) |
| `ats` | Attribute definitions (id, name, values[], groupable) |
| `cfg` | Per-wood config — which attrs to use and their allowed values |
| `prices` | Flat price map keyed by `bpk()` |
| `logs` | Local change history (not persisted to API) |
| `useAPI` | Whether Google Sheet API loaded successfully |

On mount, `App` attempts to load all data from the Google Apps Script API (`loadAllData()`). If it fails, hardcoded data from `initWT()`, `initAT()`, `initCFG()`, and `genPrices()` is used — the app works fully offline with sample data.

### Key components

- **`Matrix`** — renders the price grid table. Splits wood attributes into row-attrs and header-attrs (configurable by user per session). Handles cell grouping when `ug` (group thickness) is on.
- **`ECell`** — individual editable price cell. Click to edit (admin only), Enter/blur to commit.
- **`RDlg`** — confirmation dialog requiring a reason before any price change is saved.
- **`autoGrp`** — groups consecutive thickness values that share identical pricing across all other attribute combinations, to reduce table rows.
- **`PgPrice`** — main pricing page: wood selector, axis-layout controls, Matrix, and change log.
- **`PgWT`** — CRUD for wood types.
- **`PgSKU`** — read-only listing of all SKU combinations with their prices.

### Roles

Toggled in the sidebar. `role === "admin"` enables inline cell editing and wood type management (`ce` prop threaded through components). There is no authentication — role is local UI state only.

### API (`src/api.js`)

All calls go to a single Google Apps Script URL (`API_URL`). GET requests use `?action=...` query params; POST requests send JSON body with an `action` field. Price updates are fire-and-forget — the UI updates optimistically before the API call completes.

To point to a different backend, change `API_URL` in `src/api.js`.
