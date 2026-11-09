/* Update information is isolated from the case workspace and rendered as text. */
(() => {
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const bridge = window.hengzhang;
  let state = null,
    checking = false;
  const toast = (message) => {
    const box = $("#notice");
    box.textContent = message;
    box.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (box.hidden = true), 5000);
  };
  function formatBytes(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return "0 B";
    if (n < 1024) return Math.round(n) + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
  }
  function formatSpeed(bytesPerSecond, status) {
    if (status === "downloaded") return "已完成";
    const n = Number(bytesPerSecond);
    if (!Number.isFinite(n) || n <= 0) return "0 B/s";
    return formatBytes(n) + "/s";
  }
  function formatRemaining(download) {
    if (download?.status === "downloaded") return "0 秒";
    if (download?.status !== "downloading") return "—";
    const s = download.remainingSeconds;
    if (!Number.isFinite(s) || s === null || s < 0) return "计算中...";
    if (s < 60) return Math.max(1, Math.round(s)) + " 秒";
    const m = Math.floor(s / 60),
      rem = Math.round(s % 60);
    return rem ? m + " 分 " + rem + " 秒" : m + " 分";
  }
  function panel() {
    if (!bridge?.checkUpdates)
      return '<h2>软件更新</h2><p class="hint">请在 Mac App 中检查更新。</p>';
    const busy = checking || state?.status === "checking",
      dl = state?.download || {},
      statusText = dl.message || state?.message || "正在读取更新设置…";
    return (
      '<div class="panel-head"><div><h2>软件更新</h2><p class="hint">当前版本 ' +
      esc(state?.currentVersion || "—") +
      '</p></div><button data-update="check"' +
      (busy ? " disabled" : "") +
      ">" +
      (busy ? "正在检查…" : "检查更新") +
      '</button></div><p class="update-result" role="status">' +
      esc(statusText) +
      "</p>" +
      (state?.available
        ? '<div class="page-actions"><button class="primary" data-update="details">' +
          (dl.status === "downloading"
            ? "查看下载进度（" + (Number(dl.percent) || 0) + "%）"
            : "查看 " + esc(state.latestVersion) + " 更新") +
          "</button>" +
          (dl.status === "downloaded"
            ? '<button data-update="install">打开安装包</button>'
            : "") +
          "</div>"
        : "") +
      '<label class="update-toggle"><input id="automatic-updates" type="checkbox"' +
      (state?.automatic !== false ? " checked" : "") +
      '>每 48 小时自动检查新版本</label><p class="hint">距上次自动检查满 48 小时后检查，重启应用不会重新计时。只检查版本信息，不上传案件。下载新版后，退出衡账并替换 App 即可。</p>' +
      (state?.lastCheckedAt
        ? '<p class="hint">上次成功检查：' +
          esc(
            new Date(state.lastCheckedAt).toLocaleString("zh-CN", {
              hour12: false,
            }),
          ) +
          "</p>"
        : "")
    );
  }
  function modalBody() {
    const dl = state?.download || {},
      status = dl.status || "idle",
      percent = Math.max(0, Math.min(100, Number(dl.percent) || 0)),
      title =
        status === "downloading"
          ? "正在下载更新"
          : status === "downloaded"
            ? "更新下载完成"
            : status === "error"
              ? "更新下载未完成"
              : "应用内下载更新",
      icon =
        status === "downloading"
          ? '<span class="update-spinner" aria-hidden="true"></span>'
          : status === "downloaded"
            ? '<span aria-hidden="true">✓</span>'
            : status === "error"
              ? '<span aria-hidden="true">!</span>'
              : '<span aria-hidden="true">↓</span>',
      hint =
        status === "downloading"
          ? "下载完成后可打开安装包。您可以继续使用衡账。"
          : status === "downloaded"
            ? "安装包已通过 SHA-256 校验。打开安装包后，请退出衡账并替换 App。"
            : status === "error"
              ? dl.message || "下载失败，请检查网络后重试。"
              : "在衡账内直接下载 DMG 安装包，下载过程中可继续使用衡账；更新前建议先导出完整备份。",
      actions =
        status === "downloading"
          ? '<button class="primary" data-update="later">最小化</button>'
          : status === "downloaded"
            ? '<button data-update="later">稍后安装</button><button data-update="release-page">前往发布页</button><button class="primary" data-update="install">打开安装包</button>'
            : status === "error"
              ? '<button data-update="later">稍后再说</button><button data-update="release-page">前往发布页</button><button class="primary" data-update="download">重新下载</button>'
              : '<button data-update="later">稍后再说</button><button data-update="release-page">前往发布页</button><button class="primary" data-update="download">立即下载</button>';
    return (
      '<div class="update-modal" data-update-modal>' +
      (state.status === "error"
        ? '<p class="notice-box">本次检查未成功，以下为此前已获取的版本信息。</p>'
        : "") +
      '<div class="update-download-card" data-download-status="' +
      esc(status) +
      '"><div class="update-download-head"><div class="update-download-icon" data-status="' +
      esc(status) +
      '">' +
      icon +
      "</div><div><strong>" +
      esc(title) +
      '</strong><span>版本 ' +
      esc(state.latestVersion) +
      "（当前版本 " +
      esc(state.currentVersion) +
      '）</span></div></div><div class="update-download-body"><div class="update-progress-meta"><strong class="update-percent">' +
      percent +
      '%</strong><span class="update-bytes">' +
      esc(formatBytes(dl.bytes || 0)) +
      " / " +
      esc(formatBytes(dl.totalBytes || 0)) +
      '</span></div><div class="update-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
      percent +
      '"><div class="update-progress-fill" style="width:' +
      percent +
      '%"></div></div><div class="update-stats-grid"><div><span>下载速度</span><strong>' +
      esc(formatSpeed(dl.bytesPerSecond, status)) +
      "</strong></div><div><span>剩余时间</span><strong>" +
      esc(formatRemaining(dl)) +
      '</strong></div></div><p class="hint update-download-hint">' +
      esc(hint) +
      '</p></div></div><h3>更新说明</h3><div class="pre update-notes">' +
      esc(state.notes) +
      '</div><div class="form-actions">' +
      actions +
      "</div></div>"
    );
  }
  function paint() {
    const section = $("#software-updates");
    if (section) section.innerHTML = panel();
    const modal = $("#modal");
    if (modal?.open && $("#modal-body [data-update-modal]") && state?.available) {
      $("#modal-title").textContent = "发现新版本 " + state.latestVersion;
      $("#modal-body").innerHTML = modalBody();
    }
    const banner = $("#update-banner");
    if (!banner) return;
    const dl = state?.download || {};
    banner.hidden =
      !state?.available ||
      (state.dismissed &&
        dl.status !== "downloading" &&
        dl.status !== "downloaded");
    if (!banner.hidden) {
      if (dl.status === "downloading") {
        const percent = Math.max(0, Math.min(100, Number(dl.percent) || 0));
        banner.innerHTML =
          "<div><strong>正在下载新版本 " +
          esc(state.latestVersion) +
          "（" +
          percent +
          "%）</strong><span>" +
          esc(formatBytes(dl.bytes || 0)) +
          " / " +
          esc(formatBytes(dl.totalBytes || 0)) +
          " · 速度 " +
          esc(formatSpeed(dl.bytesPerSecond, "downloading")) +
          " · 剩余 " +
          esc(formatRemaining(dl)) +
          '</span></div><div class="page-actions"><button class="primary" data-update="details">查看进度</button></div>';
      } else if (dl.status === "downloaded") {
        banner.innerHTML =
          "<div><strong>新版本 " +
          esc(state.latestVersion) +
          ' 已下载完成</strong><span>打开安装包后，退出衡账并替换 App 即可完成更新。</span></div><div class="page-actions"><button data-update="details">查看说明</button><button class="primary" data-update="install">打开安装包</button></div>';
      } else {
        banner.innerHTML =
          "<div><strong>发现新版本 " +
          esc(state.latestVersion) +
          '</strong><span>查看本次更新，可在应用内直接下载安装包。</span></div><div class="page-actions"><button class="primary" data-update="details">查看更新</button><button class="text-button" data-update="dismiss">暂不提醒此版本</button></div>';
      }
    }
  }
  function adopt(value) {
    state = value;
    paint();
    return value;
  }
  function show() {
    if (!state?.available) {
      toast(state?.message || "请先检查更新");
      return;
    }
    const modal = $("#modal");
    if (modal.open && !$("#modal-body [data-update-modal]")) {
      toast(
        "发现新版本 " + state.latestVersion + "，完成当前操作后可在顶部查看。",
      );
      return;
    }
    $("#modal-title").textContent = "发现新版本 " + state.latestVersion;
    $("#modal-body").innerHTML = modalBody();
    if (!modal.open) modal.showModal();
  }
  async function check() {
    if (!bridge?.checkUpdates) return;
    checking = true;
    paint();
    try {
      adopt(await bridge.checkUpdates());
      show();
    } catch {
      toast("暂时无法检查更新，请稍后重试。");
    } finally {
      checking = false;
      paint();
    }
  }
  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-update]");
    if (!button || button.disabled) return;
    try {
      switch (button.dataset.update) {
        case "check":
          await check();
          break;
        case "details":
          show();
          break;
        case "dismiss":
          adopt(await bridge.dismissUpdate());
          break;
        case "download":
          adopt(
            await (bridge.downloadUpdate
              ? bridge.downloadUpdate()
              : bridge.openUpdateDownload()),
          );
          if (state?.download?.status === "error" && state.download.message)
            toast(state.download.message);
          break;
        case "install":
          await bridge.openUpdateInstaller();
          toast("已打开安装包，请退出衡账并将新版本拖入“应用程序”。");
          break;
        case "release-page":
          await bridge.openUpdateReleasePage();
          break;
        case "later":
          $("#modal").close();
          break;
      }
    } catch {
      toast("更新操作未完成，请稍后重试。");
    }
  });
  document.addEventListener("change", async (event) => {
    if (event.target.id !== "automatic-updates") return;
    try {
      adopt(await bridge.setAutomaticUpdates(event.target.checked));
    } catch {
      toast("未能保存更新设置");
      paint();
    }
  });
  window.HzUpdates = Object.freeze({ panel, check, show });
  if (bridge?.updateStatus) {
    bridge.onUpdateState(adopt);
    bridge.onShowUpdates(async () => {
      adopt(await bridge.updateStatus());
      show();
    });
    bridge
      .updateStatus()
      .then(adopt)
      .catch(() => {});
  }
})();
