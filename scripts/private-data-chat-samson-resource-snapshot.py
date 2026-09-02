#!/usr/bin/env python3
"""Capture sanitized Samson memory/swap/service evidence for retrieval selection."""

from __future__ import annotations

import argparse
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def meminfo() -> dict[str, int]:
    values: dict[str, int] = {}
    for line in Path("/proc/meminfo").read_text(encoding="utf-8").splitlines():
        key, raw = line.split(":", 1)
        values[key] = int(raw.strip().split()[0]) * 1024
    return values


def service_state(name: str) -> dict[str, str | int | None]:
    result = subprocess.run(
        [
            "systemctl",
            "show",
            name,
            "--property=ActiveState,MainPID,MemoryCurrent",
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    values = dict(
        line.split("=", 1)
        for line in result.stdout.strip().splitlines()
        if "=" in line
    )
    return {
        "activeState": values.get("ActiveState", "not-found"),
        "mainPid": int(values["MainPID"])
        if values.get("MainPID", "").isdigit()
        else None,
        "memoryCurrentBytes": int(values["MemoryCurrent"])
        if values.get("MemoryCurrent", "").isdigit()
        else None,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--label", required=True)
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    memory = meminfo()
    swap_lines = Path("/proc/swaps").read_text(encoding="utf-8").splitlines()[1:]
    receipt = {
        "schemaVersion": 1,
        "label": arguments.label,
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "memory": {
            "totalBytes": memory["MemTotal"],
            "availableBytes": memory["MemAvailable"],
            "availableFraction": memory["MemAvailable"] / memory["MemTotal"],
        },
        "swapActive": bool(swap_lines),
        "services": {
            "generator": service_state("accelerate-llm.service"),
            "embeddingCandidate": service_state(
                "accelerate-qwen-embedding-bakeoff.service"
            ),
            "rerankerCandidate": service_state(
                "accelerate-qwen-reranker-bakeoff.service"
            ),
        },
    }
    arguments.output.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(receipt, indent=2))


if __name__ == "__main__":
    main()
