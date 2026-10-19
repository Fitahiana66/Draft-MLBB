'use strict';

const E = window.MLBBEngine;
const FR = window.MLBBFR;

const state = {
  heroes: null,
  items: null,
  itemsByName: null,
  stats: null,
  myMeta: null,
  myPage: null,
  buildIndex: 0,
  pageCache: new Map(),
  matchCache: new Map(),
  busy: false,
  result: null,
  coreTalent: null
};

function $(sel) { return document.querySelector(sel); }
function $all(sel) { return Array.from(document.querySelectorAll(sel)); }

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function frNum(n, digits) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function gold(n) { return frNum(n, 0) + ' or'; }
function pct(n) { return frNum(n, 1) + '%'; }

function slugify(name) {
  return String(name || '').toLowerCase().replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function itemIcon(name) {
  if (!state.itemsByName) return null;
  const it = state.itemsByName.get(String(name || '').trim().toLowerCase());
  return it && it.slug ? '/img/items/' + it.slug + '.png' : null;
}

function imgTag(src, cls, alt) {
  if (!src) return '';
  return '<img class="' + cls + '" src="' + esc(src) + '" alt="' + esc(alt || '') + '" loading="lazy" onerror="this.remove()">';
}

function frItem(n) { return FR ? FR.item(n) : n; }
function frTalent(n) { return FR ? FR.talent(n) : n; }
function frEmblem(n) { return FR ? FR.emblem(n) : n; }
function frText(t) { return FR ? FR.text(t) : t; }
function frReason(t) { return FR ? frText(FR.reason(t)) : t; }
function frTalentEffect(n) { return FR && FR.talentEffect ? FR.talentEffect(n) : ''; }
function talentTierLabel(n) { const t = FR && FR.talentTier ? FR.talentTier[n] : null; return t === 1 ? 'Slot 1' : (t === 2 ? 'Slot 2' : 'Core'); }
function talentIcon(n) { return '/img/talents/' + slugify(n) + '.png'; }
function emblemIcon(n) {
  const first = String(n || '').split(/\s+/)[0] || '';
  const s = slugify(first);
  if (!s) return null;
  return '/img/emblems/' + (s === 'basic' ? 'common' : s) + '.png';
}
function spellIcon(n) { return '/img/spells/' + slugify(n) + '.png'; }

async function get(url, asJson) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status + ' sur ' + url);
  return asJson ? res.json() : res.text();
}

function resolveSlug(value) {
  const v = (value || '').trim().toLowerCase();
  if (!v) return null;
  if (state.heroes.has(v)) return v;
  let found = null;
  state.heroes.forEach(function (h, slug) {
    if (!found && h.name.toLowerCase() === v) found = slug;
  });
  if (found) return found;
  if (/^[a-z0-9-]+$/.test(v)) return v;
  return null;
}

function resolveMeta(slug) {
  return state.heroes.get(slug) || { slug: slug, name: slug, roles: [], tier: '?', winRate: null, url: 'https://mlbbhub.com/heroes/' + slug };
}

function setStatus(msg, kind) {
  const el = $('#status');
  if (!msg) { el.hidden = true; el.textContent = ''; return; }
  el.hidden = false;
  el.textContent = msg;
  el.className = 'status' + (kind ? ' ' + kind : '');
}

function saveLocal() {
  try {
    localStorage.setItem('draftmlbb', JSON.stringify({
      my: $('#myHero').value,
      enemies: $all('.enemy').map(function (i) { return i.value; }),
      variant: state.buildIndex
    }));
  } catch (e) {}
}

function restoreLocal() {
  try {
    const raw = localStorage.getItem('draftmlbb');
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.my) $('#myHero').value = d.my;
    if (Array.isArray(d.enemies)) {
      $all('.enemy').forEach(function (inp, i) { if (d.enemies[i]) inp.value = d.enemies[i]; });
    }
    if (typeof d.variant === 'number') state.buildIndex = d.variant;
  } catch (e) {}
}

function populateDatalist() {
  const dl = $('#heroList');
  const list = [];
  state.heroes.forEach(function (h) { list.push(h); });
  list.sort(function (a, b) { return a.name.localeCompare(b.name); });
  dl.innerHTML = list.map(function (h) {
    return '<option value="' + esc(h.name) + '">' + esc(h.roles.join('/')) + ' · tier ' + esc(h.tier) + ' · ' + pct(h.winRate) + '</option>';
  }).join('');
}

