import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { invalid, amount } from "./money.js";
import { LITIGATION_STAGES } from "./litigation-stage.js";
import { splitParties } from "./case-ledger-fields.js";
import { calendarDate } from "./advisory-renewal.js";

export const AI_PROVIDERS = {
  siliconflow: {
    id: "siliconflow",
    name: "硅基流动 SiliconFlow（含免费模型 · 推荐）",
    short_name: "硅基流动（含免费）",
    protocol: "openai",
    base_url: "https://api.siliconflow.cn/v1",
    key_url: "https://cloud.siliconflow.cn/account/ak",
    key_label: "去硅基流动获取免费 API Key ↗",
    default_model: "Qwen/Qwen3-8B",
    endpoints: [
      { label: "硅基流动标准接口", url: "https://api.siliconflow.cn/v1" },
    ],
    models: [
      {
        id: "Qwen/Qwen3-8B",
        label: "Qwen/Qwen3-8B（免费 · 推荐，中文合同提取准确）",
        free: true,
      },
      {
        id: "Qwen/Qwen2.5-7B-Instruct",
        label: "Qwen/Qwen2.5-7B-Instruct（免费 · 稳定快速）",
        free: true,
      },
      {
        id: "THUDM/GLM-4-9B-0414",
        label: "THUDM/GLM-4-9B-0414（免费 · 智谱开源）",
        free: true,
      },
      {
        id: "deepseek-ai/DeepSeek-R1-0528-Qwen3-8B",
        label: "DeepSeek-R1-0528-Qwen3-8B（免费 · 推理增强）",
        free: true,
      },
      {
        id: "THUDM/GLM-Z1-9B-0414",
        label: "THUDM/GLM-Z1-9B-0414（免费 · 轻量推理）",
        free: true,
      },
      {
        id: "deepseek-ai/DeepSeek-V3",
        label: "deepseek-ai/DeepSeek-V3（付费 / 可用注册赠金）",
        free: false,
      },
      {
        id: "Qwen/Qwen2.5-72B-Instruct",
        label: "Qwen/Qwen2.5-72B-Instruct（付费 / 可用注册赠金）",
        free: false,
      },
    ],
  },
  zhipu: {
    id: "zhipu",
    name: "智谱开放平台 / GLM Coding Plan（含免费模型）",
    short_name: "智谱开放平台（含免费）",
    protocol: "openai",
    base_url: "https://open.bigmodel.cn/api/paas/v4",
    key_url: "https://open.bigmodel.cn/usercenter/proj-mgmt/apikeys",
    key_label: "去智谱开放平台获取 API Key ↗",
    default_model: "glm-4-flash",
    endpoints: [
      { label: "标准 API 接口", url: "https://open.bigmodel.cn/api/paas/v4" },
      {
        label: "GLM Coding Plan 接口",
        url: "https://open.bigmodel.cn/api/coding/paas/v4",
      },
    ],
    models: [
      {
        id: "glm-4-flash",
        label: "glm-4-flash（免费 · 智谱官方免费模型）",
        free: true,
      },
      {
        id: "glm-4.5",
        label: "glm-4.5（Coding Plan / 旗舰）",
        free: false,
      },
      {
        id: "glm-4-plus",
        label: "glm-4-plus（付费）",
        free: false,
      },
    ],
  },
  dashscope: {
    id: "dashscope",
    name: "阿里云百炼 / 通义 Coding Plan",
    short_name: "阿里云百炼",
    protocol: "openai",
    base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    key_url: "https://bailian.console.aliyun.com/?tab=model#/api-key",
    key_label: "去阿里云百炼获取 API Key ↗",
    default_model: "qwen-plus",
    endpoints: [
      {
        label: "百炼兼容接口",
        url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      },
      {
        label: "百炼 Coding Plan 接口",
        url: "https://coding.dashscope.aliyuncs.com/v1",
      },
    ],
    models: [
      { id: "qwen-plus", label: "qwen-plus（推荐）", free: false },
      {
        id: "qwen3-coder-plus",
        label: "qwen3-coder-plus（Coding Plan）",
        free: false,
      },
      { id: "qwen-max", label: "qwen-max（旗舰）", free: false },
      { id: "qwen-turbo", label: "qwen-turbo（高速）", free: false },
    ],
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek 官方 API",
    short_name: "DeepSeek 官方",
    protocol: "openai",
    base_url: "https://api.deepseek.com/v1",
    key_url: "https://platform.deepseek.com/api_keys",
    key_label: "去 DeepSeek 开放平台获取 API Key ↗",
    default_model: "deepseek-chat",
    endpoints: [{ label: "官方接口", url: "https://api.deepseek.com/v1" }],
    models: [
      {
        id: "deepseek-chat",
        label: "deepseek-chat (DeepSeek-V3)",
        free: false,
      },
      {
        id: "deepseek-reasoner",
        label: "deepseek-reasoner (DeepSeek-R1)",
        free: false,
      },
    ],
  },
  volcengine: {
    id: "volcengine",
    name: "火山方舟 / 豆包 Coding Plan",
    short_name: "火山方舟",
    protocol: "openai",
    base_url: "https://ark.cn-beijing.volces.com/api/v3",
    key_url: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
    key_label: "去火山方舟控制台获取 API Key ↗",
    default_model: "doubao-1-5-pro-32k-250115",
    endpoints: [
      {
        label: "方舟标准接口",
        url: "https://ark.cn-beijing.volces.com/api/v3",
      },
      {
        label: "方舟 Coding Plan 接口",
        url: "https://ark.cn-beijing.volces.com/api/coding/v3",
      },
    ],
    models: [
      {
        id: "doubao-1-5-pro-32k-250115",
        label: "doubao-1-5-pro-32k-250115",
        free: false,
      },
      {
        id: "deepseek-v3-250324",
        label: "deepseek-v3-250324",
        free: false,
      },
    ],
  },
  custom_openai: {
    id: "custom_openai",
    name: "自定义 OpenAI 兼容接口 / 其他 Coding Plan",
    short_name: "自定义接口",
    protocol: "openai",
    base_url: "",
    key_url: "",
    key_label: "",
    default_model: "",
    endpoints: [],
    models: [],
  },
  custom_anthropic: {
    id: "custom_anthropic",
    name: "Anthropic / Claude 兼容接口（/v1/messages）",
    short_name: "Anthropic",
    protocol: "anthropic",
    base_url: "https://api.anthropic.com/v1",
    key_url: "https://console.anthropic.com/settings/keys",
    key_label: "去 Anthropic Console 获取 API Key ↗",
    default_model: "claude-sonnet-4-20250514",
    endpoints: [
      { label: "Anthropic 标准接口", url: "https://api.anthropic.com/v1" },
    ],
    models: [
      {
        id: "claude-sonnet-4-20250514",
        label: "claude-sonnet-4-20250514",
        free: false,
      },
      {
        id: "claude-3-7-sonnet-latest",
        label: "claude-3-7-sonnet-latest",
        free: false,
      },
    ],
  },
};

