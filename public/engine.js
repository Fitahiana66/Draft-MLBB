(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MLBBEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function parseHeroes(md) {
    const heroes = new Map();
    let role = '';
    md.split('\n').forEach(function (line) {
      const h = line.match(/^##\s+(.+?)\s*\(\d+\)\s*$/);
      if (h) { role = h[1].trim(); return; }
      const m = line.match(/^-\s+(.+?),\s+tier\s+([SABCD]):\s+([\d.]+)%\s+WR,\s+([\d.]+)%\s+PR,\s+([\d.]+)%\s+BR\.\s+https:\/\/mlbbhub\.com\/heroes\/([a-z0-9-]+)\s*$/);
      if (!m) return;
      const slug = m[6];
      let e = heroes.get(slug);
      if (!e) {
        e = {
          slug: slug,
          name: m[1],
          roles: [],
          tier: m[2],
          winRate: parseFloat(m[3]),
          pickRate: parseFloat(m[4]),
          banRate: parseFloat(m[5]),
          url: 'https://mlbbhub.com/heroes/' + slug
        };
        heroes.set(slug, e);
      }
      if (role && e.roles.indexOf(role) === -1) e.roles.push(role);
    });
    return heroes;
  }

  function parseItems(md) {
    const items = new Map();
    let cat = '';
    md.split('\n').forEach(function (line) {
      const h = line.match(/^##\s+(Attack|Magic|Defense|Movement|Jungling|Roaming)/);
      if (h) { cat = h[1]; return; }
      if (line.indexOf('| [') !== 0) return;
      const cells = line.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map(function (s) { return s.trim(); });
      if (cells.length < 6) return;
      const lm = cells[0].match(/^\[([^\]]+)\]\(https:\/\/mlbbhub\.com\/items\/([a-z0-9-]+)\)$/);
      if (!lm) return;
      const slug = lm[2];
      let it = items.get(slug);
      if (!it) {
        it = {
          slug: slug,
          name: lm[1],
          url: 'https://mlbbhub.com/items/' + slug,
          tier: parseInt(cells[1], 10) || 0,
          cost: parseInt(cells[2], 10) || 0,
          stats: cells[3],
          passives: cells[4],
          availability: cells[5],
          categories: []
        };
        items.set(slug, it);
      }
      if (cat && it.categories.indexOf(cat) === -1) it.categories.push(cat);
    });
    return items;
  }

  function itemFlags(it) {
    const stats = it.stats || '';
    const passives = it.passives || '';
    return {
      physicalAttack: it.categories.indexOf('Attack') !== -1 || /\bPhysical Attack\b|\bAdaptive Attack\b/.test(stats),
      magicPower: it.categories.indexOf('Magic') !== -1 || /\bMagic Power\b/.test(stats),
      physicalDefense: /\bPhysical Defense\b/.test(stats),
      magicDefense: /\bMagic Defense\b/.test(stats),
      defense: it.categories.indexOf('Defense') !== -1,
      crit: /Critical Chance/.test(stats),
      attackSpeed: /Attack Speed/.test(stats),
      trueDamage: /True Damage/.test(passives),
      antiHeal: /Lifebane/.test(passives),
      hp: (function () {
        const m = stats.match(/HP \+(\d+)/);
        return m ? parseInt(m[1], 10) : 0;
      })()
    };
  }

  function parseFlex(text) {
    const entries = [];
    text.split(';').forEach(function (part) {
      const p = part.trim();
      if (!p) return;
      const m = p.match(/^(.+?)\s+over\s+(.+?)\s+when\s+(.+)$/i);
      if (m) {
        entries.push({
          with: m[1].trim(),
          replace: m[2].trim(),
          condition: m[3].trim().replace(/^Use (?:when|against|if|in)\s+/i, '').replace(/^Use\s+/i, '')
        });
      } else {
        entries.push({ raw: p });
      }
    });
    return entries;
  }

  function parseHeroPage(md) {
    const lines = md.split('\n');
    const snapshot = {};
    lines.forEach(function (line) {
      const m = line.match(/^- (Role|Lane|Specialty|Difficulty|Tier this patch|Win rate|Pick rate|Ban rate|Released|Page): (.+)$/);
      if (m && !(m[1] in snapshot)) snapshot[m[1]] = m[2].trim();
    });
    const builds = [];
    const countersTo = [];
    const beats = [];
    let cur = null;
    let inBuilds = false;
    let reviewNote = '';
    let section = '';
    lines.forEach(function (line) {
      const h2 = line.match(/^##\s+(.+)$/);
      if (h2) {
        const title = h2[1].trim();
        inBuilds = title.indexOf('Curated builds') === 0;
        section = /^Counters to /.test(title) ? 'counters' : (/^Heroes .+ beats$/.test(title) ? 'beats' : title);
        cur = null;
        return;
      }
      if (line.indexOf('### ') === 0) {
        if (!inBuilds) { cur = null; return; }
        const t = line.slice(4).trim();
        const lm = t.match(/^(.+?)(?:\s+\(([^)]+)\))?$/);
        cur = { title: lm[1], lane: lm[2] || '', items: [], core: [], emblem: '', talents: [], spell: '', blessing: '', flex: [], totalCost: 0 };
        builds.push(cur);
        return;
      }
      if (inBuilds && !reviewNote && line.indexOf('Reviewed against') === 0) {
        reviewNote = line.trim();
        return;
      }
      if (cur) {
        let m;
        if ((m = line.match(/^- Items: (.+)$/))) {
          cur.items = m[1].split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        } else if ((m = line.match(/^- Core: (.+)$/))) {
          cur.core = m[1].split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        } else if ((m = line.match(/^- Emblem: (.+)$/))) {
          const raw = m[1].trim();
          const em = raw.match(/^(.+?)\s+Emblem(?:\s+with\s+(.+))?$/);
          if (em) {
            cur.emblem = em[1].trim();
            cur.talents = em[2] ? em[2].split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
          } else {
            cur.emblem = raw;
            cur.talents = [];
          }
        } else if ((m = line.match(/^- Battle spell: (.+)$/))) {
          cur.spell = m[1].trim();
        } else if ((m = line.match(/^- Blessing: (.+)$/))) {
          cur.blessing = m[1].trim();
        } else if ((m = line.match(/^- Flex: (.+)$/))) {
          cur.flex = parseFlex(m[1]);
        } else if ((m = line.match(/^- Total cost: ([\d,]+) gold$/))) {
          cur.totalCost = parseInt(m[1].replace(/,/g, ''), 10);
        }
        return;
      }
      if (section === 'counters' || section === 'beats') {
        const m = line.match(/^- (.+?) \(([^)]+)\):\s+\+([\d.]+) pp(?: edge)?(?: for [^.]+)?\.(.*)$/);
        if (m) {
          (section === 'counters' ? countersTo : beats).push({
            name: m[1],
            role: m[2],
            pp: parseFloat(m[3]),
            reason: m[4].trim()
          });
        }
      }
    });
    return { snapshot: snapshot, builds: builds, reviewNote: reviewNote, countersTo: countersTo, beats: beats };
  }

  const MAGIC_BURST = ['holy-crystal', 'lightning-truncheon', 'blood-wings', 'genius-wand'];
  const MAGIC_SUSTAINED = ['glowing-wand', 'concentrated-energy', 'clock-of-destiny', 'ice-queen-wand', 'feather-of-heaven', 'enchanted-talisman', 'wishing-lantern'];

  function analyzeEnemy(entry, itemsByName) {
    const snap = entry.page.snapshot || {};
    const meta = entry.meta || {};
    const names = [];
    entry.page.builds.forEach(function (b) {
      b.items.forEach(function (n) { if (names.indexOf(n) === -1) names.push(n); });
    });
    const counts = { phys: 0, magic: 0, crit: 0, aa: 0, def: 0, true: 0, antiHeal: 0, hpBig: 0 };
    const slugs = [];
    names.forEach(function (n) {
      const it = itemsByName.get(n.toLowerCase());
      if (!it) return;
      slugs.push(it.slug);
      const f = itemFlags(it);
      if (f.physicalAttack && !f.magicPower) counts.phys += 1;
      if (f.magicPower && !f.physicalAttack) counts.magic += 1;
      if (f.crit) counts.crit += 1;
      if (f.attackSpeed) counts.aa += 1;
      if (f.defense) counts.def += 1;
      if (f.trueDamage) counts.true += 1;
      if (f.antiHeal) counts.antiHeal += 1;
      if (f.hp >= 600) counts.hpBig += 1;
    });
    const role = snap.Role || (meta.roles && meta.roles[0]) || '';
    const specialty = snap.Specialty || '';
    const primary = counts.magic > counts.phys ? 'magique' : (counts.phys > counts.magic ? 'physique' : null);
    let damageType = 'support';
    if (/Mage/.test(role)) damageType = 'magique';
    else if (/Marksman/.test(role)) damageType = 'physique';
    else if (/Assassin/.test(role)) damageType = primary === 'magique' && counts.magic >= 3 ? 'magique' : 'physique';
    else if (/Fighter/.test(role)) damageType = primary || 'physique';
    else if (/Tank|Support/.test(role)) {
      if (primary === 'magique' && counts.magic >= 4) damageType = 'magique';
      else if (primary === 'physique' && counts.phys >= 4) damageType = 'physique';
      else damageType = 'support';
    } else if (primary) damageType = primary;
    const magicBurst = slugs.some(function (s) { return MAGIC_BURST.indexOf(s) !== -1; });
    const magicSustained = slugs.some(function (s) { return MAGIC_SUSTAINED.indexOf(s) !== -1; });
    const tanky = /Tank/.test(role) || counts.def >= 4;
    const highHp = counts.hpBig >= 3 || /Tank/.test(role);
    const fragile = /Mage|Marksman|Assassin/.test(role) || (!tanky && !highHp && counts.def < 2);
    return {
      slug: entry.slug,
      name: meta.name || snap.Role || entry.slug,
      portrait: entry.page.portrait || null,
      meta: meta,
      role: role,
      lane: snap.Lane || '',
      specialty: specialty,
      tier: meta.tier || snap['Tier this patch'] || '?',
      winRate: meta.winRate != null ? meta.winRate : parseFloat(snap['Win rate']) || null,
      url: meta.url || 'https://mlbbhub.com/heroes/' + entry.slug,
      damageType: damageType,
      healer: /Regen/.test(specialty),
      control: /Control/.test(specialty),
      tank: tanky,
      crit: counts.crit >= 1,
      aa: counts.aa >= 2,
      trueDamage: counts.true >= 1,
      highHp: highHp,
      fragile: fragile,
      magicBurst: damageType === 'magique' && magicBurst,
      magicSustained: damageType === 'magique' && magicSustained,
      counts: counts
    };
  }

  function aggregate(threats) {
    const agg = {
      healers: [],
      physHeroes: 0,
      magicHeroes: 0,
      magicBurst: 0,
      magicSustained: 0,
      critHeroes: 0,
      aaHeroes: 0,
      tankCount: 0,
      trueDmgHeroes: 0,
      controlCount: 0,
      highHpCount: 0,
      fragileCount: 0,
      names: [],
      physNames: [],
      magicNames: [],
      critNames: [],
      tankNames: [],
      trueNames: [],
      fragileNames: []
    };
    threats.forEach(function (t) {
      agg.names.push(t.name);
      if (t.healer) agg.healers.push(t.name);
      if (t.damageType === 'physique') { agg.physHeroes += 1; agg.physNames.push(t.name); }
      if (t.damageType === 'magique') { agg.magicHeroes += 1; agg.magicNames.push(t.name); }
      if (t.magicBurst) agg.magicBurst += 1;
      if (t.magicSustained) agg.magicSustained += 1;
      if (t.crit) { agg.critHeroes += 1; agg.critNames.push(t.name); }
      if (t.aa) agg.aaHeroes += 1;
      if (t.tank) { agg.tankCount += 1; agg.tankNames.push(t.name); }
      if (t.trueDamage) { agg.trueDmgHeroes += 1; agg.trueNames.push(t.name); }
      if (t.control) agg.controlCount += 1;
      if (t.highHp) agg.highHpCount += 1;
      if (t.fragile) { agg.fragileCount += 1; agg.fragileNames.push(t.name); }
    });
    return agg;
  }

  const CONCEPTS = [
    { id: 'healer', re: /healer|shield support/, test: function (a) { return a.healers.length > 0; } },
    { id: 'tripleMagic', re: /triple[- ]magic|three magic|magic damage comps/, test: function (a) { return a.magicHeroes >= 3; } },
    { id: 'fullPhysical', re: /full[- ]physical/, test: function (a) { return a.physHeroes >= 4; } },
    { id: 'sustainedMagic', re: /sustained poke|repeated magic damage|sustained magic/, test: function (a) { return a.magicSustained >= 1; } },
    { id: 'magicBurst', re: /magic burst|one-shot burst/, test: function (a) { return a.magicBurst >= 1; } },
    { id: 'splitPhys', re: /physical threat is split across multiple sources/, test: function (a) { return a.physHeroes >= 3; } },
    { id: 'crit', re: /\bcrits?\b|critical strikes?/, test: function (a) { return a.critHeroes >= 1; } },
    { id: 'noHardCC', re: /no hard crowd control|no hard cc|no crowd control/, test: function (a) { return a.controlCount <= 1; } },
    { id: 'trueDmg', re: /true damage/, test: function (a) { return a.trueDmgHeroes >= 1; } },
    { id: 'highHp', re: /high-?hp fighter/, test: function (a) { return a.highHpCount >= 1; } },
    { id: 'frequentFights', re: /fights are frequent/, test: function () { return null; } },
    { id: 'manyTanks', re: /tanky bruiser|multiple tanks|stacked armor/, test: function (a) { return a.tankCount >= 2; } }
  ];

  const CONCEPT_LABELS = {
    healer: 'soigneur détecté',
    tripleMagic: '3+ magiques',
    fullPhysical: 'comp 100% physique',
    sustainedMagic: 'magie soutenue',
    magicBurst: 'rafale magique',
    splitPhys: 'physique éclaté',
    crit: 'critique',
    noHardCC: 'peu de CC',
    trueDmg: 'dégâts vrais',
    highHp: 'PV élevés',
    frequentFights: 'fights fréquents',
    manyTanks: 'plusieurs tanks'
  };

  function labelConcepts(ids) {
    return ids.map(function (id) { return CONCEPT_LABELS[id] || id; }).join(', ');
  }

  const CONDITION_THEMES = [
    [/no (hard )?crowd control|no hard cc|light crowd control|lacks?[^.]{0,30}control|not control-heavy|without enough (crowd )?control/, 'peu de contrôle (CC)'],
    [/no heal|lacks?[^.]{0,30}heal|does not have enough healing/, 'peu / pas de soins'],
    [/full-?physical/, 'comp 100% physique'],
    [/heal|regen|lifesteal|sustain|lifebane|anti-heal/, 'soins / régén / vol de vie'],
    [/shield/, 'boucliers'],
    [/crowd control|lockdown|control chain|layered control|\bcc\b|stun|knock|slow/, 'contrôle (CC)'],
    [/magic burst|magic damage|magic poke|magic chip|magic hits|magic defense|magic penetration/, 'dégâts magiques'],
    [/physical burst|physical damage|physical dive|physical lane|physical threat|physical assassin|physical skill/, 'dégâts physiques'],
    [/one-shot|one-rotation|burst/, 'rafale / burst'],
    [/attack[- ]speed/, "vitesse d'attaque"],
    [/\bcrits?\b|critical/, 'crits'],
    [/true damage/, 'dégâts vrais'],
    [/hp-stacking|high-?hp|extra-?hp|stacking target/, 'PV élevés'],
    [/stacked (physical )?defen|armor stack|stacking armor|\btanks?\b|bruiser/, 'armure / tanks'],
    [/assassin|diver|\bdive\b|backline|engage/, 'assassins / plongeurs'],
    [/poke|chip/, 'poke / harcèlement'],
    [/lord|objective|turtle/, 'objectifs (Tortue / Lord)'],
    [/revive|immortality/, 'résurrection'],
    [/stasis|freeze|frozen/, 'gel / stase'],
    [/ahead|snowball|winning|gold lead|closing|you are the primary/, 'tu es devant'],
    [/behind|losing|low economy|fails/, 'tu es derrière'],
    [/slow control|repeated slows|slows/, 'ralentissements'],
    [/movement speed|faster|map speed|rotate|rotation|tempo/, 'mobilité / rotations']
  ];

  const THEME_EXCLUSIONS = {
    'peu de contrôle (CC)': 'contrôle (CC)',
    'peu / pas de soins': 'soins / régén / vol de vie'
  };

  function frCondition(cond) {
    const c = String(cond || '').toLowerCase();
    const out = [];
    CONDITION_THEMES.forEach(function (t) {
      if (t[0].test(c) && out.indexOf(t[1]) === -1) out.push(t[1]);
    });
    Object.keys(THEME_EXCLUSIONS).forEach(function (neg) {
      if (out.indexOf(neg) !== -1) {
        const i = out.indexOf(THEME_EXCLUSIONS[neg]);
        if (i !== -1) out.splice(i, 1);
      }
    });
    return out.length ? out.join(' · ') : null;
  }

  function matchCondition(cond, agg) {
    const c = cond.toLowerCase();
    const found = CONCEPTS.filter(function (k) { return k.re.test(c); });
    if (!found.length) return { matched: false, note: 'Condition non reconnue automatiquement — à vérifier toi-même.' };
    const hasOr = /\bor\b/.test(c);
    const detectable = found.filter(function (k) { return k.test(agg) !== null; });
    if (!detectable.length) return { matched: false, note: 'Condition impossible à détecter avec les données (contexte de jeu requis).' };
    const results = detectable.map(function (k) { return { id: k.id, ok: k.test(agg) }; });
    const okList = results.filter(function (r) { return r.ok; });
    const labels = okList.map(function (r) { return r.id; });
    if (hasOr) {
      if (okList.length) return { matched: true, why: 'Déclenchée par : ' + labelConcepts(labels) };
      return { matched: false, note: 'Non remplie : ' + labelConcepts(results.map(function (r) { return r.id; })) + ' absent.' };
    }
    if (okList.length === results.length) return { matched: true, why: 'Déclenchée par : ' + labelConcepts(labels) };
    const failed = results.filter(function (r) { return !r.ok; }).map(function (r) { return r.id; });
    return { matched: false, note: 'Pas encore remplie (' + labelConcepts(failed) + ' manquant).' };
  }

  const FR_EFFECTS = {
    'Sea Halberd': 'Lifebane : soins et boucliers de la cible ramenés à 60% pendant 3s.',
    'Glowing Wand': 'Lifebane : soins/boucliers de la cible à 50% + brûlure 1.5% PV max/s.',
    'Dominance Ice': 'Lifebane : soins/boucliers des ennemis proches à 60% + 40 défense hybride.',
    'Athena\u2019s Shield': "Bouclier : -25% de dégâts magiques pendant 3s après un coup magique.",
    "Athena's Shield": "Bouclier : -25% de dégâts magiques pendant 3s après un coup magique.",
    'Radiant Armor': 'Empile +6 à 20 défense magique par coup magique reçu (6 stacks max).',
    'Antique Cuirass': 'Deter : réduit les dégâts physiques de l’attaquant de 6% par coup (3 stacks).',
    'Blade Armor': '-20% de dégâts critiques reçus + renvoie 30% des dégâts + 20% de ta défense.',
    'Wind of Nature': 'Actif : immunité totale aux dégâts physiques pendant 2s (90s de CD).',
    'Winter Crown': 'Actif : gel — invulnérable et intouchable pendant 2s.',
    'Malefic Roar': '0.1% de pénétration physique par point de défense ennemie (max 30%).',
    'Divine Glaive': '40% de pénétration magique + 0.1% par point de défense magique (max 20%).',
    'Queen\u2019s Wings': 'Demonize : -30% de dégâts sous 40% PV + dégâts augmentés quand tu baisses.',
    "Queen's Wings": 'Demonize : -30% de dégâts sous 40% PV + dégâts augmentés quand tu baisses.',
    'Immortality': 'Renaissance 2.5s après la mort avec bouclier (210s de CD).',
    'Oracle': 'Bless : +25% sur les soins et boucliers que tu reçois.',
    'Brute Force Breastplate': 'Empile dégâts, vitesse et -15% durée de CC en combat prolongé.',
    'Thunder Belt': 'Dégâts vrais + ralentissement violent toutes les 4s, défense hybride permanente.',
    'Sky Piercer': 'Lethality : exécute les héros sous 4% de PV ; +0,1% de seuil par kill (empile, perdu en partie à la mort).',
    'Hunter Strike': 'Retribution : après 5 dégâts consécutifs sur une cible, gros gain de vitesse de déplacement.'
  };

  function frEffect(name) {
    if (FR_EFFECTS[name]) return FR_EFFECTS[name];
    return null;
  }

  const PEN_SLUGS = ['malefic-roar', 'divine-glaive'];
  const CC_REDUCE_SLUGS = ['tough-boots', 'resilience'];

  function heroTags(t) {
    const tags = [];
    if (t.damageType === 'magique') tags.push('dégâts magiques');
    else if (t.damageType === 'physique') tags.push('dégâts physiques');
    if (t.healer) tags.push('soigneur');
    if (t.crit) tags.push('crit');
    if (t.aa) tags.push("vitesse d'attaque");
    if (t.control) tags.push('contrôle');
    if (t.trueDamage) tags.push('dégâts vrais');
    if (t.tank) tags.push('tank');
    if (t.highHp) tags.push('PV élevés');
    if (t.fragile) tags.push('fragile');
    return tags;
  }

  function buildProgression(slots, matchups, threats) {
    const phaseOf = function (m) { return m <= 2 ? 'early' : (m <= 4 ? 'mid' : 'late'); };
    const bySlug = {};
    matchups.forEach(function (mu) { bySlug[mu.enemy.slug] = mu; });
    const flags = slots.map(function (s) { return s.item ? itemFlags(s.item) : null; });
    const slugOf = slots.map(function (s) { return s.item ? s.item.slug : null; });

    function profileOf(m) {
      const prof = { magicDef: 0, physDef: 0, critDef: false, antiHeal: false, pen: false, ccReduce: false, offense: 0, hp: 0 };
      for (let i = 0; i < m; i++) {
        const f = flags[i];
        if (!f || slugOf[i] === undefined) continue;
        if (f.magicDefense) prof.magicDef++;
        if (f.physicalDefense) prof.physDef++;
        if (slugOf[i] === 'blade-armor') prof.critDef = true;
        if (f.antiHeal) prof.antiHeal = true;
        if (PEN_SLUGS.indexOf(slugOf[i]) !== -1) prof.pen = true;
        if (CC_REDUCE_SLUGS.indexOf(slugOf[i]) !== -1) prof.ccReduce = true;
        if (f.physicalAttack || f.magicPower) prof.offense++;
        if (f.hp) prof.hp += f.hp;
      }
      return prof;
    }

    function adjust(t, prof) {
      let a = 0;
      if (t.damageType === 'magique') { a += 3 * prof.magicDef; if (prof.magicDef === 0 && t.magicBurst) a -= 5; }
      if (t.damageType === 'physique') { a += 3 * prof.physDef; if (prof.physDef === 0 && t.crit) a -= 4; }
      if (t.crit && prof.critDef) a += 6;
      if (t.healer && prof.antiHeal) a += 6;
      if (t.trueDamage) a -= 1.5 * Math.max(0, prof.physDef + prof.magicDef - 1);
      if ((t.tank || t.highHp) && prof.pen) a += 5;
      if (t.fragile) a += 2 * Math.max(0, prof.offense - 1);
      if (t.control && prof.ccReduce) a += 2;
      return a;
    }

    const enemies = threats.map(function (t) {
      return { name: t.name, slug: t.slug, portrait: t.portrait || null, damageType: t.damageType, tags: heroTags(t), cells: [] };
    });

    const milestones = [];
    for (let m = 1; m <= 6; m++) {
      const phase = phaseOf(m);
      const prof = profileOf(m);
      const info = threats.map(function (t) {
        const mu = bySlug[t.slug] || {};
        let base = null;
        if (mu.phase && mu.phase[phase] != null) base = (mu.phase[phase] - 0.5) * 100;
        else if (mu.edge != null) base = mu.edge;
        if (base == null) base = 0;
        const score = Math.round(base + adjust(t, prof));
        const verdict = score >= 3 ? 'prey' : (score <= -3 ? 'fear' : 'neutral');
        return { score: score, verdict: verdict };
      });
      info.forEach(function (c, i) { enemies[i].cells.push(c); });
      milestones.push({
        poste: m,
        item: slots[m - 1] ? slots[m - 1].name : null,
        slug: slugOf[m - 1],
        phase: phase,
        profile: prof
      });
    }

    function listsAt(m) {
      const fear = [];
      const prey = [];
      enemies.forEach(function (e) {
        const c = e.cells[m - 1];
        if (c.verdict === 'fear') fear.push({ name: e.name, score: c.score });
        else if (c.verdict === 'prey') prey.push({ name: e.name, score: c.score });
      });
      fear.sort(function (a, b) { return a.score - b.score; });
      prey.sort(function (a, b) { return b.score - a.score; });
      return { fear: fear, prey: prey };
    }

    const rows = [];
    let prevKey = null;
    for (let m = 1; m <= 6; m++) {
      const l = listsAt(m);
      const key = l.fear.map(function (x) { return x.name; }).join('|') + '#' + l.prey.map(function (x) { return x.name; }).join('|');
      if (key !== prevKey || m === 6) {
        rows.push({
          poste: m,
          item: milestones[m - 1].item,
          phase: milestones[m - 1].phase,
          changed: prevKey !== null,
          fear: l.fear,
          prey: l.prey
        });
        prevKey = key;
      }
    }

    return {
      milestones: milestones,
      enemies: enemies,
      rows: rows,
      early: listsAt(2),
      mid: listsAt(4),
      final: listsAt(6)
    };
  }

  function deriveFlags(slots, mySnap, lane) {
    const hasAntiHeal = slots.some(function (s) { const it = s.item; return it && itemFlags(it).antiHeal; });
    const defFlagOf = function (s, kind) {
      const it = s.item;
      if (!it || it.categories.indexOf('Movement') !== -1) return false;
      const f = itemFlags(it);
      return kind === 'phys' ? f.physicalDefense : f.magicDefense;
    };
    const magicDefCount = slots.filter(function (s) { return defFlagOf(s, 'magic'); }).length;
    const physDefCount = slots.filter(function (s) { return defFlagOf(s, 'phys'); }).length;
    const critDef = slots.some(function (s) { return s.item && s.item.slug === 'blade-armor'; });
    const wonBuilt = slots.some(function (s) { return s.item && s.item.slug === 'wind-of-nature'; });
    let phys = 0;
    let magic = 0;
    slots.forEach(function (s) {
      const it = s.item;
      if (!it) return;
      const f = itemFlags(it);
      if (f.physicalAttack && !f.magicPower) phys += 1;
      if (f.magicPower && !f.physicalAttack) magic += 1;
    });
    const myDmg = magic > phys ? 'magique' : 'physique';
    const role = mySnap.Role || '';
    const frontline = lane === 'Roam' || /Tank/.test(role) || physDefCount + magicDefCount >= 2;
    const isMM = /Marksman/.test(role) || lane === 'Gold';
    const offence = slots.filter(function (s) {
      if (!s.item) return false;
      const f = itemFlags(s.item);
      return f.physicalAttack || f.magicPower;
    }).length;
    const isDamageDealer = lane !== 'Roam' && !/Tank|Support/.test(role) && offence >= 3;
    return {
      hasAntiHeal: hasAntiHeal,
      magicDefCount: magicDefCount,
      physDefCount: physDefCount,
      critDef: critDef,
      wonBuilt: wonBuilt,
      myDmg: myDmg,
      frontline: frontline,
      isMM: isMM,
      role: role,
      offence: offence,
      isDamageDealer: isDamageDealer
    };
  }

  function itemGroup(it) {
    if (!it) return 'x';
    const f = itemFlags(it);
    if (it.categories.indexOf('Defense') !== -1 || f.physicalDefense || f.magicDefense) return 'def';
    if (it.categories.indexOf('Attack') !== -1 || it.categories.indexOf('Magic') !== -1 || f.physicalAttack || f.magicPower) return 'atk';
    return 'util';
  }

  function pickChangeSlot(slots, used, target, build) {
    const core = (build.core || []).map(function (c) { return c.toLowerCase(); });
    const cands = slots.filter(function (s) {
      return s.item && used.indexOf(s.index) === -1 && core.indexOf(s.base.toLowerCase()) === -1 && s.item.categories.indexOf('Movement') === -1;
    });
    if (!cands.length) return null;
    const g = itemGroup(target);
    const same = cands.filter(function (s) { return itemGroup(s.item) === g; });
    const pool = (same.length ? same : cands).slice();
    pool.sort(function (a, b) { return b.index - a.index; });
    return pool[0];
  }

  function changeWeight(p) {
    const t = (p.title || '').toLowerCase();
    if (/anti-soin/.test(t)) return 90;
    if (/fragile|snowball|exécution/.test(t)) return 88;
    if (/désavantage/.test(t)) return 82;
    if (/pénétration/.test(t)) return 70;
    if (/magique/.test(t)) return 62;
    if (/critique|crits/.test(t)) return 55;
    if (/dégâts vrais/.test(t)) return 48;
    return 40;
  }

  function globalRules(ctx) {
    const agg = ctx.agg;
    const slots = ctx.slots;
    const myBuild = ctx.build;
    const mySnap = ctx.mySnap;
    const recos = [];
    const flags = deriveFlags(slots, mySnap, myBuild.lane || '');
    const hasAntiHeal = flags.hasAntiHeal;
    const magicDefCount = flags.magicDefCount;
    const physDefCount = flags.physDefCount;
    const critDef = flags.critDef;
    const wonBuilt = flags.wonBuilt;
    const myDmg = flags.myDmg;
    const lane = myBuild.lane || '';
    const frontline = flags.frontline;
    const isMM = flags.isMM;
    const coreEnd = (function () {
      if (!myBuild.core.length) return 3;
      let last = 0;
      myBuild.core.forEach(function (c) {
        const idx = slots.findIndex(function (s) { return s.base && s.base.toLowerCase() === c.toLowerCase(); });
        if (idx >= last) last = idx;
      });
      return Math.min(last + 2, 5);
    })();
    const slotHint = 'vers le slot ' + Math.max(3, coreEnd + 1);

    if (agg.healers.length && !hasAntiHeal) {
      const pick = myDmg === 'magique' ? 'Glowing Wand' : (frontline ? 'Dominance Ice' : 'Sea Halberd');
      recos.push({
        order: 1,
        item: pick,
        title: 'Anti-soin obligatoire',
        why: agg.healers.join(', ') + ' soignent l’équipe ennemie (spécialité Regen) : sans anti-heal, tes dégâts sont annulés.',
        triggers: agg.healers,
        slotHint: slotHint
      });
    }
    if (agg.magicHeroes >= 1 && magicDefCount < (agg.magicHeroes >= 3 ? 2 : 1)) {
      const pick = (agg.magicSustained && !agg.magicBurst) ? 'Radiant Armor' : "Athena's Shield";
      recos.push({
        order: 2,
        item: pick,
        title: agg.magicBurst ? 'Contre la rafale magique' : 'Contre les dégâts magiques',
        why: agg.magicHeroes + ' ennemi(s) infligent des dégâts magiques' + (agg.magicBurst ? ' en rafale (burst)' : '') + '.',
        triggers: agg.magicNames,
        slotHint: slotHint
      });
      if (agg.magicHeroes >= 2 && magicDefCount < 2) {
        const alt = pick.indexOf('Radiant') === 0 ? "Athena's Shield" : 'Radiant Armor';
        recos.push({
          order: 2,
          item: alt,
          title: 'Seconde défense magique',
          why: 'Comp magique lourde : une seule source de défense magique ne suffit pas.',
          triggers: agg.magicNames,
          slotHint: 'slot 6'
        });
      }
    }
    if (agg.critHeroes >= 1) {
      if (isMM && !wonBuilt) {
        recos.push({
          order: 3,
          item: 'Wind of Nature',
          title: 'Contre les crits physiques',
          why: 'Leur marksman tape en critique : Wind Chant te donne 2s d’immunité physique pour survivre au trade.',
          triggers: agg.critNames,
          slotHint: slotHint
        });
      } else if (frontline && !critDef) {
        recos.push({
          order: 3,
          item: 'Blade Armor',
          title: 'Contre les crits physiques',
          why: 'Ennemi(s) critique(s) détecté(s) : -20% de dégâts critiques reçus + renvoi de dégâts.',
          triggers: agg.critNames,
          slotHint: slotHint
        });
      }
    }
    if (agg.physHeroes >= 3 && physDefCount < 1 && frontline) {
      recos.push({
        order: 3,
        item: 'Antique Cuirass',
        title: 'Frontline contre le physique',
        why: agg.physHeroes + ' ennemis sur du dégâts physiques : Deter réduit leurs dégâts de 6% par coup.',
        triggers: agg.physNames,
        slotHint: slotHint
      });
    }
    if (agg.tankCount >= 2) {
      const penBuilt = slots.some(function (s) { return s.item && (s.item.slug === 'malefic-roar' || s.item.slug === 'divine-glaive'); });
      if (!penBuilt) {
        const pick = myDmg === 'magique' ? 'Divine Glaive' : 'Malefic Roar';
        recos.push({
          order: 4,
          item: pick,
          title: 'Pénétration vs armure',
          why: agg.tankCount + ' ennemis lourdement armurés : la pénétration scale avec leur défense — bien plus efficace que de la pure attaque.',
          triggers: agg.tankNames,
          slotHint: slotHint
        });
      }
    }
    if (agg.trueDmgHeroes >= 2) {
      const qw = slots.some(function (s) { return s.item && s.item.slug === 'queens-wings'; });
      if (!qw) {
        recos.push({
          order: 4,
          item: "Queen's Wings",
          title: 'Vs dégâts vrais',
          why: agg.trueDmgHeroes + ' ennemis ont du dégât vrai (ignorent l’armure) : privilégie les PV et la réduction de dégâts plutôt que la défense.',
          triggers: agg.trueNames,
          slotHint: 'slot 6'
        });
      }
    }

    const outlook = ctx.outlook || {};
    const fragile = ctx.fragile || { count: 0, names: [] };
    const isDamageDealer = ctx.isDamageDealer != null ? ctx.isDamageDealer : (!frontline && (myDmg === 'physique' || myDmg === 'magique'));
    if (fragile.count >= 3 && isDamageDealer) {
      const spBuilt = slots.some(function (s) { return s.item && s.item.slug === 'sky-piercer'; });
      if (!spBuilt) {
        const snowball = outlook.outlook === 'avantage';
        recos.push({
          order: 5,
          item: 'Sky Piercer',
          title: snowball ? 'Comp fragile + tu as l’avantage → snowball' : 'Comp fragile → exécution',
          why: fragile.count + ' ennemis sur 5 sont fragiles (' + fragile.names.join(', ') + ') : Perce-ciel exécute les cibles sous 4% de PV et gagne +0,1% de seuil par kill. ' +
            (snowball ? 'Tu es devant dans ce draft : enchaîne les kills et convertis ton avance en objectifs avant le late game.' : 'Les cibles fragiles meurent plus vite — tu closes les kills au lieu de les laisser fuir.'),
          triggers: fragile.names,
          slotHint: 'slot 2-3 (item à 1500 or, rentabilisé dès le 1er kill)'
        });
      }
    }
    if (outlook.outlook === 'desavantage') {
      const hasSustain = slots.some(function (s) { return s.item && ['queens-wings', 'immortality', 'oracle'].indexOf(s.item.slug) !== -1; });
      if (!hasSustain && physDefCount + magicDefCount < 2) {
        const pickSurv = frontline ? 'Immortality' : "Queen's Wings";
        recos.push({
          order: 6,
          item: pickSurv,
          title: 'Tu pars en désavantage → garde-toi en vie',
          why: 'Les données te placent derrière sur ce draft (edge moyen ' + (outlook.score != null ? (outlook.score > 0 ? '+' : '') + outlook.score.toFixed(1) + ' pp' : '—') + '). ' +
            (frontline ? 'Immortalité te rend une seconde vie pour réengager au bon moment.' : "Ailes de la reine coupent 30% des dégâts sous 40% de PV : tu survis au burst au lieu de mourir avant d’avoir joué ton combo.") +
            ' Compromis assumé : plus de défense = moins de dégâts ; ne le fais que si tes coéquipiers portent les dégâts.',
          triggers: [],
          slotHint: 'slot 5-6'
        });
      }
    }
    recos.sort(function (a, b) { return a.order - b.order; });
    return recos;
  }

  function lookupMatchup(enemy, ctx) {
    const out = { edge: null, phase: null, reason: null };
    const myJson = ctx.myMatchups;
    if (myJson && myJson.matchups) {
      const lists = [
        { arr: myJson.matchups.bestMatchups, sign: 1 },
        { arr: myJson.matchups.worstMatchups, sign: 1 }
      ];
      for (const l of lists) {
        const hit = (l.arr || []).find(function (x) { return x.heroSlug === enemy.slug; });
        if (hit) {
          out.edge = l.sign * hit.increaseWinRate * 100;
          out.phase = hit.winRateByDuration;
          break;
        }
      }
    }
    if (out.edge == null) {
      const ej = ctx.enemyMatchups && ctx.enemyMatchups[enemy.slug];
      if (ej && ej.matchups && ctx.myMeta) {
        const lists = [
          { arr: ej.matchups.bestMatchups, sign: -1 },
          { arr: ej.matchups.worstMatchups, sign: -1 }
        ];
        for (const l of lists) {
          const hit = (l.arr || []).find(function (x) { return x.heroSlug === ctx.myMeta.slug; });
          if (hit) {
            out.edge = l.sign * hit.increaseWinRate * 100;
            out.phase = {
              early: 1 - hit.winRateByDuration.early,
              mid: 1 - hit.winRateByDuration.mid,
              late: 1 - hit.winRateByDuration.late
            };
            break;
          }
        }
      }
    }
    if (ctx.myPage) {
      const cm = ctx.myPage.countersTo.concat(ctx.myPage.beats).find(function (x) {
        return x.name.toLowerCase() === enemy.name.toLowerCase();
      });
      if (cm) {
        out.reason = cm.reason || null;
        if (out.edge == null) {
          out.edge = (ctx.myPage.countersTo.indexOf(cm) !== -1 ? -cm.pp : cm.pp);
        }
      }
    }
    return out;
  }

  function assessOutlook(threats, matchups, myMeta) {
    const edges = matchups.map(function (m) { return m.edge; }).filter(function (e) { return e != null; });
    const avgEdge = edges.length ? edges.reduce(function (a, b) { return a + b; }, 0) / edges.length : null;
    const myW = myMeta && myMeta.winRate != null ? myMeta.winRate : null;
    const enWs = threats.map(function (t) { return t.winRate; }).filter(function (v) { return v != null; });
    const avgEnW = enWs.length ? enWs.reduce(function (a, b) { return a + b; }, 0) / enWs.length : null;
    let basis = 'matchups';
    let score = avgEdge;
    if ((score == null || edges.length < 2) && myW != null && avgEnW != null) {
      score = myW - avgEnW;
      basis = 'meta';
    }
    const fragileCount = threats.filter(function (t) { return t.fragile; }).length;
    const threshold = basis === 'meta' ? 1.5 : 0.8;
    let outlook;
    if (score == null) outlook = 'inconnu';
    else if (score >= threshold) outlook = 'avantage';
    else if (score <= -threshold) outlook = 'desavantage';
    else outlook = 'equilibre';
    return {
      outlook: outlook,
      score: score,
      basis: basis,
      avgEdge: avgEdge,
      avgEnW: avgEnW,
      myW: myW,
      fragileCount: fragileCount,
      sample: edges.length,
      enemyCount: threats.length
    };
  }

  function buildPlan(ctx) {
    const outlook = ctx.outlook;
    const build = ctx.build;
    const slots = ctx.slots;
    const changes = ctx.changes || [];
    const itemsByName = ctx.itemsByName;
    const fragile = ctx.fragile;
    const frontline = ctx.frontline;
    const myDmg = ctx.myDmg;
    const isDamageDealer = ctx.isDamageDealer;

    let posture = 'equilibre';
    if (outlook.outlook === 'avantage') posture = 'agressif';
    else if (outlook.outlook === 'desavantage') posture = (fragile.count >= 3 && isDamageDealer) ? 'equilibre' : 'defensif';
    else if (fragile.count >= 3 && isDamageDealer) posture = 'agressif';

    const POSTURE = {
      agressif: {
        label: 'Agressif (tempo / snowball)',
        advice: 'Ce draft te favorise : joue l’initiative, force les objectifs (tortue, seigneur) et cherche à conclure avant le late game. Ne dépense pas ton or dans de la défense dont tu n’as pas besoin.' +
          (isDamageDealer ? ' Mise sur tes dégâts et les items à pic rapide.' : '')
      },
      equilibre: {
        label: 'Équilibré',
        advice: (fragile.count >= 3 && isDamageDealer)
          ? 'Le draft est serré mais l’adversaire est fragile : reste sur tes dégâts, joue les picks isolés et n’ajoute de la survie que si tu te fais réellement punir.'
          : 'Draft serré : suis l’ordre de craft conseillé sans dévier, garde ta botte à jour et n’ajoute que les ajustements déclenchés par les menaces ci-dessus.'
      },
      defensif: {
        label: 'Prudent / défensif',
        advice: 'Ce draft te met derrière : sécurise tes items de survie, joue autour de tes coéquipiers, prends les combats en infériorité numérique favorable. Compromis : plus de défense = moins de dégâts — à faire seulement si tes carries font les dégâts.'
      }
    };

    const order = slots.map(function (s) {
      return { poste: s.index, item: s.name, from: null, changed: false, type: null };
    });
    changes.forEach(function (c) {
      const o = order.find(function (x) { return x.poste === c.poste; });
      if (o) { o.item = c.to; o.from = c.from; o.changed = true; o.type = c.type; }
    });
    const cancelled = changes.map(function (c) { return c.from; });

    const rushNames = [];
    const push = function (n) { if (n && rushNames.indexOf(n) === -1 && rushNames.length < 3) rushNames.push(n); };
    changes.filter(function (c) { return c.type === 'priorite'; }).forEach(function (c) { push(c.to); });
    (build.core || []).forEach(push);
    order.forEach(function (o) { push(o.item); });
    let rushCost = 0;
    rushNames.forEach(function (n) {
      const it = itemsByName.get(n.toLowerCase());
      if (it) rushCost += it.cost;
    });

    const notes = [];
    if (outlook.basis === 'meta' && outlook.outlook !== 'inconnu') {
      notes.push('Pas assez de matchups directs fiables : l’avantage/désavantage est estimé sur les WR globales (toi ' + (outlook.myW != null ? outlook.myW.toFixed(1) + '%' : '—') + ' vs ennemis ' + (outlook.avgEnW != null ? outlook.avgEnW.toFixed(1) + '%' : '—') + ').');
    } else if (outlook.outlook === 'inconnu') {
      notes.push('Aucune donnée d’avantage exploitable pour ce draft (matchups et WR indisponibles).');
    }
    notes.push('Une partie peut se terminer à 9-12 min : si tu sens que ça va aller vite (ou que tu farms mal), vise d’abord ces 2-3 items plutôt que le build complet.');

    return {
      outlook: outlook,
      posture: posture,
      postureLabel: POSTURE[posture].label,
      postureAdvice: POSTURE[posture].advice,
      fragile: fragile,
      order: order,
      cancelled: cancelled,
      rush: { items: rushNames, cost: rushCost },
      notes: notes
    };
  }

  function analyze(input) {
    const itemsByName = input.itemsByName;
    const myPage = input.myPage;
    const myMeta = input.myMeta;
    const build = myPage.builds[input.buildIndex] || myPage.builds[0] || null;
    const threats = input.enemies.map(function (e) { return analyzeEnemy(e, itemsByName); });
    const agg = aggregate(threats);
    const result = {
      myMeta: myMeta,
      mySnap: myPage.snapshot,
      build: build,
      reviewNote: myPage.reviewNote,
      threats: threats,
      agg: agg,
      slots: [],
      priorities: [],
      watch: [],
      matchups: [],
      warnings: []
    };
    if (!build) {
      result.warnings.push('Aucun build curaté trouvé pour ce héros.');
      return result;
    }
    const swaps = [];
    const watch = [];
    build.flex.forEach(function (f) {
      if (!f.with || !f.replace) {
        if (f.raw) watch.push({ entry: f, note: 'Format flex non reconnu — à lire manuellement.' });
        return;
      }
      const m = matchCondition(f.condition, agg);
      if (m.matched) swaps.push({ entry: f, why: m.why });
      else watch.push({ entry: f, note: m.note });
    });
    let running = 0;
    const baseSlots = build.items.map(function (name, idx) {
      const item = itemsByName.get(name.toLowerCase()) || null;
      const slot = {
        index: idx + 1,
        base: name,
        name: name,
        item: item,
        cost: item ? item.cost : 0,
        running: 0
      };
      running += slot.cost;
      slot.running = running;
      return slot;
    });
    result.slots = baseSlots;
    result.total = running;

    const effSlots = baseSlots.map(function (s) {
      return { index: s.index, base: s.base, name: s.name, item: s.item, cost: s.cost, running: s.running, swapped: false, condition: null, swapReason: null };
    });
    const changes = [];
    const used = [];
    swaps.forEach(function (sw) {
      const idx = effSlots.findIndex(function (s) { return s.base.toLowerCase() === sw.entry.replace.toLowerCase(); });
      if (idx === -1) {
        result.warnings.push('Item à remplacer introuvable dans le build : ' + sw.entry.replace);
        return;
      }
      const target = itemsByName.get(sw.entry.with.toLowerCase()) || null;
      const old = effSlots[idx];
      effSlots[idx] = { index: idx + 1, base: old.base, name: sw.entry.with, item: target, cost: target ? target.cost : 0, running: 0, swapped: true, condition: sw.entry.condition, swapReason: sw.why };
      used.push(idx + 1);
      changes.push({
        type: 'auto',
        poste: idx + 1,
        from: old.base,
        to: sw.entry.with,
        toItem: target,
        delta: (target ? target.cost : 0) - old.cost,
        reason: sw.why,
        title: 'Remplacement automatique (condition remplie)',
        triggers: [],
        effect: (target ? (frEffect(sw.entry.with) || target.passives) : null)
      });
    });

    const matchups = threats.map(function (t) {
      const mu = lookupMatchup(t, {
        myMeta: myMeta,
        myPage: myPage,
        myMatchups: input.myMatchups,
        enemyMatchups: input.enemyMatchups
      });
      return { enemy: t, edge: mu.edge, phase: mu.phase, reason: mu.reason };
    });
    result.matchups = matchups;
    const outlook = assessOutlook(threats, matchups, myMeta);
    const fragile = { count: agg.fragileCount, names: agg.fragileNames };
    const flags = deriveFlags(effSlots, myPage.snapshot, build.lane || '');
    result.outlook = outlook;
    result.priorities = globalRules({ agg: agg, slots: effSlots, build: build, mySnap: myPage.snapshot, outlook: outlook, fragile: fragile, isDamageDealer: flags.isDamageDealer });
    const extras = [];
    result.priorities.slice().sort(function (a, b) { return changeWeight(b) - changeWeight(a); }).forEach(function (p) {
      const target = itemsByName.get(p.item.toLowerCase()) || null;
      if (!target) return;
      const already = effSlots.some(function (s) { return s.item && s.item.slug === target.slug; }) ||
        changes.some(function (c) { return c.to === p.item; });
      if (already) return;
      const pick = pickChangeSlot(effSlots, used, target, build);
      if (!pick) { extras.push(p); return; }
      used.push(pick.index);
      changes.push({
        type: 'priorite',
        poste: pick.index,
        from: pick.base,
        to: p.item,
        toItem: target,
        delta: (target.cost || 0) - pick.cost,
        reason: p.why,
        title: p.title,
        triggers: p.triggers || [],
        effect: frEffect(p.item) || target.passives || null,
        slotHint: p.slotHint
      });
    });
    changes.sort(function (a, b) { return a.poste - b.poste; });
    result.changes = changes;
    result.extra = extras;
    result.watch = watch;
    result.plan = buildPlan({
      outlook: outlook,
      build: build,
      slots: effSlots,
      changes: changes,
      itemsByName: itemsByName,
      fragile: fragile,
      frontline: flags.frontline,
      myDmg: flags.myDmg,
      isDamageDealer: flags.isDamageDealer
    });
    result.progression = buildProgression(effSlots, matchups, threats);
    return result;
  }

  function pairEdge(aSlug, aMu, bSlug, bMu) {
    const out = { edge: null, phase: null, source: null };
    if (aMu && aMu.matchups) {
      const lists = [aMu.matchups.bestMatchups, aMu.matchups.worstMatchups];
      for (let i = 0; i < lists.length; i++) {
        const hit = (lists[i] || []).find(function (x) { return x.heroSlug === bSlug; });
        if (hit) {
          out.edge = hit.increaseWinRate * 100;
          out.phase = hit.winRateByDuration || null;
          out.source = 'a';
          return out;
        }
      }
    }
    if (bMu && bMu.matchups) {
      const lists = [bMu.matchups.bestMatchups, bMu.matchups.worstMatchups];
      for (let i = 0; i < lists.length; i++) {
        const hit = (lists[i] || []).find(function (x) { return x.heroSlug === aSlug; });
        if (hit) {
          out.edge = -hit.increaseWinRate * 100;
          const d = hit.winRateByDuration;
          out.phase = d ? { early: 1 - d.early, mid: 1 - d.mid, late: 1 - d.late } : null;
          out.source = 'b';
          return out;
        }
      }
    }
    return out;
  }

  const TIER_LOGIT = { S: 0.26, A: 0.15, B: 0.02, C: -0.11, D: -0.24 };

  const LANE_ROLES = {
    roam: ['Tank', 'Support'],
    exp: ['Fighter', 'Tank'],
    jungle: ['Assassin', 'Fighter'],
    mid: ['Mage', 'Assassin'],
    gold: ['Marksman']
  };

  const LANE_LABELS = {
    roam: 'Roamer / Tank',
    exp: 'Exp (voie solo)',
    jungle: 'Jungler',
    mid: 'Mid',
    gold: 'Gold / Marksman'
  };

  const ROLE_DMG = { Tank: 'mixte', Fighter: 'mixte', Assassin: 'phys', Mage: 'magic', Marksman: 'phys', Support: 'magic' };

  function laneLabel(key) { return LANE_LABELS[key] || key; }

  function lanesFor(meta) {
    const out = [];
    Object.keys(LANE_ROLES).forEach(function (k) {
      if ((meta.roles || []).some(function (r) { return LANE_ROLES[k].indexOf(r) !== -1; })) out.push(k);
    });
    return out;
  }

  function heroStrength(meta) {
    const w = meta && meta.winRate != null ? meta.winRate : 50;
    const cw = Math.min(49.5, Math.max(-49.5, w - 50));
    const base = Math.log((50 + cw) / (50 - cw));
    const tier = (meta && TIER_LOGIT[meta.tier]) || 0;
    return base + tier;
  }

  function damageOf(meta) {
    const counts = {};
    (meta.roles || []).forEach(function (r) {
      const d = ROLE_DMG[r];
      if (d) counts[d] = (counts[d] || 0) + 1;
    });
    if (counts.magic && counts.phys) return 'mixte';
    if (counts.magic) return 'magic';
    if (counts.phys) return 'phys';
    if (counts.mixte) return 'mixte';
    return 'util';
  }

  function compOf(list) {
    const roles = {};
    const dmg = { phys: 0, magic: 0, mixte: 0, util: 0 };
    list.forEach(function (x) {
      (x.meta.roles || []).forEach(function (r) { roles[r] = (roles[r] || 0) + 1; });
      const d = damageOf(x.meta);
      dmg[d] = (dmg[d] || 0) + 1;
    });
    const frontline = (roles.Tank || 0) + (roles.Support || 0);
    return {
      roles: roles,
      dmg: dmg,
      frontline: frontline,
      tank: roles.Tank || 0,
      support: roles.Support || 0,
      fighter: roles.Fighter || 0,
      assassin: roles.Assassin || 0,
      mage: roles.Mage || 0,
      marksman: roles.Marksman || 0
    };
  }

  function compBalance(c) {
    let s = 0;
    if (c.frontline === 0) s -= 0.40;
    else if (c.frontline >= 2) s += 0.22;
    else s += 0.10;
    if (c.fighter >= 2) s += 0.06;
    const carries = (c.mage || 0) + (c.marksman || 0) + (c.assassin || 0);
    if (carries >= 2) s += 0.08;
    if (c.dmg.phys >= 4 || c.dmg.magic >= 4) s -= 0.12;
    if (c.dmg.phys >= 1 && c.dmg.magic >= 1) s += 0.06;
    return s;
  }

  function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

  function simulateTeam(input) {
    const allies = (input.allies || []).filter(function (x) { return x && x.meta; });
    const enemies = (input.enemies || []).filter(function (x) { return x && x.meta; });
    const avgWR = function (arr) {
      const v = arr.map(function (x) { return x.meta && x.meta.winRate; }).filter(function (n) { return n != null; });
      return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null;
    };
    const aStrSum = allies.reduce(function (s, x) { return s + heroStrength(x.meta); }, 0);
    const eStrSum = enemies.reduce(function (s, x) { return s + heroStrength(x.meta); }, 0);
    const n = Math.max(1, Math.max(allies.length, enemies.length));
    const metaDiff = (aStrSum - eStrSum) / n;
    const META_K = 1.6;
    const metaL = META_K * metaDiff;

    const duels = [];
    let edgeSum = 0;
    let edgeCount = 0;
    const phaseAcc = { early: [], mid: [], late: [] };
    allies.forEach(function (a) {
      enemies.forEach(function (e) {
        const pe = pairEdge(a.slug, a.matchups, e.slug, e.matchups);
        if (pe.edge == null) return;
        edgeSum += pe.edge;
        edgeCount++;
        duels.push({ ally: a.meta, enemy: e.meta, edge: pe.edge, phase: pe.phase || null });
        if (pe.phase) {
          ['early', 'mid', 'late'].forEach(function (k) { if (pe.phase[k] != null) phaseAcc[k].push(pe.phase[k]); });
        }
      });
    });
    const avgEdge = edgeCount ? edgeSum / edgeCount : null;
    const DUEL_K = 0.11;
    const duelL = avgEdge != null ? avgEdge * DUEL_K : 0;

    const allyComp = compOf(allies);
    const enemyComp = compOf(enemies);
    const compL = compBalance(allyComp) - compBalance(enemyComp);

    const L = metaL + duelL + compL;
    const pAlly = sigmoid(L);
    let verdict = 'equilibre';
    if (pAlly >= 0.58) verdict = 'avantage';
    else if (pAlly <= 0.42) verdict = 'desavantage';

    duels.sort(function (a, b) { return Math.abs(b.edge) - Math.abs(a.edge); });
    const phaseAvg = {};
    ['early', 'mid', 'late'].forEach(function (k) {
      const arr = phaseAcc[k];
      phaseAvg[k] = arr.length ? arr.reduce(function (a, b) { return a + b; }, 0) / arr.length : null;
    });

    return {
      pAlly: pAlly,
      pEnemy: 1 - pAlly,
      verdict: verdict,
      L: L,
      meta: { allyAvgWR: avgWR(allies), enemyAvgWR: avgWR(enemies), diff: metaDiff, logit: metaL },
      duel: { avg: avgEdge, count: edgeCount, logit: duelL },
      comp: { ally: allyComp, enemy: enemyComp, logit: compL },
      phases: phaseAvg,
      duels: duels,
      allyCount: allies.length,
      enemyCount: enemies.length
    };
  }

  function suggestCounters(input) {
    const enemies = (input.enemies || []).filter(function (x) { return x && x.meta; });
    const heroes = input.heroes;
    const exclude = (input.exclude || []).map(function (s) { return String(s).toLowerCase(); });
    const roleKey = input.roleKey || null;
    const roleSet = roleKey && LANE_ROLES[roleKey] ? LANE_ROLES[roleKey] : null;
    const pool = new Map();

    function ensure(slug) {
      let c = pool.get(slug);
      if (!c) { c = { slug: slug, score: 0, counters: [], loses: [] }; pool.set(slug, c); }
      return c;
    }

    enemies.forEach(function (e) {
      const ew = 1 + ((e.meta && e.meta.banRate) ? Math.min(0.4, e.meta.banRate / 100) : 0);
      const ej = e.matchups;
      if (!ej || !ej.matchups) return;
      (ej.matchups.worstMatchups || []).forEach(function (hit) {
        const adv = -hit.increaseWinRate * 100;
        const c = ensure(hit.heroSlug);
        c.score += adv * ew;
        c.counters.push({ enemy: e.meta, edge: adv });
      });
      (ej.matchups.bestMatchups || []).forEach(function (hit) {
        const dis = hit.increaseWinRate * 100;
        const c = ensure(hit.heroSlug);
        c.score -= dis * ew;
        c.loses.push({ enemy: e.meta, edge: -dis });
      });
    });

    const out = [];
    pool.forEach(function (c) {
      const meta = heroes.get(c.slug);
      if (!meta) return;
      if (exclude.indexOf(c.slug) !== -1) return;
      if (roleSet && !(meta.roles || []).some(function (r) { return roleSet.indexOf(r) !== -1; })) return;
      const metaBonus = (meta.winRate != null ? (meta.winRate - 50) * 0.35 : 0) + (TIER_LOGIT[meta.tier] || 0) * 12;
      c.meta = meta;
      c.enemyScore = c.score;
      c.metaScore = metaBonus;
      c.total = c.score + metaBonus;
      c.netCounters = c.counters.length - c.loses.length;
      out.push(c);
    });
    out.sort(function (a, b) { return b.total - a.total; });
    return out;
  }

  return {
    parseHeroes: parseHeroes,
    parseItems: parseItems,
    parseHeroPage: parseHeroPage,
    itemFlags: itemFlags,
    matchCondition: matchCondition,
    frCondition: frCondition,
    frEffect: frEffect,
    buildProgression: buildProgression,
    pairEdge: pairEdge,
    heroStrength: heroStrength,
    lanesFor: lanesFor,
    laneLabel: laneLabel,
    damageOf: damageOf,
    simulateTeam: simulateTeam,
    suggestCounters: suggestCounters,
    analyze: analyze
  };
});
