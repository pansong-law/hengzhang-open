// 法律计算（单机本地版）：自定义小工具（字段＋公式 / 隔离沙盒）、平台 AI 生成与卡片排序
import crypto from "node:crypto";
import { callChatModel } from "./ai-contract.js";

export const TOOLS_META_KEY = "legal_calc_tools_v1";
export const ORDER_META_KEY = "legal_calc_order_v1";

export const BUILTIN_IDS = [
  "lawyer",
  "vat",
  "court",
  "liquidated",
  "interest",
  "limitation",
  "labor",
  "traffic",
  "days",
  "rmb",
];
export const TOOL_MODES = ["formula", "sandbox"];
export const ACCENTS = [
  "vermilion",
  "amber",
  "indigo",
  "teal",
  "emerald",
  "plum",
  "cobalt",
  "slate",
];
export const ICONS = [
  "seal",
  "calendar",
  "abacus",
  "gavel",
  "trend",
  "shield",
  "briefcase",
  "contract",
  "pie",
  "tax",
  "house",
  "spark",
];
export const FIELD_TYPES = ["number", "date", "select", "checkbox", "text"];
export const OUTPUT_FORMATS = [
  "money",
  "percent",
  "number",
  "integer",
  "rmb",
  "date",
  "text",
];

export const MAX_TOOLS_TOTAL = 300;
export const MAX_FIELDS = 30;
export const MAX_OUTPUTS = 30;
export const MAX_NOTES = 12;
export const MAX_SANDBOX_CODE = 100_000;
const IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,31}$/;

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function cleanStr(val, limit = 200) {
  if (val === null || val === undefined) return "";
  return String(val).trim().slice(0, limit);
}

