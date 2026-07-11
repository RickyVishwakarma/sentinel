"""Load test: N concurrent runs through the gateway (demo acceptance 06).

Measures end-to-end latency and throughput, plus the gateway's own overhead
(pipeline time minus the LLM span) against the PRD's < 50ms p95 target.

Usage:
    python -m scripts.load_test --url http://localhost:8000 \
        --api-key sentinel-demo-key --agent-id <AGENT_ID> \
        --requests 200 --concurrency 20
"""

from __future__ import annotations

import argparse
import asyncio
import statistics
import sys
import time

import httpx


def pct(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    values = sorted(values)
    k = min(len(values) - 1, max(0, round(p / 100 * len(values)) - 1))
    return values[k]


async def one_run(client: httpx.AsyncClient, url: str, agent_id: str, i: int) -> tuple[float, int, float]:
    """Returns (wall_ms, status_code, gateway_overhead_ms)."""
    t0 = time.perf_counter()
    resp = await client.post(
        f"{url}/v1/agents/{agent_id}/run",
        json={"input": f"Load test question #{i}: what are your business hours?"},
    )
    wall_ms = (time.perf_counter() - t0) * 1000
    overhead_ms = 0.0
    if resp.status_code == 200:
        body = resp.json()
        # run latency includes the LLM call; fetch the trace to subtract it
        trace = await client.get(f"{url}/v1/traces/{body['trace_id']}")
        if trace.status_code == 200:
            spans = trace.json().get("spans", [])
            llm_ms = sum(s.get("latency_ms", 0) for s in spans if s.get("type") == "llm")
            overhead_ms = max(0.0, body["latency_ms"] - llm_ms)
    return wall_ms, resp.status_code, overhead_ms


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:8000")
    ap.add_argument("--api-key", required=True)
    ap.add_argument("--agent-id", required=True)
    ap.add_argument("--requests", type=int, default=200)
    ap.add_argument("--concurrency", type=int, default=20)
    args = ap.parse_args()

    sem = asyncio.Semaphore(args.concurrency)
    latencies: list[float] = []
    overheads: list[float] = []
    by_status: dict[str, int] = {}

    async with httpx.AsyncClient(
        headers={"Authorization": f"Bearer {args.api_key}"}, timeout=60
    ) as client:

        async def bounded(i: int) -> None:
            async with sem:
                try:
                    wall, code, overhead = await one_run(client, args.url, args.agent_id, i)
                    by_status[str(code)] = by_status.get(str(code), 0) + 1
                    if code == 200:
                        latencies.append(wall)
                        overheads.append(overhead)
                except Exception as exc:
                    key = type(exc).__name__
                    by_status[key] = by_status.get(key, 0) + 1

        t0 = time.perf_counter()
        await asyncio.gather(*(bounded(i) for i in range(args.requests)))
        elapsed = time.perf_counter() - t0

    n = len(latencies)
    errors = sum(v for k, v in by_status.items() if k not in ("200", "429"))
    rate_limited = by_status.get("429", 0)
    print(f"\nLoad test — {args.requests} requests, concurrency {args.concurrency}")
    print("-" * 56)
    print(f"  succeeded            {n}")
    print(f"  rate-limited (429)   {rate_limited}  (raise RATE_LIMIT_PER_MINUTE to load-test past it)")
    print(f"  errors               {errors}  {by_status if errors else ''}")
    print(f"  throughput           {n / elapsed:,.1f} req/s")
    if n:
        print(f"  wall latency p50     {pct(latencies, 50):,.1f} ms")
        print(f"  wall latency p95     {pct(latencies, 95):,.1f} ms")
        print(f"  wall latency p99     {pct(latencies, 99):,.1f} ms")
        print(f"  wall latency mean    {statistics.mean(latencies):,.1f} ms")
        print("-" * 56)
        p95_overhead = pct(overheads, 95)
        print(f"  gateway overhead p50 {pct(overheads, 50):,.1f} ms  (pipeline minus LLM span)")
        print(f"  gateway overhead p95 {p95_overhead:,.1f} ms  (PRD target < 50 ms)")
        print("-" * 56)
        verdict = "PASS" if p95_overhead < 50 else "FAIL"
        print(f"RESULT: {verdict}\n")
        return 0 if verdict == "PASS" and errors == 0 else 1
    print("RESULT: FAIL — no successful requests\n")
    return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
