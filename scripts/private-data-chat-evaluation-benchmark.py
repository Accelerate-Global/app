#!/usr/bin/env python3
"""Run a reviewed private-Qwen planning or grounded-answer bundle."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import socket
import statistics
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def sha256_text(value: str) -> str:
    return sha256_bytes(value.encode("utf-8"))


def canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def sha256_json(value: Any) -> str:
    return sha256_text(canonical_json(value))


def percentile(values: list[float], fraction: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, round((len(ordered) - 1) * fraction)))
    return round(ordered[index], 6)


def evaluate_text_rubric(
    text: str, rubric: dict[str, Any] | None
) -> tuple[bool, str | None]:
    if not rubric:
        return True, None
    normalized = text.casefold()
    normalized_without_grouping = normalized.replace(",", "")
    for term in rubric.get("requiredAll", []):
        normalized_term = str(term).casefold()
        if (
            normalized_term not in normalized
            and normalized_term not in normalized_without_grouping
        ):
            return False, f"missing_required:{term}"
    for alternatives in rubric.get("requiredAny", []):
        if not any(
            str(term).casefold() in normalized
            or str(term).casefold() in normalized_without_grouping
            for term in alternatives
        ):
            return False, "missing_any:" + "|".join(map(str, alternatives))
    for term in rubric.get("forbidden", []):
        if str(term).casefold() in normalized:
            return False, f"forbidden:{term}"
    return True, None


def evaluate_plan(
    case: dict[str, Any], output: dict[str, Any]
) -> tuple[bool, str | None]:
    expected_decision = case["expected_decision"]
    if output.get("decision") != expected_decision:
        return False, f"decision:{output.get('decision')}!={expected_decision}"
    reason = output.get("reason")
    if not isinstance(reason, str) or not reason.strip():
        return False, "missing_reason"

    if expected_decision == "query":
        if output.get("query") != case["expected_query"]:
            return False, "query_mismatch"
        return True, None

    if expected_decision == "resource_query":
        if output.get("resourceQuery") != case["expected_resource_query"]:
            return False, "resource_query_mismatch"
        return True, None

    text_field = "question" if expected_decision == "clarify" else "answer"
    response_text = output.get(text_field)
    if not isinstance(response_text, str) or not response_text.strip():
        return False, f"missing_{text_field}"
    return evaluate_text_rubric(response_text, case.get("text_rubric"))


NUMBER_PATTERN = re.compile(r"-?\d+(?:,\d{3})*(?:\.\d+)?")
VISIBLE_PROVENANCE_PATTERN = re.compile(
    r"\b(?:query[ _-]?id|catalog[ _-]?version|dataset[ _-]?version|datasetversioncreatedat)\b"
    r"|\b20\d{2}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}",
    re.IGNORECASE,
)


def extract_numbers(value: str) -> set[str]:
    return {match.replace(",", "") for match in NUMBER_PATTERN.findall(value)}


def evaluate_answer(
    case: dict[str, Any], output: dict[str, Any]
) -> tuple[bool, str | None]:
    if set(output) != {"answer", "facts"}:
        return False, "invalid_shape"
    if not isinstance(output["answer"], str) or not output["answer"].strip():
        return False, "missing_answer"
    if not isinstance(output["facts"], list):
        return False, "facts_not_array"
    expected = case["expected"]
    if len(output["facts"]) > expected["maximumFacts"]:
        return False, "too_many_facts"
    if any(not isinstance(fact, str) or not fact.strip() for fact in output["facts"]):
        return False, "invalid_fact"

    facts_text = " ".join(output["facts"])
    combined = " ".join([output["answer"], facts_text])
    facts_normalized = facts_text.casefold()
    combined_normalized = combined.casefold()
    if VISIBLE_PROVENANCE_PATTERN.search(combined):
        return False, "visible_provenance"

    available_concepts = {
        concept["key"] for concept in case["semantic_context"].get("concepts", [])
    }
    for key in expected["requiredFactKeys"]:
        if key not in available_concepts:
            return False, f"fixture_missing_fact_key:{key}"
    for value in expected["requiredFactValues"]:
        rendered_value = str(value)
        value_present = rendered_value.casefold() in combined_normalized
        if re.fullmatch(r"-?\d+(?:\.\d+)?", rendered_value):
            value_present = rendered_value in extract_numbers(combined)
        if not value_present:
            return False, f"missing_fact_value:{value}"

    rubric_ok, rubric_error = evaluate_text_rubric(
        combined, expected.get("textRubric")
    )
    if not rubric_ok:
        return False, rubric_error

    allowed_source = canonical_json(case["result"])
    allowed_numbers = extract_numbers(allowed_source)
    claimed_numbers = extract_numbers(combined)
    unsupported_numbers = claimed_numbers - allowed_numbers
    if unsupported_numbers:
        return False, "unsupported_numbers:" + "|".join(sorted(unsupported_numbers))
    return True, None


def call_model(
    endpoint: str,
    api_key: str,
    prompt: str,
    schema: dict[str, Any],
    messages: list[dict[str, str]],
    seed: int,
    timeout_seconds: int,
) -> tuple[dict[str, Any], dict[str, Any]]:
    payload = {
        "model": "local",
        "temperature": 0,
        "seed": seed,
        "max_tokens": 900,
        "messages": [{"role": "system", "content": prompt}, *messages],
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "private_data_chat_capability_evaluation",
                "strict": True,
                "schema": schema,
            },
        },
    }
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload, separators=(",", ":")).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )
    started = time.perf_counter()
    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        completion = json.loads(response.read())
    elapsed = time.perf_counter() - started
    output = json.loads(completion["choices"][0]["message"]["content"])
    usage = completion.get("usage", {})
    return output, {
        "elapsed_seconds": round(elapsed, 6),
        "prompt_tokens": usage.get("prompt_tokens"),
        "completion_tokens": usage.get("completion_tokens"),
    }


def call_model_with_retry(
    endpoint: str,
    api_key: str,
    prompt: str,
    schema: dict[str, Any],
    messages: list[dict[str, str]],
    seed: int,
    timeout_seconds: int,
    retries: int,
) -> tuple[dict[str, Any], dict[str, Any]]:
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            return call_model(
                endpoint,
                api_key,
                prompt,
                schema,
                messages,
                seed,
                timeout_seconds,
            )
        except (
            urllib.error.HTTPError,
            urllib.error.URLError,
            TimeoutError,
            socket.timeout,
        ) as error:
            last_error = error
            if attempt >= retries:
                raise
            time.sleep(min(8, 2 ** (attempt + 1)))
    raise RuntimeError(f"model call failed: {last_error}")


def verify_bundle(suite_dir: Path, manifest: dict[str, Any]) -> None:
    for file_name, expected_hash in manifest["file_sha256"].items():
        actual_hash = sha256_file(suite_dir / file_name)
        if actual_hash != expected_hash:
            raise ValueError(f"bundle hash mismatch for {file_name}")


def load_partial(path: Path) -> dict[tuple[int, str], dict[str, Any]]:
    if not path.exists():
        return {}
    results: dict[tuple[int, str], dict[str, Any]] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        result = json.loads(line)
        results[(result["repetition"], result["case_id"])] = result
    return results


def write_partial(path: Path, result: dict[str, Any]) -> None:
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
        handle.write("\n")
        handle.flush()


def summarize_results(results: list[dict[str, Any]]) -> dict[str, Any]:
    latencies = [
        result["metrics"]["elapsed_seconds"]
        for result in results
        if result.get("metrics") is not None
    ]
    passed = sum(1 for result in results if result["passed"])
    failures = Counter(
        str(result["error"] or "unknown").split(":", 1)[0]
        for result in results
        if not result["passed"]
    )
    by_capability: dict[str, dict[str, int]] = {}
    for result in results:
        capability = result["capability"]
        bucket = by_capability.setdefault(capability, {"passed": 0, "total": 0})
        bucket["total"] += 1
        if result["passed"]:
            bucket["passed"] += 1
    return {
        "passed": passed,
        "total": len(results),
        "failed": len(results) - passed,
        "pass_rate": round(passed / len(results), 6) if results else 0,
        "median_seconds": round(statistics.median(latencies), 6)
        if latencies
        else None,
        "p95_seconds": percentile(latencies, 0.95),
        "failures_by_code": dict(sorted(failures.items())),
        "by_capability": dict(sorted(by_capability.items())),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["plan", "answer"], required=True)
    parser.add_argument("--suite-dir", required=True)
    parser.add_argument("--api-key-file", required=True)
    parser.add_argument(
        "--endpoint", default="http://127.0.0.1:8080/v1/chat/completions"
    )
    parser.add_argument("--repetitions", type=int, required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--label", required=True)
    parser.add_argument("--seed", type=int, default=20260830)
    parser.add_argument("--timeout-seconds", type=int, default=110)
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--case-ids-file")
    args = parser.parse_args()

    suite_dir = Path(args.suite_dir)
    manifest = json.loads((suite_dir / "manifest.json").read_text(encoding="utf-8"))
    verify_bundle(suite_dir, manifest)
    prefix = "plan" if args.mode == "plan" else "answer"
    cases_path = suite_dir / f"{prefix}-cases.json"
    prompt_path = suite_dir / f"{prefix}-prompt.txt"
    schema_path = suite_dir / f"{prefix}-schema.json"
    cases_document = json.loads(cases_path.read_text(encoding="utf-8"))
    prompt = prompt_path.read_text(encoding="utf-8").rstrip("\n")
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    api_key = Path(args.api_key_file).read_text(encoding="utf-8").strip()
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    partial_path = Path(f"{output_path}.partial.jsonl")
    if output_path.exists():
        raise FileExistsError(f"refusing to overwrite completed receipt {output_path}")
    if partial_path.exists() and not args.resume:
        raise FileExistsError(
            f"partial receipt exists; pass --resume or choose another output: {partial_path}"
        )
    prior = load_partial(partial_path) if args.resume else {}

    expected_cases_hash_key = (
        "planner_cases_sha256" if args.mode == "plan" else "answer_cases_sha256"
    )
    contract_prefix = "planner" if args.mode == "plan" else "answer"
    if sha256_json(cases_document) != manifest["hashes"][expected_cases_hash_key]:
        raise ValueError(f"canonical {prefix} case hash mismatch")
    if sha256_text(prompt) != manifest["hashes"][f"{contract_prefix}_prompt_sha256"]:
        raise ValueError(f"canonical {prefix} prompt hash mismatch")
    if sha256_json(schema) != manifest["hashes"][f"{contract_prefix}_schema_sha256"]:
        raise ValueError(f"canonical {prefix} schema hash mismatch")

    selected_cases = cases_document["cases"]
    selected_case_ids_sha256 = None
    if args.case_ids_file:
        case_ids_path = Path(args.case_ids_file)
        requested_ids = {
            line.strip()
            for line in case_ids_path.read_text(encoding="utf-8").splitlines()
            if line.strip()
        }
        known_ids = {case["id"] for case in selected_cases}
        unknown_ids = requested_ids - known_ids
        if unknown_ids:
            raise ValueError(
                "unknown requested case IDs: " + ",".join(sorted(unknown_ids))
            )
        selected_cases = [case for case in selected_cases if case["id"] in requested_ids]
        selected_case_ids_sha256 = sha256_file(case_ids_path)

    total_work = len(selected_cases) * args.repetitions
    completed = len(prior)
    for repetition in range(1, args.repetitions + 1):
        for case in selected_cases:
            result_key = (repetition, case["id"])
            if result_key in prior:
                continue
            if args.mode == "plan":
                messages = case["messages"]
            else:
                messages = [
                    {
                        "role": "user",
                        "content": json.dumps(
                            {
                                "question": case["question"],
                                "semanticContext": case["semantic_context"],
                                "queryResult": case["result"],
                            },
                            ensure_ascii=False,
                            separators=(",", ":"),
                        ),
                    }
                ]
            try:
                output, metrics = call_model_with_retry(
                    args.endpoint,
                    api_key,
                    prompt,
                    schema,
                    messages,
                    args.seed,
                    args.timeout_seconds,
                    args.retries,
                )
                passed, error = (
                    evaluate_plan(case, output)
                    if args.mode == "plan"
                    else evaluate_answer(case, output)
                )
                result = {
                    "repetition": repetition,
                    "case_id": case["id"],
                    "tier": case["tier"],
                    "capability": case["capability"],
                    "risk": case["risk"],
                    "passed": passed,
                    "error": error,
                    "output": output,
                    "metrics": metrics,
                }
            except Exception as error:
                result = {
                    "repetition": repetition,
                    "case_id": case["id"],
                    "tier": case["tier"],
                    "capability": case["capability"],
                    "risk": case["risk"],
                    "passed": False,
                    "error": f"{type(error).__name__}:{error}",
                    "output": None,
                    "metrics": None,
                }
            write_partial(partial_path, result)
            prior[result_key] = result
            completed += 1
            print(
                json.dumps(
                    {
                        "completed": completed,
                        "total": total_work,
                        "repetition": repetition,
                        "case": case["id"],
                        "passed": result["passed"],
                        "error": result["error"],
                    },
                    separators=(",", ":"),
                ),
                flush=True,
            )

    ordered_results = [
        prior[(repetition, case["id"])]
        for repetition in range(1, args.repetitions + 1)
        for case in selected_cases
    ]
    summary = summarize_results(ordered_results)
    receipt = {
        "suite_id": cases_document["suite_id"],
        "run_label": args.label,
        "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "model": {
            "name": "Qwen 3.6 35B-A3B Q4_K_M",
            "artifact_sha256": manifest["contract"]["model_artifact_sha256"],
            "runtime_revision": manifest["contract"]["runtime_revision"],
            "context_tokens": 16384,
        },
        "contract": manifest["contract"],
        "contract_hashes": manifest["hashes"],
        "bundle_file_sha256": manifest["file_sha256"],
        "mode": args.mode,
        "repetitions": args.repetitions,
        "selected_case_count": len(selected_cases),
        "selected_case_ids_sha256": selected_case_ids_sha256,
        "summary": summary,
        "results": ordered_results,
    }
    output_path.write_text(
        json.dumps(receipt, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(summary, separators=(",", ":")), flush=True)
    return 0 if summary["failed"] == 0 else 1


def self_test() -> int:
    query_case = {
        "expected_decision": "query",
        "expected_query": {"mode": "aggregate", "limit": 1},
    }
    assert evaluate_plan(
        query_case,
        {
            "decision": "query",
            "reason": "Count records.",
            "query": {"mode": "aggregate", "limit": 1},
        },
    ) == (True, None)
    assert evaluate_plan(
        {
            "expected_decision": "clarify",
            "expected_query": None,
            "text_rubric": {
                "requiredAll": ["how many"],
                "forbidden": ["top 10"],
            },
        },
        {
            "decision": "clarify",
            "reason": "A bound is missing.",
            "question": "How many should I return?",
        },
    ) == (True, None)
    answer_case = {
        "result": {
            "rows": [{"people_group_count": "37"}],
            "provenance": {"rowCount": 1},
        },
        "semantic_context": {"concepts": [{"key": "people_group_count"}]},
        "expected": {
            "requiredFactKeys": ["people_group_count"],
            "requiredFactValues": ["37"],
            "maximumFacts": 20,
            "textRubric": {"requiredAll": ["37"]},
        },
    }
    assert evaluate_answer(
        answer_case,
        {
            "answer": "There are 37 people groups.",
            "facts": ["people_group_count: 37"],
        },
    ) == (True, None)
    passed, error = evaluate_answer(
        answer_case,
        {
            "answer": "There are 38 people groups.",
            "facts": ["people_group_count: 38"],
        },
    )
    assert not passed and error is not None
    print("private-data-chat evaluation benchmark self-test passed")
    return 0


if __name__ == "__main__":
    if sys.argv[1:] == ["--self-test"]:
        raise SystemExit(self_test())
    raise SystemExit(main())