function dedupeStrings(arr, limit, maxLen = 64) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  const seen = new Set();
  for (const val of arr) {
    if (typeof val !== "string") continue;
    const s = val.trim();
    if (!s || s.length > maxLen || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

function loadToolsRaw(meta) {
  const raw = meta?.[TOOLS_META_KEY];
  if (!raw || typeof raw !== "object") return [];
  const items = Array.isArray(raw) ? raw : raw.items;
  if (!Array.isArray(items)) return [];
  return items
    .filter((x) => x && typeof x === "object" && x.id)
    .map((x) => structuredClone(x));
}

function loadOrder(meta) {
  const raw = meta?.[ORDER_META_KEY];
  if (!raw || typeof raw !== "object") {
    return { order_ids: [], pinned_ids: [], updated_at: 0 };
  }
  return {
    order_ids: dedupeStrings(raw.order_ids, 400),
    pinned_ids: dedupeStrings(raw.pinned_ids, 200),
    updated_at: Number(raw.updated_at) || 0,
  };
}

function sanitizeFormulaSchema(rawSchema) {
  if (!rawSchema || typeof rawSchema !== "object" || Array.isArray(rawSchema)) {
    throw httpError(400, "公式小工具配置格式无效。");
  }
  const rawFields = rawSchema.fields;
  const rawOutputs = rawSchema.outputs;
  let rawNotes = rawSchema.notes || [];
  if (!Array.isArray(rawFields) || !rawFields.length) {
    throw httpError(400, "请至少添加一个输入项。");
  }
  if (rawFields.length > MAX_FIELDS) {
    throw httpError(400, `输入项最多支持 ${MAX_FIELDS} 个。`);
  }
  if (!Array.isArray(rawOutputs) || !rawOutputs.length) {
    throw httpError(400, "请至少添加一个计算结果项。");
  }
  if (rawOutputs.length > MAX_OUTPUTS) {
    throw httpError(400, `计算结果项最多支持 ${MAX_OUTPUTS} 个。`);
  }

  const fields = [];
  const seenKeys = new Set();
  for (let idx = 0; idx < rawFields.length; idx++) {
    const rf = rawFields[idx];
    const num = idx + 1;
    if (!rf || typeof rf !== "object" || Array.isArray(rf)) {
      throw httpError(400, `第 ${num} 个输入项格式无效。`);
    }
    const key = cleanStr(rf.key, 32);
    if (!IDENT_RE.test(key)) {
      throw httpError(
        400,
        `第 ${num} 个输入项的变量名「${key || "空"}」无效（请用英文字母或下划线开头，如 amount、rate）。`,
      );
    }
    if (seenKeys.has(key)) {
      throw httpError(400, `输入项变量名「${key}」重复，请保持唯一。`);
    }
    seenKeys.add(key);
    const label = cleanStr(rf.label, 60);
    if (!label) {
      throw httpError(400, `请填写变量「${key}」的显示名称。`);
    }
    let ftype = cleanStr(rf.type || "number", 16);
    if (!FIELD_TYPES.includes(ftype)) ftype = "number";

    const options = [];
    if (ftype === "select") {
      const rawOpts = rf.options || [];
      if (typeof rawOpts === "string") {
        for (const part of rawOpts.split(/[\n,，;；]+/)) {
          const s = part.trim();
          if (!s) continue;
          const m = s.match(/^([^:：]+)[:：](.+)$/);
          if (m) {
            const kOpt = cleanStr(m[1], 40);
            const vOpt = cleanStr(m[2], 60) || kOpt;
            if (kOpt) options.push([kOpt, vOpt]);
          } else {
            options.push([cleanStr(s, 40), cleanStr(s, 60)]);
          }
        }
      } else if (Array.isArray(rawOpts)) {
        for (const entry of rawOpts.slice(0, 40)) {
          if (Array.isArray(entry) && entry.length >= 2) {
            const valS = cleanStr(entry[0], 40);
            const lblS = cleanStr(entry[1], 60) || valS;
            if (valS) options.push([valS, lblS]);
          } else if (entry && typeof entry === "object") {
            const valS = cleanStr(entry.value, 40);
            const lblS = cleanStr(entry.label, 60) || valS;
            if (valS) options.push([valS, lblS]);
          } else if (entry !== null && entry !== undefined) {
            const valS = cleanStr(entry, 40);
            if (valS) options.push([valS, valS]);
          }
        }
      }
      if (!options.length) {
        throw httpError(400, `下拉选项「${label}」请至少填写一个可选项。`);
      }
    }

    const defVal =
      ftype !== "checkbox"
        ? cleanStr(rf.default, 80)
        : [true, 1, "1", "true", "yes", "on"].includes(rf.default)
          ? "1"
          : "";

    fields.push({
      key,
      label,
      type: ftype,
      unit: cleanStr(rf.unit, 16),
      default: defVal,
      placeholder: cleanStr(rf.placeholder, 80),
      hint: cleanStr(rf.hint, 160),
      full: Boolean(rf.full),
      options,
    });
  }

  const outputs = [];
  for (let idx = 0; idx < rawOutputs.length; idx++) {
    const ro = rawOutputs[idx];
    const num = idx + 1;
    if (!ro || typeof ro !== "object" || Array.isArray(ro)) {
      throw httpError(400, `第 ${num} 个结果项格式无效。`);
    }
    const key = cleanStr(ro.key, 32);
    if (key) {
      if (!IDENT_RE.test(key)) {
        throw httpError(400, `第 ${num} 个结果项变量名「${key}」无效。`);
      }
      if (seenKeys.has(key)) {
        throw httpError(400, `结果项变量名「${key}」与前序变量重名。`);
      }
      seenKeys.add(key);
    }
    const label = cleanStr(ro.label, 60);
    if (!label) {
      throw httpError(400, `请填写第 ${num} 个结果项的名称。`);
    }
    const expr = cleanStr(ro.expr, 600);
    if (!expr) {
      throw httpError(400, `请填写结果项「${label}」的计算公式。`);
    }
    let fmt = cleanStr(ro.format || "money", 16);
    if (!OUTPUT_FORMATS.includes(fmt)) fmt = "money";

    outputs.push({
      key,
      label,
      expr,
      format: fmt,
      headline: Boolean(ro.headline),
      strong: Boolean(ro.strong),
      sub: cleanStr(ro.sub, 200),
    });
  }

  if (!outputs.some((o) => o.headline)) {
    outputs[0].headline = true;
  }

  const notes = [];
  if (typeof rawNotes === "string") {
    rawNotes = rawNotes
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  if (Array.isArray(rawNotes)) {
    for (const n of rawNotes.slice(0, MAX_NOTES)) {
      const s = cleanStr(n, 300);
      if (s) notes.push(s);
    }
  }

  return { fields, outputs, notes };
}

export function sanitizeToolInput(data, existing = null) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw httpError(400, "小工具参数无效。");
  }
  const title = cleanStr(data.title, 60);
  if (!title) throw httpError(400, "请填写小工具名称。");
  const desc = cleanStr(data.desc, 180) || "自定义法律计算小工具";
  const scopeNote = cleanStr(data.scope_note, 120);
  let icon = cleanStr(data.icon || "spark", 24);
  if (!ICONS.includes(icon)) icon = "spark";
  let accent = cleanStr(data.accent || "indigo", 24);
  if (!ACCENTS.includes(accent)) accent = "indigo";
  const mode = cleanStr(data.mode || "formula", 16);
  if (!TOOL_MODES.includes(mode))
    throw httpError(400, "请选择有效的小工具编写模式。");

  let schema = null;
  let code = "";
  if (mode === "formula") {
    schema = sanitizeFormulaSchema(data.schema);
  } else {
    const rawCode = String(data.code ?? "").trim();
    if (!rawCode)
      throw httpError(400, "请填写自定义小工具的 HTML / JS 代码。");
    if (rawCode.length > MAX_SANDBOX_CODE)
      throw httpError(400, "代码长度不能超过 100 KB。");
    if (
      /<script\b[^>]*\bsrc\s*=/i.test(rawCode) ||
      /<link\b[^>]*\bhref\s*=\s*['"]?\s*https?:/i.test(rawCode)
    ) {
      throw httpError(
        400,
        "隔离沙盒小工具必须完全在本地运行，不能引入外部脚本或样式链接。",
      );
    }
    code = rawCode;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const tid = existing
    ? existing.id
    : "ctool_" + crypto.randomBytes(6).toString("hex");
  return {
    id: tid,
    title,
    desc,
    scope_note: scopeNote,
    icon,
    accent,
    mode,
    schema,
    code,
    visibility: "private",
    visible_members: [],
    owner_id: "local",
    owner_name: "本机",
    created_at: existing ? Number(existing.created_at) || nowSec : nowSec,
    updated_at: nowSec,
  };
}

function serializeTool(item) {
  return {
    id: item.id,
    custom: true,
    title: item.title || "",
    desc: item.desc || "",
    scope_note: item.scope_note || "",
    icon: item.icon || "spark",
    accent: item.accent || "indigo",
    mode: item.mode || "formula",
    schema: item.schema || null,
    code: item.code || "",
    visibility: "private",
    visible_members: [],
    visible_member_names: [],
    owner_id: "local",
    owner_name: "本机",
    can_edit: true,
    created_at: Number(item.created_at) || 0,
    updated_at: Number(item.updated_at) || 0,
  };
}

export function validateLegalCalcMeta(toolsMeta, orderMeta) {
  if (toolsMeta !== undefined) {
    if (!toolsMeta || typeof toolsMeta !== "object" || Array.isArray(toolsMeta)) {
      throw httpError(400, "法律计算自定义工具数据无效");
    }
    if (!Array.isArray(toolsMeta.items) || toolsMeta.items.length > MAX_TOOLS_TOTAL) {
      throw httpError(400, "法律计算自定义工具列表无效");
    }
    for (const item of toolsMeta.items) {
      if (!item || typeof item !== "object" || typeof item.id !== "string" || !item.id) {
        throw httpError(400, "法律计算自定义工具记录无效");
      }
      sanitizeToolInput(item, item);
    }
  }
  if (orderMeta !== undefined) {
    if (!orderMeta || typeof orderMeta !== "object" || Array.isArray(orderMeta)) {
      throw httpError(400, "法律计算排序配置无效");
    }
    if (
      (orderMeta.order_ids !== undefined && !Array.isArray(orderMeta.order_ids)) ||
      (orderMeta.pinned_ids !== undefined && !Array.isArray(orderMeta.pinned_ids))
    ) {
      throw httpError(400, "法律计算排序配置无效");
    }
  }
}

export function getLegalCalcPayload(meta, aiPublicView = null) {
  const rawItems = loadToolsRaw(meta);
  const orderState = loadOrder(meta);
  return {
    single_user: true,
    custom_tools: rawItems.map(serializeTool),
    order_ids: orderState.order_ids,
    pinned_ids: orderState.pinned_ids,
    order_updated_at: orderState.updated_at,
    users: [],
    ai_ready: Boolean(aiPublicView?.has_api_key),
    ai_model: String(aiPublicView?.model || ""),
  };
}

export function mutateLegalCalc(meta, data, aiPublicView = null) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw httpError(400, "请求格式无效。");
  }
  const action = cleanStr(data.action, 32);
  const nowSec = Math.floor(Date.now() / 1000);
  const nextMeta = { ...(meta || {}) };
  let toolsChanged = false;
  let ordersChanged = false;
  let savedId = null;

  if (action === "reorder") {
    nextMeta[ORDER_META_KEY] = {
      order_ids: dedupeStrings(data.order_ids, 400, 64),
      pinned_ids: dedupeStrings(data.pinned_ids, 200, 64),
      updated_at: nowSec,
    };
    ordersChanged = true;
  } else if (action === "save_tool") {
    const toolData =
      data.tool && typeof data.tool === "object" && !Array.isArray(data.tool)
        ? data.tool
        : data;
    const reqId = cleanStr(toolData.id, 48);
    if (BUILTIN_IDS.includes(reqId)) {
      throw httpError(
        400,
        "内置计算器不可直接覆盖，请另存为新的自定义小工具。",
      );
    }
    const items = loadToolsRaw(nextMeta);
    const existingIdx = reqId ? items.findIndex((x) => x.id === reqId) : -1;
    const existing = existingIdx >= 0 ? items[existingIdx] : null;
    if (reqId && !existing) {
      throw httpError(404, "要编辑的小工具不存在或已被删除。");
    }
    if (!existing && items.length >= MAX_TOOLS_TOTAL) {
      throw httpError(
        400,
        `自定义小工具总数已达上限（${MAX_TOOLS_TOTAL} 个）。`,
      );
    }
    const saved = sanitizeToolInput(toolData, existing);
    if (existing) {
      items[existingIdx] = saved;
    } else {
      const existingIds = new Set(items.map((x) => x.id));
      while (existingIds.has(saved.id)) {
        saved.id = "ctool_" + crypto.randomBytes(6).toString("hex");
      }
      items.push(saved);
    }
    nextMeta[TOOLS_META_KEY] = { items, updated_at: nowSec };
    toolsChanged = true;
    savedId = saved.id;
  } else if (action === "delete_tool") {
    const tid = cleanStr(data.id, 48);
    if (!tid || BUILTIN_IDS.includes(tid)) {
      throw httpError(400, "内置计算器不能删除。");
    }
    const items = loadToolsRaw(nextMeta);
    const target = items.find((x) => x.id === tid);
    if (!target) {
      throw httpError(404, "小工具不存在或已被删除。");
    }
    nextMeta[TOOLS_META_KEY] = {
      items: items.filter((x) => x.id !== tid),
      updated_at: nowSec,
    };
    toolsChanged = true;
  } else {
    throw httpError(400, "未知的法律计算操作。");
  }

  const payload = getLegalCalcPayload(nextMeta, aiPublicView);
  if (savedId) payload.saved_id = savedId;
  return {
    payload,
    toolsChanged,
    toolsValue: nextMeta[TOOLS_META_KEY],
    ordersChanged,
    ordersValue: nextMeta[ORDER_META_KEY],
  };
}

// ───────────── 平台 AI 生成自定义小工具 ─────────────
const AI_TOOL_SYSTEM_PROMPT = `你是法律计算平台的内置 AI 小工具架构师，负责根据律师的自然语言需求，直接生成一个可立即试算和保存的法律计算小工具 JSON 配置。

【输出硬性要求】
只输出一个合法 JSON 对象，不要输出解释文字或多余前后缀。JSON 字段如下：
{
  "title": "工具名称（简短明确，2~24字）",
  "desc": "一句话功能说明（10~80字）",
  "scope_note": "适用口径或法规依据简注（选填，不超过60字）",
  "icon": "从 seal|calendar|abacus|gavel|trend|shield|briefcase|contract|pie|tax|house|spark 中选最匹配的一个",
  "accent": "从 vermilion|amber|indigo|teal|emerald|cobalt|plum|slate 中选一个",
  "mode": "formula 或 sandbox",
  "schema": { ...仅 mode=formula 时填写... },
  "code": "...仅 mode=sandbox 时填写..."
}

【模式选择原则】
1. 绝大多数常规表单类测算（违约金、税费、股权/房产折算、佣金/分成、利息对比、赔偿分摊、期限推算等）优先使用 mode="formula"（渲染稳定、界面统一、零运行报错）。
2. 仅当用户明确指定沙盒/网页模式，或需要动态增减多行明细、分期还款计划表、复杂多步交互界面等公式模式无法表达的交互时，才使用 mode="sandbox"。

【formula 模式规范】
schema 必须包含 fields（1~15项）、outputs（1~15项）、notes（1~4条依据/免责提示）：
- fields 每项：{ "key": "英文字母或下划线开头的变量名", "label": "中文名称", "type": "number|date|select|checkbox|text", "unit": "单位如 元/%/天", "default": "合理默认值或空字符串（日期可用 today）", "placeholder": "输入示例", "hint": "简短提示", "options": [["值","显示名"]] }（仅 type="select" 需填 options；注意下拉值为数字字符串如 "6" 时公式中会自动按数字参与运算）。
- outputs 每项：{ "key": "可选英文变量名，供后续公式引用", "label": "结果名称", "expr": "计算表达式", "format": "money|percent|number|integer|rmb|date|text", "headline": true/false（至少且恰有一项为 true）, "strong": true/false, "sub": "简短计算说明，可用 {变量名} 引用输入或前序结果" }。
- expr 仅支持四则/比较/逻辑/三元运算（+ - * / % < <= > >= == != && || ? :）及以下内置函数：
  if(cond, a, b), min(...), max(...), abs(x), round(x, d), ceil(x), floor(x), pow(a, b), rmb(amount), money(amount), days(start, end), workdays(start, end), addDays(start, n, defer), months(start, end), tier(amt, up1, r1, ...), tierPct(amt, up1, pct1, ...), courtFee(amt), saveFee(amt), lpr1y(date), lpr5y(date), lprInterest(principal, start, end, mult)。
- 请给出合理的 default 示例值（或清晰 placeholder），确保生成后在预览区立即能看到正确计算结果；严禁除以可能为 0 的变量（用 if(x>0, ..., 0) 保护）。

【sandbox 模式规范】
- code 为单文件 HTML 片段（无需 <html>/<head>/<body> 外壳，直接写 <style>、表单 <div class="card">...</div>、结果区与 <script>...</script>）。
- 全部计算用原生 JS 在本地完成，严禁 <script src>、外部 CDN、fetch/XHR/WebSocket。
- 预置合理默认输入并在脚本加载后立即执行一次计算；输入变化时实时重算；提供「复制计算结果」按钮，点击调用 window.copyResult(纯文本)。`;

export function buildAiToolMessages({
  prompt,
  preferredMode = "auto",
  currentTool = null,
}) {
  const cleanPrompt = cleanStr(prompt, 4000);
  if (cleanPrompt.length < 4) {
    throw httpError(400, "请用至少 4 个字描述需要生成或修改的计算规则。");
  }
  const pref = ["auto", "formula", "sandbox"].includes(preferredMode)
    ? preferredMode
    : "auto";
  const modeDirective =
    pref === "formula"
      ? '【模式要求】本次必须使用 mode="formula"（可视化字段＋公式模式）。'
      : pref === "sandbox"
        ? '【模式要求】本次必须使用 mode="sandbox"（自包含 HTML/JS 隔离沙盒模式）。'
        : '【模式要求】请智能选择最合适的模式（常规计算优先 mode="formula"，复杂多行明细或自定义交互用 mode="sandbox"）。';

  let userContent = `${modeDirective}\n\n【用户需求】\n${cleanPrompt}`;
  if (
    currentTool &&
    typeof currentTool === "object" &&
    !Array.isArray(currentTool)
  ) {
    const brief = {
      title: cleanStr(currentTool.title, 60),
      desc: cleanStr(currentTool.desc, 180),
      scope_note: cleanStr(currentTool.scope_note, 120),
      icon: cleanStr(currentTool.icon, 24),
      accent: cleanStr(currentTool.accent, 24),
      mode: cleanStr(currentTool.mode, 16),
      ...(currentTool.mode === "sandbox"
        ? { code: String(currentTool.code || "").slice(0, 16000) }
        : { schema: currentTool.schema || null }),
    };
    userContent = `${modeDirective}\n\n【当前已有小工具配置（请在此基础上按用户意见修改完善）】\n${JSON.stringify(brief, null, 2)}\n\n【本次修改要求】\n${cleanPrompt}`;
  }
  return [
    { role: "system", content: AI_TOOL_SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];
}

export function parseAiToolJson(rawText) {
  let text = String(rawText || "").trim();
  if (!text) throw httpError(502, "AI 未返回有效内容，请重试。");
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) text = fence[1].trim();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) {
      throw httpError(502, "AI 返回内容不是有效的小工具结构，请换种说法重试。");
    }
    try {
      parsed = JSON.parse(text.slice(start, end + 1));
    } catch {
      throw httpError(502, "AI 返回的 JSON 结构无法解析，请重试。");
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw httpError(502, "AI 返回的小工具结构无效，请重试。");
  }
  return parsed;
}

