"""Eval harness (Module M5).

Runs an eval set through the gateway and scores three metrics. The scoring is
deliberately deterministic (token-overlap heuristics) so the harness is itself
self-testable and CI-stable — a real deployment would add an LLM-judge here and
combine it with these deterministic checks, as the PRD's risk table notes.

A metric scoring below ``baseline`` marks the eval as failed; the CLI turns that
into a non-zero exit code so a GitHub Action can block the build.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.gateway import GatewayError, execute_run
from app.judge import judge_available, judge_score
from app.models import Agent, AgentVersion, EvalResult, User

_WORD = re.compile(r"[a-z0-9]+")


def _tokens(text: str) -> set[str]:
    return set(_WORD.findall(text.lower()))


def _overlap(a: str, b: str) -> float:
    ta, tb = _tokens(a), _tokens(b)
    if not tb:
        return 1.0 if not ta else 0.0
    return len(ta & tb) / len(tb)


@dataclass
class CaseResult:
    input: str
    output: str
    status: str
    expect_blocked: bool
    answer_relevance: float | None  # None for expect_blocked cases (not scored)
    faithfulness: float | None
    guardrail_pass: bool
    llm_judge: float | None = None      # None when no judge model is configured
    judge_reason: str = ""


def _baselines(baseline: float | dict, metrics: tuple[str, ...]) -> dict[str, float]:
    if isinstance(baseline, dict):
        return {m: float(baseline.get(m, 0.0)) for m in metrics}
    return {m: float(baseline) for m in metrics}


def run_eval(
    db: Session,
    *,
    user: User,
    agent: Agent,
    version: AgentVersion,
    cases: list[dict],
    eval_set: str,
    baseline: float | dict,
) -> dict:
    """Execute each case and aggregate per-metric scores against the baseline."""
    case_results: list[CaseResult] = []

    for case in cases:
        expected = case.get("expected", "")
        expect_blocked = bool(case.get("expect_blocked", False))
        try:
            res = execute_run(
                db,
                user=user,
                agent=agent,
                version=version,
                input_text=case["input"],
                requested_tools=[],
            )
            output, status = res["output"], res["status"]
        except GatewayError as exc:
            output, status = f"[gateway-error] {exc.detail}", "error"

        # A case that SHOULD be blocked (injection probe) passes when it IS
        # blocked; quality metrics don't apply to it — there's no answer to score.
        judge = None
        judge_reason = ""
        if expect_blocked:
            guardrail_pass = status == "blocked"
            relevance = faithfulness = None
        else:
            guardrail_pass = status == "ok"
            # answer_relevance: does the output cover the reference answer / question?
            relevance = round(_overlap(output, expected or case["input"]), 4)
            # faithfulness: is the output grounded in the expected answer (no drift)?
            faithfulness = round(_overlap(expected, output), 4) if expected else relevance
            if judge_available():
                scored = judge_score(case["input"], expected, output)
                if scored is not None:
                    judge, judge_reason = round(scored[0], 4), scored[1]

        case_results.append(
            CaseResult(
                input=case["input"],
                output=output,
                status=status,
                expect_blocked=expect_blocked,
                answer_relevance=relevance,
                faithfulness=faithfulness,
                guardrail_pass=guardrail_pass,
                llm_judge=judge,
                judge_reason=judge_reason,
            )
        )

    scored = [c for c in case_results if not c.expect_blocked]
    n_scored = max(1, len(scored))
    n_all = max(1, len(case_results))
    metrics = {
        "answer_relevance": round(sum(c.answer_relevance for c in scored) / n_scored, 4),
        "faithfulness": round(sum(c.faithfulness for c in scored) / n_scored, 4),
        "guardrail_pass_rate": round(sum(c.guardrail_pass for c in case_results) / n_all, 4),
    }
    judged = [c.llm_judge for c in scored if c.llm_judge is not None]
    if judged:
        metrics["llm_judge"] = round(sum(judged) / len(judged), 4)

    baselines = _baselines(baseline, tuple(metrics))
    passed_all = True
    for metric, score in metrics.items():
        passed = score >= baselines[metric]
        passed_all = passed_all and passed
        db.add(
            EvalResult(
                agent_version_id=version.id,
                eval_set=eval_set,
                metric=metric,
                score=score,
                baseline=baselines[metric],
                passed=passed,
            )
        )
    db.commit()

    return {
        "agent_id": agent.id,
        "agent_version": version.version,
        "eval_set": eval_set,
        "baselines": baselines,
        "metrics": metrics,
        "passed": passed_all,
        "cases": [c.__dict__ for c in case_results],
    }
