# TaskTracker Home Assistant Integration

Custom HA integration (domain `tasktracker`, `custom_components/tasktracker/`)
for the TaskTracker backend in the sibling `tasktracker-server` repo. Talks to
the unified `/api/v2/` API over HTTP with a household-scoped API key in the
`X-API-Key` header; endpoint bases are defined in
`custom_components/tasktracker/const.py`. Every request acts on behalf of a
household member (`acting_user`); `api.py` injects the per-call username or
falls back to the first mapped user, and re-wraps v2's flat payloads into the
legacy `{success, data, spoken_response}` envelope that service handlers,
cards, and events consume (see the `api.py` module docstring).

## Local development

Full workflow in [CONTRIBUTING.md](./CONTRIBUTING.md). Short version:

- `scripts/develop` — runs Home Assistant via `compose.yaml` (official
  container image, pinned tag) with the integration bind-mounted; UI at
  http://localhost:8123. Do not run `hass` directly — the Core/venv install
  method is deprecated.
- `scripts/restart` — required after editing integration Python code
  (config-entry reload does not reload modules).
- The backend must run first (`docker compose -f docker-compose.dev.yml up -d`
  in `tasktracker-server`) and is reached from inside the HA container as
  `http://host.docker.internal:8000` — never `localhost`.
- HA config lives in `config/` (a real dev instance; its `.storage/` holds the
  configured TaskTracker entry — don't commit or casually edit it).

## Tests and lint

- `scripts/setup` creates `.venv` (uv, Python version pinned in the script).
  Never install deps globally or hand-roll the venv.
- Python tests: `.venv/bin/python run_tests.py` (wraps pytest + coverage).
- JS card tests: `npm test`. Lint: `scripts/lint` (ruff).

## Version coupling — bump together

1. HA image tag in `compose.yaml`
2. `pytest-homeassistant-custom-component` in `requirements-test.txt`
   (its versions track HA releases)
3. Python version in `scripts/setup` (tracks that package's requires-python)

