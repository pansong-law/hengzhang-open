import { prepareCase } from "./case-model.js";
import { invalid } from "./money.js";
import { mergeFeeNotes } from "./fee-note.js";
const tracks = { 诉讼: "litigation", 顾问: "advisory", 专项: "project" };
const fields = [
  "name",
  "client",
  "client_contact",
  "plaintiff",
  "defendant",
  "third_party",
  "opponent",
  "case_type",
  "case_stage",
  "lawyer",
  "co_lawyers",
  "service_period",
  "sign_date",
  "fee_note",
  "status",
  "notes",
  "contract_amount",
  "invoice_amount",
  "collected_amount",
  "unpaid",
  "invoiced_unpaid",
];
const nonempty = (v) => v != null && String(v).trim() !== "";
export function planCaseImport({ cases, rows }) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 10000)
    throw invalid("请导入 1 至 10000 行案件数据");
  const working = structuredClone(cases),
    changed = new Map(),
    stats = { added: 0, merged: 0, incomplete: 0, empty_skipped: 0 };
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      if (!r || typeof r !== "object" || Array.isArray(r))
        throw invalid("格式无效");
      if (
        !Object.entries(r).some(([key, v]) => key !== "track" && nonempty(v))
      ) {
        stats.empty_skipped++;
        continue;
      }
      const no = String(r.internal_no || r.case_no || "").trim(),
        target = no ? working.find((c) => c.case_no === no) : null;
      const track = tracks[r.track] || r.track || target?.track || "litigation";
      if (target && target.track !== track)
        throw invalid("内部案号已用于另一类案件，请核对");
      const body = { track, case_no: no };
      for (const field of fields)
        if (nonempty(r[field])) body[field] = r[field];
      for (const field of ["unpaid", "invoiced_unpaid"]) {
        const mode = String(r[field + "_mode"] ?? "").trim();
        if (mode && !["自动", "手填"].includes(mode))
          throw invalid("金额计算方式须为自动或手填");
        if (mode === "手填" && !nonempty(r[field]))
          throw invalid("手填计算方式须填写对应金额");
        if (mode === "自动") body[field] = null;
      }
      const noteParts = [r.fee_note, r.pay_terms, r.contract_formula];
      for (const field of [
        "contract_amount",
        "invoice_amount",
        "collected_amount",
        "unpaid",
        "invoiced_unpaid",
      ]) {
        if (body[field] === null) continue;
        if (!nonempty(r[field])) continue;
        const text = String(r[field]).replace(/[,，]/g, "").trim();
        const m =
          field === "contract_amount"
            ? text.match(/^(\d+(?:\.\d{1,2})?)\s*[（(](.+)[）)]$/)
            : null;
        if (m) {
          body[field] = m[1];
          noteParts.push(m[2]);
        } else body[field] = text;
      }
      if (noteParts.some(nonempty)) body.fee_note = mergeFeeNotes(...noteParts);
      const c = prepareCase(body, target);
      if (target) {
        working[working.findIndex((x) => x.id === target.id)] = c;
        stats.merged++;
      } else {
        working.push(c);
        stats.added++;
        if (!no) stats.incomplete++;
      }
      changed.set(c.id, c);
    } catch (e) {
      throw invalid("第 " + (i + 2) + " 行：" + e.message);
    }
  }
  if (stats.empty_skipped === rows.length) throw invalid("未解析到数据行");
  return { ...stats, records: [...changed.values()] };
}
