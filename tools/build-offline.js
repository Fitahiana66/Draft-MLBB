'use strict';

/*
 * Synchronise TOUTES les donnees mlbbhub en local pour un usage hors-ligne.
 *  - data/cache/          : pages hero (md), matchups JSON, heroes list, items list
 *  - public/img/portraits : portraits  (public/img/portraits/<slug>.<ext>)
 *  - public/img/items     : icons d'items
 *  - public/img/emblems   : icons d'emblems
 *  - public/img/spells    : icons de battle spells
 *  - public/img/talents   : icons de talents
 *  - public/img/portraits.json : manifeste { slug -> /img/portraits/<slug>.<ext> }
 *
 * Usage : node tools/build-offline.js
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'data', 'cache');
const IMG_DIR = path.join(ROOT, 'public', 'img');
const CONCURRENCY = 6;
const PORT = Number(process.env.PORT) || 3000;

function cacheFileFor(target) {
  return path.join(CACHE_DIR, target.replace(/[^a-z0-9]+/gi, '_') + '.cache');
}

function rawGet(url, binary) {
  return new Promise(function (resolve, reject) {
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'DraftMLBB-local/1.0', Accept: '*/*' } }, function (res) {
      if (res.statusCode < 200 || res.statusCode >= 400) {
        res.resume();
        reject(new Error('HTTP ' + res.statusCode));
        return;
      }
      const chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        const buf = Buffer.concat(chunks);
        resolve(binary ? buf : buf.toString('utf8'));
      });
    });
    req.on('error', reject);
    req.setTimeout(25000, function () { req.destroy(new Error('timeout')); });
  });
}

async function cached(url) {
  const file = cacheFileFor(url);
  if (fs.existsSync(file)) {
    return { body: await fs.promises.readFile(file), fromCache: true };
  }
  const body = await rawGet(url, true);
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  await fs.promises.writeFile(file, body);
  return { body: body, fromCache: false };
}

async function cachedText(url) {
  const r = await cached(url);
  return r.body.toString('utf8');
}

function kebab(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/['"’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function pool(tasks, limit) {
  const results = [];
  let i = 0;
  let fails = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      try {
        results[idx] = await tasks[idx]();
      } catch (e) {
        fails++;
        results[idx] = { error: e.message };
      }
    }
  }
  const workers = [];
  for (let w = 0; w < Math.min(limit, tasks.length || 1); w++) workers.push(worker());
  await Promise.all(workers);
  return { results: results, fails: fails };
}

function slugify(s) { return kebab(s); }

async function downloadIcon(type, slug, ext) {
  const dir = path.join(IMG_DIR, type);
  const out = path.join(dir, slug + (ext || '.png'));
  if (fs.existsSync(out)) return { ok: true, skipped: true };
  const url = 'https://mlbbhub.com/images/' + type + '/' + slug + (ext || '.png');
  const buf = await rawGet(url, true);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(out, buf);
  return { ok: true };
}

async function downloadPortrait(slug, url) {
  const dir = path.join(IMG_DIR, 'portraits');
  const ext = (url.split('?')[0].split('.').pop() || 'webp').toLowerCase();
  const out = path.join(dir, slug + '.' + ext);
  if (fs.existsSync(out)) return '/img/portraits/' + slug + '.' + ext;
  const buf = await rawGet(url, true);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(out, buf);
  return '/img/portraits/' + slug + '.' + ext;
}