async function loadMyHero() {
  const slug = resolveSlug($('#myHero').value);
  const info = $('#myHeroInfo');
  const variantSel = $('#buildVariant');
  if (slug && slug !== (state.myMeta && state.myMeta.slug)) state.coreTalent = null;
  if (!slug) {
    state.myMeta = null;
    state.myPage = null;
    info.textContent = '';
    variantSel.hidden = true;
    return;
  }
  const meta = resolveMeta(slug);
  info.textContent = 'Chargement du build de ' + meta.name + '…';
  try {
    const page = await loadPage(slug);
    state.myMeta = meta;
    state.myPage = page;
    info.textContent = meta.name + ' — ' + (page.snapshot.Role || meta.roles.join('/')) + ' · tier ' + meta.tier + ' · WR ' + pct(meta.winRate);
    if (!page.builds.length) {
      variantSel.hidden = true;
      info.textContent += ' · aucun build curaté trouvé';
      return;
    }
    variantSel.hidden = false;
    variantSel.innerHTML = page.builds.map(function (b, i) {
      return '<option value="' + i + '">' + esc(b.title) + (b.lane ? ' (' + esc(b.lane) + ')' : '') + '</option>';
    }).join('');
    if (state.buildIndex >= page.builds.length) state.buildIndex = 0;
    variantSel.value = String(state.buildIndex);
  } catch (err) {
    state.myMeta = null;
    state.myPage = null;
    info.textContent = 'Impossible de charger ce héros (' + err.message + ')';
  }
}

async function loadPage(slug) {
  if (state.pageCache.has(slug)) return state.pageCache.get(slug);
  const data = await get('/api/hero/' + slug, true);
  const page = E.parseHeroPage(data.md || '');
  page.portrait = data.portrait || null;
  state.pageCache.set(slug, page);
  return page;
}

async function loadMatchups(slug) {
  if (state.matchCache.has(slug)) return state.matchCache.get(slug);
  try {
    const json = await get('/api/matchups/' + slug, true);
    state.matchCache.set(slug, json);
    return json;
  } catch (e) {
    state.matchCache.set(slug, null);
    return null;
  }
}

function buildThreatHTML(t, mu) {
  const badges = [];
  const dmgClass = t.damageType === 'physique' ? 'dmg-phys' : (t.damageType === 'magique' ? 'dmg-magic' : 'dmg-support');
  const dmgLabel = { physique: '⚔ Physique', magique: '✦ Magique', mixte: '⚔✦ Mixte', support: 'Peu de dégâts directs' }[t.damageType];
  badges.push('<span class="badge ' + dmgClass + '">' + esc(dmgLabel) + '</span>');
  if (t.healer) badges.push('<span class="badge threat-red">♥ Soigneur</span>');
  if (t.crit) badges.push('<span class="badge threat-red">★ Critique</span>');
  if (t.tank) badges.push('<span class="badge threat-gold">⛨ Armuré</span>');
  if (t.magicBurst) badges.push('<span class="badge threat-red">Rafale magique</span>');
  if (t.magicSustained) badges.push('<span class="badge threat-gold">Magie soutenue</span>');
  if (t.trueDamage) badges.push('<span class="badge threat-gold">Dégâts vrais</span>');
  if (t.control) badges.push('<span class="badge threat-gold">Contrôle (CC)</span>');
  if (t.highHp) badges.push('<span class="badge threat-gold">PV élevés</span>');

  let muHTML = '';
  if (mu && mu.edge != null) {
    const cls = mu.edge > 0.05 ? 'edge-pos' : (mu.edge < -0.05 ? 'edge-neg' : 'edge-unknown');
    const txt = mu.edge > 0
      ? 'Ton avantage : +' + frNum(mu.edge, 1) + ' pp'
      : (mu.edge < 0 ? 'Il te counter : ' + frNum(mu.edge, 1) + ' pp' : 'Matchup équilibré (0 pp)');
    muHTML += '<div class="matchup"><span class="' + cls + '">' + esc(txt) + '</span></div>';
    if (mu.phase) {
      muHTML += '<div class="mu-phase-label">Ta WR dans ce duel selon la durée de la partie :</div>';
      const ph = [['Early', mu.phase.early], ['Mid', mu.phase.mid], ['Late', mu.phase.late]];
      muHTML += '<div class="phases">' + ph.map(function (p) {
        const v = p[1] == null ? null : p[1] * 100;
        const cls2 = v == null ? '' : (v >= 52 ? 'phase-good' : (v <= 48 ? 'phase-bad' : ''));
        return '<div class="phase ' + cls2 + '">' + p[0] + '<b>' + (v == null ? '—' : pct(v)) + '</b></div>';
      }).join('') + '</div>';
    }
  } else {
    muHTML += '<div class="matchup"><span class="edge-unknown">Pas de données head-to-head directes pour ce duo — joue sur les règles d\'équipement ci-dessous.</span></div>';
    const myW = state.myMeta ? state.myMeta.winRate : null;
    if (t.winRate != null && myW != null) {
      const d = t.winRate - myW;
      const cls2 = d > 2 ? 'edge-neg' : (d < -2 ? 'edge-pos' : 'edge-unknown');
      const txt = d > 2
        ? esc(t.name) + ' est mieux placé dans le meta actuel (' + pct(t.winRate) + ' vs tes ' + pct(myW) + ')'
        : (d < -2 ? 'Tu es mieux placé dans le meta (' + pct(myW) + ' vs ' + esc(t.name) + ' ' + pct(t.winRate) + ')' : 'Meta équilibré (' + pct(t.winRate) + ' vs ' + pct(myW) + ')');
      muHTML += '<div class="matchup"><span class="' + cls2 + '">' + txt + '</span></div>';
    }
  }
  if (mu && mu.reason) muHTML += '<div class="mu-reason">« ' + esc(frReason(mu.reason)) + ' »</div>';

  const trig = (state.resultPriorities || []).filter(function (p) { return (p.triggers || []).indexOf(t.name) !== -1; });
  let trigHTML = '';
  if (trig.length) {
    trigHTML = '<div class="triggers">→ Déclenche : ' + esc(Array.from(new Set(trig.map(function (p) { return frItem(p.item); }))).join(', ')) + '</div>';
  }

  return '<div class="threat">' +
    '<div class="threat-head">' + imgTag(t.portrait, 'threat-avatar', t.name) +
    '<span class="tname">' + esc(t.name) + '</span><span class="tier tier-' + esc(t.tier) + '">' + esc(t.tier) + '</span></div>' +
    '<div class="tmeta">' + esc(t.role || '?') + (t.lane ? ' · ' + esc(t.lane) : '') + (t.specialty ? ' · ' + esc(t.specialty) : '') +
    ' · WR ' + (t.winRate != null ? pct(t.winRate) : '—') + '</div>' +
    '<div class="badges">' + badges.join('') + '</div>' +
    muHTML + trigHTML +
    '<a class="src" href="' + esc(t.url) + '" target="_blank" rel="noopener">Fiche ' + esc(t.name) + ' sur mlbbhub ↗</a>' +
    '</div>';
}

