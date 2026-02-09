(() => {
  const KEY = "yorozuya_sugar_stamp_github_v1";

  // GitHub 版本：用相對路徑，方便你換圖/改圖
  const STAMP_SRC = "./assets/gintama_stamp.png";

  const el = (id) => document.getElementById(id);

  const stateDefault = {
    name: "",
    reward5: "滿 5 印：請你飲一杯最鍾意嘅",
    reward10: "滿 10 印：一餐大餐 / 小禮物",
    stamps: 0,
    reward5Claimed: false,
    reward10Claimed: false,
    modal5Shown: false,
    modal10Shown: false,
    log: []
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(stateDefault);
      const s = JSON.parse(raw);
      return { ...structuredClone(stateDefault), ...s, log: Array.isArray(s.log) ? s.log : [] };
    } catch {
      return structuredClone(stateDefault);
    }
  }

  function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

  function uid() { return Math.random().toString(16).slice(2) + Date.now().toString(16); }

  function fmt(ts) {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${hh}:${mm}`;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[m]));
  }

  let state = load();
  let lastAddedStampIndex = null;

  function renderTitle() {
    const name = (state.name || "").trim();
    el("appTitle").textContent = name ? `萬事屋・${name} 戒糖印仔帳` : "萬事屋・戒糖印仔帳";
  }

  function renderKPIs() {
    const total = state.log.length;
    const sugarFree = state.log.filter(x => x.sugarFree).length;
    el("kpiTotal").textContent = String(total);
    el("kpiSugarFree").textContent = String(sugarFree);
    el("kpiStamps").textContent = String(Math.max(0, Math.min(10, state.stamps)));
  }

  function showSfx(text, targetIndex) {
  const sfx = el("sfx");
  sfx.textContent = text || "啪！";
  sfx.classList.remove("show");

  requestAnimationFrame(() => {
    if (targetIndex) {
      const grid = el("stampGrid");
      const wrap = document.querySelector(".stampWrap");
      const cell = grid?.children?.[targetIndex - 1];

      if (cell && wrap) {
        const c = cell.getBoundingClientRect();
        const w = wrap.getBoundingClientRect();

        // 泡泡放在該格「中間偏上」位置（你可以微調 0.5 / 0.35）
        sfx.style.left = (c.left - w.left + c.width * 0.5) + "px";
        sfx.style.top  = (c.top  - w.top  + c.height * -1.5) + "px";
      }
    }

    // restart animation
    void sfx.offsetWidth;
    sfx.classList.add("show");
  });
}

  function beep() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = 740;
      g.gain.value = 0.02;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      setTimeout(() => { o.stop(); ctx.close(); }, 70);
    } catch {}
  }

  function renderStampGrid() {
    const grid = el("stampGrid");
    grid.innerHTML = "";
    const filled = Math.max(0, Math.min(10, state.stamps));
    el("stampMeta").textContent = `${filled} / 10`;

    const rots = [-12,-8,9,-10,7,-7,11,-9,8,-11];

    for (let i = 1; i <= 10; i++) {
      const cell = document.createElement("div");
      cell.className = "stampCell " + (i <= filled ? "" : "empty");

      if (i <= filled) {
        cell.style.setProperty("--rot", rots[(i - 1) % rots.length] + "deg");
        if (lastAddedStampIndex === i) cell.className += " pop";
        cell.innerHTML = `<img class="stampImg" src="${STAMP_SRC}" alt="stamp">`;
      } else {
        cell.textContent = "未";
      }
      grid.appendChild(cell);
    }

    lastAddedStampIndex = null;
  }

  function renderCapBanner() {
    const cap = el("capBanner");
    if (state.stamps >= 10) cap.classList.remove("hidden");
    else cap.classList.add("hidden");
  }

  function openModal({ title, text, hint, buttons }) {
    el("modalTitle").textContent = title || "達成！";
    el("modalText").innerHTML = text || "";
    el("modalHint").textContent = hint || "";

    const btns = el("modalBtns");
    btns.innerHTML = "";
    (buttons || []).forEach(b => {
      const bt = document.createElement("button");
      bt.className = "btn " + (b.primary ? "primary" : "");
      bt.textContent = b.label;
      bt.onclick = b.onClick;
      btns.appendChild(bt);
    });

    el("overlay").classList.remove("hidden");
  }

  function closeModal() { el("overlay").classList.add("hidden"); }

  el("overlay").addEventListener("click", (e) => {
    if (e.target === el("overlay")) closeModal();
  });

  function maybeShowMilestones(prev, now) {
    if (prev < 5 && now >= 5 && !state.modal5Shown) {
      state.modal5Shown = true;
      save(state);
      openModal({
        title: "🎁 5 印達成！",
        text: `<b>${escapeHtml(state.reward5 || "（未設定）")}</b>`,
        hint: "吐槽：你而家已經打爆 5 印，仲唔快啲兌換？",
        buttons: [
          { label: "關閉", onClick: () => closeModal() },
          {
            label: state.reward5Claimed ? "已兌換" : "立即兌換",
            primary: true,
            onClick: () => {
              if (!state.reward5Claimed) state.reward5Claimed = true;
              save(state); renderAll(); closeModal();
            }
          }
        ]
      });
    }

    if (prev < 10 && now >= 10 && !state.modal10Shown) {
      state.modal10Shown = true;
      save(state);
      openModal({
        title: "🏆 10 印滿格！",
        text: `<b>${escapeHtml(state.reward10 || "（未設定）")}</b>`,
        hint: "建議：兌換後重置一輪，開始下一季。",
        buttons: [
          { label: "關閉", onClick: () => closeModal() },
          {
            label: state.reward10Claimed ? "已兌換" : "兌換",
            primary: true,
            onClick: () => {
              if (!state.reward10Claimed) state.reward10Claimed = true;
              save(state); renderAll(); closeModal();
            }
          },
          {
            label: "兌換並重置",
            onClick: () => {
              state.reward10Claimed = true;
              resetRound();
              closeModal();
            }
          }
        ]
      });
    }
  }

  function renderRewardsBanners() {
    const r5 = el("reward5Banner");
    const r10 = el("reward10Banner");
    r5.classList.add("hidden");
    r10.classList.add("hidden");

    if (state.stamps >= 5) {
      r5.classList.remove("hidden");
      const claimed = state.reward5Claimed;
      r5.innerHTML = `
        <div class="head">🎁 已達成 5 印</div>
        <div style="margin-top:4px; font-weight:900;">${escapeHtml(state.reward5 || "（未設定）")}</div>
        <small>${claimed ? "已兌換（唔好再賴帳）" : "可兌換一次"}。</small>
        <div style="margin-top:8px;">
          <button class="btn primary" id="claim5Btn" ${claimed ? "disabled" : ""}>${claimed ? "已兌換" : "兌換"}</button>
        </div>
      `;
      const b = document.getElementById("claim5Btn");
      if (b) b.onclick = () => { state.reward5Claimed = true; save(state); renderAll(); };
    }

    if (state.stamps >= 10) {
      r10.classList.remove("hidden");
      const claimed = state.reward10Claimed;
      r10.innerHTML = `
        <div class="head">🏆 已達成 10 印</div>
        <div style="margin-top:4px; font-weight:900;">${escapeHtml(state.reward10 || "（未設定）")}</div>
        <small>${claimed ? "已兌換" : "可兌換一次"}；兌換後可重置開始新一輪。</small>
        <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn primary" id="claim10Btn" ${claimed ? "disabled" : ""}>${claimed ? "已兌換" : "兌換"}</button>
          <button class="btn" id="resetRoundBtn">兌換後重置</button>
        </div>
      `;
      const c10 = document.getElementById("claim10Btn");
      if (c10) c10.onclick = () => { state.reward10Claimed = true; save(state); renderAll(); };
      const rr = document.getElementById("resetRoundBtn");
      if (rr) rr.onclick = () => resetRound();
    }
  }

  function renderLog() {
    const list = el("logList");
    list.innerHTML = "";
    if (state.log.length === 0) {
      const empty = document.createElement("div");
      empty.className = "metaSmall";
      empty.textContent = "未有紀錄。先飲一杯再講。";
      list.appendChild(empty);
      return;
    }

    state.log.slice(0, 60).forEach(item => {
      const div = document.createElement("div");
      div.className = "logItem";

      const drink = (item.drink || "").trim() || "（未填名稱）";
      const note = (item.note || "").trim();
      const added = item.stampAdded ? "＋1 印" : (item.sugarFree ? "（滿印，無加印）" : "");
      const badgeHtml = item.sugarFree ? `<img src="${STAMP_SRC}" alt="stamp">` : "☕️";

      div.innerHTML = `
        <div class="left">
          <div class="badge" title="${item.sugarFree ? "已戒糖" : "普通"}">${badgeHtml}</div>
          <div>
            <div class="logTitle">${escapeHtml(drink)} ${item.sugarFree ? `<span class="metaSmall">｜戒糖 ${escapeHtml(added)}</span>` : ""}</div>
            <div class="logMeta">${fmt(item.ts)}${note ? `｜${escapeHtml(note)}` : ""}</div>
          </div>
        </div>
        <div>
          <button class="btn" style="padding:8px 10px; border-radius:12px;" data-del="${item.id}">刪</button>
        </div>
      `;
      div.querySelector('[data-del]')?.addEventListener("click", () => deleteItem(item.id));
      list.appendChild(div);
    });
  }

  function addEntry({ drink, sugarFree, note }) {
    const now = Date.now();
    const prevStamps = state.stamps;
    const willAddStamp = !!sugarFree && state.stamps < 10;

    const entry = {
      id: uid(),
      ts: now,
      drink: drink || "",
      sugarFree: !!sugarFree,
      note: note || "",
      stampAdded: willAddStamp
    };

    state.log.unshift(entry);

    if (willAddStamp) {
      state.stamps += 1;
      lastAddedStampIndex = state.stamps;
      save(state);

      showSfx("啪！", state.stamps);
      beep();

      renderAll();
      maybeShowMilestones(prevStamps, state.stamps);
      return;
    }

    save(state);
    renderAll();
  }

  function deleteItem(id) {
    const idx = state.log.findIndex(x => x.id === id);
    if (idx === -1) return;
    const item = state.log[idx];

    if (item.stampAdded && state.stamps > 0) state.stamps -= 1;
    state.log.splice(idx, 1);

    save(state);
    renderAll();
  }

  function resetRound() {
    state.stamps = 0;
    state.reward5Claimed = false;
    state.reward10Claimed = false;
    state.modal5Shown = false;
    state.modal10Shown = false;
    save(state);
    renderAll();
  }

  function resetAll() {
    if (!confirm("確定清空所有資料？（不可還原）")) return;
    state = structuredClone(stateDefault);
    save(state);
    renderAll();
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "萬事屋_戒糖印仔帳_備份.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 800);
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const incoming = JSON.parse(reader.result);
        if (typeof incoming !== "object" || incoming === null) throw new Error("bad");

        state = { ...structuredClone(stateDefault), ...incoming };
        if (!Array.isArray(state.log)) state.log = [];
        if (typeof state.stamps !== "number") state.stamps = 0;
        state.stamps = Math.max(0, Math.min(10, Math.floor(state.stamps)));

        save(state);
        renderAll();
        alert("匯入完成。");
      } catch {
        alert("匯入失敗：檔案格式不正確。");
      }
    };
    reader.readAsText(file);
  }

  function bind() {
    el("nameInput").value = state.name || "";
    el("reward5Input").value = state.reward5 || "";
    el("reward10Input").value = state.reward10 || "";

    el("nameInput").addEventListener("input", (e) => {
      state.name = e.target.value;
      save(state);
      renderTitle();
    });

    el("reward5Input").addEventListener("input", (e) => {
      state.reward5 = e.target.value;
      save(state);
      renderRewardsBanners();
    });

    el("reward10Input").addEventListener("input", (e) => {
      state.reward10 = e.target.value;
      save(state);
      renderRewardsBanners();
    });

    el("addBtn").addEventListener("click", () => {
      addEntry({
        drink: el("drinkInput").value.trim(),
        sugarFree: el("sugarFreeInput").checked,
        note: el("noteInput").value.trim()
      });
      el("drinkInput").value = "";
      el("noteInput").value = "";
      el("sugarFreeInput").checked = false;
    });

    el("quickNowBtn").addEventListener("click", () => {
      addEntry({
        drink: "",
        sugarFree: el("sugarFreeInput").checked,
        note: el("noteInput").value.trim()
      });
      el("noteInput").value = "";
      el("sugarFreeInput").checked = false;
    });

    el("resetAllBtn").addEventListener("click", resetAll);
    el("exportBtn").addEventListener("click", exportJson);

    el("importFile").addEventListener("change", (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      importJson(f);
      e.target.value = "";
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
  }

  function renderAll() {
    renderTitle();
    renderKPIs();
    renderCapBanner();
    renderStampGrid();
    renderRewardsBanners();
    renderLog();
  }

  bind();
  renderAll();
})();
