from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from app.schemas.master import (
    CreateMasterRequest, UpdateMasterConfigRequest, MasterResponse,
    StationCommandRequest, PointCommandRequest, DataPointSchema
)
from app.core.config import settings
from app.services.master_manager import master_manager
from app.services.master_runtime_client import MasterRuntimeError, master_runtime_get, master_runtime_post
from app.models.master import DNP3_GROUPS
import asyncio
import json

router = APIRouter(prefix="/api")


def master_to_response(master) -> dict:
    return {
        "id": master.id,
        "name": master.name,
        "comm_mode": master.comm_mode.value,
        "master_address": master.master_address,
        "outstation_address": master.outstation_address,
        "state": master.state.value,
        "serial_config": master.serial_config.__dict__,
        "tcp_config": master.tcp_config.__dict__,
        "udp_config": master.udp_config.__dict__,
        "polling_config": master.polling_config.__dict__,
        "timeout_config": master.timeout_config.__dict__,
        "data_points": [dp.__dict__ for dp in master.data_points],
    }


client_to_response = master_to_response


def require_demo_outstation_available():
    if not settings.ENABLE_DEMO_OUTSTATION:
        raise HTTPException(status_code=403, detail="Demo outstation is disabled in this environment")


def require_public_outstation_management():
    require_demo_outstation_available()
    if not settings.ENABLE_PUBLIC_OUTSTATION_MANAGEMENT:
        raise HTTPException(status_code=403, detail="Public outstation management is restricted in this environment")


# --- Server Capabilities ---

@router.get("/capabilities")
async def get_capabilities():
    return {
        "app_env": settings.APP_ENV,
        "dnp3_engine": settings.DNP3_ENGINE,
        "demo_outstation_available": settings.ENABLE_DEMO_OUTSTATION,
        "public_outstation_management": settings.ENABLE_PUBLIC_OUTSTATION_MANAGEMENT,
        "max_masters": 50,
        "modules": {
            "masters": True,
            "outstations": settings.ENABLE_DEMO_OUTSTATION and settings.ENABLE_PUBLIC_OUTSTATION_MANAGEMENT,
            "traffic": False,
            "settings": False,
        },
    }


# --- Client CRUD ---

@router.get("/clients")
async def list_clients():
    masters = master_manager.get_all_masters()
    return [master_to_response(m) for m in masters]


@router.get("/masters")
async def list_masters():
    masters = master_manager.get_all_masters()
    return [master_to_response(m) for m in masters]


@router.post("/clients")
async def create_client(req: CreateMasterRequest):
    try:
        master = master_manager.create_master(
            name=req.name, comm_mode=req.comm_mode,
            master_address=req.master_address, outstation_address=req.outstation_address
        )
        return master_to_response(master)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/masters")
async def create_master(req: CreateMasterRequest):
    try:
        master = master_manager.create_master(
            name=req.name, comm_mode=req.comm_mode,
            master_address=req.master_address, outstation_address=req.outstation_address
        )
        return master_to_response(master)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/clients/{client_id}")
async def get_client(client_id: str):
    master = master_manager.get_master(client_id)
    if not master:
        raise HTTPException(status_code=404, detail="Client not found")
    return master_to_response(master)


@router.get("/masters/{master_id}")
async def get_master(master_id: str):
    master = master_manager.get_master(master_id)
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")
    return master_to_response(master)


@router.put("/clients/{client_id}/config")
async def update_client_config(client_id: str, req: UpdateMasterConfigRequest):
    updates = req.model_dump(exclude_none=True)
    # Convert nested schemas to dicts
    for key in ["serial_config", "tcp_config", "udp_config", "polling_config", "timeout_config"]:
        if key in updates and updates[key] is not None:
            updates[key] = updates[key] if isinstance(updates[key], dict) else updates[key].__dict__

    master = master_manager.update_master_config(client_id, updates)
    if not master:
        raise HTTPException(status_code=404, detail="Client not found")
    return master_to_response(master)


