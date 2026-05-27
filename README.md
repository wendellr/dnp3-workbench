# DNP3 Master/Outstation Workbench

Web workbench for DNP3 IEEE 1815 experiments, training, and interoperability
tests. The application can create one or more DNP3 Masters, connect them to a
TCP outstation, poll points, view received data, and monitor runtime events.

The production target is:

```text
https://dnp3.ioda.com.br
```

## Current Reality

This project has three execution layers:

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React 18, Vite, Material UI | Browser UI for Masters, Outstations, logs, and traffic |
| Backend | FastAPI, WebSockets | API orchestration, session management, capabilities, UI data |
| Native runtime | C++ + OpenDNP3 | Real TCP Master runtime and demo TCP Outstation |

The real functional DNP3 path is the native OpenDNP3 runtime:

```bash
DNP3_ENGINE=native_opendnp3
```

The `pydnp3` path exists in the codebase as an isolated adapter/probe path, but
it is not the recommended production engine today. Keep production on
`native_opendnp3`.

## Feature Status

| Feature | Status |
|---------|--------|
| Multiple Masters, up to 50 | Implemented |
| TCP Master using OpenDNP3 | Implemented |
| Master connection state detection | Implemented |
| Master detects stopped/offline outstation | Implemented |
| Automatic integrity polling | Implemented using configured interval |
| Reconnect grace window before error state | Implemented |
| Integrity poll | Implemented for native TCP |
| Class 1/2/3 poll buttons | Mapped to integrity poll in native runtime |
| Data point table | Implemented |
| Master traffic tab | Implemented as runtime/application events, not raw DNP3 frame capture |
| Global Traffic module | Implemented as operational overview |
| Master log tab | Implemented |
| Settings module | Implemented as server capability/status view |
| Demo TCP Outstation | Implemented in native runtime |
| Configurable demo outstation points | Implemented |
| Public production outstation management restriction | Implemented via server capabilities |
| Point controls from native Master | Not implemented yet |
| Time sync/restart in native runtime | Not implemented yet |
| Serial/UDP native transport | Not implemented yet |
| Raw OpenDNP3 communication frame capture | Not implemented yet |
| Authentication/admin roles | Not implemented yet |
| Persistent database | Not implemented yet |

## Repository Layout

```text
.
├── backend/
│   ├── app/
│   │   ├── api/routes.py
│   │   ├── core/config.py
│   │   ├── models/
│   │   ├── schemas/
│   │   └── services/
│   ├── requirements.txt
│   └── scripts/probe_pydnp3.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── services/api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
├── services/dnp3-master-runtime/
│   ├── src/
│   ├── CMakeLists.txt
│   └── Dockerfile
├── docker/
│   ├── Dockerfile.backend
│   ├── Dockerfile.backend.prod
│   ├── Dockerfile.frontend
│   ├── Dockerfile.frontend.prod
│   └── nginx.frontend.conf
├── docker-compose.yml
├── docker-compose.portainer.yml
└── .env.production.example
```

## Development Start

For local development with the simulated backend engine:

```bash
docker compose up -d --build
```

