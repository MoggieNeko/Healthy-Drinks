(() => {
  const KEY = "sugar_stamp_app_state_v1";

  const el = (id) => document.getElementById(id);

  const stateDefault = {
    name: "",
    reward5: "滿 5 印：請你飲一杯最鍾意嘅",
    reward10: "滿 10 印：一餐大餐 / 小禮物",
    stamps: 0,
    reward5Claimed: false,
    reward10Claimed: false,
    log: [] // {id, ts, drink, sugarFree, note, stampAdded}
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

  function save(s) {
    localStorage.setItem(KEY, JSON.stringify(s));
  }

  function uid() {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  function fmt(ts) {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    const hh = String(d.getHours()).padStart(2,"0");
    const mm = String(d.getMinutes()).padStart(2,"0");
    return `${y}-${m}-${day} ${hh}:${mm}`;
  }

  let state = load();

  function renderTitle() {
    const name = (state.name || "").trim();
    el("appTitle").textContent = name ? `${name} 的戒糖印仔卡` : "戒糖印仔卡";
  }

  function renderStampGrid() {
    const grid = el("stampGrid");
    grid.innerHTML = "";
    const filled = Math.max(0, Math.min(10, state.stamps));
    for (let i = 1; i <= 10; i++) {
      const d = document.createElement("div");
      d.className = "stamp" + (i <= filled ? " filled" : "");
      d.title = i <= filled ? "已蓋印" : "未蓋印";
      d.textContent = i <= filled ? "🟢" : "○";
      grid.appendChild(d);
    }
    el("stampMeta").textContent = `${filled} / 10`;
    el("kpiStamps").textContent = String(filled);
  }

  function renderKPIs() {
    const total = state.log.length;
    const sugarFree = state.log.filter(x => x.sugarFree).length;
    el("kpiTotal").textContent = String(total);
    el("kpiSugarFree").textContent = String(sugarFree);
  }

  function renderRewards() {
    // Cap banner
    const cap = el("capBanner");
    if (state.stamps >= 10) cap.classList.remove("hidden");
    else cap.classList.add("hidden");

    const r5 = el("reward5Banner");
    const r10 = el("reward10Banner");

    r5.classList.add("hidden");
    r10.classList.add("hidden");

    // 5-stamp reward
    if (state.stamps >= 5) {
      r5.classList.remove("hidden");
      const claimed = state.reward5Claimed;
      r5.innerHTML = `
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
          <div>
            <div style="font-weight:900;">🎁 已達成 5 印</div>
            <small>${escapeHtml(state.reward5 || "（未設定）")}</small>
          </div>
          <div>
            <button class="btn mini ${claimed ? "" : "primary"}" id="claim5Btn" ${claimed ? "disabled" : ""}>
              ${claimed ? "已兌換" : "兌換"}
            </button>
          </div>
        </div>
      `;
      const b = document.getElementById("claim5Btn");
      if (b) b.onclick = () => {
        state.reward5Claimed = true;
        save(state); render();
      };
    }

    // 10-stamp reward
    if (state.stamps >= 10) {
      r10.classList.remove("hidden");
      const claimed = state.reward10Claimed;
      r10.innerHTML = `
        <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
          <div>
            <div style="font-weight:900;">🏆 已達成 10 印</div>
            <small>${escapeHtml(state.reward10 || "（未設定）")}</small>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
            <button class="btn mini ${claimed ? "" : "primary"}" id="claim10Btn" ${claimed ? "disabled" : ""}>
              ${claimed ? "已兌換" : "兌換"}
            </button>
            <button class="btn mini" id="resetRoundBtn">兌換後重置</button>
          </div>
        </div>
        <small>「兌換後重置」會把印仔歸零，開始新一輪；紀錄仍會保留。</small>
      `;
      const c10 = document.getElementById("claim10Btn");
      if (c10) c10.onclick = () => {
        state.reward10Claimed = true;
        save(state); render();
      };
      const rr = document.getElementById("resetRoundBtn");
      if (rr) rr.onclick = () => resetRound();
    }
  }

  function renderLog() {
    const list = el("logList");
    list.innerHTML = "";
    if (state.log.length === 0) {
      const empty = document.createElement("div");
      empty.className = "meta";
      empty.textContent = "未有紀錄。";
      list.appendChild(empty);
      return;
    }

    state.log.slice(0, 60).forEach(item => {
      const div = document.createElement("div");
      div.className = "item";
      const icon = item.sugarFree ? "✅" : "☕️";
      const drink = (item.drink || "").trim() || "（未填名稱）";
      const note = (item.note || "").trim();
      const added = item.stampAdded ? "＋1 印" : (item.sugarFree ? "（已滿 10 印，無加印）" : "");

      div.innerHTML = `
        <div class="left">
          <div class="badge" title="${item.sugarFree ? "已戒糖" : "普通"}">${icon}</div>
          <div>
            <div class="title">${escapeHtml(drink)} ${item.sugarFree ? `<span class="meta">｜戒糖 ${escapeHtml(added)}</span>` : ""}</div>
            <div class="meta">${fmt(item.ts)}${note ? `｜${escapeHtml(note)}` : ""}</div>
          </div>
        </div>
        <div class="actions">
          <button class="btn mini" data-del="${item.id}">刪除</button>
        </div>
      `;

      div.querySelector('[data-del]')?.addEventListener("click", () => deleteItem(item.id));
      list.appendChild(div);
    });

    if (state.log.length > 60) {
      const more = document.createElement("div");
      more.className = "meta";
      more.textContent = `只顯示最近 60 筆（總共 ${state.log.length} 筆）。`;
      list.appendChild(more);
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[m]));
  }

  function addEntry({ drink, sugarFree, note }) {
    const now = Date.now();
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
      // Auto-reset claim flags logic: if user goes back below threshold later (by deletions), we keep claimed state as-is.
      // If user starts a new round via reset, flags reset there.
    }

    save(state);
    render();
  }

  function deleteItem(id) {
    const idx = state.log.findIndex(x => x.id === id);
    if (idx === -1) return;
    const item = state.log[idx];

    // If this entry actually added a stamp, revert it.
    if (item.stampAdded && state.stamps > 0) {
      state.stamps -= 1;
    }

    state.log.splice(idx, 1);
    save(state);
    render();
  }

  function resetRound() {
    // Start a new cycle
    state.stamps = 0;
    state.reward5Claimed = false;
    state.reward10Claimed = false;
    save(state);
    render();
  }

  function resetAll() {
    if (!confirm("確定清空所有資料？（不可還原）")) return;
    state = structuredClone(stateDefault);
    save(state);
    render();
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "戒糖印仔卡_備份.json";
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
        // shallow validate
        if (typeof incoming !== "object" || incoming === null) throw new Error("bad");
        state = { ...structuredClone(stateDefault), ...incoming };
        if (!Array.isArray(state.log)) state.log = [];
        if (typeof state.stamps !== "number") state.stamps = 0;
        state.stamps = Math.max(0, Math.min(10, Math.floor(state.stamps)));
        save(state);
        render();
        alert("匯入完成。");
      } catch {
        alert("匯入失敗：檔案格式不正確。");
      }
    };
    reader.readAsText(file);
  }

  function bind() {
    // Inputs init
    el("nameInput").value = state.name || "";
    el("reward5Input").value = state.reward5 || "";
    el("reward10Input").value = state.reward10 || "";

    el("nameInput").addEventListener("input", (e) => {
      state.name = e.target.value;
      save(state); renderTitle();
    });

    el("reward5Input").addEventListener("input", (e) => {
      state.reward5 = e.target.value;
      save(state); renderRewards();
    });

    el("reward10Input").addEventListener("input", (e) => {
      state.reward10 = e.target.value;
      save(state); renderRewards();
    });

    el("addBtn").addEventListener("click", () => {
      addEntry({
        drink: el("drinkInput").value.trim(),
        sugarFree: el("sugarFreeInput").checked,
        note: el("noteInput").value.trim()
      });
      // reset quick fields
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
  }

  function render() {
    renderTitle();
    renderKPIs();
    renderStampGrid();
    renderRewards();
    renderLog();
  }

  bind();
  render();
})();
