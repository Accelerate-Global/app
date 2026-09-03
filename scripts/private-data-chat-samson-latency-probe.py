#!/usr/bin/env python3
"""Measure sanitized local-Qwen planner latency without retaining model output."""

from __future__ import annotations

import argparse
import json
import math
import statistics
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


def percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    return ordered[max(0, math.ceil(len(ordered) * fraction) - 1)]


def summary(values: list[float]) -> dict[str, float | None]:
    return {
        "p50": statistics.median(values) if values else None,
        "p95": percentile(values, 0.95) if values else None,
    }


def finite_number(value: object) -> float | None:
    if isinstance(value, (int, float)) and math.isfinite(value) and value >= 0:
        return float(value)
    return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt", type=Path, required=True)
    parser.add_argument("--schema", type=Path, required=True)
    parser.add_argument("--api-key-file", type=Path, required=True)
    parser.add_argument("--repetitions", type=int, default=3)
    parser.add_argument("--timeout-seconds", type=int, default=210)
    parser.add_argument("--label", required=True)
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    prompt = arguments.prompt.read_text(encoding="utf-8").rstrip("\n")
    schema = json.loads(arguments.schema.read_text(encoding="utf-8"))
    api_key = arguments.api_key_file.read_text(encoding="utf-8").strip()
    latencies: list[float] = []
    prompt_latencies: list[float] = []
    generation_latencies: list[float] = []
    samples: list[dict[str, float | int | None]] = []
    failures = 0
    for repetition in range(arguments.repetitions):
        payload = {
            "model": "local",
            "temperature": 0,
            "seed": 20260831 + repetition,
            "max_tokens": 700,
            "messages": [
                {"role": "system", "content": prompt},
                {
                    "role": "user",
                    "content": "Count people groups in Sudan using the approved current dataset.",
                },
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "private_data_chat_latency_probe",
                    "strict": True,
                    "schema": schema,
                },
            },
        }
        request = urllib.request.Request(
            "http://127.0.0.1:8080/v1/chat/completions",
            data=json.dumps(payload, separators=(",", ":")).encode("utf-8"),
            headers={
                "content-type": "application/json",
                "authorization": f"Bearer {api_key}",
            },
            method="POST",
        )
        started = time.perf_counter()
        try:
            with urllib.request.urlopen(
                request, timeout=arguments.timeout_seconds
            ) as response:
                completion = json.loads(response.read().decode("utf-8"))
            output = json.loads(completion["choices"][0]["message"]["content"])
            if not isinstance(output, dict) or "decision" not in output:
                raise ValueError("invalid structured output")
            wall_latency = (time.perf_counter() - started) * 1000
            timings = completion.get("timings", {})
            usage = completion.get("usage", {})
            prompt_latency = finite_number(timings.get("prompt_ms"))
            generation_latency = finite_number(timings.get("predicted_ms"))
            prompt_tokens = usage.get("prompt_tokens")
            evaluated_prompt_tokens = timings.get("prompt_n")
            completion_tokens = usage.get("completion_tokens")
            cached_prompt_tokens = (
                max(0, prompt_tokens - evaluated_prompt_tokens)
                if isinstance(prompt_tokens, int)
                and isinstance(evaluated_prompt_tokens, int)
                else None
            )
            latencies.append(wall_latency)
            if prompt_latency is not None:
                prompt_latencies.append(prompt_latency)
            if generation_latency is not None:
                generation_latencies.append(generation_latency)
            samples.append(
                {
                    "repetition": repetition + 1,
                    "wallMs": wall_latency,
                    "promptMs": prompt_latency,
                    "generationMs": generation_latency,
                    "promptTokens": prompt_tokens
                    if isinstance(prompt_tokens, int)
                    else None,
                    "evaluatedPromptTokens": evaluated_prompt_tokens
                    if isinstance(evaluated_prompt_tokens, int)
                    else None,
                    "cachedPromptTokens": cached_prompt_tokens,
                    "completionTokens": completion_tokens
                    if isinstance(completion_tokens, int)
                    else None,
                }
            )
        except Exception:
            failures += 1
    receipt = {
        "schemaVersion": 2,
        "label": arguments.label,
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "repetitions": arguments.repetitions,
        "successes": len(latencies),
        "failures": failures,
        "samples": samples,
        "latencyMs": {
            "median": statistics.median(latencies) if latencies else None,
            "p95": percentile(latencies, 0.95) if latencies else None,
            "wall": summary(latencies),
            "prompt": summary(prompt_latencies),
            "generation": summary(generation_latencies),
        },
    }
    arguments.output.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(receipt, indent=2))
    if failures or not latencies:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