@router.put("/masters/{master_id}/config")
async def update_master_config(master_id: str, req: UpdateMasterConfigRequest):
    updates = req.model_dump(exclude_none=True)
    for key in ["serial_config", "tcp_config", "udp_config", "polling_config", "timeout_config"]:
        if key in updates and updates[key] is not None:
            updates[key] = updates[key] if isinstance(updates[key], dict) else updates[key].__dict__

    master = master_manager.update_master_config(master_id, updates)
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")
    return master_to_response(master)


@router.delete("/clients/{client_id}")
async def delete_client(client_id: str):
    if not master_manager.delete_master(client_id):
        raise HTTPException(status_code=404, detail="Client not found")
    return {"status": "deleted"}


@router.delete("/masters/{master_id}")
async def delete_master(master_id: str):
    if not master_manager.delete_master(master_id):
        raise HTTPException(status_code=404, detail="Master not found")
    return {"status": "deleted"}


# --- Connection ---

@router.post("/clients/{client_id}/connect")
async def connect_client(client_id: str):
    success = await master_manager.connect_master(client_id)
    if not success:
        raise HTTPException(status_code=400, detail="Connection failed")
    return {"status": "connected"}


@router.post("/masters/{master_id}/connect")
async def connect_master(master_id: str):
    success = await master_manager.connect_master(master_id)
    if not success:
        raise HTTPException(status_code=400, detail="Connection failed")
    return {"status": "connected"}


@router.post("/clients/{client_id}/disconnect")
async def disconnect_client(client_id: str):
    success = await master_manager.disconnect_master(client_id)
    if not success:
        raise HTTPException(status_code=400, detail="Disconnect failed")
    return {"status": "disconnected"}


@router.post("/masters/{master_id}/disconnect")
async def disconnect_master(master_id: str):
    success = await master_manager.disconnect_master(master_id)
    if not success:
        raise HTTPException(status_code=400, detail="Disconnect failed")
    return {"status": "disconnected"}


# --- Commands ---

@router.post("/clients/{client_id}/commands/station")
async def station_command(client_id: str, req: StationCommandRequest):
    result = await master_manager.execute_station_command(client_id, req.command)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Command failed"))
    return result


@router.post("/masters/{master_id}/commands/station")
async def master_station_command(master_id: str, req: StationCommandRequest):
    result = await master_manager.execute_station_command(master_id, req.command)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Command failed"))
    return result


