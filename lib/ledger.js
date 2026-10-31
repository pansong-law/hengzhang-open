import { renewalPeriod } from "./advisory-renewal.js";
import { cents } from "./money.js";

const numbers = new Intl.Collator("zh-CN", {
  numeric: true,
  sensitivity: "base",
});
export function compareLedgerCases(a, b) {
  const end = (c) => renewalPeriod(c.service_period).end?.getTime() ?? Infinity;
  const ae = end(a),
    be = end(b);
  if (ae !== be) return ae < be ? -1 : 1;
  const no = (c) => String(c.case_no || "").trim();
  const an = no(a),
    bn = no(b);
  if (!!an !== !!bn) return an ? -1 : 1;
  return (
    numbers.compare(an, bn) ||
    String(a.created_at || "").localeCompare(String(b.created_at || "")) ||
    String(a.id).localeCompare(String(b.id))
  );
}
export function payableView(entries, caseId) {
  const cycles = Array.isArray(entries?.[caseId]?.cycles)
    ? entries[caseId].cycles
    : [];
  return {
    current: cycles.find((c) => c.status === "active") || null,
    completed_count: cycles.filter((c) => c.status === "completed").length,
  };
}
const fail = (status, message) => {
  throw Object.assign(Error(message), { status });
};
export function startPayable(
  entries,
  caseId,
  { id, amount, note },
  username,
  at,
) {
  if (!/^[\w-]{8,100}$/.test(String(id)))
    fail(400, "提醒编号无效，请重新打开应付窗口");
  const value = amount == null || amount === "" ? null : Number(amount);
  if (
    value !== null &&
    (!Number.isFinite(value) ||
      value <= 0 ||
      value > 1e12 ||
      Math.abs(value * 100 - cents(value)) > 0.0001)
  )
    fail(400, "应付金额须为正数，最多两位小数，也可留空");
  const item = entries[caseId] || { cycles: [] };
  if (item.cycles.some((c) => c.id === id))
    return {
      ok: true,
      already_started: true,
      payable: payableView(entries, caseId),
    };
  if (item.cycles.some((c) => c.status === "active"))
    fail(409, "该案件已有待开票提醒，请先完成本次");
  item.cycles.push({
    id,
    status: "active",
    amount: value,
    note: String(note || "").trim(),
    started_by: username,
    started_at: at,
  });
  entries[caseId] = item;
  return { ok: true, payable: payableView(entries, caseId) };
}
export function completePayable(entries, caseId, id, username, at) {
  const cycle = entries[caseId]?.cycles?.find((c) => c.id === id);
  if (!cycle) fail(404, "应付提醒不存在");
  if (cycle.status === "completed")
    return {
      ok: true,
      already_completed: true,
      payable: payableView(entries, caseId),
    };
  cycle.status = "completed";
  cycle.completed_by = username;
  cycle.completed_at = at;
  return { ok: true, payable: payableView(entries, caseId) };
}