const KNOWN_FREE_MODEL_IDS = new Set([
  "Qwen/Qwen3-8B",
  "Qwen/Qwen2.5-7B-Instruct",
  "Qwen/Qwen2.5-Coder-7B-Instruct",
  "Qwen/Qwen2-7B-Instruct",
  "Qwen/Qwen2-1.5B-Instruct",
  "THUDM/GLM-4-9B-0414",
  "THUDM/GLM-Z1-9B-0414",
  "THUDM/glm-4-9b-chat",
  "deepseek-ai/DeepSeek-R1-0528-Qwen3-8B",
  "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
  "internlm/internlm2_5-7b-chat",
  "glm-4-flash",
]);

function normalizeBaseUrl(url) {
  const raw = String(url || "").trim().replace(/\/+$/, "");
  if (!raw) throw invalid("请填写 API 接口地址（Base URL）");
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw invalid("API 接口地址格式无效，须以 https:// 或 http://localhost 开头");
  }
  const isLocal =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "::1";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLocal))
    throw invalid("远程 API 接口地址必须使用 https:// 协议");
  return raw;
}

function maskKey(key) {
  const s = String(key || "").trim();
  if (!s) return "";
  if (s.length <= 8) return "••••";
  return s.slice(0, 3) + "••••" + s.slice(-4);
}

