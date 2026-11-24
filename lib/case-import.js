import { prepareCase } from "./case-model.js";
import { invalid } from "./money.js";
import { mergeFeeNotes } from "./fee-note.js";
const tracks = { 诉讼: "litigation", 顾问: "advisory", 专项: "project" };
const TRACK_LABELS = { advisory: "顾问", project: "专项", litigation: "诉讼" };
const EXCLUSIVE_FIELDS = {
  service_period: { track: "advisory", label: "服务期限（仅顾问）" },
  name: { track: "project", label: "项目名称（仅专项）" },
  opponent: { track: "project", label: "对方当事人（仅专项）" },
  plaintiff: { track: "litigation", label: "原告（仅诉讼）" },
  defendant: { track: "litigation", label: "被告（仅诉讼）" },
  third_party: { track: "litigation", label: "第三人（仅诉讼）" },
  case_type: { track: "litigation", label: "案由（仅诉讼）" },
  case_stage: { track: "litigation", label: "案件阶段（仅诉讼）" },
  service_stages: { track: "litigation", label: "服务阶段（仅诉讼）" },
};
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
        !Object.entries(r).some(
          ([key, v]) => key !== "track" && key !== "require_track" && nonempty(v),
        )
      ) {
        stats.empty_skipped++;
        continue;
      }
      const rawTrack = String(r.track ?? "").trim();
      if (rawTrack === "京东" || rawTrack === "京东框架" || rawTrack === "jd")
        throw invalid("单机版仅支持顾问、专项、诉讼案件，不含京东框架案件");
      const hint = tracks[rawTrack] || rawTrack || "";
      if (hint && !["advisory", "project", "litigation"].includes(hint))
        throw invalid("类型须为顾问、专项或诉讼");
      const no = String(r.internal_no || r.case_no || "").trim(),
        target = no ? working.find((c) => c.case_no === no) : null;
      if (!target && !hint && r.require_track)
        throw invalid("请填写「类型」（顾问、专项或诉讼）");
      const track = hint || target?.track || "litigation";
      if (target && target.track !== track)
        throw invalid("内部案号已用于另一类案件，请核对");
      if (r.require_track) {
        const wrongFields = Object.entries(EXCLUSIVE_FIELDS)
          .filter(([field, spec]) => spec.track !== track && nonempty(r[field]))
          .map(([, spec]) => spec.label);
        if (wrongFields.length)
          throw invalid(
            "业务线为「" +
              (TRACK_LABELS[track] || track) +
              "」，以下专属列请留空：" +
              wrongFields.join("、"),
          );
      }
      const body = { track, case_no: no };
      for (const field of fields)
        if (nonempty(r[field])) body[field] = r[field];
      if (track === "litigation" && nonempty(r.service_stages))
        body.service_period = r.service_stages;
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