export async function generateLegalCalcToolWithAi(
  input,
  resolvedConfig,
  { fetchImpl } = {},
) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw httpError(400, "请求格式无效。");
  }
  const messages = buildAiToolMessages({
    prompt: input.prompt,
    preferredMode: input.preferred_mode,
    currentTool: input.current_tool || null,
  });
  const reply = await callChatModel(resolvedConfig, messages, {
    fetchImpl,
    timeoutMs: 95000,
    maxTokens: 4096,
  });
  const parsed = parseAiToolJson(reply);
  const mode = parsed.mode === "sandbox" ? "sandbox" : "formula";
  const sanitized = sanitizeToolInput({
    title: parsed.title,
    desc: parsed.desc,
    scope_note: parsed.scope_note || "",
    icon: parsed.icon || "spark",
    accent: parsed.accent || "indigo",
    mode,
    schema: mode === "formula" ? parsed.schema : null,
    code: mode === "sandbox" ? parsed.code : "",
  });
  return {
    title: sanitized.title,
    desc: sanitized.desc,
    scope_note: sanitized.scope_note,
    icon: sanitized.icon,
    accent: sanitized.accent,
    mode: sanitized.mode,
    schema: sanitized.schema,
    code: sanitized.code,
  };
}

export const SANDBOX_CSP =
  "sandbox allow-scripts; default-src 'none'; style-src 'unsafe-inline'; " +
  "script-src 'unsafe-inline'; img-src data:; font-src data:; " +
  "connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'self'";

