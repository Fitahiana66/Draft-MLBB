'use strict';

(function () {
  const C = window.MLBBCommon;
  const E = C.E;
  const FR = window.MLBBFR;
  const $ = function (s) { return document.querySelector(s); };
  const $all = function (s) { return Array.from(document.querySelectorAll(s)); };

  const state = {
    core: null,
    matchCache: new Map(),
    busy: false
  };

  function setStatus(msg, kind) {
    const el = $('#status');
    if (!msg) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    el.textContent = msg;
    el.className = 'status' + (kind ? ' ' + kind : '');
  }

  function glosTable(rows) {
    return '<table class="gtable"><tbody>' + rows.map(function (r) {
      return '<tr><td><b>' + C.esc(r[0]) + '</b></td><td>' + C.esc(r[1]) + '</td></tr>';
    }).join('') + '</tbody></table>';
  }

  function renderGlossary() {
    const host = $('#glossary');
    if (!host || !FR) return;
    host.innerHTML =
      '<div class="glossary-col"><h3>Les voies (où l\'on joue)</h3>' + glosTable(FR.lanes) + '</div>' +
      '<div class="glossary-col"><h3>Lecture des cartes du résultat</h3>' + glosTable([
        ['Méta', 'Force brute des héros (taux de victoire ranked + palier S/A/B/C/D).'],
        ['Duels', 'Avantage de matchup moyen sur les 25 paires allié × adverse.'],
        ['Composition', 'Équilibre de l\'équipe : frontline, variété des dégâts, carries.'],
        ['Phases', 'Tendance early / mid / late à partir des taux de victoire par durée.']
      ]) + '</div>';
  }

  async function loadMatchups(slug) {
    if (state.matchCache.has(slug)) return state.matchCache.get(slug);
    let json = null;
    try { json = await C.get('/api/matchups/' + slug, true); } catch (e) { json = null; }
    state.matchCache.set(slug, json);
    return json;
  }

  function collect(sel) {
    const slugs = [];
    $all(sel).forEach(function (inp) {
      const s = C.resolveSlug(state.core.heroes, inp.value);
      if (s && slugs.indexOf(s) === -1) slugs.push(s);
    });
    return slugs;
  }

  function teamChips(slugs) {
    return slugs.map(function (s) {
      const meta = C.heroMeta(state.core.heroes, s);
      const icon = C.heroIcon(s);
      return '<span class="sim-chip">' + C.imgTag(icon, 'sim-avatar', meta.name) +
        '<span class="sim-chip-txt"><b>' + C.esc(meta.name) + '</b>' + C.tierBadge(meta.tier) +
        '<span class="sim-chip-sub">' + C.esc(C.rolesLabel(meta)) + ' · ' + C.pct(meta.winRate) + '</span></span></span>';
    }).join('');
  }

  function simBar(res, aNames, bNames) {
    const pa = Math.max(1, Math.round(res.pAlly * 1000) / 10);
    const pb = Math.max(1, Math.round(res.pEnemy * 1000) / 10);
    return '<div class="sim-bar">' +
      '<div class="sim-side sim-ally" style="width:' + pa + '%"><span class="sim-side-wr">' + C.frNum(res.pAlly * 100, 0) + '%</span><span class="sim-side-lbl">Ton équipe</span></div>' +
      '<div class="sim-side sim-enemy" style="width:' + pb + '%"><span class="sim-side-wr">' + C.frNum(res.pEnemy * 100, 0) + '%</span><span class="sim-side-lbl">Adverse</span></div>' +
      '</div>';
  }

  const VERDICT = {
    avantage: { cls: 'is-adv', label: 'Avantage pour ton équipe', txt: 'Le draft penche de ton côté : joue l\'initiative et force les objectifs avant le late.' },
    desavantage: { cls: 'is-dis', label: 'Ton équipe est désavantagée', txt: 'Le draft penche pour eux : sécurise tes items de survie, joue groupé et prends les combats favorables.' },
    equilibre: { cls: 'is-eq', label: 'Draft équilibré', txt: 'Matchs serrés : la différence se fera sur l\'exécution, pas sur la compo.' }
  };

  function duelRow(d) {
    const sign = d.edge > 0 ? 'pos' : 'neg';
    const txt = (d.edge > 0 ? '+' : '−') + C.frNum(Math.abs(d.edge), 1) + ' pts';
    return '<div class="duel-row">' +
      '<span class="duel-a">' + C.esc(d.ally.name) + '</span>' +
      '<span class="duel-mid">vs</span>' +
      '<span class="duel-b">' + C.esc(d.enemy.name) + '</span>' +
      '<span class="duel-edge ' + sign + '">' + txt + '</span></div>';
  }

  function dmgBar(label, c, e, kind) {
    const max = Math.max(1, c + e);
    const cw = Math.round(c / max * 100);
    const ew = 100 - cw;
    if (c + e === 0) return '';
    return '<div class="dmg-line"><span class="dmg-lbl">' + label + '</span>' +
      '<span class="dmg-track"><span class="dmg-c" style="width:' + cw + '%">' + (c || '') + '</span>' +
      '<span class="dmg-e" style="width:' + ew + '%">' + (e || '') + '</span></span></div>';
  }

  function composeNotes(c) {
    const notes = [];
    if (c.frontline === 0) notes.push('Pas de ligne de front (tank/support) : fragile en combat d\'équipe.');
    else if (c.frontline >= 2) notes.push('Double frontline : solide pour engager et tenir les objectifs.');
    if (c.dmg.phys >= 4) notes.push('Dégâts presque uniquement physiques : suffira d\'armure en face.');
    if (c.dmg.magic >= 4) notes.push('Dégâts presque uniquement magiques : suffira de résistance magique en face.');
    if (c.mage && c.marksman) notes.push('Menace mixte (magie + distance) : difficile à contrer d\'un seul type de défense.');
    if ((c.mage || 0) + (c.marksman || 0) + (c.assassin || 0) >= 3) notes.push('Beaucoup de carries : riche en dégâts, mais fragile si mal protégé.');
    return notes;
  }

  function render(res, aSlugs, bSlugs, aNames, bNames) {
    if (!res.allyCount || !res.enemyCount) {
      $('#results').innerHTML = '<section class="panel"><div class="empty">Renseigne au moins un héros dans chaque équipe.</div></section>';
      return;
    }
    const v = VERDICT[res.verdict] || VERDICT.equilibre;
    const phases = res.phases;
    const phaseBar = function (k, label) {
      const val = phases[k];
      if (val == null) return '<div class="phase-row"><span class="phase-lbl">' + label + '</span><span class="muted">données insuffisantes</span></div>';
      const p = Math.round(val * 100);
      return '<div class="phase-row"><span class="phase-lbl">' + label + '</span>' +
        '<span class="phase-track"><span class="phase-fill" style="width:' + p + '%"></span></span>' +
        '<span class="phase-val">' + p + '%</span></div>';
    };

    const metaDelta = res.meta.diff == null ? '—' : (res.meta.diff >= 0 ? '+' : '−') + C.frNum(Math.abs(res.meta.logit), 2) + ' (cote)';
    const duelAvgTxt = res.duel.avg == null ? 'non disponible' : (res.duel.avg >= 0 ? '+' : '−') + C.frNum(Math.abs(res.duel.avg), 1) + ' pts sur ' + res.duel.count + ' duels';

    const aNotes = composeNotes(res.comp.ally);
    const eNotes = composeNotes(res.comp.enemy);

    const html =
      '<section class="panel sim-result">' +
      '<div class="sim-head">' +
      '<div class="sim-team sim-team-a"><div class="sim-team-title">Ton équipe</div><div class="sim-chips">' + teamChips(aSlugs) + '</div></div>' +
      '<div class="sim-team sim-team-b"><div class="sim-team-title">Équipe adverse</div><div class="sim-chips">' + teamChips(bSlugs) + '</div></div>' +
      '</div>' +
      simBar(res, aNames, bNames) +
      '<div class="sim-verdict ' + v.cls + '"><b>' + v.label + '</b> — ' + v.txt + '</div>' +
      '<div class="sim-cards">' +
      '<div class="sim-card"><h4>① Méta</h4>' +
      '<p>WR moyen : <b>' + C.pct(res.meta.allyAvgWR) + '</b> (toi) vs <b>' + C.pct(res.meta.enemyAvgWR) + '</b> (eux)</p>' +
      '<p class="muted">Contribution à la cote : ' + metaDelta + '</p></div>' +

      '<div class="sim-card"><h4>② Duels 1v1</h4>' +
      '<p>Avantage moyen : <b>' + duelAvgTxt + '</b></p>' +
      '<div class="duels">' + (res.duels.length ? res.duels.slice(0, 8).map(duelRow).join('') : '<div class="muted">Aucun matchup connu entre ces héros.</div>') + '</div></div>' +

      '<div class="sim-card"><h4>③ Composition</h4>' +
      '<div class="comp-split"><span class="comp-tag">Frontline</span><span class="comp-c">' + res.comp.ally.frontline + '</span><span class="comp-vs">vs</span><span class="comp-e">' + res.comp.enemy.frontline + '</span></div>' +
      dmgBar('Physique', res.comp.ally.dmg.phys, res.comp.enemy.dmg.phys) +
      dmgBar('Magique', res.comp.ally.dmg.magic, res.comp.enemy.dmg.magic) +
      dmgBar('Mixte', res.comp.ally.dmg.mixte, res.comp.enemy.dmg.mixte) +
      (aNotes.length ? '<div class="comp-note comp-note-a">Ton équipe : ' + C.esc(aNotes.join(' ')) + '</div>' : '') +
      (eNotes.length ? '<div class="comp-note comp-note-b">Adverse : ' + C.esc(eNotes.join(' ')) + '</div>' : '') +
      '</div>' +

      '<div class="sim-card"><h4>④ Tendance par phase</h4>' +
      phaseBar('early', 'Early (0-6 min)') + phaseBar('mid', 'Mid (6-12 min)') + phaseBar('late', 'Late (12 min+)') +
      '<p class="muted">% = chance de gagner la phase. Côté « ton équipe ».</p></div>' +
      '</div>' +

      '<div class="sim-actions">' +
      aSlugs.map(function (s) {
        const meta = C.heroMeta(state.core.heroes, s);
        return '<button class="ghost small" data-build="' + C.esc(s) + '">Build ' + C.esc(meta.name) + ' face à eux →</button>';
      }).join('') +
      '</div>' +
      '</section>';

    $('#results').innerHTML = html;
    $all('#results [data-build]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const enemyNames = bSlugs.map(function (s) { return C.heroMeta(state.core.heroes, s).name; });
        C.openBuild(btn.dataset.build, enemyNames);
      });
    });
  }

  async function simulate() {
    if (state.busy || !state.core) return;
    const aSlugs = collect('.team-a');
    const bSlugs = collect('.team-b');
    if (!aSlugs.length || !bSlugs.length) { setStatus('Renseigne au moins un héros dans chaque équipe.', 'warn'); return; }
    state.busy = true;
    $('#btnSim').disabled = true;
    try {
      const uniq = aSlugs.concat(bSlugs).filter(function (s, i, arr) { return arr.indexOf(s) === i; });
      let done = 0;
      setStatus('Chargement des matchups… (0/' + uniq.length + ')', 'info');
      await Promise.all(uniq.map(function (s) {
        return Promise.all([loadMatchups(s), C.portrait(s)]).then(function () {
          done++;
          setStatus('Chargement des matchups… (' + done + '/' + uniq.length + ')', 'info');
        });
      }));
      const mk = function (s) { return { slug: s, meta: C.heroMeta(state.core.heroes, s), matchups: state.matchCache.get(s) }; };
      const res = E.simulateTeam({ allies: aSlugs.map(mk), enemies: bSlugs.map(mk) });
      const aNames = aSlugs.map(function (s) { return C.heroMeta(state.core.heroes, s).name; });
      const bNames = bSlugs.map(function (s) { return C.heroMeta(state.core.heroes, s).name; });
      render(res, aSlugs, bSlugs, aNames, bNames);
      setStatus('');
      saveLocal();
    } catch (err) {
      setStatus('Erreur : ' + err.message, 'error');
    } finally {
      state.busy = false;
      $('#btnSim').disabled = false;
    }
  }

  function saveLocal() {
    try {
      localStorage.setItem('draftmlbb-sim', JSON.stringify({
        a: $all('.team-a').map(function (i) { return i.value; }),
        b: $all('.team-b').map(function (i) { return i.value; })
      }));
    } catch (e) {}
  }

  function restoreLocal() {
    try {
      const raw = localStorage.getItem('draftmlbb-sim');
      if (!raw) return;
      const d = JSON.parse(raw);
      if (Array.isArray(d.a)) $all('.team-a').forEach(function (inp, i) { if (d.a[i]) inp.value = d.a[i]; });
      if (Array.isArray(d.b)) $all('.team-b').forEach(function (inp, i) { if (d.b[i]) inp.value = d.b[i]; });
    } catch (e) {}
  }

  function swap() {
    const a = $all('.team-a').map(function (i) { return i.value; });
    const b = $all('.team-b').map(function (i) { return i.value; });
    $all('.team-a').forEach(function (inp, i) { inp.value = b[i] || ''; });
    $all('.team-b').forEach(function (inp, i) { inp.value = a[i] || ''; });
    if (!$('#results').innerHTML.trim()) return;
    simulate();
  }

  function clearAll() {
    $all('.team-a, .team-b').forEach(function (inp) { inp.value = ''; });
    $('#results').innerHTML = '';
    setStatus('');
    try { localStorage.removeItem('draftmlbb-sim'); } catch (e) {}
  }

  async function init() {
    setStatus('Chargement des données MLBBHub…', 'info');
    try {
      state.core = await C.loadCore();
      C.populateDatalist(state.core.heroes, $('#heroList'));
      renderGlossary();
      restoreLocal();
      const d = state.core.stats && state.core.stats.lastUpdated ? new Date(state.core.stats.lastUpdated) : null;
      $('#topMeta').textContent = state.core.heroes.size + ' héros · ' + state.core.items.size +
        ' items · stats du ' + (d ? d.toLocaleDateString('fr-FR') : 'jour courant');
      setStatus('');
    } catch (err) {
      setStatus('Impossible de charger les données : ' + err.message, 'error');
    }
  }

  $('#btnSim').addEventListener('click', simulate);
  $('#btnSwap').addEventListener('click', swap);
  $('#btnClear').addEventListener('click', clearAll);
  $all('.team-a, .team-b').forEach(function (inp) {
    inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') simulate(); });
  });

  init();

  window.__simPage = { simulate: simulate, render: render, state: state };
})();