function buildSlotsHTML(r) {
  const rows = r.slots.map(function (s) {
    const sub = s.item ? esc(s.item.stats) : 'Item introuvable dans le catalogue';
    return '<div class="slot">' +
      '<div class="num">' + s.index + '</div>' +
      imgTag(itemIcon(s.name), 'item-icon', s.name) +
      '<div><div class="iname">' + esc(frItem(s.name)) + '</div><div class="isub">' + sub + '</div></div>' +
      '<div class="cost">' + gold(s.cost) + '<span class="run">cumulé ' + gold(s.running) + '</span></div>' +
      '</div>';
  }).join('');
  const b = r.build;
  const chips = [];
  if (b.emblem) {
    chips.push('<span class="chip">' + imgTag(emblemIcon(b.emblem), 'chip-icon', b.emblem) + '<b>Emblème</b> ' + esc(frEmblem(b.emblem)) + '</span>');
  }
  if (b.spell) chips.push('<span class="chip">' + imgTag(spellIcon(b.spell), 'chip-icon', b.spell) + '<b>Spell</b> ' + esc(b.spell) + '</span>');
  if (b.blessing) chips.push('<span class="chip"><b>Blessing</b> ' + esc(b.blessing) + '</span>');
  if (b.lane) chips.push('<span class="chip"><b>Voie</b> ' + esc(b.lane) + '</span>');
  if (b.core.length) chips.push('<span class="chip"><b>Core (verrouillé)</b> ' + esc(b.core.map(frItem).join(' → ')) + '</span>');
  return '<div class="ref-note">Référence à suivre <b>poste 1 → 6</b> quand tu es à l\'aise (avantage). Les changements éventuels sont listés dans « Ajustements » juste en dessous.</div>' +
    '<div class="slots">' + rows + '</div>' +
    '<div class="build-meta">' + chips.join('') + '</div>' +
    '<div class="total-line">Coût total du build de référence : ' + gold(r.total) + '</div>' +
    buildEmblemTalentsHTML(r);
}

