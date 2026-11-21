import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { invalid, amount } from "./money.js";
import { LITIGATION_STAGES } from "./litigation-stage.js";
import { splitParties } from "./case-ledger-fields.js";
import { calendarDate } from "./advisory-renewal.js";
import { MAX_CONTRACT_CHARS } from "./contract-reader.js";

export const AI_PROVIDERS = {
  siliconflow: {
    id: "siliconflow",
    name: "硅基流动 SiliconFlow（含免费多模态 OCR 与文本模型 · 推荐）",
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
        label: "Qwen/Qwen3-8B（免费 · 推荐，中文合同提取准确，扫描件自动联动免费多模态 OCR）",
        free: true,
      },
      {
        id: "Qwen/Qwen3-VL-8B-Instruct",
        label: "Qwen/Qwen3-VL-8B-Instruct（免费 · 多模态视觉大模型，支持看图识别）",
        free: true,
      },
      {
        id: "PaddlePaddle/PaddleOCR-VL-1.5",
        label: "PaddlePaddle/PaddleOCR-VL-1.5（免费 · 百度飞桨多模态文档 OCR）",
        free: true,
      },
      {
        id: "deepseek-ai/DeepSeek-OCR",
        label: "deepseek-ai/DeepSeek-OCR（免费 · DeepSeek 专用多模态 OCR）",
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
        id: "glm-4v-flash",
        label: "glm-4v-flash（免费 · 智谱多模态视觉模型）",
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
  "Qwen/Qwen3-VL-8B-Instruct",
  "Qwen/Qwen3-VL-8B-Thinking",
  "PaddlePaddle/PaddleOCR-VL-1.5",
  "deepseek-ai/DeepSeek-OCR",
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
  "glm-4v-flash",
]);

const PURE_OCR_MODEL_IDS = new Set([
  "PaddlePaddle/PaddleOCR-VL-1.5",
  "deepseek-ai/DeepSeek-OCR",
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
  {
    fetchImpl = fetch,
    timeoutMs = 90000,
    maxTokens = 1800,
    frequencyPenalty,
  } = {},
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
      const disableThinking =
        /qwen3/i.test(resolved.model) &&
        !/r1|thinking|vl/i.test(resolved.model);
      payload = {
        model: resolved.model,
        messages,
        temperature: 0.1,
        max_tokens: maxTokens,
        ...(typeof frequencyPenalty === "number"
          ? { frequency_penalty: frequencyPenalty }
          : {}),
        ...(disableThinking ? { enable_thinking: false } : {}),
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
      const rawMsg = String(data?.error?.message || data?.message || "");
      const isRateLimited =
        res.status === 429 ||
        /rate limit|tpm limit|rpm limit|too many requests|quota/i.test(rawMsg);
      const isModelUnavailable =
        res.status === 404 ||
        res.status >= 500 ||
        /model.*(?:disabled|not exist|not found|deprecated|unavailable|offline)|does not exist/i.test(
          rawMsg,
        ) ||
        data?.code === 30003 ||
        data?.code === 20012;
      const detail =
        rawMsg ||
        (res.status === 401 || res.status === 403
          ? "API Key 无效或无权访问该模型"
          : isRateLimited
            ? "请求过于频繁或免费额度已达上限，请稍后再试或切换其他模型"
            : "AI 接口返回错误（状态码 " + res.status + "）");
      const err = invalid(String(detail).slice(0, 240));
      err.isRateLimit = isRateLimited;
      err.isModelUnavailable = isModelUnavailable;
      throw err;
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

export function cleanMultimodalOcrText(raw) {
  return String(raw || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\|LOC_\d+\|>/g, "")
    .replace(/\\\(\s*\\underline\{\\text\{([^}]*)\}\}\s*\\\)/g, "$1")
    .replace(/\\\(\s*\\underline\{([^}]*)\}\s*\\\)/g, "$1")
    .replace(/\\underline\{\\text\{([^}]*)\}\}/g, "$1")
    .replace(/\\underline\{([^}]*)\}/g, "$1")
    .replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/\\\(|\\\)/g, "")
    .replace(/(?:_+[（(](?:公章|盖章|签章|签字)[)）]){3,}/g, "（盖章）")
    .replace(/(?:[（(](?:公章|盖章|签章|签字)[)）][_:：\s]*){3,}/g, "（盖章）")
    .replace(/_{4,}/g, "___")
    .trim();
}

