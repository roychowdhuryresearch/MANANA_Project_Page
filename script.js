(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- live EEG trace: scrolls like a monitor, ripples under cursor/touch ---------- */
  const eegWrap = $('#eeg-wrap'), eegSvg = $('#eeg'), eegPath = $('#eeg-path');
  if (eegWrap && eegPath) {
    const W = 760, H = 70, MID = 35, N = 380;
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const noise = Array.from({ length: N + 1 }, () => rnd() - 0.5);
    const ripples = [];
    const signal = (i, t) => {
      const x = (i / N) * W, u = i / N;
      // calm background rhythm drifting left
      let y = 2.6 * Math.sin(2 * Math.PI * (u * 9 + t * 0.32)) + 0.9 * Math.sin(2 * Math.PI * (u * 27 + t * 0.9)) + noise[(((i + Math.floor(t * 12)) % (N + 1)) + (N + 1)) % (N + 1)] * 0.7;
      // spike-and-wave burst on the left half, gently breathing
      const env = Math.exp(-Math.pow((u - 0.29) / 0.11, 2)) * (0.85 + 0.15 * Math.sin(t * 0.9));
      if (env > 0.01) {
        const ph = 2 * Math.PI * (x / 34 + t * 0.9);
        y += env * (-26 * Math.pow(Math.max(0, Math.sin(ph)), 14) + 7 * Math.sin(ph - 1.3));
      }
      if (u > 0.55) y *= 0.55; // settled (teal) side
      // travelling ripples from pointer/touch
      for (const r of ripples) {
        const age = t - r.t0, d = Math.abs(x - r.x) - age * 240;
        y += r.a * Math.exp(-age * 1.6) * Math.exp(-(d * d) / 500) * Math.sin(d / 4.2);
      }
      return MID + y;
    };
    const draw = (t) => {
      let d = '';
      for (let i = 0; i <= N; i++) d += (i ? 'L' : 'M') + ((i / N) * W).toFixed(1) + ' ' + signal(i, t).toFixed(1);
      eegPath.setAttribute('d', d);
    };
    if (reduce) { draw(0); }
    else {
      let running = false, t0 = performance.now(), visible = true;
      const loop = (now) => {
        const t = Math.max(0, (now - t0) / 1000);
        while (ripples.length && t - ripples[0].t0 > 3.5) ripples.shift();
        draw(t);
        if (visible && !document.hidden) requestAnimationFrame(loop); else running = false;
      };
      const start = () => { if (!running) { running = true; requestAnimationFrame(loop); } };
      if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); }).observe(eegWrap);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
      const toX = (ev) => { const r = eegSvg.getBoundingClientRect(); return ((ev.clientX - r.left) / r.width) * W; };
      let lastX = null, lastT = 0;
      eegWrap.addEventListener('pointermove', (ev) => {
        const now = (performance.now() - t0) / 1000, x = toX(ev);
        if (lastX === null || Math.abs(x - lastX) > 26 || now - lastT > 0.25) {
          ripples.push({ x, t0: now, a: 7 }); lastX = x; lastT = now;
          if (ripples.length > 24) ripples.shift();
        }
      });
      eegWrap.addEventListener('pointerleave', () => { lastX = null; });
      eegWrap.addEventListener('pointerdown', (ev) => {
        ripples.push({ x: toX(ev), t0: (performance.now() - t0) / 1000, a: 17 });
        eegWrap.classList.add('touched');
      });
      start();
    }
  }

  /* ---------- sticky nav ---------- */
  const nav = $('#topnav');
  const hero = $('.hero .links');
  if (nav && hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => nav.classList.toggle('show', !e.isIntersecting && e.boundingClientRect.top < 0)).observe(hero);
    const links = $$('.topnav .sections a');
    const map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
    const spy = new IntersectionObserver((es) => {
      es.forEach(e => { if (e.isIntersecting) { links.forEach(a => a.classList.remove('active')); const a = map.get(e.target.id); if (a) a.classList.add('active'); } });
    }, { rootMargin: '-45% 0px -50% 0px' });
    map.forEach((_, id) => { const s = document.getElementById(id); if (s) spy.observe(s); });
  }

  /* ---------- bar widths (no scroll-triggered hiding) ---------- */
  // per card: the largest bar fills 88% of the track; zero-based, so ratios between bars are exact
  $$('.cmp').forEach(card => {
    const bars = $$('.track i', card), max = Math.max(...bars.map(i => parseFloat(i.dataset.w) || 0)) || 1;
    bars.forEach(i => { i.style.width = ((parseFloat(i.dataset.w) || 0) / max * 88).toFixed(2) + '%'; });
  });

  /* ---------- highlight drug names inside artifacts ---------- */
  const drugs = /\b(carbamazepine|clobazam|clonazepam|ethosuximide|lamotrigine|levetiracetam|phenobarbital|phenytoin|topiramate|valproate|oxcarbazepine|keppra|depakote)\b/gi;
  $$('.artifact[data-hl]').forEach(root => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(t => {
      if (!drugs.test(t.nodeValue)) return; drugs.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0, m;
      while ((m = drugs.exec(t.nodeValue))) {
        frag.append(t.nodeValue.slice(last, m.index));
        const s = document.createElement('span'); s.className = 'drug'; s.textContent = m[0]; frag.append(s);
        last = m.index + m[0].length;
      }
      frag.append(t.nodeValue.slice(last));
      t.replaceWith(frag);
    });
  });

  /* ---------- artifact tabs (WAI-ARIA) ---------- */
  const tabs = $$('[role="tab"]');
  const select = (tab, focus) => {
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
      const p = document.getElementById(t.getAttribute('aria-controls')); if (p) p.hidden = !on;
    });
    if (focus) tab.focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      const k = e.key; let j = null;
      if (k === 'ArrowRight') j = (i + 1) % tabs.length;
      else if (k === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
      else if (k === 'Home') j = 0; else if (k === 'End') j = tabs.length - 1;
      if (j !== null) { e.preventDefault(); select(tabs[j], true); }
    });
  });

  /* ---------- Table 1 ---------- */
  // [mean, sd] for Mono V1..V3, Poly V1..V3; null = not applicable. Source: camera-ready Table 1.
  const T = {
    A: [
      ['Expert system'],
      ['EpiPick', [[52.9], [49.1], [51.3], null, null, null]],
      ['Classical methods'],
      ['Naive Bayes', [[71.3, 2.1], [67.2, 3.7], [74.9, 2.9], [35.8, 1.1], [40.0, 0.9], [37.7, 2.3]]],
      ['XGBoost', [[70.2, 1.0], [64.1, 1.1], [71.1, 0.3], [33.6, 2.7], [40.3, 1.6], [43.1, 2.0]]],
      ['Direct LLM prompting'],
      ['Base Prompt (0-learning)', [[44.4, 1.8], [56.4, 1.3], [59.3, 0.3], [10.1, 1.9], [29.3, 3.3], [30.2, 1.3]]],
      ['Single-agent', [[78.4, 1.1], [84.5, 1.9], [90.3, 2.4], [14.5, 1.2], [40.2, 0.7], [42.3, 2.5]]],
      ['Prompt optimization'],
      ['DSPy (GEPA)', [[87.1, 1.8], [91.3, 4.1], [95.0, 3.2], [24.5, 0.9], [58.7, 2.9], [70.2, 3.4]]],
      ['ExpeL', [[67.2, 2.4], [81.0, 3.9], [82.7, 3.7], [18.9, 1.1], [28.3, 1.4], [42.9, 2.5]]],
      ['TextGrad', [[87.4, 2.3], [88.1, 5.2], [87.3, 4.4], [21.9, 4.1], [50.7, 4.3], [57.6, 3.0]]],
      ['Ours'],
      ['Manana-Single', [[87.0, 0.4], [92.1, 2.5], [93.2, 2.1], [25.3, 1.0], [57.0, 5.6], [64.1, 3.9]], 1],
      ['Manana-Multi', [[89.7, 3.2], [95.3, 2.8], [97.0, 2.1], [30.8, 1.9], [61.7, 8.4], [72.6, 11.1]], 1],
    ],
    B: [
      ['Expert system'],
      ['EpiPick', [[58.0], [61.4], [58.1], null, null, null]],
      ['Classical methods'],
      ['Naive Bayes', [[37.7, 2.6], [40.9, 3.2], [38.2, 2.5], [4.4, 1.2], [2.5, 0.5], [4.0, 1.3]]],
      ['XGBoost', [[41.5, 2.6], [45.5, 2.2], [45.3, 2.3], [10.4, 1.4], [7.1, 0.6], [4.6, 0.3]]],
      ['Direct LLM prompting'],
      ['Base Prompt (0-learning)', [[53.1, 0.5], [57.6, 0.7], [58.4, 1.1], [24.8, 3.6], [29.1, 1.6], [30.4, 1.6]]],
      ['Single-agent', [[76.7, 0.6], [82.6, 2.3], [83.8, 2.4], [39.4, 2.4], [49.4, 1.4], [54.0, 1.1]]],
      ['Prompt optimization'],
      ['DSPy (GEPA)', [[81.8, 4.2], [93.3, 2.1], [94.8, 1.1], [44.8, 0.8], [59.6, 3.7], [62.7, 2.9]]],
      ['ExpeL', [[83.1, 3.8], [88.5, 4.8], [86.5, 4.5], [32.0, 2.6], [56.2, 3.3], [64.3, 4.6]]],
      ['TextGrad', [[74.0, 9.9], [87.7, 4.7], [87.3, 4.2], [39.0, 3.3], [52.4, 8.6], [57.3, 8.5]]],
      ['Ours'],
      ['Manana-Single', [[82.2, 5.0], [92.8, 2.7], [92.2, 2.2], [48.2, 1.7], [65.2, 3.8], [66.4, 4.7]], 1],
      ['Manana-Multi', [[87.3, 2.9], [95.1, 1.6], [93.2, 1.9], [40.2, 4.6], [61.1, 5.8], [69.8, 7.5]], 1],
    ],
  };
  const tbody = $('#main-table tbody');
  const COLS = [0, 2, 3, 5]; // Mono V1, Mono V3, Poly V1, Poly V3
  const renderTable = (c) => {
    const DROP = new Set(['EpiPick', 'XGBoost', 'ExpeL']);
    const rows = T[c].filter(r => r[1] && !DROP.has(r[0]));
    const best = COLS.map(j => Math.max(...rows.map(r => (r[1][j] ? r[1][j][0] : -1))));
    let firstOurs = true;
    tbody.innerHTML = rows.map(r => {
      const cells = COLS.map((j, k) => {
        const v = r[1][j];
        if (!v) return '<td class="na">—</td>';
        return `<td class="${v[0] === best[k] ? 'best' : ''}"><span class="v">${v[0].toFixed(1)}</span></td>`;
      }).join('');
      const cls = r[2] ? ('ours' + (firstOurs ? ' first' : '')) : '';
      if (r[2]) firstOurs = false;
      return `<tr class="${cls}"><td>${r[0]}</td>${cells}</tr>`;
    }).join('');
  };
  if (tbody) {
    renderTable('A');
    $$('[data-cohort]').forEach(b => b.addEventListener('click', () => {
      $$('[data-cohort]').forEach(x => x.setAttribute('aria-pressed', x === b));
      renderTable(b.dataset.cohort);
    }));
  }

  /* ---------- native SVG charts ---------- */
  // Curves read from the vector paths of the paper's BPA figure (figs/bpa_uncertainty_compact.pdf);
  // they agree with Table 3 (e.g. Multi, Cohort B: 98.9% at 75% deferral, 94.6% at 50%).
  const DEFER_X = Array.from({ length: 21 }, (_, i) => i * 5);
  const DEFER = {
    A: { Multi: [70.2, 72.5, 75.0, 76.7, 78.9, 81.5, 83.0, 85.2, 86.4, 87.2, 89.8, 92.5, 93.4, 94.3, 95.0, 96.5, 97.5, 97.5, 97.5, 97.5, 100],
         Single: [68.1, 70.5, 72.5, 75.3, 77.5, 79.8, 82.5, 84.0, 87.7, 88.8, 90.3, 90.8, 91.9, 92.9, 93.3, 94.0, 95.6, 96.7, 96.3, 97.5, 100] },
    B: { Multi: [75.1, 77.1, 79.5, 82.0, 83.4, 85.5, 87.3, 89.2, 90.9, 92.2, 94.6, 95.3, 96.4, 97.4, 98.1, 98.9, 98.9, 99.5, 100, 100, 100],
         Single: [68.5, 71.0, 73.1, 75.4, 77.2, 79.2, 81.6, 84.1, 86.1, 88.1, 90.9, 91.3, 93.2, 95.3, 96.0, 96.3, 96.4, 97.6, 97.2, 94.3, 100] },
  };
  const REL_X = [0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95];
  const REL = {
    A: { Multi: [28.6, 25.0, 31.1, 46.7, 46.8, 60.6, 76.3, 94.4], Single: [16.7, 20.0, 30.9, 40.8, 51.4, 63.3, 86.7, 95.0] },
    B: { Multi: [30.0, 35.3, 37.2, 50.5, 57.0, 65.4, 80.4, 96.5], Single: [16.7, 24.2, 40.3, 45.9, 52.8, 69.8, 86.3, 96.5] },
  };
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.append(n);
    return n;
  };
  const chart = (host, o) => {
    host.innerHTML = '';
    const W = o.w, H = o.h, m = { t: 16, r: 18, b: 52, l: W >= 420 ? 64 : 46 };
    const sx = v => m.l + (v - o.x[0]) / (o.x[1] - o.x[0]) * (W - m.l - m.r);
    const sy = v => H - m.b - (v - o.y[0]) / (o.y[1] - o.y[0]) * (H - m.t - m.b);
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMid meet' }, host);
    const g = el('g', { class: 'axis' }, svg);
    o.yt.forEach(v => { el('line', { x1: m.l, x2: W - m.r, y1: sy(v), y2: sy(v), class: 'grid' }, g); const t = el('text', { x: m.l - 10, y: sy(v) + 5, 'text-anchor': 'end' }, g); t.textContent = o.yf ? o.yf(v) : v; });
    o.xt.forEach(v => { const t = el('text', { x: sx(v), y: H - m.b + 22, 'text-anchor': 'middle' }, g); t.textContent = o.xf ? o.xf(v) : v; });
    el('line', { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, class: 'base' }, g);
    const xl = el('text', { x: m.l + (W - m.l - m.r) / 2, y: H - 6, 'text-anchor': 'middle', class: 'lab' }, g); xl.textContent = o.xl;
    if (W >= 420) { const yl = el('text', { x: 16, y: m.t + (H - m.t - m.b) / 2, 'text-anchor': 'middle', class: 'lab', transform: `rotate(-90 16 ${m.t + (H - m.t - m.b) / 2})` }, g); yl.textContent = o.yl; }
    if (o.diag) el('line', { x1: sx(o.x[0]), y1: sy(o.y[0]), x2: sx(o.x[1]), y2: sy(o.y[1]), class: 'diag' }, svg);
    o.series.forEach(se => {
      const d = se.xs.map((x, i) => (i ? 'L' : 'M') + sx(x).toFixed(1) + ' ' + sy(se.ys[i]).toFixed(1)).join('');
      el('path', { d, class: 'ser ' + se.cls }, svg);
      if (se.dots) se.xs.forEach((x, i) => el('circle', { cx: sx(x), cy: sy(se.ys[i]), r: 5, class: 'pt ' + se.cls }, svg));
    });
    return { svg, sx, sy, m, W, H };
  };

  // reliability diagrams (drawn at real pixel width so labels stay legible)
  const drawRel = () => ['A', 'B'].forEach(c => {
    const host = document.getElementById('rel-' + c);
    if (!host) return;
    const w = Math.max(300, Math.min(560, host.clientWidth || 520));
    chart(host, {
      w, h: Math.round(w * 0.78), x: [0, 1], y: [0, 100], xt: [0, 0.2, 0.4, 0.6, 0.8, 1], yt: [0, 20, 40, 60, 80, 100],
      xf: v => v.toFixed(1), xl: 'BPA confidence', yl: 'Agreement (%)', diag: true,
      series: [{ xs: REL_X, ys: REL[c].Single, cls: 'single', dots: true }, { xs: REL_X, ys: REL[c].Multi, cls: 'multi', dots: true }],
    });
  });
  drawRel();
  let redraw = [drawRel];
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => redraw.forEach(f => f()), 150); });

  /* ---------- deferral explorer (camera-ready Table 3) ---------- */
  const OPS = [
    { id: 't95', label: 'Confidence ≥ 0.95', A: [97, 14], B: [99, 18] },
    { id: 't90', label: 'Confidence ≥ 0.90', A: [94, 33], B: [96, 40] },
    { id: 't85', label: 'Confidence ≥ 0.85', A: [86, 56], B: [92, 56] },
    { id: 'q25', label: 'Most confident 25%', A: [96, 25], B: [99, 25] },
    { id: 'q50', label: 'Most confident 50%', A: [90, 50], B: [95, 50] },
    { id: 'all', label: 'Handle every case', A: [70, 100], B: [75, 100] },
  ];
  const state = { c: 'B', op: 'q50' };
  const ops = $('#ops'), dhost = $('#defer-chart');
  if (ops && dhost) {
    const draw = () => {
      const o = OPS.find(x => x.id === state.op); const [p, cov] = o[state.c];
      $$('button', ops).forEach(b => {
        const x = OPS.find(y => y.id === b.dataset.op);
        b.setAttribute('aria-pressed', b.dataset.op === state.op);
        b.querySelector('.p').textContent = x[state.c][0] + '%';
        b.querySelector('.c').textContent = x[state.c][1] + '%';
      });
      $('#d-prec').textContent = p + '%';
      $('#d-cov').textContent = cov + '%';
      const deferred = 100 - cov;
      $('#d-sentence').textContent = deferred
        ? `Cohort ${state.c}: the system handles ${cov}% of visits at ${p}% top-1 agreement and defers ${deferred}% to a specialist.`
        : `Cohort ${state.c}: without deferral, top-1 agreement is ${p}%.`;

      const dw = Math.max(280, dhost.clientWidth || 560);
      const c = chart(dhost, {
        w: dw, h: Math.round(Math.max(300, Math.min(460, dw * 0.42))), x: [0, 100], y: [60, 100], xt: [0, 25, 50, 75, 100], yt: [60, 70, 80, 90, 100],
        xf: v => v + '%', yf: v => v + '%', xl: 'Deferred to specialist', yl: 'Top-1 agreement',
        series: [{ xs: DEFER_X, ys: DEFER[state.c].Single, cls: 'single' }, { xs: DEFER_X, ys: DEFER[state.c].Multi, cls: 'multi' }],
      });
      const mx = c.sx(deferred), my = c.sy(p);
      el('line', { x1: mx, x2: mx, y1: c.m.t, y2: c.H - c.m.b, class: 'mark-rule' }, c.svg);
      el('circle', { cx: mx, cy: my, r: 9, class: 'mark' }, c.svg);
      const lab = el('text', { x: mx + (deferred > 70 ? -12 : 12), y: my + (my < 40 ? 18 : -10), 'text-anchor': deferred > 70 ? 'end' : 'start', class: 'mark-lab' }, c.svg);
      lab.textContent = `${p}% · defer ${deferred}%`;

      // hover readout
      const guide = el('line', { y1: c.m.t, y2: c.H - c.m.b, class: 'hover-rule', visibility: 'hidden' }, c.svg);
      const tip = el('g', { class: 'tip', visibility: 'hidden' }, c.svg);
      const tb = el('rect', { rx: 8, height: 54, width: 180 }, tip);
      const t1 = el('text', { x: 12, y: 22 }, tip), t2 = el('text', { x: 12, y: 42 }, tip);
      const ov = el('rect', { x: c.m.l, y: c.m.t, width: c.W - c.m.l - c.m.r, height: c.H - c.m.t - c.m.b, fill: 'transparent' }, c.svg);
      const move = (ev) => {
        const pt = c.svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
        const q = pt.matrixTransform(c.svg.getScreenCTM().inverse());
        const i = Math.max(0, Math.min(20, Math.round(((q.x - c.m.l) / (c.W - c.m.l - c.m.r)) * 20)));
        const x = c.sx(DEFER_X[i]);
        guide.setAttribute('x1', x); guide.setAttribute('x2', x); guide.setAttribute('visibility', 'visible');
        t1.textContent = `Defer ${DEFER_X[i]}%`;
        t2.textContent = `Multi ${DEFER[state.c].Multi[i].toFixed(1)}% · Single ${DEFER[state.c].Single[i].toFixed(1)}%`;
        const w = Math.max(t1.getComputedTextLength(), t2.getComputedTextLength()) + 20; tb.setAttribute('width', w);
        const tx = x + 10 + w > c.W - c.m.r ? x - 10 - w : x + 10;
        tip.setAttribute('transform', `translate(${tx} ${c.H - c.m.b - 68})`); tip.setAttribute('visibility', 'visible');
      };
      ov.addEventListener('pointermove', move);
      ov.addEventListener('pointerleave', () => { guide.setAttribute('visibility', 'hidden'); tip.setAttribute('visibility', 'hidden'); });
    };
    ops.innerHTML = OPS.map(o => `<button type="button" data-op="${o.id}" aria-pressed="false"><span>${o.label}</span><span class="p"></span><span class="c"></span></button>`).join('');
    $$('button', ops).forEach(b => b.addEventListener('click', () => { state.op = b.dataset.op; draw(); }));
    $$('[data-dcohort]').forEach(b => b.addEventListener('click', () => {
      $$('[data-dcohort]').forEach(x => x.setAttribute('aria-pressed', x === b));
      state.c = b.dataset.dcohort; draw();
    }));
    draw();
    redraw.push(draw);
  }

  /* ---------- how it works: scroll-driven on desktop, autoplay loop on phones ---------- */
  const hiw = $('#hiw');
  if (hiw) {
    const steps = $$('.hiw-step', hiw), dots = $$('.hiw-dots i', hiw), cap = $('#hiw-cap');
    const N = steps.length;
    let cur = -1;
    const setStage = (i) => {
      if (i === cur) return; cur = i;
      hiw.dataset.stage = i;
      for (let k = 0; k < N; k++) hiw.classList.toggle('ge' + k, i >= k);
      steps.forEach((s, k) => s.classList.toggle('on', k === i));
      dots.forEach((d, k) => { d.classList.toggle('on', k === i); d.classList.toggle('done', k < i); });
      cap.innerHTML = `<h3>${i + 1}. ${steps[i].querySelector('h3').textContent}</h3><p>${steps[i].querySelector('p').innerHTML}</p>`;
    };
    const setMode = (m) => {
      hiw.classList.toggle('mode-single', m === 'single'); hiw.classList.toggle('mode-multi', m === 'multi');
      $$('[data-mode]', hiw).forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === m));
    };
    $$('[data-mode]', hiw).forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
    setMode('multi');
    setStage(0);

    const desktop = window.matchMedia('(min-width: 901px)');
    // desktop: the step nearest the middle of the screen drives the diagram
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((es) => {
        if (!desktop.matches) return;
        es.forEach(e => { if (e.isIntersecting) setStage(+e.target.dataset.step); });
      }, { rootMargin: '-45% 0px -50% 0px' });
      steps.forEach(s => io.observe(s));
    }
    steps.forEach(s => s.addEventListener('click', () => s.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })));

    // phones: plays like a short video
    let playing = !reduce, timer = 0, onScreen = false;
    const play = $('#hiw-play');
    const tick = () => {
      clearTimeout(timer);
      play.textContent = playing ? 'Pause' : 'Play';
      if (!playing || desktop.matches || !onScreen) return;
      timer = setTimeout(() => {
        setStage((cur + 1) % N);
        if (cur === 0) setMode(hiw.classList.contains('mode-multi') ? 'single' : 'multi');
        tick();
      }, cur === N - 1 ? 5200 : 3800);
    };
    const manual = (i) => { playing = false; setStage((i + N) % N); tick(); };
    $('#hiw-prev').addEventListener('click', () => manual(cur - 1));
    $('#hiw-next').addEventListener('click', () => manual(cur + 1));
    play.addEventListener('click', () => { playing = !playing; tick(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; tick(); }, { threshold: 0.35 }).observe($('.hiw-sticky', hiw));
    }
    desktop.addEventListener('change', tick);
  }

  /* ---------- map: Africa → Uganda zoom ---------- */
  const mapHost = $('#map'), MAP = window.MANANA_MAP;
  if (mapHost && MAP) {
    const svg = el('svg', { viewBox: `0 0 ${MAP.w} ${MAP.h}`, preserveAspectRatio: 'xMidYMid meet' }, mapHost);
    const gC = el('g', { class: 'countries' }, svg);
    MAP.countries.forEach(c => { const p = el('path', { d: c.d, class: 'c' + (c.id === 'UGA' ? ' ug' : '') }, gC); const t = el('title', {}, p); t.textContent = c.name; });
    const gL = el('g', { class: 'lakes' }, svg);
    MAP.lakes.forEach(l => el('path', { d: l.d, class: 'lake' }, gL));
    const [kx, ky] = MAP.kampala;
    const pin = el('g', { class: 'pin' }, svg);
    const pulse = el('circle', { cx: kx, cy: ky, class: 'pulse' }, pin);
    const dot = el('circle', { cx: kx, cy: ky, class: 'dot' }, pin);
    const kLab = el('text', { x: kx, y: ky, class: 'klab' }, pin); kLab.textContent = 'Kampala';
    const [ux, uy, uw, uh] = MAP.uganda;
    const uLab = el('text', { x: ux + uw * 0.42, y: uy + uh * 0.32, class: 'ulab', 'text-anchor': 'middle' }, svg); uLab.textContent = 'UGANDA';
    const vLab = el('text', { x: kx + 14, y: ky + 40, class: 'vlab', 'text-anchor': 'middle' }, svg); vLab.textContent = 'Lake Victoria';

    const full = [0, 0, MAP.w, MAP.h];
    const zw = 190, zh = zw * MAP.h / MAP.w, zoomBox = [kx - zw * 0.6, ky - zh * 0.44, zw, zh];
    let cur = full.slice(), raf = 0;
    const apply = (vb) => {
      svg.setAttribute('viewBox', vb.map(v => v.toFixed(2)).join(' '));
      const k = vb[2] / MAP.w; // 1 at full view, ~0.19 zoomed
      const z = Math.max(0, Math.min(1, (1 - k) / (1 - zw / MAP.w)));
      svg.style.setProperty('--k', k);
      dot.setAttribute('r', 9 * k + 1.2 * (1 - k) * 0.2);
      pulse.setAttribute('r', 9 * k);
      kLab.setAttribute('x', kx + 7 * k + 3.2 * z); kLab.setAttribute('y', ky - 7 * k - 2.2 * z);
      kLab.style.fontSize = (34 * k) + 'px';
      uLab.style.fontSize = (60 * k) + 'px'; uLab.style.opacity = z;
      vLab.style.fontSize = (30 * k) + 'px'; vLab.style.opacity = z;
      kLab.style.opacity = Math.max(0, (z - 0.25) / 0.75);
    };
    const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const go = (target, ms = 2200) => {
      cancelAnimationFrame(raf);
      $$('[data-zoom]').forEach(b => b.setAttribute('aria-pressed', (b.dataset.zoom === 'uganda') === (target === zoomBox)));
      if (reduce) { cur = target.slice(); apply(cur); return; }
      const from = cur.slice(), t0 = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - t0) / ms), e = ease(t);
        // zoom in log space so the motion feels even
        const w = Math.exp(Math.log(from[2]) + (Math.log(target[2]) - Math.log(from[2])) * e);
        const cx = (from[0] + from[2] / 2) + ((target[0] + target[2] / 2) - (from[0] + from[2] / 2)) * e;
        const cy = (from[1] + from[3] / 2) + ((target[1] + target[3] / 2) - (from[1] + from[3] / 2)) * e;
        const hgt = w * MAP.h / MAP.w;
        cur = [cx - w / 2, cy - hgt / 2, w, hgt];
        apply(cur);
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    // start zoomed out; glide into Uganda when the map is on screen (content is visible either way)
    apply(full);
    let zoomed = false;
    const zoomIn = () => { if (!zoomed) { zoomed = true; setTimeout(() => go(zoomBox), 350); } };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { zoomIn(); io.disconnect(); } }, { threshold: 0.45 });
      io.observe(mapHost);
    } else { cur = zoomBox.slice(); apply(cur); }
    $$('[data-zoom]').forEach(b => b.addEventListener('click', () => { zoomed = true; go(b.dataset.zoom === 'uganda' ? zoomBox : full, 1600); }));
  }

  /* ---------- model-in-action walkthrough (synthetic, illustrative) ---------- */
  const CASES = {
    A: {
      note: { head: 'Visit 3 · girl, 7 years, 22 kg', body: 'Focal seizures with impaired awareness since age 4. On carbamazepine since the first visit. Mother reports no seizures for the past three months and no side effects. Attending school.' },
      specialists: [
        ['Explicit_Drug_Directive_Agent', 'Current regimen is carbamazepine. The note gives no instruction to change it.'],
        ['Seizure_Semiology_Agent', 'Focal seizures; no generalized features described.'],
        ['Formulary_Adjunct_Agent', 'Seizures controlled on a first-line drug; no adjunct indicated.'],
        ['EEG_Broad_Spectrum_Agent', 'No EEG or imaging findings in this note.'],
      ],
      votes: ['CBZ', 'CBZ', 'CBZ', 'CBZ', 'CBZ'],
      dist: [['carbamazepine', 'CBZ', 0.93], ['carbamazepine + levetiracetam', 'CBZ+LEV', 0.05], ['valproate', 'VPA', 0.02]],
    },
    B: {
      note: { head: 'Visit 2 · boy, 11 years, 34 kg', body: 'Generalized tonic-clonic seizures, now about weekly despite valproate. EEG: diffuse slowing with left-sided sharp waves. Teacher reports daytime drowsiness.' },
      specialists: [
        ['Explicit_Drug_Directive_Agent', 'Current regimen is valproate. Ongoing seizures documented; no explicit plan yet.'],
        ['Seizure_Semiology_Agent', 'Convulsions look generalized, but the EEG suggests a focal component.'],
        ['Formulary_Adjunct_Agent', 'Uncontrolled on a first-line drug; carbamazepine is a locally available adjunct.'],
        ['EEG_Broad_Spectrum_Agent', 'Mixed EEG findings; broad-spectrum coverage stays relevant.'],
      ],
      votes: ['VPA+LEV', 'VPA+CBZ', 'VPA+LEV', 'LEV', 'VPA+CBZ'],
      dist: [['valproate + levetiracetam', 'VPA+LEV', 0.41], ['valproate + carbamazepine', 'VPA+CBZ', 0.33], ['levetiracetam', 'LEV', 0.18]],
    },
  };
  const THRESH = 0.90;
  const demo = $('#demo');
  if (demo) {
    const st = { c: 'A', s: 0, playing: !reduce, timer: 0 };
    const noteEl = $('#demo-note'), stage = $('#demo-stage');
    const regCls = r => 'rg-' + r.replace(/\+/g, '-').toLowerCase();
    const render = () => {
      const C = CASES[st.c];
      $$('[data-case]').forEach(b => b.setAttribute('aria-pressed', b.dataset.case === st.c));
      $$('#pipe button').forEach(b => {
        const i = +b.dataset.step;
        b.classList.toggle('done', i < st.s); b.classList.toggle('on', i === st.s);
        b.setAttribute('aria-current', i === st.s ? 'step' : 'false');
      });
      noteEl.className = 'note' + (st.s === 0 ? ' focus' : '');
      noteEl.innerHTML = `<div class="note-tag">Clinic note · synthetic</div><h4>${C.note.head}</h4><p>${C.note.body}</p><div class="note-q">Which anti-seizure regimen will the physician prescribe?</div>`;
      let html = '';
      if (st.s === 0) {
        html = `<div class="st-title">The note arrives</div><p class="st-p">Manana reads the current note, earlier visits, and earlier prescriptions. The physician's plan is hidden; Manana has to predict it.</p>
          <div class="st-chain"><span>Note</span><i></i><span>4 specialists</span><i></i><span>5 memory states</span><i></i><span>BPA</span></div>`;
      } else if (st.s === 1) {
        html = `<div class="st-title">Learned specialists surface signals</div><div class="spec-list">` +
          C.specialists.map((x, i) => `<div class="spec" style="--d:${i * 90}ms"><div class="spec-n">${x[0]}</div><div class="spec-o">${x[1]}</div></div>`).join('') +
          `</div><p class="st-foot">Specialists only observe. The Predictor turns their signals into three candidate regimens.</p>`;
      } else if (st.s === 2) {
        html = `<div class="st-title">Each memory state proposes; BPA merges</div>
          <div class="votes">${C.votes.map((v, i) => `<div class="vote ${regCls(v)}" style="--d:${i * 80}ms"><span class="m">m<sub>${[3, 7, 9, 12, 15][i]}</sub></span><span class="r">${v}</span></div>`).join('')}</div>
          <div class="dist">${C.dist.map(([name, code, p], i) => `<div class="drow ${i === 0 ? 'top' : ''}"><span class="dn">${name}</span><span class="dt"><i class="${regCls(code)}" style="width:${(p * 100).toFixed(0)}%"></i></span><span class="dp">${p.toFixed(2)}</span></div>`).join('')}</div>
          <p class="st-foot">Five retained memory states from learning, weighted by validation evidence. Probability on the top regimen is the confidence.</p>`;
      } else {
        const top = C.dist[0], ok = top[2] >= THRESH;
        html = `<div class="st-title">Recommend or defer</div>
          <div class="gauge"><div class="gbar"><i style="width:${(top[2] * 100).toFixed(0)}%" class="${ok ? 'ok' : 'low'}"></i><b style="left:${THRESH * 100}%"></b></div>
          <div class="glab"><span>confidence <b>${top[2].toFixed(2)}</b></span><span>clinic threshold ${THRESH.toFixed(2)}</span></div></div>
          <div class="verdict-card ${ok ? 'vc-ok' : 'vc-defer'}">${ok
            ? `<div class="vk">Recommend</div><div class="vt">Continue <b>${top[0]}</b></div><p>High confidence. The suggestion goes to the frontline clinician, who makes the final call.</p>`
            : `<div class="vk">Defer to a specialist</div><div class="vt">Top options: ${C.dist.map(d => d[0]).join(' · ')}</div><p>Confidence is below the threshold. The case is routed for specialist review with the candidate regimens and the flagged focal-versus-generalized conflict.</p>`}</div>`;
      }
      stage.innerHTML = html;
    };
    const schedule = () => {
      clearTimeout(st.timer);
      $('#demo-play').textContent = st.playing ? 'Pause' : 'Play';
      if (!st.playing) return;
      st.timer = setTimeout(() => {
        if (st.s < 3) st.s++;
        else { st.s = 0; st.c = st.c === 'A' ? 'B' : 'A'; }
        render(); schedule();
      }, st.s === 3 ? 5200 : 3600);
    };
    const userGo = (fn) => { fn(); st.playing = false; render(); schedule(); };
    $$('#pipe button').forEach(b => b.addEventListener('click', () => userGo(() => { st.s = +b.dataset.step; })));
    $$('[data-case]').forEach(b => b.addEventListener('click', () => userGo(() => { st.c = b.dataset.case; st.s = 0; })));
    $('#demo-prev').addEventListener('click', () => userGo(() => { st.s = Math.max(0, st.s - 1); }));
    $('#demo-next').addEventListener('click', () => userGo(() => { st.s = Math.min(3, st.s + 1); }));
    $('#demo-play').addEventListener('click', () => { st.playing = !st.playing; schedule(); });
    // only autoplay while the demo is on screen
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { if (!e.isIntersecting) clearTimeout(st.timer); else schedule(); }, { threshold: 0.3 }).observe(demo);
    }
    render(); schedule();
  }

  /* ---------- BibTeX copy ---------- */
  const copy = $('#copy-bib');
  if (copy) copy.addEventListener('click', async () => {
    const txt = $('#bib-text').textContent;
    try { await navigator.clipboard.writeText(txt); }
    catch (e) {
      const r = document.createRange(); r.selectNodeContents($('#bib-text'));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand('copy'); s.removeAllRanges();
    }
    copy.textContent = 'Copied'; setTimeout(() => (copy.textContent = 'Copy'), 1600);
  });

})();
