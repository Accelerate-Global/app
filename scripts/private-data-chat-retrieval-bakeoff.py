#!/usr/bin/env python3
"""Offline Samson bakeoff for reviewed semantic-card retrieval candidates."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import statistics
import time
import urllib.request
from pathlib import Path
from typing import Any


def post_json(url: str, payload: dict[str, Any]) -> tuple[dict[str, Any], float]:
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={"content-type": "application/json"},
        method="POST",
    )
    started = time.perf_counter()
    with urllib.request.urlopen(request, timeout=120) as response:
        result = json.loads(response.read().decode("utf-8"))
    return result, (time.perf_counter() - started) * 1000


def embed(url: str, texts: list[str]) -> tuple[list[list[float]], float]:
    response, elapsed = post_json(
        f"{url.rstrip('/')}/v1/embeddings",
        {"model": "qwen3-embedding-0.6b", "input": texts, "encoding_format": "float"},
    )
    ordered = sorted(response["data"], key=lambda item: item["index"])
    return [item["embedding"] for item in ordered], elapsed


def cosine(left: list[float], right: list[float]) -> float:
    numerator = sum(a * b for a, b in zip(left, right, strict=True))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return numerator / (left_norm * right_norm)


def eligible_cards(bundle: dict[str, Any], audience: str) -> list[dict[str, Any]]:
    return [
        card
        for card in bundle["cards"]
        if card["sensitivity"] == "private-internal"
        and card["queryAuthority"] != "excluded"
        and audience in card["audiences"]
    ]


def rrf(
    lexical: list[str], dense: list[str], exact: set[str], eligible: set[str]
) -> list[str]:
    lexical = [key for key in lexical if key in eligible]
    dense = [key for key in dense if key in eligible]
    scores: dict[str, float] = {}
    for ranking in (lexical, dense):
        for index, key in enumerate(ranking):
            scores[key] = scores.get(key, 0.0) + 1 / (61 + index)
    return sorted(
        scores,
        key=lambda key: (-int(key in exact), -scores[key], key),
    )


def expand_dependencies(
    ranking: list[str], cards_by_key: dict[str, dict[str, Any]], eligible: set[str]
) -> list[str]:
    selected: list[str] = []
    seen: set[str] = set()

    def add(key: str) -> None:
        if key in seen or key not in eligible or len(selected) >= 6:
            return
        seen.add(key)
        selected.append(key)
        for dependency in cards_by_key[key].get("dependencies", []):
            add(dependency)

    for candidate in ranking:
        add(candidate)
        if len(selected) >= 6:
            break
    return selected


def rerank(
    url: str,
    query: str,
    ranking: list[str],
    cards_by_key: dict[str, dict[str, Any]],
    exact: set[str],
) -> tuple[list[str], float]:
    candidates = ranking[:12]
    response, elapsed = post_json(
        f"{url.rstrip('/')}/v1/rerank",
        {
            "model": "qwen3-reranker-0.6b",
            "query": query,
            "top_n": len(candidates),
            "documents": [cards_by_key[key]["text"] for key in candidates],
        },
    )
    by_index = {
        int(item["index"]): float(item["relevance_score"])
        for item in response["results"]
    }
    ordered = sorted(
        enumerate(candidates),
        key=lambda pair: (
            -int(pair[1] in exact),
            -by_index.get(pair[0], float("-inf")),
            pair[1],
        ),
    )
    return [key for _, key in ordered], elapsed


def reciprocal_rank(selected: list[str], relevant: set[str]) -> float:
    for index, key in enumerate(selected):
        if key in relevant:
            return 1 / (index + 1)
    return 0.0


def ndcg(selected: list[str], relevant: set[str]) -> float:
    dcg = sum(
        1 / math.log2(index + 2)
        for index, key in enumerate(selected[:6])
        if key in relevant
    )
    ideal = sum(
        1 / math.log2(index + 2) for index in range(min(6, len(relevant)))
    )
    return dcg / ideal if ideal else 1.0


def context_bytes(selected: list[str], cards_by_key: dict[str, dict[str, Any]]) -> int:
    return len(
        json.dumps(
            {
                "type": "reviewed-semantic-evidence",
                "instructionAuthority": False,
                "items": [cards_by_key[key]["contextItem"] for key in selected],
            },
            separators=(",", ":"),
            ensure_ascii=False,
        ).encode("utf-8")
    )


def score_tier(
    cases: list[dict[str, Any]],
    tier: str,
    cards_by_key: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    results = []
    for case in cases:
        selected = case[tier]
        relevant = set(case["relevant"])
        required = set(case["required"])
        forbidden = set(case["forbidden"])
        results.append(
            {
                "id": case["id"],
                "partition": case["partition"],
                "critical": case["critical"],
                "selected": selected,
                "recallAt1": 1.0
                if not relevant and not selected
                else float(bool(selected) and selected[0] in relevant),
                "recallAt6": 1.0
                if not relevant and not selected
                else len(relevant.intersection(selected[:6])) / max(1, len(relevant)),
                "ndcgAt6": ndcg(selected, relevant),
                "reciprocalRank": reciprocal_rank(selected, relevant),
                "requiredCovered": required.issubset(selected),
                "forbiddenSelected": sorted(forbidden.intersection(selected)),
                "relevantCount": len(relevant),
                "contextBytes": context_bytes(selected, cards_by_key),
            }
        )
    exact = [result for result in results if result["critical"] and ("exact" in result["id"] or "uupg-definition" in result["id"] or "rop-name-ambiguity" in result["id"])]
    critical = [result for result in results if result["critical"]]
    holdout = [
        result
        for result in results
        if result["partition"] == "holdout" and result["relevantCount"] > 0
    ]
    return {
        "exactCriticalRecallAt1": statistics.fmean(result["recallAt1"] for result in exact),
        "criticalRequiredSetCoverage": statistics.fmean(float(result["requiredCovered"]) for result in critical),
        "holdoutRecallAt6": statistics.fmean(result["recallAt6"] for result in holdout),
        "holdoutNdcgAt6": statistics.fmean(result["ndcgAt6"] for result in holdout),
        "mrr": statistics.fmean(result["reciprocalRank"] for result in results),
        "forbiddenSelectionCount": sum(len(result["forbiddenSelected"]) for result in results),
        "maximumContextBytes": max(result["contextBytes"] for result in results),
        "cases": results,
    }


def percentile(values: list[float], quantile: float) -> float:
    ordered = sorted(values)
    return ordered[max(0, math.ceil(len(ordered) * quantile) - 1)] if ordered else 0.0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("bundle", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--embedding-url", default="http://127.0.0.1:8081")
    parser.add_argument("--reranker-url", default="http://127.0.0.1:8082")
    arguments = parser.parse_args()
    bundle = json.loads(arguments.bundle.read_text(encoding="utf-8"))
    cards_by_key = {card["stableKey"]: card for card in bundle["cards"]}
    card_order = sorted(cards_by_key)
    card_vectors: dict[str, list[float]] = {}
    card_latency = 0.0
    for start in range(0, len(card_order), 16):
        keys = card_order[start : start + 16]
        vectors, elapsed = embed(
            arguments.embedding_url, [cards_by_key[key]["text"] for key in keys]
        )
        card_latency += elapsed
        card_vectors.update(zip(keys, vectors, strict=True))

    cases: list[dict[str, Any]] = []
    embedding_latencies: list[float] = []
    rerank_latencies: list[float] = []
    for case in bundle["cases"]:
        eligible_list = eligible_cards(bundle, case["audience"])
        eligible = {card["stableKey"] for card in eligible_list}
        exact = set(case["exactKeys"]).intersection(eligible)
        if case["expectedReasonCode"] in {"off_topic", "retrieved_content_not_authority"}:
            cases.append({**case, "dense": [], "hybrid": [], "reranked": []})
            continue
        query_text = f"Instruct: {bundle['embeddingInstruction']}\nQuery: {case['question']}"
        query_vectors, elapsed = embed(arguments.embedding_url, [query_text])
        embedding_latencies.append(elapsed)
        dense_scores = sorted(
            (
                (key, cosine(query_vectors[0], card_vectors[key]))
                for key in eligible
            ),
            key=lambda item: (-item[1], item[0]),
        )
        dense_ranking = [key for key, _ in dense_scores]
        dense = expand_dependencies(
            sorted(dense_ranking, key=lambda key: (-int(key in exact), dense_ranking.index(key), key)),
            cards_by_key,
            eligible,
        )
        hybrid_ranking = rrf(case["lexical"], dense_ranking, exact, eligible)
        hybrid = expand_dependencies(hybrid_ranking, cards_by_key, eligible)
        reranked_ranking, rerank_elapsed = rerank(
            arguments.reranker_url,
            query_text,
            hybrid_ranking,
            cards_by_key,
            exact,
        )
        rerank_latencies.append(rerank_elapsed)
        reranked = expand_dependencies(reranked_ranking, cards_by_key, eligible)
        cases.append({**case, "dense": dense, "hybrid": hybrid, "reranked": reranked})

    tier_scores = {
        tier: score_tier(cases, tier, cards_by_key)
        for tier in ("lexical", "dense", "hybrid", "reranked")
    }
    baseline_ndcg = tier_scores["lexical"]["holdoutNdcgAt6"]
    hybrid_gain = tier_scores["hybrid"]["holdoutNdcgAt6"] - baseline_ndcg
    reranker_gain = (
        tier_scores["reranked"]["holdoutNdcgAt6"]
        - tier_scores["hybrid"]["holdoutNdcgAt6"]
    )
    lexical_gates = (
        tier_scores["lexical"]["exactCriticalRecallAt1"] == 1
        and tier_scores["lexical"]["criticalRequiredSetCoverage"] == 1
        and tier_scores["lexical"]["holdoutRecallAt6"] >= 0.95
        and tier_scores["lexical"]["forbiddenSelectionCount"] == 0
        and tier_scores["lexical"]["maximumContextBytes"] <= 8192
    )
    hybrid_gates = (
        tier_scores["hybrid"]["exactCriticalRecallAt1"] == 1
        and tier_scores["hybrid"]["criticalRequiredSetCoverage"] == 1
        and tier_scores["hybrid"]["holdoutRecallAt6"] >= 0.95
        and tier_scores["hybrid"]["forbiddenSelectionCount"] == 0
        and tier_scores["hybrid"]["maximumContextBytes"] <= 8192
    )
    reranker_gates = (
        tier_scores["reranked"]["exactCriticalRecallAt1"] == 1
        and tier_scores["reranked"]["criticalRequiredSetCoverage"] == 1
        and tier_scores["reranked"]["holdoutRecallAt6"] >= 0.95
        and tier_scores["reranked"]["forbiddenSelectionCount"] == 0
        and tier_scores["reranked"]["maximumContextBytes"] <= 8192
    )
    embedding_p95 = percentile(embedding_latencies, 0.95)
    reranker_p95 = percentile(rerank_latencies, 0.95)
    hybrid_promoted = hybrid_gates and hybrid_gain >= 0.03 and embedding_p95 <= 250
    reranker_promoted = (
        hybrid_promoted
        and reranker_gates
        and reranker_gain >= 0.03
        and reranker_p95 <= 500
    )
    selected_tier = (
        "exact-pgvector-rrf-rerank"
        if reranker_promoted
        else "exact-pgvector-rrf"
        if hybrid_promoted
        else "exact-postgres-lexical"
    )
    receipt = {
        "schemaVersion": 1,
        "bundleSha256": hashlib.sha256(arguments.bundle.read_bytes()).hexdigest(),
        "semanticSnapshotChecksum": bundle["semanticSnapshotChecksum"],
        "candidateManifest": bundle["candidateManifest"],
        "caseCount": len(cases),
        "cardCount": len(cards_by_key),
        "metrics": {
            tier: {key: value for key, value in score.items() if key != "cases"}
            for tier, score in tier_scores.items()
        },
        "selection": {
            "hybridNdcgAbsoluteGain": hybrid_gain,
            "rerankerNdcgAbsoluteGain": reranker_gain,
            "hybridMeetsMaterialGain": hybrid_gain >= 0.03,
            "rerankerMeetsMaterialGain": reranker_gain >= 0.03,
            "lexicalMeetsCriticalGates": lexical_gates,
            "hybridMeetsCriticalGates": hybrid_gates,
            "rerankerMeetsCriticalGates": reranker_gates,
            "hybridPromoted": hybrid_promoted,
            "rerankerPromoted": reranker_promoted,
            "selectedTier": selected_tier,
        },
        "latencyMs": {
            "cardEmbeddingTotal": card_latency,
            "queryEmbeddingP50": statistics.median(embedding_latencies),
            "queryEmbeddingP95": embedding_p95,
            "rerankerP50": statistics.median(rerank_latencies),
            "rerankerP95": reranker_p95,
        },
        "cases": {
            tier: score["cases"] for tier, score in tier_scores.items()
        },
    }
    arguments.output.write_text(
        json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(json.dumps({key: value for key, value in receipt.items() if key != "cases"}, indent=2))


if __name__ == "__main__":
    main()
