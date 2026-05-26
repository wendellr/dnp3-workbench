"""
HTTP client for the native DNP3 master runtime.
"""

import json
import urllib.error
import urllib.request

from app.core.config import settings


class MasterRuntimeError(RuntimeError):
    """Raised when the native master runtime cannot be reached."""


def _master_runtime_request(path: str, method: str, payload: dict | None = None, timeout: float = 3.0) -> dict:
    base_url = settings.DNP3_MASTER_RUNTIME_BASE_URL.rstrip("/")
    url = f"{base_url}/{path.lstrip('/')}"
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise MasterRuntimeError(f"DNP3 master runtime unavailable: {exc}") from exc


def master_runtime_get(path: str, timeout: float = 3.0) -> dict:
    return _master_runtime_request(path, "GET", timeout=timeout)


def master_runtime_post(path: str, payload: dict | None = None, timeout: float = 5.0, method: str = "POST") -> dict:
    return _master_runtime_request(path, method, payload=payload or {}, timeout=timeout)
