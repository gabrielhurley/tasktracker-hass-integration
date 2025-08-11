# TaskTracker Web Utils

Modular utilities used by the TaskTracker Home Assistant cards. These replace functionality that previously lived in `tasktracker-utils.js` and are organized to avoid circular dependencies and keep files small and focused.

## Structure

- `index.js` – Barrel re-exports for convenience
- `datetime-utils.js` – Centralized `TaskTrackerDateTime` utilities (logical day, overdue, formatting)
- `users.js` – User discovery/mapping helpers
- `toast.js` – Global success/error toasts (ensures global styles)
- `formatters.js` – Display formatters (dates, durations, priorities, labels, capitalize)
- `events.js` – HA event bus helpers and safe cleanup wrappers
- `actions.js` – Service calls for tasks/completions/leftovers with consistent error handling
- `visuals.js` – Task status visual helpers (border color/style)
- `config-editor.js` – Config editor HTML helpers and shared styles
- `arrays.js` – Small generic helpers
- `styles-bridge.js` – Bridge to shared card styles (`getCommonCardStyles()`)
- `timers.js` – Auto-refresh helpers
- `daily-state.js` – Fetch/save daily state primitives
- `ui/` – UI building blocks and modals
  - `components.js` – `createStyledButton`, `showModal` (dedupes modals and ensures styles)
  - `task-modal.js` – Task details/completion modal (save, edit, snooze, past completion)
  - `completion-edit-modal.js` – Completion edit modal (undo/update)
  - `daily-state-modal.js` – Daily state modal using `TaskTrackerDailyStateUI`

## Layering rules (enforced by `.eslintrc.json`)

- Non-UI modules must not import from `ui/`
- UI modules must not import `utils/actions.js` directly
- Keep modules cohesive and under ~500 lines
- Avoid circular dependencies

## Error handling

- Service/action errors should use helpers from `utils/error-handling.js` (and show user feedback via `utils/toast.js`)
- UI modals should ensure global styles via `TaskTrackerStyles.ensureGlobal()` before appending to `document.body`

## Notes

- Prefer centralized `TaskTrackerDateTime` utilities for all date/time logic (logical day, overdue, formatting)
- To open modals reliably, call `showModal(modal)` from `ui/components.js` to ensure only one modal is present and styles are applied
 - Daily State presets include a "Sick" option that toggles `is_sick: true` and sets conservative axes for rest-oriented recommendations