function buildEmblemTalentsHTML(r) {
  const b = r.build;
  const talents = (b && b.talents) || [];
  const currentCore = state.coreTalent || talents[2] || null;

  const slot = function (name, tag) {
    if (!name) return '';
    return '<span class="tal-chip"><span class="tal-tier">' + tag + '</span>' +
      imgTag(talentIcon(name), 'chip-icon', name) + esc(frTalent(name)) + '</span>';
  };

  let emblemHTML = '';
  if (b && b.emblem) {
    emblemHTML = '<div class="emblem-line">' +
      imgTag(emblemIcon(b.emblem), 'chip-icon', b.emblem) +
      '<b>Emblème ' + esc(frEmblem(b.emblem)) + '</b>' +
      '<span class="tal-list">' + slot(talents[0], 'Slot 1') + slot(talents[1], 'Slot 2') + slot(currentCore, 'Core') + '</span>' +
      '</div>';
  }

  const options = FR && FR.coreTalents ? FR.coreTalents.slice() : [];
  if (currentCore && options.indexOf(currentCore) === -1) options.unshift(currentCore);
  if (talents[2] && options.indexOf(talents[2]) === -1) options.unshift(talents[2]);
  const select = '<label class="core-pick"><span>Talent core (slot 3)</span>' +
    '<select class="core-select">' + options.map(function (n) {
      return '<option value="' + esc(n) + '"' + (n === currentCore ? ' selected' : '') + '>' + esc(frTalent(n)) + '</option>';
    }).join('') + '</select></label>';
  const effect = currentCore && frTalentEffect(currentCore)
    ? '<div class="core-effect"><b>' + esc(frTalent(currentCore)) + '</b> — ' + esc(frTalentEffect(currentCore)) + '</div>' : '';

  let variantsHTML = '';
  const builds = state.myPage && state.myPage.builds ? state.myPage.builds : [];
  if (builds.length > 1) {
    variantsHTML = '<div class="variants"><div class="variants-title">Emblème & talents par variante de build (source mlbbhub) — clique pour changer de variante</div>' +
      builds.map(function (bb, i) {
        const core = bb.talents && bb.talents[2] ? bb.talents[2] : null;
        return '<div class="variant' + (i === state.buildIndex ? ' active' : '') + '" data-build="' + i + '">' +
          '<div class="variant-head">' + esc(bb.title) + (bb.lane ? ' <span class="variant-lane">' + esc(bb.lane) + '</span>' : '') + '</div>' +
          '<div class="variant-tal">' +
          (bb.emblem ? '<span class="v-emb">' + imgTag(emblemIcon(bb.emblem), 'chip-icon', bb.emblem) + esc(frEmblem(bb.emblem)) + '</span>' : '') +
          (bb.talents || []).map(function (t) { return '<span class="v-tal">' + imgTag(talentIcon(t), 'chip-icon', t) + esc(frTalent(t)) + '</span>'; }).join('') +
          (core ? '' : '') +
          '</div></div>';
      }).join('') + '</div>';
  }

  const proNote = '<div class="pro-note">ℹ <b>Emblème & talents = source mlbbhub</b> pour ce héros/voie. En jeu, la « config des pro » peut différer (ex. Gusion : Rupture / Maître assassin / Rage impure ou Ignition létale). ' +
    'Depuis la refonte, les 26 talents sont un <b>vivier commun</b> : une fois débloqués, tu peux les équiper sur n\'importe quel emblème. C\'est le <b>slot 3 (core)</b> qui change vraiment la partie — compare les options ci-dessus.</div>';

  return '<div class="emblem-talents">' +
    '<div class="section-sub">Emblème & talents</div>' +
    emblemHTML + select + effect + variantsHTML + proNote +
    '</div>';
}

function buildChangesHTML(r) {
  const changes = r.changes || [];
  let html = '<div class="chg-intro">À appliquer <b>poste par poste</b> si tu es désavantagé ou face aux menaces listées. ' +
    'Les postes <b>non cités ne changent pas</b> : tu gardes l\'item du build de référence.</div>';
  if (!changes.length) {
    return html + '<div class="empty">Aucun remplacement nécessaire : garde le build de référence tel quel, poste 1 → 6.</div>';
  }
  html += '<div class="changes">' + changes.map(function (c) {
    const delta = c.delta > 0 ? '+' + gold(c.delta) : (c.delta < 0 ? '−' + gold(Math.abs(c.delta)) : 'même coût');
    const typeLabel = c.type === 'auto' ? 'Automatique' : 'Prioritaire';
    const trigs = (c.triggers || []).length ? '<div class="chg-trig">Déclenché par : ' + esc(c.triggers.join(', ')) + '</div>' : '';
    return '<div class="change">' +
      '<div class="chg-poste">Poste ' + c.poste + '</div>' +
      '<div class="chg-body">' +
      '<div class="chg-line">' +
      '<span class="chg-from">' + imgTag(itemIcon(c.from), 'item-icon-mini faded', c.from) + esc(frItem(c.from)) + '</span>' +
      '<span class="chg-arrow">→</span>' +
      '<span class="chg-to">' + imgTag(itemIcon(c.to), 'item-icon', c.to) + esc(frItem(c.to)) + '</span>' +
      '<span class="chg-delta">' + esc(delta) + '</span>' +
      '<span class="chg-type ' + (c.type === 'auto' ? 'is-auto' : 'is-prio') + '">' + typeLabel + '</span>' +
      '</div>' +
      '<div class="chg-title">' + esc(c.title) + '</div>' +
      '<div class="chg-why">' + esc(frText(c.reason)) + '</div>' +
      (c.effect ? '<div class="chg-effect">' + esc(c.effect) + '</div>' : '') +
      trigs +
      '</div></div>';
  }).join('') + '</div>';
  const extras = r.extra || [];
  if (extras.length) {
    html += '<div class="chg-extras"><div class="chg-extras-title">Autres items utiles (pas de poste flexible disponible — à retenir si tu libères un slot) :</div>' +
      extras.map(function (p) {
        return '<div class="chg-extra">' + imgTag(itemIcon(p.item), 'item-icon-mini', p.item) + '<b>' + esc(frItem(p.item)) + '</b> — ' + esc(p.title) + '</div>';
      }).join('') + '</div>';
  }
  return html;
}