export class AiConfigStore {
  constructor(dataDir) {
    this.file = path.join(dataDir, "ai-config.json");
    this.config = {
      provider: "siliconflow",
      protocol: "openai",
      base_url: AI_PROVIDERS.siliconflow.base_url,
      api_key: "",
      model: AI_PROVIDERS.siliconflow.default_model,
    };
    this.load();
  }

  load() {
    if (!fs.existsSync(this.file)) return;
    try {
      const saved = JSON.parse(fs.readFileSync(this.file, "utf8"));
      const provider = Object.hasOwn(AI_PROVIDERS, saved.provider)
        ? saved.provider
        : "custom_openai";
      const preset = AI_PROVIDERS[provider];
      this.config = {
        provider,
        protocol:
          saved.protocol === "anthropic" ? "anthropic" : preset.protocol,
        base_url:
          typeof saved.base_url === "string" && saved.base_url.trim()
            ? saved.base_url.trim().replace(/\/+$/, "")
            : preset.base_url,
        api_key: typeof saved.api_key === "string" ? saved.api_key.trim() : "",
        model:
          typeof saved.model === "string" && saved.model.trim()
            ? saved.model.trim()
            : preset.default_model,
      };
    } catch {
      // Ignore corrupted local AI config and fall back to defaults.
    }
  }

  save(input = {}) {
    const provider = Object.hasOwn(AI_PROVIDERS, input.provider)
      ? input.provider
      : this.config.provider;
    const preset = AI_PROVIDERS[provider];
    const protocol =
      input.protocol === "anthropic" || preset.protocol === "anthropic"
        ? "anthropic"
        : "openai";
    const baseUrl = normalizeBaseUrl(
      input.base_url !== undefined ? input.base_url : preset.base_url,
    );
    const model = String(
      input.model !== undefined ? input.model : preset.default_model,
    ).trim();
    if (!model || model.length > 200) throw invalid("请选择或填写模型名称");

    let apiKey = this.config.api_key;
    if (input.clear_api_key) {
      apiKey = "";
    } else if (typeof input.api_key === "string" && input.api_key.trim()) {
      apiKey = input.api_key.trim();
    }
    if (apiKey.length > 500) throw invalid("API Key 长度超出范围");

    this.config = {
      provider,
      protocol,
      base_url: baseUrl,
      api_key: apiKey,
      model,
    };
    const temp = this.file + "." + randomUUID() + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(this.config), { mode: 0o600 });
    fs.renameSync(temp, this.file);
    return this.publicView();
  }

  resolve(override = {}) {
    const provider = Object.hasOwn(AI_PROVIDERS, override.provider)
      ? override.provider
      : this.config.provider;
    const preset = AI_PROVIDERS[provider];
    const protocol =
      override.protocol === "anthropic" || preset.protocol === "anthropic"
        ? "anthropic"
        : "openai";
    const base_url = normalizeBaseUrl(
      override.base_url || this.config.base_url || preset.base_url,
    );
    const model = String(
      override.model || this.config.model || preset.default_model || "",
    ).trim();
    const api_key = String(
      override.api_key && override.api_key.trim()
        ? override.api_key
        : this.config.api_key || "",
    ).trim();
    const isLocal = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(\/|$)/i.test(
      base_url,
    );
    if (!api_key && !isLocal)
      throw invalid("请先在「设置与备份 → AI 合同识别」中配置 API Key");
    if (!model) throw invalid("请先选择或填写 AI 模型名称");
    return { provider, protocol, base_url, api_key, model };
  }

  publicView() {
    const preset = AI_PROVIDERS[this.config.provider] || AI_PROVIDERS.siliconflow;
    return {
      provider: this.config.provider,
      provider_name: preset.name,
      protocol: this.config.protocol,
      base_url: this.config.base_url,
      model: this.config.model,
      has_api_key: Boolean(this.config.api_key),
      masked_api_key: maskKey(this.config.api_key),
      is_free_model: KNOWN_FREE_MODEL_IDS.has(this.config.model),
      providers: Object.values(AI_PROVIDERS),
    };
  }
}

