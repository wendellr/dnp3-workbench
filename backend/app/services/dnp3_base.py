"""
Common contract for DNP3 master session implementations.
"""

from abc import ABC, abstractmethod
from typing import Callable, Optional


class BaseDNP3MasterSession(ABC):
    """Interface implemented by real DNP3 engines."""

    def __init__(
        self,
        client_id: str,
        on_traffic: Optional[Callable] = None,
        on_log: Optional[Callable] = None,
        on_data_update: Optional[Callable] = None,
    ):
        self.client_id = client_id
        self.on_traffic = on_traffic
        self.on_log = on_log
        self.on_data_update = on_data_update
        self.connected = False

    @abstractmethod
    async def connect(self, comm_mode: str, config: dict, master_addr: int, outstation_addr: int) -> bool:
        """Connect to a DNP3 outstation."""

    @abstractmethod
    async def disconnect(self):
        """Disconnect from the DNP3 outstation."""

    @abstractmethod
    async def integrity_poll(self, master_addr: int, outstation_addr: int) -> list[dict]:
        """Run an integrity/Class 0 poll."""

    @abstractmethod
    async def class_poll(self, class_num: int, master_addr: int, outstation_addr: int) -> list[dict]:
        """Run a Class 1/2/3 event poll."""

    @abstractmethod
    async def time_sync(self, master_addr: int, outstation_addr: int):
        """Write DNP3 time to the outstation."""

    @abstractmethod
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
        """Send a point-level DNP3 control command."""

    @abstractmethod
    async def cold_restart(self, master_addr: int, outstation_addr: int):
        """Send cold restart."""

    @abstractmethod
    async def warm_restart(self, master_addr: int, outstation_addr: int):
        """Send warm restart."""
