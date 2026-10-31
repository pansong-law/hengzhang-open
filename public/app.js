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
    '<div class="page-heading"><div><h1>案件台账</h1><p>客户、案件进展与律师费，放在一起查看。</p></div><div class="page-actions"><button data-action="import">导入台账</button><button data-action="export">导出当前筛选</button><button class="primary" data-action="new">＋ 新建案件</button></div></div>' +
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
    '</section><p class="print-note">签约律师费按台账登记金额汇总；费用说明中的计算条件不会自动折算为应收金额。</p></section>'
  );
}
function renderSettings() {
  $("#content").innerHTML =
    '<div class="page-heading"><div><h1>设置与备份</h1><p>保存一份完整备份，换电脑或需要时可以恢复。</p></div></div><section id="software-updates" class="panel">' +
    (window.HzUpdates?.panel() || "") +
    '</section><section class="panel"><h2>工作台格言</h2><form id="motto-form"><label>自定义格言<input name="dashboard_motto" maxlength="60" value="' +
    esc(data.preferences.dashboard_motto) +
    '"></label><p class="hint">最多 60 字，留空保存可恢复默认格言。</p><p class="form-error" role="alert" hidden></p><div class="page-actions"><button type="button" data-action="reset-motto">恢复默认</button><button class="primary" type="submit">保存格言</button></div></form></section><section class="panel"><h2>数据备份</h2><div class="setting-row"><div><strong>导出完整备份</strong><p>包含全部案件、收款流水、进展和提醒。可保存到移动硬盘或其他设备。</p></div><button class="primary" data-action="backup-export">导出备份</button></div><div class="setting-row"><div><strong>从备份文件恢复</strong><p>先预览文件内容，再确认替换当前数据；替换前会自动保留一份备份。</p></div><button data-action="backup-import">选择备份文件</button></div><div class="setting-row"><div><strong>自动备份</strong><p>启动时及使用中定期保留备份；导入、删除、恢复前另做备份。保留最近 30 份，均位于本机。</p></div>' +
    badge("已开启", "good") +
    '</div></section><section class="panel"><div class="panel-head"><h2>最近的本机备份</h2><span class="small muted">' +
    (backupInfo?.backups.length || 0) +
    " / 30 份</span></div>" +
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
      "签约律师费（元，根据风险费成就情况手动更新）",
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
}
async function openDetail(id) {
  const c = (await api("cases/" + id)).case,
    f = c.fee_summary;
  const fields = [
    ["内部案号", c.case_no],
    ["案件类型", data.tracks[c.track]],
    ["客户", c.client],
    ["客户联系人", c.client_contact],
    ["项目名称", c.name],
    ["案由", c.case_type],
    ["原告", c.plaintiff],
    ["被告", c.defendant],
    ["第三人", c.third_party],
    ["对方当事人", c.opponent],
    ["承办律师", c.lawyer],
    ["协办律师", c.co_lawyers.join("、")],
    ["当前案件阶段", c.case_stage],
    ["服务期限 / 阶段", c.service_period],
    ["签约日期", c.sign_date],
    ["结案日期", c.close_date],
    ["结案方式", c.close_method],
  ];
  openModal(
    "案件详情",
    '<div class="detail-title"><h3>' +
      esc(labelCase(c)) +
      "</h3>" +
      badge(data.tracks[c.track], "blue") +
      badge(c.status, c.status === "在办" ? "good" : "") +
      '</div><div class="detail-summary">' +
      [
        ["签约律师费", f.signed],
        ["已开票", f.invoice],
        ["已收款", f.received],
        ["未付金额", f.unpaid],
        ["开票未付金额", f.invoiced_unpaid],
      ]
        .map(
          ([k, v]) =>
            "<div><span>" +
            k +
            "</span><strong>" +
            money(v) +
            "</strong></div>",
        )
        .join("") +
      '</div><div class="detail-actions"><button class="primary" data-action="edit" data-id="' +
      id +
      '">编辑案件</button><button data-action="collection" data-id="' +
      id +
      '">登记到账</button><button data-action="payable" data-id="' +
      id +
      '">' +
      (c.payable.current ? "查看待开票" : "标记待开票") +
      '</button><button data-action="progress" data-id="' +
      id +
      '">记录进展</button>' +
      (c.track === "advisory"
        ? '<button data-action="renew" data-id="' + id + '">续签</button>'
        : "") +
      '<button class="danger" data-action="delete" data-id="' +
      id +
      '">删除案件</button></div><dl class="detail-grid">' +
      fields
        .filter(([, v]) => v)
        .map(([k, v]) => "<div><dt>" + k + "</dt><dd>" + esc(v) + "</dd></div>")
        .join("") +
      "</dl>" +
      (c.fee_note
        ? '<h3>费用说明</h3><p class="pre small">' + esc(c.fee_note) + "</p>"
        : "") +
      (c.notes
        ? '<h3>备注</h3><p class="pre small">' + esc(c.notes) + "</p>"
        : "") +
      '<div class="form-section"><h3>收款流水</h3>' +
      (c.opening_received
        ? '<p class="hint">期初或台账直接登记已收款：' +
          money(c.opening_received) +
          "（不含下列流水）</p>"
        : "") +
      (c.collections.length
        ? "<table><thead><tr><th>到账日期</th><th>金额</th><th>备注</th><th></th></tr></thead><tbody>" +
          c.collections
            .map(
              (r) =>
                "<tr><td>" +
                esc(r.date) +
                '</td><td class="num">' +
                money(r.amount) +
                '</td><td class="pre">' +
                esc(r.note) +
                '</td><td><button class="text-button danger" data-action="delete-collection" data-id="' +
                id +
                '" data-receipt="' +
                esc(r.id) +
                '">删除</button></td></tr>',
            )
            .join("") +
          "</tbody></table>"
        : '<p class="hint">暂无逐笔收款记录。</p>') +
      '</div><div class="form-section"><h3>案件进展</h3>' +
      (c.progress.length
        ? '<div class="timeline">' +
          [...c.progress]
            .reverse()
            .map(
              (r) =>
                "<article><small>" +
                time(r.at) +
                "</small><p>" +
                esc(r.text) +
                "</p></article>",
            )
            .join("") +
          "</div>"
        : '<p class="hint">暂无进展记录。</p>') +
      "</div>",
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
function progress(id) {
  const c = findCase(id);
  form(
    "记录进展 · " + labelCase(c),
    textArea("text", "本次案件进展", "", 'class="full"'),
    async (f) => {
      await api("cases/" + id + "/progress", "POST", values(f));
      closeModal();
      await refresh();
      notice("进展已保存");
    },
    "保存进展",
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
    '<div class="notice-box">将删除该案件及其收款流水、进展和提醒。系统会先生成一份完整备份，需要时可整体恢复。</div><p>确认删除「' +
      esc(labelCase(c)) +
      "」？</p>",
    async () => {
      await api("cases/" + id, "DELETE", { revision: c.revision });
      closeModal();
      await refresh();
      notice("案件已删除，删除前备份已保留");
    },
    "确认删除",
  );
}
async function deleteCollection(id, receipt) {
  form(
    "删除收款流水",
    "<p>删除后会相应减少该案件的累计已收款。删除前会自动备份。</p>",
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
  return templates || (templates = (await api("templates")).templates);
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
  openModal(
    "导入 Excel 台账",
    '<p class="hint">选择案件类型，下载模板填写后导入。相同内部案号会合并更新非空字段；没有内部案号的记录会新建。</p><div class="notice-box">先预览再导入。导入前会自动备份。Excel 导出表也可重新导入；仅读取第一张工作表。</div>' +
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
    });
    const headers = (grid.shift() || []).map((h) => String(h).trim());
    if (!headers.some((h) => aliases[h] && aliases[h] !== "track"))
      throw Error("未识别到台账表头，请使用导入模板");
    const rows = grid.map((cells) => {
      const row = { track: importTrack };
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
    form(
      "预览导入 · " + file.name,
      '<div class="preview-counts"><div><strong>' +
        preview.added +
        "</strong>新增案件</div><div><strong>" +
        preview.merged +
        "</strong>合并行数</div><div><strong>" +
        preview.incomplete +
        '</strong>内部案号待补充</div></div><p class="hint">合并以内部案号为准，空白字段保留原值。以下展示前 20 个发生变化的案件。</p><div class="table-wrap"><table><thead><tr><th>内部案号</th><th>类型</th><th>客户</th><th>签约律师费</th></tr></thead><tbody>' +
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
    notice("已恢复默认格言");
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
  "close-modal": closeModal,
  "reset-filter": () => {
    filter = { track: "", q: "", field: "all", status: "", finance: "" };
    renderCases();
  },
  export: () => exportLedger(),
  "export-all": () => exportLedger(true),
  import: importDialog,
  template: (el) => downloadTemplate(el.dataset.track),
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
refresh().catch((error) => {
  $("#content").innerHTML =
    '<div class="panel empty"><strong>未能读取本地数据</strong><p>' +
    esc(error.message) +
    '</p><button class="primary" data-action="refresh">重新读取</button></div>';
});
