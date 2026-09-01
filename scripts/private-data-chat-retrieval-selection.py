#!/usr/bin/env python3
"""Combine retrieval quality and Samson resource receipts into one final tier choice."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


def load(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bakeoff", type=Path, required=True)
    parser.add_argument("--concurrent-probe", type=Path, required=True)
    parser.add_argument("--baseline-probe", type=Path, required=True)
    parser.add_argument("--resource-snapshot", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    bakeoff = load(arguments.bakeoff)
    concurrent = load(arguments.concurrent_probe)
    baseline = load(arguments.baseline_probe)
    resources = load(arguments.resource_snapshot)
    concurrent_p95 = concurrent["latencyMs"]["p95"]
    baseline_p95 = baseline["latencyMs"]["p95"]
    degradation = (
        (concurrent_p95 - baseline_p95) / baseline_p95
        if baseline_p95 and concurrent_p95
        else None
    )
    resource_gate = (
        concurrent["failures"] == 0
        and baseline["failures"] == 0
        and degradation is not None
        and degradation <= 0.05
        and not resources["swapActive"]
        and resources["memory"]["availableFraction"] >= 0.10
    )
    quality = bakeoff["selection"]
    hybrid_selected = quality["hybridPromoted"] and resource_gate
    reranker_selected = quality["rerankerPromoted"] and resource_gate
    selected = (
        "exact-pgvector-rrf-rerank"
        if reranker_selected
        else "exact-pgvector-rrf"
        if hybrid_selected
        else "exact-postgres-lexical"
    )
    receipt = {
        "schemaVersion": 1,
        "inputSha256": {
            "bakeoff": digest(arguments.bakeoff),
            "concurrentProbe": digest(arguments.concurrent_probe),
            "baselineProbe": digest(arguments.baseline_probe),
            "resourceSnapshot": digest(arguments.resource_snapshot),
        },
        "selectedTier": selected,
        "gates": {
            "lexicalCritical": quality["lexicalMeetsCriticalGates"],
            "hybridQualityAndLatency": quality["hybridPromoted"],
            "rerankerQualityAndLatency": quality["rerankerPromoted"],
            "noGenerativeFailures": concurrent["failures"] == 0,
            "generativeP95DegradationAtMostFivePercent": degradation is not None
            and degradation <= 0.05,
            "noSwap": not resources["swapActive"],
            "atLeastTenPercentMemoryAvailable": resources["memory"][
                "availableFraction"
            ]
            >= 0.10,
            "denseResourceGate": resource_gate,
        },
        "generativeP95DegradationFraction": degradation,
        "decision": "Dense and reranking candidates remain undeployed unless every quality, latency, memory, swap, and generative-impact gate passes.",
    }
    arguments.output.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(receipt, indent=2))
    if not receipt["gates"]["lexicalCritical"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
