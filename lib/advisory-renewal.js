import { feeNote } from "./fee-note.js";
const iso = (date) => date.toISOString().slice(0, 10);
export const renewalToday = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
export function calendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{1,2}-\d{1,2}$/.test(value))
    return null;
  const [y, m, d] = value.split("-").map(Number),
    date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
    ? date
    : null;
}
export function renewalPeriod(period) {
  const match = String(period || "")
    .trim()
    .match(/^(\d{4}-\d{1,2}-\d{1,2})?\s*至\s*(\d{4}-\d{1,2}-\d{1,2})?$/);
  return { start: calendarDate(match?.[1]), end: calendarDate(match?.[2]) };
}
export function advisoryRenewalDraft(source, cases, today = renewalToday()) {
  const { end } = renewalPeriod(source.service_period);
  let service_period = "";
  if (end) {
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() + 1);
    const year = end.getUTCFullYear() + 1,
      month = end.getUTCMonth(),
      lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    service_period =
      iso(start) +
      " 至 " +
      iso(new Date(Date.UTC(year, month, Math.min(end.getUTCDate(), lastDay))));
  }
  const base = (source.case_no || "顾问") + "-续签";
  let case_no = base;
  for (let i = 2; cases.some((c) => c.case_no === case_no); i++)
    case_no = base + "-" + i;
  return {
    track: "advisory",
    name: "",
    case_no,
    client: source.client || "",
    client_contact: source.client_contact || "",
    lawyer: source.lawyer || "",
    co_lawyers: [...(source.co_lawyers || [])],
    contract_amount: source.contract_amount ?? null,
    fee_note: feeNote(source),
    notes: source.notes || "",
    service_period,
    sign_date: today,
    invoice_amount: 0,
    collected_amount: 0,
    unpaid: null,
    invoiced_unpaid: null,
    status: "在办",
  };
}