export async function fetchProviderModels(
  resolved,
  { fetchImpl = fetch, timeoutMs = 12000 } = {},
) {
  const preset = AI_PROVIDERS[resolved.provider] || AI_PROVIDERS.custom_openai;
  const curated = [...(preset.models || [])];
  const seen = new Set(curated.map((m) => m.id));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const endpoint =
      resolved.provider === "siliconflow"
        ? resolved.base_url + "/models?sub_type=chat"
        : resolved.base_url + "/models";
    const headers = { Accept: "application/json" };
    if (resolved.api_key) {
      if (resolved.protocol === "anthropic") {
        headers["x-api-key"] = resolved.api_key;
        headers["anthropic-version"] = "2023-06-01";
      } else {
        headers.Authorization = "Bearer " + resolved.api_key;
      }
    }
    const res = await fetchImpl(endpoint, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    if (res.ok) {
      const body = await res.json();
      const list = Array.isArray(body?.data) ? body.data : [];
      for (const item of list) {
        const id = String(item?.id || "").trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const free = KNOWN_FREE_MODEL_IDS.has(id);
        curated.push({
          id,
          label: free ? id + "（免费）" : id,
          free,
        });
      }
    }
  } catch {
    // Fall back to curated preset models if /models is unsupported by the endpoint.
  } finally {
    clearTimeout(timer);
  }
  curated.sort((a, b) => Number(Boolean(b.free)) - Number(Boolean(a.free)));
  return curated;
}

export async function callChatModel(
  resolved,
  messages,
  { fetchImpl = fetch, timeoutMs = 45000, maxTokens = 1800 } = {},
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let url, headers, payload;
    if (resolved.protocol === "anthropic") {
      url = resolved.base_url.endsWith("/messages")
        ? resolved.base_url
        : resolved.base_url + "/messages";
      headers = {
        "Content-Type": "application/json",
        "x-api-key": resolved.api_key,
        "anthropic-version": "2023-06-01",
      };
      if (resolved.api_key)
        headers.Authorization = "Bearer " + resolved.api_key;
      const systemMsg = messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n\n");
      const userMsgs = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content }));
      payload = {
        model: resolved.model,
        max_tokens: maxTokens,
        temperature: 0.1,
        ...(systemMsg ? { system: systemMsg } : {}),
        messages: userMsgs,
      };
    } else {
      url = resolved.base_url.endsWith("/chat/completions")
        ? resolved.base_url
        : resolved.base_url + "/chat/completions";
      headers = { "Content-Type": "application/json" };
      if (resolved.api_key)
        headers.Authorization = "Bearer " + resolved.api_key;
      payload = {
        model: resolved.model,
        messages,
        temperature: 0.1,
        max_tokens: maxTokens,
        stream: false,
      };
    }

    const res = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const rawText = await res.text();
    let data = null;
    try {
      data = JSON.parse(rawText);
    } catch {}

    if (!res.ok) {
      const detail =
        data?.error?.message ||
        data?.message ||
        (res.status === 401 || res.status === 403
          ? "API Key 无效或无权访问该模型"
          : res.status === 429
            ? "请求过于频繁或免费额度已达上限，请稍后再试或切换其他模型"
            : "AI 接口返回错误（状态码 " + res.status + "）");
      throw invalid(String(detail).slice(0, 240));
    }

    let content = "";
    if (resolved.protocol === "anthropic") {
      content = Array.isArray(data?.content)
        ? data.content
            .filter((block) => block?.type === "text")
            .map((block) => block.text)
            .join("\n")
        : String(data?.content || "");
    } else {
      content = String(data?.choices?.[0]?.message?.content || "");
    }

    if (!content.trim()) throw invalid("AI 模型未返回有效内容，请重试或更换模型");
    return content.trim();
  } catch (error) {
    if (error.status) throw error;
    if (controller.signal.aborted)
      throw invalid("AI 识别超时，请检查网络或切换响应更快的模型");
    throw invalid("无法连接 AI 接口，请检查接口地址与网络连接");
  } finally {
    clearTimeout(timer);
  }
}

