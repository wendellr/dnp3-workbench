"""
PyDNP3-backed DNP3 master session.

This module intentionally keeps the real engine isolated from the simulated
engine so the web UI can keep working while PyDNP3 compatibility is validated.
"""

import asyncio
import logging
import time
from typing import Callable, Optional

from app.services.dnp3_base import BaseDNP3MasterSession

logger = logging.getLogger(__name__)


class PyDNP3UnavailableError(RuntimeError):
    """Raised when the PyDNP3 package cannot be imported."""


def import_pydnp3():
    """Import PyDNP3 modules lazily so simulation mode has no hard dependency."""
    try:
        from pydnp3 import asiodnp3, asiopal, openpal, opendnp3
    except ImportError as exc:
        raise PyDNP3UnavailableError(
            "PyDNP3 is not installed or is not compatible with this Python environment."
        ) from exc

    return {
        "asiodnp3": asiodnp3,
        "asiopal": asiopal,
        "openpal": openpal,
        "opendnp3": opendnp3,
    }


class PyDNP3MasterSession(BaseDNP3MasterSession):
    """Real DNP3 master session placeholder backed by PyDNP3."""

    def __init__(
        self,
        client_id: str,
        on_traffic: Optional[Callable] = None,
        on_log: Optional[Callable] = None,
        on_data_update: Optional[Callable] = None,
    ):
        super().__init__(client_id, on_traffic, on_log, on_data_update)
        self._modules = None
        self._manager = None
        self._channel = None
        self._master = None

    async def connect(self, comm_mode: str, config: dict, master_addr: int, outstation_addr: int) -> bool:
        """Validate PyDNP3 availability and prepare the real session."""
        self._log(f"Starting real PyDNP3 engine via {comm_mode.upper()}...")

        if comm_mode != "tcp":
            self._log("PyDNP3 engine currently supports TCP only in this integration path.")
            return False

        try:
            self._modules = import_pydnp3()
        except PyDNP3UnavailableError as exc:
            self._log(str(exc))
            return False

        ip_address = config.get("ip_address", "127.0.0.1")
        port = int(config.get("port", 20000))
        self._log(
            f"PyDNP3 imported successfully. Next step is opening TCP master "
            f"{master_addr}->{outstation_addr} at {ip_address}:{port}."
        )

        # The real channel/master wiring is intentionally kept out of the
        # default path until we validate the exact PyDNP3 version available in
        # the deployment image. This prevents a half-wired stack from pretending
        # to be interoperable.
        self.connected = False
        return False

    async def disconnect(self):
        if self._master:
            self._master.Disable()
        if self._channel:
            self._channel.Shutdown()
        if self._manager:
            self._manager.Shutdown()

        self._master = None
        self._channel = None
        self._manager = None
        self.connected = False
        self._log("PyDNP3 session stopped")

    async def integrity_poll(self, master_addr: int, outstation_addr: int) -> list[dict]:
        return self._not_connected("Integrity poll")

    async def class_poll(self, class_num: int, master_addr: int, outstation_addr: int) -> list[dict]:
        return self._not_connected(f"Class {class_num} poll")

    async def time_sync(self, master_addr: int, outstation_addr: int):
        self._not_connected("Time sync")

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
        self._not_connected("Point command")
        return {"success": False, "error": "PyDNP3 engine is not connected"}

    async def cold_restart(self, master_addr: int, outstation_addr: int):
        self._not_connected("Cold restart")

    async def warm_restart(self, master_addr: int, outstation_addr: int):
        self._not_connected("Warm restart")

    def _not_connected(self, operation: str):
        self._log(f"{operation} ignored: PyDNP3 engine is not connected yet.")
        return []

    def _log(self, message: str):
        entry = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "client_id": self.client_id,
            "message": message,
        }
        logger.info(f"[{self.client_id}] {message}")
        if self.on_log:
            asyncio.ensure_future(self.on_log(self.client_id, entry))
