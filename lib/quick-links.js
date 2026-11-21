import crypto from "node:crypto";
import { invalid } from "./money.js";

export const ACCENTS = ["blue", "mint", "amber", "rose", "indigo", "slate"];
export const MAX_ITEMS = 200;

export const DEFAULT_QUICK_LINKS = [
  {
    id: "preset-court-online",
    title: "人民法院在线服务",
    url: "https://splcgk.court.gov.cn/",
    category: "诉讼审判",
    desc: "全国法院网上立案、电子送达、材料提交与审判流程公开查询",
    badge: "法",
    accent: "rose",
    updated_at: 1731000001,
  },
  {
    id: "preset-wenshu",
    title: "中国裁判文书网",
    url: "https://wenshu.court.gov.cn/",
    category: "法规案例",
    desc: "全国各级人民法院生效裁判文书全文检索与类案比对",
    badge: "书",
    accent: "blue",
    updated_at: 1731000002,
  },
  {
    id: "preset-rmfyalk",
    title: "人民法院案例库",
    url: "https://rmfyalk.court.gov.cn/",
    category: "法规案例",
    desc: "最高法指导性案例与入库参考案例官方权威检索平台",
    badge: "案",
    accent: "indigo",
    updated_at: 1731000003,
  },
  {
    id: "preset-zxgk",
    title: "中国执行信息公开网",
    url: "https://zxgk.court.gov.cn/",
    category: "主体核查",
    desc: "被执行人、失信被执行人、限制消费人员及终本案件核查",
    badge: "执",
    accent: "rose",
    updated_at: 1731000005,
  },
  {
    id: "preset-gsxt",
    title: "国家企业信用信息公示系统",
    url: "https://www.gsxt.gov.cn/",
    category: "主体核查",
    desc: "工商登记备案、股东出资、行政处罚与经营异常名录核验",
    badge: "企",
    accent: "mint",
    updated_at: 1731000006,
  },
  {
    id: "preset-feishu",
    title: "飞书云文档",
    url: "https://www.feishu.cn/",
    category: "团队办公",
    desc: "日常协同云文档、会议纪要与项目进度表",
    badge: "飞",
    accent: "mint",
    updated_at: 1731000010,
  },
];

export function normalizeQuickLinkUrl(raw) {
  let value = String(raw ?? "").trim();
  if (!value) throw invalid("请填写网站链接地址。");
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:(?!\d+(?:\/|$))/.test(value)) {
    if (!/^https?:\/\//i.test(value)) {
      throw invalid("请填写有效的 http:// 或 https:// 网址。");
    }
  } else {
    value = "https://" + value;
  }
  if (value.length > 1000) throw invalid("网站链接地址过长。");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw invalid("请填写有效的 http:// 或 https:// 网址。");
  }
  const proto = parsed.protocol.toLowerCase();
  const host = (parsed.hostname || "").trim().toLowerCase();
  if (
    (proto !== "http:" && proto !== "https:") ||
    !host ||
    /\s/.test(parsed.host)
  ) {
    throw invalid("请填写有效的 http:// 或 https:// 网址。");
  }
  if (host !== "localhost" && !host.includes(".")) {
    throw invalid("请填写完整的网站域名。");
  }
  if (parsed.username || parsed.password) {
    throw invalid("网址中不能包含账号密码信息。");
  }
  return value;
}

export function extractDomain(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return "";
  }
}

function defaultBadge(title) {
  const cleaned = String(title || "").replace(/[\s·•\-_—()（）【】\[\]]+/g, "");
  return (cleaned.slice(0, 1) || "链").toUpperCase();
}

export function sanitizeQuickLinkItem(raw, existingId = null, nowSec = null) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw invalid("链接数据格式无效。");
  }
  const ts = Number.isFinite(nowSec)
    ? Math.floor(nowSec)
    : Math.floor(Date.now() / 1000);
  const title = String(raw.title ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!title) throw invalid("请填写网站名称。");
  if (title.length > 60) throw invalid("网站名称不能超过 60 个字。");
  const url = normalizeQuickLinkUrl(raw.url);
  const category =
    String(raw.category ?? "")
      .trim()
      .replace(/\s+/g, " ") || "常用网站";
  if (category.length > 24) throw invalid("分类名称不能超过 24 个字。");
  const desc = String(raw.desc ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 140);
  const badge =
    String(raw.badge ?? "")
      .trim()
      .replace(/\s+/g, "")
      .slice(0, 2) || defaultBadge(title);
  let accent = String(raw.accent ?? "blue")
    .trim()
    .toLowerCase();
  if (!ACCENTS.includes(accent)) accent = "blue";
  let id = existingId || String(raw.id ?? "").trim();
  if (!id || !/^[a-zA-Z0-9_-]{3,64}$/.test(id)) {
    id = "lnk-" + crypto.randomBytes(6).toString("hex");
  }
  return { id, title, url, category, desc, badge, accent, updated_at: ts };
}