function parsePortraitUrl(html) {
  const m = html.match(/portraitUrl\\?":\\?"(https:[^\\"]+)/);
  return m ? m[1] : null;
}

function parseBuildRefs(md) {
  const refs = { emblems: [], spells: [], talents: [], items: [] };
  const seen = { e: {}, s: {}, t: {}, i: {} };
  (md.match(/- Emblem:\s*([^\n]+)/g) || []).forEach(function (line) {
    const body = line.replace(/^- Emblem:\s*/, '').trim();
    const parts = body.split(/\s+with\s+/);
    const emb = parts[0].trim();
    if (emb && !seen.e[emb]) { seen.e[emb] = 1; refs.emblems.push(emb); }
    if (parts[1]) {
      parts[1].split(',').forEach(function (t) {
        t = t.replace(/\*\*/g, '').trim();
        if (t && !seen.t[t]) { seen.t[t] = 1; refs.talents.push(t); }
      });
    }
  });
  (md.match(/- Battle spell:\s*([^\n]+)/g) || []).forEach(function (line) {
    const s = line.replace(/^- Battle spell:\s*/, '').replace(/\*\*/g, '').trim();
    if (s && !seen.s[s]) { seen.s[s] = 1; refs.spells.push(s); }
  });
  (md.match(/https:\/\/mlbbhub\.com\/items\/([a-z0-9-]+)/g) || []).forEach(function (u) {
    const s = u.split('/').pop();
    if (!seen.i[s]) { seen.i[s] = 1; refs.items.push(s); }
  });
  return refs;
}

function emblemSlug(name) {
  const first = String(name || '').split(/\s+/)[0];
  return kebab(first);
}

async function main() {
  console.log('== Draft MLBB : sync hors-ligne ==');
  await fs.promises.mkdir(CACHE_DIR, { recursive: true });

  console.log('1/6 pages de base (heroes list, items list, stats)');
  const heroesMd = await cachedText('https://mlbbhub.com/md/heroes');
  const itemsMd = await cachedText('https://mlbbhub.com/md/items');
  await cached('https://mlbbhub.com/api/stats');

  const heroSlugs = [...new Set([...heroesMd.matchAll(/https:\/\/mlbbhub\.com\/heroes\/([a-z0-9-]+)/g)].map(function (m) { return m[1]; }))];
  const itemSlugs = [...new Set([...itemsMd.matchAll(/https:\/\/mlbbhub\.com\/items\/([a-z0-9-]+)/g)].map(function (m) { return m[1]; }))];
  console.log('    heroes=' + heroSlugs.length + ' items=' + itemSlugs.length);

  console.log('2/6 pages hero (md) + JSON matchups');
  const pageRes = await pool(heroSlugs.map(function (s) {
    return async function () {
      await cachedText('https://mlbbhub.com/md/heroes/' + s);
      await cached('https://mlbbhub.com/api/stats/' + s + '?matchups=true');
      return s;
    };
  }), CONCURRENCY);
  console.log('    pages OK=' + pageRes.results.filter(Boolean).length + ' echecs=' + pageRes.fails);

  console.log('3/6 portraits');
  const manifest = {};
  const portraitTasks = heroSlugs.map(function (s) {
    return async function () {
      let html;
      try { html = await cachedText('https://mlbbhub.com/heroes/' + s); } catch (e) { return null; }
      const url = parsePortraitUrl(html);
      if (!url) return null;
      const rel = await downloadPortrait(s, url);
      manifest[s] = rel;
      return s;
    };
  });
  const portraitRes = await pool(portraitTasks, CONCURRENCY);
  await fs.promises.writeFile(path.join(IMG_DIR, 'portraits.json'), JSON.stringify(manifest, null, 2));
  console.log('    portraits OK=' + Object.keys(manifest).length + ' echecs=' + portraitRes.fails);

  console.log('4/6 icons d\'items');
  const itemRes = await pool(itemSlugs.map(function (s) {
    return async function () { await downloadIcon('items', s); return s; };
  }), CONCURRENCY);
  console.log('    items OK=' + itemRes.results.filter(Boolean).length + ' echecs=' + itemRes.fails);

  console.log('5/6 emblems + spells + talents (depuis les builds)');
  const emblems = {}, spells = {}, talents = {};
  for (let i = 0; i < heroSlugs.length; i++) {
    let md;
    try { md = await cachedText('https://mlbbhub.com/md/heroes/' + heroSlugs[i]); } catch (e) { continue; }
    const refs = parseBuildRefs(md);
    refs.emblems.forEach(function (e) { emblems[emblemSlug(e)] = 1; });
    refs.spells.forEach(function (s) { spells[slugify(s)] = 1; });
    refs.talents.forEach(function (t) { talents[slugify(t)] = 1; });
  }
  console.log('    emblems=' + Object.keys(emblems).length + ' spells=' + Object.keys(spells).length + ' talents=' + Object.keys(talents).length);
  const iconRes = await pool(
    Object.keys(emblems).map(function (s) { return function () { return downloadIcon('emblems', s); }; })
      .concat(Object.keys(spells).map(function (s) { return function () { return downloadIcon('spells', s); }; }))
      .concat(Object.keys(talents).map(function (s) { return function () { return downloadIcon('talents', s); }; }))
    , CONCURRENCY);
  console.log('    icons OK=' + iconRes.results.filter(Boolean).length + ' echecs=' + iconRes.fails);
  iconRes.results.forEach(function (r, idx) {
    if (r && r.error) {
      const all = Object.keys(emblems).map(function (s) { return 'emblems/' + s; })
        .concat(Object.keys(spells).map(function (s) { return 'spells/' + s; }))
        .concat(Object.keys(talents).map(function (s) { return 'talents/' + s; }));
      console.log('      ! ' + all[idx] + ' -> ' + r.error);
    }
  });

  console.log('6/6 recapitulatif');
  const count = function (d) {
    try { return fs.readdirSync(path.join(IMG_DIR, d)).length; } catch (e) { return 0; }
  };
  console.log('    portraits=' + count('portraits') + ' items=' + count('items') +
    ' emblems=' + count('emblems') + ' spells=' + count('spells') + ' talents=' + count('talents'));
  console.log('    cache fichiers=' + fs.readdirSync(CACHE_DIR).length);
  console.log('Termine. Relance "node server.js" puis test en mode OFFLINE=1.');
}

main().catch(function (e) {
  console.error('ECHEC sync hors-ligne :', (e && e.message) || e);
  if (e && e.stack) console.error(e.stack);
  process.exit(1);
});
