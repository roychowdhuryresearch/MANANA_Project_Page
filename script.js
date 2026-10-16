(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- EEG trace under the title: a burst that settles ---------- */
  const eeg = $('#eeg');
  if (eeg) {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const W = 560, mid = 23, n = 280;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * W, u = i / n;
      // amplitude envelope: low, spike-wave burst around u≈0.32, then calm
      const burst = Math.exp(-Math.pow((u - 0.32) / 0.085, 2));
      const base = 2.2 + 1.2 * Math.sin(u * 40);
      let y = Math.sin(u * 95 + rnd() * 0.6) * base * (1 - burst) * (u > 0.55 ? 0.45 : 1);
      if (burst > 0.04) y += (i % 7 < 2 ? -1 : 0.55) * 19 * burst + (rnd() - 0.5) * 4 * burst;
      y += (rnd() - 0.5) * 1.6 * (u > 0.55 ? 0.4 : 1);
      pts.push([x, mid + y]);
    }
    const split = Math.round(n * 0.55);
    const toD = (a) => a.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    const ns = 'http://www.w3.org/2000/svg';
    const p1 = document.createElementNS(ns, 'path'); p1.setAttribute('d', toD(pts.slice(0, split + 1)));
    const p2 = document.createElementNS(ns, 'path'); p2.setAttribute('d', toD(pts.slice(split))); p2.setAttribute('class', 'calm');
    eeg.append(p1, p2);
    if (!reduce) {
      [p1, p2].forEach((p, k) => {
        const L = p.getTotalLength();
        p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
        p.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: k ? 1100 : 1300, delay: k ? 1450 : 250, easing: 'cubic-bezier(.4,.1,.2,1)', fill: 'forwards' });
      });
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
  $$('.cmp .track i').forEach(i => { i.style.width = (parseFloat(i.dataset.w) || 0) + '%'; });

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