export function resolveMultimodalOcrModels(resolved) {
  if (!resolved || resolved.protocol === "anthropic") return [];
  const baseUrl = String(resolved.base_url || "").toLowerCase();
  const model = String(resolved.model || "");
  if (
    resolved.provider === "siliconflow" ||
    baseUrl.includes("siliconflow.cn")
  ) {
    const preferred = [
      "PaddlePaddle/PaddleOCR-VL-1.5",
      "deepseek-ai/DeepSeek-OCR",
      "Qwen/Qwen3-VL-8B-Instruct",
    ];
    if (/vl|ocr/i.test(model) && !preferred.includes(model)) {
      preferred.unshift(model);
    } else if (preferred.includes(model)) {
      preferred.splice(preferred.indexOf(model), 1);
      preferred.unshift(model);
    }
    return preferred;
  }
  if (resolved.provider === "zhipu" || baseUrl.includes("bigmodel.cn")) {
    return /4v|vl/i.test(model) ? [model] : ["glm-4v-flash"];
  }
  if (/vl|vision|ocr/i.test(model)) {
    return [model];
  }
  return [];
}

async function ocrSinglePageWithModel(
  resolved,
  ocrModel,
  dataUrl,
  { fetchImpl = fetch, timeoutMs = 35000 } = {},
) {
  const isDedicatedOcr = PURE_OCR_MODEL_IDS.has(ocrModel);
  const prompt = isDedicatedOcr
    ? "OCR:"
    : "请逐行准确识别图片中的合同正文、手写填空、下划线文字、金额与日期（忽略红色印章边缘的13位防伪数字编码），只输出识别出的原文：";
  const raw = await callChatModel(
    { ...resolved, model: ocrModel },
    [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: dataUrl } },
          { type: "text", text: prompt },
        ],
      },
    ],
    {
      fetchImpl,
      timeoutMs,
      maxTokens: 1500,
      ...(isDedicatedOcr ? { frequencyPenalty: 0.3 } : {}),
    },
  );
  return cleanMultimodalOcrText(raw);
}

function selectKeyScannedPages(images, maxVlmPages = 6) {
  if (images.length <= maxVlmPages) {
    return new Set(images.map((_, idx) => idx));
  }
  const scored = images.map((item, idx) => {
    const p = item.page ?? idx + 1;
    const vt = String(item.vision_text || "");
    let score = 0;
    if (p === 1) score += 100;
    if (p === 2) score += 80;
    if (vt.replace(/\s+/g, "").length < 100) score += 45;
    if (/合同编号|顾字第|民字第|刑字第|非诉字|案号/.test(vt)) score += 60;
    if (/指派|顾问律师|承办律师|代理律师|委托人|受托人/.test(vt)) score += 55;
    if (/期限|年\s*\d{1,2}\s*月|起至/.test(vt)) score += 65;
    if (/律师费|顾问费|代理费|人民币|万元|仟元|\d{4,}\s*元/.test(vt)) score += 65;
    if (/联系人|联系电话|电子邮件|@|1[3-9]\d{9}/.test(vt)) score += 55;
    if (/签订日期|签署日期|法定代表人|法人代表|授权代表/.test(vt)) score += 50;
    if (/保密承诺书|保密内容|保密义务/.test(vt) && p > 2) score -= 40;
    return { idx, score };
  });
  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
  return new Set(scored.slice(0, maxVlmPages).map((s) => s.idx));
}

