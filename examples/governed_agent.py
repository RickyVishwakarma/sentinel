"""Governed agent demo — what Sentinel actually buys you.

A small support agent is given three tasks. It decides which tool to call for
each (its *thinking* runs through the Sentinel gateway, so every call is traced,
guardrailed, and cost-attributed). Before it may run a tool, it asks Sentinel's
policy decision point whether the *action* is allowed:

    check_order_status  → ALLOW  (no policy matched)
    delete_customer     → DENY   (policy: delete_* is never automated)
    refund $5,000       → HELD   (policy: refunds over $100 need a human)
                               → a human approves → the agent proceeds

This is the integration example too: an external agent talks to Sentinel over
plain HTTP. Nothing here imports the app — this is how *your* agent wires in.

Usage:
    python -m examples.governed_agent                 # waits for a human on the hold
    python -m examples.governed_agent --auto-approve  # approves it for you (unattended)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time

import httpx

# ── the agent's tools (side effects live on your side, not Sentinel's) ──────

TOOLS = """
- check_order_status(order_id: string)      — look up an order
- delete_customer(customer_id: string)      — permanently erase a customer record
- refund(amount: number, customer: string)  — refund money to a customer
"""

SYSTEM_PROMPT = (
    "You are an operations agent for an e-commerce company. You have these tools:\n"
    f"{TOOLS}\n"
    "Given the user's request, choose exactly ONE tool call. "
    'Reply with ONLY a JSON object, no prose, no code fences: '
    '{"tool": "<tool_name>", "arguments": {...}}'
)

TASKS = [
    "A customer is asking where order 1234 is. Look it up.",
    "Customer 88 asked to be forgotten. Remove their record.",
    "Acme was double-charged $5000 on a bad invoice. Make them whole.",
]

# Deterministic plan, used when the LLM is unavailable (keyless / template mode)
# so the demo always tells the same story.
FALLBACK_PLAN = [
    {"tool": "check_order_status", "arguments": {"order_id": "1234"}},
    {"tool": "delete_customer", "arguments": {"customer_id": "88"}},
    {"tool": "refund", "arguments": {"amount": 5000, "customer": "acme"}},
]

POLICIES = [
    {
        "tool": "delete_*",
        "effect": "deny",
        "priority": 10,
        "description": "Deleting customer data is never automated",
    },
    {
        "tool": "refund",
        "effect": "require_approval",
        "priority": 20,
        "condition": {"field": "amount", "op": "gt", "value": 100},
        "description": "Refunds over $100 need a human",
    },
]


def execute(tool: str, args: dict) -> str:
    """Pretend to perform the side effect. Your real tools go here."""
    if tool == "check_order_status":
        return f"Order {args.get('order_id')} shipped — arriving Tuesday."
    if tool == "refund":
        return f"Refunded ${args.get('amount')} to {args.get('customer')}."
    if tool == "delete_customer":
        return f"Customer {args.get('customer_id')} erased."
    return f"{tool} done."


# ── a thin Sentinel client (plain HTTP — this is the whole integration) ─────

class Sentinel:
    def __init__(self, url: str, api_key: str) -> None:
        self.url = url.rstrip("/")
        self.http = httpx.Client(
            base_url=self.url,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=60,
        )

    def _json(self, r: httpx.Response):
        r.raise_for_status()
        return r.json()

    def ensure_agent(self, name: str, model: str) -> str:
        agents = self._json(self.http.get("/v1/agents"))
        for a in agents:
            if a["name"] == name:
                return a["id"]
        created = self._json(self.http.post("/v1/agents", json={
            "name": name,
            "model": model,
            "system_prompt": SYSTEM_PROMPT,
            "guardrails": ["pii_redaction", "prompt_injection", "output_blocklist"],
            "fallback_chain": ["gemini", "anthropic", "openai"],
        }))
        return created["id"]

    def ensure_policies(self, agent_id: str) -> list[dict]:
        existing = self._json(self.http.get("/v1/policies"))["entries"]
        have = {(p["tool"], p["effect"]) for p in existing}
        for spec in POLICIES:
            if (spec["tool"], spec["effect"]) in have:
                continue
            self.http.post("/v1/policies", json={**spec, "agent_id": agent_id}).raise_for_status()
        return self._json(self.http.get("/v1/policies"))["entries"]

    def think(self, agent_id: str, task: str) -> str:
        """The agent's LLM call — through the gateway, so it's traced + governed."""
        return self._json(self.http.post(f"/v1/agents/{agent_id}/run", json={"input": task}))

    def check(self, agent_id: str, tool: str, arguments: dict) -> dict:
        """The policy decision point: may the agent perform this action?"""
        return self._json(self.http.post(
            f"/v1/agents/{agent_id}/actions/check",
            json={"tool": tool, "arguments": arguments},
        ))

    def action(self, action_id: str) -> dict:
        return self._json(self.http.get(f"/v1/actions/{action_id}"))

    def approve(self, approval_id: str, note: str = "") -> dict:
        return self._json(self.http.post(
            f"/v1/approvals/{approval_id}/decide",
            json={"decision": "approve", "note": note},
        ))

    def audit(self, limit: int = 8) -> list[dict]:
        return self._json(self.http.get("/v1/audit"))["entries"][:limit]


# ── output helpers ─────────────────────────────────────────────────────────

BOLD, DIM, RESET = "\033[1m", "\033[2m", "\033[0m"
GREEN, RED, YELLOW, BLUE, GREY = (
    "\033[32m", "\033[31m", "\033[33m", "\033[36m", "\033[90m",
)
VERDICT = {
    "allow": f"{GREEN}ALLOW{RESET}",
    "deny": f"{RED}DENY{RESET}",
    "pending": f"{YELLOW}HELD{RESET}",
    "approved": f"{GREEN}APPROVED{RESET}",
    "denied": f"{RED}DENIED{RESET}",
}
RULE = GREY + "─" * 72 + RESET


def parse_tool_call(text: str) -> dict | None:
    """Pull the {"tool": ..., "arguments": {...}} object out of the LLM reply."""
    match = re.search(r"\{.*\}", text or "", re.S)
    if not match:
        return None
    try:
        obj = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    if not isinstance(obj, dict) or "tool" not in obj:
        return None
    obj.setdefault("arguments", {})
    return obj


def main() -> int:
    # Windows consoles default to cp1252 and choke on the arrows/box glyphs.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):  # pragma: no cover
        pass

    ap = argparse.ArgumentParser(description="Sentinel governed-agent demo")
    ap.add_argument("--url", default="http://localhost:8000")
    ap.add_argument("--api-key", default="sentinel-demo-key")
    ap.add_argument("--model", default="gemini-2.5-flash")
    ap.add_argument("--agent-name", default="ops-bot")
    ap.add_argument("--auto-approve", action="store_true",
                    help="approve the held action automatically instead of waiting for a human")
    args = ap.parse_args()

    s = Sentinel(args.url, args.api_key)
    try:
        agent_id = s.ensure_agent(args.agent_name, args.model)
    except httpx.HTTPError as exc:
        print(f"{RED}Could not reach the gateway at {args.url}{RESET}\n  {exc}")
        print(f"{DIM}Start it with:  uvicorn app.main:app{RESET}")
        return 1

    policies = s.ensure_policies(agent_id)

    print(f"\n{BOLD}Sentinel — governed agent demo{RESET}")
    print(f"{DIM}gateway {args.url}   agent {args.agent_name}   brain {args.model}{RESET}\n")
    print(f"{BOLD}Policies in force{RESET}")
    for p in sorted(policies, key=lambda p: p["priority"]):
        cond = p.get("condition")
        cond_s = f" ({cond['field']} {cond['op']} {cond['value']})" if cond else ""
        print(f"  {GREY}{p['priority']:>3}{RESET}  {BLUE}{p['tool']}{cond_s}{RESET}"
              f"  → {p['effect']}  {GREY}{p['description']}{RESET}")
    print(f"  {GREY}  –  (no match)                → allow{RESET}")

    for i, task in enumerate(TASKS, 1):
        print(f"\n{RULE}\n{BOLD}[{i}/{len(TASKS)}]{RESET} {task}")

        # 1. the agent thinks — through the gateway (traced, guardrailed, priced)
        run = s.think(agent_id, task)
        call = parse_tool_call(run.get("output", "")) or FALLBACK_PLAN[i - 1]
        via = run.get("provider") or "?"
        note = "" if parse_tool_call(run.get("output", "")) else f" {GREY}(fallback plan){RESET}"
        arg_s = ", ".join(f"{k}={v!r}" for k, v in call["arguments"].items())
        print(f"  {GREY}thinking via {via} · trace {run.get('trace_id','')[:12]}…"
              f" · ${run.get('cost', 0):.5f}{RESET}")
        print(f"  agent decided: {BLUE}{call['tool']}{RESET}({arg_s}){note}")

        # 2. the agent asks permission — the policy decision point
        decision = s.check(agent_id, call["tool"], call["arguments"])
        verdict = VERDICT.get(decision["decision"], decision["decision"])
        print(f"  sentinel:      {verdict} — {decision['reason']}")

        if decision["decision"] == "allow":
            print(f"  executed:      {execute(call['tool'], call['arguments'])}")
            continue

        if decision["decision"] == "deny":
            print(f"  {DIM}not executed — the agent is told it may not proceed.{RESET}")
            continue

        # 3. held → a human decides
        approval_id = decision["approval_id"]
        print(f"  {DIM}approval {approval_id[:12]}… — review at "
              f"http://localhost:3000/approvals{RESET}")
        if args.auto_approve:
            time.sleep(1)
            s.approve(approval_id, note="approved by the demo")
            print(f"  {GREY}(auto-approved for this demo){RESET}")
        else:
            print(f"  {YELLOW}waiting for a human to approve or deny…{RESET} {DIM}(Ctrl-C to stop){RESET}")

        final = decision
        while final["decision"] == "pending":
            time.sleep(2)
            final = s.action(decision["action_id"])
        print(f"  human:         {VERDICT.get(final['decision'], final['decision'])}")
        if final["decision"] == "approved":
            print(f"  executed:      {execute(call['tool'], call['arguments'])}")
        else:
            print(f"  {DIM}not executed.{RESET}")

    # 4. the paper trail
    print(f"\n{RULE}\n{BOLD}Audit trail{RESET} {GREY}(newest first){RESET}")
    for e in s.audit():
        meta = e.get("metadata") or {}
        detail = meta.get("tool") or meta.get("provider") or ""
        print(f"  {GREY}{e['ts'][11:19]}{RESET}  {e['action']:<18} {BLUE}{detail}{RESET}")
    print(f"\n{DIM}Every decision above is queryable: GET /v1/actions, /v1/audit{RESET}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