function dedupeIds(arr, limit = MAX_ITEMS) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  const seen = new Set();
  for (const val of arr) {
    if (typeof val !== "string") continue;
    const s = val.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

export function validateQuickLinksMeta(raw) {
  if (raw === undefined) return;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw invalid("常用网址设置格式无效");
  }
  const allowedKeys = new Set([
    "version",
    "customized",
    "updated_at",
    "items",
    "pinned_ids",
    "order_ids",
  ]);
  for (const key of Object.keys(raw)) {
    if (!allowedKeys.has(key)) throw invalid("常用网址设置包含不支持的字段");
  }
  if (raw.items !== undefined) {
    if (!Array.isArray(raw.items) || raw.items.length > MAX_ITEMS) {
      throw invalid("常用网址列表无效");
    }
    for (const item of raw.items) {
      sanitizeQuickLinkItem(item, item?.id || null, Number(item?.updated_at) || 0);
    }
  }
  if (
    raw.pinned_ids !== undefined &&
    (!Array.isArray(raw.pinned_ids) ||
      raw.pinned_ids.length > MAX_ITEMS ||
      raw.pinned_ids.some((x) => typeof x !== "string"))
  ) {
    throw invalid("常用网址置顶列表无效");
  }
  if (
    raw.order_ids !== undefined &&
    (!Array.isArray(raw.order_ids) ||
      raw.order_ids.length > MAX_ITEMS ||
      raw.order_ids.some((x) => typeof x !== "string"))
  ) {
    throw invalid("常用网址排序列表无效");
  }
}

function loadState(meta) {
  const raw = meta?.quick_links;
  if (!raw || typeof raw !== "object") {
    return {
      customized: false,
      updated_at: 1731000010,
      items: structuredClone(DEFAULT_QUICK_LINKS),
      pinned_ids: [],
      order_ids: [],
    };
  }
  const hasCustomItems = Array.isArray(raw.items);
  const items = hasCustomItems
    ? raw.items
        .filter((x) => x && typeof x === "object" && x.id && x.url)
        .slice(0, MAX_ITEMS)
        .map((x) => ({ ...x }))
    : structuredClone(DEFAULT_QUICK_LINKS);
  return {
    customized: Boolean(raw.customized) && hasCustomItems,
    updated_at: Number(raw.updated_at) || 0,
    items,
    pinned_ids: dedupeIds(raw.pinned_ids, MAX_ITEMS),
    order_ids: dedupeIds(raw.order_ids, MAX_ITEMS),
  };
}

export function getQuickLinksPayload(meta) {
  const st = loadState(meta);
  const byId = new Map();
  const orderedBase = [];
  for (const item of st.items) {
    const entry = {
      ...item,
      domain: extractDomain(item.url || ""),
      editable: true,
    };
    byId.set(entry.id, entry);
    orderedBase.push(entry);
  }

  const validPins = st.pinned_ids.filter((id) => byId.has(id));
  const validOrder = st.order_ids.filter((id) => byId.has(id));
  const pinRank = new Map(validPins.map((id, i) => [id, i]));
  const orderRank = new Map(validOrder.map((id, i) => [id, i]));
  const baseRank = new Map(orderedBase.map((entry, i) => [entry.id, i]));

  const pinnedEntries = [];
  const unpinnedEntries = [];
  for (const entry of orderedBase) {
    const pinned = pinRank.has(entry.id);
    const enriched = { ...entry, pinned };
    if (pinned) pinnedEntries.push(enriched);
    else unpinnedEntries.push(enriched);
  }
  pinnedEntries.sort((a, b) => pinRank.get(a.id) - pinRank.get(b.id));
  if (orderRank.size > 0) {
    const offset = orderRank.size;
    unpinnedEntries.sort((a, b) => {
      const ra = orderRank.has(a.id)
        ? orderRank.get(a.id)
        : offset + baseRank.get(a.id);
      const rb = orderRank.has(b.id)
        ? orderRank.get(b.id)
        : offset + baseRank.get(b.id);
      return ra - rb;
    });
  }

  const categories = [];
  for (const entry of orderedBase) {
    const cat = entry.category || "常用网站";
    if (!categories.includes(cat)) categories.push(cat);
  }

  return {
    items: [...pinnedEntries, ...unpinnedEntries],
    categories,
    pinned_ids: validPins,
    order_ids: validOrder,
    has_custom_order: validOrder.length > 0,
    customized: st.customized,
    updated_at: st.updated_at,
  };
}