export const SANDBOX_RUNNER_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>衡账自定义计算沙盒</title>
<style>
:root{color-scheme:light;--ink:#1d2d35;--muted:#60727c;--line:#d8e2e7;--blue:#1f5a76;--bg:#f8fafb}
*{box-sizing:border-box}
body{margin:0;padding:16px;font:14px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;color:var(--ink);background:var(--bg)}
label{display:block;font-size:12.5px;color:#4f626d;margin-bottom:10px;font-weight:500}
input,select,textarea{width:100%;margin-top:4px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font:13.5px/1.4 inherit;color:var(--ink);background:#fff;outline:none}
input:focus,select:focus,textarea:focus{border-color:#6ea0b8;box-shadow:0 0 0 3px rgba(31,90,118,.12)}
button{padding:7px 14px;border-radius:8px;border:1px solid #bfd3dd;background:#edf5f9;color:var(--blue);font:600 13px/1.3 inherit;cursor:pointer}
button.primary{background:var(--blue);border-color:var(--blue);color:#fff}
.card,.box{background:#fff;border:1px solid #e1e8ec;border-radius:12px;padding:14px 16px;margin-bottom:12px}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th,td{padding:6px 8px;border-bottom:1px solid #edf2f5;text-align:left}
#__err{display:none;margin-top:10px;padding:10px 12px;border-radius:8px;background:#fdf1f1;border:1px solid #eccaca;color:#933e3e;font-size:12.5px;white-space:pre-wrap}
</style>
</head>
<body>
<div id="app"><p style="color:#8a989f;font-size:13px;text-align:center;padding:28px 0">正在加载小工具…</p></div>
<div id="__err" role="alert"></div>
<script>
(function(){
 var loaded=false;
 function showErr(msg){
  var el=document.getElementById('__err');
  if(el){el.style.display='block';el.textContent=String(msg||'运行出错');}
 }
 window.onerror=function(msg,src,line){showErr(msg+(line?' (第 '+line+' 行)':''));};
 window.onunhandledrejection=function(e){showErr(e&&e.reason?(e.reason.message||e.reason):'异步执行出错');};
 window.copyResult=function(text){
  parent.postMessage({type:'hz-calc-copy',text:String(text==null?'':text).slice(0,20000)},'*');
 };
 function notifyHeight(){
  var h=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight,220);
  parent.postMessage({type:'hz-calc-height',height:Math.min(h+12,2400)},'*');
 }
 window.addEventListener('message',function(ev){
  if(ev.source!==parent||!ev.data||ev.data.type!=='hz-calc-load')return;
  var err=document.getElementById('__err');if(err){err.style.display='none';err.textContent='';}
  var root=document.getElementById('app');
  root.innerHTML='';
  try{
   var tpl=document.createElement('template');
   tpl.innerHTML=String(ev.data.code||'');
   var scripts=[];
   var nodes=tpl.content.querySelectorAll('script');
   for(var i=0;i<nodes.length;i++){scripts.push(nodes[i].textContent||'');nodes[i].remove();}
   root.appendChild(tpl.content.cloneNode(true));
   for(var j=0;j<scripts.length;j++){
    var s=document.createElement('script');
    s.textContent=scripts[j];
    document.body.appendChild(s);
    s.remove();
   }
   loaded=true;
   setTimeout(notifyHeight,30);
  }catch(ex){showErr(ex&&ex.message?ex.message:ex);}
 });
 document.addEventListener('input',function(){if(loaded)setTimeout(notifyHeight,20);});
 document.addEventListener('click',function(){if(loaded)setTimeout(notifyHeight,30);});
 parent.postMessage({type:'hz-calc-ready'},'*');
})();
</script>
</body>
</html>
`;