function buildWatchHTML(r) {
  if (!r.watch || !r.watch.length) return '';
  return '<div class="watch-intro">Ces variantes ne sont pas activées pour cette composition. Garde-les en tête : si la situation ci-dessous se présente, tu remplaces l\'item indiqué.</div>' +
    '<div class="watch-list">' + r.watch.map(function (w) {
      const e = w.entry;
      if (e && e.with) {
        const cf = (E.frCondition ? E.frCondition(e.condition) : null) || 'situation spécifique à ce héros';
        return '<div class="watch-item">' +
          '<div class="wcond">Si <b>' + esc(cf) + '</b> : remplacer ' +
          imgTag(itemIcon(e.replace), 'item-icon-mini faded', e.replace) + '<span class="wfaded">' + esc(frItem(e.replace)) + '</span>' +
          ' par ' + imgTag(itemIcon(e.with), 'item-icon-mini', e.with) + '<b>' + esc(frItem(e.with)) + '</b></div>' +
          '<div class="wnote">' + esc(frText(w.note)) + '</div>' +
          '<details class="wsrc"><summary>détail d\'origine (EN)</summary>' + esc(e.condition) + '</details>' +
          '</div>';
      }
      const raw = (e && e.raw) || '';
      return '<div class="watch-item"><div class="wcond">Variante spécifique à ce héros — à appliquer si la situation décrite te parle :</div>' +
        '<div class="wnote">' + esc(frText(w.note)) + '</div>' +
        '<details class="wsrc"><summary>détail d\'origine (EN)</summary>' + esc(raw) + '</details></div>';
    }).join('') + '</div>';
}

function progChips(list, kind) {
  if (!list.length) return '<span class="prog-none">— aucun —</span>';
  return list.map(function (x) {
    const e = state.progByName && state.progByName[x.name];
    const portrait = e ? e.portrait : null;
    const sign = x.score > 0 ? '+' : '';
    return '<span class="prog-chip prog-' + kind + '">' + imgTag(portrait, 'prog-avatar', x.name) +
      '<span class="prog-cname">' + esc(x.name) + '</span><span class="prog-cscore">' + sign + x.score + '</span></span>';
  }).join('');
}

function buildProgressionHTML(r) {
  const p = r.progression;
  if (!p || !p.enemies.length) return '';
  state.progByName = {};
  p.enemies.forEach(function (e) { state.progByName[e.name] = e; });
  const phaseLabel = { early: 'Début', mid: 'Milieu', late: 'Fin' };
  const rows = p.rows.map(function (row) {
    return '<div class="prog-row">' +
      '<div class="prog-milestone">' +
      '<span class="prog-lvl">Après l\'item ' + row.poste + '</span>' +
      imgTag(itemIcon(row.item), 'item-icon-mini', row.item) +
      '<span class="prog-item">' + esc(frItem(row.item)) + '</span>' +
      '<span class="prog-phase">' + esc(phaseLabel[row.phase] || row.phase) + '</span>' +
      (row.changed ? '' : '<span class="prog-start">départ</span>') +
      '</div>' +
      '<div class="prog-lists">' +
      '<div class="prog-col prog-col-fear"><span class="prog-lbl">⚠ À craindre</span>' + progChips(row.fear, 'fear') + '</div>' +
      '<div class="prog-col prog-col-prey"><span class="prog-lbl">✓ Tu domines</span>' + progChips(row.prey, 'prey') + '</div>' +
      '</div></div>';
  }).join('');
  return '<div class="prog-intro">Ton avantage change au fil du build. Pour chaque palier (après l\'item N, jusqu\'à l\'item suivant) : ' +
    'à gauche les héros à <b>craindre</b>, à droite ceux que tu <b>domines</b>. Les listes sont mises à jour quand ton nouvel item contre leur profil ' +
    '(défense magique/physique, anti-soin, anti-crit, pénétration) ou selon ton taux de victoire par durée (mlbbhub).</div>' +
    '<div class="prog-rows">' + rows + '</div>' +
    '<div class="prog-legend">Légende : <span class="lg lg-prey">✓ domines</span> · <span class="lg lg-neutral">• neutre (masqué)</span> · ' +
    '<span class="lg lg-fear">⚠ à craindre</span> — le chiffre = ton avantage estimé en points de pourcentage (+ = favorable).</div>';
}

