# DNP3 Master/Outstation Workbench - Web Edition

Reconstructed web-based DNP3 IEEE 1815 Client/Master Simulator.

## Architecture

- **Frontend**: React 18 + Vite + Material UI
- **Backend**: Python 3.12 + FastAPI + WebSockets
- **Protocol**: DNP3 IEEE 1815 (simulated by default, native OpenDNP3 master runtime available)
- **Infrastructure**: Docker + Docker Compose

## UI Modules

- **Masters**: create and manage one or more DNP3 master sessions.
- **Outstations**: planned module for DNP3 outstation simulation/runtime.
- **Traffic**: planned consolidated protocol traffic view.
- **Settings**: planned global runtime and deployment configuration.

## Quick Start

```bash
# Clone and start
docker-compose up --build

# Access
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

## Features

| Feature | Status |
|---------|--------|
| Multiple masters (up to 50) | ✅ |
| Serial/TCP/UDP configuration modes | ✅ |
| Native OpenDNP3 TCP master runtime | ✅ |
| DNP3 Master/Outstation addressing | ✅ |
| Link/Application layer timeouts | ✅ |
| Integrity Poll (Class 0) | ✅ simulated / native TCP |
| Class 1/2/3 event polling | ✅ simulated |
| Data points table (BI, DBI, BO, Counter, AI, AO) | ✅ |
| Station commands (poll, time sync, restart) | ✅ simulated, partial native |
| Point commands (SBO, Direct Operate, CROB) | ✅ simulated |
| Analog Output commands | ✅ simulated |
| Unsolicited message enable/disable | ✅ |
| Traffic monitor (live hex frames) | ✅ |
| Event log viewer | ✅ |
| DNP3 CRC-16 calculation | ✅ |
| DNP3 frame construction | ✅ |
| File Transfer | 🔲 Planned |
| Device Attributes | 🔲 Planned |
| Frozen Counter/Analog commands | 🔲 Planned |
| Configuration persistence (file export/import) | 🔲 Planned |

## Project Structure

```
project-root/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ClientListPanel.jsx
│   │   │   ├── ClientWorkspace.jsx
│   │   │   └── tabs/
│   │   │       ├── CommConfigTab.jsx
│   │   │       ├── PollingConfigTab.jsx
│   │   │       ├── DataPointsTab.jsx
│   │   │       ├── StationCommandsTab.jsx
│   │   │       ├── PointCommandsTab.jsx
│   │   │       ├── TrafficMonitorTab.jsx
│   │   │       └── LogViewerTab.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes.py
│   │   ├── core/
│   │   │   └── config.py
│   │   ├── models/
│   │   │   └── client.py
│   │   ├── schemas/
│   │   │   └── client.py
│   │   ├── services/
│   │   │   ├── client_manager.py
│   │   │   └── dnp3_engine.py
│   │   └── main.py
│   └── requirements.txt
├── docker/
│   ├── Dockerfile.backend
│   └── Dockerfile.frontend
├── docker-compose.yml
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/clients | List all clients |
| POST | /api/clients | Create client |
| GET | /api/clients/{id} | Get client details |
| PUT | /api/clients/{id}/config | Update configuration |
| DELETE | /api/clients/{id} | Delete client |
| POST | /api/clients/{id}/connect | Connect to outstation |
| POST | /api/clients/{id}/disconnect | Disconnect |
| POST | /api/clients/{id}/commands/station | Station command |
| POST | /api/clients/{id}/commands/point | Point command |
| GET | /api/clients/{id}/datapoints | Get data points |
| WS | /api/clients/{id}/traffic | Live traffic stream |
| WS | /api/clients/{id}/logs | Live log stream |
| WS | /api/clients/{id}/data | Live data updates |

The preferred API namespace for new work is `/api/masters`, with equivalent
CRUD, connection, command, data point, and WebSocket endpoints for DNP3 master
sessions.

## DNP3 Groups Supported

- Group 1: Binary Input
- Group 2: Binary Input Event
- Group 3: Double-bit Binary Input
- Group 10: Binary Output
- Group 12: CROB (Control Relay Output Block)
- Group 20: Counter
- Group 21: Frozen Counter
- Group 30: Analog Input
- Group 31: Frozen Analog Input
- Group 40: Analog Output Status
- Group 41: Analog Output Block
- Group 50: Time and Date
- Group 60: Class Data (0, 1, 2, 3)
- Group 70: File Transfer
- Group 80: Internal Indications
- Group 110: Octet String
- Group 112: Virtual Terminal Output

## Development

```bash
# Backend only
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend only
cd frontend
npm install
npm run dev
```

## DNP3 Engine Mode

The backend defaults to the simulated engine:

```bash
DNP3_ENGINE=simulated
```

To use the native OpenDNP3-backed master runtime:

```bash
DNP3_ENGINE=native_opendnp3
DNP3_MASTER_RUNTIME_BASE_URL=http://dnp3-master-runtime:21200
```

The real PyDNP3 path is isolated behind:

```bash
DNP3_ENGINE=pydnp3
```