export function hasQuickLinkUrl(meta, rawUrl) {
  let normalized;
  try {
    normalized = normalizeQuickLinkUrl(rawUrl);
  } catch {
    return null;
  }
  const st = loadState(meta);
  const found = st.items.some((item) => {
    try {
      return normalizeQuickLinkUrl(item.url) === normalized;
    } catch {
      return false;
    }
  });
  return found ? normalized : null;
}

export function mutateQuickLinks(meta, data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw invalid("请求参数格式错误。");
  }
  const action = String(data.action || "").trim();
  const st = loadState(meta);
  let items = [...st.items];
  let pinnedIds = [...st.pinned_ids];
  let orderIds = [...st.order_ids];
  let customized = st.customized;
  const nowSec = Math.floor(Date.now() / 1000);

  if (action === "toggle_pin") {
    const id = String(data.id || "").trim();
    if (!items.some((x) => x.id === id)) throw invalid("未找到该网站链接。", 404);
    if (pinnedIds.includes(id)) pinnedIds = pinnedIds.filter((x) => x !== id);
    else pinnedIds.unshift(id);
  } else if (action === "reorder_links") {
    if (!Array.isArray(data.order_ids)) throw invalid("缺少有效的排序列表。");
    const knownSeq = items.map((x) => x.id);
    const knownSet = new Set(knownSeq);
    const cleaned = [];
    const seen = new Set();
    for (const raw of data.order_ids) {
      if (typeof raw !== "string") continue;
      const id = raw.trim();
      if (knownSet.has(id) && !seen.has(id)) {
        cleaned.push(id);
        seen.add(id);
      }
    }
    for (const id of [...orderIds, ...knownSeq]) {
      if (knownSet.has(id) && !seen.has(id)) {
        cleaned.push(id);
        seen.add(id);
      }
    }
    if (Array.isArray(data.pinned_ids)) {
      pinnedIds = dedupeIds(
        data.pinned_ids.filter((id) => typeof id === "string" && knownSet.has(id.trim())),
        MAX_ITEMS,
      );
    } else {
      const pinSet = new Set(pinnedIds.filter((id) => knownSet.has(id)));
      pinnedIds = cleaned.filter((id) => pinSet.has(id));
    }
    orderIds = cleaned;
  } else if (action === "reset_order") {
    orderIds = [];
  } else if (action === "save_link") {
    const rawId = String(data.id || "").trim() || null;
    const existingIdx = rawId ? items.findIndex((x) => x.id === rawId) : -1;
    if (existingIdx < 0 && items.length >= MAX_ITEMS) {
      throw invalid("链接数量已达上限（200 条）。");
    }
    const cleaned = sanitizeQuickLinkItem(
      data,
      existingIdx >= 0 ? rawId : null,
      nowSec,
    );
    if (existingIdx >= 0) {
      items[existingIdx] = cleaned;
    } else {
      const existingIds = new Set(items.map((x) => x.id));
      while (existingIds.has(cleaned.id)) {
        cleaned.id = "lnk-" + crypto.randomBytes(6).toString("hex");
      }
      items.push(cleaned);
      if (orderIds.length > 0 && !orderIds.includes(cleaned.id)) {
        orderIds.push(cleaned.id);
      }
    }
    customized = true;
    if ("pinned" in data) {
      const wantPin = Boolean(data.pinned);
      if (wantPin && !pinnedIds.includes(cleaned.id)) pinnedIds.unshift(cleaned.id);
      else if (!wantPin) pinnedIds = pinnedIds.filter((x) => x !== cleaned.id);
    }
  } else if (action === "delete_link") {
    const id = String(data.id || "").trim();
    if (!id) throw invalid("缺少要删除的链接编号。");
    if (!items.some((x) => x.id === id)) throw invalid("未找到要删除的链接。", 404);
    items = items.filter((x) => x.id !== id);
    pinnedIds = pinnedIds.filter((x) => x !== id);
    orderIds = orderIds.filter((x) => x !== id);
    customized = true;
  } else if (action === "reset_defaults") {
    items = structuredClone(DEFAULT_QUICK_LINKS);
    pinnedIds = pinnedIds.filter((id) => items.some((x) => x.id === id));
    orderIds = orderIds.filter((id) => items.some((x) => x.id === id));
    customized = false;
  } else {
    throw invalid("不支持的常用链接操作。");
  }

  const nextValue = {
    version: 1,
    customized,
    updated_at: nowSec,
    items: items.slice(0, MAX_ITEMS),
    pinned_ids: dedupeIds(pinnedIds, MAX_ITEMS),
    order_ids: dedupeIds(orderIds, MAX_ITEMS),
  };
  return {
    value: nextValue,
    payload: getQuickLinksPayload({ quick_links: nextValue }),
  };
}