function buildPlanHTML(r) {
  const p = r.plan;
  if (!p) return '';
  const o = p.outlook || {};
  const oLabel = FR && FR.plan ? FR.plan.outlook[o.outlook] : o.outlook;
  const pLabel = FR && FR.plan ? FR.plan.posture[p.posture] : p.posture;
  let scoreTxt = '';
  if (o.score != null) {
    const s = (o.score > 0 ? '+' : '') + frNum(o.score, 1);
    scoreTxt = o.basis === 'meta' ? ('WR ' + s + ' pts vs ennemis') : ('edge moyen ' + s + ' pp');
  }
  const fragTxt = p.fragile && p.fragile.count
    ? (p.fragile.count + ' ennemi(s) fragile(s) : ' + p.fragile.names.join(', '))
    : 'aucun ennemi fragile détecté';
  const rush = p.rush || { items: [], cost: 0 };
  const rushHTML = rush.items.map(function (n, i) {
    return '<span class="rush-item"><span class="rush-rank">' + (i + 1) + '</span>' + imgTag(itemIcon(n), 'item-icon-mini', n) + esc(frItem(n)) + '</span>';
  }).join('');
  const orderHTML = (p.order || []).map(function (x) {
    return '<li class="' + (x.changed ? 'ord-changed' : '') + '"><span class="ord-poste">' + x.poste + '</span>' +
      imgTag(itemIcon(x.item), 'item-icon-mini', x.item) + '<span>' + esc(frItem(x.item)) + '</span>' +
      (x.changed ? '<span class="ord-tag ord-' + esc(x.type) + '">remplacé</span>' : '') + '</li>';
  }).join('');
  const cancelled = (p.cancelled || []).length ? esc(p.cancelled.map(frItem).join(', ')) : 'aucun';
  return '<div class="plan posture-' + esc(p.posture) + '">' +
    '<div class="plan-head">' +
    '<span class="plan-tag">Posture : <b>' + esc(pLabel) + '</b></span>' +
    '<span class="plan-outlook">Draft : <b>' + esc(oLabel) + '</b>' + (scoreTxt ? ' <span class="muted">(' + esc(scoreTxt) + ')</span>' : '') + '</span>' +
    '<span class="plan-fragile">' + esc(fragTxt) + '</span>' +
    '</div>' +
    '<p class="plan-advice">' + esc(p.postureAdvice) + '</p>' +
    '<div class="plan-cols">' +
    '<div class="plan-col"><div class="plan-sub">Ordre de craft ajusté (poste 1 → 6)</div><ol class="order-list">' + orderHTML + '</ol>' +
    '<div class="plan-cancel">Item(s) annulé(s) du build de référence : <b>' + cancelled + '</b></div></div>' +
    '<div class="plan-col">' +
    (rush.items.length ? '<div class="plan-rush"><div class="plan-sub">⚡ Partie courte (≈ 9-12 min) ou farm difficile — priorise :</div>' +
      '<div class="rush-items">' + rushHTML + '</div>' +
      '<div class="rush-cost">Total ≈ ' + gold(rush.cost) + '</div></div>' : '') +
    '</div></div>' +
    '<ul class="plan-notes">' + p.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>' +
    '</div>';
}

function renderGlossary() {
  const host = $('#glossary');
  if (!host || !FR) return;
  function table(rows) {
    return '<table class="gtable"><tbody>' + rows.map(function (r) {
      return '<tr><th>' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td></tr>';
    }).join('') + '</tbody></table>';
  }
  host.innerHTML =
    '<div class="glossary-col"><h3>Les voies (où l\'on joue)</h3>' + table(FR.lanes) + '</div>' +
    '<div class="glossary-col"><h3>Talents core (slot 3) — ce qui change vraiment la partie</h3>' + table((FR.coreTalents || []).map(function (n) { return [FR.talent(n), FR.talentEffect(n)]; })) + '</div>' +
    '<div class="glossary-col"><h3>Les archétypes de build (le sens des noms de build)</h3>' + table(FR.archetypes) + '</div>';
}

