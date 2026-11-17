// Renders the adoption dashboard from data/adoption-metrics.json (produced by
// scripts/usage_report.py) and the skill eval table from evals/results/latest.json
// (produced by evals/run_evals.py). No build step, no libraries.
(function () {
  "use strict";

  // ---- Theme toggle (remembered per viewer; works without storage) ----
  const root = document.documentElement;
  const toggle = document.getElementById("theme-toggle");
  function currentTheme() {
    const set = root.getAttribute("data-theme");
    if (set) return set;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function label() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    toggle.textContent = next === "dark" ? "Dark mode" : "Light mode";
    toggle.setAttribute("aria-label", "Switch to " + next + " mode");
  }
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") root.setAttribute("data-theme", saved);
  } catch (e) { /* storage unavailable: follow the OS setting */ }
  if (toggle) {
    label();
    toggle.addEventListener("click", function () {
      const next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) { /* ignore */ }
      label();
    });
  }

  // ---- Helpers ----
  const SVG = "http://www.w3.org/2000/svg";
  const nf = new Intl.NumberFormat("en-GB");
  const pct = (x) => Math.round(x * 100) + "%";
  function el(tag, attrs, text) {
    const node = document.createElementNS(SVG, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (text !== undefined) node.textContent = text;
    return node;
  }
  // Round step (1, 2 or 5 x 10^n) giving about four gridlines.
  function niceScale(v) {
    if (v <= 0) return { max: 1, step: 1 };
    const raw = v / 4, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 5, 10].map((s) => s * mag).find((s) => s >= raw);
    return { max: Math.ceil(v / step) * step, step };
  }

  const tip = document.createElement("div");
  tip.className = "tooltip";
  tip.setAttribute("role", "status");
  document.body.appendChild(tip);
  function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.classList.add("show");
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2)) + "px";
    tip.style.top = Math.max(8, y - h - 12) + "px";
  }
  function hideTip() { tip.classList.remove("show"); }
  function attachTip(group, html) {
    group.setAttribute("tabindex", "0");
    group.addEventListener("pointermove", (e) => showTip(html, e.clientX, e.clientY));
    group.addEventListener("pointerleave", hideTip);
    group.addEventListener("focus", () => {
      const r = group.getBoundingClientRect();
      showTip(html, r.left + r.width / 2, r.top);
    });
    group.addEventListener("blur", hideTip);
  }

  // ---- Column chart: one series over time, one y axis ----
  function columnChart(container, points, opts) {
    const W = 380, H = 220, m = { t: 22, r: 6, b: 28, l: 30 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const scale = niceScale(Math.max(...points.map((p) => p.value)));
    const max = scale.max;
    // role="group" (not "img") so the focusable bars inside stay exposed to assistive technology.
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "group", "aria-label": opts.label });
    for (let v = 0; v <= max; v += scale.step) {
      const y = m.t + ih - (v / max) * ih;
      svg.appendChild(el("line", { class: v === 0 ? "axis-line" : "grid-line", x1: m.l, x2: W - m.r, y1: y, y2: y }));
      svg.appendChild(el("text", { class: "tick", x: m.l - 6, y: y + 4, "text-anchor": "end" }, nf.format(v)));
    }
    const band = iw / points.length, bw = Math.min(44, band * 0.62);
    points.forEach((p, i) => {
      const x = m.l + band * i + (band - bw) / 2;
      const h = (p.value / max) * ih, y = m.t + ih - h;
      const g = el("g", { class: "bar-group", role: "img", "aria-label": `${p.label}: ${p.value} ${opts.unit}. ${p.plain || ""}` });
      g.appendChild(el("rect", { class: "bar-hit", x: m.l + band * i, y: m.t, width: band, height: ih }));
      // Rounded data end, square baseline: path with top corners radius 4.
      const r = Math.min(4, h, bw / 2);
      g.appendChild(el("path", {
        class: "bar",
        d: `M${x},${m.t + ih} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${m.t + ih} Z`,
      }));
      if (opts.labelValues) {
        g.appendChild(el("text", { class: "val", x: x + bw / 2, y: y - 6, "text-anchor": "middle" }, nf.format(p.value)));
      }
      g.appendChild(el("text", { class: "cat", x: x + bw / 2, y: H - 10, "text-anchor": "middle" }, p.short || p.label));
      attachTip(g, `<strong>${p.label}</strong><br>${nf.format(p.value)} ${opts.unit}${p.extra ? "<br>" + p.extra : ""}`);
      svg.appendChild(g);
    });
    container.replaceChildren(svg);
  }

  // ---- Horizontal bars: one series, ranked, direct value labels (HTML so text stays readable on phones) ----
  function barChart(container, rows, opts) {
    const max = Math.max(...rows.map((r) => r.value));
    const list = document.createElement("ul");
    list.className = "hbars";
    list.setAttribute("aria-label", opts.label);
    rows.forEach((row) => {
      const li = document.createElement("li");
      li.className = "hbar";
      li.tabIndex = 0;
      li.setAttribute("aria-label", `${row.label}: ${row.value} ${opts.unit}, ${row.tip}`);
      li.innerHTML = '<span class="hbar-label"></span><span class="hbar-track"><span class="hbar-fill"></span></span><span class="hbar-val"></span>';
      li.querySelector(".hbar-label").textContent = row.label;
      li.querySelector(".hbar-fill").style.width = (row.value / max) * 100 + "%";
      const v = li.querySelector(".hbar-val");
      v.innerHTML = "<strong></strong> <span></span>";
      v.firstChild.textContent = nf.format(row.value);
      v.lastChild.textContent = row.sub;
      const html = `<strong>${row.label}</strong><br>${nf.format(row.value)} ${opts.unit}<br>${row.tip}`;
      li.addEventListener("pointermove", (e) => showTip(html, e.clientX, e.clientY));
      li.addEventListener("pointerleave", hideTip);
      li.addEventListener("focus", () => { const r = li.getBoundingClientRect(); showTip(html, r.left + r.width / 2, r.top); });
      li.addEventListener("blur", hideTip);
      list.appendChild(li);
    });
    container.replaceChildren(list);
  }

  function table(container, head, rows, numericFrom) {
    const t = document.createElement("table");
    const thead = t.createTHead().insertRow();
    head.forEach((h, i) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = h;
      if (i >= numericFrom) th.className = "num";
      thead.appendChild(th);
    });
    const tb = t.createTBody();
    rows.forEach((r) => {
      const tr = tb.insertRow();
      r.forEach((c, i) => {
        const td = tr.insertCell();
        td.textContent = c;
        if (i >= numericFrom) td.className = "num";
      });
    });
    container.replaceChildren(t);
  }

  // ---- Render ----
  function render(d) {
    const cur = d.assumptions.currency === "GBP" ? "£" : d.assumptions.currency + " ";
    const money = (v) => cur + v.toFixed(2);
    const pence = (v) => (v === null || v === undefined ? "n/a" : cur + v.toFixed(3));
    const t = d.totals;
    const weeks = d.weekly_active_users;
    const first = weeks[0], last = weeks[weeks.length - 1];

    document.getElementById("period").textContent =
      `${d.period.start} to ${d.period.end} (${weeks.length} weeks, ${nf.format(t.events)} events, fictional data)`;

    const tiles = [
      ["Weekly active users", nf.format(last.total), `${last.week}, up from ${first.total} in ${first.week}`],
      ["People who used it", nf.format(t.active_users), "at least once in the period"],
      ["Accepted as-is", pct(t.acceptance_rate), `${pct(t.accepted_or_edited_rate)} accepted or edited`],
      ["Events using a skill", pct(t.skill_share), "the rest were ad hoc prompts"],
      ["Estimated cost", money(t.estimated_cost), `${nf.format(t.input_tokens + t.output_tokens)} tokens, illustrative rates`],
      ["Cost per accepted output", pence(t.cost_per_accepted), `${pence(d.no_skill.cost_per_accepted)} for ad hoc prompts`],
    ];
    const tileHost = document.getElementById("tiles");
    tileHost.replaceChildren(...tiles.map(([label, value, sub]) => {
      const div = document.createElement("div");
      div.className = "tile";
      div.innerHTML = `<div class="label"></div><div class="value"></div><div class="sub"></div>`;
      div.children[0].textContent = label;
      div.children[1].textContent = value;
      div.children[2].textContent = sub;
      return div;
    }));

    columnChart(document.getElementById("chart-wau"), weeks.map((w) => ({
      label: w.week, short: "W" + w.week.split("-W")[1], value: w.total,
      extra: Object.entries(w.by_team).map(([k, v]) => `${k}: ${v}`).join("<br>"),
      plain: Object.entries(w.by_team).map(([k, v]) => `${k} ${v}`).join(", "),
    })), { label: "Weekly active users by ISO week", unit: "active users", labelValues: true });

    barChart(document.getElementById("chart-skills"), d.top_skills.map((s) => ({
      label: s.skill, value: s.events, sub: pct(s.acceptance_rate) + " accepted",
      tip: `${s.users} users, ${pct(s.acceptance_rate)} accepted as-is, ${pence(s.cost_per_accepted)} per accepted output`,
    })), { label: "Top skills by number of uses", unit: "uses" });
    document.getElementById("no-skill-note").textContent =
      `For comparison, ad hoc prompts without a skill: ${nf.format(d.no_skill.events)} uses, ${pct(d.no_skill.acceptance_rate)} accepted as-is, ` +
      `${pence(d.no_skill.cost_per_accepted)} per accepted output.`;

    table(document.getElementById("table-teams"), ["Team", "Users", "Events", "Accepted", "Tokens", "Est. cost"],
      d.teams.map((r) => [r.team, nf.format(r.active_users), nf.format(r.events), pct(r.acceptance_rate),
        nf.format(r.input_tokens + r.output_tokens), money(r.estimated_cost)]), 1);

    const teamNames = Object.keys(first.by_team);
    table(document.getElementById("table-wau"), ["Week", ...teamNames, "Total"],
      weeks.map((w) => [w.week, ...teamNames.map((n) => nf.format(w.by_team[n])), nf.format(w.total)]), 1);

    document.getElementById("rates").textContent =
      `${cur}${d.assumptions.input_rate_per_million_tokens.toFixed(2)} per million input tokens and ` +
      `${cur}${d.assumptions.output_rate_per_million_tokens.toFixed(2)} per million output tokens`;
    markScrollable();
    document.getElementById("dashboard").setAttribute("data-rendered", "true");
  }

  // ---- Scrollable regions: keyboard-reachable only while they actually overflow ----
  function markScrollable() {
    document.querySelectorAll("[data-scroll-label]").forEach((node) => {
      if (node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 1) {
        node.tabIndex = 0;
        node.setAttribute("role", "region");
        node.setAttribute("aria-label", node.getAttribute("data-scroll-label") + " (scrolls sideways)");
      } else {
        node.removeAttribute("tabindex");
        node.removeAttribute("role");
        node.removeAttribute("aria-label");
      }
    });
  }
  window.addEventListener("resize", markScrollable);
  document.querySelectorAll("details").forEach((d) => d.addEventListener("toggle", markScrollable));
  markScrollable();

  // ---- Skill eval results (evals/results/latest.json, written by evals/run_evals.py) ----
  function renderEvals(e) {
    const t = e.totals, run = e.run;
    const when = run ? new Date(run.date + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "";
    document.getElementById("evals-run").textContent =
      `${t.cases_passed} of ${t.cases} cases and ${t.checks_passed} of ${t.checks} checks pass.` +
      (run ? ` Run on ${when} with ${run.model}, one attempt per case: ${nf.format(run.input_tokens + run.output_tokens)} tokens, ` +
        `$${run.cost_usd.toFixed(2)} as reported by Claude Code.` : "");
    table(document.getElementById("table-evals"), ["Skill", "What the case tests", "Checks", "Result"],
      e.results.map((r) => [r.skill, r.tests, `${r.checks.filter((c) => c.passed).length} of ${r.checks.length}`,
        r.status === "pass" ? "Pass" : r.status === "fail" ? "Fail" : "Not run"]), 2);
    const tbl = document.querySelector("#table-evals table");
    tbl.classList.add("evals");
    tbl.querySelectorAll("tbody td:last-child").forEach((td) => td.classList.add("result"));
    markScrollable();
    document.getElementById("evals").setAttribute("data-rendered", "true");
  }
  fetch("evals/results/latest.json", { cache: "no-cache" })
    .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(renderEvals)
    .catch((err) => {
      document.getElementById("evals-run").textContent = "The eval results could not be loaded (" + err.message + ").";
    });

  fetch("data/adoption-metrics.json", { cache: "no-cache" })
    .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(render)
    .catch((err) => {
      const box = document.getElementById("dashboard-error");
      box.hidden = false;
      box.textContent = "The dashboard data could not be loaded (" + err.message + "). " +
        "Serve the folder over HTTP, for example: python -m http.server, then open http://localhost:8000/.";
    });
})();