Open:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:8000
Docs:     http://localhost:8000/docs
```

For local development with the native OpenDNP3 runtime:

```bash
DNP3_ENGINE=native_opendnp3 \
DNP3_MASTER_RUNTIME_BUILD_ENABLE_OPENDNP3=ON \
docker compose --profile dnp3-master-runtime up -d --build
```

In this mode the runtime service exposes its internal HTTP API on port `21200`
by default.

## Production Deploy With Portainer

Use this repository in Portainer as a Git-backed Stack:

```text
Repository URL: https://github.com/wendellr/dnp3-workbench.git
Reference: main
Compose path: docker-compose.portainer.yml
```

Do not use `docker-compose.yml` for the public Portainer deployment. That file
is for local development and publishes backend port `8000` by default. The
production file publishes only the frontend Nginx port.

Set these environment variables in the Portainer stack:

```bash
APP_ENV=production
APP_VERSION=1.0.0
DNP3_ENGINE=native_opendnp3
DNP3_MASTER_RUNTIME_BUILD_ENABLE_OPENDNP3=ON
DNP3_MASTER_RUNTIME_BASE_URL=http://dnp3-master-runtime:21200
ENABLE_DEMO_OUTSTATION=true
ENABLE_PUBLIC_OUTSTATION_MANAGEMENT=false
CORS_ORIGINS=["https://dnp3.ioda.com.br"]
FRONTEND_HTTP_PORT=8080
```

The production compose publishes only the frontend container to the host. The
frontend container runs Nginx, serves the React build, and proxies `/api` and
WebSocket traffic to the backend inside the Docker network.

Point the server Nginx upstream to:

```text
http://127.0.0.1:8080
```

Minimal Nginx reverse proxy block:

```nginx
server {
    server_name dnp3.ioda.com.br;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Use Certbot, your Nginx manager, or the server's existing SSL process to attach
HTTPS to `dnp3.ioda.com.br`.

## Production Security Posture

Production is intentionally conservative:

```bash
ENABLE_PUBLIC_OUTSTATION_MANAGEMENT=false
```

With this setting:

- the Outstations module is hidden/restricted in the public UI;
- anonymous users cannot start, stop, or edit the demo outstation;
- Master creation and configuration remain available;
- the DNP3 runtime HTTP service stays internal to the Docker network.

Do not publish the native runtime HTTP port (`21200`) directly on a public
interface in production. If a public DNP3 TCP outstation is ever enabled, expose
only the required DNP3 TCP port and protect it with firewall rules and logging.

## Server Capabilities

The frontend reads:

```text
GET /api/capabilities
```

This endpoint tells the UI which modules are available in the current
environment. It is the source of truth for hiding/restricting Outstations in
production.

Example response fields:

```json
{
  "app_env": "production",
  "dnp3_engine": "native_opendnp3",
  "demo_outstation_available": true,
  "public_outstation_management": false,
  "max_masters": 50,
  "modules": {
    "masters": true,
    "outstations": false,
    "traffic": true,
    "settings": true
  }
}
```

## Operator Workflow

1. Open the web UI.
2. Create a Master in the Masters module.
3. Configure TCP host, port, Master address, and Outstation address.
4. Click Connect.
5. Run an Integrity Poll.
6. Inspect Data Points, Traffic, and Log tabs.

While connected, the backend runs automatic integrity polls using the configured
Integrity Poll Interval. The minimum effective interval is 5 seconds.

If the target outstation stops or the TCP channel closes, the backend first
marks the Master as `connecting` and gives OpenDNP3 a reconnect grace window. If
the channel reopens, the Master returns to `connected`; if it remains closed,
the Master moves to `error`. The frontend refreshes the Master list
periodically, so state changes appear without a manual page reload.

## Demo Outstation Workflow

In development or authenticated lab deployments, public outstation management
can be enabled:

```bash
ENABLE_PUBLIC_OUTSTATION_MANAGEMENT=true
```

The Outstations module can then:

- start and stop a demo TCP outstation;
- configure DNP3 point type, index, class, value, quality, and metadata;
- update point values while running;
- add/remove points while stopped.

The OpenDNP3 database is created when the outstation starts. Changing point
type/index/class/variation or adding/removing points requires stopping and
starting the demo outstation.

Supported configurable demo point families:

- Binary Input
- Double-bit Binary Input
- Binary Output Status
- Counter
- Frozen Counter
- Analog Input
- Analog Output Status

## Backend API

Preferred namespace for current code:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/capabilities` | Server feature flags for the UI |
| GET | `/api/masters` | List Masters |
| POST | `/api/masters` | Create Master |
| GET | `/api/masters/{id}` | Read Master |
| PUT | `/api/masters/{id}/config` | Update Master config |
| DELETE | `/api/masters/{id}` | Delete Master |
| POST | `/api/masters/{id}/connect` | Connect Master |
| POST | `/api/masters/{id}/disconnect` | Disconnect Master |
| POST | `/api/masters/{id}/commands/station` | Poll/time/restart command endpoint |
| POST | `/api/masters/{id}/commands/point` | Point command endpoint |
| GET | `/api/masters/{id}/datapoints` | Cached point data |
| WS | `/api/masters/{id}/traffic` | Traffic/runtime event stream |
| WS | `/api/masters/{id}/logs` | Log stream |
| WS | `/api/masters/{id}/data` | Data update stream |
| GET | `/api/dnp3/groups` | DNP3 group reference |
| GET | `/api/master-runtime/health` | Native runtime health |
| GET | `/api/master-runtime/runtime` | Native runtime build/runtime status |

Legacy `/api/clients` endpoints still exist as aliases for older UI/code paths,
but new work should use `/api/masters`.

Demo outstation proxy endpoints:

| Method | Endpoint | Public Production Behavior |
|--------|----------|----------------------------|
| GET | `/api/demo-outstation/status` | Allowed if demo outstation is enabled |
| GET | `/api/demo-outstation/points` | Allowed if demo outstation is enabled |
| POST | `/api/demo-outstation/start` | `403` when public management is disabled |
| POST | `/api/demo-outstation/update` | `403` when public management is disabled |
| POST | `/api/demo-outstation/stop` | `403` when public management is disabled |
| POST | `/api/demo-outstation/points` | `403` when public management is disabled |
| PUT | `/api/demo-outstation/points/{id}` | `403` when public management is disabled |
| DELETE | `/api/demo-outstation/points/{id}` | `403` when public management is disabled |

## Native Runtime API

The C++ runtime is an internal service. FastAPI talks to it over HTTP.

Important runtime endpoints:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/health` | Runtime health |
| GET | `/runtime` | Runtime mode and OpenDNP3 build status |
| GET | `/masters` | List native Master sessions |
| POST | `/masters` | Create native Master session |
| GET | `/masters/{id}` | Master status snapshot |
| POST | `/masters/{id}/connect` | Open TCP channel |
| POST | `/masters/{id}/disconnect` | Close session |
| POST | `/masters/{id}/poll/integrity` | Queue integrity scan |
| GET | `/masters/{id}/points` | Read cached points |
| GET | `/masters/{id}/events` | Read runtime events |
| GET | `/demo-outstation/status` | Demo outstation status |
| POST | `/demo-outstation/start` | Start demo outstation |
| POST | `/demo-outstation/stop` | Stop demo outstation |
| GET/POST/PUT/DELETE | `/demo-outstation/points` | Manage demo points |

## Configuration Reference

| Variable | Default | Notes |
|----------|---------|-------|
| `APP_ENV` | `development` | Use `production` in Portainer |
| `APP_VERSION` | `1.0.0` | Version shown by API/config |
| `DNP3_ENGINE` | `simulated` in dev, `native_opendnp3` in production compose | Selects backend DNP3 session engine |
| `DNP3_MASTER_RUNTIME_BASE_URL` | `http://dnp3-master-runtime:21200` | Backend to runtime URL |
| `DNP3_MASTER_RUNTIME_BUILD_ENABLE_OPENDNP3` | `OFF` in dev compose, `ON` in production compose | Builds runtime with OpenDNP3 |
| `ENABLE_DEMO_OUTSTATION` | `true` | Enables demo outstation API/status |
| `ENABLE_PUBLIC_OUTSTATION_MANAGEMENT` | `true` in dev, `false` in production | Controls public start/stop/edit actions |
| `CORS_ORIGINS` | local dev origins | Use JSON list syntax, e.g. `["https://dnp3.ioda.com.br"]` |
| `FRONTEND_HTTP_PORT` | `8080` in production example | Host port for frontend Nginx |
| `BACKEND_HTTP_PORT` | `8000` in development compose only | Change only if using `docker-compose.yml` locally and port `8000` is occupied |
| `FRONTEND_DEV_PORT` | `5173` in development compose only | Change only if using `docker-compose.yml` locally and port `5173` is occupied |

## Health Checks And Diagnostics

Useful URLs after deployment:

```text
https://dnp3.ioda.com.br/
https://dnp3.ioda.com.br/health
https://dnp3.ioda.com.br/api/capabilities
https://dnp3.ioda.com.br/api/master-runtime/health
https://dnp3.ioda.com.br/api/master-runtime/runtime
```

Useful Portainer/container checks:

```bash
docker compose -f docker-compose.portainer.yml config
docker compose -f docker-compose.portainer.yml logs --tail=120 backend
docker compose -f docker-compose.portainer.yml logs --tail=120 frontend
docker compose -f docker-compose.portainer.yml logs --tail=120 dnp3-master-runtime
```

## Development Without Docker

Backend:

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server proxies `/api` to `http://backend:8000` when running
inside Docker. For non-Docker local development, set `VITE_API_URL` as needed.

## PyDNP3 Notes

The repository includes:

```bash
backend/scripts/probe_pydnp3.py
backend/app/services/pydnp3_engine.py
```

Use the probe only to check whether a target Python/container can import a
PyDNP3 package:

```bash
cd backend
python scripts/probe_pydnp3.py
```

Current recommendation:

- prefer `native_opendnp3` for functional Master/Outstation work;
- treat `pydnp3` as experimental until package availability and runtime behavior
  are validated in the target environment;
- do not deploy production with `DNP3_ENGINE=pydnp3` unless that path has been
  separately tested end to end.

## Known Limitations

- No authentication or admin role system yet.
- No database persistence yet; runtime/session state is in memory.
- Public production Outstation management should remain disabled.
- Traffic monitor is not raw OpenDNP3 frame capture yet.
- Native point controls, time sync, cold restart, and warm restart are pending.
- Native serial and UDP transports are pending.
- File transfer and device attributes are pending.

## Credits

Developed by Prof. Wendell Rodrigues, Ph.D. in collaboration with OpenAI Codex.
Inspired by FreyrSCADA.com. Uses OpenDNP3 in the native runtime and keeps a
PyDNP3 investigation path for future compatibility work.