export async function recognizeScannedPagesWithVlm(
  pageImages,
  resolved,
  { fetchImpl = fetch, concurrency = 4, maxVlmPages = 6 } = {},
) {
  const images = Array.isArray(pageImages)
    ? pageImages.filter((p) => p && typeof p.data_url === "string" && p.data_url)
    : [];
  const candidateModels = resolveMultimodalOcrModels(resolved);
  if (!images.length || !candidateModels.length) {
    return { used_model: null, pages: [] };
  }

  const selectedIndices = selectKeyScannedPages(images, maxVlmPages);

  for (const ocrModel of candidateModels) {
    try {
      const results = images.map((item, idx) => ({
        page: item.page ?? idx + 1,
        vlm_text: "",
        vision_text: String(item.vision_text || "").trim(),
      }));
      const targetQueue = [...selectedIndices].sort((a, b) => a - b);
      let cursor = 0;
      const workers = Array.from(
        { length: Math.min(concurrency, targetQueue.length) },
        async () => {
          while (cursor < targetQueue.length) {
            const idx = targetQueue[cursor++];
            const item = images[idx];
            try {
              const text = await ocrSinglePageWithModel(
                resolved,
                ocrModel,
                item.data_url,
                { fetchImpl },
              );
              results[idx].vlm_text = text;
            } catch {
              // Keep local vision_text for this page if VLM fails on a single page.
            }
          }
        },
      );
      await Promise.all(workers);
      const succeeded = results.filter(
        (r) => r && r.vlm_text && r.vlm_text.replace(/\s+/g, "").length >= 6,
      ).length;
      if (succeeded > 0) {
        return { used_model: ocrModel, pages: results };
      }
    } catch {
      // Try next candidate OCR model or fall back to local Vision text.
    }
  }
  return { used_model: null, pages: [] };
}

function buildHybridScannedText(vlmPages, fallbackText) {
  if (!Array.isArray(vlmPages) || !vlmPages.length) return fallbackText;
  const blocks = [];
  for (const p of vlmPages) {
    const primary = String(p.vlm_text || "").trim();
    const vision = String(p.vision_text || "").trim();
    if (!primary && !vision) continue;
    if (!primary) {
      blocks.push(vision);
      continue;
    }
    const keyVisionLines = vision
      .split("\n")
      .map((l) => l.trim())
      .filter(
        (l) =>
          /(?:顾字第|刑字第|民字第|非诉字|合同编号|案号|指派|期限|签订日期|\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日)/.test(
            l,
          ) && !/法人代表.*?\d{6,}/.test(l),
      );
    if (keyVisionLines.length) {
      blocks.push(
        primary +
          "\n【本页本机OCR辅助核对：" +
          keyVisionLines.slice(0, 4).join(" / ") +
          "】",
      );
    } else {
      blocks.push(primary);
    }
  }
  const merged = blocks.join("\n\n").trim();
  return merged.replace(/\s+/g, "").length >= 10 ? merged : fallbackText;
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
  const raw = String(val).trim();
  const m = raw.match(/(\d[\d,，]*(?:\.\d+)?)\s*(万)?/);
  if (!m) return null;
  const num = Number(m[1].replace(/[,，]/g, ""));
  const multiplier = m[2] === "万" ? 10000 : 1;
  if (!Number.isFinite(num) || num < 0) return null;
  try {
    return amount(Math.round(num * multiplier * 100) / 100, "金额");
  } catch {
    return null;
  }
}

