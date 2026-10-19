'use strict';

(function (root) {
  const E = root.MLBBEngine;
  const pageCache = new Map();
  const LANE_CODES = { roam: 'Roam', exp: 'EXP', jungle: 'Jungle', mid: 'Mid', gold: 'Gold' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function slugify(name) {
    return String(name || '').toLowerCase().replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function frNum(n, digits) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function pct(n, d) { return n == null || isNaN(n) ? '—' : frNum(n, d == null ? 1 : d) + '%'; }

  function imgTag(src, cls, alt) {
    if (!src) return '';
    return '<img class="' + cls + '" src="' + esc(src) + '" alt="' + esc(alt || '') + '" loading="lazy" onerror="this.remove()">';
  }

  async function get(url, asJson) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status + ' sur ' + url);
    return asJson ? res.json() : res.text();
  }

  async function loadCore() {
    const results = await Promise.all([
      get('/api/heroes', false),
      get('/api/items', false),
      get('/api/stats', true).catch(function () { return null; })
    ]);
    const heroes = E.parseHeroes(results[0]);
    const items = E.parseItems(results[1]);
    const itemsByName = new Map();
    items.forEach(function (it) { itemsByName.set(it.name.toLowerCase(), it); });
    const stats = results[2];
    const statBySlug = new Map();
    if (stats && stats.heroes) stats.heroes.forEach(function (h) { statBySlug.set(h.slug, h); });
    heroes.forEach(function (h, slug) {
      const s = statBySlug.get(slug);
      if (s) {
        if (s.winRate != null) h.winRate = s.winRate;
        if (s.tier) h.tier = s.tier;
        if (s.pickRate != null) h.pickRate = s.pickRate;
        if (s.banRate != null) h.banRate = s.banRate;
      }
    });
    return { heroes: heroes, items: items, itemsByName: itemsByName, stats: stats, statBySlug: statBySlug };
  }

  function resolveSlug(heroes, value) {
    const v = (value || '').trim().toLowerCase();
    if (!v) return null;
    if (heroes.has(v)) return v;
    let found = null;
    heroes.forEach(function (h, slug) {
      if (!found && h.name.toLowerCase() === v) found = slug;
    });
    if (found) return found;
    if (/^[a-z0-9-]+$/.test(v)) return v;
    return null;
  }

  function fallbackMeta(slug) {
    return { slug: slug, name: slug, roles: [], tier: '?', winRate: null, url: 'https://mlbbhub.com/heroes/' + slug };
  }

  function heroMeta(heroes, slug) {
    return heroes.get(slug) || fallbackMeta(slug);
  }

  function parseLanes(page) {
    const out = [];
    const push = function (v) { v = String(v || '').trim(); if (v && out.indexOf(v) === -1) out.push(v); };
    ((page && page.snapshot && page.snapshot.Lane) || '').split(',').forEach(push);
    (page && page.builds ? page.builds : []).forEach(function (b) { push(b.lane); });
    return out;
  }

  async function loadHeroPage(slug) {
    if (pageCache.has(slug)) return pageCache.get(slug);
    let data = null;
    try {
      data = await Promise.race([
        get('/api/hero/' + slug, true),
        new Promise(function (resolve) { setTimeout(function () { resolve(null); }, 10000); })
      ]);
    } catch (e) { data = null; }
    const md = data && data.md ? data.md : '';
    const page = E.parseHeroPage(md);
    const rec = {
      ok: !!md,
      portrait: (data && data.portrait) || null,
      role: (page.snapshot && page.snapshot.Role) || '',
      lanes: parseLanes(page),
      page: page
    };
    pageCache.set(slug, rec);
    return rec;
  }

  async function portrait(slug) {
    if (!slug) return null;
    return (await loadHeroPage(slug)).portrait;
  }

  function heroIcon(slug) {
    const rec = pageCache.get(slug);
    return rec ? rec.portrait : null;
  }

  function heroLanes(slug) {
    const rec = pageCache.get(slug);
    return rec ? rec.lanes : [];
  }

  function heroPageLoaded(slug) {
    const rec = pageCache.get(slug);
    return !!(rec && rec.ok);
  }

  function heroRole(slug) {
    const rec = pageCache.get(slug);
    return rec ? rec.role : '';
  }

  function laneCode(key) { return LANE_CODES[key] || null; }

  function canLane(lanes, key) {
    const code = laneCode(key);
    if (!code) return true;
    return (lanes || []).some(function (l) { return l.toLowerCase() === code.toLowerCase(); });
  }

  function tierBadge(tier) {
    const t = tier || '?';
    return '<span class="tier tier-' + esc(t) + '">' + esc(t) + '</span>';
  }

  function rolesLabel(meta) {
    return (meta.roles && meta.roles.length) ? meta.roles.join(' / ') : 'Rôle inconnu';
  }

  function openBuild(heroSlug, enemyNames) {
    try {
      localStorage.setItem('draftmlbb', JSON.stringify({
        my: heroSlug,
        enemies: (enemyNames || []).slice(0, 5),
        variant: 0
      }));
    } catch (e) {}
    window.location.href = '/';
  }

  function populateDatalist(heroes, el, roleSet) {
    const list = [];
    heroes.forEach(function (h) {
      if (roleSet && !(h.roles || []).some(function (r) { return roleSet.indexOf(r) !== -1; })) return;
      list.push(h);
    });
    list.sort(function (a, b) { return a.name.localeCompare(b.name); });
    el.innerHTML = list.map(function (h) {
      return '<option value="' + esc(h.name) + '">' + esc((h.roles || []).join('/')) + ' · tier ' + esc(h.tier) + ' · ' + pct(h.winRate) + '</option>';
    }).join('');
  }

  root.MLBBCommon = {
    E: E,
    esc: esc,
    slugify: slugify,
    frNum: frNum,
    pct: pct,
    imgTag: imgTag,
    get: get,
    loadCore: loadCore,
    resolveSlug: resolveSlug,
    heroMeta: heroMeta,
    fallbackMeta: fallbackMeta,
    portrait: portrait,
    heroIcon: heroIcon,
    loadHeroPage: loadHeroPage,
    heroLanes: heroLanes,
    heroPageLoaded: heroPageLoaded,
    heroRole: heroRole,
    laneCode: laneCode,
    canLane: canLane,
    tierBadge: tierBadge,
    rolesLabel: rolesLabel,
    openBuild: openBuild,
    populateDatalist: populateDatalist,
    LANE_LABELS: {
      roam: 'Roamer / Tank',
      exp: 'Exp (voie solo)',
      jungle: 'Jungler',
      mid: 'Mid',
      gold: 'Gold / Marksman'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
