import { randomUUID } from "node:crypto";
import { amount, cents, yuan, invalid } from "./money.js";
import { calendarDate } from "./advisory-renewal.js";
import { litigationStage } from "./litigation-stage.js";
import { splitParties } from "./case-ledger-fields.js";
export const TRACKS = { litigation: "诉讼", advisory: "顾问", project: "专项" };
export const timestamp = () => new Date().toISOString();
export const makeId = () => randomUUID();
const textFields = [
  "case_no",
  "name",
  "client",
  "client_contact",
  "plaintiff",
  "defendant",
  "third_party",
  "opponent",
  "case_type",
  "lawyer",
  "service_period",
  "fee_note",
  "sign_date",
  "notes",
  "close_date",
  "close_method",
];
export function dateValue(value, label = "日期") {
  const text = String(value || "").trim();
  if (text && !calendarDate(text))
    throw invalid(label + "须为有效日期，例如 2026-10-31");
  return text
    ? text
        .split("-")
        .map((v, i) => (i ? v.padStart(2, "0") : v))
        .join("-")
    : "";
}
export function caseFinance(c) {
  const signed = c.contract_amount,
    received = Number(c.collected_amount || 0),
    invoice = Number(c.invoice_amount || 0);
  return {
    signed,
    received,
    invoice,
    unpaid:
      c.unpaid ??
      (signed == null
        ? null
        : yuan(Math.max(0, cents(signed) - cents(received)))),
    invoiced_unpaid:
      c.invoiced_unpaid ?? yuan(Math.max(0, cents(invoice) - cents(received))),
  };
}
export function prepareCase(body, previous = null) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw invalid("案件格式无效");
  const track = body.track ?? previous?.track ?? "litigation";
  if (!Object.hasOwn(TRACKS, track))
    throw invalid("案件类型须为诉讼、顾问或专项");
  const c = previous
    ? structuredClone(previous)
    : {
        id: makeId(),
        created_at: timestamp(),
        progress: [],
        collections: [],
        revision: 0,
        opening_received: 0,
      };
  c.track = track;
  for (const field of textFields) {
    if (Object.hasOwn(body, field) || !previous)
      c[field] = String(body[field] ?? "").trim();
    if ((c[field] || "").length > 20000) throw invalid("字段内容过长");
  }
  for (const field of [
    "client",
    "plaintiff",
    "defendant",
    "third_party",
    "opponent",
  ])
    c[field] = splitParties(c[field]).join(",");
  c.co_lawyers = splitParties(body.co_lawyers ?? c.co_lawyers).filter(
    (n) => n !== c.lawyer,
  );
  c.status = body.status ?? c.status ?? "在办";
  if (!["在办", "已结", "中止"].includes(c.status))
    throw invalid("案件状态须为在办、已结或中止");
  c.case_stage =
    track === "litigation"
      ? litigationStage(body.case_stage ?? c.case_stage ?? "")
      : "";
  for (const key of ["sign_date", "close_date"])
    c[key] = dateValue(c[key], key === "sign_date" ? "签约日期" : "结案日期");
  for (const [key, label] of [
    ["contract_amount", "签约律师费"],
    ["invoice_amount", "开票金额"],
    ["collected_amount", "累计已收款"],
    ["unpaid", "未付金额"],
    ["invoiced_unpaid", "开票未付金额"],
  ]) {
    if (Object.hasOwn(body, key) || !previous)
      c[key] = amount(body[key], label);
  }
  const recorded = c.collections.reduce((sum, r) => sum + cents(r.amount), 0),
    received = cents(c.collected_amount || 0);
  if (received < recorded)
    throw invalid("累计已收款不能小于已有收款流水合计；请先核对流水");
  c.opening_received = yuan(received - recorded);
  if (
    !Object.hasOwn(body, "unpaid") &&
    (!previous ||
      Object.hasOwn(body, "contract_amount") ||
      Object.hasOwn(body, "collected_amount"))
  )
    c.unpaid = null;
  c.updated_at = timestamp();
  c.revision = (c.revision || 0) + 1;
  return c;
}
export function checkRevision(c, body) {
  if (body.revision != null && body.revision !== c.revision)
    throw invalid("案件已发生变化，请重新打开后保存", 409);
}
export function viewCase(c, meta) {
  const cycles = meta.case_payable_reminders?.[c.id]?.cycles || [];
  return {
    ...c,
    fee_summary: caseFinance(c),
    payable: {
      current: cycles.find((r) => r.status === "active") || null,
      completed_count: cycles.filter((r) => r.status === "completed").length,
    },
  };
}
export function validateDatabase(db) {
  if (Buffer.byteLength(JSON.stringify(db) || "") > 60 * 1024 * 1024)
    throw invalid("数据量超过单机版支持的范围，请先整理历史记录");
  if (
    !db ||
    db.schema_version !== 1 ||
    !Array.isArray(db.cases) ||
    db.cases.length > 50000 ||
    !db.meta ||
    typeof db.meta !== "object" ||
    Array.isArray(db.meta)
  )
    throw invalid("不是有效的衡账单机版数据");
  if (
    Object.keys(db).some(
      (k) => !["schema_version", "cases", "meta"].includes(k),
    )
  )
    throw invalid("数据包含不支持的内容");
  if (
    Object.keys(db.meta).some(
      (k) => !["created_at", "case_payable_reminders"].includes(k),
    )
  )
    throw invalid("数据包含不支持的内容");
  const ids = new Set(),
    numbers = new Set();
  for (const c of db.cases) {
    if (
      !c ||
      typeof c.id !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
        c.id,
      ) ||
      ids.has(c.id)
    )
      throw invalid("案件编号缺失或重复");
    ids.add(c.id);
    if (c.case_no && numbers.has(c.case_no))
      throw invalid("内部案号重复：" + c.case_no);
    if (c.case_no) numbers.add(c.case_no);
    if (
      !Number.isSafeInteger(c.revision) ||
      c.revision < 1 ||
      !Array.isArray(c.collections) ||
      !Array.isArray(c.progress) ||
      !Array.isArray(c.co_lawyers)
    )
      throw invalid("案件记录不完整");
    const allowed = new Set([
      ...textFields,
      "id",
      "track",
      "created_at",
      "updated_at",
      "progress",
      "collections",
      "revision",
      "opening_received",
      "co_lawyers",
      "status",
      "case_stage",
      "contract_amount",
      "invoice_amount",
      "collected_amount",
      "unpaid",
      "invoiced_unpaid",
    ]);
    if (Object.keys(c).some((k) => !allowed.has(k)))
      throw invalid("案件包含不支持的字段");
    for (const key of textFields)
      if (typeof c[key] !== "string") throw invalid("案件文字字段无效");
    if (
      typeof c.created_at !== "string" ||
      typeof c.updated_at !== "string" ||
      c.co_lawyers.some((n) => typeof n !== "string" || n.length > 1000)
    )
      throw invalid("案件记录无效");
    const recordIds = new Set();
    for (const r of c.collections) {
      if (
        !r ||
        typeof r.id !== "string" ||
        recordIds.has(r.id) ||
        !r.date ||
        !dateValue(r.date) ||
        amount(r.amount, "收款金额", false) <= 0 ||
        typeof r.note !== "string" ||
        typeof r.at !== "string"
      )
        throw invalid("收款流水无效");
      recordIds.add(r.id);
    }
    for (const r of c.progress)
      if (
        !r ||
        typeof r.id !== "string" ||
        typeof r.text !== "string" ||
        !r.text.trim() ||
        typeof r.at !== "string"
      )
        throw invalid("案件进展无效");
    prepareCase(c, c);
    const actual =
      cents(c.opening_received) +
      c.collections.reduce((n, r) => n + cents(r.amount), 0);
    if (actual !== cents(c.collected_amount))
      throw invalid("收款流水与累计已收款不一致");
    amount(c.opening_received, "期初已收款", false);
  }
  if (
    !db.meta.case_payable_reminders ||
    typeof db.meta.case_payable_reminders !== "object" ||
    Array.isArray(db.meta.case_payable_reminders)
  )
    throw invalid("提醒数据无效");
  for (const [id, entry] of Object.entries(db.meta.case_payable_reminders)) {
    if (!ids.has(id) || !entry || !Array.isArray(entry.cycles))
      throw invalid("提醒关联案件不存在");
    const cycleIds = new Set();
    let active = 0;
    for (const r of entry.cycles) {
      if (
        !r ||
        !/^[\w-]{8,100}$/.test(r.id || "") ||
        cycleIds.has(r.id) ||
        !["active", "completed"].includes(r.status) ||
        typeof r.note !== "string" ||
        typeof r.started_at !== "string"
      )
        throw invalid("提醒记录无效");
      cycleIds.add(r.id);
      if (r.status === "active") active++;
      if (r.amount != null && amount(r.amount, "提醒金额", false) <= 0)
        throw invalid("提醒金额无效");
      if (r.status === "completed" && typeof r.completed_at !== "string")
        throw invalid("提醒完成时间缺失");
    }
    if (active > 1) throw invalid("同一案件存在多个待开票提醒");
  }
  return db;
}
