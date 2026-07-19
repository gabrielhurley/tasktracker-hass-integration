# Contribution guidelines

Contributing to this project should be as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features

## Github is used for everything

Github is used to host code, to track issues and feature requests, as well as accept pull requests.

Pull requests are the best way to propose changes to the codebase.

1. Fork the repo and create your branch from `main`.
2. If you've changed something, update the documentation.
3. Make sure your code lints (using `scripts/lint`).
4. Test you contribution.
5. Issue that pull request!

## Any contributions you make will be under the MIT Software License

In short, when you submit code changes, your submissions are understood to be under the same [MIT License](http://choosealicense.com/licenses/mit/) that covers the project. Feel free to contact the maintainers if that's a concern.

## Report bugs using Github's [issues](../../issues)

GitHub issues are used to track public bugs.
Report a bug by [opening a new issue](../../issues/new/choose); it's that easy!

## Write bug reports with detail, background, and sample code

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can.
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

People *love* thorough bug reports. I'm not even kidding.

## Local development

Local development runs Home Assistant with the official
[Home Assistant Container](https://www.home-assistant.io/installation/#advanced-installation-methods)
image via Docker Compose (see [`compose.yaml`](./compose.yaml)), with this
repo's `custom_components/tasktracker` bind-mounted into it. The old
bare-`hass` workflow relied on the Core (venv) installation method, which
Home Assistant deprecated in 2025.

### Prerequisites

- Docker Desktop (or another Docker Compose-capable runtime)
- [uv](https://docs.astral.sh/uv/) for the test/lint venv

### Running

1. Start the TaskTracker backend in `tasktracker-server`:

   ```sh
   docker compose -f docker-compose.dev.yml up -d
   ```

2. Start Home Assistant here:

   ```sh
   scripts/develop
   ```

   The UI is at <http://localhost:8123>, configured from the included
   [`configuration.yaml`](./config/configuration.yaml) with debug logging for
   `custom_components.tasktracker`.

3. Point the TaskTracker integration at the backend. From inside the
   container the backend is `http://host.docker.internal:8000` — set this as
   the Host in the integration's options (Settings → Devices & Services →
   TaskTracker → Configure). `localhost` will not resolve to your machine
   from inside the container.

After changing integration Python code, run `scripts/restart` — reloading the
config entry from the UI does not reload Python modules.

For step-through debugging, uncomment the `debugpy:` block in
`config/configuration.yaml` and the `5678` port mapping in `compose.yaml`,
restart, and attach VS Code to `localhost:5678`.

### Tests and linting

`scripts/setup` creates `.venv` and installs test/lint dependencies. Then:

```sh
.venv/bin/python run_tests.py   # or: .venv/bin/python -m pytest
scripts/lint
```

The pinned `pytest-homeassistant-custom-component` version tracks the HA
release pinned in `compose.yaml`; bump them together. Its `requires-python`
also tracks HA (2026.7 → Python 3.14), so `scripts/setup` pins the venv
Python — keep that in sync too.

### Troubleshooting

- **`scripts/setup` can't resolve dependencies / installs an alpha Python**:
  your uv is too old to know the required Python release. Run
  `uv self update`, delete `.venv`, and re-run `scripts/setup`.
- **Backend container fails with `No module named 'django'`**: the backend
  compose reuses a stale anonymous `/app/.venv` volume after image rebuilds.
  In `tasktracker-server` run
  `docker compose -f docker-compose.dev.yml up -d -V --force-recreate web`.
- **Integration logs `Cannot connect to host 127.0.0.1:8000`**: the config
  entry host must be `http://host.docker.internal:8000`, not
  `localhost`/`127.0.0.1` (see step 3 above).

## License

By contributing, you agree that your contributions will be licensed under its MIT License.
