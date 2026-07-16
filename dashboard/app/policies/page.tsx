"use client";

import { useState } from "react";
import { AgentOut, Policy, apiFetch, useApi } from "@/lib/api";
import { ErrorBox, Loading, Mono } from "@/components/ui";

const EFFECT_STYLES: Record<string, string> = {
  allow: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  deny: "border-red-500/30 bg-red-500/10 text-red-600",
  require_approval: "border-violet-500/30 bg-violet-500/10 text-violet-300",
};

const OPS = ["always", "gt", "gte", "lt", "lte", "eq", "ne", "in", "not_in", "contains", "regex"];

function NewPolicyForm({
  agents,
  onCreated,
}: {
  agents: AgentOut[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [tool, setTool] = useState("");
  const [effect, setEffect] = useState<"allow" | "deny" | "require_approval">("require_approval");
  const [priority, setPriority] = useState(100);
  const [description, setDescription] = useState("");
  const [agentId, setAgentId] = useState("");
  const [useCond, setUseCond] = useState(false);
  const [field, setField] = useState("amount");
  const [op, setOp] = useState("gt");
  const [value, setValue] = useState("100");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setErr(null);
    try {
      const num = Number(value);
      await apiFetch("/v1/policies", {
        method: "POST",
        body: JSON.stringify({
          tool: tool.trim(),
          effect,
          priority,
          description,
          agent_id: agentId || null,
          condition: useCond
            ? { field, op, value: Number.isNaN(num) ? value : num }
            : null,
        }),
      });
      setTool("");
      setDescription("");
      setOpen(false);
      onCreated();
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-[#0a0a0a] px-4 py-2 text-sm font-medium text-white hover:bg-[#262626]"
      >
        + New policy
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-black/10 bg-white p-4">
      <div className="flex flex-wrap gap-3">
        <label className="text-xs text-[#6b6b6b]">
          Tool (glob)
          <input
            value={tool}
            onChange={(e) => setTool(e.target.value)}
            placeholder="refund, delete_*, *"
            className="mt-1 block w-40 rounded border border-black/10 bg-[#fbfbfb] px-3 py-2 font-mono text-xs text-[#0a0a0a]"
          />
        </label>
        <label className="text-xs text-[#6b6b6b]">
          Effect
          <select
            value={effect}
            onChange={(e) => setEffect(e.target.value as typeof effect)}
            className="mt-1 block rounded border border-black/10 bg-[#fbfbfb] px-3 py-2 text-sm text-[#0a0a0a]"
          >
            <option value="allow">allow</option>
            <option value="deny">deny</option>
            <option value="require_approval">require_approval</option>
          </select>
        </label>
        <label className="text-xs text-[#6b6b6b]">
          Priority
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="mt-1 block w-24 rounded border border-black/10 bg-[#fbfbfb] px-3 py-2 text-sm text-[#0a0a0a]"
          />
        </label>
        <label className="text-xs text-[#6b6b6b]">
          Scope
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="mt-1 block rounded border border-black/10 bg-[#fbfbfb] px-3 py-2 text-sm text-[#0a0a0a]"
          >
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-xs text-[#6b6b6b]">
        <input type="checkbox" checked={useCond} onChange={(e) => setUseCond(e.target.checked)} className="accent-[#0a0a0a]" />
        Only when a condition on the arguments holds
      </label>
      {useCond && (
        <div className="flex flex-wrap items-center gap-2 pl-5">
          <input
            value={field}
            onChange={(e) => setField(e.target.value)}
            placeholder="field (e.g. amount)"
            className="w-40 rounded border border-black/10 bg-[#fbfbfb] px-3 py-2 font-mono text-xs text-[#0a0a0a]"
          />
          <select
            value={op}
            onChange={(e) => setOp(e.target.value)}
            className="rounded border border-black/10 bg-[#fbfbfb] px-2 py-2 font-mono text-xs text-[#0a0a0a]"
          >
            {OPS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="value"
            className="w-32 rounded border border-black/10 bg-[#fbfbfb] px-3 py-2 font-mono text-xs text-[#0a0a0a]"
          />
        </div>
      )}

      <label className="block text-xs text-[#6b6b6b]">
        Description
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="why this rule exists"
          className="mt-1 block w-full rounded border border-black/10 bg-[#fbfbfb] px-3 py-2 text-sm text-[#0a0a0a]"
        />
      </label>

      {err && <p className="font-mono text-xs text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button
          onClick={create}
          disabled={busy || !tool.trim()}
          className="rounded bg-[#0a0a0a] px-4 py-2 text-sm font-medium text-white hover:bg-[#262626] disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create policy"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded border border-black/10 px-4 py-2 text-sm text-[#6b6b6b] hover:bg-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function PoliciesPage() {
  const policies = useApi<{ entries: Policy[] }>("/v1/policies");
  const agents = useApi<AgentOut[]>("/v1/agents");
  const [err, setErr] = useState<string | null>(null);

  async function remove(id: string) {
    setErr(null);
    try {
      await apiFetch(`/v1/policies/${id}`, { method: "DELETE" });
      policies.refresh();
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    }
  }

  if (policies.error) return <ErrorBox error={policies.error} />;
  if (policies.loading || !policies.data || !agents.data) return <Loading />;

  const agentName = (id: string | null) =>
    id ? agents.data!.find((a) => a.id === id)?.name ?? id.slice(0, 8) : "all agents";

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-[#0a0a0a]">Action policies</h1>
      <p className="-mt-3 text-sm text-[#6b6b6b]">
        Rules the gateway enforces when an agent asks to perform a tool call. Evaluated by
        ascending priority; first match wins. Unmatched calls are allowed.
      </p>
      <NewPolicyForm agents={agents.data} onCreated={policies.refresh} />
      {err && <p className="font-mono text-xs text-red-600">{err}</p>}

      {policies.data.entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/10 bg-white p-8 text-center text-sm text-[#6b6b6b]">
          No policies yet. Add one — e.g. <Mono>delete_*</Mono> → deny, or{" "}
          <Mono>refund</Mono> when <Mono>amount &gt; 100</Mono> → require approval.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-black/[0.08]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#fbfbfb] text-[11px] uppercase tracking-widest text-[#6b6b6b]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Priority</th>
                <th className="px-4 py-2.5 font-medium">Tool</th>
                <th className="px-4 py-2.5 font-medium">Condition</th>
                <th className="px-4 py-2.5 font-medium">Effect</th>
                <th className="px-4 py-2.5 font-medium">Scope</th>
                <th className="px-4 py-2.5 font-medium">Description</th>
                <th className="px-4 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {policies.data.entries.map((p) => (
                <tr key={p.id} className="hover:bg-[#fbfbfb]">
                  <td className="px-4 py-2.5 font-mono text-xs text-[#6b6b6b]">{p.priority}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-[#0a0a0a]">{p.tool}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-[#6b6b6b]">
                    {p.condition
                      ? `${p.condition.field} ${p.condition.op} ${JSON.stringify(p.condition.value)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                        EFFECT_STYLES[p.effect] ?? ""
                      }`}
                    >
                      {p.effect}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[#6b6b6b]">{agentName(p.agent_id)}</td>
                  <td className="px-4 py-2.5 text-[#6b6b6b]">{p.description || "—"}</td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => remove(p.id)}
                      className="text-xs text-[#6b6b6b] hover:text-red-600"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