export function sanitizeClientContact(val) {
  const raw = String(val ?? "").trim();
  if (!raw) return "";
  // Filter out company seal anti-counterfeit numbers (e.g. "法人代表：01100856-32" or 13-digit seal numbers 5101...)
  const hasValidPhoneOrEmail =
    /(?:1[3-9]\d{9}|0\d{2,3}-\d{7,8}|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/.test(
      raw,
    );
  if (!hasValidPhoneOrEmail) {
    if (
      /^(?:法定?代表人?|法人代表.?|授权代表|负责人|公章|盖章|签章)[:：\s]*[\d-]{5,}$/i.test(
        raw,
      )
    ) {
      return "";
    }
    if (/^\d{5,9}-\d{1,4}$/.test(raw) || /^5101\d{8,10}$/.test(raw)) {
      return "";
    }
  }
  return raw
    .replace(/(?:法定?代表人?|法人代表.?)[:：\s]*\d{5,9}-\d{1,4}[，,;\s]*/g, "")
    .trim()
    .slice(0, 200);
}

function calibrateAdvisoryDates(startStr, endStr, contractText = "") {
  if (!startStr || !endStr) return { service_start: startStr, service_end: endStr };
  const sm = startStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const em = endStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!sm || !em) return { service_start: startStr, service_end: endStr };

  const sYear = Number(sm[1]),
    sMonth = Number(sm[2]),
    sDay = Number(sm[3]);
  const eYear = Number(em[1]),
    eMonth = Number(em[2]),
    eDay = Number(em[3]);

  const isOneYearContract =
    /期限为?\s*[壹一1]\s*年/.test(contractText) &&
    !/13\s*个月|十三\s*个月/.test(contractText);

  // If a 1-year contract starts on YYYY-MM-01 and end date was misread as (YYYY+1)-MM-30/31 instead of end of (MM-1)
  if (
    isOneYearContract &&
    sDay === 1 &&
    eYear === sYear + 1 &&
    eMonth === sMonth &&
    eDay >= 28 &&
    sMonth > 1
  ) {
    const prevMonth = sMonth - 1;
    const lastDayOfPrevMonth = new Date(Date.UTC(eYear, prevMonth, 0)).getUTCDate();
    const corrected = [
      String(eYear),
      String(prevMonth).padStart(2, "0"),
      String(lastDayOfPrevMonth).padStart(2, "0"),
    ].join("-");
    if (calendarDate(corrected)) {
      return { service_start: startStr, service_end: corrected };
    }
  }
  return { service_start: startStr, service_end: endStr };
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

export function normalizeExtractedContract(rawObj, contractText = "") {
  const obj = rawObj && typeof rawObj === "object" ? rawObj : {};
  const rawTrack = String(obj.track || "").trim();
  const track = ["litigation", "advisory", "project"].includes(rawTrack)
    ? rawTrack
    : /顾问|advisory/i.test(rawTrack) || obj.service_start || obj.service_end
      ? "advisory"
      : /专项|非诉|project/i.test(rawTrack) ||
          (obj.name && !obj.plaintiff && !obj.defendant && !obj.case_type)
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

  const cleanLawyerName = (n) =>
    String(n || "")
      .replace(/律师$/g, "")
      .trim();
  const allLawyers = [
    ...splitParties(obj.lawyer).map(cleanLawyerName),
    ...splitParties(obj.co_lawyers).map(cleanLawyerName),
  ].filter(Boolean);
  const primaryLawyer = allLawyers[0] || "";
  const extraLawyers = allLawyers
    .slice(1)
    .filter((n) => n && n !== primaryLawyer);

  const rawStart = normalizeDateString(obj.service_start);
  const rawEnd = normalizeDateString(obj.service_end);
  const { service_start, service_end } =
    track === "advisory"
      ? calibrateAdvisoryDates(rawStart, rawEnd, contractText)
      : { service_start: rawStart, service_end: rawEnd };

  return {
    track,
    case_no: String(obj.case_no || "").trim().slice(0, 120),
    client: splitParties(obj.client).join(","),
    client_contact: sanitizeClientContact(obj.client_contact),
    plaintiff: splitParties(obj.plaintiff).join(","),
    defendant: splitParties(obj.defendant).join(","),
    third_party: splitParties(obj.third_party).join(","),
    opponent: splitParties(obj.opponent).join(","),
    case_type: String(obj.case_type || "").trim().slice(0, 200),
    case_stage: track === "litigation" ? stage : "",
    scope: track === "litigation" ? [...new Set(validStages)] : [],
    name: String(obj.name || "").trim().slice(0, 300),
    service_start,
    service_end,
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
2. "case_no": 合同上的律所内部案号或合同编号（如 "大成蓉（2026）顾字第38号"；如无明确编号则填 ""）。
3. "client": 委托人（通常为合同甲方/委托方，不要把受托律师事务所当作客户）。多个委托人用英文逗号 "," 分隔。
4. "client_contact": 委托方（甲方）指定的联系人姓名及电话/邮箱（如有，例如 "潘家茹 18781656315"；若甲方未填写联系人或联系电话则填 ""。切勿将公章印文边缘的13位印章防伪编码如 "5101100586155" 或 "01100856-32" 当作电话或联系人）。
5. 诉讼/仲裁（track 为 "litigation"）专用字段：
   - "plaintiff": 原告 / 申请人 / 上诉人（多个用 "," 分隔；若合同仅指明委托人及对方当事人，请结合委托人诉讼地位判断原被告）
   - "defendant": 被告 / 被申请人 / 被上诉人（多个用 "," 分隔）
   - "third_party": 第三人（多个用 "," 分隔，无则填 ""）
   - "case_type": 案由（如 "买卖合同纠纷"、"民间借贷纠纷"、"劳动争议" 等）
   - "case_stage": 当前代理阶段，只能从 ["仲裁", "一审", "二审", "执行", "再审", ""] 中选择最匹配的 1 个
   - "scope": 合同约定代理的全部阶段数组，元素只能从 ["仲裁", "一审", "二审", "执行", "再审"] 中选择
6. 常年法律顾问（track 为 "advisory"）专用字段：
   - "service_start": 顾问服务开始日期，格式 "YYYY-MM-DD"（无则填 ""）
   - "service_end": 顾问服务结束日期，格式 "YYYY-MM-DD"（无则填 ""；注意核对服务期限：若约定服务期限为壹年/1年且从 YYYY-05-01 起算，结束日期应为次年 04-30 而非 05-30）
7. 专项法律服务（track 为 "project"）专用字段：
   - "name": 专项项目名称或委托事项名称（如 "收购XX公司股权专项法律服务"）
   - "opponent": 对方当事人 / 交易对手（多个用 "," 分隔，无则填 ""）
8. 通用字段：
   - "lawyer": 主办/第一指派承办律师姓名（仅填人名，不要带“律师”二字）
   - "co_lawyers": 协办/团队其他指派律师姓名数组（仅填人名，无则填 []。注意：若合同既有“第一条指派顾问/代理律师团队名单”又有“乙方主要联系人名单”，必须提取指派团队的全部律师名单，第 1 人填在 lawyer，其余全部填在 co_lawyers，切勿遗漏团队成员）
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
  contractInput,
  resolvedConfig,
  options = {},
) {
  const isDocObject =
    contractInput &&
    typeof contractInput === "object" &&
    !Array.isArray(contractInput);
  let text = isDocObject
    ? String(contractInput.text || "")
    : String(contractInput || "");
  const pageImages = isDocObject ? contractInput.page_images || [] : [];
  let ocrModelUsed = null;

  if (pageImages.length > 0) {
    const vlmResult = await recognizeScannedPagesWithVlm(
      pageImages,
      resolvedConfig,
      options,
    );
    if (vlmResult.used_model && vlmResult.pages.length) {
      ocrModelUsed = vlmResult.used_model;
      text = buildHybridScannedText(vlmResult.pages, text).slice(
        0,
        MAX_CONTRACT_CHARS,
      );
    }
  }

  if (text.replace(/\s+/g, "").length < 6) {
    throw invalid("未能在合同文件中识别出有效文字，请确认文件内容清晰可读");
  }

  // If the user selected a dedicated OCR-only model (e.g. PaddleOCR-VL-1.5 or DeepSeek-OCR),
  // use Qwen/Qwen3-8B on SiliconFlow for the JSON structuring step.
  const isSiliconFlow =
    resolvedConfig.provider === "siliconflow" ||
    String(resolvedConfig.base_url || "").includes("siliconflow.cn");
  const primaryExtractionModel =
    PURE_OCR_MODEL_IDS.has(resolvedConfig.model) && isSiliconFlow
      ? "Qwen/Qwen3-8B"
      : resolvedConfig.model;

  const fallbackExtractionModels = [primaryExtractionModel];
  if (isSiliconFlow && KNOWN_FREE_MODEL_IDS.has(primaryExtractionModel)) {
    for (const candidate of [
      "Qwen/Qwen3-8B",
      "Qwen/Qwen2.5-7B-Instruct",
      "THUDM/GLM-4-9B-0414",
      "deepseek-ai/DeepSeek-R1-0528-Qwen3-8B",
      "Qwen/Qwen3-VL-8B-Instruct",
    ]) {
      if (!fallbackExtractionModels.includes(candidate)) {
        fallbackExtractionModels.push(candidate);
      }
    }
  }

  let raw = "";
  let lastError = null;
  for (const modelId of fallbackExtractionModels) {
    try {
      raw = await callChatModel(
        { ...resolvedConfig, model: modelId },
        [
          { role: "system", content: CONTRACT_SYSTEM_PROMPT },
          {
            role: "user",
            content:
              "以下是法律服务合同或案件描述文本，请提取案件信息并返回 JSON：\n\n" +
              text,
          },
        ],
        options,
      );
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
      if (!err?.isRateLimit && !err?.isModelUnavailable) throw err;
    }
  }
  if (lastError) throw lastError;
  const parsed = extractJsonFromModelOutput(raw);
  const extracted = normalizeExtractedContract(parsed, text);
  if (isDocObject) {
    contractInput.ocr_model = ocrModelUsed;
    contractInput.text = text;
    contractInput.char_count = text.length;
  }
  return extracted;
}
