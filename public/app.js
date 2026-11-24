"use strict";
const $ = (s) => document.querySelector(s);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (value) =>
  value == null
    ? "—"
    : "¥" +
      Number(value).toLocaleString("zh-CN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
const today = () => new Date().toLocaleDateString("sv-SE");
const time = (value) =>
  value
    ? new Date(value).toLocaleString("zh-CN", { hour12: false })
    : "无法读取";
const shortDate = (value) => (value ? String(value).slice(0, 10) : "—");
const progressDate = (value) =>
  value && !Number.isNaN(new Date(value).valueOf())
    ? new Date(value).toLocaleDateString("zh-CN")
    : "日期不详";
const sortedProgress = (c) =>
  (c.progress || [])
    .slice()
    .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
const latestProgress = (c) => sortedProgress(c)[0] || null;
const names = (value) => [
  ...new Set(
    String(value || "")
      .split(/[,，、;；\n]/)
      .map((v) => v.trim())
      .filter(Boolean),
  ),
];
let data = null,
  view = "dash",
  templates = null,
  combinedTemplate = null,
  backupInfo = null,
  importTrack = "litigation";
let filter = { track: "", q: "", field: "all", status: "在办", finance: "" };
const titles = {
  dash: "工作台",
  cases: "案件台账",
  settings: "设置与备份",
};
const reasonLabels = {
  startup: "启动时备份",
  auto: "自动备份",
  "before-import": "导入前备份",
  "before-delete": "删除前备份",
  "before-restore": "恢复前备份",
  manual: "手动备份",
  unreadable: "文件无法读取",
};
function notice(text) {
  $("#notice").textContent = text;
  $("#notice").hidden = false;
  clearTimeout(notice.timer);
  notice.timer = setTimeout(() => ($("#notice").hidden = true), 5000);
}
async function api(path, method = "GET", body) {
  const r = await fetch("/api/" + path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let value;
  try {
    value = await r.json();
  } catch {
    throw Error("本地服务未能返回数据，请重新打开衡账");
  }
  if (!r.ok) throw Error(value.error || "操作未完成，请重试");
  return value;
}
function openModal(title, html) {
  $("#modal-title").textContent = title;
  $("#modal-body").innerHTML = html;
  if (!$("#modal").open) $("#modal").showModal();
}
function closeModal() {
  $("#modal").close();
  $("#modal-body").replaceChildren();
}
$("#close-modal").onclick = closeModal;
function form(title, html, onSave, button = "保存") {
  openModal(
    title,
    '<form id="edit-form"><p class="form-error" role="alert" hidden></p>' +
      html +
      '<div class="form-actions"><button type="button" data-action="close-modal">取消</button><button type="submit" class="primary">' +
      esc(button) +
      "</button></div></form>",
  );
  const el = $("#edit-form");
  el.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submit = el.querySelector("[type=submit]"),
      feedback = el.querySelector(".form-error");
    submit.disabled = true;
    feedback.hidden = true;
    try {
      await onSave(el);
    } catch (error) {
      feedback.textContent = error.message;
      feedback.hidden = false;
      feedback.scrollIntoView({ block: "nearest" });
    } finally {
      submit.disabled = false;
    }
  });
  return el;
}
function values(el) {
  return Object.fromEntries(new FormData(el));
}
function findCase(id) {
  const c = data.cases.find((x) => x.id === id);
  if (!c) throw Error("案件不存在，请刷新台账");
  return c;
}
function labelCase(c) {
  return c.client || c.name || c.case_no || "未命名案件";
}
function badge(text, tone = "") {
  return '<span class="badge ' + tone + '">' + esc(text) + "</span>";
}
function caseButton(c, text) {
  return (
    '<button class="case-open" data-action="detail" data-id="' +
    esc(c.id) +
    '">' +
    esc(text || labelCase(c)) +
    "</button>"
  );
}
function input(key, label, value = "", type = "text", extra = "") {
  return (
    "<label " +
    (extra || "") +
    ">" +
    label +
    '<input name="' +
    key +
    '" type="' +
    type +
    '" value="' +
    esc(value ?? "") +
    '"' +
    (type === "number" ? ' min="0" max="10000000000" step="0.01"' : "") +
    "></label>"
  );
}
function textArea(key, label, value = "", extra = "") {
  return (
    "<label " +
    (extra || "") +
    ">" +
    label +
    '<textarea name="' +
    key +
    '" rows="3">' +
    esc(value) +
    "</textarea></label>"
  );
}
function options(values, current, placeholder = "") {
  return (
    (placeholder ? '<option value="">' + esc(placeholder) + "</option>" : "") +
    values
      .map(
        (v) =>
          '<option value="' +
          esc(v) +
          '"' +
          (v === current ? " selected" : "") +
          ">" +
          esc(v) +
          "</option>",
      )
      .join("")
  );
}
function select(key, label, list, current) {
  return (
    "<label>" +
    label +
    '<select name="' +
    key +
    '">' +
    options(list, current) +
    "</select></label>"
  );
}
function summaryHtml(summary) {
  return (
    '<div class="summary-grid">' +
    [
      ["签约律师费", summary.signed, ""],
      ["累计已收款", summary.received, "good"],
      ["未付金额", summary.unpaid, "warn"],
      ["开票未付金额", summary.invoiced_unpaid, ""],
    ]
      .map(
        ([label, value, tone]) =>
          '<div class="summary-item ' +
          tone +
          '"><span>' +
          label +
          "</span><strong>" +
          money(value) +
          "</strong></div>",
      )
      .join("") +
    "</div>"
  );
}
function periodEnd(c) {
  const m = (c.service_period || "").match(
    /^\d{4}-\d{2}-\d{2}\s*至\s*(\d{4}-\d{2}-\d{2})$/,
  );
  return m ? m[1] : "";
}
function daysUntil(date) {
  return Math.round(
    (new Date(date + "T00:00:00") - new Date(today() + "T00:00:00")) / 86400000,
  );
}
function expiryCases() {
  return data.cases
    .filter(
      (c) =>
        c.track === "advisory" &&
        c.status === "在办" &&
        periodEnd(c) &&
        daysUntil(periodEnd(c)) <= 30,
    )
    .sort((a, b) => periodEnd(a).localeCompare(periodEnd(b)));
}
let mottoFlight = null;
async function refreshDailyMotto() {
  if (!data || document.visibilityState === "hidden" ||
      data.preferences.motto_date === today()) return;
  if (mottoFlight) return mottoFlight;
  const previous = data.preferences;
  mottoFlight = (async () => {
    try {
      const result = await api("preferences");
      // A save, restore or full refresh may have supplied newer preferences.
      if (data.preferences !== previous) return;
      data.preferences = result.preferences;
      if (view === "dash") {
        const heading = $(".welcome-strip h1"), date = $(".welcome-strip .eyebrow");
        if (heading && date) {
          heading.textContent = data.preferences.dashboard_motto;
          date.textContent = today().replaceAll("-", " / ");
        }
      }
    } catch {
      // Keep the current text and retry locally; never interrupt an open form.
    } finally {
      mottoFlight = null;
    }
  })();
  return mottoFlight;
}
async function refresh() {
  data = await api("workspace");
  $("#data-updated").textContent =
    "已保存至本机 · " +
    new Date(data.updated_at).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  if (view === "settings") backupInfo = await api("backups");
  render();
}
async function navigate(next) {
  view = next;
  document
    .querySelectorAll("[data-nav]")
    .forEach((el) =>
      el.classList.toggle("nav-active", el.dataset.nav === view),
    );
  $("#crumb").textContent = titles[view];
  if (view === "settings") backupInfo = await api("backups");
  await refreshDailyMotto();
  render();
}
function render() {
  if (!data) return;
  ({
    dash: renderDash,
    cases: renderCases,
    settings: renderSettings,
  })[view]();
}
function renderDash() {
  const payable = data.cases.filter((c) => c.payable.current),
    expiring = expiryCases(),
    invoicedUnpaid = data.cases
      .filter((c) => c.fee_summary.invoiced_unpaid > 0)
      .sort(
        (a, b) =>
          String(b.updated_at || "").localeCompare(String(a.updated_at || "")) ||
          a.id.localeCompare(b.id),
      ),
    recent = [...data.cases]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 6);
  const content =
    '<div class="page-heading"><div class="welcome-strip"><div class="eyebrow">' +
    today().replaceAll("-", " / ") +
    "</div><h1>" +
    esc(data.preferences.dashboard_motto) +
    "</h1><p>在办 " +
    data.summary.active +
    " 件 · 共 " +
    data.summary.count +
    ' 件案件</p></div><div class="page-actions"><button data-action="import">导入台账</button><button class="primary" data-action="new">＋ 新建案件</button></div></div>' +
    summaryHtml(data.summary) +
    (!data.cases.length
      ? '<div class="panel empty"><strong>从第一件案件开始</strong><p>新建诉讼、顾问或专项案件，记录约定费用和每次到账。<br>也可以下载模板，把现有 Excel 台账导入进来。</p><button data-action="import">导入 Excel 台账</button> <button class="primary" data-action="new">新建案件</button></div>'
      : "") +
    '<div class="two-columns"><section class="panel"><div class="panel-head"><h2>待开票</h2>' +
    badge(payable.length + " 件", payable.length ? "warn" : "") +
    "</div>" +
    (payable.length
      ? payable
          .slice(0, 8)
          .map(
            (c) =>
              '<div class="entry-row"><div><strong>' +
              caseButton(c) +
              "</strong><small>" +
              esc(c.case_no || data.tracks[c.track]) +
              " · " +
              esc(c.payable.current.note || "待开票") +
              '</small></div><button class="text-button due" data-action="payable" data-id="' +
              c.id +
              '">' +
              (c.payable.current.amount == null
                ? "查看提醒"
                : money(c.payable.current.amount)) +
              "</button></div>",
          )
          .join("")
      : '<div class="empty compact"><strong>暂无待开票提醒</strong><p>客户达到付款节点时，可在案件中标记待开票。</p></div>') +
    "</section>" +
    '<section class="panel"><div class="panel-head"><h2>顾问到期提示</h2>' +
    badge(expiring.length + " 件", expiring.length ? "warn" : "") +
    "</div>" +
    (expiring.length
      ? expiring
          .slice(0, 8)
          .map((c) => {
            const days = daysUntil(periodEnd(c));
            return (
              '<div class="entry-row"><div><strong>' +
              caseButton(c) +
              "</strong><small>" +
              esc(periodEnd(c)) +
              " 到期 · " +
              (days < 0
                ? "已到期 " + -days + " 天"
                : days === 0
                  ? "今天到期"
                  : days + " 天后到期") +
              '</small></div><button class="text-button" data-action="renew" data-id="' +
              c.id +
              '">续签</button></div>'
            );
          })
          .join("")
      : '<div class="empty compact"><strong>近期没有顾问到期</strong><p>根据顾问服务期限，展示已到期和 30 天内到期的在办案件。</p></div>') +
    "</section></div>" +
    '<section class="panel dashboard-invoiced-unpaid"><div class="panel-head"><h2>开票待支付</h2>' +
    badge(invoicedUnpaid.length + " 件", invoicedUnpaid.length ? "warn" : "") +
    "</div>" +
    (invoicedUnpaid.length
      ? invoicedUnpaid
          .slice(0, 3)
          .map(
            (c) =>
              '<div class="entry-row"><div><strong>' +
              caseButton(c) +
              "</strong><small>" +
              esc(c.case_no || data.tracks[c.track]) +
              " · 最近更新 " +
              esc(time(c.updated_at)) +
              '</small></div><strong class="num due">' +
              money(c.fee_summary.invoiced_unpaid) +
              "</strong></div>",
          )
          .join("") +
        (invoicedUnpaid.length > 3
          ? '<button class="text-button" data-action="filter-invoiced-unpaid">查看全部开票待支付案件 →</button>'
          : "")
      : '<div class="empty compact"><strong>暂无开票待支付</strong><p>有已开票未收款金额的案件会显示在这里。</p></div>') +
    "</section>" +
    statsPanels() +
    (recent.length
      ? '<section class="panel"><div class="panel-head"><h2>最近更新</h2><button class="text-button" data-nav="cases">全部案件 →</button></div>' +
        recent
          .map(
            (c) =>
              '<div class="entry-row"><div><strong>' +
              caseButton(c) +
              "</strong><small>" +
              esc(c.case_no || "案号待补充") +
              " · " +
              esc(data.tracks[c.track]) +
              " · " +
              esc(c.status) +
              '</small></div><span class="small muted">' +
              time(c.updated_at) +
              "</span></div>",
          )
          .join("") +
        "</section>"
      : "");
  $("#content").innerHTML = content;
}
function filteredCases() {
  const q = filter.q.toLowerCase().trim();
  return data.cases.filter((c) => {
    if (
      (filter.track && c.track !== filter.track) ||
      (filter.status && c.status !== filter.status)
    )
      return false;
    if (
      (filter.finance === "unpaid" && !(c.fee_summary.unpaid > 0)) ||
      (filter.finance === "invoiced_unpaid" &&
        !(c.fee_summary.invoiced_unpaid > 0)) ||
      (filter.finance === "payable" && !c.payable.current)
    )
      return false;
    if (!q) return true;
    const keys =
      filter.field === "all"
        ? [
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
            "co_lawyers",
            "case_stage",
            "fee_note",
            "notes",
          ]
        : [filter.field];
    return keys.some((k) =>
      String(c[k] || "")
        .toLowerCase()
        .includes(q),
    );
  });
}
function renderCases() {
  $("#content").innerHTML =
    '<div class="page-heading"><div><h1>案件台账</h1><p>客户、案件进展与律师费，放在一起查看。</p></div><div class="page-actions"><button data-action="import">导入台账</button><button data-action="export">导出当前筛选</button><button data-action="fee-allocation">分配律师费</button><button data-action="fee-history">分配记录</button><button class="primary" data-action="new">＋ 新建案件</button></div></div>' +
    '<div class="tabs">' +
    [["", "全部"], ...Object.entries(data.tracks)]
      .map(
        ([key, label]) =>
          '<button data-track="' +
          key +
          '" class="' +
          (filter.track === key ? "selected" : "") +
          '">' +
          label +
          "<small>" +
          data.cases.filter((c) => !key || c.track === key).length +
          "</small></button>",
      )
      .join("") +
    "</div>" +
    '<div class="filters"><label>查找字段<select id="filter-field">' +
    Object.entries({
      all: "全部字段",
      case_no: "内部案号",
      client: "客户",
      name: "项目名称",
      case_type: "案由",
      lawyer: "承办律师",
      co_lawyers: "协办律师",
      fee_note: "费用说明",
      notes: "备注",
    })
      .map(
        ([key, label]) =>
          '<option value="' +
          key +
          '"' +
          (filter.field === key ? " selected" : "") +
          ">" +
          label +
          "</option>",
      )
      .join("") +
    '</select></label><label class="keyword">关键词<input id="filter-q" value="' +
    esc(filter.q) +
    '" placeholder="搜索客户、案号、案由…"></label><label>案件状态<select id="filter-status">' +
    options(["在办", "已结", "中止"], filter.status, "全部状态") +
    '</select></label><label>费用状态<select id="filter-finance">' +
    Object.entries({
      "": "全部费用状态",
      unpaid: "存在未付",
      invoiced_unpaid: "开票未付金额",
      payable: "待开票",
    })
      .map(
        ([key, label]) =>
          '<option value="' +
          key +
          '"' +
          (filter.finance === key ? " selected" : "") +
          ">" +
          label +
          "</option>",
      )
      .join("") +
    '</select></label><button data-action="reset-filter">重置</button></div><div class="result-bar"><span id="result-count"></span><span>金额单位：元</span></div><div id="case-table"></div>';
  for (const key of ["field", "status", "finance"])
    $("#filter-" + key).onchange = (e) => {
      filter[key] = e.target.value;
      renderCaseTable();
    };
  $("#filter-q").oninput = (e) => {
    filter.q = e.target.value;
    renderCaseTable();
  };
  renderCaseTable();
}
function renderCaseTable() {
  const list = filteredCases();
  $("#result-count").textContent =
    "显示 " + list.length + " 件 / 共 " + data.cases.length + " 件";
  $("#case-table").innerHTML = list.length
    ? '<div class="table-wrap" tabindex="0" role="region" aria-label="案件台账"><table class="ledger"><thead><tr><th>内部案号</th><th>客户</th><th>案件 / 项目</th><th>签约律师费</th><th>开票金额</th><th>已收款</th><th>未付金额</th><th>开票未付金额</th><th>操作</th></tr></thead><tbody>' +
      list
        .map((c) => {
          const f = c.fee_summary,
            caseText =
              c.track === "litigation"
                ? c.case_type || "案由待补充"
                : c.track === "advisory"
                  ? periodEnd(c)
                    ? periodEnd(c) + " 到期"
                    : "服务期限待补充"
                  : c.name || "项目名称待补充";
          const parties =
            c.track === "litigation"
              ? [
                  c.plaintiff && "原告：" + c.plaintiff,
                  c.defendant && "被告：" + c.defendant,
                  c.third_party && "第三人：" + c.third_party,
                ]
                  .filter(Boolean)
                  .join("；")
              : c.opponent
                ? "对方：" + c.opponent
                : "";
          return (
            '<tr data-case="' +
            c.id +
            '"><td class="case-number mono">' +
            caseButton(c, c.case_no || "待补案号") +
            '<span class="sub">' +
            esc(data.tracks[c.track]) +
            '</span></td><td class="client-cell"><strong>' +
            caseButton(c, c.client || "客户待补充") +
            "</strong>" +
            (c.lawyer
              ? '<span class="sub">承办：' + esc(c.lawyer) + "</span>"
              : "") +
            (c.co_lawyers.length
              ? '<span class="sub">协办：' +
                esc(c.co_lawyers.join("、")) +
                "</span>"
              : "") +
            (c.client_contact
              ? '<span class="sub">联系人：' + esc(c.client_contact) + "</span>"
              : "") +
            (c.payable.current
              ? '<button class="text-button due" data-action="payable" data-id="' +
                c.id +
                '">待开票' +
                (c.payable.current.amount == null
                  ? ""
                  : " · " + money(c.payable.current.amount)) +
                "</button>"
              : "") +
            '</td><td class="matter-cell"><span>' +
            caseButton(c, caseText) +
            "</span>" +
            (parties ? '<span class="sub">' + esc(parties) + "</span>" : "") +
            (() => {
              const latest = latestProgress(c);
              return latest
                ? '<span class="sub ledger-latest-progress" title="' +
                    esc(latest.text) +
                    '">最新进展：' +
                    esc(progressDate(latest.at)) +
                    " · " +
                    esc(latest.text) +
                    "</span>"
                : "";
            })() +
            '<span class="sub"><select class="inline-select" data-status="' +
            c.id +
            '" aria-label="案件状态">' +
            options(["在办", "已结", "中止"], c.status) +
            "</select>" +
            (c.track === "litigation"
              ? ' <select class="inline-select" data-stage="' +
                c.id +
                '" aria-label="案件阶段">' +
                options(data.stages, c.case_stage, "阶段待填") +
                "</select>"
              : "") +
            '</span></td><td class="amount-cell num"><span title="' +
            esc(c.fee_note || "未登记费用说明") +
            '">' +
            money(f.signed) +
            "</span>" +
            (c.fee_note
              ? '<button class="text-button" data-action="fee-note" data-id="' +
                c.id +
                '" aria-label="查看费用说明">ⓘ</button>'
              : "") +
            '</td><td class="amount-cell num">' +
            money(c.invoice_amount) +
            '</td><td class="amount-cell num">' +
            money(f.received) +
            '</td><td class="amount-cell num ' +
            (f.unpaid > 0 ? "due" : "") +
            '">' +
            money(f.unpaid) +
            '</td><td class="amount-cell num">' +
            money(f.invoiced_unpaid) +
            '</td><td class="action-cell"><div class="table-actions"><button class="text-button" data-action="edit" data-id="' +
            c.id +
            '">编辑</button><button class="text-button" data-action="collection" data-id="' +
            c.id +
            '">到账</button><button class="text-button" data-action="payable" data-id="' +
            c.id +
            '">应付</button><button class="text-button" data-action="progress" data-id="' +
            c.id +
            '">进展</button>' +
            (c.track === "advisory"
              ? '<button class="text-button" data-action="renew" data-id="' +
                c.id +
                '">续签</button>'
              : "") +
            "</div></td></tr>"
          );
        })
        .join("") +
      "</tbody></table></div>"
    : '<div class="panel empty"><strong>没有符合条件的案件</strong><p>调整筛选条件，或新建、导入案件。</p><button data-action="reset-filter">重置筛选</button> <button class="primary" data-action="new">新建案件</button></div>';
}
function statsPanels() {
  const rows = Object.entries(data.tracks).map(([track, label]) => {
    const list = data.cases.filter((c) => c.track === track);
    return { label, list };
  });
  const sum = (list, key) =>
    list.reduce(
      (n, c) => n + Math.round(Number(c.fee_summary[key] || 0) * 100),
      0,
    ) / 100;
  const groups = new Map();
  for (const c of data.cases) {
    const label = c.client || "客户待补充";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(c);
  }
  const clients = [...groups]
      .sort((a, b) => sum(b[1], "unpaid") - sum(a[1], "unpaid"))
      .slice(0, 10),
    max = Math.max(1, ...clients.map(([, cs]) => sum(cs, "unpaid")));
  return (
    '<section class="dashboard-stats" aria-label="费用统计"><div class="panel"><div class="panel-head"><div><h2>费用统计</h2><p class="hint">按全部案件汇总；未登记的金额不计入合计。</p></div><button data-action="export-all">导出全部台账</button></div><h3>按业务类型</h3><div class="table-wrap"><table><thead><tr><th>类型</th><th>案件数</th><th>签约律师费</th><th>已开票</th><th>已收款</th><th>未付金额</th><th>开票未付金额</th></tr></thead><tbody>' +
    rows
      .map(
        ({ label, list }) =>
          "<tr><td>" +
          label +
          "</td><td>" +
          list.length +
          "</td>" +
          ["signed", "invoice", "received", "unpaid", "invoiced_unpaid"]
            .map((k) => '<td class="num">' + money(sum(list, k)) + "</td>")
            .join("") +
          "</tr>",
      )
      .join("") +
    '</tbody></table></div></div><section class="panel"><h2>客户未付金额</h2><p class="hint">按金额列出前 10 个客户；多个主体共同委托的案件作为一个客户组合统计。</p>' +
    (clients.length
      ? clients
          .map(
            ([label, list]) =>
              '<div class="bar-row"><span>' +
              esc(label) +
              '</span><div class="bar-track"><progress max="' +
              max +
              '" value="' +
              sum(list, "unpaid") +
              '" aria-label="' +
              esc(label) +
              '未付金额"></progress></div><span class="num">' +
              money(sum(list, "unpaid")) +
              "</span></div>",
          )
          .join("")
      : '<p class="muted small">录入案件后在此查看。</p>') +
    "</section>" +
    lawyerFeeStatsHtml() +
    '<p class="print-note">签约律师费按台账登记金额汇总；费用说明中的计算条件不会自动折算为应收金额。</p></section>'
  );
}
function knownLawyers() {
  const set = new Set();
  for (const c of data?.cases || []) {
    if (c.lawyer) set.add(c.lawyer);
    for (const co of c.co_lawyers || []) if (co) set.add(co);
  }
  const fa = data?.fee_allocations || {};
  for (const list of [
    fa.by_lawyer,
    fa.outbound_by_lawyer,
    fa.inbound_by_source,
  ]) {
    for (const row of list || []) if (row.lawyer) set.add(row.lawyer);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "zh-CN"));
}
function faEffectiveDir(row) {
  return row?.direction === "inbound" ? "inbound" : "outbound";
}
function lawyerFeeStatsHtml() {
  const summary = data?.fee_allocations || {
    total: 0,
    by_lawyer: [],
    outbound_total: 0,
    outbound_count: 0,
    outbound_cases: 0,
    outbound_by_lawyer: [],
    inbound_total: 0,
    inbound_count: 0,
    inbound_cases: 0,
    inbound_by_source: [],
    net_total: 0,
  };
  const groups = new Map();
  const get = (name) => {
    if (!groups.has(name))
      groups.set(name, {
        n: 0,
        signed: 0,
        received: 0,
        unpaid: 0,
        invUnpaid: 0,
        outAmt: 0,
        inAmt: 0,
      });
    return groups.get(name);
  };
  for (const c of data?.cases || []) {
    const row = get(c.lawyer || "（未分配）"),
      fs = c.fee_summary || {};
    row.n++;
    row.signed = Math.round((row.signed + Number(fs.signed || 0)) * 100) / 100;
    row.received =
      Math.round((row.received + Number(fs.received || 0)) * 100) / 100;
    row.unpaid = Math.round((row.unpaid + Number(fs.unpaid || 0)) * 100) / 100;
    row.invUnpaid =
      Math.round((row.invUnpaid + Number(fs.invoiced_unpaid || 0)) * 100) / 100;
  }
  for (const row of summary.outbound_by_lawyer || summary.by_lawyer || []) {
    get(row.lawyer).outAmt = Number(row.allocated || 0);
  }
  for (const row of summary.inbound_by_source || []) {
    get(row.lawyer).inAmt = Number(row.allocated || 0);
  }
  const rows = [...groups].sort(
    (a, b) =>
      b[1].signed - a[1].signed ||
      b[1].outAmt + b[1].inAmt - (a[1].outAmt + a[1].inAmt) ||
      a[0].localeCompare(b[0], "zh-CN"),
  );
  const total = (key) =>
    Math.round(rows.reduce((sum, [, row]) => sum + row[key], 0) * 100) / 100;
  const outTot = Number(summary.outbound_total ?? total("outAmt"));
  const inTot = Number(summary.inbound_total ?? total("inAmt"));
  const netTot = Number(
    summary.net_total ?? Math.round((inTot - outTot) * 100) / 100,
  );
  const netStr = (netTot > 0 ? "+" : "") + money(netTot);
  const dirStrip =
    '<div class="fa-dir-strip">' +
    '<button type="button" class="fa-dir-card is-out" data-action="fee-history" data-dir="outbound"><span>↗ 我分出的律师费（分给他人）</span><strong>' +
    money(outTot) +
    "</strong><small>" +
    (summary.outbound_cases || 0) +
    " 个案件 · " +
    (summary.outbound_count || 0) +
    " 笔（点击查看明细）</small></button>" +
    '<button type="button" class="fa-dir-card is-in" data-action="fee-history" data-dir="inbound"><span>↙ 他人分给我的律师费（分入）</span><strong>' +
    money(inTot) +
    "</strong><small>" +
    (summary.inbound_cases || 0) +
    " 个案件 · " +
    (summary.inbound_count || 0) +
    " 笔（点击查看明细）</small></button>" +
    '<button type="button" class="fa-dir-card" data-action="fee-history" data-dir=""><span>⇄ 分配净额（分入 − 分出）</span><strong>' +
    netStr +
    "</strong><small>" +
    (netTot >= 0 ? "净分入大于或等于分出" : "净分出大于分入") +
    "</small></button></div>";
  return (
    '<section class="panel" id="lawyer-fee-stats"><div class="panel-head"><div><h2>承办律师费用统计</h2><p class="hint">案件费用按承办归属；律师费分配按方向分别统计“分出（分给他人）”与“分入（他人分给我）”，不改变案件已收金额。</p></div><div class="page-actions"><button data-action="fee-allocation" data-dir="outbound">分配律师费</button><button data-action="fee-history">分配记录</button></div></div>' +
    dirStrip +
    (rows.length
      ? '<div class="table-wrap"><table><thead><tr><th>律师</th><th>承办案件数</th><th>签约律师费</th><th>已收律师费</th><th>未付金额</th><th>开票未付金额</th><th>↗ 分出（分给TA）</th><th>↙ 分入（TA分给我）</th></tr></thead><tbody>' +
        rows
          .map(
            ([name, row]) =>
              "<tr><td>" +
              (row.n && name !== "（未分配）"
                ? '<button class="case-open" data-action="filter-lawyer" data-lawyer="' +
                  esc(name) +
                  '"><strong>' +
                  esc(name) +
                  "</strong></button>"
                : "<strong>" + esc(name) + "</strong>") +
              '</td><td class="num">' +
              row.n +
              '</td><td class="num">' +
              money(row.signed) +
              '</td><td class="num">' +
              money(row.received) +
              '</td><td class="num">' +
              money(row.unpaid) +
              '</td><td class="num">' +
              money(row.invUnpaid) +
              '</td><td class="num">' +
              (row.outAmt
                ? '<button class="text-button" data-action="fee-history" data-lawyer="' +
                  esc(name) +
                  '" data-dir="outbound">' +
                  money(row.outAmt) +
                  "</button>"
                : money(0)) +
              '</td><td class="num">' +
              (row.inAmt
                ? '<button class="text-button" data-action="fee-history" data-lawyer="' +
                  esc(name) +
                  '" data-dir="inbound">' +
                  money(row.inAmt) +
                  "</button>"
                : money(0)) +
              "</td></tr>",
          )
          .join("") +
        '<tr><td><strong>合计</strong></td><td class="num"><strong>' +
        rows.reduce((sum, [, r]) => sum + r.n, 0) +
        "</strong></td>" +
        ["signed", "received", "unpaid", "invUnpaid", "outAmt", "inAmt"]
          .map(
            (key) =>
              '<td class="num"><strong>' + money(total(key)) + "</strong></td>",
          )
          .join("") +
        "</tr></tbody></table></div>"
      : '<p class="muted small">录入案件或分配律师费后在此查看按律师汇总统计。</p>') +
    "</section>"
  );
}
async function openFeeAllocation(preselectId = "", defaultDirection = "outbound") {
  const allocData = await api("fee-allocations");
  const lawyers = knownLawyers();
  const initDir = defaultDirection === "inbound" ? "inbound" : "outbound";
  openModal(
    "分配律师费",
    '<p class="hint">先选择分配方向（我分给别人 vs 别人分给我），再勾选一个或多个案件。基数默认采用各案最近一笔到账金额，也可在首次分配前手填；同一基数可分多次，累计不超过基数。</p>' +
      '<form id="fa-form">' +
      '<div class="fa-dir-radios">' +
      '<label class="fa-dir-radio"><input type="radio" name="fa_direction" value="outbound"' +
      (initDir === "outbound" ? " checked" : "") +
      '><span><strong>↗ 分出 · 我分配给别人</strong><br><small class="muted">我方案件分给团队或外部合作律师</small></span></label>' +
      '<label class="fa-dir-radio"><input type="radio" name="fa_direction" value="inbound"' +
      (initDir === "inbound" ? " checked" : "") +
      '><span><strong>↙ 分入 · 别人分配给我</strong><br><small class="muted">他人案件记入我方台账，对方律师分费用给我</small></span></label>' +
      "</div>" +
      '<label>搜索并选择案件<input id="fa-search" placeholder="搜索案件名称、客户或案号…"></label><div class="page-actions fa-actions-row"><button type="button" id="fa-select-all">选中搜索结果</button><button type="button" id="fa-clear">清空选择</button><span id="fa-count" class="muted small">已选 0 个案件</span></div>' +
      '<div class="fa-check-list" id="fa-case-options">' +
      (allocData.cases.length
        ? allocData.cases
            .map(
              (c) =>
                '<label class="fa-confirm-check" data-fa-option="' +
                esc(c.id) +
                '"><input type="checkbox" value="' +
                esc(c.id) +
                '"><span><strong>' +
                esc(c.name) +
                '</strong> <span class="muted small">' +
                esc(c.code ? c.code + " · " : "") +
                (c.latest_receipt
                  ? "最近到账 " +
                    money(c.latest_receipt.amount) +
                    "（" +
                    esc(c.latest_receipt.date) +
                    "）"
                  : "无到账流水，可手填基数") +
                "</span></span></label>",
            )
            .join("")
        : '<p class="muted small fa-empty-note">暂无可分配案件，请先新建案件。</p>') +
      '</div><div id="fa-case-bases" class="fa-mt-14"></div>' +
      '<datalist id="fa-lawyers">' +
      lawyers.map((name) => '<option value="' + esc(name) + '">').join("") +
      "</datalist>" +
      '<div id="fa-outbound-box"><div class="form-section"><h3>分配给哪位律师（接收方）</h3></div><div id="fa-recipients"></div><div class="fa-mb-14"><button type="button" id="fa-add-recipient">＋ 添加接收律师</button></div></div>' +
      '<div id="fa-inbound-box" hidden><div class="form-section"><h3>来源律师（谁分给我）与分入金额</h3></div><div class="fa-inbound-grid"><label>来源律师姓名<input name="fa_from_lawyer" list="fa-lawyers" maxlength="40" placeholder="填写分给我的对方律师"></label><label>方式<select name="fa_in_kind"><option value="rate">比例（%）</option><option value="amount">金额（元／案）</option></select></label><label>比例／金额<input name="fa_in_value" type="number" min="0.01" step="0.01" max="100"></label></div></div>' +
      '<label class="fa-mt-14">备注<input name="note" placeholder="选填，如：2026年第一笔顾问费提成"></label><div id="fa-preview"></div><p class="form-error" role="alert" hidden></p><div class="form-actions"><button type="button" data-action="close-modal">取消</button><button class="primary" type="submit">预览分配</button></div></form>',
  );
  const formEl = $("#fa-form"),
    selected = new Map(),
    recipients = $("#fa-recipients"),
    outBox = $("#fa-outbound-box"),
    inBox = $("#fa-inbound-box"),
    basesEl = $("#fa-case-bases"),
    previewEl = $("#fa-preview"),
    errorEl = formEl.querySelector(".form-error"),
    submitBtn = formEl.querySelector("button[type=submit]");
  let previewKey = null;
  const requestId = crypto.randomUUID();
  const getDir = () =>
    formEl.querySelector('input[name="fa_direction"]:checked')?.value ||
    "outbound";
  const invalidate = () => {
    previewKey = null;
    previewEl.innerHTML = "";
    submitBtn.textContent = "预览分配";
  };
  const syncDirUi = () => {
    const isOut = getDir() === "outbound";
    outBox.hidden = !isOut;
    inBox.hidden = isOut;
    outBox.querySelectorAll("input,select").forEach((el) => {
      el.disabled = !isOut;
    });
    inBox.querySelectorAll("input,select").forEach((el) => {
      el.disabled = isOut;
      if (!isOut && el.name !== "fa_in_kind") el.required = true;
      else el.required = false;
    });
    invalidate();
  };
  formEl.elements.fa_in_kind.onchange = () => {
    const inp = formEl.elements.fa_in_value;
    if (formEl.elements.fa_in_kind.value === "rate") inp.max = "100";
    else inp.removeAttribute("max");
    invalidate();
  };
  const renderBases = () => {
    $("#fa-count").textContent = "已选 " + selected.size + " 个案件";
    basesEl.innerHTML = selected.size
      ? '<div class="table-wrap fa-scroll-md"><table><thead><tr><th>案件名称</th><th>到账／分配基数</th><th>基数金额（元）</th><th>已分配</th><th>剩余可分</th></tr></thead><tbody>' +
        [...selected]
          .map(([id, item]) => {
            const c = allocData.cases.find((x) => x.id === id),
              basis = c.bases.find((b) => b.id === item.basis_id);
            return (
              "<tr><td><strong>" +
              esc(c.name) +
              '</strong><span class="sub">' +
              esc(c.code) +
              '</span></td><td><select data-fa-basis="' +
              esc(id) +
              '">' +
              c.bases
                .map(
                  (b) =>
                    '<option value="' +
                    esc(b.id) +
                    '"' +
                    (item.basis_id === b.id ? " selected" : "") +
                    ">" +
                    esc(
                      b.receipt_id
                        ? [
                            b.period,
                            b.date,
                            "到账 " + money(b.source_amount),
                          ]
                            .filter(Boolean)
                            .join(" ")
                        : "手填基数",
                    ) +
                    "</option>",
                )
                .join("") +
              '</select></td><td><input class="fa-base-input" data-fa-base="' +
              esc(id) +
              '" type="number" min="0.01" step="0.01" required value="' +
              esc(item.base_amount ?? "") +
              '"' +
              (basis.locked ? " readonly" : "") +
              '></td><td class="num">' +
              money(basis.allocated) +
              '</td><td class="num" data-fa-remaining="' +
              esc(id) +
              '">' +
              (item.base_amount
                ? money(
                    Math.round(
                      (Number(item.base_amount) - Number(basis.allocated || 0)) *
                        100,
                    ) / 100,
                  )
                : "—") +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table></div>"
      : "";
    basesEl.querySelectorAll("[data-fa-basis]").forEach(
      (sel) =>
        (sel.onchange = () => {
          const c = allocData.cases.find((x) => x.id === sel.dataset.faBasis),
            basis = c.bases.find((b) => b.id === sel.value);
          selected.set(c.id, {
            case_id: c.id,
            basis_id: basis.id,
            base_amount: basis.amount,
          });
          renderBases();
          invalidate();
        }),
    );
    basesEl.querySelectorAll("[data-fa-base]").forEach(
      (inp) =>
        (inp.oninput = () => {
          const item = selected.get(inp.dataset.faBase),
            c = allocData.cases.find((x) => x.id === item.case_id),
            basis = c.bases.find((b) => b.id === item.basis_id);
          item.base_amount = inp.value;
          const remEl = [
            ...basesEl.querySelectorAll("[data-fa-remaining]"),
          ].find((el) => el.dataset.faRemaining === c.id);
          if (remEl)
            remEl.textContent = inp.value
              ? money(
                  Math.round(
                    (Number(inp.value) - Number(basis.allocated || 0)) * 100,
                  ) / 100,
                )
              : "—";
        }),
    );
  };
  const selectCase = (id, on) => {
    const c = allocData.cases.find((x) => x.id === id);
    if (!c) return;
    if (on) {
      const basis = c.bases.find((b) => b.id === c.default_basis);
      selected.set(id, {
        case_id: id,
        basis_id: basis.id,
        base_amount: basis.amount,
      });
    } else selected.delete(id);
  };
  $("#fa-case-options")
    .querySelectorAll("input")
    .forEach(
      (inp) =>
        (inp.onchange = () => {
          selectCase(inp.value, inp.checked);
          renderBases();
          invalidate();
        }),
    );
  if (preselectId) {
    const cb = [...$("#fa-case-options").querySelectorAll("input")].find(
      (inp) => inp.value === preselectId,
    );
    if (cb) {
      cb.checked = true;
      selectCase(preselectId, true);
      renderBases();
    }
  }
  $("#fa-search").oninput = () => {
    const q = $("#fa-search").value.toLowerCase().trim();
    $("#fa-case-options")
      .querySelectorAll("[data-fa-option]")
      .forEach((label) => {
        const c = allocData.cases.find((x) => x.id === label.dataset.faOption);
        label.hidden = ![c.name, c.client, c.code]
          .join(" ")
          .toLowerCase()
          .includes(q);
      });
  };
  $("#fa-select-all").onclick = () => {
    $("#fa-case-options")
      .querySelectorAll("label:not([hidden]) input")
      .forEach((inp) => {
        if (!inp.checked) {
          inp.checked = true;
          selectCase(inp.value, true);
        }
      });
    renderBases();
    invalidate();
  };
  $("#fa-clear").onclick = () => {
    selected.clear();
    $("#fa-case-options")
      .querySelectorAll("input")
      .forEach((inp) => (inp.checked = false));
    renderBases();
    invalidate();
  };
  const addRecipient = (defaultName = "") => {
    const row = document.createElement("div");
    row.className = "fa-recipient-row";
    row.innerHTML =
      '<label>接收律师姓名<input data-fa-name list="fa-lawyers" required maxlength="40" value="' +
      esc(defaultName) +
      '" placeholder="选择或填写合作律师"></label><label>方式<select data-fa-kind><option value="rate">比例（%）</option><option value="amount">金额（元／案）</option></select></label><label>比例／金额<input data-fa-value type="number" required min="0.01" step="0.01" max="100"></label><button type="button" title="移除此律师">×</button>';
    row.querySelector("button").onclick = () => {
      if (recipients.children.length > 1) {
        row.remove();
        invalidate();
      }
    };
    row.querySelector("select").onchange = () => {
      const inp = row.querySelector("[data-fa-value]");
      if (row.querySelector("select").value === "rate") inp.max = "100";
      else inp.removeAttribute("max");
      invalidate();
    };
    recipients.append(row);
    syncDirUi();
  };
  $("#fa-add-recipient").onclick = () => addRecipient();
  addRecipient();
  formEl
    .querySelectorAll('input[name="fa_direction"]')
    .forEach((r) => (r.onchange = syncDirUi));
  syncDirUi();
  formEl.addEventListener("input", (ev) => {
    if (ev.target.id !== "fa-search") invalidate();
  });
  formEl.addEventListener("change", (ev) => {
    if (ev.target.id !== "fa-search") invalidate();
  });
  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    errorEl.hidden = true;
    try {
      const dir = getDir();
      const payload =
        dir === "inbound"
          ? {
              request_id: requestId,
              direction: "inbound",
              from_lawyer: formEl.elements.fa_from_lawyer.value.trim(),
              cases: [...selected.values()],
              recipients: [
                {
                  name: "本机",
                  kind: formEl.elements.fa_in_kind.value,
                  value: formEl.elements.fa_in_value.value,
                },
              ],
              note: formEl.elements.note.value,
            }
          : {
              request_id: requestId,
              direction: "outbound",
              cases: [...selected.values()],
              recipients: [...recipients.children].map((row) => ({
                name: row.querySelector("[data-fa-name]").value.trim(),
                kind: row.querySelector("[data-fa-kind]").value,
                value: row.querySelector("[data-fa-value]").value,
              })),
              note: formEl.elements.note.value,
            };
      const key = JSON.stringify(payload);
      if (previewKey !== key) {
        const result = await api("fee-allocations/preview", "POST", payload);
        const dirBadge =
          result.direction === "inbound"
            ? '<span class="fa-dir-pill is-in">↙ 分入（他人分给我）</span>'
            : '<span class="fa-dir-pill is-out">↗ 分出（我分给他人）</span>';
        previewEl.innerHTML =
          '<div class="form-section"><h3>本次分配预览 ' +
          dirBadge +
          '</h3></div><div class="table-wrap fa-scroll-sm"><table><thead><tr><th>案件</th><th>往来方向</th><th>基数</th><th>方式</th><th>分配金额</th></tr></thead><tbody>' +
          result.plans
            .map((plan) =>
              plan.splits
                .map(
                  (split) =>
                    "<tr><td>" +
                    esc(plan.case_name) +
                    "</td><td>" +
                    esc((plan.from_lawyer || "本机") + " → " + split.name) +
                    '</td><td class="num">' +
                    money(plan.base_amount) +
                    "</td><td>" +
                    esc(
                      split.kind === "rate"
                        ? split.value + "%"
                        : money(split.value),
                    ) +
                    '</td><td class="num"><strong>' +
                    money(split.amount) +
                    "</strong></td></tr>",
                )
                .join(""),
            )
            .join("") +
          '</tbody></table></div><p><strong>合计' +
          (result.direction === "inbound" ? "分入 " : "分出 ") +
          money(result.total) +
          "，共 " +
          result.cases +
          " 个案件。确认无误后请点击“保存分配”。</strong></p>";
        previewKey = key;
        submitBtn.textContent = "保存分配";
        return;
      }
      const result = await api("fee-allocations", "POST", payload);
      closeModal();
      await refresh();
      notice(
        result.unchanged
          ? "该批次已保存，未重复分配"
          : (result.direction === "inbound"
              ? "他人分入律师费已登记，共 "
              : "律师费已分出，共 ") +
              result.cases +
              " 个案件，合计 " +
              money(result.total),
      );
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
      errorEl.scrollIntoView({ block: "nearest" });
    } finally {
      submitBtn.disabled = false;
    }
  });
}
async function openFeeAllocationHistory(filterName = "", filterDir = "") {
  const allocData = await api("fee-allocations");
  let curDir = filterDir || "";
  const allRows = (allocData.records || []).slice().reverse();
  openModal(
    "律师费分配记录" + (filterName ? " · " + filterName : ""),
    '<div class="fa-history-bar">' +
      '<div class="fa-dir-tabs">' +
      '<button type="button" data-fa-dir="">全部</button>' +
      '<button type="button" data-fa-dir="outbound">↗ 分出（分给他人）</button>' +
      '<button type="button" data-fa-dir="inbound">↙ 分入（他人分给我）</button>' +
      "</div>" +
      '<div class="fa-history-tools">' +
      '<input class="fa-history-search" id="fa-history-search" placeholder="搜索案件、案号或律师…">' +
      '<button type="button" id="fa-history-export">⇱ 导出 Excel</button>' +
      '<button type="button" class="primary" id="fa-history-add">＋ 新增分配</button>' +
      "</div>" +
      "</div>" +
      '<p id="fa-history-totals" class="small muted fa-history-totals"></p>' +
      '<div class="table-wrap fa-scroll-lg"><table><thead><tr><th>案件</th><th>方向 ／ 往来律师</th><th>到账／基数</th><th>分配金额</th><th>登记时间</th><th>状态</th></tr></thead><tbody id="fa-history-tbody"></tbody></table></div>' +
      '<div class="form-actions"><button type="button" data-action="close-modal">关闭</button></div>',
  );
  const matchRows = () => {
    const q = ($("#fa-history-search")?.value || "").toLowerCase().trim();
    return allRows.filter((row) => {
      const dir = faEffectiveDir(row);
      if (curDir && dir !== curDir) return false;
      if (filterName) {
        const hit =
          dir === "inbound"
            ? (row.from_lawyer || row.by) === filterName ||
              row.recipient === filterName
            : row.recipient === filterName;
        if (!hit) return false;
      }
      if (
        q &&
        ![
          row.case_name,
          row.case_code,
          row.from_lawyer,
          row.recipient,
          row.by,
          row.note,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
  };
  const renderRows = () => {
    document
      .querySelectorAll("[data-fa-dir]")
      .forEach((b) => b.classList.toggle("selected", b.dataset.faDir === curDir));
    const matched = matchRows();
    let outSum = 0,
      inSum = 0;
    for (const r of matched) {
      if (r.voided_at) continue;
      if (faEffectiveDir(r) === "inbound")
        inSum = Math.round((inSum + Number(r.amount || 0)) * 100) / 100;
      else outSum = Math.round((outSum + Number(r.amount || 0)) * 100) / 100;
    }
    const net = Math.round((inSum - outSum) * 100) / 100;
    $("#fa-history-totals").innerHTML =
      "当前筛选有效记录：<strong>↗ 分出 " +
      money(outSum) +
      "</strong>　｜　<strong>↙ 分入 " +
      money(inSum) +
      "</strong>　｜　净额 <strong>" +
      (net > 0 ? "+" : "") +
      money(net) +
      "</strong>";
    $("#fa-history-tbody").innerHTML = matched.length
      ? matched
          .map((row) => {
            const isIn = faEffectiveDir(row) === "inbound";
            const flow =
              (row.from_lawyer || row.case_lawyer || row.by || "本机") +
              " → " +
              row.recipient;
            return (
              '<tr data-fa-history="' +
              esc(row.id) +
              '"><td><strong>' +
              esc(row.case_name) +
              '</strong><span class="sub">' +
              esc(row.case_code) +
              (row.note ? " · " + esc(row.note) : "") +
              '</span></td><td><span class="fa-dir-pill ' +
              (isIn ? "is-in" : "is-out") +
              '">' +
              (isIn ? "↙ 分入" : "↗ 分出") +
              '</span><span class="sub">' +
              esc(flow) +
              "</span></td><td>" +
              esc(row.source_period || row.source_date || "手填基数") +
              '<span class="sub">基数 ' +
              money(row.base_amount) +
              '</span></td><td class="num"><strong>' +
              money(row.amount) +
              '</strong><span class="sub">' +
              esc(row.kind === "rate" ? row.value + "%" : "固定金额") +
              '</span></td><td><span class="small muted">' +
              time(row.at) +
              "</span></td><td>" +
              (row.voided_at
                ? '<span class="muted small">已撤销：' +
                  esc(row.void_reason) +
                  "</span>"
                : '<button type="button" class="text-button danger" data-fa-void="' +
                  esc(row.id) +
                  '">撤销</button>') +
              "</td></tr>"
            );
          })
          .join("")
      : '<tr><td colspan="6" class="muted small">当前筛选条件下暂无分配记录。</td></tr>';
    document.querySelectorAll("[data-fa-void]").forEach((btn) => {
      btn.onclick = () => {
        const id = btn.dataset.faVoid;
        form(
          "撤销分配记录",
          '<p class="hint">撤销后保留原记录痕迹、释放对应基数可分配额度，并自动更新承办律师费用统计。</p><label>撤销原因<textarea name="reason" required placeholder="例如：比例调整，重新核算分配"></textarea></label>',
          async (f) => {
            await api("fee-allocations/" + id + "/void", "POST", {
              reason: f.elements.reason.value,
            });
            await refresh();
            notice("分配已撤销");
            await openFeeAllocationHistory(filterName, curDir);
          },
          "确认撤销",
        );
      };
    });
  };
  document.querySelectorAll("[data-fa-dir]").forEach((b) => {
    b.onclick = () => {
      curDir = b.dataset.faDir;
      renderRows();
    };
  });
  $("#fa-history-add").onclick = () =>
    openFeeAllocation("", curDir || "outbound").catch((e) => notice(e.message));
  $("#fa-history-search").oninput = renderRows;
  $("#fa-history-export").onclick = () => {
    try {
      const matched = matchRows().filter((r) => !r.voided_at);
      if (!matched.length) {
        notice("当前筛选条件下没有有效分配记录可导出");
        return;
      }
      const headers = [
        "案件名称",
        "内部案号",
        "方向",
        "来源律师",
        "接收律师",
        "结算期/收款日",
        "分配基数（元）",
        "分配方式",
        "比例/定额",
        "分配金额（元）",
        "备注",
        "登记人",
        "登记时间",
      ];
      const rows = matched.map((r) => {
        const isIn = faEffectiveDir(r) === "inbound";
        return [
          r.case_name || "",
          r.case_code || "",
          isIn ? "分入" : "分出",
          r.from_lawyer || r.case_lawyer || r.by || "本机",
          r.recipient || "",
          r.source_period || r.source_date || "",
          Number(r.base_amount || 0),
          r.kind === "rate" ? "比例" : "定额",
          r.kind === "rate" ? r.value + "%" : Number(r.value || 0),
          Number(r.amount || 0),
          r.note || "",
          r.by || "",
          r.at || "",
        ];
      });
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws["!cols"] = headers.map((h) => ({
        wch: h.includes("案件") || h.includes("备注") ? 28 : 15,
      }));
      XLSX.utils.book_append_sheet(wb, ws, "分配记录");
      saveWorkbook(
        wb,
        "律师费分配记录-" +
          (filterName ? filterName + "-" : "") +
          today() +
          ".xlsx",
      );
      notice("分配记录已导出：" + rows.length + " 笔");
    } catch (e) {
      notice(e.message);
    }
  };
  renderRows();
}
function aiKeyLinksHtml(providers, activeProviderId) {
  return providers
    .filter((p) => p.key_url)
    .map(
      (p) =>
        '<a class="ai-key-chip' +
        (p.id === activeProviderId ? " active" : "") +
        '" href="' +
        esc(p.key_url) +
        '" target="_blank" rel="noopener noreferrer" data-ai-key-url="' +
        esc(p.key_url) +
        '">' +
        esc(p.short_name || p.name) +
        " ↗</a>",
    )
    .join("");
}
function aiConfigFormHtml(ai) {
  const providers = ai?.providers || [],
    currentProvider =
      providers.find((p) => p.id === ai?.provider) || providers[0] || {},
    models = currentProvider.models || [],
    inPreset = models.some((m) => m.id === ai?.model);
  return (
    '<form class="ai-config-form"><div class="form-grid"><label>服务商 / 接入方案<select name="provider">' +
    providers
      .map(
        (p) =>
          '<option value="' +
          esc(p.id) +
          '"' +
          (p.id === ai?.provider ? " selected" : "") +
          ">" +
          esc(p.name) +
          "</option>",
      )
      .join("") +
    '</select></label><label>接口协议<select name="protocol"><option value="openai"' +
    (ai?.protocol !== "anthropic" ? " selected" : "") +
    '>OpenAI 兼容（/chat/completions）</option><option value="anthropic"' +
    (ai?.protocol === "anthropic" ? " selected" : "") +
    '>Anthropic 兼容（/messages）</option></select></label><label class="full">API 接口地址（Base URL）<input name="base_url" value="' +
    esc(ai?.base_url || currentProvider.base_url || "") +
    '" placeholder="例如 https://api.siliconflow.cn/v1"><span class="ai-endpoint-chips" data-ai-endpoints>' +
    (currentProvider.endpoints || [])
      .map(
        (ep) =>
          '<button type="button" class="text-button" data-ai-endpoint="' +
          esc(ep.url) +
          '">填入：' +
          esc(ep.label) +
          "</button>",
      )
      .join("") +
    '</span></label><label class="full"><span class="ai-key-head"><span>API Key</span><a class="ai-key-primary-link" data-ai-primary-key-link href="' +
    esc(currentProvider.key_url || "#") +
    '" target="_blank" rel="noopener noreferrer" data-ai-key-url="' +
    esc(currentProvider.key_url || "") +
    '"' +
    (currentProvider.key_url ? "" : " hidden") +
    ">" +
    esc(currentProvider.key_label || "前往平台获取 API Key ↗") +
    '</a></span><input type="password" name="api_key" autocomplete="off" placeholder="' +
    esc(
      ai?.has_api_key
        ? "已保存在本机（" + ai.masked_api_key + "），不修改请留空"
        : "粘贴对应平台的 API Key（仅保存在本机，不会随案件备份导出）",
    ) +
    '"><span class="ai-endpoint-chips" data-ai-key-links><span class="small muted">直达申请 Key：</span>' +
    aiKeyLinksHtml(providers, currentProvider.id) +
    '</span></label><label>推荐 / 免费模型选择<div class="ai-inline-row"><select data-ai-model-select>' +
    models
      .map(
        (m) =>
          '<option value="' +
          esc(m.id) +
          '"' +
          (m.id === ai?.model ? " selected" : "") +
          ">" +
          esc(m.label) +
          "</option>",
      )
      .join("") +
    '<option value="__custom__"' +
    (!inPreset ? " selected" : "") +
    '>手动填写模型标识（Coding Plan / 其他模型）</option></select><button type="button" data-ai-fetch-models>刷新列表</button></div></label><label>实际调用模型标识（Model ID）<input name="model" value="' +
    esc(ai?.model || currentProvider.default_model || "") +
    '" placeholder="如 Qwen/Qwen3-8B 或 qwen3-coder-plus"></label></div><p class="form-error" role="alert" hidden></p><p class="hint" data-ai-feedback hidden></p><div class="page-actions">' +
    (ai?.has_api_key
      ? '<button type="button" data-ai-clear-key>清除已存密钥</button>'
      : "") +
    '<button type="button" data-ai-test>测试连接</button><button type="submit" class="primary">保存 AI 设置</button></div></form>'
  );
}
function bindAiConfigForm(root, onSaved) {
  const formEl = root.querySelector(".ai-config-form");
  if (!formEl) return;
  const providers = data.ai?.providers || [],
    providerMap = Object.fromEntries(providers.map((p) => [p.id, p])),
    providerSelect = formEl.elements.provider,
    protocolSelect = formEl.elements.protocol,
    baseUrlInput = formEl.elements.base_url,
    apiKeyInput = formEl.elements.api_key,
    modelInput = formEl.elements.model,
    modelSelect = formEl.querySelector("[data-ai-model-select]"),
    endpointsBox = formEl.querySelector("[data-ai-endpoints]"),
    primaryKeyLink = formEl.querySelector("[data-ai-primary-key-link]"),
    keyLinksBox = formEl.querySelector("[data-ai-key-links]"),
    errorEl = formEl.querySelector(".form-error"),
    feedbackEl = formEl.querySelector("[data-ai-feedback]");
  const showFeedback = (msg, isError = false) => {
    errorEl.hidden = !isError;
    feedbackEl.hidden = isError;
    if (isError) errorEl.textContent = msg;
    else feedbackEl.textContent = msg;
  };
  const populateModelSelect = (list, activeModel) => {
    const hasMatch = list.some((m) => m.id === activeModel);
    modelSelect.innerHTML =
      list
        .map(
          (m) =>
            '<option value="' +
            esc(m.id) +
            '"' +
            (m.id === activeModel ? " selected" : "") +
            ">" +
            esc(m.label || m.id) +
            "</option>",
        )
        .join("") +
      '<option value="__custom__"' +
      (!hasMatch ? " selected" : "") +
      ">手动填写模型标识（Coding Plan / 其他模型）</option>";
  };
  providerSelect.onchange = () => {
    const p = providerMap[providerSelect.value];
    if (!p) return;
    protocolSelect.value = p.protocol || "openai";
    if (p.base_url) baseUrlInput.value = p.base_url;
    if (p.default_model) modelInput.value = p.default_model;
    populateModelSelect(p.models || [], modelInput.value);
    endpointsBox.innerHTML = (p.endpoints || [])
      .map(
        (ep) =>
          '<button type="button" class="text-button" data-ai-endpoint="' +
          esc(ep.url) +
          '">填入：' +
          esc(ep.label) +
          "</button>",
      )
      .join("");
    if (primaryKeyLink) {
      if (p.key_url) {
        primaryKeyLink.hidden = false;
        primaryKeyLink.href = p.key_url;
        primaryKeyLink.dataset.aiKeyUrl = p.key_url;
        primaryKeyLink.textContent = p.key_label || "前往平台获取 API Key ↗";
      } else {
        primaryKeyLink.hidden = true;
      }
    }
    if (keyLinksBox) {
      keyLinksBox.innerHTML =
        '<span class="small muted">直达申请 Key：</span>' +
        aiKeyLinksHtml(providers, p.id);
    }
  };
  modelSelect.onchange = () => {
    if (modelSelect.value !== "__custom__")
      modelInput.value = modelSelect.value;
    else modelInput.focus();
  };
  formEl.addEventListener("click", async (e) => {
    const keyLink = e.target.closest("[data-ai-key-url]");
    if (keyLink) {
      const url = keyLink.dataset.aiKeyUrl;
      if (url && window.hengzhang?.openAiKeyUrl) {
        e.preventDefault();
        try {
          await window.hengzhang.openAiKeyUrl(url);
        } catch (err) {
          showFeedback(err.message, true);
        }
      }
      return;
    }
    const epBtn = e.target.closest("[data-ai-endpoint]");
    if (epBtn) {
      baseUrlInput.value = epBtn.dataset.aiEndpoint;
      return;
    }
    const fetchBtn = e.target.closest("[data-ai-fetch-models]");
    if (fetchBtn) {
      fetchBtn.disabled = true;
      showFeedback("正在从接口拉取可用模型列表…");
      try {
        const res = await api("ai/models", "POST", {
          provider: providerSelect.value,
          protocol: protocolSelect.value,
          base_url: baseUrlInput.value,
          api_key: apiKeyInput.value,
          model: modelInput.value,
        });
        populateModelSelect(res.models || [], modelInput.value);
        showFeedback(
          "已更新模型列表（共 " +
            (res.models?.length || 0) +
            " 个模型，免费模型已置顶）",
        );
      } catch (err) {
        showFeedback(err.message, true);
      } finally {
        fetchBtn.disabled = false;
      }
      return;
    }
    const testBtn = e.target.closest("[data-ai-test]");
    if (testBtn) {
      testBtn.disabled = true;
      showFeedback("正在测试 AI 接口连接…");
      try {
        const res = await api("ai/test", "POST", {
          provider: providerSelect.value,
          protocol: protocolSelect.value,
          base_url: baseUrlInput.value,
          api_key: apiKeyInput.value,
          model: modelInput.value,
        });
        showFeedback("连接成功（" + res.model + "）：" + res.reply);
      } catch (err) {
        showFeedback(err.message, true);
      } finally {
        testBtn.disabled = false;
      }
      return;
    }
    const clearBtn = e.target.closest("[data-ai-clear-key]");
    if (clearBtn) {
      clearBtn.disabled = true;
      try {
        const res = await api("ai/config", "PUT", {
          provider: providerSelect.value,
          protocol: protocolSelect.value,
          base_url: baseUrlInput.value,
          model: modelInput.value,
          clear_api_key: true,
        });
        data.ai = res.ai;
        notice("已清除本机保存的 API Key");
        onSaved?.(res.ai);
      } catch (err) {
        showFeedback(err.message, true);
      } finally {
        clearBtn.disabled = false;
      }
    }
  });
  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = formEl.querySelector("[type=submit]");
    submitBtn.disabled = true;
    errorEl.hidden = true;
    try {
      const res = await api("ai/config", "PUT", {
        provider: providerSelect.value,
        protocol: protocolSelect.value,
        base_url: baseUrlInput.value,
        api_key: apiKeyInput.value,
        model: modelInput.value,
      });
      data.ai = res.ai;
      apiKeyInput.value = "";
      showFeedback("AI 设置已保存至本机");
      notice("AI 合同识别设置已保存");
      onSaved?.(res.ai);
    } catch (err) {
      showFeedback(err.message, true);
    } finally {
      submitBtn.disabled = false;
    }
  });
}
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const str = String(reader.result || ""),
        idx = str.indexOf(",");
      resolve(idx >= 0 ? str.slice(idx + 1) : str);
    };
    reader.onerror = () => reject(new Error("无法读取所选合同文件"));
    reader.readAsDataURL(file);
  });
}
function renderSettings() {
  const ai = data.ai || {};
  $("#content").innerHTML =
    '<div class="page-heading"><div><h1>设置与备份</h1><p>保存一份完整备份，换电脑或需要时可以恢复。</p></div></div><section id="software-updates" class="panel">' +
    (window.HzUpdates?.panel() || "") +
    '</section><section id="ai-settings-panel" class="panel"><div class="panel-head"><div><h2>AI 合同识别</h2><p class="hint">新建案件时可从委托/代理合同（PDF 或 Word）自动提取当事人、案由、律师费和期限。</p></div>' +
    badge(
      ai.has_api_key
        ? (ai.model || "已就绪") + (ai.is_free_model ? " · 免费" : "")
        : "待配置密钥",
      ai.has_api_key ? "good" : "warn",
    ) +
    '</div><p class="hint">默认适配<strong>硅基流动（SiliconFlow）</strong>的多款免费模型（如 <code>Qwen/Qwen3-8B</code>、<code>Qwen/Qwen3-VL-8B-Instruct</code>、<code>PaddlePaddle/PaddleOCR-VL-1.5</code>、<code>deepseek-ai/DeepSeek-OCR</code>）及智谱免费 <code>glm-4-flash</code> / <code>glm-4v-flash</code>；也支持切换至 DeepSeek、阿里云百炼、智谱 GLM、火山方舟等付费 API 或 <strong>Coding Plan 专属接口</strong>。扫描版 PDF 与合同图片会自动优先调用免费多模态视觉 OCR 识别（离线或纯文本接口自动回退至 Mac 本机 Vision OCR），API Key 仅保存在本机且不随案件备份导出。</p>' +
    aiConfigFormHtml(ai) +
    '</section><section class="panel"><h2>工作台格言</h2><form id="motto-form"><label>自定义格言<input name="dashboard_motto" maxlength="60" value="' +
    esc(data.preferences.custom_motto) +
    '" placeholder="' + esc(data.preferences.default_motto) +
    '"></label><p class="hint">最多 60 字，自定义内容优先。留空保存或恢复默认后，每天自动显示一句内置金句，无需联网。</p><p class="form-error" role="alert" hidden></p><div class="page-actions"><button type="button" data-action="reset-motto">恢复默认</button><button class="primary" type="submit">保存格言</button></div></form></section><section class="panel"><h2>数据备份</h2><div class="setting-row"><div><strong>导出完整备份</strong><p>包含全部案件、收款流水、进展和提醒。可保存到移动硬盘或其他设备。</p></div><button class="primary" data-action="backup-export">导出备份</button></div><div class="setting-row"><div><strong>从备份文件恢复</strong><p>先预览文件内容，再确认替换当前数据；替换前会自动保留一份备份。</p></div><button data-action="backup-import">选择备份文件</button></div><div class="setting-row"><div><strong>自动备份</strong><p>每 48 小时自动备份一次，重启不会重复备份；应用退出期间不备份。可随时点击“导出备份”手动备份，恢复前另存保护快照。本机备份合计保留最近 5 份。</p></div>' +
    badge(backupInfo?.automatic_error ? "备份异常" : "已开启", backupInfo?.automatic_error ? "warn" : "good") +
    '</div>' +
    (backupInfo?.automatic_error ? '<p class="form-error" role="alert">' + esc(backupInfo.automatic_error) + "</p>" : "") +
    '</section><section class="panel"><div class="panel-head"><h2>最近的本机备份</h2><span class="small muted">' +
    (backupInfo?.backups.length || 0) +
    " / " + (backupInfo?.retention || 5) + " 份</span></div>" +
    (backupInfo?.backups.length
      ? '<div class="table-wrap backup-table"><table><thead><tr><th>备份时间</th><th>内容</th><th>案件数</th><th>操作</th></tr></thead><tbody>' +
        backupInfo.backups
          .map(
            (b) =>
              "<tr><td>" +
              time(b.created_at) +
              "</td><td>" +
              esc(reasonLabels[b.reason] || "自动备份") +
              "</td><td>" +
              b.cases +
              '</td><td><button class="text-button" data-action="backup-restore" data-id="' +
              b.id +
              '">预览与恢复</button></td></tr>',
          )
          .join("") +
        "</tbody></table></div>"
      : '<p class="hint">还没有备份。开始使用后会自动生成，也可以立即导出一份。</p>') +
    '</section><section class="panel"><h2>本机存储</h2><p class="hint">案件数据与应用程序分开保存。替换新版 App 会保留数据；删除数据目录会同时删除本机数据和自动备份。</p><p class="path">' +
    esc(backupInfo?.data_dir || "") +
    '</p><div class="page-actions"><button data-action="reveal-data"' +
    (window.hengzhang ? "" : " disabled") +
    '>在访达中打开</button></div></section><p class="hint">衡账 · Mac 本地版 ' +
    esc(data.version) +
    ' · 开发者：<a href="https://aifalv.vip/" target="_blank" rel="noopener noreferrer" data-homepage>潘松律师</a></p>';
  const mottoForm = $("#motto-form");
  mottoForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = mottoForm.querySelector("[type=submit]"),
      error = mottoForm.querySelector(".form-error");
    button.disabled = true;
    error.hidden = true;
    try {
      await api("preferences", "PUT", {
        dashboard_motto: mottoForm.elements.dashboard_motto.value,
      });
      await refresh();
      notice("工作台格言已保存");
    } catch (failure) {
      error.textContent = failure.message;
      error.hidden = false;
    } finally {
      button.disabled = false;
    }
  });
  bindAiConfigForm($("#ai-settings-panel"), () => renderSettings());
}
async function editor(id = null, renew = false) {
  let c = id
    ? findCase(id)
    : { track: filter.track || "litigation", status: "在办", co_lawyers: [] };
  const original = c;
  if (renew) c = (await api("cases/" + id + "/renewal-draft")).draft;
  const match = (c.service_period || "").match(
      /^(\d{4}-\d{2}-\d{2})\s*至\s*(\d{4}-\d{2}-\d{2})$/,
    ),
    stages = names(c.service_period);
  const html =
    '<div class="form-grid"><label>类型<select name="track">' +
    Object.entries(data.tracks)
      .map(
        ([key, label]) =>
          '<option value="' +
          key +
          '"' +
          (c.track === key ? " selected" : "") +
          (renew && key !== "advisory" ? " disabled" : "") +
          ">" +
          label +
          "</option>",
      )
      .join("") +
    "</select></label>" +
    input("case_no", "内部案号", c.case_no) +
    input(
      "client",
      "客户（多个主体用逗号分隔）",
      c.client,
      "text",
      'class="full"',
    ) +
    '<div class="full" data-for="litigation"><div class="form-grid">' +
    input("plaintiff", "原告", c.plaintiff) +
    input("defendant", "被告", c.defendant) +
    input("third_party", "第三人", c.third_party) +
    input("case_type", "案由", c.case_type) +
    '<label>标的额（元）<input name="subject_amount" inputmode="decimal" pattern="[0-9]+(?:[.．][0-9]{1,2})?" title="请输入非负金额，最多两位小数" value="' + esc(c.subject_amount ?? "") + '"></label>' +
    '</div><div class="party-choices"><span>从当事人中勾选客户，也可直接填写上方客户字段。</span><div id="client-choices" class="check-group"></div></div><div class="form-grid"><label>当前案件阶段<select name="case_stage">' +
    options(data.stages, c.case_stage, "待补充") +
    '</select></label><div><span class="small">合同服务阶段</span><div class="check-group">' +
    data.stages
      .map(
        (s) =>
          '<label><input type="checkbox" name="scope" value="' +
          s +
          '"' +
          (stages.includes(s) ? " checked" : "") +
          ">" +
          s +
          "</label>",
      )
      .join("") +
    "</div></div></div></div>" +
    '<div class="full" data-for="project"><div class="form-grid">' +
    input("name", "项目名称", c.name) +
    input("opponent", "对方当事人", c.opponent) +
    '</div></div><div class="full" data-for="advisory"><div class="form-grid">' +
    input("service_start", "服务开始日期", match?.[1], "date") +
    input("service_end", "服务结束日期", match?.[2], "date") +
    "</div></div>" +
    input("lawyer", "承办律师（可不填）", c.lawyer) +
    input(
      "co_lawyers",
      "协办律师（逗号分隔，可不填）",
      (c.co_lawyers || []).join("、"),
    ) +
    input("client_contact", "客户联系人", c.client_contact) +
    input("sign_date", "签约日期", c.sign_date, "date") +
    '<div class="form-section full"><h3>律师费</h3></div>' +
    input(
      "contract_amount",
      "签约律师费（元，根据风险费情况手动更新）",
      c.contract_amount,
      "number",
    ) +
    input("invoice_amount", "累计已开票（元）", c.invoice_amount, "number") +
    input(
      "collected_amount",
      "累计已收款（元）",
      c.collected_amount,
      "number",
    ) +
    input("unpaid", "未付金额（留空自动计算）", c.unpaid, "number") +
    input(
      "invoiced_unpaid",
      "开票未付金额（留空自动计算）",
      c.invoiced_unpaid,
      "number",
    ) +
    textArea(
      "fee_note",
      "费用说明：计算依据、付款节点及条件",
      c.fee_note,
      'class="full"',
    ) +
    select("status", "案件状态", ["在办", "已结", "中止"], c.status) +
    input("close_date", "结案日期", c.close_date, "date") +
    input("close_method", "结案方式", c.close_method) +
    textArea("notes", "备注", c.notes, 'class="full"');
  const el = form(
    renew ? "续签顾问案件" : id ? "编辑案件" : "新建案件",
    html,
    async (f) => {
      const v = values(f),
        track = v.track;
      const body = { ...v, co_lawyers: names(v.co_lawyers) };
      delete body.scope;
      delete body.service_start;
      delete body.service_end;
      if (track === "litigation" && v.subject_amount) body.subject_amount = v.subject_amount.replace("．", ".");
      if (track === "advisory") {
        if (
          (v.service_start && !v.service_end) ||
          (!v.service_start && v.service_end)
        )
          throw Error("请同时填写服务开始和结束日期");
        if (v.service_start > v.service_end)
          throw Error("服务结束日期不能早于开始日期");
        body.service_period = v.service_start
          ? v.service_start + " 至 " + v.service_end
          : "";
      } else if (track === "litigation")
        body.service_period = [...f.querySelectorAll("[name=scope]:checked")]
          .map((x) => x.value)
          .join(",");
      else body.service_period = "";
      for (const key of [
        "contract_amount",
        "invoice_amount",
        "collected_amount",
        "unpaid",
        "invoiced_unpaid",
      ])
        body[key] = v[key] === "" ? null : v[key];
      if (id && !renew) body.revision = original.revision;
      if (renew) body.renew_from = id;
      const result = await api(
        id && !renew ? "cases/" + id : "cases",
        id && !renew ? "PUT" : "POST",
        body,
      );
      closeModal();
      filter.status = "";
      await refresh();
      notice(renew ? "续签案件已创建" : id ? "案件已保存" : "案件已创建");
      if (view !== "cases") await openDetail(result.case.id);
    },
    renew ? "创建续签案件" : "保存案件",
  );
  const updateTrack = () => {
    el.querySelectorAll("[data-for]").forEach((group) => {
      const hidden = group.dataset.for !== el.elements.track.value;
      group.hidden = hidden;
      group
        .querySelectorAll("input,select,textarea")
        .forEach((x) => (x.disabled = hidden));
    });
  };
  el.elements.track.onchange = updateTrack;
  updateTrack();
  const updateClients = () => {
    const selected = new Set(names(el.elements.client.value)),
      all = [
        ...new Set(
          ["plaintiff", "defendant", "third_party"].flatMap((k) =>
            names(el.elements[k].value),
          ),
        ),
      ];
    $("#client-choices").innerHTML = all
      .map(
        (n) =>
          '<label><input type="checkbox" data-client="' +
          esc(n) +
          '"' +
          (selected.has(n) ? " checked" : "") +
          ">" +
          esc(n) +
          "</label>",
      )
      .join("");
  };
  for (const key of ["plaintiff", "defendant", "third_party", "client"])
    el.elements[key].addEventListener("input", updateClients);
  $("#client-choices").onchange = (e) => {
    const selected = new Set(names(el.elements.client.value));
    if (e.target.checked) selected.add(e.target.dataset.client);
    else selected.delete(e.target.dataset.client);
    el.elements.client.value = [...selected].join(",");
  };
  updateClients();
  if (!renew) {
    const box = document.createElement("section");
    box.className = "contract-ai-box";
    box.id = "contract-ai-box";
    let pendingFile = null,
      pendingText = "",
      textDraft = "",
      textPaneOpen = false;
    let trackChosen = Boolean(id), review = null;
    el.elements.track.addEventListener("change", () => { trackChosen = true; renderReview?.(); });
    let renderReview;
    const renderAiBar = () => {
      const ai = data.ai || {},
        ready =
          ai.has_api_key ||
          /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(\/|$)/i.test(
            ai.base_url || "",
          );
      box.innerHTML =
        '<div class="contract-ai-head"><div class="contract-ai-copy"><strong>从委托合同或案情文字智能识别填入</strong><p class="hint" id="contract-ai-status">支持文字版与扫描版 PDF、Word（.docx / .doc）、合同图片（.png / .jpg）拖入或选择，也可直接粘贴案情、当事人或收费文字提取并与原文一起预览，不保存合同原文件。</p></div><div class="page-actions">' +
        badge(
          ready
            ? (ai.model || "AI 已就绪") + (ai.is_free_model ? " · 免费" : "")
            : "待配置 API Key",
          ready ? "good" : "warn",
        ) +
        '<button type="button" data-ai-toggle>AI 设置</button><button type="button" id="contract-ai-text-toggle">' +
        (textPaneOpen ? "收起文字框" : "粘贴文字提取") +
        '</button><button type="button" class="primary" id="contract-ai-pick">选择合同识别</button></div></div><div id="contract-ai-text-pane" class="contract-ai-text-pane"' +
        (textPaneOpen ? "" : " hidden") +
        '><textarea id="contract-ai-text" rows="3" placeholder="粘贴合同条款、客户微信/邮件发来的案情描述、当事人信息或收费约定文字（支持 Cmd+Enter 快捷提取）…">' +
        esc(textDraft) +
        '</textarea><div class="contract-ai-text-actions"><span class="hint">仅将上方文字发送至当前所选 AI 模型提取建档字段</span><div class="page-actions"><button type="button" data-ai-text-clear>清空</button><button type="button" class="primary" id="contract-ai-parse-text">提取文字并预览</button></div></div></div><div id="contract-ai-drawer" class="contract-ai-drawer" hidden><p class="hint">默认预置<strong>硅基流动 SiliconFlow</strong> 免费模型（如 <code>Qwen/Qwen3-8B</code>，扫描件自动联动免费多模态 <code>PaddleOCR-VL-1.5</code>），填入一个免费 API Key 即可开箱使用；也可切换其他付费 API 或 Coding Plan 接口。</p>' +
        aiConfigFormHtml(ai) +
        '</div><input id="contract-ai-file" type="file" accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,image/png,image/jpeg,image/webp" hidden />';
      const drawer = box.querySelector("#contract-ai-drawer"),
        textPane = box.querySelector("#contract-ai-text-pane"),
        textInput = box.querySelector("#contract-ai-text"),
        textToggleBtn = box.querySelector("#contract-ai-text-toggle"),
        parseTextBtn = box.querySelector("#contract-ai-parse-text"),
        clearTextBtn = box.querySelector("[data-ai-text-clear]"),
        statusEl = box.querySelector("#contract-ai-status"),
        pickBtn = box.querySelector("#contract-ai-pick"),
        fileInput = box.querySelector("#contract-ai-file"),
        toggleBtn = box.querySelector("[data-ai-toggle]");
      toggleBtn.onclick = () => {
        drawer.hidden = !drawer.hidden;
      };
      textToggleBtn.onclick = () => {
        textPaneOpen = !textPane.hidden ? false : true;
        textPane.hidden = !textPaneOpen;
        textToggleBtn.textContent = textPaneOpen
          ? "收起文字框"
          : "粘贴文字提取";
        if (textPaneOpen) textInput.focus();
      };
      textInput.oninput = () => {
        textDraft = textInput.value;
      };
      clearTextBtn.onclick = () => {
        textDraft = "";
        textInput.value = "";
        textInput.focus();
      };
      bindAiConfigForm(drawer, async () => {
        renderAiBar();
        if (pendingFile) {
          const f = pendingFile;
          pendingFile = null;
          await handleContractFile(f);
        } else if (pendingText) {
          const t = pendingText;
          pendingText = "";
          await handleContractText(t);
        }
      });
      const reviewEl = document.createElement("section");
      reviewEl.id = "contract-ai-review";
      reviewEl.hidden = true;
      box.append(reviewEl);
      const trackLabels = { litigation:"诉讼", advisory:"顾问", project:"专项" };
      const labels = {case_no:"律所内部案号",client:"客户",client_contact:"客户联系人",plaintiff:"原告",defendant:"被告",third_party:"第三人",case_type:"案由",subject_amount:"标的额（元）",case_stage:"当前阶段",scope:"代理服务范围",name:"项目名称",opponent:"对方当事人",service_start:"服务开始",service_end:"服务结束",lawyer:"承办律师",co_lawyers:"协办律师",sign_date:"签约日期",contract_amount:"固定律师费（元）",fee_note:"费用说明",notes:"备注"};
      const common = ["case_no","client","client_contact","lawyer","co_lawyers","sign_date","contract_amount","fee_note","notes"];
      const byTrack = {litigation:["plaintiff","defendant","third_party","case_type","subject_amount","case_stage","scope"],advisory:["service_start","service_end"],project:["name","opponent"]};
      renderReview = () => {
        if (!review) { reviewEl.hidden = true; return; }
        const { extracted, document: doc } = review;
        const evidence = extracted.evidence || {};
        const current = el.elements.track.value;
        const track = !trackChosen && Object.hasOwn(trackLabels, extracted.track) ? extracted.track : current;
        const keys = [...common, ...(byTrack[track] || [])].filter(k => evidence[k] && extracted[k] != null && extracted[k] !== "" && (!Array.isArray(extracted[k]) || extracted[k].length));
        const text = value => Array.isArray(value) ? value.join("、") : value;
        reviewEl.hidden = false;
        reviewEl.innerHTML = '<h3>核对识别结果</h3><p class="hint">'+(extracted.track || trackChosen ? '回填到：'+esc(trackLabels[track]) : '材料不足以判断业务线，保留当前选择。')+(doc?.truncated?' 本次只提取了材料的前一部分。':'')+'</p>'+
          (keys.length ? '<dl class="contract-ai-review-results">'+keys.map(k=>'<div><dt>'+esc(labels[k])+'</dt><dd>'+esc(text(extracted[k]))+'<br><small class="hint">原文：'+esc(evidence[k])+'</small></dd></div>').join('')+'</dl><label><input type="checkbox" data-ai-overwrite> 覆盖表单中已有的对应字段</label><button type="button" class="primary" data-ai-apply>确认填入表单</button>' : '<p class="hint">没有找到有原文依据的可填写字段。</p>');
        const apply = reviewEl.querySelector("[data-ai-apply]");
        if (!apply) return;
        apply.onclick = () => {
          const overwrite = reviewEl.querySelector("[data-ai-overwrite]").checked;
          if (current !== track) {
            const filled = (byTrack[current] || []).some(k => k === "scope" ? el.querySelector('[name="scope"]:checked') : el.elements[k]?.value?.trim());
            if (filled && !overwrite) { statusEl.textContent = "当前业务线已有填写内容，请手动选择业务线，或确认允许覆盖后再填入。"; return; }
            el.elements.track.value = track;
            updateTrack();
          }
          let count = 0;
          for (const k of keys) {
            if (k === "scope") {
              const inputs = [...el.querySelectorAll('[name="scope"]')];
              if (overwrite || !inputs.some(c => c.checked)) { inputs.forEach(c => { c.checked = extracted.scope.includes(c.value); }); count++; }
              continue;
            }
            const field = el.elements[k];
            if (!field || field.disabled || (!overwrite && field.value.trim())) continue;
            field.value = text(extracted[k]);
            count++;
          }
          updateClients();
          statusEl.textContent = "已确认填入 " + count + " 项，已有手填内容默认保留，请核对后保存案件。";
        };
      };
      if (review) renderReview();
      const showExtracted = result => {
        if (!el.isConnected) return;
        review = result;
        renderReview();
        statusEl.textContent = "识别完成。请核对原文依据，再决定是否填入。";
      };
      const handleContractText = async (rawText) => {
        const text = String(rawText ?? textInput.value ?? "").trim();
        textDraft = textInput.value;
        if (text.length < 6) {
          statusEl.textContent = "请先粘贴至少 6 个字的合同条款或案情描述文字。";
          textPaneOpen = true;
          textPane.hidden = false;
          textToggleBtn.textContent = "收起文字框";
          textInput.focus();
          return;
        }
        const nowReady =
          data.ai?.has_api_key ||
          /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(\/|$)/i.test(
            data.ai?.base_url || "",
          );
        if (!nowReady) {
          pendingText = text;
          drawer.hidden = false;
          statusEl.textContent =
            "已暂存待提取文字，请先在下方填写 API Key 并点击“保存 AI 设置”，保存后将自动开始提取。";
          drawer.querySelector('[name="api_key"]')?.focus();
          return;
        }
        review = null; renderReview();
        parseTextBtn.disabled = true;
        pickBtn.disabled = true;
        parseTextBtn.textContent = "正在提取…";
        statusEl.textContent = "正在从粘贴文字中提取案件信息，请稍候…";
        try {
          const result = await api("cases/extract-contract", "POST", { text });
          showExtracted(result);
        } catch (error) {
          statusEl.textContent = "提取未完成：" + error.message;
          notice(error.message);
        } finally {
          parseTextBtn.disabled = false;
          pickBtn.disabled = false;
          parseTextBtn.textContent = "提取文字并预览";
        }
      };
      parseTextBtn.onclick = () => handleContractText();
      textInput.onkeydown = (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          handleContractText();
        }
      };
      const handleContractFile = async (file) => {
        if (!file) return;
        const nowReady =
          data.ai?.has_api_key ||
          /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(\/|$)/i.test(
            data.ai?.base_url || "",
          );
        if (!nowReady) {
          pendingFile = file;
          drawer.hidden = false;
          statusEl.textContent =
            "已选择《" +
            file.name +
            "》，请先在下方填写 API Key 并点击“保存 AI 设置”，保存后将自动开始识别。";
          drawer.querySelector('[name="api_key"]')?.focus();
          return;
        }
        pickBtn.disabled = true;
        review = null; renderReview();
        parseTextBtn.disabled = true;
        pickBtn.textContent = "正在识别…";
        statusEl.textContent =
          "正在读取《" +
          file.name +
          "》并提取案件信息（扫描件将自动执行多模态视觉 / 本机 OCR），请稍候…";
        try {
          const data_base64 = await fileToBase64(file);
          const result = await api("cases/extract-contract", "POST", {
            filename: file.name,
            data_base64,
          });
          showExtracted(result);
        } catch (error) {
          statusEl.textContent = "识别未完成：" + error.message;
          notice(error.message);
        } finally {
          pickBtn.disabled = false;
          parseTextBtn.disabled = false;
          pickBtn.textContent = "选择合同识别";
        }
      };
      pickBtn.onclick = () => {
        const nowReady =
          data.ai?.has_api_key ||
          /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(\/|$)/i.test(
            data.ai?.base_url || "",
          );
        if (!nowReady) {
          drawer.hidden = false;
          statusEl.textContent =
            "请先填写 API Key（默认已选硅基流动免费模型 Qwen/Qwen3-8B）并保存设置，即可识别合同。";
          drawer.querySelector('[name="api_key"]')?.focus();
          return;
        }
        fileInput.click();
      };
      fileInput.onchange = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) await handleContractFile(file);
      };
      box.ondragover = (e) => {
        e.preventDefault();
        box.classList.add("drag-over");
      };
      box.ondragleave = () => box.classList.remove("drag-over");
      box.ondrop = async (e) => {
        e.preventDefault();
        box.classList.remove("drag-over");
        const file = e.dataTransfer?.files?.[0];
        if (file) await handleContractFile(file);
      };
    };
    renderAiBar();
    $("#modal-body").prepend(box);
  }
}
async function openDetail(id) {
  const c = (await api("cases/" + id)).case;
  const fields = [
    ["内部案号", c.case_no],
    ["案件类型", data.tracks[c.track]],
    ["客户", c.client],
    ["客户联系人", c.client_contact],
    ["项目名称", c.name],
    ["案由", c.case_type],
    ["标的额", c.subject_amount == null ? "" : money(c.subject_amount)],
    ["原告", c.plaintiff],
    ["被告", c.defendant],
    ["第三人", c.third_party],
    ["对方当事人", c.opponent],
    ["承办律师", c.lawyer],
    ["协办律师", c.co_lawyers.join("、")],
    ["当前案件阶段", c.case_stage],
    ["服务期限 / 阶段", c.service_period],
  ];
  openModal(
    "案件详情",
    '<div class="detail-title"><h3>' +
      esc(labelCase(c)) +
      "</h3>" +
      badge(data.tracks[c.track], "blue") +
      badge(c.status, c.status === "在办" ? "good" : "") +
      '</div><dl class="detail-grid">' +
      fields
        .filter(([, v]) => v)
        .map(([k, v]) => "<div><dt>" + k + "</dt><dd>" + esc(v) + "</dd></div>")
        .join("") +
      '</dl><section class="detail-progress"><div class="panel-head"><h3>案件进展</h3><button class="primary" data-action="progress" data-id="' +
      id +
      '">管理进展</button></div><div class="progress-timeline">' +
      progressEntries(c) +
      "</div></section>",
  );
}
function collection(id) {
  const c = findCase(id);
  form(
    "登记到账 · " + labelCase(c),
    '<p class="hint">当前累计已收款 ' +
      money(c.fee_summary.received) +
      '。本次金额会在保存后增加至累计已收款。</p><div class="form-grid">' +
      input("date", "到账日期", today(), "date") +
      input("amount", "本次到账金额（元）", "", "number") +
      textArea("note", "收款备注", "", 'class="full"') +
      "</div>",
    async (f) => {
      await api("cases/" + id + "/collections", "POST", values(f));
      closeModal();
      await refresh();
      notice("收款已记录");
    },
    "登记到账",
  );
}
function progressEntries(c, editable = false) {
  return (
    sortedProgress(c)
      .map((entry) => {
        const progressId = esc(entry.id),
          dateLabel = entry.edited_at
            ? "修改于 " + progressDate(entry.edited_at)
            : "记录于 " + progressDate(entry.at);
        return (
          '<article class="progress-entry" data-progress-entry="' +
          progressId +
          '"><div class="progress-entry-main"><p data-progress-text>' +
          esc(entry.text) +
          '</p><form class="progress-edit-form" data-progress-edit-form hidden><label>修改进展<textarea name="text" rows="2" required>' +
          esc(entry.text) +
          '</textarea></label><div class="form-actions"><button type="button" data-progress-cancel>取消</button><button type="submit" class="primary">保存修改</button></div></form><small>' +
          dateLabel +
          "</small></div>" +
          (editable
            ? '<div class="progress-entry-actions"><button type="button" class="text-button" data-progress-edit>修改</button><button type="button" class="text-button danger" data-progress-delete>删除</button></div>'
            : "") +
          "</article>"
        );
      })
      .join("") || '<p class="hint">暂无进展记录。</p>'
  );
}
async function progress(id) {
  const c = (await api("cases/" + id)).case;
  openModal(
    "案件进展 · " + labelCase(c),
    '<div class="progress-manager"><div class="progress-timeline" aria-label="进展记录">' +
      progressEntries(c, true) +
      '</div><form id="progress-create-form"><label>新增进展<textarea name="text" rows="3" required maxlength="20000" placeholder="如：已提交材料，等待法院通知"></textarea></label><div class="form-actions"><button type="button" data-action="close-modal">关闭</button><button type="submit" class="primary">保存进展</button></div></form></div>',
  );
  const root = $("#modal-body");
  const saveForm = (formEl, save, success) => {
    formEl.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = formEl.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        await save(formEl);
        await refresh();
        notice(success);
        await progress(id);
      } catch (error) {
        notice(error.message);
      } finally {
        button.disabled = false;
      }
    });
  };
  const createForm = root.querySelector("#progress-create-form");
  saveForm(
    createForm,
    (formEl) =>
      api("cases/" + id + "/progress", "POST", {
        text: formEl.elements.text.value,
      }),
    "进展已记录",
  );
  root.querySelectorAll("[data-progress-edit]").forEach((button) =>
    button.addEventListener("click", () => {
      const entry = button.closest("[data-progress-entry]");
      entry.querySelector("[data-progress-text]").hidden = true;
      entry.querySelector("[data-progress-edit-form]").hidden = false;
      entry.querySelector("[data-progress-edit-form] textarea").focus();
    }),
  );
  root.querySelectorAll("[data-progress-cancel]").forEach((button) =>
    button.addEventListener("click", () => {
      const entry = button.closest("[data-progress-entry]");
      entry.querySelector("[data-progress-edit-form]").hidden = true;
      entry.querySelector("[data-progress-text]").hidden = false;
    }),
  );
  root.querySelectorAll("[data-progress-edit-form]").forEach((formEl) =>
    saveForm(
      formEl,
      (editForm) =>
        api(
          "cases/" + id + "/progress/" +
            formEl.closest("[data-progress-entry]").dataset.progressEntry,
          "PUT",
          { text: editForm.elements.text.value, revision: c.revision },
        ),
      "进展已修改",
    ),
  );
  root.querySelectorAll("[data-progress-delete]").forEach((button) =>
    button.addEventListener("click", async () => {
      const entry = button.closest("[data-progress-entry]");
      if (!confirm("确认删除这条进展记录？")) return;
      button.disabled = true;
      try {
        await api(
          "cases/" + id + "/progress/" + entry.dataset.progressEntry,
          "DELETE",
          { revision: c.revision },
        );
        await refresh();
        notice("进展已删除");
        await progress(id);
      } catch (error) {
        notice(error.message);
        button.disabled = false;
      }
    }),
  );
}
async function payable(id) {
  const c = findCase(id),
    info = await api("cases/" + id + "/payable"),
    active = info.current;
  const history = info.cycles.length
    ? '<details class="form-section"><summary class="small muted">提醒历史（' +
      info.cycles.length +
      "）</summary>" +
      [...info.cycles]
        .reverse()
        .map(
          (r) =>
            '<div class="entry-row"><div><strong>' +
            money(r.amount) +
            " · " +
            (r.status === "active" ? "待开票" : "已完成") +
            '</strong><p class="pre">' +
            esc(r.note) +
            "</p><small>" +
            time(r.started_at) +
            (r.completed_at ? " · 完成于 " + time(r.completed_at) : "") +
            "</small></div></div>",
        )
        .join("") +
      "</details>"
    : "";
  if (active)
    form(
      "待开票 · " + labelCase(c),
      '<div class="notice-box">完成提醒只改变提醒状态，不会自动增加开票或收款金额。</div><h2>' +
        money(active.amount) +
        '</h2><p class="pre small">' +
        esc(active.note || "未填写备注") +
        '</p><p class="hint">标记于 ' +
        time(active.started_at) +
        "</p>" +
        history,
      async () => {
        await api(
          "cases/" + id + "/payable/" + active.id + "/complete",
          "POST",
          {},
        );
        closeModal();
        await refresh();
        notice("本次提醒已完成");
      },
      "完成本次提醒",
    );
  else
    form(
      "标记待开票 · " + labelCase(c),
      '<p class="hint">记录已经达到的付款节点；这不会自动计入应收、开票或收款。</p>' +
        input("amount", "本次应付金额（元，可不填）", "", "number") +
        textArea("note", "付款节点 / 备注") +
        history,
      async (f) => {
        await api("cases/" + id + "/payable", "POST", {
          ...values(f),
          request_id: crypto.randomUUID(),
        });
        closeModal();
        await refresh();
        notice("已标记待开票");
      },
      "标记待开票",
    );
}
async function deleteCase(id) {
  const c = findCase(id);
  form(
    "删除案件",
    '<div class="notice-box">将删除该案件及其收款流水、进展和提醒。如需保留当前数据，请先在“设置与备份”手动导出完整备份。</div><p>确认删除「' +
      esc(labelCase(c)) +
      "」？</p>",
    async () => {
      await api("cases/" + id, "DELETE", { revision: c.revision });
      closeModal();
      await refresh();
      notice("案件已删除");
    },
    "确认删除",
  );
}
async function deleteCollection(id, receipt) {
  form(
    "删除收款流水",
    "<p>删除后会相应减少该案件的累计已收款。如需保留当前数据，请先手动导出完整备份。</p>",
    async () => {
      await api("cases/" + id + "/collections/" + receipt, "DELETE", {});
      closeModal();
      await refresh();
      await openDetail(id);
      notice("收款流水已删除");
    },
    "确认删除",
  );
}
async function getTemplates() {
  if (!templates) {
    const res = await api("templates");
    templates = res.templates;
    combinedTemplate = res.combined || null;
  }
  return templates;
}
function saveWorkbook(wb, name) {
  XLSX.writeFile(wb, name, { bookType: "xlsx" });
}
async function exportLedger(all = false) {
  const list = all ? data.cases : filteredCases();
  if (!list.length) throw Error("没有可导出的案件");
  const response = await api("cases/export-ledger", "POST", {
      ids: list.map((c) => c.id),
    }),
    wb = XLSX.utils.book_new();
  for (const sheet of response.sheets) {
    const ws = XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows]);
    ws["!cols"] = sheet.headers.map((h) => ({
      wch: [
        "客户",
        "原告",
        "被告",
        "第三人",
        "对方当事人",
        "费用说明",
        "项目名称",
      ].includes(h)
        ? 30
        : 18,
    }));
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  saveWorkbook(wb, "衡账-案件台账-" + today() + ".xlsx");
  notice("已生成 " + response.total + " 件案件的台账");
}
async function importDialog() {
  const specs = await getTemplates();
  const combinedHtml = combinedTemplate
    ? '<div class="setting-row setting-row-combined"><div><strong>' +
      esc(combinedTemplate.name) +
      "（顾问 + 专项 + 诉讼）</strong><p>" +
      combinedTemplate.fields.length +
      ' 个字段 · 一张表汇总导入三类案件，按列分组着色并严格校验专属字段；同样兼容衡账网络版综合模板</p></div><div class="page-actions"><button data-action="download-combined">下载综合模板</button><button class="primary" data-action="choose-import" data-track="combined">选择综合文件</button></div></div>'
    : "";
  openModal(
    "导入 Excel 台账",
    '<p class="hint">可使用「综合案件模板」一张表汇总导入顾问、专项、诉讼案件，也可按单一案件类型分别下载模板导入。相同内部案号会合并更新非空字段；没有内部案号的记录会新建。</p><div class="notice-box">先预览再导入。需要保留导入前的数据时，可先在“设置与备份”手动导出备份。Excel 导出表也可重新导入；仅读取第一张工作表。金额计算方式为“自动”时忽略金额列并恢复自动计算；要登记固定金额，请将计算方式改为“手填”并填写金额。</div>' +
      combinedHtml +
      Object.entries(specs)
        .map(
          ([track, spec]) =>
            '<div class="setting-row"><div><strong>' +
            spec.name +
            "</strong><p>" +
            spec.fields.length +
            ' 个字段 · 承办、协办姓名可自由填写</p></div><div class="page-actions"><button data-action="template" data-track="' +
            track +
            '">下载模板</button><button class="primary" data-action="choose-import" data-track="' +
            track +
            '">选择文件</button></div></div>',
        )
        .join(""),
  );
}
async function downloadTemplate(track) {
  const spec = (await getTemplates())[track],
    wb = XLSX.utils.book_new(),
    ws = XLSX.utils.aoa_to_sheet([spec.fields.map((f) => f.label)]);
  ws["!cols"] = spec.fields.map(() => ({ wch: 22 }));
  for (let i = 0; i < spec.fields.length; i++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c: i })];
    cell.c = [{ a: "衡账", t: spec.fields[i].note }];
  }
  XLSX.utils.book_append_sheet(wb, ws, spec.name);
  const guide = XLSX.utils.aoa_to_sheet([
    ["填写方法", "第一张工作表第 2 行起填写，一行一个案件，保留表头。"],
    ["匹配规则", "内部案号唯一时合并，非空字段更新；无案号时新建。"],
    ["类型", spec.label],
    ["字段", "填写要求"],
    ...spec.fields.map((f) => [f.label, f.note]),
  ]);
  guide["!cols"] = [{ wch: 20 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(wb, guide, "填写说明");
  saveWorkbook(wb, spec.file);
}
$("#import-file").onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    if (file.size > 30 * 1024 * 1024) throw Error("Excel 文件不能超过 30 MB");
    const wb = XLSX.read(await file.arrayBuffer(), {
        type: "array",
        cellDates: true,
      }),
      sheet = wb.Sheets[wb.SheetNames[0]],
      grid = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: true,
      });
    const specs = await getTemplates(),
      aliases = {};
    for (const spec of Object.values(specs))
      for (const f of spec.fields) aliases[f.label] = f.key;
    if (combinedTemplate?.fields)
      for (const f of combinedTemplate.fields) aliases[f.label] = f.key;
    Object.assign(aliases, {
      合同金额: "contract_amount",
      累计已收款: "collected_amount",
      已收律师费: "collected_amount",
      开票未付金额: "invoiced_unpaid",
      业务线: "track",
      "案件 / 项目名称": "name",
      "客户 / 当事人": "client",
      签约律师费: "contract_amount",
      费用说明: "fee_note",
      服务阶段: "service_stages",
      "服务阶段（仅诉讼）": "service_stages",
      "服务期限（仅顾问）": "service_period",
    });
    const headers = (grid.shift() || []).map((h) => String(h).trim());
    if (!headers.some((h) => aliases[h] && aliases[h] !== "track"))
      throw Error("未识别到台账表头，请使用导入模板");
    const isCombined =
      importTrack === "combined" ||
      headers.some((h) => /（仅(?:顾问|专项|诉讼)）/.test(h));
    const rows = grid.map((cells) => {
      const row = isCombined ? { require_track: true } : { track: importTrack };
      headers.forEach((label, i) => {
        const key = aliases[label];
        if (!key) return;
        let v = cells[i] ?? "";
        if (v instanceof Date)
          v = [
            v.getFullYear(),
            String(v.getMonth() + 1).padStart(2, "0"),
            String(v.getDate()).padStart(2, "0"),
          ].join("-");
        if (key === "track" && !v) return;
        row[key] = v;
      });
      return row;
    });
    const preview = await api("cases/import-preview", "POST", { rows });
    const trackCounts = {};
    for (const rec of preview.records || [])
      trackCounts[rec.track] = (trackCounts[rec.track] || 0) + 1;
    const trackSummary = Object.entries(trackCounts)
      .map(([t, n]) => (data.tracks[t] || t) + " " + n + " 件")
      .join(" · ");
    form(
      "预览导入 · " + file.name,
      '<div class="preview-counts"><div><strong>' +
        preview.added +
        "</strong>新增案件</div><div><strong>" +
        preview.merged +
        "</strong>合并行数</div><div><strong>" +
        preview.incomplete +
        '</strong>内部案号待补充</div></div>' +
        (trackSummary
          ? '<p class="hint">涉及业务线：' + esc(trackSummary) + "</p>"
          : "") +
        '<p class="hint">合并以内部案号为准，空白字段保留原值；金额计算方式为“自动”时恢复自动计算。以下展示前 20 个发生变化的案件。</p><div class="table-wrap"><table><thead><tr><th>内部案号</th><th>类型</th><th>客户</th><th>签约律师费</th></tr></thead><tbody>' +
        preview.records
          .slice(0, 20)
          .map(
            (c) =>
              "<tr><td>" +
              esc(c.case_no || "待补充") +
              "</td><td>" +
              esc(data.tracks[c.track]) +
              "</td><td>" +
              esc(c.client) +
              '</td><td class="num">' +
              money(c.contract_amount) +
              "</td></tr>",
          )
          .join("") +
        "</tbody></table></div>",
      async () => {
        const result = await api("cases/import", "POST", {
          rows,
          preview_id: preview.preview_id,
        });
        closeModal();
        filter = { track: "", q: "", field: "all", status: "", finance: "" };
        await refresh();
        await navigate("cases");
        notice(
          "导入完成：新增 " +
            result.added +
            " 件，合并 " +
            result.merged +
            " 行",
        );
      },
      "确认导入",
    );
  } catch (error) {
    notice(error.message);
  }
};
async function backupPreview(payload) {
  const result = await api("backups/preview", "POST", payload);
  form(
    "预览备份与恢复",
    '<p class="hint">备份时间：' +
      time(result.created_at) +
      '</p><div class="preview-counts">' +
      [
        ["案件", result.cases],
        ["收款流水", result.collections],
        ["进展记录", result.progress],
        ["提醒记录", result.reminders],
      ]
        .map(([k, v]) => "<div><strong>" + v + "</strong>" + k + "</div>")
        .join("") +
      '</div><div class="notice-box">确认后会用该备份整体替换当前 ' +
      result.current_cases +
      " 件案件及相关记录。系统会先保存恢复前的数据，供需要时恢复。</div>",
    async () => {
      await api("backups/restore", "POST", {
        ...payload,
        confirm: result.checksum,
        current_checksum: result.current_checksum,
      });
      closeModal();
      filter = { track: "", q: "", field: "all", status: "在办", finance: "" };
      await refresh();
      notice("备份已恢复，恢复前数据已另行备份");
    },
    "确认恢复并替换当前数据",
  );
}
$("#backup-file").onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    if (file.size > 64 * 1024 * 1024) throw Error("备份不能超过 64 MB");
    let backup;
    try {
      backup = JSON.parse(await file.text());
    } catch {
      throw Error("备份文件无法读取，请选择完整的 JSON 备份");
    }
    await backupPreview({ backup });
  } catch (error) {
    notice(error.message);
  }
};
const actions = {
  "reset-motto": async () => {
    await api("preferences", "PUT", { dashboard_motto: "" });
    await refresh();
    notice("已恢复每日金句");
  },
  refresh: async () => {
    await refresh();
    notice("已读取最新本机数据");
  },
  new: () => editor(),
  edit: (el) => editor(el.dataset.id),
  renew: (el) => editor(el.dataset.id, true),
  detail: (el) => openDetail(el.dataset.id),
  collection: (el) => collection(el.dataset.id),
  progress: (el) => progress(el.dataset.id),
  payable: (el) => payable(el.dataset.id),
  delete: (el) => deleteCase(el.dataset.id),
  "delete-collection": (el) =>
    deleteCollection(el.dataset.id, el.dataset.receipt),
  "fee-note": (el) => {
    const c = findCase(el.dataset.id);
    openModal("费用说明", '<p class="pre">' + esc(c.fee_note) + "</p>");
  },
  "fee-allocation": (el) =>
    openFeeAllocation(el.dataset.id || "", el.dataset.dir || "outbound"),
  "fee-history": (el) =>
    openFeeAllocationHistory(el.dataset.lawyer || "", el.dataset.dir || ""),
  "filter-lawyer": async (el) => {
    filter = {
      track: "",
      q: el.dataset.lawyer || "",
      field: "lawyer",
      status: "",
      finance: "",
    };
    await navigate("cases");
  },
  "filter-invoiced-unpaid": async () => {
    filter = {
      track: "",
      q: "",
      field: "all",
      status: "",
      finance: "invoiced_unpaid",
    };
    await navigate("cases");
  },
  "close-modal": closeModal,
  "reset-filter": () => {
    filter = { track: "", q: "", field: "all", status: "", finance: "" };
    renderCases();
  },
  export: () => exportLedger(),
  "export-all": () => exportLedger(true),
  import: importDialog,
  template: (el) => downloadTemplate(el.dataset.track),
  "download-combined": () => {
    const a = document.createElement("a");
    a.href = "/templates/all-cases-template.xlsx";
    a.download = combinedTemplate?.file || "all-cases-template.xlsx";
    a.click();
  },
  "choose-import": (el) => {
    importTrack = el.dataset.track;
    $("#import-file").click();
  },
  "backup-export": () => {
    const a = document.createElement("a");
    a.href = "/api/backups/export";
    a.download = "衡账-完整备份-" + today() + ".json";
    a.click();
    setTimeout(async () => {
      if (view === "settings") {
        backupInfo = await api("backups");
        renderSettings();
      }
    }, 1000);
  },
  "backup-import": () => $("#backup-file").click(),
  "backup-restore": (el) => backupPreview({ id: el.dataset.id }),
  "reveal-data": async () => {
    if (window.hengzhang) await window.hengzhang.revealData();
  },
};
document.addEventListener("click", async (e) => {
  const homepage = e.target.closest("[data-homepage]");
  if (homepage && window.hengzhang) {
    e.preventDefault();
    try {
      await window.hengzhang.openHomepage();
    } catch (error) {
      notice(error.message);
    }
    return;
  }
  const el = e.target.closest("button");
  if (!el || el.disabled) return;
  try {
    if (el.dataset.nav) await navigate(el.dataset.nav);
    else if (el.hasAttribute("data-track") && !el.dataset.action) {
      filter.track = el.dataset.track;
      renderCases();
    } else if (el.dataset.action && actions[el.dataset.action])
      await actions[el.dataset.action](el);
  } catch (error) {
    notice(error.message);
  }
});
document.addEventListener("change", async (e) => {
  const el = e.target,
    id = el.dataset.status || el.dataset.stage;
  if (!id) return;
  el.disabled = true;
  try {
    const c = findCase(id);
    await api("cases/" + id, "PUT", {
      revision: c.revision,
      [el.dataset.status ? "status" : "case_stage"]: el.value,
    });
    await refresh();
    notice("案件已保存");
  } catch (error) {
    notice(error.message);
    await refresh();
  } finally {
    el.disabled = false;
  }
});
setInterval(refreshDailyMotto, 60000);
document.addEventListener("visibilitychange", refreshDailyMotto);
window.addEventListener("focus", refreshDailyMotto);
refresh().catch((error) => {
  $("#content").innerHTML =
    '<div class="panel empty"><strong>未能读取本地数据</strong><p>' +
    esc(error.message) +
    '</p><button class="primary" data-action="refresh">重新读取</button></div>';
});
