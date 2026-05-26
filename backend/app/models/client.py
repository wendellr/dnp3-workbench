from enum import Enum
from dataclasses import dataclass, field
from typing import Optional
import uuid
import time


class CommMode(str, Enum):
    SERIAL = "serial"
    TCP = "tcp"
    UDP = "udp"


class ConnectionState(str, Enum):
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    ERROR = "error"


@dataclass
class SerialConfig:
    port: str = "COM1"
    baud_rate: int = 9600
    data_bits: int = 8
    parity: str = "none"  # none, even, odd
    stop_bits: float = 1.0
    flow_control: str = "none"


@dataclass
class TcpConfig:
    ip_address: str = "127.0.0.1"
    port: int = 20000


@dataclass
class UdpConfig:
    ip_address: str = "127.0.0.1"
    port: int = 20000


@dataclass
class PollingConfig:
    integrity_poll_interval: int = 30  # seconds
    class1_poll_interval: int = 5
    class2_poll_interval: int = 10
    class3_poll_interval: int = 15
    enable_unsolicited: bool = True


@dataclass
class TimeoutConfig:
    link_layer_timeout: int = 5000  # ms
    application_layer_timeout: int = 10000  # ms
    command_timeout: int = 5000  # ms


@dataclass
class DataPoint:
    index: int = 0
    group: int = 0
    variation: int = 0
    value: str = ""
    quality: str = "ONLINE"
    timestamp: str = ""
    description: str = ""


DNP3_GROUPS = {
    1: {"name": "Binary Input", "variations": [1, 2]},
    2: {"name": "Binary Input Event", "variations": [1, 2, 3]},
    3: {"name": "Double-bit Binary Input", "variations": [1, 2]},
    4: {"name": "Double-bit Binary Input Event", "variations": [1, 2, 3]},
    10: {"name": "Binary Output", "variations": [1, 2]},
    11: {"name": "Binary Output Event", "variations": [1, 2]},
    12: {"name": "CROB (Control Relay Output Block)", "variations": [1]},
    20: {"name": "Counter", "variations": [1, 2, 5, 6]},
    21: {"name": "Frozen Counter", "variations": [1, 2, 5, 6]},
    22: {"name": "Counter Event", "variations": [1, 2, 5, 6]},
    30: {"name": "Analog Input", "variations": [1, 2, 3, 4, 5, 6]},
    31: {"name": "Frozen Analog Input", "variations": [1, 2, 3, 4, 5, 6]},
    32: {"name": "Analog Input Event", "variations": [1, 2, 3, 4, 5, 6, 7, 8]},
    40: {"name": "Analog Output Status", "variations": [1, 2, 3, 4]},
    41: {"name": "Analog Output Block", "variations": [1, 2, 3, 4]},
    50: {"name": "Time and Date", "variations": [1, 4]},
    60: {"name": "Class Data", "variations": [1, 2, 3, 4]},
    70: {"name": "File Transfer", "variations": [1, 2, 3, 4, 5, 6, 7, 8]},
    80: {"name": "Internal Indications", "variations": [1]},
    110: {"name": "Octet String", "variations": [0]},
    112: {"name": "Virtual Terminal Output", "variations": [0]},
}


@dataclass
class DNP3Client:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = "Client 1"
    comm_mode: CommMode = CommMode.TCP
    master_address: int = 1
    outstation_address: int = 2
    serial_config: SerialConfig = field(default_factory=SerialConfig)
    tcp_config: TcpConfig = field(default_factory=TcpConfig)
    udp_config: UdpConfig = field(default_factory=UdpConfig)
    polling_config: PollingConfig = field(default_factory=PollingConfig)
    timeout_config: TimeoutConfig = field(default_factory=TimeoutConfig)
    data_points: list[DataPoint] = field(default_factory=list)
    state: ConnectionState = ConnectionState.DISCONNECTED
    created_at: float = field(default_factory=time.time)


# New domain name. Keep DNP3Client for backward compatibility.
DNP3Master = DNP3Client
