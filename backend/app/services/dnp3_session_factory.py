"""
DNP3 session factory.
"""

from app.services.native_master_runtime_session import NativeMasterRuntimeSession
from app.services.pydnp3_engine import PyDNP3MasterSession


def create_dnp3_session(engine: str, *args, **kwargs):
    """Create the configured DNP3 session implementation (apenas real/nativo)."""
    normalized_engine = (engine or "real").strip().lower()

    if normalized_engine in {"pydnp3", "real"}:
        return PyDNP3MasterSession(*args, **kwargs)

    if normalized_engine in {"native", "native_opendnp3", "opendnp3"}:
        return NativeMasterRuntimeSession(*args, **kwargs)

    raise ValueError(f"Unsupported DNP3 engine: {engine}")
