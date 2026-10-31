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
  function panel() {
    if (!bridge?.checkUpdates)
      return '<h2>软件更新</h2><p class="hint">请在 Mac App 中检查更新。</p>';
    const busy = checking || state?.status === "checking";
    return (
      '<div class="panel-head"><div><h2>软件更新</h2><p class="hint">当前版本 ' +
      esc(state?.currentVersion || "—") +
      '</p></div><button data-update="check"' +
      (busy ? " disabled" : "") +
      ">" +
      (busy ? "正在检查…" : "检查更新") +
      '</button></div><p class="update-result" role="status">' +
      esc(state?.message || "正在读取更新设置…") +
      "</p>" +
      (state?.available
        ? '<button class="primary" data-update="details">查看 ' +
          esc(state.latestVersion) +
          " 更新</button>"
        : "") +
      '<label class="update-toggle"><input id="automatic-updates" type="checkbox"' +
      (state?.automatic !== false ? " checked" : "") +
      '>启动后自动检查新版本</label><p class="hint">只检查版本信息，不上传案件。下载新版后，退出衡账并替换 App 即可。</p>' +
      (state?.lastCheckedAt
        ? '<p class="hint">上次成功检查：' +
          esc(
            new Date(state.lastCheckedAt).toLocaleString("zh-CN", {
              hour12: false,
            }),
          ) +
          "</p>"
        : "") +
      '<details class="update-access"><summary>私有版本访问</summary><p class="hint">私有测试阶段需要仓库读取权限。已登录本机 GitHub CLI 时会自动使用已有授权；也可单独保存仅有本仓库内容读取权限的访问令牌。凭据在本机加密保存。</p><button data-update="access">' +
      (state?.storedAccess ? "修改访问授权" : "设置访问授权") +
      "</button>" +
      (state?.storedAccess
        ? ' <button class="text-button" data-update="clear-access">移除已保存授权</button>'
        : "") +
      "</details>"
    );
  }
  function paint() {
    const section = $("#software-updates");
    if (section) section.innerHTML = panel();
    const banner = $("#update-banner");
    if (!banner) return;
    banner.hidden = !state?.available || state.dismissed;
    if (!banner.hidden)
      banner.innerHTML =
        "<div><strong>发现新版本 " +
        esc(state.latestVersion) +
        '</strong><span>查看本次更新，选择合适的时间安装。</span></div><div class="page-actions"><button class="primary" data-update="details">查看更新</button><button class="text-button" data-update="dismiss">暂不提醒此版本</button></div>';
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
    if ($("#modal").open) {
      toast(
        "发现新版本 " + state.latestVersion + "，完成当前操作后可在顶部查看。",
      );
      return;
    }
    $("#modal-title").textContent = "发现新版本 " + state.latestVersion;
    $("#modal-body").innerHTML =
      (state.status === "error"
        ? '<p class="notice-box">本次检查未成功，以下为此前已获取的版本信息。</p>'
        : "") +
      '<p class="hint">当前版本 ' +
      esc(state.currentVersion) +
      " → 新版本 " +
      esc(state.latestVersion) +
      '</p><h3>更新说明</h3><div class="pre update-notes">' +
      esc(state.notes) +
      '</div><p class="hint">前往 GitHub 发布页下载 DMG。私有测试阶段，请用有仓库权限的 GitHub 账号打开下载页。更新前建议导出完整备份，退出衡账后替换 App。</p><div class="form-actions"><button data-update="later">稍后再说</button><button class="primary" data-update="download">前往下载页</button></div>';
    $("#modal").showModal();
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
  function access() {
    if ($("#modal").open) return;
    $("#modal-title").textContent = "私有版本访问授权";
    $("#modal-body").innerHTML =
      '<form id="update-access-form"><p class="hint">填写有本仓库内容读取权限的 GitHub 访问令牌。令牌仅用于读取版本信息，不会写入案件备份或公开代码。</p><label>GitHub 访问令牌<input type="password" name="token" autocomplete="off" required maxlength="512"></label><p class="form-error" role="alert" hidden></p><div class="form-actions"><button type="button" data-update="later">取消</button><button class="primary" type="submit">保存并检查更新</button></div></form>';
    $("#modal").showModal();
    $("#update-access-form").onsubmit = async (event) => {
      event.preventDefault();
      const form = event.currentTarget,
        button = form.querySelector("[type=submit]"),
        error = form.querySelector(".form-error"),
        token = form.elements.token.value.trim();
      form.elements.token.value = "";
      button.disabled = true;
      error.hidden = true;
      try {
        adopt(await bridge.setUpdateAccess(token));
        $("#modal").close();
        await check();
      } catch {
        error.textContent = "未能保存授权，请核对令牌和本机安全存储后重试。";
        error.hidden = false;
      } finally {
        button.disabled = false;
      }
    };
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
          await bridge.openUpdateDownload();
          break;
        case "later":
          $("#modal").close();
          break;
        case "access":
          access();
          break;
        case "clear-access":
          adopt(await bridge.clearUpdateAccess());
          toast("已移除单独保存的访问授权");
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
