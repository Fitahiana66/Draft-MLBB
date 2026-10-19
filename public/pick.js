'use strict';

(function () {
  const C = window.MLBBCommon;
  const E = C.E;
  const $ = function (s) { return document.querySelector(s); };
  const $all = function (s) { return Array.from(document.querySelectorAll(s)); };

  const state = { core: null, matchCache: new Map(), busy: false };
  const ROLE_LABELS = { flex: 'Tous rôles', roam: 'Roamer / Tank', exp: 'Exp', jungle: 'Jungler', mid: 'Mid', gold: 'Gold / Marksman' };
  const ROLE_FALLBACK = {
    roam: ['Tank', 'Support'],
    exp: ['Fighter', 'Tank'],
    jungle: ['Assassin', 'Fighter'],
    mid: ['Mage', 'Assassin', 'Support'],
    gold: ['Marksman']
  };

  function passesRole(c, roleKey) {
    const lanes = C.heroLanes(c.slug);
    if (lanes && lanes.length) return C.canLane(lanes, roleKey);
    const set = ROLE_FALLBACK[roleKey];
    return !set || (c.meta.roles || []).some(function (r) { return set.indexOf(r) !== -1; });
  }

  function setStatus(msg, kind) {
    const el = $('#status');
    if (!msg) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    el.textContent = msg;
    el.className = 'status' + (kind ? ' ' + kind : '');
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

  function counterChips(c) {
    const good = (c.counters || []).slice().sort(function (a, b) { return b.edge - a.edge; });
    return good.map(function (x) {
      return '<span class="pick-chip pos">vs ' + C.esc(x.enemy.name) + ' <b>+' + C.frNum(x.edge, 1) + '</b></span>';
    }).join('') + (c.loses || []).slice(0, 3).map(function (x) {
      return '<span class="pick-chip neg">vs ' + C.esc(x.enemy.name) + ' <b>' + C.frNum(x.edge, 1) + '</b></span>';
    }).join('');
  }

  function laneText(slug) {
    const lanes = C.heroLanes(slug);
    if (lanes && lanes.length) return lanes.join(' · ');
    return C.heroRole(slug) || '';
  }

  function whyText(c, enemyCount) {
    const good = (c.counters || []).slice().sort(function (a, b) { return b.edge - a.edge; });
    const bits = [];
    if (good.length) {
      bits.push('Contre ' + good.length + '/' + enemyCount + ' : ' + good.slice(0, 3).map(function (x) {
        return x.enemy.name + ' +' + C.frNum(x.edge, 1);
      }).join(', '));
    } else {
      bits.push('Aucun contre direct identifié');
    }
    if (c.directAvg != null) bits.push('avantage moyen ' + (c.directAvg >= 0 ? '+' : '−') + C.frNum(Math.abs(c.directAvg), 1) + ' pts');
    return bits.join(' · ') + '.';
  }

  function card(c, rank, enemySlugs) {
    const meta = c.meta;
    const icon = C.heroIcon(c.slug);
    const topCls = rank <= 3 ? ' is-top' : '';
    const avatar = icon
      ? C.imgTag(icon, 'pick-avatar', meta.name)
      : '<span class="pick-avatar pick-avatar-fb">' + C.esc((meta.name || '?').charAt(0)) + '</span>';
    const lane = laneText(c.slug);
    return '<div class="pick-card rank-' + rank + topCls + '">' +
      '<div class="pick-rank">' + rank + '</div>' +
      avatar +
      '<div class="pick-main">' +
      '<div class="pick-head-row">' +
      '<div class="pick-id">' +
      '<span class="pick-name">' + C.esc(meta.name) + '</span>' +
      C.tierBadge(meta.tier) +
      (lane ? '<span class="pick-lane">' + C.esc(lane) + '</span>' : '') +
      '</div>' +
      '<span class="pick-score">score ' + C.frNum(c.total, 0) + '</span>' +
      '</div>' +
      '<div class="pick-sub">' + C.esc(C.rolesLabel(meta)) + ' · WR ' + C.pct(meta.winRate) + '</div>' +
      '<div class="pick-why">' + C.esc(whyText(c, enemySlugs.length)) + '</div>' +
      '<div class="pick-chips">' + counterChips(c) + '</div>' +
      '</div>' +
      '<button class="ghost small pick-build" data-build="' + C.esc(c.slug) + '">Build →</button>' +
      '</div>';
  }

  function render(cands, roleKey, enemySlugs, enemyNames, opts) {
    opts = opts || {};
    const top = cands.slice(0, 5);
    if (!top.length) {
      $('#results').innerHTML = '<section class="panel"><div class="empty">Aucun contre trouvé pour ces adversaires' +
        (roleKey && roleKey !== 'flex' ? ' en ' + C.esc(ROLE_LABELS[roleKey] || roleKey) : '') +
        '. Vérifie l\'orthographe des noms adverses, ou essaie le rôle « Tous rôles ».</div></section>';
      return;
    }
    const head = roleKey && roleKey !== 'flex'
      ? 'Ton meilleur choix en <b>' + C.esc(ROLE_LABELS[roleKey] || roleKey) + '</b> contre ' + C.esc(enemyNames.join(', '))
      : 'Meilleurs contres (tous rôles) contre ' + C.esc(enemyNames.join(', '));
    const note = opts.roleFallback
      ? '<div class="empty" style="margin-bottom:10px">Aucun contre dédié en <b>' + C.esc(ROLE_LABELS[roleKey] || roleKey) +
        '</b> identifié pour ces adversaires — voici les meilleurs contres, tous rôles confondus.</div>'
      : '';
    $('#results').innerHTML = '<section class="panel">' +
      '<div class="pick-head">' + head + '</div>' +
      note +
      '<div class="pick-list">' + top.map(function (c, i) { return card(c, i + 1, enemySlugs); }).join('') + '</div>' +
      '<div class="pick-foot muted">Les héros sont filtrés sur les voies qu\'ils jouent réellement (données MLBBHub). Le second passage (avantage vérifié dans les deux sens) peut retarder l\'affichage au premier lancement.</div>' +
      '</section>';
    $all('#results [data-build]').forEach(function (btn) {
      btn.addEventListener('click', function () { C.openBuild(btn.dataset.build, enemyNames); });
    });
  }

  async function find() {
    if (state.busy || !state.core) return;
    const enemies = collect('.pick-enemy');
    if (!enemies.length) { setStatus('Renseigne au moins un héros adverse.', 'warn'); return; }
    const mine = collect('.pick-mine');
    const roleKey = $('#myRole').value || 'flex';
    const exclude = enemies.concat(mine);

    state.busy = true;
    $('#btnFind').disabled = true;
    try {
      setStatus('Analyse des faiblesses adverses…', 'info');
      await Promise.all(enemies.map(function (s) { return loadMatchups(s); }));
      const mk = function (s) { return { slug: s, meta: C.heroMeta(state.core.heroes, s), matchups: state.matchCache.get(s) }; };
      const enemyEntries = enemies.map(mk);

      let cands = E.suggestCounters({
        enemies: enemyEntries,
        heroes: state.core.heroes,
        roleKey: null,
        exclude: exclude,
        limit: 5
      });

      let valid = cands;
      let roleFallback = false;
      if (roleKey && roleKey !== 'flex') {
        valid = [];
        const need = 8;
        for (let i = 0; i < cands.length && valid.length < need; i += 6) {
          const batch = cands.slice(i, i + 6);
          await Promise.all(batch.map(function (c) { return C.loadHeroPage(c.slug); }));
          batch.forEach(function (c) { if (passesRole(c, roleKey)) valid.push(c); });
          setStatus('Filtre de rôle (' + (ROLE_LABELS[roleKey] || roleKey) + ') — ' + valid.length + ' héros valides…', 'info');
        }
        if (!valid.length) { valid = cands; roleFallback = true; }
      }

      if (!valid.length) {
        const eNames = enemies.map(function (s) { return C.heroMeta(state.core.heroes, s).name; });
        render([], roleKey, enemies, eNames, {});
        setStatus('');
        return;
      }

      const shortlist = valid.slice(0, 12);
      setStatus('Vérification croisée des contres…', 'info');
      await Promise.all(shortlist.map(function (c) { return loadMatchups(c.slug); }));
      shortlist.forEach(function (c) {
        const mu = state.matchCache.get(c.slug);
        let sum = 0, cnt = 0;
        enemyEntries.forEach(function (e) {
          const pe = E.pairEdge(c.slug, mu, e.slug, e.matchups);
          if (pe.edge != null) { sum += pe.edge; cnt++; }
        });
        c.directAvg = cnt ? sum / cnt : null;
        if (c.directAvg != null) c.total += c.directAvg * 0.6;
      });
      valid.sort(function (a, b) { return b.total - a.total; });
      let results = valid.filter(function (c) { return c.total > 0; });
      if (!results.length) results = valid.slice(0, 5);

      await Promise.all(results.slice(0, 5).map(function (c) { return C.loadHeroPage(c.slug); }));
      const enemyNames = enemies.map(function (s) { return C.heroMeta(state.core.heroes, s).name; });
      render(results, roleKey, enemies, enemyNames, { roleFallback: roleFallback });
      setStatus('');
      saveLocal();
    } catch (err) {
      setStatus('Erreur : ' + err.message, 'error');
    } finally {
      state.busy = false;
      $('#btnFind').disabled = false;
    }
  }

  function saveLocal() {
    try {
      localStorage.setItem('draftmlbb-pick', JSON.stringify({
        role: $('#myRole').value,
        enemies: $all('.pick-enemy').map(function (i) { return i.value; }),
        mine: $all('.pick-mine').map(function (i) { return i.value; })
      }));
    } catch (e) {}
  }

  function restoreLocal() {
    try {
      const raw = localStorage.getItem('draftmlbb-pick');
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.role) $('#myRole').value = d.role;
      if (Array.isArray(d.enemies)) $all('.pick-enemy').forEach(function (inp, i) { if (d.enemies[i]) inp.value = d.enemies[i]; });
      if (Array.isArray(d.mine)) $all('.pick-mine').forEach(function (inp, i) { if (d.mine[i]) inp.value = d.mine[i]; });
    } catch (e) {}
  }

  function clearAll() {
    $all('.pick-enemy, .pick-mine').forEach(function (inp) { inp.value = ''; });
    $('#results').innerHTML = '';
    setStatus('');
    try { localStorage.removeItem('draftmlbb-pick'); } catch (e) {}
  }

  async function init() {
    setStatus('Chargement des données MLBBHub…', 'info');
    try {
      state.core = await C.loadCore();
      C.populateDatalist(state.core.heroes, $('#heroList'));
      restoreLocal();
      const d = state.core.stats && state.core.stats.lastUpdated ? new Date(state.core.stats.lastUpdated) : null;
      $('#topMeta').textContent = state.core.heroes.size + ' héros · ' + state.core.items.size +
        ' items · stats du ' + (d ? d.toLocaleDateString('fr-FR') : 'jour courant');
      setStatus('');
    } catch (err) {
      setStatus('Impossible de charger les données : ' + err.message, 'error');
    }
  }

  $('#btnFind').addEventListener('click', find);
  $('#btnClear').addEventListener('click', clearAll);
  $all('.pick-enemy, .pick-mine').forEach(function (inp) {
    inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') find(); });
  });

  init();

  window.__pickPage = { find: find, render: render, state: state };
})();
