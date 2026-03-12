# Yishe Models Console

This project now contains a complete local model management skeleton inside `D:\workspace\yishe-models`.

## Project layout

- `examples/`: local capability demos such as image-to-text and voice clone.
- `tools/`: utility scripts such as GPU inspection.
- `services/node-api/`: Node.js business API for registry and orchestration.
- `services/python-runtime/`: Python runtime wrapper for local models.
- `frontend/`: independent web UI for model operations and API overview.

## Architecture

1. `frontend/` renders the standalone control panel.
2. `services/node-api/` exposes console APIs and forwards runtime actions.
3. `services/python-runtime/` owns local model lifecycle and adapters.

## Start

### 1. Python runtime

```bash
cd services/python-runtime
python server.py
```

Default address: `http://127.0.0.1:8001`

### 2. Node API

```bash
cd services/node-api
node server.js
```

Default address: `http://127.0.0.1:8787`

### 3. Frontend UI

```bash
cd frontend
python -m http.server 4173
```

Then open: `http://127.0.0.1:4173`

## Current scope

- Standalone UI independent from `yishe-admin`
- Model registry view
- Runtime/provider status view
- API catalog view
- Model start/stop actions
- Runtime sync action
- Mock fallback when Node API is offline

## Next step recommendation

1. Connect `services/python-runtime/server.py` to real local model scripts in `examples/`.
2. Add create/edit/delete model APIs in `services/node-api/`.
3. Add inference debugger, logs and GPU panels into `frontend/`.
4. Remove the temporary `yishe-admin` console files after migration is fully confirmed.