function render(r) {
  state.result = r;
  state.resultPriorities = r.priorities;
  const meta = r.myMeta;
  const snap = r.mySnap || {};
  let html = '';

  html += '<div class="summary">' +
    imgTag(r.myPortrait, 'hero-portrait', meta.name) +
    '<div class="summary-text"><div class="hero-name">' + esc(meta.name) + '</div>' +
    '<div class="hero-sub">' + esc(snap.Role || (meta.roles || []).join('/')) + (snap.Lane ? ' · ' + esc(snap.Lane) : '') +
    ' · tier ' + esc(meta.tier) + ' · WR ' + pct(meta.winRate) +
    ' · build « ' + esc(r.build ? r.build.title : '—') + ' »' +
    (r.plan ? ' · posture <b>' + esc(FR && FR.plan ? FR.plan.posture[r.plan.posture] : r.plan.posture) + '</b>' : '') +
    '</div></div>' +
    '<div class="hero-sub">Menaces analysées : <b>' + r.threats.length + '</b> · anti-soin : ' +
    (r.agg.healers.length ? '<b style="color:var(--red)">' + esc(r.agg.healers.join(', ')) + '</b>' : 'non') +
    ' · physique : ' + r.agg.physHeroes + ' · magique : ' + r.agg.magicHeroes + '</div>' +
    '</div>';

  if (r.reviewNote && /not been re-read/.test(r.reviewNote)) {
    html += '<div class="warn">⚠ ' + esc(r.reviewNote) + '</div>';
  }
  r.warnings.forEach(function (w) {
    html += '<div class="warn">⚠ ' + esc(w) + '</div>';
  });

  html += '<div class="section-title">Les menaces de l\'équipe adverse</div>';
  if (r.matchups.length) {
    html += '<div class="threats-grid">' + r.matchups.map(function (m) {
      return buildThreatHTML(m.enemy, m);
    }).join('') + '</div>';
  } else {
    html += '<div class="empty">Ajoute au moins un ennemi pour analyser les menaces.</div>';
  }

  if (r.build) {
    html += '<div class="section-title">1 · Ton build conseillé (référence, poste 1 → 6)</div>' + buildSlotsHTML(r);
    html += '<div class="section-title">2 · Progression : menaces & proies à chaque palier</div>' + buildProgressionHTML(r);
    html += '<div class="section-title">3 · Ajustements (poste par poste, si désavantagé / menace)</div>' + buildChangesHTML(r);
    html += '<div class="section-title">4 · Plan de partie (situation, priorité & annulés)</div>' + buildPlanHTML(r);
  }

  if (r.watch.length) {
    html += '<div class="section-title">5 · Remplacements conditionnels (optionnels — pas nécessaires ici)</div>' + buildWatchHTML(r);
  }

  html += '<div class="section-title">Sources</div><div class="empty">' +
    'Build et compteurs : <a href="' + esc(meta.url) + '" target="_blank" rel="noopener">mlbbhub.com/heroes/' + esc(meta.slug) + '</a> · ' +
    'Catalogue d\'items : <a href="https://mlbbhub.com/items" target="_blank" rel="noopener">mlbbhub.com/items</a> · ' +
    'Statistiques : <a href="https://mlbbhub.com/statistics" target="_blank" rel="noopener">mlbbhub.com/statistics</a></div>';

  $('#results').innerHTML = html;
}