@router.post("/clients/{client_id}/commands/point")
async def point_command(client_id: str, req: PointCommandRequest):
    result = await master_manager.execute_point_command(
        client_id, req.command_type, req.group, req.variation,
        req.index, req.value, count=req.count,
        on_time=req.on_time, off_time=req.off_time,
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Command failed"))
    return result


@router.post("/masters/{master_id}/commands/point")
async def master_point_command(master_id: str, req: PointCommandRequest):
    result = await master_manager.execute_point_command(
        master_id, req.command_type, req.group, req.variation,
        req.index, req.value, count=req.count,
        on_time=req.on_time, off_time=req.off_time,
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Command failed"))
    return result


# --- Data Points ---

@router.get("/clients/{client_id}/datapoints")
async def get_data_points(client_id: str):
    master = master_manager.get_master(client_id)
    if not master:
        raise HTTPException(status_code=404, detail="Client not found")
    return [dp.__dict__ for dp in master.data_points]


@router.get("/masters/{master_id}/datapoints")
async def get_master_data_points(master_id: str):
    master = master_manager.get_master(master_id)
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")
    return [dp.__dict__ for dp in master.data_points]


# --- DNP3 Reference ---

@router.get("/dnp3/groups")
async def get_dnp3_groups():
    return DNP3_GROUPS


# --- Native Master Runtime ---

@router.get("/master-runtime/health")
async def get_master_runtime_health():
    try:
        return master_runtime_get("/health")
    except MasterRuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/master-runtime/runtime")
async def get_master_runtime():
    try:
        return master_runtime_get("/runtime")
    except MasterRuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/demo-outstation/status")
async def get_demo_outstation_status():
    require_demo_outstation_available()
    try:
        return master_runtime_get("/demo-outstation/status")
    except MasterRuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/demo-outstation/start")
async def start_demo_outstation(payload: dict | None = None):
    require_public_outstation_management()
    try:
        return master_runtime_post("/demo-outstation/start", payload or {})
    except MasterRuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/demo-outstation/update")
async def update_demo_outstation():
    require_public_outstation_management()
    try:
        return master_runtime_post("/demo-outstation/update", {})
    except MasterRuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/demo-outstation/stop")
async def stop_demo_outstation():
    require_public_outstation_management()
    try:
        return master_runtime_post("/demo-outstation/stop", {})
    except MasterRuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/demo-outstation/points")
async def get_demo_outstation_points():
    require_demo_outstation_available()
    try:
        return master_runtime_get("/demo-outstation/points")
    except MasterRuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/demo-outstation/points")
async def add_demo_outstation_point(payload: dict):
    require_public_outstation_management()
    try:
        return master_runtime_post("/demo-outstation/points", payload)
    except MasterRuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.put("/demo-outstation/points/{point_id:path}")
async def update_demo_outstation_point(point_id: str, payload: dict):
    require_public_outstation_management()
    try:
        return master_runtime_post(f"/demo-outstation/points/{point_id}", payload, method="PUT")
    except MasterRuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.delete("/demo-outstation/points/{point_id:path}")
async def delete_demo_outstation_point(point_id: str):
    require_public_outstation_management()
    try:
        return master_runtime_post(f"/demo-outstation/points/{point_id}", {}, method="DELETE")
    except MasterRuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


# --- WebSocket: Traffic Monitor ---

@router.websocket("/clients/{client_id}/traffic")
async def traffic_ws(websocket: WebSocket, client_id: str):
    await websocket.accept()

    async def send_traffic(frame_data):
        try:
            await websocket.send_json(frame_data)
        except Exception:
            pass

    master_manager.register_traffic_callback(client_id, send_traffic)

    try:
        for frame_data in master_manager.get_traffic_history(client_id):
            await websocket.send_json(frame_data)
        while True:
            await websocket.receive_text()  # Keep alive
    except WebSocketDisconnect:
        pass
    finally:
        master_manager.unregister_traffic_callback(client_id, send_traffic)


@router.websocket("/masters/{master_id}/traffic")
async def master_traffic_ws(websocket: WebSocket, master_id: str):
    await traffic_ws(websocket, master_id)


# --- WebSocket: Log Monitor ---

@router.websocket("/clients/{client_id}/logs")
async def logs_ws(websocket: WebSocket, client_id: str):
    await websocket.accept()

    async def send_log(log_entry):
        try:
            await websocket.send_json(log_entry)
        except Exception:
            pass

    master_manager.register_log_callback(client_id, send_log)

    try:
        for log_entry in master_manager.get_log_history(client_id):
            await websocket.send_json(log_entry)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        master_manager.unregister_log_callback(client_id, send_log)


@router.websocket("/masters/{master_id}/logs")
async def master_logs_ws(websocket: WebSocket, master_id: str):
    await logs_ws(websocket, master_id)


# --- WebSocket: Data Updates ---

@router.websocket("/clients/{client_id}/data")
async def data_ws(websocket: WebSocket, client_id: str):
    await websocket.accept()

    async def send_data(data_points):
        try:
            await websocket.send_json(data_points)
        except Exception:
            pass

    master_manager.register_data_callback(client_id, send_data)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        master_manager.unregister_data_callback(client_id, send_data)


@router.websocket("/masters/{master_id}/data")
async def master_data_ws(websocket: WebSocket, master_id: str):
    await data_ws(websocket, master_id)
