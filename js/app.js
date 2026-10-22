(function () {
  "use strict";
  const SEED = [
    ["ありがとう", "", "arigatō", "thank you", "expr"],
    ["こんにちは", "", "konnichiwa", "hello, good afternoon", "expr"],
    ["水", "みず", "mizu", "water", "nom"],
    ["学校", "がっこう", "gakkō", "school", "nom"],
    ["日本語", "にほんご", "nihongo", "Japanese (language)", "nom"],
    ["猫", "ねこ", "neko", "cat", "nom"],
    ["先生", "せんせい", "sensei", "teacher", "nom"],
    ["食べる", "たべる", "taberu", "to eat", "verb"],
    ["山", "やま", "yama", "mountain", "nom"]
  ];
  const KEY = "diccionari-japones-v1";
  // Optional speech register of a word or note ("" when it doesn't matter).
  const REG = {
    hon: { kan: "敬語", name: "Honorific", title: "Polite or honorific speech (敬語)" },
    cas: { kan: "タメ口", name: "Casual", title: "Casual speech with friends and family (タメ口)" }
  };
  const regOf = (v) => (REG[v] ? v : "");
  const regText = (r) => (REG[r] ? REG[r].name + " " + REG[r].kan : "");
  const REG_ICONS = {
    hon: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8l4.5 4.2L12 5l4 7.2L20.5 8l-2 10.5h-13z"/></svg>',
    cas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 14.2c1 1.6 2.4 2.4 4 2.4s3-.8 4-2.4"/><path d="M9 9.5v.5M15 9.5v.5" stroke-width="2.6"/></svg>'
  };
  // Badge: the register's icon and its name (crown for honorific, smile for casual).
  function regBadge(r) {
    const b = document.createElement("span");
    b.className = "reg " + r;
    b.title = REG[r].title;
    b.innerHTML = REG_ICONS[r];
    b.append(REG[r].name);
    return b;
  }
  // The word list shows the register as a coloured circle: red for honorific, blue for casual.
  function regDot(r) {
    const d = document.createElement("span");
    d.className = "rdot " + r;
    d.title = REG[r].title;
    d.setAttribute("role", "img");
    d.setAttribute("aria-label", REG[r].name);
    return d;
  }
  const NS = "http://www.w3.org/2000/svg";
  const $ = (id) => document.getElementById(id);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const EPS = 1e-6;
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  const str = (v) => (typeof v === "string" ? v.trim() : "");

  /* ---------- groups ---------- */
  // Words and sentences are filed in groups, shown as a row of filter chips and picked in their form. Built-in
  // groups are stored by key; groups the user creates are stored on the item by name (and listed under o.store so
  // empty ones stay offered). "" is "Other". The form's controls are #<p>Group, #<p>GrpRen, #<p>GrpDel, #<p>GrpNew,
  // #<p>GrpName and #<p>GrpAdd. o.items() lists the grouped items; o.render() redraws the list, o.commit() saves,
  // redraws and refreshes the backup; o.moved(from, to) moves the list's filter when a group is renamed or deleted.
  function groupKit(o) {
    const { builtIn, p } = o;
    const has = (g) => Object.hasOwn(builtIn, g);
    const isCustom = (g) => !!g && !has(g);
    // A built-in key, a custom group name (a built-in group's name maps to its key) or "".
    function of(g) {
      const name = str(g).replace(/\s+/g, " ").slice(0, 40);
      if (has(name)) return name;
      const low = name.toLowerCase();
      return Object.keys(builtIn).find((k) => builtIn[k].name.toLowerCase() === low) || name;
    }
    const name = (g) => (!g ? "Other" : has(g) ? builtIn[g].name : g);
    let custom = [];
    try {
      const a = JSON.parse(localStorage.getItem(o.store));
      if (Array.isArray(a)) custom = [...new Set(a.map(of).filter(isCustom))];
    } catch (e) { /* ignore */ }
    function saveCustom() {
      try { localStorage.setItem(o.store, JSON.stringify(custom)); } catch (e) { /* ignore */ }
    }
    // The built-in groups, then the custom ones (stored, or found on an item) in alphabetical order.
    function keys() {
      const own = new Set(custom);
      o.items().forEach((x) => { if (isCustom(x.group)) own.add(x.group); });
      return [...Object.keys(builtIn), ...[...own].sort((a, b) => a.localeCompare(b, "en"))];
    }
    const sel = $(p + "Group"), box = $(p + "GrpNew"), input = $(p + "GrpName");
    const isNew = () => { const op = sel.selectedOptions[0]; return !!(op && op.dataset.new); };
    // Rebuilds the form's group picker, keeping the current choice.
    function fill() {
      const wasNew = isNew(), v = sel.value;
      const add = new Option("New group…", "");
      add.dataset.new = "1";
      sel.textContent = "";
      sel.append(new Option("Other (no group)", ""), ...keys().map((g) => new Option(name(g), g)), add);
      if (wasNew) add.selected = true; else sel.value = v;
      sync();
    }
    // Rename and Delete are offered while a custom group is selected.
    function sync() {
      $(p + "GrpRen").hidden = $(p + "GrpDel").hidden = isNew() || !isCustom(sel.value);
    }
    // The name row names a new group ("new") or renames the selected one ("rename"); null while closed.
    let mode = null;
    function open(m) {
      const ren = m === "rename";
      mode = m;
      box.hidden = false;
      input.value = ren ? sel.value : "";
      input.placeholder = ren ? "New name for the group" : "Name of the new group";
      input.setAttribute("aria-label", input.placeholder);
      $(p + "GrpAdd").textContent = ren ? "Rename" : "Add";
      input.focus();
      if (ren) input.select();
    }
    function close() {
      mode = null;
      box.hidden = true;
      input.value = "";
      sync();
    }
    const confirm = () => (mode === "rename" ? rename() : add());
    // Creates the group typed in the name row (or picks the existing one with that name) and selects it.
    function add() {
      const g = of(input.value);
      if (!g) { o.hint("Type a name for the new group."); input.focus(); return null; }
      if (!keys().includes(g)) { custom.push(g); saveCustom(); }
      close();
      fill();
      sel.value = g;
      o.render();
      o.hint();
      return g;
    }
    // Renames the selected custom group on every item. Renaming it to an existing group merges the two.
    function rename() {
      const old = sel.value, g = of(input.value);
      if (!g) { o.hint("Type a new name for the group."); input.focus(); return null; }
      close();
      if (g !== old) {
        const merged = keys().includes(g);
        custom = custom.filter((x) => x !== old);
        if (isCustom(g) && !custom.includes(g)) custom.push(g);
        o.items().forEach((x) => { if (x.group === old) x.group = g; });
        o.moved(old, g);
        saveCustom();
        sel.value = "";
        o.commit();
        o.status(merged ? o.noun[0].toUpperCase() + o.noun.slice(1) + " moved to “" + name(g) + "”." : "Group renamed to “" + g + "”.");
      }
      sel.value = g;
      sync();
      o.hint();
      return g;
    }
    // Deletes the selected custom group; its items move to "Other". Undo puts them back.
    function remove() {
      const g = sel.value;
      if (!isCustom(g)) return;
      const moved = o.items().filter((x) => x.group === g);
      const stored = custom.includes(g);
      moved.forEach((x) => { x.group = ""; });
      custom = custom.filter((x) => x !== g);
      o.moved(g, "all");
      saveCustom();
      close();
      sel.value = "";
      o.commit();
      o.status("Group “" + g + "” deleted." + (moved.length ? " Its " + o.noun + " moved to Other." : ""), () => {
        moved.forEach((x) => { if (!x.group) x.group = g; });
        if (stored && !custom.includes(g)) custom.push(g);
        saveCustom();
        o.commit();
        o.status("Group restored.");
      });
      sel.focus();
    }
    // The filter row: every group, plus "Other" when some items have none. Returns the current filter,
    // reset to "all" when its group is gone.
    function row(el, items, current) {
      const ks = ["all", ...keys()];
      if (items.some((x) => !x.group)) ks.push("");
      if (!ks.includes(current)) current = "all";
      el.textContent = "";
      ks.forEach((g) => {
        const b = node("button", "chip");
        b.type = "button";
        b.dataset.g = g;
        b.setAttribute("aria-pressed", String(g === current));
        if (has(g)) {
          const kan = node("span", "kan", builtIn[g].kan, true);
          kan.setAttribute("aria-hidden", "true");
          b.append(kan);
        }
        b.append(g === "all" ? "All " + o.noun : name(g), " ", node("span", "n", String(g === "all" ? items.length : items.filter((x) => x.group === g).length)));
        el.append(b);
      });
      return current;
    }
    sel.addEventListener("change", () => { if (isNew()) open("new"); else close(); });
    $(p + "GrpRen").addEventListener("click", () => open("rename"));
    $(p + "GrpDel").addEventListener("click", remove);
    $(p + "GrpAdd").addEventListener("click", () => { if (confirm() !== null) sel.focus(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (confirm() !== null) sel.focus();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (mode === "new") sel.value = "";
        close();
        sel.focus();
      }
    });
    return { of, name, fill, sync, close, confirm, row, get mode() { return mode; } };
  }

  /* ---------- data ---------- */
  // Word groups: the dictionary's sub-tabs, picked in the add form.
  const WGROUPS = {
    nom: { kan: "名詞", name: "Nouns" },
    verb: { kan: "動詞", name: "Verbs" },
    adj: { kan: "形容詞", name: "Adjectives" },
    adv: { kan: "副詞", name: "Adverbs" },
    expr: { kan: "表現", name: "Expressions" }
  };
  // Each word group's tag colour, an index into the --g0…--g7 tokens: built-in groups in order, custom ones by a
  // hash of their name, so a group keeps its colour when others are added.
  function groupHue(g) {
    const i = Object.keys(WGROUPS).indexOf(g);
    if (i >= 0) return i;
    let h = 0;
    for (const ch of g) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    return h % 8;
  }
  const wg = groupKit({
    builtIn: WGROUPS, store: "diccionari-japones-grups-paraules", p: "f", noun: "words",
    items: () => words,
    render: () => renderList(),
    commit: () => { save(); renderList(); refreshBackup(); },
    moved: (from, to) => { if (wGroup === from) wGroup = to; },
    hint: (m) => updateHint(m),
    status: (m, undo) => flash($("status"), m, undo)
  });
  function clean(a) {
    if (!Array.isArray(a)) return null;
    const out = [];
    for (const w of a) {
      if (!w || typeof w.jp !== "string" || typeof w.ca !== "string") continue;
      const jp = w.jp.trim().normalize("NFC");
      const ca = w.ca.trim();
      if (!jp || !ca) continue;
      const kana = typeof w.kana === "string" ? w.kana.trim().normalize("NFC") : "";
      out.push({ id: uid(), jp, kana, romaji: typeof w.romaji === "string" ? w.romaji.trim() : "", ca, reg: regOf(w.reg), group: wg.of(w.group) });
    }
    return out;
  }
  const unsaved = { words: false, notes: false }; // still showing the examples, see seedFromRepo()
  let dir = null; // folder linked for auto-save, see "auto-save to a folder"
  let dirQueue = Promise.resolve();
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const c = clean(JSON.parse(raw)); if (c) return c; }
    } catch (e) { /* storage unavailable: start from the examples */ }
    unsaved.words = true;
    return SEED.map(([jp, kana, romaji, ca, group]) => ({ id: uid(), jp, kana, romaji, ca, reg: "", group }));
  }
  // Stored without ids; reg and group only when set.
  function plain() {
    return sorted().map(({ jp, kana, romaji, ca, reg, group }) => {
      const o = { jp, kana, romaji, ca };
      if (reg) o.reg = reg;
      if (group) o.group = group;
      return o;
    });
  }
  function save() {
    unsaved.words = false;
    try { localStorage.setItem(KEY, JSON.stringify(plain())); } catch (e) { /* ignore */ }
    toFolder("words.json", wordsJson);
  }
  let words = load();
  const sortKey = (w) => norm(w.romaji || w.kana || w.jp);
  function sorted() {
    return [...words].sort((a, b) => sortKey(a).localeCompare(sortKey(b), "en") || a.jp.localeCompare(b.jp, "ja"));
  }
  // The list's column sort. Saving keeps the default romaji order (sorted()); only the table follows this.
  const ORDER_KEY = "diccionari-japones-ordre";
  const ORDERS = {
    kana: [(w) => w.kana || w.jp, "ja"],
    jp: [(w) => w.jp, "ja"],
    romaji: [sortKey, "en"],
    ca: [(w) => norm(w.ca), "en"],
  };
  let order = { key: "romaji", dir: 1 };
  try {
    const o = JSON.parse(localStorage.getItem(ORDER_KEY));
    if (o && ORDERS[o.key] && (o.dir === 1 || o.dir === -1)) order = { key: o.key, dir: o.dir };
  } catch (e) { /* ignore */ }
  function listed() {
    const [get, loc] = ORDERS[order.key];
    // Ties keep the default order, whichever way the column runs.
    return sorted().map((w, i) => [w, i]).sort((a, b) => order.dir * get(a[0]).localeCompare(get(b[0]), loc) || a[1] - b[1]).map(([w]) => w);
  }
  function setOrder(key) {
    order = { key, dir: order.key === key ? -order.dir : 1 };
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(order)); } catch (e) { /* ignore */ }
    renderList();
  }
  function renderSortbar() {
    for (const b of $("sortbar").querySelectorAll(".sorth")) {
      const on = b.dataset.sort === order.key;
      const th = b.parentElement;
      if (on) th.setAttribute("aria-sort", order.dir > 0 ? "ascending" : "descending");
      else th.removeAttribute("aria-sort");
      b.title = "Sort by " + b.textContent + (on && order.dir > 0 ? ", descending" : ", ascending");
    }
  }

  /* ---------- stroke player ---------- */
  let strokes = [], cells = [], selChar = -1, N = 0, t = 0, target = 0, last = 0, raf = 0;
  let moving = false, playing = false, showNums = true, speed = 1, selId = null;

  function svgEl(name, attrs) {
    const el = document.createElementNS(NS, name);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function buildStage(jp) {
    const stage = $("stage");
    stage.textContent = "";
    strokes = [];
    cells = [];
    selChar = -1;
    stage.setAttribute("aria-label", "Stroke order of " + jp);
    const chars = [...jp.normalize("NFC")].filter((c) => !/\s/.test(c));
    stage.style.setProperty("--cols", chars.length === 4 ? 2 : Math.min(3, chars.length) || 1);
    chars.forEach((ch) => {
      const data = STROKES[ch] || fetched[ch];
      const cell = document.createElement(data ? "button" : "div");
      cell.className = "cell";
      const svg = svgEl("svg", { viewBox: "0 0 109 109", "aria-hidden": "true" });
      svg.append(
        svgEl("rect", { class: "frame", x: 0.6, y: 0.6, width: 107.8, height: 107.8 }),
        svgEl("line", { class: "guide", x1: 54.5, y1: 0, x2: 54.5, y2: 109 }),
        svgEl("line", { class: "guide", x1: 0, y1: 54.5, x2: 109, y2: 54.5 })
      );
      if (data) {
        const ghost = svgEl("g", { class: "ghost" });
        const ink = svgEl("g", { class: "ink" });
        const nums = svgEl("g", { class: "nums" });
        data.forEach(([d, nx, ny], i) => {
          ghost.append(svgEl("path", { d }));
          const p = svgEl("path", { d, pathLength: 1 });
          ink.append(p);
          const tx = svgEl("text", { x: nx, y: ny });
          tx.textContent = String(i + 1);
          nums.append(tx);
          strokes.push({ p, tx });
        });
        svg.append(ghost, ink, nums);
        const from = strokes.length - data.length, to = strokes.length;
        cell.type = "button";
        cell.setAttribute("aria-label", "Play the strokes of " + ch);
        cell.title = "Play the strokes of " + ch;
        const k = cells.length;
        cell.setAttribute("aria-pressed", "false");
        cell.addEventListener("click", () => playChar(k));
        cells.push({ cell, ch, from, to });
      } else {
        const g = svgEl("text", { class: "ph", x: 54.5, y: 76 });
        g.textContent = ch;
        const c = svgEl("text", { class: "phcap", x: 54.5, y: 100 });
        c.textContent = kvgPending.has(ch) ? "loading…" : "no strokes";
        svg.append(g, c);
      }
      cell.append(svg);
      stage.append(cell);
    });
    N = strokes.length;
  }

  function render() {
    const done = Math.min(N, Math.floor(t + EPS));
    const cur = t >= N - EPS ? -1 : Math.ceil(t - EPS) - 1;
    strokes.forEach((s, i) => {
      const raw = Math.max(0, Math.min(1, (t - i) / 0.8));
      const f = reduce.matches ? (t > i + EPS ? 1 : 0) : ease(raw);
      s.p.style.strokeDashoffset = String(1 - f);
      s.p.style.visibility = f > 0 ? "visible" : "hidden";
      s.p.classList.toggle("cur", i === cur);
      s.tx.style.visibility = showNums && t > i + EPS ? "visible" : "hidden";
    });
    if (cur >= 0) selChar = cells.findIndex((c) => cur >= c.from && cur < c.to);
    cells.forEach((c, k) => c.cell.setAttribute("aria-pressed", String(k === selChar)));
    $("charnav").hidden = cells.length < 2;
    $("charPos").innerHTML = "";
    if (selChar >= 0) {
      const b = document.createElement("b");
      b.lang = "ja";
      b.textContent = cells[selChar].ch;
      $("charPos").append(b, (selChar + 1) + " / " + cells.length);
    } else {
      $("charPos").textContent = cells.length + " characters";
    }
    $("bPrevC").disabled = selChar <= 0;
    $("bNextC").disabled = selChar >= cells.length - 1;
    const sc = $("scrub");
    sc.max = String(N);
    sc.value = String(done);
    sc.disabled = N === 0;
    $("count").textContent = N ? done + " / " + N + " strokes" : "";
    $("bReset").disabled = N === 0;
    $("bBack").disabled = t <= EPS;
    $("bFwd").disabled = N === 0 || t >= N - EPS;
    $("bPlay").disabled = N === 0;
  }

  function updatePlayBtn() {
    // SVG elements have no .hidden property, so toggle the attribute.
    $("icPlay").toggleAttribute("hidden", playing);
    $("icPause").toggleAttribute("hidden", !playing);
    $("playLabel").textContent = playing ? "Pause" : "Play";
  }

  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const dir = Math.sign(target - t);
    t += dir * (speed / 0.9) * dt;
    if ((dir > 0 && t >= target) || (dir < 0 && t <= target) || dir === 0) {
      t = target;
      moving = false;
      playing = false;
      updatePlayBtn();
    }
    render();
    if (moving) raf = requestAnimationFrame(tick);
  }
  function start() {
    moving = true;
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }
  function pause() {
    moving = false;
    playing = false;
    cancelAnimationFrame(raf);
    updatePlayBtn();
  }
  function play() {
    if (!N) return;
    if (t >= N - EPS) t = 0;
    target = N;
    playing = true;
    updatePlayBtn();
    start();
  }
  // Replays one character: strokes before it stay drawn, the ones after it are cleared.
  function playChar(k) {
    const c = cells[k];
    if (!c) return;
    pause();
    selChar = k;
    t = c.from;
    target = c.to;
    render();
    playing = true;
    updatePlayBtn();
    start();
  }
  function restart() {
    pause();
    t = 0;
    selChar = -1;
    play();
  }
  function stepForward() {
    pause();
    if (t >= N - EPS) return;
    target = Math.floor(t + EPS) + 1;
    start();
  }
  function stepBack() {
    pause();
    t = Math.max(0, Math.ceil(t - EPS) - 1);
    render();
  }

  /* Characters missing from STROKES are fetched from KanjiVG on demand and cached in localStorage. */
  const KVG_KEY = "diccionari-japones-kanjivg";
  const KVG_URL = "https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@master/kanji/";
  let fetched = {};
  try { fetched = JSON.parse(localStorage.getItem(KVG_KEY)) || {}; } catch (e) { /* ignore */ }
  const kvgPending = new Map(), kvgMissing = new Set();
  function kvgFetch(ch) {
    if (kvgPending.has(ch)) return kvgPending.get(ch);
    const hex = ch.codePointAt(0).toString(16).padStart(5, "0");
    const pr = fetch(KVG_URL + hex + ".svg")
      .then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
      .then((txt) => {
        const doc = new DOMParser().parseFromString(txt, "image/svg+xml");
        const paths = [...doc.querySelectorAll("path[d]")];
        const nums = [...doc.querySelectorAll("text")];
        if (!paths.length) throw new Error("no strokes");
        fetched[ch] = paths.map((p, i) => {
          const m = /matrix\(1 0 0 1 ([\d.]+) ([\d.]+)\)/.exec((nums[i] && nums[i].getAttribute("transform")) || "");
          return [p.getAttribute("d"), m ? Number(m[1]) : 0, m ? Number(m[2]) : 0];
        });
        try { localStorage.setItem(KVG_KEY, JSON.stringify(fetched)); } catch (e) { /* ignore */ }
        return true;
      })
      .catch(() => { kvgMissing.add(ch); return false; })
      .finally(() => kvgPending.delete(ch));
    kvgPending.set(ch, pr);
    return pr;
  }
  function loadMissing(w) {
    const need = [...new Set(w.jp.normalize("NFC"))].filter((ch) =>
      !/\s/.test(ch) && !STROKES[ch] && !fetched[ch] && !kvgMissing.has(ch) && /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/.test(ch));
    if (!need.length) return;
    Promise.all(need.map(kvgFetch)).then((got) => {
      if (selId !== w.id || !got.some(Boolean)) return;
      const was = playing;
      pause();
      buildStage(w.jp);
      t = was ? 0 : N;
      render();
      if (was) play();
    });
  }

  function select(id, opts) {
    opts = opts || {};
    pause();
    const w = words.find((x) => x.id === id);
    selId = w ? w.id : null;
    if (!w) {
      $("pJp").textContent = "";
      $("pKa").textContent = "";
      $("pRo").textContent = "";
      $("pCa").textContent = "";
      $("pReg").hidden = true;
      $("stage").textContent = "";
      $("stage").setAttribute("aria-label", "");
      cells = [];
      const p = document.createElement("p");
      p.className = "stage-empty";
      p.textContent = "Add a word to see its strokes.";
      $("stage").append(p);
      strokes = []; N = 0; t = 0;
      render();
      markRows();
      return;
    }
    $("pJp").textContent = w.jp;
    $("pKa").textContent = w.kana;
    $("pRo").textContent = w.romaji;
    $("pCa").textContent = w.ca;
    showReg(w);
    loadMissing(w); // before buildStage, so pending cells say "loading…"
    buildStage(w.jp);
    t = N;
    render();
    markRows();
    if (opts.autoplay && !reduce.matches && N > 0) { t = 0; render(); play(); }
  }

  // The player's register badge doubles as a button that cycles Any → Honorific → Casual.
  function showReg(w) {
    const b = $("pReg");
    b.hidden = false;
    b.className = "reg " + (w.reg || "none");
    b.textContent = "";
    if (w.reg) {
      b.append(...regBadge(w.reg).childNodes);
      b.title = REG[w.reg].title + ". Click to change.";
    } else {
      b.textContent = "+ Register";
      b.title = "Mark as honorific or casual";
    }
    b.setAttribute("aria-label", "Register: " + (w.reg ? REG[w.reg].name : "not set") + ". Change it");
  }
  $("pReg").addEventListener("click", () => {
    const w = words.find((x) => x.id === selId);
    if (!w) return;
    w.reg = w.reg === "" ? "hon" : w.reg === "hon" ? "cas" : "";
    save();
    renderList();
    refreshBackup();
    showReg(w);
    status(w.reg ? "Marked “" + w.jp + "” as " + REG[w.reg].name.toLowerCase() + "." : "Cleared the register of “" + w.jp + "”.");
  });

  /* ---------- audio ---------- */
  const tts = "speechSynthesis" in window ? window.speechSynthesis : null;
  const VOICE_KEY = "diccionari-japones-veu";
  let jaVoices = [], jaVoice = null;
  // Neural and cloud voices sound far more natural than the default compact ones, so they go first.
  function voiceScore(v) {
    if (/natural|online|neural/i.test(v.name)) return 3;
    if (/premium|enhanced|millorad|mejorad/i.test(v.name)) return 2;
    if (/google/i.test(v.name)) return 1;
    return 0;
  }
  function loadVoices() {
    jaVoices = tts.getVoices()
      .filter((v) => /^ja([-_]|$)/i.test(v.lang))
      .sort((a, b) => voiceScore(b) - voiceScore(a) || a.name.localeCompare(b.name));
    let saved = null;
    try { saved = localStorage.getItem(VOICE_KEY); } catch (err) { /* ignore */ }
    jaVoice = jaVoices.find((v) => v.voiceURI === saved) || jaVoices[0] || null;
    const sel = $("voice");
    sel.textContent = "";
    jaVoices.forEach((v) => {
      const o = document.createElement("option");
      o.value = v.voiceURI;
      o.textContent = v.name;
      sel.append(o);
    });
    if (jaVoice) sel.value = jaVoice.voiceURI;
    $("voiceOpt").hidden = !jaVoices.length;
  }
  if (tts) {
    loadVoices();
    tts.onvoiceschanged = loadVoices;
    $("voice").addEventListener("change", (e) => {
      jaVoice = jaVoices.find((v) => v.voiceURI === e.target.value) || null;
      try { localStorage.setItem(VOICE_KEY, jaVoice ? jaVoice.voiceURI : ""); } catch (err) { /* ignore */ }
      // Preview the new voice with the word in the player.
      const w = words.find((x) => x.id === selId);
      if (w) speak(w);
    });
  }
  function speak(w, btn) {
    tts.cancel();
    if (tts.getVoices().length && !jaVoices.length) (tab === "notes" ? noteStatus : status)("This browser has no Japanese voice installed.");
    // The furigana is unambiguous, so prefer it over the kanji when there is one.
    const u = new SpeechSynthesisUtterance(w.kana || w.jp);
    u.lang = "ja-JP";
    if (jaVoice) u.voice = jaVoice;
    u.rate = 0.9;
    document.querySelectorAll(".say.on").forEach((b) => b.classList.remove("on"));
    if (btn) {
      btn.classList.add("on");
      u.onend = u.onerror = () => btn.classList.remove("on");
    }
    tts.speak(u);
  }

  /* ---------- dictionary list ---------- */
  let query = "", wGroup = "all";
  let lastRemoved = null;
  let editWordId = null;
  const flashTimers = new WeakMap();

  // Shows a message in a status line for a few seconds, with an optional "Undo" button.
  function flash(el, msg, onUndo) {
    el.textContent = "";
    clearTimeout(flashTimers.get(el));
    if (!msg) return;
    const span = document.createElement("span");
    span.textContent = msg;
    el.append(span);
    if (onUndo) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "Undo";
      b.addEventListener("click", onUndo);
      el.append(b);
    }
    flashTimers.set(el, setTimeout(() => { el.textContent = ""; }, 9000));
  }
  const status = (msg, undo) => flash($("status"), msg, undo && undoRemove);

  function markRows() {
    document.querySelectorAll("#rows tr[data-id]").forEach((tr) => {
      const on = tr.dataset.id === selId;
      tr.classList.toggle("sel", on);
      const b = tr.querySelector(".rowbtn");
      if (on) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current");
    });
  }

  function renderList(freshId) {
    const q = norm(query.trim());
    const qjp = query.trim().normalize("NFC");
    const all = listed();
    renderSortbar();
    wGroup = wg.row($("wgroups"), all, wGroup);
    wg.fill();
    const inGroup = wGroup === "all" ? all : all.filter((w) => w.group === wGroup);
    const shown = !q ? inGroup : inGroup.filter((w) => w.jp.includes(qjp) || w.kana.includes(qjp) || norm(w.romaji).includes(q) || norm(w.ca).includes(q) || (w.reg && (norm(regText(w.reg)).includes(q) || regText(w.reg).includes(qjp))) || (w.group && norm(wg.name(w.group)).includes(q)));
    const body = $("rows");
    body.textContent = "";
    if (!shown.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.className = "none";
      td.textContent = !all.length ? "No words yet. Add one with the form."
        : q ? "No words match “" + query.trim() + "”."
        : "No words in this group yet.";
      tr.append(td);
      body.append(tr);
    }
    shown.forEach((w) => {
      const tr = document.createElement("tr");
      tr.dataset.id = w.id;
      if (w.id === freshId) tr.classList.add("fresh");
      if (w.id === editWordId) tr.classList.add("editing");
      const a = document.createElement("td");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rowbtn";
      btn.lang = "ja";
      // The furigana leads; words without one show the Japanese there instead of repeating it.
      btn.textContent = w.kana || w.jp;
      if (w.reg) a.append(regDot(w.reg));
      a.append(btn);
      const k = document.createElement("td");
      k.className = "jp";
      k.lang = "ja";
      k.textContent = w.kana ? w.jp : "";
      const r = document.createElement("td");
      r.className = "ro";
      r.textContent = w.romaji;
      const c = document.createElement("td");
      c.textContent = w.ca;
      // While every word is listed, a tag names the word's group; clicking it filters the list to that group.
      if (w.group && wGroup === "all") {
        const g = node("button", "wgrp", wg.name(w.group));
        g.type = "button";
        g.dataset.g = w.group;
        g.title = "Show only " + wg.name(w.group);
        g.style.setProperty("--tag", "var(--g" + groupHue(w.group) + ")");
        c.append(" ", g);
      }
      const x = document.createElement("td");
      x.className = "act";
      const del = document.createElement("button");
      del.type = "button";
      del.className = "del";
      del.setAttribute("aria-label", "Delete " + w.jp);
      del.title = "Delete";
      del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      if (tts) {
        const say = document.createElement("button");
        say.type = "button";
        say.className = "say";
        say.setAttribute("aria-label", "Listen to " + w.jp);
        say.title = "Listen";
        say.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
        x.append(say);
      }
      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "edit";
      edit.setAttribute("aria-label", "Edit " + w.jp);
      edit.title = "Edit";
      edit.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>';
      x.append(edit, del);
      tr.append(a, k, r, c, x);
      body.append(tr);
    });
    const part = q || wGroup !== "all";
    $("total").textContent = (part ? shown.length + " of " + all.length : all.length) + (all.length === 1 && !part ? " word" : " words");
    markRows();
    if (freshId) setTimeout(() => { const el = body.querySelector("tr.fresh"); if (el) el.classList.remove("fresh"); }, 1700);
  }

  const wordsJson = () => JSON.stringify(plain(), null, 2);
  function refreshBackup() { $("backup").value = wordsJson(); }

  function removeWord(id) {
    const index = words.findIndex((w) => w.id === id);
    if (index < 0) return;
    const removed = words.splice(index, 1)[0];
    lastRemoved = { w: removed, index };
    if (editWordId === id) cancelEdit();
    save();
    renderList();
    refreshBackup();
    if (selId === id) { const s = listed(); select(s.length ? s[0].id : null); }
    status("Deleted “" + removed.jp + "”.", true);
  }
  function undoRemove() {
    if (!lastRemoved) return;
    words.splice(Math.min(lastRemoved.index, words.length), 0, lastRemoved.w);
    const id = lastRemoved.w.id;
    const jp = lastRemoved.w.jp;
    lastRemoved = null;
    save();
    renderList(id);
    refreshBackup();
    select(id);
    status("Restored “" + jp + "”.");
  }

  $("rows").addEventListener("click", (e) => {
    const del = e.target.closest(".del");
    if (del) { removeWord(del.closest("tr").dataset.id); return; }
    const edit = e.target.closest(".edit");
    if (edit) { startEdit(edit.closest("tr").dataset.id); return; }
    const say = e.target.closest(".say");
    if (say) { const w = words.find((x) => x.id === say.closest("tr").dataset.id); if (w) speak(w, say); return; }
    const grp = e.target.closest(".wgrp");
    if (grp) { wGroup = grp.dataset.g; renderList(); return; }
    const tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    showPlayer(true);
    select(tr.dataset.id, { autoplay: true });
    if (window.matchMedia("(max-width: 860px)").matches) {
      $("stage").closest(".player").scrollIntoView({ behavior: reduce.matches ? "auto" : "smooth", block: "start" });
    }
  });

  /* ---------- add form ---------- */
  function missingFor(jp) {
    const miss = [];
    for (const ch of [...jp.normalize("NFC")]) {
      if (/\s/.test(ch) || STROKES[ch] || fetched[ch] || miss.includes(ch)) continue;
      miss.push(ch);
    }
    return miss;
  }
  const keys = Object.keys(STROKES);
  const kanjiCount = keys.filter((k) => k.codePointAt(0) >= 0x4e00).length;
  $("coverage").textContent = "Strokes available for every kana and " + kanjiCount + " basic kanji. Other kanji are downloaded from KanjiVG when shown.";
  function updateHint(err) {
    const h = $("hint");
    h.classList.toggle("err", !!err);
    if (err) { h.textContent = err; return; }
    const miss = missingFor($("fJp").value);
    h.textContent = miss.length
      ? "Stroke order for " + miss.join(" ") + " will be downloaded from KanjiVG (if it exists there). The word will be saved either way."
      : "Type the romaji and pick the hiragana, katakana or kanji. Furigana and romaji are optional.";
  }
  $("fJp").addEventListener("input", () => updateHint());

  /* ---------- romaji → kana / kanji suggestions ---------- */
  // Hepburn and wāpuro spellings. Long vowels (ō, â…) become a doubled vowel in hiragana and ー in katakana.
  const ROMA = (() => {
    const t = {
      a: "あ", i: "い", u: "う", e: "え", o: "お",
      ka: "か", ki: "き", ku: "く", ke: "け", ko: "こ", ga: "が", gi: "ぎ", gu: "ぐ", ge: "げ", go: "ご",
      sa: "さ", shi: "し", si: "し", su: "す", se: "せ", so: "そ", za: "ざ", ji: "じ", zi: "じ", zu: "ず", ze: "ぜ", zo: "ぞ",
      ta: "た", chi: "ち", ti: "ち", tsu: "つ", tu: "つ", te: "て", to: "と", da: "だ", di: "ぢ", du: "づ", de: "で", do: "ど",
      na: "な", ni: "に", nu: "ぬ", ne: "ね", no: "の",
      ha: "は", hi: "ひ", fu: "ふ", hu: "ふ", he: "へ", ho: "ほ", ba: "ば", bi: "び", bu: "ぶ", be: "べ", bo: "ぼ",
      pa: "ぱ", pi: "ぴ", pu: "ぷ", pe: "ぺ", po: "ぽ",
      ma: "ま", mi: "み", mu: "む", me: "め", mo: "も", ya: "や", yu: "ゆ", yo: "よ",
      ra: "ら", ri: "り", ru: "る", re: "れ", ro: "ろ", wa: "わ", wo: "を", wi: "うぃ", we: "うぇ",
      sha: "しゃ", shu: "しゅ", sho: "しょ", she: "しぇ", cha: "ちゃ", chu: "ちゅ", cho: "ちょ", che: "ちぇ",
      ja: "じゃ", ju: "じゅ", jo: "じょ", je: "じぇ", tsa: "つぁ", fa: "ふぁ", fi: "ふぃ", fe: "ふぇ", fo: "ふぉ",
      thi: "てぃ", dhi: "でぃ", va: "ゔぁ", vi: "ゔぃ", vu: "ゔ", ve: "ゔぇ", vo: "ゔぉ",
      xa: "ぁ", xi: "ぃ", xu: "ぅ", xe: "ぇ", xo: "ぉ", xya: "ゃ", xyu: "ゅ", xyo: "ょ", xtsu: "っ", xtu: "っ", xwa: "ゎ"
    };
    const yo = { k: "き", g: "ぎ", n: "に", h: "ひ", b: "び", p: "ぴ", m: "み", r: "り", sy: "し", ty: "ち", cy: "ち", zy: "じ", jy: "じ", dy: "ぢ" };
    for (const [c, k] of Object.entries(yo)) {
      const y = c.endsWith("y") ? c : c + "y";
      t[y + "a"] = k + "ゃ"; t[y + "u"] = k + "ゅ"; t[y + "o"] = k + "ょ";
    }
    for (const k of Object.keys(t)) if (k[0] === "x") t["l" + k.slice(1)] = t[k];
    for (const k of Object.keys(t)) if (k[0] === "r") t["l" + k.slice(1)] ||= t[k];
    return t;
  })();
  const LONG = { "ā": "a", "â": "a", "ī": "i", "î": "i", "ū": "u", "û": "u", "ē": "e", "ê": "e", "ō": "o", "ô": "o" };
  const LONG_HIRA = { a: "あ", i: "い", u: "う", e: "え", o: "う" };
  const PUNCT = { ".": "。", ",": "、", "?": "？", "!": "！" };
  const isVowel = (c) => "aiueo".includes(c);
  // Returns the kana spelling, or "" when part of the input can't be read as romaji.
  function romajiToKana(input, kata) {
    const s = input.normalize("NFC").toLowerCase().replace(/\s+/g, "");
    let out = "";
    for (let i = 0; i < s.length;) {
      const c = s[i];
      if (LONG[c]) {
        const v = LONG[c];
        out += ROMA[v] + (kata ? "ー" : LONG_HIRA[v]);
        i++; continue;
      }
      if (c === "-" || c === "ー") { out += "ー"; i++; continue; }
      if (PUNCT[c]) { out += PUNCT[c]; i++; continue; }
      if (c === "n") {
        const nx = s[i + 1];
        if (nx === "'") { out += "ん"; i += 2; continue; }
        if (nx === "n" && !(isVowel(s[i + 2]) || s[i + 2] === "y" || LONG[s[i + 2]])) { out += "ん"; i += 2; continue; }
        if (nx === undefined || !(isVowel(nx) || nx === "y" || LONG[nx])) { out += "ん"; i++; continue; }
      }
      // Doubled consonant (gakkō, matcha) → small っ.
      if (/[bcdfghjkmpqrstvwxyz]/.test(c) && (s[i + 1] === c || (c === "t" && s[i + 1] === "c"))) { out += "っ"; i++; continue; }
      let hit = false;
      for (let len = 4; len >= 1; len--) {
        let key = s.slice(i, i + len);
        const last = key[key.length - 1];
        const long = LONG[last];
        if (long) key = key.slice(0, -1) + long;
        if (ROMA[key]) {
          out += ROMA[key] + (long ? (kata ? "ー" : LONG_HIRA[long]) : "");
          i += len; hit = true; break;
        }
      }
      if (!hit) return "";
    }
    if (!kata) return out;
    return out.replace(/[ぁ-ゖ]/g, (k) => String.fromCharCode(k.charCodeAt(0) + 0x60));
  }

  // Whole sentences: words are separated by spaces, so the particles wa, o and e can be spelt は, を and へ.
  const PARTICLE = { wa: "は", o: "を", e: "へ" };
  const FIXED = { konnichiwa: "こんにちは", konbanwa: "こんばんは", dewa: "では" };
  // Line breaks are kept: each line is converted on its own.
  function phraseToKana(input) {
    const lines = input.split("\n").map((l) => l.trim()).filter(Boolean);
    const out = lines.map(lineToKana);
    return out.includes("") ? "" : out.join("\n");
  }
  function lineToKana(line) {
    let out = "";
    for (const tok of line.split(/\s+/)) {
      const m = /^([^.,?!]+)([.,?!]*)$/.exec(tok.toLowerCase());
      const fixed = m && (PARTICLE[m[1]] || FIXED[m[1]]);
      const k = fixed ? fixed + romajiToKana(m[2], false) : romajiToKana(tok, false);
      if (!k) return "";
      out += k;
    }
    return out;
  }

  // Kanji candidates come from Google Input Tools (the same conversion as Google's Japanese IME).
  // Without a connection the list falls back to words already in the dictionary with that reading.
  const IME = "https://inputtools.google.com/request?itc=ja-t-ja-hira-i0-und&num=8&cp=0&cs=1&ie=utf-8&oe=utf-8&text=";
  const imeCache = new Map();
  let imeCtl = null;
  // All candidates that convert the whole input, best first.
  async function imeLookup(hira, signal) {
    if (imeCache.has(hira)) return imeCache.get(hira);
    const r = await fetch(IME + encodeURIComponent(hira), { signal });
    const data = await r.json();
    const [, [[, cands = [], , meta = {}] = []] = []] = data;
    const full = meta.matched_length;
    const out = cands.filter((c, i) => !full || full[i] === hira.length);
    imeCache.set(hira, out);
    return out;
  }
  async function kanjiFor(hira) {
    if (imeCtl) imeCtl.abort();
    imeCtl = new AbortController();
    const cands = await imeLookup(hira, imeCtl.signal);
    return cands.filter((c) => /\p{Script=Han}/u.test(c) && /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々]+$/u.test(c));
  }

  let suggFor = "";
  let suggTimer = 0;
  function suggChip(text, kind, hira) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.setAttribute("aria-pressed", String($("fJp").value.trim() === text));
    const w = document.createElement("span");
    w.className = "w"; w.lang = "ja"; w.textContent = text;
    const n = document.createElement("span");
    n.className = "n"; n.textContent = kind;
    b.append(w, n);
    b.addEventListener("click", () => {
      $("fJp").value = text;
      $("fKa").value = kind === "kanji" ? hira : "";
      document.querySelectorAll("#suggChips .chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
      updateHint();
      $("fCa").focus();
    });
    return b;
  }
  function renderSugg(hira, kanji) {
    const box = $("suggChips");
    box.replaceChildren();
    if (!hira) { $("sugg").hidden = true; return; }
    const kata = romajiToKana($("fRo").value, false) === hira
      ? romajiToKana($("fRo").value, true)
      : hira.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
    box.append(suggChip(hira, "hiragana", hira), suggChip(kata, "katakana", hira));
    for (const k of kanji) box.append(suggChip(k, "kanji", hira));
    $("sugg").hidden = false;
  }
  function updateSugg() {
    const hira = romajiToKana($("fRo").value, false);
    if (hira === suggFor) return;
    suggFor = hira;
    clearTimeout(suggTimer);
    const local = [...new Set(words.filter((w) => w.kana === hira && w.jp !== hira).map((w) => w.jp))];
    renderSugg(hira, local);
    if (!hira) return;
    suggTimer = setTimeout(() => {
      kanjiFor(hira).then((found) => {
        if (suggFor === hira) renderSugg(hira, [...new Set(local.concat(found))].slice(0, 6));
      }, () => {});
    }, 250);
  }
  $("fRo").addEventListener("input", updateSugg);
  const toHira = (str) => str.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  // Hiragana reading of a field that may hold hiragana, katakana or romaji; "" when it holds anything else.
  function readingOf(raw) {
    const h = /[a-zāīūēō]/i.test(raw) ? romajiToKana(raw, false) : toHira(raw);
    return /^[ぁ-ゖー]+$/.test(h) ? h : "";
  }
  // Kana → kanji (Google Input Tools): fills the Japanese with the best match and lists the rest as chips.
  async function fillKanji(hira, btn) {
    suggFor = hira;
    clearTimeout(suggTimer);
    btn.disabled = true;
    try {
      const found = await kanjiFor(hira);
      const local = words.filter((w) => w.kana === hira && w.jp !== hira).map((w) => w.jp);
      const all = [...new Set(local.concat(found))].slice(0, 6);
      renderSugg(hira, all);
      if (all.length) {
        $("fJp").value = all[0];
        document.querySelectorAll("#suggChips .chip").forEach((c) => c.setAttribute("aria-pressed", String(c.querySelector(".w").textContent === all[0])));
        updateHint();
      } else updateHint("No kanji found for " + hira + ". Pick a kana spelling or type the kanji by hand.");
    } catch (err) {
      if (err.name !== "AbortError") updateHint("Couldn't reach the kanji service. Check the connection or type the kanji by hand.");
    } finally {
      btn.disabled = false;
    }
  }
  $("fGen").addEventListener("click", () => {
    const raw = $("fKa").value.trim().normalize("NFC");
    const hira = readingOf(raw);
    if (!hira) {
      updateHint(raw ? "Couldn't read the furigana. Type it in hiragana." : "Type the furigana in hiragana first.");
      $("fKa").focus();
      return;
    }
    $("fKa").value = hira;
    fillKanji(hira, $("fGen"));
  });
  $("fJp").addEventListener("input", () => {
    const v = $("fJp").value.trim();
    document.querySelectorAll("#suggChips .chip").forEach((c) => c.setAttribute("aria-pressed", String(c.querySelector(".w").textContent === v)));
  });

  /* ---------- editing ---------- */
  // Editing reuses the add form: it fills it with the word, and "Save" updates the word in place.
  function setEditing(id) {
    editWordId = id;
    const on = !!id;
    $("form").classList.toggle("editing", on);
    $("fKan").textContent = on ? "編集" : "追加";
    $("fHead").textContent = on ? "Edit word" : "Add a word";
    $("fSubmit").textContent = on ? "Save" : "Add";
    document.querySelectorAll("#rows tr[data-id]").forEach((tr) => tr.classList.toggle("editing", tr.dataset.id === id));
  }
  function startEdit(id) {
    const w = words.find((x) => x.id === id);
    if (!w) return;
    setEditing(id);
    $("fJp").value = w.jp;
    $("fKa").value = w.kana;
    $("fRo").value = w.romaji;
    $("fCa").value = w.ca;
    document.querySelector('input[name=freg][value="' + (w.reg || "") + '"]').checked = true;
    wg.close();
    $("fGroup").value = w.group;
    wg.sync();
    suggFor = romajiToKana(w.romaji, false);
    $("suggChips").replaceChildren();
    $("sugg").hidden = true;
    updateHint();
    openForm();
  }
  function cancelEdit() {
    if (!editWordId) return;
    setEditing(null);
    $("form").reset();
    wg.close();
    updateSugg();
    updateHint();
    closeForm();
  }

  /* ---------- add/edit popup ---------- */
  // The word form and the note composer each live in a modal <dialog>: Escape, the × and Cancel close it,
  // and so does a click on the blurred backdrop. onClose runs on every close (it drops an edit in progress).
  function popup(dlg, onClose) {
    const close = () => { if (dlg.open) dlg.close(); };
    dlg.addEventListener("close", onClose);
    // Only a press that starts and ends on the backdrop closes it, not a text selection or stroke dragged out of the form.
    let downOnBackdrop = false;
    dlg.addEventListener("pointerdown", (e) => { downOnBackdrop = e.target === dlg; });
    dlg.addEventListener("click", (e) => { if (downOnBackdrop && e.target === dlg) close(); });
    dlg.querySelectorAll(".pclose, [id$=Cancel]").forEach((b) => b.addEventListener("click", close));
    return { open(focusEl) { if (!dlg.open) dlg.showModal(); if (focusEl) focusEl.focus(); }, close };
  }
  // A half-typed new word is kept for next time.
  const wordPop = popup($("addDlg"), cancelEdit);
  const openForm = () => wordPop.open($("fJp"));
  const closeForm = wordPop.close;

  $("form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (wg.mode && wg.confirm() === null) return;
    const jp = $("fJp").value.trim().normalize("NFC");
    const ka = $("fKa").value.trim().normalize("NFC");
    const ro = $("fRo").value.trim();
    const ca = $("fCa").value.trim();
    const reg = regOf(document.querySelector("input[name=freg]:checked").value);
    const group = wg.of($("fGroup").value);
    if (!jp || !ca) {
      updateHint("Enter the Japanese word and its English meaning.");
      (jp ? $("fCa") : $("fJp")).focus();
      return;
    }
    const old = editWordId && words.find((x) => x.id === editWordId);
    const w = old ? Object.assign(old, { jp, kana: ka, romaji: ro, ca, reg, group }) : { id: uid(), jp, kana: ka, romaji: ro, ca, reg, group };
    if (!old) words.push(w);
    setEditing(null);
    save();
    $("form").reset();
    updateSugg();
    // Make sure the saved word is visible in the list.
    if (wGroup !== "all" && wGroup !== group) wGroup = "all";
    query = "";
    $("q").value = "";
    closeForm();
    renderList(w.id);
    refreshBackup();
    updateHint();
    select(w.id, { autoplay: true });
    status((old ? "Saved “" : "Added “") + jp + "”.");
  });

  /* ---------- backup ---------- */
  function backupMsg(m) { $("backupMsg").textContent = m; }
  function copyBackup(ta, msg) {
    const fallback = () => { ta.focus(); ta.select(); msg("Couldn't copy. The text is selected: copy it manually."); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(ta.value).then(() => msg("Copied."), fallback);
    } else fallback();
  }
  $("bCopy").addEventListener("click", () => copyBackup($("backup"), backupMsg));
  $("bLoad").addEventListener("click", () => {
    let c = null;
    try { const a = JSON.parse($("backup").value); c = clean(a); if (c && !c.length && a.length) c = null; } catch (e) { c = null; }
    if (!c) { backupMsg("Invalid JSON. Each word needs “jp” and “ca” (the English meaning)."); return; }
    words = c;
    lastRemoved = null;
    cancelEdit();
    save();
    renderList();
    refreshBackup();
    const s = listed();
    select(s.length ? s[0].id : null);
    backupMsg("Loaded " + c.length + (c.length === 1 ? " word." : " words."));
  });

  /* ---------- controls ---------- */
  $("bPlay").addEventListener("click", () => { if (playing) pause(); else play(); });
  $("bFwd").addEventListener("click", stepForward);
  $("bBack").addEventListener("click", stepBack);
  $("bReset").addEventListener("click", restart);
  $("bPrevC").addEventListener("click", () => playChar(selChar - 1));
  $("bNextC").addEventListener("click", () => playChar(selChar + 1));
  $("scrub").addEventListener("input", (e) => { pause(); t = Number(e.target.value); render(); });
  $("speed").addEventListener("change", (e) => { speed = Number(e.target.value); });
  $("nums").addEventListener("change", (e) => { showNums = e.target.checked; render(); });
  $("q").addEventListener("input", (e) => { query = e.target.value; renderList(); });
  $("wgroups").addEventListener("click", (e) => {
    const c = e.target.closest(".chip");
    if (c) { wGroup = c.dataset.g; renderList(); }
  });
  $("sortbar").addEventListener("click", (e) => { const b = e.target.closest(".sorth"); if (b) setOrder(b.dataset.sort); });

  /* ---------- closing the player ---------- */
  const PLAYER_KEY = "diccionari-japones-reproductor";
  function showPlayer(open, focus) {
    $("pDict").classList.toggle("solo", !open);
    $("pOpen").hidden = open;
    if (!open) pause();
    if (focus) $(open ? "pClose" : "pOpen").focus();
    try { localStorage.setItem(PLAYER_KEY, open ? "1" : "0"); } catch (e) { /* ignore */ }
  }
  $("pClose").addEventListener("click", () => showPlayer(false, true));
  $("pOpen").addEventListener("click", () => showPlayer(true, true));

  /* ---------- theme ---------- */
  // CSS Zen Garden style: "sakura" is style.css itself, every other option of #themeSel is css/themes/<name>.css
  // linked after it (link[data-skin]). index.html links the saved one (or DEFAULT_STYLE) before first paint. The new
  // sheet replaces the old one only once it has loaded, so switching doesn't flash the base design.
  const STYLE_KEY = "diccionari-japones-estil";
  const DEFAULT_STYLE = "shinbun";
  const THEMES = Array.from($("themeSel").options, (o) => o.value);
  let wantedStyle = "sakura";
  function setStyle(name, remember) {
    if (!THEMES.includes(name)) name = DEFAULT_STYLE;
    wantedStyle = name;
    $("themeSel").value = name;
    const root = document.documentElement;
    if (name === "sakura") delete root.dataset.style;
    else root.dataset.style = name;
    const skins = () => document.querySelectorAll("link[data-skin]");
    if (name === "sakura") skins().forEach((l) => l.remove());
    else if (!document.querySelector(`link[data-skin="${name}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `css/themes/${name}.css`;
      link.dataset.skin = name;
      const done = () => {
        if (wantedStyle !== name) link.remove();
        else skins().forEach((l) => { if (l !== link) l.remove(); });
      };
      link.addEventListener("load", done);
      link.addEventListener("error", done);
      document.head.appendChild(link);
    }
    if (remember) try { localStorage.setItem(STYLE_KEY, name); } catch (e) { /* ignore */ }
  }
  $("themeSel").addEventListener("change", (e) => setStyle(e.target.value, true));
  const savedStyle = document.documentElement.dataset.style || "sakura";
  setStyle(savedStyle, !THEMES.includes(savedStyle));

  /* ---------- tabs ---------- */
  const TAB_KEY = "diccionari-japones-pestanya";
  const TABS = { dict: $("tabDict"), notes: $("tabNotes") };
  let tab = "dict";
  function showTab(name, focus) {
    tab = TABS[name] ? name : "dict";
    for (const k in TABS) {
      const on = k === tab;
      TABS[k].setAttribute("aria-selected", String(on));
      TABS[k].tabIndex = on ? 0 : -1;
      $(TABS[k].getAttribute("aria-controls")).hidden = !on;
    }
    if (focus) TABS[tab].focus();
    // Nothing keeps drawing or speaking in a hidden tab.
    pause();
    if (tts) tts.cancel();
    try { localStorage.setItem(TAB_KEY, tab); } catch (e) { /* ignore */ }
  }
  $("tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[role=tab]");
    if (b) showTab(b.dataset.tab);
  });
  $("tabs").addEventListener("keydown", (e) => {
    const order = Object.keys(TABS);
    let i = order.indexOf(tab);
    if (e.key === "ArrowRight") i = (i + 1) % order.length;
    else if (e.key === "ArrowLeft") i = (i - 1 + order.length) % order.length;
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = order.length - 1;
    else return;
    e.preventDefault();
    showTab(order[i], true);
  });

  /* ---------- floating "Add word" button ---------- */
  $("fab").addEventListener("click", () => {
    showTab("dict");
    openForm();
  });

  /* ---------- notebook: grammar, sentences, drawings and notes ---------- */
  const NKEY = "diccionari-japones-apunts-v1";
  const NTYPES = {
    gram: { kan: "文法", name: "Grammar" },
    frase: { kan: "例文", name: "Sentence" },
    dibuix: { kan: "絵", name: "Drawing" },
    nota: { kan: "メモ", name: "Note" }
  };
  // Sentence groups, offered in the composer and as a sub-filter under the "Sentences" chip (see groupKit()).
  const SGROUPS = {
    aula: { kan: "教室", name: "Classroom instructions" },
    intro: { kan: "自己紹介", name: "Self-introduction" },
    salut: { kan: "挨拶", name: "Greetings" },
    compres: { kan: "買い物", name: "Shopping" },
    viatge: { kan: "旅行", name: "Travel" },
    dia: { kan: "日常", name: "Daily life" }
  };
  const sg = groupKit({
    builtIn: SGROUPS, store: "diccionari-japones-grups", p: "n", noun: "sentences",
    items: () => notes.filter((n) => n.type === "frase"),
    render: () => renderNotes(),
    commit: () => { saveNotes(); renderNotes(); refreshNoteBackup(); },
    moved: (from, to) => { if (nGroup === from) nGroup = to; },
    hint: (m) => noteHint(m),
    status: (m, undo) => flash($("nStatus"), m, undo)
  });
  // The fields each type shows in the composer and keeps when saved. For "gram", jp is the structure.
  const NFIELDS = {
    gram: ["title", "jp", "reg", "body", "examples"],
    frase: ["jp", "kana", "romaji", "group", "ca", "reg", "body"],
    dibuix: ["title", "strokes", "grid", "body"],
    nota: ["title", "body"]
  };
  const NHINTS = {
    gram: "Add a title or a pattern. Examples go one per line: Japanese = English.",
    frase: "Type the romaji and press “Generate” to fill in the Japanese and the furigana. If there is furigana, that is what gets read aloud.",
    dibuix: "Draw with the mouse, a finger or a stylus. The grid helps you practise kanji.",
    nota: "Anything you want to remember from the course."
  };
  const NERRORS = {
    gram: "Enter a title or a pattern.",
    frase: "Enter the sentence in Japanese.",
    dibuix: "Draw something on the canvas.",
    nota: "Enter a title or some text."
  };
  const PENS = [2.5, 5, 9];
  const NSEED = [
    {
      type: "gram", title: "Particle は (topic)", jp: "A は B です",
      body: "は marks the topic of the sentence: “as for A, it is B”. As a particle it is pronounced “wa”, not “ha”.\nです works as the polite verb “to be” and goes at the end of the sentence.",
      examples: [{ jp: "わたしはがくせいです。", ca: "I am a student." }, { jp: "これはねこです。", ca: "This is a cat." }]
    },
    {
      type: "frase", group: "intro", jp: "日本語を勉強しています。", kana: "にほんごをべんきょうしています。",
      romaji: "nihongo o benkyō shite imasu.", ca: "I am studying Japanese.", body: "〜ています expresses an action in progress."
    },
    {
      type: "frase", group: "aula", jp: "もう一度お願いします。", kana: "もういちどおねがいします。",
      romaji: "mō ichido onegai shimasu.", ca: "Once more, please.", reg: "hon"
    },
    {
      type: "gram", title: "Particle の (possession)", jp: "A の B",
      body: "の joins two nouns: “A's B”. The order is the same as with the English 's.",
      examples: [{ jp: "せんせいのほん", ca: "the teacher's book" }, { jp: "にほんのやま", ca: "the mountains of Japan" }]
    }
  ];
  const r1 = (x) => Math.round(x * 10) / 10;

  function noteOk(n) {
    if (n.type === "frase") return !!n.jp;
    if (n.type === "dibuix") return n.strokes.length > 0;
    if (n.type === "gram") return !!(n.title || n.jp);
    return !!(n.title || n.body);
  }
  function cleanNotes(a) {
    if (!Array.isArray(a)) return null;
    const out = [];
    for (const n of a) {
      if (!n || !NTYPES[n.type]) continue;
      const x = {
        id: uid(), type: n.type, at: Number(n.at) || Date.now(),
        title: str(n.title), jp: str(n.jp).normalize("NFC"), kana: str(n.kana).normalize("NFC"),
        romaji: str(n.romaji), group: n.type === "frase" ? sg.of(n.group) : "", ca: str(n.ca), reg: regOf(n.reg), body: str(n.body), grid: !!n.grid,
        examples: (Array.isArray(n.examples) ? n.examples : [])
          .filter((e) => e && str(e.jp))
          .map((e) => ({ jp: str(e.jp).normalize("NFC"), ca: str(e.ca) })),
        strokes: (Array.isArray(n.strokes) ? n.strokes : [])
          .filter((s) => s && Array.isArray(s.p) && s.p.length >= 2 && s.p.every(Number.isFinite))
          .map((s) => ({ c: s.c === "a" ? "a" : "i", w: PENS.includes(s.w) ? s.w : 5, p: s.p.slice(0, s.p.length - (s.p.length % 2)) }))
      };
      if (noteOk(x)) out.push(x);
    }
    return out;
  }
  function loadNotes() {
    try {
      const raw = localStorage.getItem(NKEY);
      if (raw) { const c = cleanNotes(JSON.parse(raw)); if (c) return c; }
    } catch (e) { /* storage unavailable: start from the examples */ }
    unsaved.notes = true;
    const now = Date.now();
    return cleanNotes(NSEED.map((n, i) => Object.assign({ at: now - i }, n)));
  }
  const sortedNotes = () => [...notes].sort((a, b) => b.at - a.at);
  // Stored newest first, without ids and without empty fields.
  function plainNotes() {
    return sortedNotes().map((n) => {
      const o = {};
      for (const k in n) {
        const v = n[k];
        if (k === "id" || v === "" || v === false || (Array.isArray(v) && !v.length)) continue;
        o[k] = v;
      }
      return o;
    });
  }
  function saveNotes() {
    unsaved.notes = false;
    toFolder("notes.json", notesJson);
    try { localStorage.setItem(NKEY, JSON.stringify(plainNotes())); return true; } catch (e) { return false; }
  }
  let notes = loadNotes();

  /* drawings: strokes are flat [x0, y0, x1, y1, …] arrays in a 400×300 box, drawn with theme colours */
  function strokeD(p) {
    if (p.length < 4) return "M" + p[0] + " " + p[1] + "l0 .01";
    let d = "M" + p[0] + " " + p[1];
    for (let i = 2; i < p.length - 2; i += 2) {
      d += "Q" + p[i] + " " + p[i + 1] + " " + r1((p[i] + p[i + 2]) / 2) + " " + r1((p[i + 1] + p[i + 3]) / 2);
    }
    return d + "L" + p[p.length - 2] + " " + p[p.length - 1];
  }
  const strokeEl = (s) => svgEl("path", { class: s.c === "a" ? "inkp a" : "inkp", d: strokeD(s.p), "stroke-width": s.w });
  function gridEl() {
    const g = svgEl("g", { class: "padgrid" });
    for (let x = 50; x < 400; x += 50) g.append(svgEl("line", { class: x % 100 ? "mid" : "", x1: x, y1: 0, x2: x, y2: 300 }));
    for (let y = 50; y < 300; y += 50) g.append(svgEl("line", { class: y % 100 ? "mid" : "", x1: 0, y1: y, x2: 400, y2: y }));
    return g;
  }

  const pad = $("pad");
  let padStrokes = [], penColor = "i", penWidth = 5, drawing = null;
  pad.prepend(gridEl());
  function redrawPad() {
    $("padInk").textContent = "";
    padStrokes.forEach((s) => $("padInk").append(strokeEl(s)));
    $("pUndo").disabled = $("pClear").disabled = !padStrokes.length;
  }
  function syncPen() {
    const c = document.querySelector("input[name=pcolor]:checked");
    penColor = c ? c.value : "i";
    penWidth = Number($("pWidth").value) || 5;
    pad.classList.toggle("nogrid", !$("nGrid").checked);
  }
  function padPoint(e) {
    const r = pad.getBoundingClientRect();
    const x = Math.max(0, Math.min(400, ((e.clientX - r.left) / r.width) * 400));
    const y = Math.max(0, Math.min(300, ((e.clientY - r.top) / r.height) * 300));
    return [r1(x), r1(y)];
  }
  pad.addEventListener("pointerdown", (e) => {
    if (e.button > 0) return;
    e.preventDefault();
    pad.setPointerCapture(e.pointerId);
    const s = { c: penColor, w: penWidth, p: padPoint(e) };
    padStrokes.push(s);
    drawing = { s, el: strokeEl(s) };
    $("padInk").append(drawing.el);
    $("pUndo").disabled = $("pClear").disabled = false;
  });
  pad.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const p = drawing.s.p;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const ev of evs.length ? evs : [e]) {
      const [x, y] = padPoint(ev);
      if (Math.hypot(x - p[p.length - 2], y - p[p.length - 1]) >= 1.5) p.push(x, y);
    }
    drawing.el.setAttribute("d", strokeD(p));
  });
  const endStroke = () => { drawing = null; };
  pad.addEventListener("pointerup", endStroke);
  pad.addEventListener("pointercancel", endStroke);
  $("pUndo").addEventListener("click", () => { padStrokes.pop(); redrawPad(); });
  $("pClear").addEventListener("click", () => { padStrokes = []; redrawPad(); });
  document.querySelectorAll("input[name=pcolor]").forEach((r) => r.addEventListener("change", syncPen));
  $("pWidth").addEventListener("change", syncPen);
  $("nGrid").addEventListener("change", syncPen);

  /* composer */
  let ntype = "gram", editId = null;
  function noteHint(err) {
    const h = $("nHint");
    h.classList.toggle("err", !!err);
    h.textContent = err || NHINTS[ntype];
  }
  function setType(type) {
    ntype = NTYPES[type] ? type : "gram";
    document.querySelectorAll("input[name=ntype]").forEach((r) => { r.checked = r.value === ntype; });
    document.querySelectorAll("#nForm [data-for]").forEach((el) => { el.hidden = !el.dataset.for.split(" ").includes(ntype); });
    $("nJpLabel").textContent = ntype === "gram" ? "Pattern" : "Japanese sentence";
    $("nJp").placeholder = ntype === "gram" ? "A は B です" : "日本語を勉強しています。";
    $("nTitle").placeholder = ntype === "gram" ? "Particle は (topic)" : ntype === "dibuix" ? "Optional" : "";
    $("nBodyLabel").textContent = ntype === "gram" ? "Explanation" : ntype === "nota" ? "Text" : "Notes (optional)";
    noteHint();
  }
  function markEditing() {
    document.querySelectorAll("#notes .card").forEach((c) => c.classList.toggle("editing", c.dataset.id === editId));
  }
  function resetComposer() {
    editId = null;
    $("nForm").reset();
    padStrokes = [];
    redrawPad();
    syncPen();
    setType(ntype);
    sg.close();
    $("cTitleText").textContent = "New note";
    $("nSave").textContent = "Save note";
    markEditing();
  }
  // A half-written new note is kept when the composer closes; an edit is dropped.
  const notePop = popup($("noteDlg"), () => { if (editId) resetComposer(); });
  const openComposer = () => notePop.open(document.querySelector("#nForm [data-for]:not([hidden]) :is(input, textarea)"));
  $("nNew").addEventListener("click", () => {
    if (editId) resetComposer();
    openComposer();
  });
  function editNote(id) {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    resetComposer();
    editId = id;
    setType(n.type);
    $("nTitle").value = n.title;
    $("nJp").value = n.jp;
    $("nKa").value = n.kana;
    $("nRo").value = n.romaji;
    $("nGroup").value = n.group;
    sg.sync();
    $("nCa").value = n.ca;
    document.querySelectorAll("input[name=nreg]").forEach((r) => { r.checked = r.value === n.reg; });
    $("nBody").value = n.body;
    $("nEx").value = n.examples.map((e) => (e.ca ? e.jp + " = " + e.ca : e.jp)).join("\n");
    if (n.type === "dibuix") $("nGrid").checked = n.grid;
    padStrokes = n.strokes.map((s) => ({ c: s.c, w: s.w, p: [...s.p] }));
    redrawPad();
    syncPen();
    $("cTitleText").textContent = "Edit note";
    $("nSave").textContent = "Save changes";
    markEditing();
    openComposer();
  }
  function parseExamples(text) {
    return text.split("\n").map((line) => {
      const i = line.indexOf("=");
      return i < 0 ? { jp: line.trim(), ca: "" } : { jp: line.slice(0, i).trim(), ca: line.slice(i + 1).trim() };
    }).filter((e) => e.jp);
  }
  document.querySelectorAll("input[name=ntype]").forEach((r) => r.addEventListener("change", () => setType(r.value)));
  // The sentence fields grow with their lines; without field-sizing they get two rows and a resize handle.
  if (!CSS.supports("field-sizing", "content")) {
    document.querySelectorAll("textarea.line").forEach((t) => { t.rows = 2; t.style.resize = "vertical"; });
  }
  // Converts a multi-line reading line by line, keeping the breaks.
  async function imeLines(hira) {
    const best = await Promise.all(hira.split("\n").map(async (l) => (await imeLookup(l))[0]));
    return best.every(Boolean) ? best.join("\n") : "";
  }
  // Romaji → furigana (offline) and the sentence with kanji (Google Input Tools; falls back to the furigana).
  $("nGen").addEventListener("click", async () => {
    const btn = $("nGen");
    const hira = phraseToKana($("nRo").value);
    if (!hira) {
      noteHint($("nRo").value.trim() ? "Couldn't read the romaji. Check it and try again." : "Type the sentence in romaji first.");
      $("nRo").focus();
      return;
    }
    $("nKa").value = hira;
    $("nJp").value = hira;
    btn.disabled = true;
    btn.textContent = "Generating…";
    try {
      const best = await imeLines(hira);
      if (best && $("nKa").value === hira) $("nJp").value = best;
      noteHint();
    } catch {
      noteHint("Offline: only the furigana could be generated. Type the kanji by hand.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Generate";
    }
  });

  // Furigana → the sentence with kanji (Google Input Tools).
  $("nKan").addEventListener("click", async () => {
    const btn = $("nKan");
    const raw = $("nKa").value.split("\n").map((l) => l.trim()).filter(Boolean).join("\n").normalize("NFC");
    const hira = /[a-zāīūēō]/i.test(raw) ? phraseToKana(raw) : raw;
    if (!hira) {
      noteHint(raw ? "Couldn't read the furigana. Type it in hiragana." : "Type the furigana in hiragana first.");
      $("nKa").focus();
      return;
    }
    $("nKa").value = hira;
    btn.disabled = true;
    try {
      const best = await imeLines(hira);
      if ($("nKa").value !== hira) return;
      if (best) { $("nJp").value = best; noteHint(); }
      else noteHint("No conversion found. Type the kanji by hand.");
    } catch {
      noteHint("Couldn't reach the kanji service. Check the connection or type the kanji by hand.");
    } finally {
      btn.disabled = false;
    }
  });

  $("nForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const keep = NFIELDS[ntype];
    if (keep.includes("group") && sg.mode && sg.confirm() === null) return;
    const v = (id, f) => (keep.includes(f) ? $(id).value.trim() : "");
    const draft = cleanNotes([{
      type: ntype, title: v("nTitle", "title"), jp: v("nJp", "jp"), kana: v("nKa", "kana"), romaji: v("nRo", "romaji"),
      group: v("nGroup", "group"), ca: v("nCa", "ca"), body: v("nBody", "body"),
      reg: keep.includes("reg") ? document.querySelector("input[name=nreg]:checked").value : "",
      examples: keep.includes("examples") ? parseExamples($("nEx").value) : [],
      strokes: keep.includes("strokes") ? padStrokes : [],
      grid: keep.includes("grid") && $("nGrid").checked
    }])[0];
    if (!draft) { noteHint(NERRORS[ntype]); return; }
    const old = editId && notes.find((x) => x.id === editId);
    if (old) Object.assign(old, draft, { id: old.id, at: old.at });
    else notes.push(draft);
    const id = old ? old.id : draft.id;
    const saved = saveNotes();
    // Make sure the saved note is visible in the list.
    if (nFilter !== "all" && nFilter !== ntype) nFilter = "all";
    if (nGroup !== "all" && nGroup !== draft.group) nGroup = "all";
    nQuery = "";
    $("nQ").value = "";
    resetComposer();
    notePop.close();
    renderNotes(id);
    refreshNoteBackup();
    noteStatus(saved ? (old ? "Changes saved." : "Note saved.") : "Couldn't save: the browser's storage is full or unavailable.");
    const card = document.querySelector('#notes .card[data-id="' + id + '"]');
    if (card) card.scrollIntoView({ block: "nearest", behavior: reduce.matches ? "auto" : "smooth" });
  });

  /* note list */
  let nQuery = "", nFilter = "all", nGroup = "all", lastNote = null;
  const noteStatus = (msg, undo) => flash($("nStatus"), msg, undo && undoNote);
  const ICONS = {
    say: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
    del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };
  function node(tag, cls, text, ja) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    if (ja) e.lang = "ja";
    return e;
  }
  function iconBtn(kind, label, title, text) {
    const b = node("button", kind);
    b.type = "button";
    b.setAttribute("aria-label", label);
    b.title = title;
    b.innerHTML = ICONS[kind];
    if (text) b.dataset.text = text;
    return b;
  }
  function noteCard(n, fresh) {
    const t = NTYPES[n.type];
    const label = n.title || n.jp || t.name;
    const card = node("article", "card " + n.type + (fresh ? " fresh" : ""));
    card.dataset.id = n.id;
    const head = node("div", "card-head");
    const tag = node("span", "tag");
    const kan = node("span", "kan", t.kan, true);
    kan.setAttribute("aria-hidden", "true");
    tag.append(kan, t.name);
    const acts = node("div", "acts");
    if (tts && n.type === "frase") acts.append(iconBtn("say", "Listen to " + n.jp, "Listen", n.kana || n.jp));
    acts.append(iconBtn("edit", "Edit " + label, "Edit"), iconBtn("del", "Delete " + label, "Delete"));
    head.append(tag);
    if (n.group) head.append(node("span", "grp", sg.name(n.group)));
    if (n.reg) head.append(regBadge(n.reg));
    head.append(acts);
    card.append(head);
    if (n.title) card.append(node("h3", "", n.title));
    if (n.type === "gram" && n.jp) card.append(node("p", "pat", n.jp, true));
    if (n.type === "frase") {
      const meta = node("div", "meta");
      meta.append(node("span", "kana", n.kana, true), node("span", "romaji", n.romaji), node("span", "ca", n.ca));
      card.append(node("p", "sent", n.jp, true), meta);
    }
    if (n.type === "dibuix") {
      const box = node("div", "drawing");
      const svg = svgEl("svg", { viewBox: "0 0 400 300", role: "img", "aria-label": n.title ? "Drawing: " + n.title : "Drawing" });
      if (n.grid) svg.append(gridEl());
      n.strokes.forEach((s) => svg.append(strokeEl(s)));
      box.append(svg);
      card.append(box);
    }
    if (n.body) card.append(node("p", "body", n.body));
    if (n.examples.length) {
      const ul = node("ul", "ex");
      ul.setAttribute("aria-label", "Examples");
      n.examples.forEach((ex) => {
        const li = node("li");
        li.append(node("span", "jp", ex.jp, true));
        if (ex.ca) li.append(node("span", "ca", ex.ca));
        if (tts) li.append(iconBtn("say", "Listen to " + ex.jp, "Listen", ex.jp));
        ul.append(li);
      });
      card.append(ul);
    }
    return card;
  }
  const noteText = (n) => [n.title, n.jp, n.kana, n.romaji, n.ca, regText(n.reg), n.group && sg.name(n.group), n.body].concat(n.examples.flatMap((e) => [e.jp, e.ca])).join("\n");
  function renderNotes(freshId) {
    const q = nQuery.trim();
    const qn = norm(q);
    const qjp = q.normalize("NFC");
    const all = sortedNotes();
    const shown = all.filter((n) => (nFilter === "all" || n.type === nFilter) && (nFilter !== "frase" || nGroup === "all" || n.group === nGroup) && (!q || noteText(n).includes(qjp) || norm(noteText(n)).includes(qn)));
    const list = $("notes");
    list.textContent = "";
    if (!shown.length) {
      list.append(node("p", "none",
        !all.length ? "No notes yet. Create one with the form."
          : q ? "No notes match “" + q + "”."
          : nFilter === "frase" && nGroup !== "all" ? "No sentences in this group yet."
          : "No notes of this type yet."));
    }
    shown.forEach((n) => list.append(noteCard(n, n.id === freshId)));
    document.querySelectorAll("#chips .chip").forEach((c) => {
      const f = c.dataset.f;
      c.setAttribute("aria-pressed", String(f === nFilter));
      c.querySelector(".n").textContent = f === "all" ? all.length : all.filter((n) => n.type === f).length;
    });
    const row = $("sgroups");
    row.hidden = nFilter !== "frase";
    if (!row.hidden) nGroup = sg.row(row, all.filter((n) => n.type === "frase"), nGroup);
    sg.fill();
    markEditing();
    if (freshId) setTimeout(() => { const el = list.querySelector(".card.fresh"); if (el) el.classList.remove("fresh"); }, 1700);
  }
  // Pretty-printed, but with the stroke coordinate arrays kept on one line.
  const notesJson = () => JSON.stringify(plainNotes(), null, 2).replace(/\[\s+([-\d.,\s]+?)\s+\]/g, (m, inner) => "[" + inner.replace(/\s+/g, "") + "]");
  function refreshNoteBackup() { $("nBackup").value = notesJson(); }
  function removeNote(id) {
    const index = notes.findIndex((n) => n.id === id);
    if (index < 0) return;
    lastNote = notes.splice(index, 1)[0];
    saveNotes();
    if (editId === id) resetComposer();
    renderNotes();
    refreshNoteBackup();
    noteStatus("Note deleted.", true);
  }
  function undoNote() {
    if (!lastNote) return;
    notes.push(lastNote);
    const id = lastNote.id;
    lastNote = null;
    saveNotes();
    renderNotes(id);
    refreshNoteBackup();
    noteStatus("Note restored.");
  }
  $("notes").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.classList.contains("say")) { speak({ jp: b.dataset.text }, b); return; }
    const card = b.closest(".card");
    if (!card) return;
    if (b.classList.contains("edit")) editNote(card.dataset.id);
    else if (b.classList.contains("del")) removeNote(card.dataset.id);
  });
  $("chips").addEventListener("click", (e) => {
    const c = e.target.closest(".chip");
    if (c) { nFilter = c.dataset.f; nGroup = "all"; renderNotes(); }
  });
  $("sgroups").addEventListener("click", (e) => {
    const c = e.target.closest(".chip");
    if (c) { nGroup = c.dataset.g; renderNotes(); }
  });
  $("nQ").addEventListener("input", (e) => { nQuery = e.target.value; renderNotes(); });

  function noteBackupMsg(m) { $("nBackupMsg").textContent = m; }
  $("nCopy").addEventListener("click", () => copyBackup($("nBackup"), noteBackupMsg));
  $("nLoad").addEventListener("click", () => {
    let c = null;
    try { const a = JSON.parse($("nBackup").value); c = cleanNotes(a); if (c && !c.length && a.length) c = null; } catch (e) { c = null; }
    if (!c) { noteBackupMsg("Invalid JSON. Each note needs a “type”: gram, frase, dibuix or nota."); return; }
    notes = c;
    lastNote = null;
    saveNotes();
    resetComposer();
    renderNotes();
    refreshNoteBackup();
    noteBackupMsg("Loaded " + c.length + (c.length === 1 ? " note." : " notes."));
  });

  /* ---------- auto-save to a folder ---------- */
  // File System Access API (Chromium only): the chosen directory handle is kept in IndexedDB,
  // and every save() / saveNotes() rewrites words.json / notes.json there, in the backup format.
  function idb(mode, fn) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open("diccionari-japones", 1);
      open.onupgradeneeded = () => open.result.createObjectStore("kv");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction("kv", mode);
        const req = fn(tx.objectStore("kv"));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
      };
    });
  }
  function linkMsg(m) { document.querySelectorAll(".link-msg").forEach((el) => { el.textContent = m; }); }
  function linkState() {
    document.querySelectorAll(".link-pick").forEach((b) => { b.textContent = dir ? "Change folder…" : "Auto-save to folder…"; });
    document.querySelectorAll(".link-stop").forEach((b) => { b.hidden = !dir; });
  }
  async function writeFile(name, text) {
    if (!dir) return;
    try {
      // requestPermission needs a recent click; saves always follow one.
      if (await dir.queryPermission({ mode: "readwrite" }) !== "granted" &&
          await dir.requestPermission({ mode: "readwrite" }) !== "granted") throw new Error("denied");
      const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
      await w.write(text + "\n");
      await w.close();
      linkMsg("Saved " + name + " to “" + dir.name + "” at " + new Date().toLocaleTimeString() + ".");
    } catch (e) {
      linkMsg("Couldn't save " + name + " to “" + dir.name + "”. Pick the folder again to allow access.");
    }
  }
  function toFolder(name, json) {
    if (!dir) return;
    const text = json();
    dirQueue = dirQueue.then(() => writeFile(name, text));
  }
  async function linkFolder() {
    let d;
    try { d = await window.showDirectoryPicker({ id: "diccionari-japones", mode: "readwrite" }); } catch (e) { return; }
    dir = d;
    try { await idb("readwrite", (s) => s.put(d, "dir")); } catch (e) { /* not remembered across reloads */ }
    linkState();
    toFolder("words.json", wordsJson);
    toFolder("notes.json", notesJson);
  }
  function unlinkFolder() {
    const name = dir ? dir.name : "";
    dir = null;
    idb("readwrite", (s) => s.delete("dir")).catch(() => { /* ignore */ });
    linkState();
    linkMsg("Stopped auto-saving to “" + name + "”.");
  }
  if ("showDirectoryPicker" in window) {
    document.querySelectorAll(".row.link").forEach((r) => { r.hidden = false; });
    document.querySelectorAll(".link-pick").forEach((b) => b.addEventListener("click", linkFolder));
    document.querySelectorAll(".link-stop").forEach((b) => b.addEventListener("click", unlinkFolder));
    idb("readonly", (s) => s.get("dir")).then(async (d) => {
      if (!d) return;
      dir = d;
      linkState();
      const ok = await d.queryPermission({ mode: "readwrite" }) === "granted";
      linkMsg("Auto-saving to “" + d.name + "”." + (ok ? "" : " The browser will ask for access on the next change."));
    }).catch(() => { /* ignore */ });
  }

  /* ---------- start ---------- */
  renderList();
  refreshBackup();
  updateHint();
  updatePlayBtn();
  const first = listed()[0];
  select(first ? first.id : null);
  resetComposer();
  renderNotes();
  refreshNoteBackup();
  let savedTab = null;
  try { savedTab = localStorage.getItem(TAB_KEY); } catch (e) { /* ignore */ }
  showTab(savedTab);
  let savedPlayer = null;
  try { savedPlayer = localStorage.getItem(PLAYER_KEY); } catch (e) { /* ignore */ }
  showPlayer(savedPlayer !== "0");
  seedFromRepo();

  // Nothing saved yet: replace the examples with the repo's data/ files (the deployed site's content).
  // Not stored until the first change, so a newer data/ still shows up. Fails from file://, keeping the examples.
  function seedFromRepo() {
    const get = (f) => fetch("data/" + f, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (unsaved.words) get("words.json").then((a) => {
      const c = a && clean(a);
      if (!c || !c.length || !unsaved.words) return;
      words = c;
      renderList();
      refreshBackup();
      const w = listed()[0];
      select(w ? w.id : null);
    });
    if (unsaved.notes) get("notes.json").then((a) => {
      const c = a && cleanNotes(a);
      if (!c || !c.length || !unsaved.notes) return;
      notes = c;
      renderNotes();
      refreshNoteBackup();
    });
  }
})();