async function analyze() {
  if (state.busy) return;
  if (!state.heroes) {
    setStatus('Les données ne sont pas encore chargées.', 'error');
    return;
  }
  const mySlugInput = $('#myHero').value;
  if (!mySlugInput.trim()) {
    setStatus('Choisis d\'abord ton héros.', 'error');
    return;
  }
  const mySlug = resolveSlug(mySlugInput);
  if (!mySlug) {
    setStatus('Héros introuvable : « ' + mySlugInput + ' ». Choisis une suggestion de la liste.', 'error');
    return;
  }
  const enemyValues = $all('.enemy').map(function (i) { return i.value.trim(); }).filter(Boolean);
  const enemySlugs = [];
  const errors = [];
  enemyValues.forEach(function (v) {
    const s = resolveSlug(v);
    if (!s) errors.push('Héros introuvable : « ' + v + ' »');
    else if (enemySlugs.indexOf(s) === -1 && s !== mySlug) enemySlugs.push(s);
  });
  if (errors.length) {
    setStatus(errors.join(' · '), 'error');
    return;
  }
  if (!enemySlugs.length && enemyValues.length) {
    setStatus('Un ennemi identique à ton héros ou introuvable — vérifie les champs.', 'error');
    return;
  }

  state.busy = true;
  const btn = $('#btnAnalyze');
  btn.disabled = true;
  setStatus('Récupération des builds, items et matchups… (1ère fois : ~15 requêtes, ensuite cachées 24h)', 'info');
  saveLocal();

  try {
    if (!state.myPage || resolveSlug(mySlugInput) !== (state.myMeta && state.myMeta.slug)) {
      await loadMyHero();
    }
    if (!state.myPage) throw new Error('Build de ton héros indisponible.');
    if (state.buildIndex >= state.myPage.builds.length) state.buildIndex = 0;

    const jobs = [];
    enemySlugs.forEach(function (s) {
      jobs.push(loadPage(s).catch(function (e) { errors.push('Page ' + s + ' : ' + e.message); return null; }));
      jobs.push(loadMatchups(s));
    });
    jobs.push(loadMatchups(mySlug));
    const done = await Promise.all(jobs);

    const enemies = [];
    const enemyMatchups = {};
    for (let i = 0; i < enemySlugs.length; i++) {
      const page = done[i * 2];
      const mu = done[i * 2 + 1];
      enemyMatchups[enemySlugs[i]] = mu;
      if (page) enemies.push({ slug: enemySlugs[i], meta: resolveMeta(enemySlugs[i]), page: page });
    }
    const myMatchups = done[done.length - 1];

    if (!enemies.length && enemySlugs.length) throw new Error(errors.join(' · ') || 'Aucun ennemi chargé.');

    const r = E.analyze({
      myMeta: state.myMeta,
      myPage: state.myPage,
      buildIndex: state.buildIndex,
      enemies: enemies,
      itemsByName: state.itemsByName,
      myMatchups: myMatchups,
      enemyMatchups: enemyMatchups
    });
    if (errors.length) r.warnings = r.warnings.concat(errors);
    render(r);
    setStatus('Analyse terminée — ' + enemies.length + ' ennemi(s) analysé(s).', 'info');
  } catch (err) {
    setStatus('Erreur : ' + err.message, 'error');
  } finally {
    state.busy = false;
    btn.disabled = false;
  }
}

function clearAll() {
  $('#myHero').value = '';
  $all('.enemy').forEach(function (i) { i.value = ''; });
  $('#results').innerHTML = '';
  $('#buildVariant').hidden = true;
  $('#myHeroInfo').textContent = '';
  state.myMeta = null;
  state.myPage = null;
  state.buildIndex = 0;
  state.coreTalent = null;
  state.result = null;
  setStatus('');
  try { localStorage.removeItem('draftmlbb'); } catch (e) {}
}

async function init() {
  setStatus('Chargement des données MLBBHub…', 'info');
  try {
    const res = await Promise.all([
      get('/api/heroes', false),
      get('/api/items', false),
      get('/api/stats', true)
    ]);
    state.heroes = E.parseHeroes(res[0]);
    state.items = E.parseItems(res[1]);
    state.stats = res[2];
    state.itemsByName = new Map();
    state.items.forEach(function (it) { state.itemsByName.set(it.name.toLowerCase(), it); });
    populateDatalist();
    renderGlossary();
    restoreLocal();
    const d = state.stats.lastUpdated ? new Date(state.stats.lastUpdated) : null;
    $('#topMeta').textContent = (state.stats.total || state.heroes.size) + ' héros · ' + state.items.size +
      ' items · stats du ' + (d ? d.toLocaleDateString('fr-FR') : 'jour courant');
    setStatus('');
    if ($('#myHero').value) await loadMyHero();
    const hasEnemies = $all('.enemy').some(function (i) { return i.value.trim(); });
    if (hasEnemies && state.myPage) await analyze();
  } catch (err) {
    setStatus('Impossible de charger les données : ' + err.message + ' — vérifie que node server.js tourne et ta connexion.', 'error');
  }
}

let myHeroTimer = null;
$('#myHero').addEventListener('change', function () {
  clearTimeout(myHeroTimer);
  myHeroTimer = setTimeout(loadMyHero, 150);
});
$('#myHero').addEventListener('blur', loadMyHero);
$('#buildVariant').addEventListener('change', function (e) {
  state.buildIndex = parseInt(e.target.value, 10) || 0;
  state.coreTalent = null;
  saveLocal();
  if (state.myPage) analyze();
});
$('#btnAnalyze').addEventListener('click', analyze);
$('#btnClear').addEventListener('click', clearAll);
$all('.enemy').forEach(function (inp) {
  inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') analyze(); });
});
$('#results').addEventListener('change', function (e) {
  const sel = e.target.closest ? e.target.closest('.core-select') : null;
  if (sel) {
    state.coreTalent = sel.value;
    if (state.result) render(state.result);
  }
});
$('#results').addEventListener('click', function (e) {
  const v = e.target.closest ? e.target.closest('.variant') : null;
  if (v && v.dataset && v.dataset.build != null) {
    state.buildIndex = parseInt(v.dataset.build, 10) || 0;
    state.coreTalent = null;
    const sel = $('#buildVariant');
    if (sel) sel.value = String(state.buildIndex);
    saveLocal();
    if (state.myPage) analyze();
  }
});

init();
