"""Sentinel eval CLI — the CI regression gate (Module M5).

Runs an eval set against a live Sentinel gateway and exits non-zero if any
metric regresses below the baseline, so a GitHub Action can block the build.

Usage:
    python -m cli.eval_runner \
        --url http://localhost:8000 \
        --api-key sentinel-demo-key \
        --agent-id <AGENT_ID> \
        --file evals/support-bot.json
"""

from __future__ import annotations

import argparse
import json
import sys

import httpx


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a Sentinel eval set as a CI gate.")
    parser.add_argument("--url", default="http://localhost:8000")
    parser.add_argument("--api-key", required=True)
    parser.add_argument("--agent-id", required=True)
    parser.add_argument("--file", required=True, help="Path to eval set JSON")
    parser.add_argument("--baseline", type=float, default=None,
                        help="Override the eval file's baseline")
    args = parser.parse_args()

    with open(args.file) as fh:
        spec = json.load(fh)

    payload = {
        "agent_id": args.agent_id,
        "eval_set": spec.get("eval_set", "default"),
        "cases": spec["cases"],
        "baseline": args.baseline if args.baseline is not None else spec.get("baseline", 0.7),
    }

    resp = httpx.post(
        f"{args.url}/v1/evals/run",
        headers={"Authorization": f"Bearer {args.api_key}"},
        json=payload,
        timeout=120,
    )
    resp.raise_for_status()
    result = resp.json()

    baselines = result["baselines"]
    print(f"\nEval set '{result['eval_set']}'")
    print("-" * 60)
    for metric, score in result["metrics"].items():
        base = baselines[metric]
        mark = "PASS" if score >= base else "FAIL"
        print(f"  {metric:<22} {score:>6.3f}  (baseline {base:.3f})  [{mark}]")
    print("-" * 60)

    if result["passed"]:
        print("RESULT: PASS — no regression against baseline.\n")
        return 0
    print("RESULT: FAIL — a metric regressed below baseline. Blocking build.\n")
    return 1


if __name__ == "__main__":
    sys.exit(main())
