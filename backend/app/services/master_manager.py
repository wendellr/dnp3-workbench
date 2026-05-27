"""
Master Manager - Manages all DNP3 master instances.
"""

import asyncio
import time
from typing import Optional, Callable
from app.core.config import settings
from app.models.master import DNP3Master, CommMode, ConnectionState, DataPoint
from app.services.dnp3_base import BaseDNP3MasterSession
from app.services.dnp3_session_factory import create_dnp3_session


class MasterManager:
    """Singleton manager for all DNP3 master sessions."""

    def __init__(self):
        self.masters: dict[str, DNP3Master] = {}
        self.sessions: dict[str, BaseDNP3MasterSession] = {}
        self.traffic_callbacks: dict[str, list[Callable]] = {}
        self.log_callbacks: dict[str, list[Callable]] = {}
        self.data_callbacks: dict[str, list[Callable]] = {}
        self.traffic_history: dict[str, list[dict]] = {}
        self.log_history: dict[str, list[dict]] = {}
        self.monitor_tasks: dict[str, asyncio.Task] = {}
        self.poll_tasks: dict[str, asyncio.Task] = {}

    def create_master(self, name: str = "New Master", comm_mode: CommMode = CommMode.TCP,
                      master_address: int = 1, outstation_address: int = 2) -> DNP3Master:
        """Create a new DNP3 master."""
        if len(self.masters) >= 50:
            raise ValueError("Maximum 50 masters allowed")

        master = DNP3Master(
            name=name,
            comm_mode=comm_mode,
            master_address=master_address,
            outstation_address=outstation_address,
        )
        self.masters[master.id] = master
        return master

    def delete_master(self, master_id: str) -> bool:
        """Delete a master and its session."""
        if master_id not in self.masters:
            return False

        if master_id in self.sessions:
            asyncio.ensure_future(self.sessions[master_id].disconnect())
            del self.sessions[master_id]
        if master_id in self.monitor_tasks:
            self.monitor_tasks[master_id].cancel()
            del self.monitor_tasks[master_id]
        if master_id in self.poll_tasks:
            self.poll_tasks[master_id].cancel()
            del self.poll_tasks[master_id]

        del self.masters[master_id]
        self.traffic_callbacks.pop(master_id, None)
        self.log_callbacks.pop(master_id, None)
        self.data_callbacks.pop(master_id, None)
        self.traffic_history.pop(master_id, None)
        self.log_history.pop(master_id, None)
        return True

    def _remember_traffic(self, master_id: str, frame_data: dict):
        self.traffic_history.setdefault(master_id, []).append(frame_data)
        self.traffic_history[master_id] = self.traffic_history[master_id][-500:]

    def _remember_log(self, master_id: str, log_entry: dict):
        entry = dict(log_entry)
        entry.setdefault("timestamp", time.strftime("%Y-%m-%d %H:%M:%S", time.localtime()))
        self.log_history.setdefault(master_id, []).append(entry)
        self.log_history[master_id] = self.log_history[master_id][-1000:]

    async def _publish_traffic(self, master_id: str, direction: str, description: str, hex_text: str = ""):
        frame_data = {
            "timestamp": time.time(),
            "direction": direction,
            "description": description,
            "hex": hex_text,
        }
        self._remember_traffic(master_id, frame_data)
        for cb in self.traffic_callbacks.get(master_id, []):
            await cb(frame_data)

    async def _publish_log(self, master_id: str, level: str, message: str):
        log_entry = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime()),
            "level": level,
            "message": message,
        }
        self._remember_log(master_id, log_entry)
        for cb in self.log_callbacks.get(master_id, []):
            await cb(self.log_history[master_id][-1])

    def get_traffic_history(self, master_id: str) -> list[dict]:
        return list(self.traffic_history.get(master_id, []))

    def get_log_history(self, master_id: str) -> list[dict]:
        return list(self.log_history.get(master_id, []))

    def get_master(self, master_id: str) -> Optional[DNP3Master]:
        return self.masters.get(master_id)

    def get_all_masters(self) -> list[DNP3Master]:
        return list(self.masters.values())

    def update_master_config(self, master_id: str, updates: dict) -> Optional[DNP3Master]:
        """Update master configuration."""
        master = self.masters.get(master_id)
        if not master:
            return None

        polling_updated = False
        for key, value in updates.items():
            if value is not None and hasattr(master, key):
                if key == "serial_config":
                    for k, v in value.items():
                        setattr(master.serial_config, k, v)
                elif key == "tcp_config":
                    for k, v in value.items():
                        setattr(master.tcp_config, k, v)
                elif key == "udp_config":
                    for k, v in value.items():
                        setattr(master.udp_config, k, v)
                elif key == "polling_config":
                    for k, v in value.items():
                        setattr(master.polling_config, k, v)
                    polling_updated = True
                elif key == "timeout_config":
                    for k, v in value.items():
                        setattr(master.timeout_config, k, v)
                else:
                    setattr(master, key, value)

        if polling_updated and master_id in self.sessions:
            self._start_auto_poll(master_id)

        return master

    async def connect_master(self, master_id: str) -> bool:
        """Connect a master to its outstation."""
        master = self.masters.get(master_id)
        if not master:
            return False

        async def on_traffic(cid, frame_data):
            self._remember_traffic(cid, frame_data)
            for cb in self.traffic_callbacks.get(cid, []):
                await cb(frame_data)

        async def on_log(cid, log_entry):
            self._remember_log(cid, log_entry)
            for cb in self.log_callbacks.get(cid, []):
                await cb(self.log_history[cid][-1])

        async def on_data_update(cid, data_points):
            master = self.masters.get(cid)
            if master:
                master.data_points = [DataPoint(**dp) for dp in data_points]
            for cb in self.data_callbacks.get(cid, []):
                await cb(data_points)

        session = create_dnp3_session(
            settings.DNP3_ENGINE,
            client_id=master_id,
            on_traffic=on_traffic,
            on_log=on_log,
            on_data_update=on_data_update,
        )

        config = {}
        if master.comm_mode == CommMode.SERIAL:
            config = master.serial_config.__dict__
        elif master.comm_mode == CommMode.TCP:
            config = master.tcp_config.__dict__
        elif master.comm_mode == CommMode.UDP:
            config = master.udp_config.__dict__

        success = await session.connect(
            master.comm_mode.value, config,
            master.master_address, master.outstation_address
        )

        if success:
            self.sessions[master_id] = session
            master.state = ConnectionState.CONNECTED
            self._start_connection_monitor(master_id)
            self._start_auto_poll(master_id)
        else:
            master.state = ConnectionState.ERROR

        return success

    def _start_connection_monitor(self, master_id: str):
        existing = self.monitor_tasks.get(master_id)
        if existing:
            existing.cancel()
        self.monitor_tasks[master_id] = asyncio.create_task(self._connection_monitor(master_id))

    async def _connection_monitor(self, master_id: str):
        failed_checks = 0
        reconnect_grace_checks = 20
        try:
            while master_id in self.sessions:
                await asyncio.sleep(1.0)
                session = self.sessions.get(master_id)
                master = self.masters.get(master_id)
                if not session or not master:
                    return
                checker = getattr(session, "check_connected", None)
                if not checker:
                    continue
                connected = await checker()
                if connected:
                    if failed_checks:
                        await self._publish_log(master_id, "info", "OpenDNP3 channel recovered.")
                        await self._publish_traffic(master_id, "RX", "OpenDNP3 channel recovered", "NATIVE-OPENDNP3-CHANNEL-RECOVERED")
                    failed_checks = 0
                    master.state = ConnectionState.CONNECTED
                    continue

                failed_checks += 1
                if failed_checks == 1:
                    await self._publish_log(
                        master_id,
                        "warning",
                        "Reconnect grace timer started; Master state is reconnecting.",
                    )
                if failed_checks < reconnect_grace_checks:
                    master.state = ConnectionState.CONNECTING
                else:
                    master.state = ConnectionState.ERROR
                    if failed_checks == reconnect_grace_checks:
                        await self._publish_log(master_id, "error", "OpenDNP3 channel remained closed after reconnect grace period.")
        except asyncio.CancelledError:
            return

    def _start_auto_poll(self, master_id: str):
        existing = self.poll_tasks.get(master_id)
        if existing:
            existing.cancel()
        self.poll_tasks[master_id] = asyncio.create_task(self._auto_poll(master_id))

    async def _auto_poll(self, master_id: str):
        try:
            while master_id in self.sessions:
                master = self.masters.get(master_id)
                session = self.sessions.get(master_id)
                if not master or not session:
                    return

                interval = max(5, int(master.polling_config.integrity_poll_interval or 30))
                await asyncio.sleep(interval)

                master = self.masters.get(master_id)
                session = self.sessions.get(master_id)
                if not master or not session:
                    return
                if master.state != ConnectionState.CONNECTED:
                    continue

                try:
                    checker = getattr(session, "check_connected", None)
                    if checker and not await checker():
                        master.state = ConnectionState.CONNECTING
                        continue
                    await self._publish_log(master_id, "info", f"Automatic integrity poll every {interval}s.")
                    await session.integrity_poll(master.master_address, master.outstation_address)
                except Exception as exc:
                    message = str(exc)
                    if "reconnecting" in message or "channel_not_open" in message:
                        master.state = ConnectionState.CONNECTING
                        await self._publish_log(master_id, "info", "Automatic integrity poll skipped while channel reconnects.")
                        await self._publish_traffic(master_id, "ERR", "Automatic poll skipped while channel reconnects", "NATIVE-OPENDNP3-AUTO-POLL-SKIPPED")
                    else:
                        await self._publish_log(master_id, "warning", f"Automatic integrity poll failed: {exc}")
                        await self._publish_traffic(master_id, "ERR", "Automatic integrity poll failed", "NATIVE-OPENDNP3-AUTO-POLL-ERROR")
        except asyncio.CancelledError:
            return

    async def disconnect_master(self, master_id: str) -> bool:
        """Disconnect a master."""
        master = self.masters.get(master_id)
        session = self.sessions.get(master_id)
        if not master or not session:
            return False

        await session.disconnect()
        master.state = ConnectionState.DISCONNECTED
        del self.sessions[master_id]
        if master_id in self.monitor_tasks:
            self.monitor_tasks[master_id].cancel()
            del self.monitor_tasks[master_id]
        if master_id in self.poll_tasks:
            self.poll_tasks[master_id].cancel()
            del self.poll_tasks[master_id]
        return True

    async def execute_station_command(self, master_id: str, command: str) -> dict:
        """Execute a station-level command."""
        master = self.masters.get(master_id)
        session = self.sessions.get(master_id)
        if not master or not session:
            return {"success": False, "error": "Master not found or not connected"}

        ma = master.master_address
        oa = master.outstation_address

        if command == "integrity_poll":
            try:
                data = await session.integrity_poll(ma, oa)
                return {"success": True, "data_points": data}
            except Exception as exc:
                return {"success": False, "error": str(exc)}
        elif command.startswith("class") and command.endswith("_poll"):
            try:
                class_num = int(command.replace("class", "").replace("_poll", ""))
                data = await session.class_poll(class_num, ma, oa)
                return {"success": True, "data_points": data}
            except Exception as exc:
                return {"success": False, "error": str(exc)}
        elif command == "time_sync":
            try:
                await session.time_sync(ma, oa)
                return {"success": True}
            except NotImplementedError as exc:
                return {"success": False, "error": str(exc)}
        elif command == "cold_restart":
            try:
                await session.cold_restart(ma, oa)
                return {"success": True}
            except NotImplementedError as exc:
                return {"success": False, "error": str(exc)}
        elif command == "warm_restart":
            try:
                await session.warm_restart(ma, oa)
                return {"success": True}
            except NotImplementedError as exc:
                return {"success": False, "error": str(exc)}
        else:
            return {"success": False, "error": f"Unknown command: {command}"}

    async def execute_point_command(self, master_id: str, command_type: str,
                                     group: int, variation: int, index: int,
                                     value: str, **kwargs) -> dict:
        """Execute a point-level command."""
        session = self.sessions.get(master_id)
        master = self.masters.get(master_id)
        if not session or not master:
            return {"success": False, "error": "Master not found or not connected"}

        return await session.send_control(
            command_type, group, variation, index, value,
            master_addr=master.master_address,
            outstation_addr=master.outstation_address,
            **kwargs
        )

    def register_traffic_callback(self, master_id: str, callback: Callable):
        self.traffic_callbacks.setdefault(master_id, []).append(callback)

    def unregister_traffic_callback(self, master_id: str, callback: Callable):
        if master_id in self.traffic_callbacks:
            self.traffic_callbacks[master_id] = [
                cb for cb in self.traffic_callbacks[master_id] if cb != callback
            ]

    def register_log_callback(self, master_id: str, callback: Callable):
        self.log_callbacks.setdefault(master_id, []).append(callback)

    def unregister_log_callback(self, master_id: str, callback: Callable):
        if master_id in self.log_callbacks:
            self.log_callbacks[master_id] = [
                cb for cb in self.log_callbacks[master_id] if cb != callback
            ]

    def register_data_callback(self, master_id: str, callback: Callable):
        self.data_callbacks.setdefault(master_id, []).append(callback)

    def unregister_data_callback(self, master_id: str, callback: Callable):
        if master_id in self.data_callbacks:
            self.data_callbacks[master_id] = [
                cb for cb in self.data_callbacks[master_id] if cb != callback
            ]


# Singleton instance
master_manager = MasterManager()
