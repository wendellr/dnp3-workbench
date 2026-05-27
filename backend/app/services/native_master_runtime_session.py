"""
DNP3 master session backed by the native OpenDNP3 runtime service.
"""

import asyncio
import time
from collections import defaultdict
from typing import Callable, Optional

from app.services.dnp3_base import BaseDNP3MasterSession
from app.services.master_runtime_client import MasterRuntimeError, master_runtime_get, master_runtime_post


POINT_TYPE_TO_GROUP = {
    "binary": (1, 2),
    "double_bit_binary": (3, 2),
    "binary_output_status": (10, 2),
    "counter": (20, 1),
    "frozen_counter": (21, 1),
    "analog": (30, 1),
    "analog_output_status": (40, 1),
}


class NativeMasterRuntimeSession(BaseDNP3MasterSession):
    """Adapter between the FastAPI master manager and the native C++ runtime."""

    def __init__(
        self,
        client_id: str,
        on_traffic: Optional[Callable] = None,
        on_log: Optional[Callable] = None,
        on_data_update: Optional[Callable] = None,
    ):
        super().__init__(client_id, on_traffic, on_log, on_data_update)
        self._emitted_runtime_events: set[tuple[str, str, str, str]] = set()

    async def _get(self, path: str, timeout: float = 3.0) -> dict:
        return await asyncio.to_thread(master_runtime_get, path, timeout)

    async def _post(self, path: str, payload: dict | None = None, timeout: float = 5.0) -> dict:
        return await asyncio.to_thread(master_runtime_post, path, payload or {}, timeout)

    async def _emit_log(self, level: str, message: str):
        if self.on_log:
            await self.on_log(self.client_id, {
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime()),
                "level": level,
                "message": message,
            })

    async def _emit_traffic(self, direction: str, description: str, hex_text: str = ""):
        if self.on_traffic:
            await self.on_traffic(self.client_id, {
                "timestamp": time.time(),
                "direction": direction,
                "description": description,
                "hex": hex_text,
            })

    async def _emit_data(self, points: list[dict]):
        if self.on_data_update:
            await self.on_data_update(self.client_id, points)

    async def _emit_runtime_events(self, events: list[dict]):
        for event in events:
            event_type = event.get("type", "runtime")
            status = event.get("status", "info")
            detail = event.get("detail", "")
            timestamp = event.get("timestamp", "")
            event_key = (str(timestamp), str(event_type), str(status), str(detail))
            if event_key in self._emitted_runtime_events:
                continue
            self._emitted_runtime_events.add(event_key)
            if len(self._emitted_runtime_events) > 2000:
                self._emitted_runtime_events = set(list(self._emitted_runtime_events)[-1000:])
            level = status if status in {"debug", "info", "warning", "error"} else "info"
            await self._emit_log(level, f"{event_type} [{status}]: {detail}".strip())

    def _normalize_points(self, points: list[dict]) -> list[dict]:
        latest_by_point = {}
        for point in points:
            point_type = point.get("type", "unknown")
            group, variation = POINT_TYPE_TO_GROUP.get(point_type, (0, 0))
            latest_by_point[(group, variation, point.get("index", 0))] = {
                "index": point.get("index", 0),
                "group": group,
                "variation": variation,
                "value": str(point.get("value", "")),
                "quality": str(point.get("quality", "")),
                "timestamp": point.get("timestamp", ""),
                "description": point_type.replace("_", " ").title(),
                "source_type": point_type,
                "dnp_time": str(point.get("dnp_time", "")),
            }
        return list(latest_by_point.values())

    def _summarize_raw_points(self, points: list[dict]) -> str:
        if not points:
            return "no raw points"

        by_type: dict[str, list[int]] = defaultdict(list)
        for point in points:
            point_type = point.get("type", "unknown")
            try:
                index = int(point.get("index", 0))
            except (TypeError, ValueError):
                index = 0
            by_type[point_type].append(index)

        parts = []
        for point_type in sorted(by_type):
            indexes = sorted(set(by_type[point_type]))
            preview = ", ".join(str(index) for index in indexes[:12])
            suffix = "" if len(indexes) <= 12 else f", +{len(indexes) - 12} more"
            group, variation = POINT_TYPE_TO_GROUP.get(point_type, (0, 0))
            parts.append(f"{point_type} G{group}V{variation}: {len(indexes)} index(es) [{preview}{suffix}]")
        return "; ".join(parts)

    async def connect(self, comm_mode: str, config: dict, master_addr: int, outstation_addr: int) -> bool:
        if comm_mode != "tcp":
            await self._emit_log("error", "Native OpenDNP3 runtime currently supports TCP master sessions only.")
            return False

        payload = {
            "id": self.client_id,
            "name": self.client_id,
            "host": config.get("ip_address", "127.0.0.1"),
            "port": int(config.get("port", 20000)),
            "master_address": int(master_addr),
            "outstation_address": int(outstation_addr),
        }
        await self._emit_log(
            "info",
            f"Creating native OpenDNP3 master for {payload['host']}:{payload['port']} "
            f"MA={master_addr} OA={outstation_addr}.",
        )
        await self._emit_traffic(
            "TX",
            f"Runtime create master session {payload['host']}:{payload['port']} MA={master_addr} OA={outstation_addr}",
            "NATIVE-OPENDNP3-CREATE",
        )
        try:
            create_result = await self._post("/masters", payload)
        except MasterRuntimeError as exc:
            await self._emit_log("error", str(exc))
            await self._emit_traffic("ERR", "Native runtime failed to create master session", "NATIVE-OPENDNP3-CREATE-ERROR")
            return False

        if not create_result.get("ok", False):
            await self._emit_log("error", create_result.get("detail", "Failed to create native master."))
            return False

        await self._emit_traffic("TX", "OpenDNP3 TCP connect request", "NATIVE-OPENDNP3-CONNECT")
        try:
            connect_result = await self._post(f"/masters/{self.client_id}/connect", {})
        except MasterRuntimeError as exc:
            await self._emit_log("error", str(exc))
            await self._emit_traffic("ERR", "OpenDNP3 TCP channel did not open", "NATIVE-OPENDNP3-CONNECT-ERROR")
            return False

        self.connected = bool(connect_result.get("ok", False))
        await self._emit_runtime_events(connect_result.get("master", {}).get("events", []))
        await self._emit_traffic(
            "RX" if self.connected else "ERR",
            connect_result.get("detail", "Native master connect result."),
            "NATIVE-OPENDNP3-CONNECT-RESULT",
        )
        await self._emit_log(
            "info" if self.connected else "error",
            connect_result.get("detail", "Native master connect requested."),
        )
        return self.connected

    async def disconnect(self):
        await self._emit_traffic("TX", "OpenDNP3 disconnect request", "NATIVE-OPENDNP3-DISCONNECT")
        await self._post(f"/masters/{self.client_id}/disconnect", {})
        self.connected = False
        await self._emit_log("info", "Native master disconnected.")
        await self._emit_traffic("RX", "OpenDNP3 disconnected", "NATIVE-OPENDNP3-DISCONNECTED")

    async def check_connected(self) -> bool:
        try:
            result = await self._get(f"/masters/{self.client_id}", timeout=3.0)
        except MasterRuntimeError as exc:
            if self.connected:
                await self._emit_log("error", f"Native master status check failed: {exc}")
                await self._emit_traffic("ERR", "Native master status check failed", "NATIVE-OPENDNP3-STATUS-ERROR")
            self.connected = False
            return False

        was_connected = self.connected
        connected = bool(result.get("master", {}).get("connected", False))
        if was_connected and not connected:
            await self._emit_log("warning", "OpenDNP3 channel closed; waiting for reconnect.")
            await self._emit_traffic("ERR", "OpenDNP3 channel CLOSED", "NATIVE-OPENDNP3-CHANNEL-CLOSED")
        elif not was_connected and connected:
            await self._emit_log("info", "OpenDNP3 channel is OPEN again.")
            await self._emit_traffic("RX", "OpenDNP3 channel OPEN", "NATIVE-OPENDNP3-CHANNEL-OPEN")
        self.connected = connected
        return connected

    async def integrity_poll(self, master_addr: int, outstation_addr: int) -> list[dict]:
        await self._emit_log("info", f"Integrity poll requested MA={master_addr} OA={outstation_addr}.")
        await self._emit_traffic("TX", "Class 0/1/2/3 integrity poll request", "NATIVE-OPENDNP3-INTEGRITY-POLL")
        try:
            result = await self._post(f"/masters/{self.client_id}/poll/integrity", {}, timeout=10.0)
        except MasterRuntimeError as exc:
            message = str(exc)
            if "501" in message or "channel_not_open" in message:
                self.connected = False
                await self._emit_log("warning", "Integrity poll skipped because the OpenDNP3 channel is reconnecting.")
                await self._emit_traffic("ERR", "Integrity poll skipped while channel reconnects", "NATIVE-OPENDNP3-POLL-SKIPPED")
                raise MasterRuntimeError("OpenDNP3 channel is reconnecting; poll skipped.") from exc
            raise
        await self._emit_runtime_events(result.get("events", []))
        raw_points = result.get("points", [])
        if not raw_points:
            await asyncio.sleep(0.5)
            raw_points = (await self._get(f"/masters/{self.client_id}/points", timeout=5.0)).get("points", [])

        points = self._normalize_points(raw_points)
        summary = self._summarize_raw_points(raw_points)
        await self._emit_traffic(
            "RX",
            f"Integrity poll response with {len(points)} normalized data points",
            "NATIVE-OPENDNP3-SOE-RESPONSE",
        )
        await self._emit_log("info", f"Integrity poll raw summary: {summary}")
        await self._emit_log("info", f"Integrity poll completed with {len(points)} normalized data points.")
        await self._emit_data(points)
        return points

    async def class_poll(self, class_num: int, master_addr: int, outstation_addr: int) -> list[dict]:
        await self._emit_log(
            "info",
            f"Class {class_num} poll requested; native runtime currently executes an all-class scan.",
        )
        return await self.integrity_poll(master_addr, outstation_addr)

    async def time_sync(self, master_addr: int, outstation_addr: int):
        raise NotImplementedError("Native runtime time sync endpoint is not implemented yet.")

    async def send_control(
        self,
        command_type: str,
        group: int,
        variation: int,
        index: int,
        value: str,
        control_code: int = 0x03,
        count: int = 1,
        on_time: int = 1000,
        off_time: int = 1000,
        master_addr: int = 1,
        outstation_addr: int = 2,
    ):
        return {"success": False, "error": "Native runtime point controls are not implemented yet."}

    async def cold_restart(self, master_addr: int, outstation_addr: int):
        raise NotImplementedError("Native runtime cold restart endpoint is not implemented yet.")

    async def warm_restart(self, master_addr: int, outstation_addr: int):
        raise NotImplementedError("Native runtime warm restart endpoint is not implemented yet.")
