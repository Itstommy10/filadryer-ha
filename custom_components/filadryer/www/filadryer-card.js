/* FilaDryer S4 card — servita dall'integrazione "filadryer" */
(() => {
const LED = { flow: "Scorrevole", on: "Sempre acceso", off: "Spento" };
const STATUS = { idle: "Inattivo", drying: "In asciugatura", done: "Completata" };
const pad = (n) => String(n).padStart(2, "0");
const hms = (s) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

class FilaDryerCard extends HTMLElement {
  setConfig(config) {
    this._config = config || {};
    this._step = 0;
    this._horiz = String(this._config.layout || "vertical").toLowerCase().startsWith("h");
    this._mush = String(this._config.style || "classic").toLowerCase() === "mushroom";
    this._expandable = this._config.expandable ?? this._mush;
    this._expanded = this._expandable ? !!this._config.expanded : true;
    this._open = this._config.show_steps ?? (this._horiz && !this._mush);
  }
  static getStubConfig() { return {}; }
  getCardSize() { return this._mush ? (this._expanded ? 4 : 1) : this._horiz ? 5 : 7; }
  getGridOptions() {
    if (this._horiz) return { columns: "full", min_columns: 12, rows: "auto" };
    return { columns: this._mush ? 6 : 12, min_columns: this._mush ? 4 : 6, rows: "auto" };
  }
  static getConfigForm() {
    return { schema: [
      { name: "layout", selector: { select: { mode: "dropdown", options: [{ value: "vertical", label: "Verticale" }, { value: "horizontal", label: "Orizzontale (larghezza piena)" }] } } },
      { name: "style", selector: { select: { mode: "dropdown", options: [{ value: "classic", label: "Classico (display)" }, { value: "mushroom", label: "Mushroom (compatto)" }] } } },
      { name: "expandable", selector: { boolean: {} } },
      { name: "show_display", selector: { boolean: {} } },
      { name: "expanded", selector: { boolean: {} } },
      { name: "title", selector: { text: {} } },
      { name: "show_steps", selector: { boolean: {} } },
    ] };
  }

  set hass(hass) {
    this._hass = hass;
    const id = this._entityId();
    const st = id && hass.states[id];
    const key = st ? JSON.stringify([st.state, st.attributes]) : "none";
    if (!this._root) this._build();
    if (key !== this._key) { this._key = key; this._render(); }
  }

  _entityId() {
    if (this._config.entity) return this._config.entity;
    const ents = this._hass.entities || {};
    const hit = Object.values(ents).find((e) => e.platform === "filadryer" && e.translation_key === "status");
    if (hit) return hit.entity_id;
    return Object.keys(this._hass.states).find((k) => k.startsWith("sensor.") && this._hass.states[k].attributes.steps && this._hass.states[k].attributes.materials);
  }

  _call(service, data = {}) {
    this._hass.callService("filadryer", service, data).catch((e) => this._toast(e.message || String(e), true));
  }

  _toast(msg, err) {
    const t = this._root.querySelector(".toast");
    t.textContent = msg; t.classList.toggle("err", !!err);
    clearTimeout(this._tt); this._tt = setTimeout(() => (t.textContent = ""), 4000);
  }

  _build() {
    this._root = this.attachShadow({ mode: "open" });
    this._root.innerHTML = `<style>
:host{--fd-teal:#25c9a4;--fd-amber:#ffc466;--fd-lcd:#0a1a15;--fd-ink:#8dffe2;--fd-dim:#3d6e60}
ha-card{padding:16px;overflow:hidden;container-type:inline-size}
.lay.h{display:grid;grid-template-columns:minmax(260px,1fr) minmax(280px,1.1fr) minmax(280px,1.2fr);gap:18px;align-items:start}
.lay.h .grid{margin-top:0}.lay.h details{margin-top:0;border-top:0;padding-top:0}.lay.h details+details{margin-top:12px;border-top:1px solid var(--divider-color);padding-top:10px}
.lay.h .lcd{padding:22px 20px 16px}.lay.h .val{font-size:1.9rem}.lay.h .time{font-size:1.9rem;margin-top:14px}
.lay.h .c1 .note{font-size:.75rem;color:var(--secondary-text-color);margin-top:10px}
@container (max-width:900px){.lay.h{grid-template-columns:1fr 1fr}.lay.h .c3{grid-column:1/-1}}
@container (max-width:560px){.lay.h{grid-template-columns:1fr}}
.head{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.head ha-icon{color:var(--fd-teal)}
.title{font-size:1.1rem;font-weight:600;flex:1}
.pill{font-size:.75rem;padding:3px 10px;border-radius:99px;background:var(--secondary-background-color);color:var(--secondary-text-color);white-space:nowrap}
.pill.drying{background:rgba(255,196,102,.18);color:#c98a1a}.pill.done{background:rgba(37,201,164,.18);color:#1b9c7f}
.lcd{background:var(--fd-lcd);border-radius:12px;padding:14px 16px 12px;color:var(--fd-ink);font-family:"Chakra Petch",ui-monospace,monospace;box-shadow:inset 0 0 26px rgba(0,0,0,.6)}
.lt{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
.lab{font-size:.65rem;color:var(--fd-dim);letter-spacing:.15em}
.val{font-size:1.5rem;font-weight:700;line-height:1.1}.val small{font-size:.8rem}
.mid{text-align:center}.brand{font-size:.8rem;letter-spacing:.35em;color:var(--fd-dim)}
.mat{font-size:1.25rem;font-weight:600;letter-spacing:.18em}
.time{text-align:center;font-size:1.35rem;margin-top:8px;letter-spacing:.1em}
.z{padding:1px 5px;border-radius:6px}.z.flash{animation:b 1s steps(2,start) infinite;background:rgba(255,196,102,.14);color:var(--fd-amber)}
@keyframes b{50%{opacity:.25}}
.bar{height:4px;border-radius:2px;background:rgba(141,255,226,.15);margin-top:8px;overflow:hidden}.bar i{display:block;height:100%;background:var(--fd-ink)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
@media(max-width:420px){.grid{grid-template-columns:1fr}}
label{display:block;font-size:.75rem;color:var(--secondary-text-color);margin-bottom:3px}
select,input{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid var(--divider-color);background:var(--card-background-color);color:var(--primary-text-color);font:inherit;font-size:.9rem}
.seg{display:flex;border:1px solid var(--divider-color);border-radius:8px;overflow:hidden}
.seg button{flex:1;border:0;padding:8px 4px;background:var(--card-background-color);color:var(--secondary-text-color);font:inherit;font-size:.8rem;cursor:pointer;border-right:1px solid var(--divider-color)}
.seg button:last-child{border-right:0}.seg button.on{background:var(--fd-teal);color:#06231c;font-weight:600}
.hint{font-size:.72rem;color:var(--secondary-text-color);margin-top:3px}
.actions{display:flex;gap:8px;margin-top:14px}
.btn{flex:1;border:0;border-radius:10px;padding:11px;font:inherit;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}
.btn.go{background:var(--fd-teal);color:#06231c}.btn.stop{background:var(--secondary-background-color);color:var(--primary-text-color)}
.btn:disabled{opacity:.45;cursor:default}
.ghost{background:none;border:1px solid var(--divider-color);color:var(--secondary-text-color);border-radius:8px;padding:7px 10px;font:inherit;font-size:.8rem;cursor:pointer}
.row{display:flex;gap:8px;margin-top:8px}.row input{flex:1}
details{margin-top:14px;border-top:1px solid var(--divider-color);padding-top:10px}
summary{cursor:pointer;font-weight:600;font-size:.9rem;list-style:none;display:flex;align-items:center;gap:6px}
summary::-webkit-details-marker{display:none}
.keys{display:flex;justify-content:center;gap:12px;margin:12px 0 8px}
.key{width:44px;height:44px;border-radius:10px;border:1px solid var(--divider-color);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:.85rem}
.key.hl{background:var(--fd-amber);border-color:var(--fd-amber);color:#3a2503}
ol{list-style:none;margin:0;padding:0;counter-reset:s}
li{counter-increment:s;display:flex;gap:10px;padding:9px 10px;border:1px solid var(--divider-color);border-radius:9px;margin-bottom:6px;cursor:pointer}
li::before{content:counter(s,decimal-leading-zero);color:var(--fd-teal);font-weight:700;font-size:.85rem;min-width:22px}
li.on{border-color:var(--fd-teal);background:rgba(37,201,164,.08)}
.st{font-size:.85rem;font-weight:600}.sd{font-size:.75rem;color:var(--secondary-text-color);margin-top:2px}
.toast{font-size:.78rem;color:var(--fd-teal);min-height:1.1em;margin-top:8px}.toast.err{color:var(--error-color)}
.hide{display:none!important}
.tog{cursor:pointer;user-select:none}
.chev{color:var(--secondary-text-color);transition:transform .2s}.chev.up{transform:rotate(180deg)}
.mini{font-size:.85rem;color:var(--secondary-text-color)}.mini .bar{background:var(--divider-color);margin-top:8px}.mini .bar i{background:var(--fd-teal)}
.m{display:flex;flex-direction:column;gap:10px}
.mrow{display:flex;align-items:center;gap:12px;min-width:0}
.mic{flex:none;width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--c) 20%,transparent);color:var(--c);--mdc-icon-size:22px}
.mtx{flex:1;min-width:0}.mpri{font-weight:600;font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msec{font-size:.8rem;color:var(--secondary-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mbtn{flex:none;width:36px;height:36px;border-radius:12px;border:0;display:flex;align-items:center;justify-content:center;cursor:pointer;background:var(--secondary-background-color,rgba(127,127,127,.12));color:var(--primary-text-color);--mdc-icon-size:20px}
.mbtn:disabled{opacity:.35;cursor:default}
.mbtn.big{width:42px;height:42px}.mbtn.go{background:color-mix(in srgb,var(--fd-teal) 22%,transparent);color:var(--fd-teal)}.mbtn.stop{background:color-mix(in srgb,var(--fd-amber) 22%,transparent);color:#c98a1a}
.mbar{height:4px;border-radius:2px;background:var(--divider-color);overflow:hidden}.mbar i{display:block;height:100%;background:var(--fd-amber);transition:width .5s}
.mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.mf label{font-size:.72rem;margin-bottom:4px}
.msel{display:flex;align-items:center;gap:6px;height:36px;padding:0 10px;border-radius:12px;background:var(--secondary-background-color,rgba(127,127,127,.12));--mdc-icon-size:18px;color:var(--secondary-text-color)}
.msel select{border:0;background:none;padding:0;height:100%;color:var(--primary-text-color);flex:1;min-width:0}
.mstep{display:flex;align-items:center;justify-content:space-between;height:36px;border-radius:12px;background:var(--secondary-background-color,rgba(127,127,127,.12))}
.mstep .mbtn{background:none;width:34px;height:34px}.mval{font-weight:600;font-size:.95rem}.mval small{font-weight:400;font-size:.75rem;color:var(--secondary-text-color)}
.mchips{display:flex;gap:6px;flex-wrap:wrap}
.mchip{height:32px;padding:0 12px;border-radius:16px;border:0;cursor:pointer;font:inherit;font-size:.8rem;background:var(--secondary-background-color,rgba(127,127,127,.12));color:var(--secondary-text-color)}
.mchip.on{background:color-mix(in srgb,var(--fd-teal) 22%,transparent);color:var(--fd-teal);font-weight:600}.mchip:disabled{opacity:.5;cursor:default}
.mquick{flex:none}
.mact{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.mpill{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 14px;border-radius:18px;border:0;cursor:pointer;font:inherit;font-size:.85rem;font-weight:500;background:var(--secondary-background-color,rgba(127,127,127,.12));color:var(--primary-text-color);--mdc-icon-size:18px}
.mpill.go{background:color-mix(in srgb,var(--fd-teal) 22%,transparent);color:var(--fd-teal)}
.mpill.stop{background:color-mix(in srgb,var(--fd-amber) 22%,transparent);color:#c98a1a}
.mend{font-size:.8rem;color:var(--secondary-text-color);margin-left:auto}
.mmain{display:flex;flex-direction:column;gap:12px}
.mh .mmain:not(.nolcd){display:grid;grid-template-columns:minmax(260px,340px) 1fr;gap:16px;align-items:start}
@container (max-width:640px){.mh .mmain:not(.nolcd){grid-template-columns:1fr}}
.mlcd{padding:12px 14px 10px}.mlcd .val{font-size:1.35rem}.mlcd .time{font-size:1.5rem;margin-top:6px}
.mf.wide{grid-column:span 2}.mf.wide .mchips{flex-wrap:nowrap}
@container (max-width:420px){.mf.wide{grid-column:auto}.mf.wide .mchips{flex-wrap:wrap}}
.m details{border-top:1px solid var(--divider-color)}
.missing{padding:8px;color:var(--secondary-text-color)}
</style><ha-card><div class="body"></div></ha-card>`;
    this._root.addEventListener("click", (e) => this._click(e));
    this._root.addEventListener("change", (e) => this._change(e));
    this._tick = setInterval(() => this._updateTime(), 1000);
  }

  disconnectedCallback() { clearInterval(this._tick); this._tick = null; }
  connectedCallback() { if (this._root && !this._tick) this._tick = setInterval(() => this._updateTime(), 1000); }

  _render() {
    const body = this._root.querySelector(".body");
    const id = this._entityId();
    const st = id && this._hass.states[id];
    if (!st) { body.innerHTML = `<div class="missing">Integrazione FilaDryer S4 non trovata. Aggiungila da Impostazioni → Dispositivi e servizi.</div>`; return; }
    const a = st.attributes, s = st.state, drying = s === "drying";
    if (this._mush) return this._renderMushroom(body, a, s);
    const mats = a.materials || {};
    const steps = a.steps || [];
    if (this._step >= steps.length) this._step = 0;
    const cur = steps[this._step] || {};
    const fl = (z) => (this._open && cur.zone === z ? "z flash" : "z");
    const seg = (key, opts) => `<div class="seg" data-key="${key}">${opts.map(([v, t]) => `<button data-v="${v}" class="${String(a[key]) === v ? "on" : ""}" ${drying ? "disabled" : ""}>${t}</button>`).join("")}</div>`;
    const presetSel = (a.presets || []).map((p) => `<option ${a.preset_values && JSON.stringify(a.preset_values[p]) === JSON.stringify(this._settings(a)) ? "selected" : ""}>${esc(p)}</option>`).join("");
    body.innerHTML = `
<div class="head ${this._expandable ? "tog" : ""}" ${this._expandable ? 'data-act="toggle"' : ""}><ha-icon icon="mdi:printer-3d-nozzle-heat"></ha-icon><div class="title">${esc(this._config.title || "FilaDryer S4")}</div><span class="pill ${s}">${STATUS[s] || s}</span>${this._expandable ? `<ha-icon class="chev ${this._expanded ? "up" : ""}" icon="mdi:chevron-down"></ha-icon>` : ""}</div>
${this._expandable && !this._expanded ? `<div class="mini">${esc(a.material_label)} · ${a.temperature}°${a.unit} · <span class="clock"></span><div class="bar"><i class="prog"></i></div></div>` : ""}
<div class="${this._expanded ? "" : "hide "}lay ${this._horiz ? "h" : "v"}"><div class="c1">
<div class="lcd">
  <div class="lt">
    <div><div class="lab">SV</div><div class="val"><span class="${fl("sv")}">${a.temperature}<small>°${a.unit}</small></span></div></div>
    <div class="mid"><div class="brand"><span class="${fl("led")}">SUNLU</span></div><div class="mat"><span class="${fl("mat")}">${esc(a.material_lcd)}</span></div></div>
    <div style="text-align:right"><div class="lab">MO · RH</div><div class="val"><span class="${fl("mo")}">${a.mode}</span> · <span class="${fl("rh")}">${a.mode === "2" ? a.humidity : "--"}<small>%</small></span></div></div>
  </div>
  <div class="time"><span class="${fl("time")}"><span class="clock"></span></span></div>
  <div class="bar"><i class="prog" style="width:0"></i></div>
</div>
${this._horiz ? `<div class="note">${a.ends && s === "drying" ? "Fine prevista alle " + new Date(a.ends).toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"}) : esc(a.material_label) + " · consigliato " + esc(a.material_note)}</div>` : ""}
</div><div class="c2">
<div class="grid">
  <div><label>Materiale</label><select data-key="material" ${drying ? "disabled" : ""}>${Object.entries(mats).map(([k, m]) => `<option value="${k}" ${k === a.material ? "selected" : ""}>${esc(m.label)}</option>`).join("")}</select><div class="hint">Consigliato ${esc(a.material_note)}</div></div>
  <div><label>Temperatura SV (35–70)</label><input type="number" min="35" max="70" data-key="temperature" value="${a.temperature}" ${drying ? "disabled" : ""}></div>
  <div><label>Durata (ore)</label><input type="number" min="1" max="99" data-key="hours" value="${a.hours}" ${drying ? "disabled" : ""}></div>
  <div><label>Modalità</label>${seg("mode", [["1", "MO1 tempo"], ["2", "MO2 umidità"]])}</div>
  ${a.mode === "2" ? `<div><label>Umidità di riavvio (30–50%)</label><input type="number" min="30" max="50" data-key="humidity" value="${a.humidity}" ${drying ? "disabled" : ""}></div>` : ""}
  <div><label>Unità</label>${seg("unit", [["C", "°C"], ["F", "°F"]])}</div>
  <div style="grid-column:1/-1"><label>LED</label>${seg("led", Object.entries(LED))}</div>
</div>
<div class="actions">
  <button class="btn go" data-act="start" ${drying ? "disabled" : ""}><ha-icon icon="mdi:play"></ha-icon>Avvia countdown</button>
  <button class="btn stop" data-act="stop" ${s === "idle" ? "disabled" : ""}><ha-icon icon="mdi:stop"></ha-icon>${s === "done" ? "Azzera" : "Ferma"}</button>
</div>
</div><div class="c3">
<details class="pres"><summary><ha-icon icon="mdi:bookmark-multiple"></ha-icon>Preset (${(a.presets || []).length})</summary>
  <div class="row"><select class="psel"><option value="">— seleziona —</option>${presetSel}</select><button class="ghost" data-act="load">Carica</button><button class="ghost" data-act="del">Elimina</button></div>
  <div class="row"><input class="pname" maxlength="80" placeholder="Nome nuovo preset (es. PETG notte)"><button class="ghost" data-act="save">Salva</button></div>
</details>
<details class="seq" ${this._open ? "open" : ""}><summary><ha-icon icon="mdi:gesture-tap-button"></ha-icon>Tasti da premere sul dryer</summary>
  <div class="keys">${[["pwr", "⏻"], ["set", "SET"], ["up", "▲"], ["down", "▼"]].map(([k, t]) => `<div class="key ${(cur.keys || []).includes(k) ? "hl" : ""}">${t}</div>`).join("")}</div>
  <ol>${steps.map((x, i) => `<li data-step="${i}" class="${i === this._step ? "on" : ""}"><div><div class="st">${esc(x.text)}</div><div class="sd">${esc(x.detail)}</div></div></li>`).join("")}</ol>
</details>
</div></div>
<div class="toast"></div>`;
    this._attrs = a; this._state = s;
    this._wireDetails(body);
    this._updateTime();
  }

  _wireDetails(body) {
    const pres = body.querySelector("details.pres"), seq = body.querySelector("details.seq");
    if (!pres || !seq) return;
    pres.open = !!this._presOpen;
    pres.addEventListener("toggle", () => (this._presOpen = pres.open));
    seq.addEventListener("toggle", () => { if (this._open !== seq.open) { this._open = seq.open; this._render(); } });
  }

  _renderMushroom(body, a, s) {
    const drying = s === "drying", mats = a.materials || {}, steps = a.steps || [];
    if (this._step >= steps.length) this._step = 0;
    const cur = steps[this._step] || {};
    const col = drying ? "var(--fd-amber)" : s === "done" ? "var(--fd-teal)" : "var(--disabled-color, #9e9e9e)";
    const chip = (key, opts) => `<div class="mchips" data-key="${key}">${opts.map(([v, t]) => `<button data-v="${v}" class="mchip ${String(a[key]) === v ? "on" : ""}" ${drying ? "disabled" : ""}>${t}</button>`).join("")}</div>`;
    const step = (k, unit, lo, hi) => `<div class="mstep"><button class="mbtn" data-act="dec" data-k="${k}" ${drying || a[k] <= lo ? "disabled" : ""}><ha-icon icon="mdi:minus"></ha-icon></button><span class="mval">${a[k]}<small>${unit}</small></span><button class="mbtn" data-act="inc" data-k="${k}" ${drying || a[k] >= hi ? "disabled" : ""}><ha-icon icon="mdi:plus"></ha-icon></button></div>`;
    const presetSel = (a.presets || []).map((p) => `<option ${a.preset_values && JSON.stringify(a.preset_values[p]) === JSON.stringify(this._settings(a)) ? "selected" : ""}>${esc(p)}</option>`).join("");
    const sec = drying ? `<span class="clock"></span> · ${esc(a.material_lcd)} ${a.temperature}°${a.unit}` : s === "done" ? `Completata · ${esc(a.material_lcd)}` : `${esc(a.material_lcd)} · ${a.temperature}°${a.unit} · ${a.hours} h · MO${a.mode}`;
    const act = drying || s === "done" ? "stop" : "start";
    const fl = (z) => (this._open && cur.zone === z ? "z flash" : "z");
    const showLcd = this._config.show_display ?? true;
    const lcd = showLcd ? `<div class="lcd mlcd">
  <div class="lt">
    <div><div class="lab">SV</div><div class="val"><span class="${fl("sv")}">${a.temperature}<small>°${a.unit}</small></span></div></div>
    <div class="mid"><div class="brand"><span class="${fl("led")}">SUNLU</span></div><div class="mat"><span class="${fl("mat")}">${esc(a.material_lcd)}</span></div></div>
    <div style="text-align:right"><div class="lab">MO · RH</div><div class="val"><span class="${fl("mo")}">${a.mode}</span> · <span class="${fl("rh")}">${a.mode === "2" ? a.humidity : "--"}<small>%</small></span></div></div>
  </div>
  <div class="time"><span class="${fl("time")}"><span class="lcdclock"></span></span></div>
</div>` : "";
    const icon = drying ? "mdi:stop" : s === "done" ? "mdi:check" : "mdi:play";
    body.innerHTML = `
<div class="m ${this._horiz ? "mh" : ""}">
 <div class="mrow ${this._expandable ? "tog" : ""}" ${this._expandable ? 'data-act="toggle"' : ""}>
  <div class="mic" style="--c:${col}"><ha-icon icon="mdi:printer-3d-nozzle-heat"></ha-icon></div>
  <div class="mtx"><div class="mpri">${esc(this._config.title || "FilaDryer S4")}</div><div class="msec">${sec}</div></div>
  <button class="mbtn big ${drying ? "stop" : "go"}" data-act="${act}"><ha-icon icon="${icon}"></ha-icon></button>
  ${this._expandable ? `<ha-icon class="chev ${this._expanded ? "up" : ""}" icon="mdi:chevron-down"></ha-icon>` : ""}
 </div>
 <div class="mbar"><i class="prog" style="width:0"></i></div>
 <div class="${this._expanded ? "" : "hide "}mbody">
  <div class="mmain ${showLcd ? "" : "nolcd"}">${lcd}<div class="mgrid">
   <div class="mf"><label>Materiale</label><div class="msel"><ha-icon icon="mdi:printer-3d-nozzle"></ha-icon><select data-key="material" ${drying ? "disabled" : ""}>${Object.entries(mats).map(([k, m]) => `<option value="${k}" ${k === a.material ? "selected" : ""}>${esc(m.label)}</option>`).join("")}</select></div></div>
   <div class="mf"><label>Temperatura</label>${step("temperature", "°" + a.unit, 35, 70)}</div>
   <div class="mf"><label>Durata</label>${step("hours", " h", 1, 99)}</div>
   ${a.mode === "2" ? `<div class="mf"><label>Umidità riavvio</label>${step("humidity", "%", 30, 50)}</div>` : ""}
   <div class="mf"><label>Modalità</label>${chip("mode", [["1", "MO1 tempo"], ["2", "MO2 umidità"]])}</div>
   <div class="mf"><label>Unità</label>${chip("unit", [["C", "°C"], ["F", "°F"]])}</div>
   <div class="mf wide"><label>LED</label>${chip("led", Object.entries(LED))}</div>
  </div></div>
  <div class="mact">
   ${drying ? `<button class="mpill" data-act="ext" data-min="-30"><ha-icon icon="mdi:timer-minus-outline"></ha-icon>−30 min</button><button class="mpill" data-act="ext" data-min="30"><ha-icon icon="mdi:timer-plus-outline"></ha-icon>+30 min</button><button class="mpill" data-act="ext" data-min="60">+1 h</button>` : ""}
   ${!drying ? `<button class="mpill go" data-act="start"><ha-icon icon="mdi:play"></ha-icon>Avvia countdown</button>` : ""}
   ${s !== "idle" ? `<button class="mpill stop" data-act="stop"><ha-icon icon="${drying ? "mdi:stop" : "mdi:restore"}"></ha-icon>${drying ? "Ferma" : "Azzera"}</button>` : ""}
   ${a.ends && drying ? `<span class="mend">Fine alle ${new Date(a.ends).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>` : a.last_done && s === "done" ? `<span class="mend">Finita alle ${new Date(a.last_done).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>` : ""}
  </div>
  ${(a.presets || []).length ? `<div class="mf"><label>Preset rapidi</label><div class="mchips">${a.presets.map((p) => `<button class="mchip pchip ${a.preset_values && JSON.stringify(a.preset_values[p]) === JSON.stringify(this._settings(a)) ? "on" : ""}" data-act="pload" data-name="${esc(p)}" ${drying ? "disabled" : ""}>${esc(p)}</button>`).join("")}</div></div>` : ""}
  <details class="pres"><summary><ha-icon icon="mdi:bookmark-multiple"></ha-icon>Gestisci preset (${(a.presets || []).length})</summary>
   <div class="row"><select class="psel"><option value="">— seleziona —</option>${presetSel}</select><button class="ghost" data-act="load">Carica</button><button class="ghost" data-act="del">Elimina</button></div>
   <div class="row"><input class="pname" maxlength="80" placeholder="Nome nuovo preset"><button class="ghost" data-act="save">Salva</button></div>
  </details>
  <details class="seq" ${this._open ? "open" : ""}><summary><ha-icon icon="mdi:gesture-tap-button"></ha-icon>Tasti da premere</summary>
   <div class="keys">${[["pwr", "⏻"], ["set", "SET"], ["up", "▲"], ["down", "▼"]].map(([k, t]) => `<div class="key ${(cur.keys || []).includes(k) ? "hl" : ""}">${t}</div>`).join("")}</div>
   <ol>${steps.map((x, i) => `<li data-step="${i}" class="${i === this._step ? "on" : ""}"><div><div class="st">${esc(x.text)}</div><div class="sd">${esc(x.detail)}</div></div></li>`).join("")}</ol>
  </details>
 </div>
</div>
<div class="toast"></div>`;
    this._attrs = a; this._state = s;
    this._wireDetails(body);
    this._updateTime();
  }

  _settings(a) {
    const o = {};
    ["material", "temperature", "unit", "hours", "mode", "humidity", "led"].forEach((k) => (o[k] = a[k]));
    return o;
  }

  _updateTime() {
    if (!this._attrs || !this._root) return;
    const clock = this._root.querySelector(".clock"), prog = this._root.querySelector(".prog");
    const a = this._attrs;
    const lc = this._root.querySelector(".lcdclock");
    if (lc) {
      if (this._state === "drying" && a.ends) lc.textContent = hms(Math.max(0, Math.round((new Date(a.ends) - Date.now()) / 1000)));
      else lc.textContent = this._state === "done" ? "FINE" : `${pad(a.hours)}:00:00`;
    }
    if (!clock || !prog) return;
    if (this._state === "drying" && a.ends) {
      const left = Math.max(0, Math.round((new Date(a.ends) - Date.now()) / 1000));
      clock.textContent = hms(left);
      prog.style.width = `${Math.min(100, 100 - (left / a.duration) * 100)}%`;
    } else if (this._state === "done") {
      clock.textContent = this._mush ? "" : "FINE"; prog.style.width = "100%";
    } else {
      clock.textContent = this._mush ? "" : `${pad(a.hours)}:00:00`; prog.style.width = "0";
    }
  }

  _click(e) {
    const b = e.composedPath().find((n) => n.dataset && (n.dataset.act || n.dataset.v !== undefined || n.dataset.step !== undefined));
    if (!b) return;
    if (b.dataset.step !== undefined) { this._step = +b.dataset.step; this._open = true; this._render(); return; }
    if (b.dataset.v !== undefined && b.parentElement?.dataset.key) { if (!b.disabled) this._call("set", { [b.parentElement.dataset.key]: b.dataset.v }); return; }
    if (b.dataset.act === "toggle") {
      this._expanded = !this._expanded; this._render();
      this.dispatchEvent(new Event("iron-resize", { bubbles: true, composed: true })); return;
    }
    if (b.dataset.act === "inc" || b.dataset.act === "dec") {
      if (b.disabled) return;
      const k = b.dataset.k, v = +this._attrs[k] + (b.dataset.act === "inc" ? 1 : -1);
      this._call("set", { [k]: v }); return;
    }
    if (b.dataset.act === "ext") { this._call("extend", { minutes: +b.dataset.min }); return; }
    if (b.dataset.act === "pload") { if (!b.disabled) this._call("load_preset", { name: b.dataset.name }); return; }
    const act = b.dataset.act, psel = this._root.querySelector(".psel"), pname = this._root.querySelector(".pname");
    if (act === "start") this._call("start");
    else if (act === "stop") this._call("stop");
    else if (act === "load") psel.value ? this._call("load_preset", { name: psel.value }) : this._toast("Scegli un preset.", true);
    else if (act === "del") {
      if (!psel.value) return this._toast("Scegli il preset da eliminare.", true);
      if (confirm(`Eliminare il preset «${psel.value}»?`)) this._call("delete_preset", { name: psel.value });
    } else if (act === "save") {
      const n = pname.value.trim();
      if (!n) return this._toast("Dai un nome al preset.", true);
      this._call("save_preset", { name: n }); this._toast(`Preset «${n}» salvato.`);
    }
  }

  _change(e) {
    const el = e.composedPath()[0];
    if (el.classList?.contains("psel") || el.classList?.contains("pname")) return;
    const key = el.dataset?.key;
    if (!key) return;
    const v = el.tagName === "INPUT" ? parseInt(el.value, 10) : el.value;
    if (el.tagName === "INPUT" && (isNaN(v) || v < +el.min || v > +el.max)) { this._toast(`Valore fuori range (${el.min}–${el.max}).`, true); el.value = this._attrs[key]; return; }
    this._call("set", { [key]: v });
  }
}

if (!customElements.get("filadryer-card")) {
  customElements.define("filadryer-card", FilaDryerCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: "filadryer-card", name: "FilaDryer S4", description: "Preset, tasti da premere e countdown per il SUNLU FilaDryer S4", preview: true });
}
})();
