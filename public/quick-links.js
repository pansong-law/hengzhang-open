"use strict";
(() => {
  const ACCENTS = [
    { id: "blue", label: "深青蓝" },
    { id: "indigo", label: "靛青" },
    { id: "mint", label: "松石绿" },
    { id: "amber", label: "琥珀棕" },
    { id: "rose", label: "朱砂绛" },
    { id: "slate", label: "黛灰" },
  ];
  const FALLBACK_ITEMS = [
    { id: "preset-court-online", title: "人民法院在线服务", url: "https://splcgk.court.gov.cn/", domain: "splcgk.court.gov.cn", category: "诉讼审判", desc: "全国法院网上立案、电子送达、材料提交与审判流程公开查询", badge: "法", accent: "rose", pinned: false, editable: true },
    { id: "preset-wenshu", title: "中国裁判文书网", url: "https://wenshu.court.gov.cn/", domain: "wenshu.court.gov.cn", category: "法规案例", desc: "全国各级人民法院生效裁判文书全文检索与类案比对", badge: "书", accent: "blue", pinned: false, editable: true },
    { id: "preset-rmfyalk", title: "人民法院案例库", url: "https://rmfyalk.court.gov.cn/", domain: "rmfyalk.court.gov.cn", category: "法规案例", desc: "最高法指导性案例与入库参考案例官方权威检索平台", badge: "案", accent: "indigo", pinned: false, editable: true },
    { id: "preset-zxgk", title: "中国执行信息公开网", url: "https://zxgk.court.gov.cn/", domain: "zxgk.court.gov.cn", category: "主体核查", desc: "被执行人、失信被执行人、限制消费人员及终本案件核查", badge: "执", accent: "rose", pinned: false, editable: true },
    { id: "preset-gsxt", title: "国家企业信用信息公示系统", url: "https://www.gsxt.gov.cn/", domain: "gsxt.gov.cn", category: "主体核查", desc: "工商登记备案、股东出资、行政处罚与经营异常名录核验", badge: "企", accent: "mint", pinned: false, editable: true },
    { id: "preset-feishu", title: "飞书云文档", url: "https://www.feishu.cn/", domain: "feishu.cn", category: "团队办公", desc: "日常协同云文档、会议纪要与项目进度表", badge: "飞", accent: "mint", pinned: false, editable: true },
  ];

  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const isMac = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || "");
  const modSymbol = isMac ? "⌘" : "Ctrl+";
  const COMPASS_SVG =
    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6.3"/><polygon points="10.6,5.4 9.1,9.1 5.4,10.6 6.9,6.9" fill="currentColor" stroke="none"/></svg>';
  const SEARCH_SVG =
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="7" cy="7" r="4.8"/><line x1="10.6" y1="10.6" x2="14" y2="14"/></svg>';

  let payload = null;
  let loaded = false;
  let loading = false;
  let isOpen = false;
  let activeCategory = "all";
  let searchQuery = "";
  let activeIndex = 0;
  let editingItem = null;
  let creatingNew = false;
  let confirmDeleteId = "";
  let previousFocus = null;
  let toastTimer = null;
  let dragState = null;
  let suppressNextClick = false;
  let suppressClickTimer = null;
  let backdrop = null;

  async function requestQuickLinks(body) {
    const res = await fetch("/api/quick-links", {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "请求常用链接失败");
    return data;
  }

  function ensureData(force = false) {
    if (loading) return;
    if (loaded && !force) return;
    loading = true;
    requestQuickLinks()
      .then((data) => {
        payload = data;
        loaded = true;
        if (isOpen) renderBody();
      })
      .catch(() => {
        if (!payload) {
          payload = {
            items: FALLBACK_ITEMS,
            categories: ["诉讼审判", "法规案例", "主体核查", "团队办公"],
            pinned_ids: [],
            order_ids: [],
            has_custom_order: false,
            customized: false,
          };
        }
        if (isOpen) renderBody();
      })
      .finally(() => {
        loading = false;
      });
  }

  function mountTrigger() {
    if (document.getElementById("quick-links-trigger")) return;
    const header = document.querySelector(".desk > main > header");
    if (!header) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "quick-links-trigger";
    btn.className = "ql-trigger";
    btn.setAttribute("aria-haspopup", "dialog");
    btn.setAttribute("aria-expanded", "false");
    btn.title = "打开常用网址导航 (" + modSymbol + "K)";
    btn.innerHTML =
      COMPASS_SVG +
      '<span class="ql-trigger-label">常用网址</span><kbd class="ql-trigger-kbd">' +
      modSymbol +
      "K</kbd>";
    btn.addEventListener("click", () => toggleModal());

    const updates = header.querySelector(".header-updates");
    if (updates) updates.insertBefore(btn, updates.firstChild);
    else header.appendChild(btn);
  }

  function ensureModal() {
    if (backdrop) return backdrop;
    backdrop = document.createElement("div");
    backdrop.id = "quick-links-backdrop";
    backdrop.className = "ql-backdrop";
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <section class="ql-modal" role="dialog" aria-modal="true" aria-labelledby="ql-modal-title" tabindex="-1">
        <header class="ql-head">
          <div class="ql-brand">
            <span class="ql-brand-mark">${COMPASS_SVG}</span>
            <div>
              <span class="ql-eyebrow">QUICK LAUNCH · 应用内直达</span>
              <h2 id="ql-modal-title">办案常用网址</h2>
            </div>
            <span class="ql-count-pill" id="ql-total-pill">${FALLBACK_ITEMS.length} 个站点</span>
          </div>
          <div class="ql-head-actions">
            <button type="button" class="ql-reset-btn" id="ql-reset-order" hidden title="清除自定义拖拽排序，恢复默认顺序">恢复默认排序</button>
            <button type="button" class="ql-reset-btn" id="ql-reset-defaults" hidden>恢复默认预置</button>
            <button type="button" class="ql-add-btn" id="ql-open-add">＋ 添加网址</button>
            <button type="button" class="ql-close-btn" id="ql-close" aria-label="关闭常用网址面板">×</button>
          </div>
        </header>
        <div class="ql-search-wrap" id="ql-search-wrap">
          <span class="ql-search-icon">${SEARCH_SVG}</span>
          <input type="search" id="ql-search-input" class="ql-search-input" autocomplete="off" spellcheck="false" placeholder="搜索网站名称、用途、域名或分类…">
          <button type="button" id="ql-search-clear" class="ql-search-clear" hidden aria-label="清空搜索">清空</button>
        </div>
        <nav class="ql-cats" id="ql-cats" aria-label="网址分类"></nav>
        <div class="ql-toast" id="ql-toast" role="status" aria-live="polite" hidden></div>
        <div class="ql-content" id="ql-content"></div>
        <footer class="ql-foot">
          <div class="ql-foot-keys">
            <span><kbd>拖拽</kbd> 自定义排序</span>
            <span><kbd>↑↓←→</kbd> 选择</span>
            <span><kbd>↵</kbd> 浏览器打开</span>
            <span><kbd>${modSymbol}1-9</kbd> 数字直达</span>
            <span><kbd>★</kbd> 置顶</span>
            <span><kbd>Esc</kbd> 收起</span>
          </div>
        </footer>
      </section>`;
    document.body.appendChild(backdrop);

    backdrop.addEventListener("mousedown", (e) => {
      if (e.target === backdrop) closeModal();
    });
    backdrop.querySelector("#ql-close").onclick = closeModal;
    backdrop.querySelector("#ql-open-add").onclick = () => {
      cancelActiveDrag(true);
      if (creatingNew || editingItem) {
        creatingNew = false;
        editingItem = null;
        renderBody();
        backdrop.querySelector("#ql-search-input")?.focus();
        return;
      }
      creatingNew = true;
      editingItem = null;
      confirmDeleteId = "";
      renderBody();
      requestAnimationFrame(() => backdrop.querySelector("#ql-form-title")?.focus());
    };
    backdrop.querySelector("#ql-reset-order").onclick = async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        payload = await requestQuickLinks({ action: "reset_order" });
        showToast("已恢复默认排序");
        renderBody();
      } catch (err) {
        showToast(err.message, true);
      } finally {
        btn.disabled = false;
      }
    };
    let resetConfirm = false;
    let resetTimer = null;
    backdrop.querySelector("#ql-reset-defaults").onclick = async (e) => {
      const btn = e.currentTarget;
      if (!resetConfirm) {
        resetConfirm = true;
        btn.textContent = "再点确认恢复默认";
        clearTimeout(resetTimer);
        resetTimer = setTimeout(() => {
          resetConfirm = false;
          btn.textContent = "恢复默认预置";
        }, 3200);
        return;
      }
      resetConfirm = false;
      clearTimeout(resetTimer);
      btn.disabled = true;
      try {
        payload = await requestQuickLinks({ action: "reset_defaults" });
        showToast("已恢复默认 6 个预置网址");
        renderBody();
      } catch (err) {
        showToast(err.message, true);
      } finally {
        btn.disabled = false;
        btn.textContent = "恢复默认预置";
      }
    };

    const searchInput = backdrop.querySelector("#ql-search-input");
    const clearBtn = backdrop.querySelector("#ql-search-clear");
    searchInput.addEventListener("input", () => {
      searchQuery = searchInput.value;
      clearBtn.hidden = !searchQuery;
      activeIndex = 0;
      renderCardsOnly();
    });
    clearBtn.onclick = () => {
      searchQuery = "";
      searchInput.value = "";
      clearBtn.hidden = true;
      activeIndex = 0;
      renderCardsOnly();
      searchInput.focus();
    };
    return backdrop;
  }

  function showToast(msg, isError = false) {
    const node = backdrop?.querySelector("#ql-toast");
    if (!node) return;
    node.textContent = msg;
    node.dataset.kind = isError ? "error" : "ok";
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      node.hidden = true;
    }, 3200);
  }

  function filteredItems() {
    const items = payload?.items || FALLBACK_ITEMS;
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (activeCategory === "pinned" && !item.pinned) return false;
      if (!["all", "pinned"].includes(activeCategory) && item.category !== activeCategory)
        return false;
      if (!q) return true;
      const hay = [item.title, item.desc, item.domain, item.category, item.url]
        .join(" ")
        .toLowerCase();
      return q.split(/\s+/).every((tok) => hay.includes(tok));
    });
  }

  function safeOpenUrl(rawUrl) {
    let parsed;
    try {
      parsed = new URL(rawUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
    } catch {
      return;
    }
    if (window.hengzhang?.openQuickLink) {
      window.hengzhang.openQuickLink(parsed.href).catch((err) => {
        showToast(err?.message || "无法在默认浏览器打开该链接", true);
      });
      return;
    }
    window.open(parsed.href, "_blank", "noopener,noreferrer");
  }

  function computeReorderedState(draggedId, visibleBefore, visibleAfter) {
    const items = payload?.items || [];
    const allIds = items.map((x) => x.id);
    const visibleSet = new Set(visibleBefore);
    let cursor = 0;
    const nextOrderIds = allIds.map((id) =>
      visibleSet.has(id) ? visibleAfter[cursor++] : id,
    );

    const byId = new Map(items.map((x) => [x.id, x]));
    const wasPinned = Boolean(byId.get(draggedId)?.pinned);
    const otherPinnedSet = new Set(
      items.filter((x) => x.pinned && x.id !== draggedId).map((x) => x.id),
    );
    let shouldPin = wasPinned;

    if (otherPinnedSet.size > 0) {
      const idxInAll = nextOrderIds.indexOf(draggedId);
      let lastOtherPinnedPos = -1;
      let firstOtherUnpinnedPos = -1;
      nextOrderIds.forEach((id, idx) => {
        if (id === draggedId) return;
        if (otherPinnedSet.has(id)) lastOtherPinnedPos = idx;
        else if (firstOtherUnpinnedPos === -1) firstOtherUnpinnedPos = idx;
      });
      if (!wasPinned && idxInAll !== -1 && idxInAll < lastOtherPinnedPos)
        shouldPin = true;
      else if (
        wasPinned &&
        firstOtherUnpinnedPos !== -1 &&
        idxInAll > firstOtherUnpinnedPos
      )
        shouldPin = false;
    }
    const nextPinnedIds = nextOrderIds.filter((id) =>
      id === draggedId ? shouldPin : otherPinnedSet.has(id),
    );
    return { nextOrderIds, nextPinnedIds, pinChanged: shouldPin !== wasPinned, shouldPin };
  }

  function applyOptimisticOrder(nextOrderIds, nextPinnedIds) {
    if (!payload || !Array.isArray(payload.items)) return;
    const byId = new Map(payload.items.map((x) => [x.id, x]));
    const pinSet = new Set(nextPinnedIds);
    const pinnedList = [];
    const unpinnedList = [];
    for (const id of nextOrderIds) {
      const item = byId.get(id);
      if (!item) continue;
      const copy = { ...item, pinned: pinSet.has(id) };
      if (copy.pinned) pinnedList.push(copy);
      else unpinnedList.push(copy);
    }
    payload = {
      ...payload,
      items: [...pinnedList, ...unpinnedList],
      pinned_ids: nextPinnedIds,
      order_ids: nextOrderIds,
      has_custom_order: true,
    };
  }

  async function commitReorder(draggedId, visibleBefore, visibleAfter) {
    if (
      visibleBefore.length !== visibleAfter.length ||
      visibleBefore.every((id, i) => id === visibleAfter[i])
    )
      return;
    const { nextOrderIds, nextPinnedIds, pinChanged, shouldPin } =
      computeReorderedState(draggedId, visibleBefore, visibleAfter);
    applyOptimisticOrder(nextOrderIds, nextPinnedIds);
    renderBody();
    try {
      payload = await requestQuickLinks({
        action: "reorder_links",
        order_ids: nextOrderIds,
        pinned_ids: nextPinnedIds,
      });
      renderBody();
      if (pinChanged)
        showToast(shouldPin ? "已保存自定义排序并置顶" : "已保存自定义排序并取消置顶");
      else showToast("已保存你的自定义排序");
    } catch (err) {
      showToast(err.message || "保存排序失败", true);
      ensureData(true);
    }
  }

  function cancelActiveDrag(restoreDom = false) {
    if (!dragState) return;
    const st = dragState;
    dragState = null;
    window.removeEventListener("pointermove", st.onMove);
    window.removeEventListener("pointerup", st.onUp);
    window.removeEventListener("pointercancel", st.onCancel);
    if (st.ghost && st.ghost.parentNode) st.ghost.parentNode.removeChild(st.ghost);
    st.card.classList.remove("is-dragging");
    document.body.classList.remove("ql-is-sorting");
    if (restoreDom && st.active && st.grid) {
      for (const el of st.originalNodes) {
        if (el.parentNode === st.grid) st.grid.appendChild(el);
      }
    }
  }

  function bindCardDrag(card, grid, scrollEl, visibleBefore) {
    card.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      if (e.target.closest(".ql-card-tools")) return;
      cancelActiveDrag(true);
      const rect = card.getBoundingClientRect();
      const originalNodes = [...grid.querySelectorAll(".ql-card")];
      const st = {
        card,
        id: card.dataset.qlId,
        grid,
        scrollEl,
        visibleBefore,
        originalNodes,
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        width: rect.width,
        height: rect.height,
        active: false,
        ghost: null,
        onMove: null,
        onUp: null,
        onCancel: null,
      };
      const refreshLiveHints = () => {
        grid.querySelectorAll(".ql-card").forEach((n, i) => {
          n.dataset.qlIdx = String(i);
          const hint = n.querySelector(".ql-num-hint");
          if (hint) {
            hint.textContent = i < 9 ? modSymbol + (i + 1) : "";
            hint.hidden = i >= 9;
          }
        });
      };
      st.onMove = (ev) => {
        if (dragState !== st) return;
        const dx = ev.clientX - st.startX;
        const dy = ev.clientY - st.startY;
        if (!st.active) {
          if (Math.hypot(dx, dy) < 6) return;
          st.active = true;
          const ghost = st.card.cloneNode(true);
          ghost.classList.remove("is-selected");
          ghost.classList.add("ql-drag-ghost");
          ghost.style.width = st.width + "px";
          ghost.style.height = st.height + "px";
          ghost.style.left = ev.clientX - st.offsetX + "px";
          ghost.style.top = ev.clientY - st.offsetY + "px";
          ghost.querySelector(".ql-card-tools")?.remove();
          document.body.appendChild(ghost);
          st.ghost = ghost;
          st.card.classList.add("is-dragging");
          document.body.classList.add("ql-is-sorting");
        }
        ev.preventDefault();
        if (st.ghost) {
          st.ghost.style.left = ev.clientX - st.offsetX + "px";
          st.ghost.style.top = ev.clientY - st.offsetY + "px";
        }
        if (st.scrollEl) {
          const sr = st.scrollEl.getBoundingClientRect();
          if (ev.clientY < sr.top + 36) st.scrollEl.scrollTop -= 12;
          else if (ev.clientY > sr.bottom - 36) st.scrollEl.scrollTop += 12;
        }
        const siblings = [...st.grid.querySelectorAll(".ql-card")];
        const dragIdx = siblings.indexOf(st.card);
        for (let i = 0; i < siblings.length; i++) {
          const target = siblings[i];
          if (target === st.card) continue;
          const r = target.getBoundingClientRect();
          if (
            ev.clientX >= r.left &&
            ev.clientX <= r.right &&
            ev.clientY >= r.top &&
            ev.clientY <= r.bottom
          ) {
            if (dragIdx < i) target.after(st.card);
            else target.before(st.card);
            refreshLiveHints();
            break;
          }
        }
      };
      const finish = (cancelled) => {
        if (dragState !== st) return;
        const wasActive = st.active;
        const afterIds = wasActive
          ? [...st.grid.querySelectorAll(".ql-card")].map((n) => n.dataset.qlId)
          : st.visibleBefore;
        cancelActiveDrag(cancelled);
        if (wasActive) {
          suppressNextClick = true;
          clearTimeout(suppressClickTimer);
          suppressClickTimer = setTimeout(() => {
            suppressNextClick = false;
          }, 0);
          if (!cancelled) commitReorder(st.id, st.visibleBefore, afterIds);
        }
      };
      st.onUp = () => finish(false);
      st.onCancel = () => finish(true);
      dragState = st;
      window.addEventListener("pointermove", st.onMove, { passive: false });
      window.addEventListener("pointerup", st.onUp);
      window.addEventListener("pointercancel", st.onCancel);
    });
  }

  function renderBody() {
    if (!backdrop) return;
    const data = payload || {
      items: FALLBACK_ITEMS,
      categories: ["诉讼审判", "法规案例", "主体核查", "团队办公"],
      customized: false,
      has_custom_order: false,
    };
    const items = data.items || [];
    backdrop.querySelector("#ql-total-pill").textContent = items.length + " 个站点";
    const inForm = Boolean(creatingNew || editingItem);
    const resetOrderBtn = backdrop.querySelector("#ql-reset-order");
    if (resetOrderBtn) resetOrderBtn.hidden = inForm || !data.has_custom_order;
    const resetBtn = backdrop.querySelector("#ql-reset-defaults");
    if (resetBtn) resetBtn.hidden = inForm || !data.customized;

    const addBtn = backdrop.querySelector("#ql-open-add");
    addBtn.textContent = inForm ? "← 返回网址列表" : "＋ 添加网址";
    addBtn.classList.toggle("is-secondary", inForm);

    backdrop.querySelector("#ql-search-wrap").hidden = inForm;
    const catsWrap = backdrop.querySelector("#ql-cats");
    catsWrap.hidden = inForm;

    if (inForm) {
      renderForm(data);
      return;
    }

    const pinnedCount = items.filter((x) => x.pinned).length;
    const catCounts = new Map();
    for (const item of items) {
      const c = item.category || "常用网站";
      catCounts.set(c, (catCounts.get(c) || 0) + 1);
    }
    if (!["all", "pinned"].includes(activeCategory) && !catCounts.has(activeCategory))
      activeCategory = "all";
    if (activeCategory === "pinned" && !pinnedCount) activeCategory = "all";

    let pillsHtml = `<button type="button" class="ql-cat-pill ${activeCategory === "all" ? "is-active" : ""}" data-ql-cat="all">全部 <span>${items.length}</span></button>`;
    if (pinnedCount > 0) {
      pillsHtml += `<button type="button" class="ql-cat-pill ${activeCategory === "pinned" ? "is-active" : ""}" data-ql-cat="pinned">★ 置顶 <span>${pinnedCount}</span></button>`;
    }
    for (const [cat, cnt] of catCounts.entries()) {
      pillsHtml += `<button type="button" class="ql-cat-pill ${activeCategory === cat ? "is-active" : ""}" data-ql-cat="${esc(cat)}">${esc(cat)} <span>${cnt}</span></button>`;
    }
    catsWrap.innerHTML = pillsHtml;
    catsWrap.querySelectorAll("[data-ql-cat]").forEach((b) => {
      b.onclick = () => {
        activeCategory = b.dataset.qlCat;
        activeIndex = 0;
        renderBody();
      };
    });

    renderCardsOnly();
  }

  function renderCardsOnly() {
    if (!backdrop || creatingNew || editingItem) return;
    cancelActiveDrag(false);
    suppressNextClick = false;
    const content = backdrop.querySelector("#ql-content");
    const rows = filteredItems();
    if (activeIndex >= rows.length) activeIndex = Math.max(0, rows.length - 1);

    if (!rows.length) {
      content.innerHTML =
        '<div class="ql-empty"><strong>没有匹配的常用网站</strong><p>可尝试其他关键词，或点击右上角“＋ 添加网址”收录新站点。</p></div>';
      return;
    }

    const canDrag = !searchQuery.trim() && rows.length > 1;
    const visibleBefore = rows.map((r) => r.id);

    content.innerHTML = `<div class="ql-grid" role="listbox" aria-label="常用网站列表">${rows
      .map((item, idx) => {
        const numHint = `<kbd class="ql-num-hint" ${idx < 9 ? "" : "hidden"}>${idx < 9 ? modSymbol + (idx + 1) : ""}</kbd>`;
        const isConfirming = confirmDeleteId === item.id;
        return `<article class="ql-card ${canDrag ? "is-draggable" : ""} ${idx === activeIndex ? "is-selected" : ""} ${item.pinned ? "is-pinned" : ""}" role="option" aria-selected="${idx === activeIndex}" data-ql-idx="${idx}" data-ql-id="${esc(item.id)}">
          ${canDrag ? '<span class="ql-drag-handle" title="按住拖动可调整顺序" aria-hidden="true">⋮⋮</span>' : ""}
          <div class="ql-emblem" data-accent="${esc(item.accent || "blue")}">${esc(item.badge || item.title.slice(0, 1))}</div>
          <div class="ql-card-main">
            <div class="ql-card-title-row">
              <strong class="ql-card-title">${esc(item.title)}</strong>
              ${item.pinned ? '<span class="ql-pin-flag" title="已置顶">★</span>' : ""}
            </div>
            <p class="ql-card-desc">${esc(item.desc || "点击在默认浏览器打开该网站")}</p>
            <div class="ql-card-domain"><span>${esc(item.domain || item.url)}</span><span aria-hidden="true">↗</span></div>
          </div>
          <div class="ql-card-side">
            ${numHint}
            <div class="ql-card-tools">
              <button type="button" class="ql-tool-btn ${item.pinned ? "is-pinned" : ""}" data-ql-pin="${esc(item.id)}" title="${item.pinned ? "取消置顶" : "置顶到最前"}" aria-label="${item.pinned ? "取消置顶" : "置顶"}">${item.pinned ? "★" : "☆"}</button>
              <button type="button" class="ql-tool-btn" data-ql-edit="${esc(item.id)}" title="编辑链接" aria-label="编辑">✎</button>
              <button type="button" class="ql-tool-btn is-danger ${isConfirming ? "is-confirming" : ""}" data-ql-del="${esc(item.id)}" title="删除链接" aria-label="删除">${isConfirming ? "确认删" : "×"}</button>
            </div>
          </div>
        </article>`;
      })
      .join("")}</div>`;

    const grid = content.querySelector(".ql-grid");
    content.querySelectorAll(".ql-card").forEach((card) => {
      if (canDrag) bindCardDrag(card, grid, content, visibleBefore);
      card.addEventListener("mouseenter", () => {
        if (dragState?.active) return;
        const idx = Number(card.dataset.qlIdx);
        if (Number.isFinite(idx) && idx !== activeIndex) {
          activeIndex = idx;
          content.querySelectorAll(".ql-card").forEach((n, i) => {
            n.classList.toggle("is-selected", i === activeIndex);
            n.setAttribute("aria-selected", String(i === activeIndex));
          });
        }
      });
      card.addEventListener("click", (e) => {
        if (suppressNextClick) {
          suppressNextClick = false;
          return;
        }
        if (e.target.closest(".ql-card-tools")) return;
        const target = rows[Number(card.dataset.qlIdx)];
        if (target) {
          safeOpenUrl(target.url);
          closeModal();
        }
      });
    });

    content.querySelectorAll("[data-ql-pin]").forEach((btn) => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        btn.disabled = true;
        try {
          payload = await requestQuickLinks({ action: "toggle_pin", id: btn.dataset.qlPin });
          renderBody();
        } catch (err) {
          showToast(err.message, true);
          btn.disabled = false;
        }
      };
    });

    content.querySelectorAll("[data-ql-edit]").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const item = (payload?.items || []).find((x) => x.id === btn.dataset.qlEdit);
        if (!item) return;
        editingItem = item;
        creatingNew = false;
        confirmDeleteId = "";
        renderBody();
        requestAnimationFrame(() => backdrop.querySelector("#ql-form-title")?.focus());
      };
    });

    content.querySelectorAll("[data-ql-del]").forEach((btn) => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const id = btn.dataset.qlDel;
        if (confirmDeleteId !== id) {
          confirmDeleteId = id;
          renderCardsOnly();
          return;
        }
        confirmDeleteId = "";
        btn.disabled = true;
        try {
          payload = await requestQuickLinks({ action: "delete_link", id });
          showToast("已移除该网站链接");
          renderBody();
        } catch (err) {
          showToast(err.message, true);
          btn.disabled = false;
        }
      };
    });
  }

  function renderForm(data) {
    const content = backdrop.querySelector("#ql-content");
    const item = editingItem || {
      title: "",
      url: "",
      category: "常用网站",
      desc: "",
      badge: "",
      accent: "blue",
      pinned: false,
    };
    const cats = [
      ...new Set(["诉讼审判", "法规案例", "主体核查", "政务专办", "团队办公", ...(data.categories || [])]),
    ];
    const selectedAccent = item.accent || "blue";

    content.innerHTML = `
      <form id="ql-edit-form" class="ql-form">
        <div class="ql-form-head">
          <h3>${editingItem ? "编辑网站链接" : "添加常用网站"}</h3>
          <p>保存在本机数据中并自动纳入完整备份；支持星标置顶与自由拖拽排序。</p>
        </div>
        <div class="ql-form-grid">
          <label>网站名称 *
            <input id="ql-form-title" name="title" required maxlength="60" value="${esc(item.title)}" placeholder="例如：本地法院诉讼服务网">
          </label>
          <label>网址链接 (URL) *
            <input id="ql-form-url" name="url" required maxlength="1000" value="${esc(item.url)}" placeholder="https://...">
          </label>
        </div>
        <div class="ql-form-grid">
          <label>所属分类
            <input id="ql-form-cat" name="category" maxlength="24" value="${esc(item.category || "常用网站")}" placeholder="输入或点选下方分类">
            <div class="ql-cat-suggestions">${cats.map((c) => `<button type="button" class="ql-chip" data-pick-cat="${esc(c)}">${esc(c)}</button>`).join("")}</div>
          </label>
          <div>
            <label>图标徽字（1~2字，留空自动取首字）
              <input id="ql-form-badge" name="badge" maxlength="2" value="${esc(item.badge || "")}" placeholder="例如：法">
            </label>
            <div class="ql-accent-row" role="radiogroup" aria-label="图标配色">
              <span>图标配色</span>
              <div class="ql-accent-dots">
                ${ACCENTS.map((a) => `<button type="button" class="ql-accent-dot ${selectedAccent === a.id ? "is-active" : ""}" data-accent="${a.id}" title="${a.label}" aria-label="${a.label}"></button>`).join("")}
              </div>
              <input type="hidden" name="accent" id="ql-form-accent" value="${esc(selectedAccent)}">
            </div>
          </div>
        </div>
        <label>一句话用途说明（选填）
          <input name="desc" maxlength="140" value="${esc(item.desc || "")}" placeholder="简短标注该站点的常用查询或办事入口，便于关键词搜索">
        </label>
        <div class="ql-form-options">
          <label class="ql-pin-check"><input type="checkbox" name="pinned" ${item.pinned ? "checked" : ""}><span>置顶在面板最前</span></label>
        </div>
        <div class="ql-form-actions">
          <button type="button" id="ql-form-cancel">取消</button>
          <button type="submit" class="primary" id="ql-form-submit">${editingItem ? "保存修改" : "添加到导航"}</button>
        </div>
      </form>`;

    const form = content.querySelector("#ql-edit-form");
    form.querySelectorAll("[data-pick-cat]").forEach((b) => {
      b.onclick = () => {
        form.querySelector("#ql-form-cat").value = b.dataset.pickCat;
      };
    });
    form.querySelectorAll(".ql-accent-dot").forEach((dot) => {
      dot.onclick = () => {
        form.querySelectorAll(".ql-accent-dot").forEach((x) => x.classList.remove("is-active"));
        dot.classList.add("is-active");
        form.querySelector("#ql-form-accent").value = dot.dataset.accent;
      };
    });
    form.querySelector("#ql-form-cancel").onclick = () => {
      creatingNew = false;
      editingItem = null;
      renderBody();
      backdrop.querySelector("#ql-search-input")?.focus();
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector("#ql-form-submit");
      submitBtn.disabled = true;
      const fd = new FormData(form);
      try {
        payload = await requestQuickLinks({
          action: "save_link",
          id: editingItem?.id || "",
          title: fd.get("title"),
          url: fd.get("url"),
          category: fd.get("category"),
          desc: fd.get("desc"),
          badge: fd.get("badge"),
          accent: fd.get("accent"),
          pinned: form.elements.pinned.checked,
        });
        const wasEdit = Boolean(editingItem);
        creatingNew = false;
        editingItem = null;
        renderBody();
        backdrop.querySelector("#ql-search-input")?.focus();
        showToast(wasEdit ? "链接修改已保存" : "已添加到常用网址");
      } catch (err) {
        showToast(err.message, true);
        submitBtn.disabled = false;
      }
    };
  }

  function handleModalKeydown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (dragState?.active) {
        cancelActiveDrag(true);
        return;
      }
      if (creatingNew || editingItem) {
        creatingNew = false;
        editingItem = null;
        renderBody();
        backdrop.querySelector("#ql-search-input")?.focus();
        return;
      }
      if (confirmDeleteId) {
        confirmDeleteId = "";
        renderCardsOnly();
        return;
      }
      closeModal();
      return;
    }
    if (creatingNew || editingItem) return;

    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && /^[1-9]$/.test(e.key)) {
      const rows = filteredItems();
      const target = rows[Number(e.key) - 1];
      if (target) {
        e.preventDefault();
        safeOpenUrl(target.url);
        closeModal();
      }
      return;
    }

    const rows = filteredItems();
    if (!rows.length) return;
    const cols = window.innerWidth <= 720 ? 1 : 2;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = Math.min(rows.length - 1, activeIndex + cols);
      syncSelectedCard();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(0, activeIndex - cols);
      syncSelectedCard();
    } else if (e.key === "ArrowRight" && document.activeElement !== backdrop.querySelector("#ql-search-input")) {
      e.preventDefault();
      activeIndex = Math.min(rows.length - 1, activeIndex + 1);
      syncSelectedCard();
    } else if (e.key === "ArrowLeft" && document.activeElement !== backdrop.querySelector("#ql-search-input")) {
      e.preventDefault();
      activeIndex = Math.max(0, activeIndex - 1);
      syncSelectedCard();
    } else if (e.key === "Enter") {
      if (e.target.closest("button")) return;
      e.preventDefault();
      const target = rows[activeIndex];
      if (target) {
        safeOpenUrl(target.url);
        closeModal();
      }
    }
  }

  function syncSelectedCard() {
    const cards = backdrop?.querySelectorAll(".ql-card") || [];
    cards.forEach((n, i) => {
      const sel = i === activeIndex;
      n.classList.toggle("is-selected", sel);
      n.setAttribute("aria-selected", String(sel));
      if (sel) n.scrollIntoView({ block: "nearest" });
    });
  }

  function openModal() {
    ensureModal();
    previousFocus = document.activeElement;
    isOpen = true;
    confirmDeleteId = "";
    creatingNew = false;
    editingItem = null;
    backdrop.hidden = false;
    document.getElementById("quick-links-trigger")?.setAttribute("aria-expanded", "true");
    ensureData(true);
    renderBody();
    requestAnimationFrame(() => {
      const input = backdrop.querySelector("#ql-search-input");
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  function closeModal() {
    if (!isOpen || !backdrop) return;
    cancelActiveDrag(true);
    isOpen = false;
    confirmDeleteId = "";
    creatingNew = false;
    editingItem = null;
    backdrop.hidden = true;
    document.getElementById("quick-links-trigger")?.setAttribute("aria-expanded", "false");
    if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
  }

  function toggleModal() {
    if (isOpen) closeModal();
    else openModal();
  }

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
      e.preventDefault();
      toggleModal();
      return;
    }
    if (isOpen) handleModalKeydown(e);
  });

  mountTrigger();
  window.HengzhangQuickLinks = { open: openModal, close: closeModal, toggle: toggleModal };
})();
