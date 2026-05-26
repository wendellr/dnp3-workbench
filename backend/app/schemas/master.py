from pydantic import BaseModel
from typing import Optional
from app.models.master import CommMode


class SerialConfigSchema(BaseModel):
    port: str = "COM1"
    baud_rate: int = 9600
    data_bits: int = 8
    parity: str = "none"
    stop_bits: float = 1.0
    flow_control: str = "none"


class TcpConfigSchema(BaseModel):
    ip_address: str = "127.0.0.1"
    port: int = 20000


class UdpConfigSchema(BaseModel):
    ip_address: str = "127.0.0.1"
    port: int = 20000


class PollingConfigSchema(BaseModel):
    integrity_poll_interval: int = 30
    class1_poll_interval: int = 5
    class2_poll_interval: int = 10
    class3_poll_interval: int = 15
    enable_unsolicited: bool = True


class TimeoutConfigSchema(BaseModel):
    link_layer_timeout: int = 5000
    application_layer_timeout: int = 10000
    command_timeout: int = 5000


class CreateMasterRequest(BaseModel):
    name: str = "New Master"
    comm_mode: CommMode = CommMode.TCP
    master_address: int = 1
    outstation_address: int = 2


class UpdateMasterConfigRequest(BaseModel):
    name: Optional[str] = None
    comm_mode: Optional[CommMode] = None
    master_address: Optional[int] = None
    outstation_address: Optional[int] = None
    serial_config: Optional[SerialConfigSchema] = None
    tcp_config: Optional[TcpConfigSchema] = None
    udp_config: Optional[UdpConfigSchema] = None
    polling_config: Optional[PollingConfigSchema] = None
    timeout_config: Optional[TimeoutConfigSchema] = None


class DataPointSchema(BaseModel):
    index: int
    group: int
    variation: int
    value: str = ""
    quality: str = "ONLINE"
    timestamp: str = ""
    description: str = ""


class StationCommandRequest(BaseModel):
    command: str  # integrity_poll, class1_poll, class2_poll, class3_poll, time_sync, cold_restart, warm_restart


class PointCommandRequest(BaseModel):
    command_type: str  # sbo, direct_operate, direct_no_ack
    group: int
    variation: int
    index: int
    value: str
    count: int = 1
    on_time: int = 1000
    off_time: int = 1000
    control_code: Optional[str] = None  # For CROB: nul, pulse_on, pulse_off, latch_on, latch_off, close, trip


class MasterResponse(BaseModel):
    id: str
    name: str
    comm_mode: str
    master_address: int
    outstation_address: int
    state: str
    serial_config: SerialConfigSchema
    tcp_config: TcpConfigSchema
    udp_config: UdpConfigSchema
    polling_config: PollingConfigSchema
    timeout_config: TimeoutConfigSchema
    data_points: list[DataPointSchema] = []