function normalizeDateString(val) {
  const raw = String(val ?? "").trim();
  if (!raw) return "";
  const m = raw.match(/(\d{4})\s*[-./年]\s*(\d{1,2})\s*[-./月]\s*(\d{1,2})/);
  if (!m) return "";
  const formatted = [
    m[1],
    m[2].padStart(2, "0"),
    m[3].padStart(2, "0"),
  ].join("-");
  return calendarDate(formatted) ? formatted : "";
}

function normalizeMoneyValue(val) {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") {
    try {
      return amount(val, "金额");
    } catch {
      return null;
    }
  }
  let s = String(val).trim().replace(/[¥￥,，元整人民币\s]/g, "");
  if (!s) return null;
  let multiplier = 1;
  if (s.endsWith("万")) {
    multiplier = 10000;
    s = s.slice(0, -1);
  }
  const num = Number(s);
  if (!Number.isFinite(num) || num < 0) return null;
  try {
    return amount(Math.round(num * multiplier * 100) / 100, "金额");
  } catch {
    return null;
  }
}

export function extractJsonFromModelOutput(raw) {
  const withoutThink = String(raw || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
  const fenced = withoutThink.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : withoutThink;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start)
    throw invalid("AI 返回的数据格式无法解析，请重试或更换模型");
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw invalid("AI 返回的 JSON 格式不完整，请重试或切换其他模型");
  }
}

export function normalizeExtractedContract(rawObj) {
  const obj = rawObj && typeof rawObj === "object" ? rawObj : {};
  const track = ["litigation", "advisory", "project"].includes(obj.track)
    ? obj.track
    : obj.service_start || obj.service_end
      ? "advisory"
      : obj.name && !obj.plaintiff && !obj.defendant && !obj.case_type
        ? "project"
        : "litigation";

  const scopeList = Array.isArray(obj.scope)
    ? obj.scope
    : splitParties(obj.scope);
  const validStages = scopeList
    .map((s) => String(s).trim())
    .filter((s) => LITIGATION_STAGES.includes(s));
  const stage = LITIGATION_STAGES.includes(String(obj.case_stage || "").trim())
    ? String(obj.case_stage).trim()
    : validStages[0] || "";

  const lawyers = splitParties(obj.lawyer);
  const primaryLawyer = lawyers[0] || "";
  const extraLawyers = [
    ...lawyers.slice(1),
    ...splitParties(obj.co_lawyers),
  ].filter((n) => n && n !== primaryLawyer);

  return {
    track,
    case_no: String(obj.case_no || "").trim().slice(0, 120),
    client: splitParties(obj.client).join(","),
    client_contact: String(obj.client_contact || "").trim().slice(0, 200),
    plaintiff: splitParties(obj.plaintiff).join(","),
    defendant: splitParties(obj.defendant).join(","),
    third_party: splitParties(obj.third_party).join(","),
    opponent: splitParties(obj.opponent).join(","),
    case_type: String(obj.case_type || "").trim().slice(0, 200),
    case_stage: track === "litigation" ? stage : "",
    scope: track === "litigation" ? [...new Set(validStages)] : [],
    name: String(obj.name || "").trim().slice(0, 300),
    service_start: normalizeDateString(obj.service_start),
    service_end: normalizeDateString(obj.service_end),
    lawyer: primaryLawyer,
    co_lawyers: [...new Set(extraLawyers)],
    sign_date: normalizeDateString(obj.sign_date),
    contract_amount: normalizeMoneyValue(obj.contract_amount),
    fee_note: String(obj.fee_note || "").trim().slice(0, 4000),
    notes: String(obj.notes || "").trim().slice(0, 4000),
  };
}