Before enabling the real engine, validate the package in the target Python/container:

```bash
cd backend
python scripts/probe_pydnp3.py
```

Current package notes:

- `dnp3-python` is the preferred modern package when a compatible wheel exists for the target platform.
- `pydnp3` is the legacy package and may require source builds with CMake/C++ tooling.
- The default Docker image remains `python:3.12-slim`; keep `DNP3_ENGINE=simulated` until the real binding imports successfully.

## Native DNP3 Master Runtime

The project now includes a native runtime at `services/dnp3-master-runtime`.
It follows the same direction used in ARGOSVIEW: keep DNP3 protocol work in a
native OpenDNP3-capable process and let FastAPI orchestrate it over HTTP.

Current runtime endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Runtime health |
| GET | /runtime | Runtime mode and OpenDNP3 build status |
| GET | /demo-outstation/status | Demo outstation status for end-to-end tests |
| POST | /demo-outstation/start | Start demo TCP outstation |
| POST | /demo-outstation/update | Change demo measurements |
| POST | /demo-outstation/stop | Stop demo outstation |
| GET | /demo-outstation/points | List configured demo outstation points |
| POST | /demo-outstation/points | Add a DNP3 point before start |
| PUT | /demo-outstation/points/{id} | Update point metadata before start or value while running |
| DELETE | /demo-outstation/points/{id} | Delete a DNP3 point before start |
| GET | /masters | List native master sessions |
| POST | /masters | Create a native master session |
| POST | /masters/{id}/connect | Connect OpenDNP3 TCP master session |
| POST | /masters/{id}/disconnect | Disconnect master session |
| POST | /masters/{id}/poll/integrity | Queue Class 0/1/2/3 scan |
| GET | /masters/{id}/points | Read cached points |
| GET | /masters/{id}/events | Read runtime events |

FastAPI proxy endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/master-runtime/health | Native master runtime health |
| GET | /api/master-runtime/runtime | Native master runtime mode/status |

Run the runtime in scaffold/no-OpenDNP3 mode:

```bash
docker compose --profile dnp3-master-runtime up -d --build dnp3-master-runtime
```

Build with OpenDNP3 available in the image:

```bash
DNP3_MASTER_RUNTIME_BUILD_ENABLE_OPENDNP3=ON docker compose --profile dnp3-master-runtime up -d --build dnp3-master-runtime
```

Run FastAPI using the native runtime:

```bash
DNP3_ENGINE=native_opendnp3 DNP3_MASTER_RUNTIME_BUILD_ENABLE_OPENDNP3=ON docker compose --profile dnp3-master-runtime up -d --build
```

Production capability flags:

```bash
APP_ENV=production
ENABLE_DEMO_OUTSTATION=true
ENABLE_PUBLIC_OUTSTATION_MANAGEMENT=false
```

`/api/capabilities` tells the frontend which modules are available. In
production, keep public outstation management disabled unless the deployment is
an authenticated lab environment. This prevents anonymous users from starting,
stopping, or changing DNP3 outstation points through the public web UI.

Native runtime status today: TCP master connect, OpenDNP3 `AddTCPClient`/`AddMaster`,
integrity scan queueing, SOE point capture, cached point/event reads, a demo TCP
outstation with configurable points, and FastAPI adapter are implemented. Native
point controls, time sync, restart commands, serial/UDP transport, and richer
traffic-frame streaming are still pending.

Configurable demo outstation points currently support Binary Input, Double-bit
Binary, Analog Input, Counter, Frozen Counter, Binary Output Status, and Analog
Output Status. The OpenDNP3 database is created when the outstation starts, so
adding/removing points or changing point type/index/class/variation requires
stopping and starting the demo outstation. Point value and flags can be updated
while it is running.

## Production Deploy With Portainer

Use `docker-compose.portainer.yml` for production stacks created from GitHub in
Portainer.

Recommended production environment:

```bash
APP_ENV=production
APP_VERSION=1.0.0
DNP3_ENGINE=native_opendnp3
DNP3_MASTER_RUNTIME_BUILD_ENABLE_OPENDNP3=ON
ENABLE_DEMO_OUTSTATION=true
ENABLE_PUBLIC_OUTSTATION_MANAGEMENT=false
CORS_ORIGINS=["https://dnp3.ioda.com.br"]
FRONTEND_HTTP_PORT=8080
```

The production frontend container runs Nginx on port 80 and proxies `/api` plus
WebSocket traffic to the backend service inside the Docker network. Publish only
the frontend service to the host, then point the server Nginx reverse proxy to:

```text
http://127.0.0.1:8080
```

Minimal server Nginx location block:

```nginx
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
```

For the public site, keep `ENABLE_PUBLIC_OUTSTATION_MANAGEMENT=false`. This keeps
Master creation available while blocking anonymous users from starting/stopping
or editing the demo outstation from the web UI.

## Based On

Reverse-engineered from FreyrSCADA DNP3 Client Simulator v21.06.018.
This is an independent reconstruction for educational/interoperability purposes.
