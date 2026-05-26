#!/usr/bin/env python3
"""
Probe PyDNP3 availability and basic module surface.

Run from backend/:
    python scripts/probe_pydnp3.py
"""

import sys


def main() -> int:
    try:
        from pydnp3 import asiodnp3, asiopal, openpal, opendnp3
    except ImportError as exc:
        print("PyDNP3 import: FAILED")
        print(f"Reason: {exc}")
        return 1

    print("PyDNP3 import: OK")
    modules = {
        "asiodnp3": asiodnp3,
        "asiopal": asiopal,
        "openpal": openpal,
        "opendnp3": opendnp3,
    }
    for name, module in modules.items():
        public_names = [item for item in dir(module) if not item.startswith("_")]
        print(f"{name}: {len(public_names)} public symbols")

    expected_symbols = [
        ("asiodnp3", "DNP3Manager"),
        ("asiodnp3", "ConsoleLogger"),
        ("opendnp3", "MasterStackConfig"),
        ("opendnp3", "GroupVariationID"),
    ]
    for module_name, symbol in expected_symbols:
        module = modules[module_name]
        status = "OK" if hasattr(module, symbol) else "MISSING"
        print(f"{module_name}.{symbol}: {status}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