const CONTRACT_SYSTEM_PROMPT = `你是一名专业的中国律师事务所行政与案件台账助手。请从用户提供的《委托代理合同》《常年法律顾问合同》《专项法律服务合同》文本，或用户粘贴的案情沟通、收费约定、当事人信息等文字片段中提取案件建档字段，并严格只输出一个 JSON 对象，不要输出任何额外解释。

字段规则：
1. "track": 案件类型，只能是以下三者之一：
   - "litigation"：民事/商事/行政/刑事诉讼或商事/劳动仲裁代理合同
   - "advisory"：常年法律顾问合同
   - "project"：非诉专项法律服务合同（如尽职调查、投融资、常年顾问以外的专项出具法律意见或合同审查等）
2. "case_no": 合同上的律所内部案号或合同编号（如无明确编号则填 ""）。
3. "client": 委托人（通常为合同甲方/委托方，不要把受托律师事务所当作客户）。多个委托人用英文逗号 "," 分隔。
4. "client_contact": 委托方指定的联系人姓名及电话/邮箱（如有，例如 "王经理 13800000000"；无则填 ""）。
5. 诉讼/仲裁（track 为 "litigation"）专用字段：
   - "plaintiff": 原告 / 申请人 / 上诉人（多个用 "," 分隔；若合同仅指明委托人及对方当事人，请结合委托人诉讼地位判断原被告）
   - "defendant": 被告 / 被申请人 / 被上诉人（多个用 "," 分隔）
   - "third_party": 第三人（多个用 "," 分隔，无则填 ""）
   - "case_type": 案由（如 "买卖合同纠纷"、"民间借贷纠纷"、"劳动争议" 等）
   - "case_stage": 当前代理阶段，只能从 ["仲裁", "一审", "二审", "执行", "再审", ""] 中选择最匹配的 1 个
   - "scope": 合同约定代理的全部阶段数组，元素只能从 ["仲裁", "一审", "二审", "执行", "再审"] 中选择
6. 常年法律顾问（track 为 "advisory"）专用字段：
   - "service_start": 顾问服务开始日期，格式 "YYYY-MM-DD"（无则填 ""）
   - "service_end": 顾问服务结束日期，格式 "YYYY-MM-DD"（无则填 ""）
7. 专项法律服务（track 为 "project"）专用字段：
   - "name": 专项项目名称或委托事项名称（如 "收购XX公司股权专项法律服务"）
   - "opponent": 对方当事人 / 交易对手（多个用 "," 分隔，无则填 ""）
8. 通用字段：
   - "lawyer": 主办/指派承办律师姓名（仅填人名，不要带“律师”二字；若有多名指派律师，第 1 人填在 lawyer，其余填在 co_lawyers）
   - "co_lawyers": 协办律师姓名数组（仅填人名，无则填 []）
   - "sign_date": 合同签订日期，格式 "YYYY-MM-DD"（若仅有签署年份无月日或未签署则填 ""）
   - "contract_amount": 合同约定的固定律师费总额（数字，单位：元，如 50000；若为纯风险代理无固定基础金额，则填 null）
   - "fee_note": 简明完整地提炼合同中的律师费条款（包含固定收费金额、分期付款节点与条件、风险代理费的计算基数与比例、差旅费承担等）
   - "notes": 其他重要合同信息备注（如管辖法院/仲裁机构名称、特别授权等；无则填 ""）

请直接输出如下结构的 JSON：
{
  "track": "litigation",
  "case_no": "",
  "client": "",
  "client_contact": "",
  "plaintiff": "",
  "defendant": "",
  "third_party": "",
  "opponent": "",
  "case_type": "",
  "case_stage": "",
  "scope": [],
  "name": "",
  "service_start": "",
  "service_end": "",
  "lawyer": "",
  "co_lawyers": [],
  "sign_date": "",
  "contract_amount": null,
  "fee_note": "",
  "notes": ""
}`;

export async function extractCaseFromContractText(
  contractText,
  resolvedConfig,
  options = {},
) {
  const raw = await callChatModel(
    resolvedConfig,
    [
      { role: "system", content: CONTRACT_SYSTEM_PROMPT },
      {
        role: "user",
        content:
          "以下是法律服务合同或案件描述文本，请提取案件信息并返回 JSON：\n\n" +
          String(contractText || ""),
      },
    ],
    options,
  );
  const parsed = extractJsonFromModelOutput(raw);
  return normalizeExtractedContract(parsed);
}
