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

  /* ---------- reveal on scroll + bars ---------- */
  const fillBars = (root) => $$('.cmp .track i', root).forEach(i => { i.style.width = (parseFloat(i.dataset.w) || 0) + '%'; });
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver((es) => {
      es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); fillBars(e.target); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    $$('.reveal').forEach(el => io.observe(el));
  } else {
    $$('.reveal').forEach(el => el.classList.add('in'));
    fillBars(document);
  }

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
  const renderTable = (c) => {
    const rows = T[c];
    const best = [0, 1, 2, 3, 4, 5].map(j => Math.max(...rows.filter(r => r[1]).map(r => (r[1][j] ? r[1][j][0] : -1))));
    tbody.innerHTML = rows.map(r => {
      if (!r[1]) return `<tr class="cat"><td colspan="7">${r[0]}</td></tr>`;
      const cells = r[1].map((v, j) => {
        if (!v) return '<td style="color:var(--muted)">—</td>';
        const isBest = v[0] === best[j];
        const sd = v[1] !== undefined ? `<span class="sd">±${v[1].toFixed(1)}</span>` : '';
        return `<td class="${isBest ? 'best' : ''}"><span class="v">${v[0].toFixed(1)}${sd}</span><span class="bar"><i style="width:${v[0]}%"></i></span></td>`;
      }).join('');
      return `<tr class="${r[2] ? 'ours' : ''}"><td>${r[0]}</td>${cells}</tr>`;
    }).join('');
  };
  if (tbody) {
    renderTable('A');
    $$('[data-cohort]').forEach(b => b.addEventListener('click', () => {
      $$('[data-cohort]').forEach(x => x.setAttribute('aria-pressed', x === b));
      renderTable(b.dataset.cohort);
    }));
  }

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
  const ops = $('#ops'), waffle = $('#waffle');
  if (ops && waffle) {
    for (let i = 0; i < 100; i++) waffle.append(document.createElement('i'));
    const cells = $$('i', waffle);
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
      const handled = Math.round(cov), ok = Math.round(cov * p / 100), miss = handled - ok;
      cells.forEach((el, i) => { el.className = i < ok ? 'ok' : i < handled ? 'miss' : ''; });
      const deferred = 100 - handled;
      $('#d-sentence').textContent = deferred
        ? `Of every 100 visits in Cohort ${state.c}, the system handles about ${handled} and agrees with the physician on about ${ok}. The other ${deferred} go to a specialist.`
        : `Without deferral, the system handles all 100 visits in Cohort ${state.c} and agrees with the physician's top choice on about ${ok}.`;
    };
    ops.innerHTML = OPS.map(o => `<button type="button" data-op="${o.id}" aria-pressed="false"><span>${o.label}</span><span class="p"></span><span class="c"></span></button>`).join('');
    $$('button', ops).forEach(b => b.addEventListener('click', () => { state.op = b.dataset.op; draw(); }));
    $$('[data-dcohort]').forEach(b => b.addEventListener('click', () => {
      $$('[data-dcohort]').forEach(x => x.setAttribute('aria-pressed', x === b));
      state.c = b.dataset.dcohort; draw();
    }));
    draw();
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

  /* ---------- theme toggle ---------- */
  const tt = $('#theme-toggle');
  if (tt) tt.addEventListener('click', () => {
    const root = document.documentElement;
    const cur = root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('manana-theme', next); } catch (e) {}
  });
})();
