'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const CACHE_DIR = path.join(__dirname, 'data', 'cache');
const TTL_MS = 24 * 60 * 60 * 1000;
const SLUG_RE = /^[a-z0-9-]{1,64}$/;
const OFFLINE = process.env.OFFLINE === '1' || process.env.OFFLINE === 'true';
const BACKOFF_MS = 15 * 60 * 1000;

fs.mkdirSync(CACHE_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function upstream(url, redirects) {
  redirects = redirects || 0;
  return new Promise(function (resolve, reject) {
    if (OFFLINE) {
      reject(new Error('mode hors-ligne'));
      return;
    }
    if (redirects > 3) {
      reject(new Error('too many redirects'));
      return;
    }
    const lib = url.startsWith('https:') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'DraftMLBB-local/1.0', Accept: '*/*' } }, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        upstream(new URL(res.headers.location, url).href, redirects + 1).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error('HTTP ' + res.statusCode));
        return;
      }
      const chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () { resolve(Buffer.concat(chunks)); });
    });
    req.on('error', reject);
    req.setTimeout(20000, function () { req.destroy(new Error('timeout')); });
  });
}

function apiTarget(pathname) {
  const m = pathname.match(/^\/api\/(heroes|items|stats|hero|matchups)(?:\/([a-z0-9-]+))?$/);
  if (!m) return null;
  const kind = m[1];
  const slug = m[2] || '';
  if ((kind === 'hero' || kind === 'matchups') && !SLUG_RE.test(slug)) return null;
  if (kind === 'heroes') return 'https://mlbbhub.com/md/heroes';
  if (kind === 'items') return 'https://mlbbhub.com/md/items';
  if (kind === 'stats') return 'https://mlbbhub.com/api/stats';
  if (kind === 'hero') return 'https://mlbbhub.com/md/heroes/' + slug;
  return 'https://mlbbhub.com/api/stats/' + slug + '?matchups=true';
}

function cacheFileFor(target) {
  return path.join(CACHE_DIR, target.replace(/[^a-z0-9]+/gi, '_') + '.cache');
}

function offlineMarkerFor(target) {
  return cacheFileFor(target) + '.offline';
}

function inBackoff(target) {
  if (OFFLINE) return true;
  try {
    const st = fs.statSync(offlineMarkerFor(target));
    return Date.now() - st.mtimeMs < BACKOFF_MS;
  } catch (e) { return false; }
}

function markOffline(target) {
  try { fs.writeFileSync(offlineMarkerFor(target), ''); } catch (e) {}
}

function clearOffline(target) {
  try { fs.unlinkSync(offlineMarkerFor(target)); } catch (e) {}
}

const PORTRAITS_JSON = path.join(PUBLIC_DIR, 'img', 'portraits.json');
let portraitMap = null;

function loadPortraitMap() {
  if (portraitMap) return portraitMap;
  try { portraitMap = JSON.parse(fs.readFileSync(PORTRAITS_JSON, 'utf8')); } catch (e) { portraitMap = {}; }
  return portraitMap;
}

async function savePortraitLocal(slug, url) {
  if (!url || !slug) return null;
  const map = loadPortraitMap();
  if (map[slug]) return map[slug];
  try {
    const buf = await upstream(url);
    const ext = (url.split('?')[0].split('.').pop() || 'webp').toLowerCase();
    const dir = path.join(PUBLIC_DIR, 'img', 'portraits');
    await fs.promises.mkdir(dir, { recursive: true });
    const name = slug + '.' + ext;
    await fs.promises.writeFile(path.join(dir, name), buf);
    map[slug] = '/img/portraits/' + name;
    await fs.promises.writeFile(PORTRAITS_JSON, JSON.stringify(map, null, 2));
    return map[slug];
  } catch (e) {
    return null;
  }
}

async function fetchCached(target) {
  const file = cacheFileFor(target);
  let fresh = false;
  try {
    const st = await fs.promises.stat(file);
    fresh = Date.now() - st.mtimeMs < TTL_MS;
  } catch (e) { fresh = false; }
  if (fresh) {
    return { body: await fs.promises.readFile(file), cache: 'HIT' };
  }
  if (inBackoff(target)) {
    try {
      return { body: await fs.promises.readFile(file), cache: 'STALE' };
    } catch (e) { /* fallthrough */ }
  }
  try {
    const body = await upstream(target);
    await fs.promises.writeFile(file, body);
    clearOffline(target);
    return { body: body, cache: 'MISS' };
  } catch (err) {
    markOffline(target);
    try {
      return { body: await fs.promises.readFile(file), cache: 'STALE' };
    } catch (e2) {
      throw err;
    }
  }
}

async function handleApi(target, res) {
  const type = contentTypeFor(target);
  try {
    const r = await fetchCached(target);
    send(res, 200, r.body, type, r.cache);
  } catch (err) {
    send(res, 502, JSON.stringify({ error: 'upstream indisponible: ' + err.message }), 'application/json; charset=utf-8', 'NONE');
  }
}

async function handleHero(slug, res) {
  try {
    const md = await fetchCached('https://mlbbhub.com/md/heroes/' + slug);
    let portrait = loadPortraitMap()[slug] || null;
    let remote = null;
    try {
      const html = await fetchCached('https://mlbbhub.com/heroes/' + slug);
      const m = html.body.toString('utf8').match(/\\"portraitUrl\\":\\"(https:[^\\"]+)\\"/);
      if (m) remote = m[1];
    } catch (e) { /* portrait best-effort */ }
    if (!portrait && remote) portrait = await savePortraitLocal(slug, remote);
    if (!portrait) portrait = remote;
    send(res, 200, JSON.stringify({ md: md.body.toString('utf8'), portrait: portrait }), 'application/json; charset=utf-8', md.cache);
  } catch (err) {
    send(res, 502, JSON.stringify({ error: 'upstream indisponible: ' + err.message }), 'application/json; charset=utf-8', 'NONE');
  }
}

function contentTypeFor(target) {
  return target.indexOf('/md/') !== -1
    ? 'text/markdown; charset=utf-8'
    : 'application/json; charset=utf-8';
}

function send(res, status, body, type, cache) {
  const headers = { 'Content-Type': type, 'X-Draft-MLBB-Cache': cache || 'NONE' };
  if (type.indexOf('json') === -1 && type.indexOf('markdown') === -1) {
    headers['Cache-Control'] = 'no-cache';
  }
  res.writeHead(status, headers);
  res.end(body);
}

function serveStatic(pathname, res) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (file !== PUBLIC_DIR && file.indexOf(PUBLIC_DIR + path.sep) !== 0) {
    send(res, 403, 'Forbidden', 'text/plain; charset=utf-8', 'NONE');
    return;
  }
  fs.readFile(file, function (err, data) {
    if (err) {
      send(res, 404, 'Not found', 'text/plain; charset=utf-8', 'NONE');
      return;
    }
    send(res, 200, data, MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'STATIC');
  });
}

function serveImg(pathname, res) {
  const m = pathname.match(/^\/img\/([a-z]+)\/([A-Za-z0-9._-]+)$/);
  if (!m) { send(res, 404, 'Not found', 'text/plain; charset=utf-8', 'NONE'); return; }
  const dir = m[1];
  const name = m[2];
  if (name.indexOf('..') !== -1) { send(res, 403, 'Forbidden', 'text/plain; charset=utf-8', 'NONE'); return; }
  const base = path.join(PUBLIC_DIR, 'img', dir);
  const fsPath = path.normalize(path.join(base, name));
  if (fsPath.indexOf(base + path.sep) !== 0) {
    send(res, 403, 'Forbidden', 'text/plain; charset=utf-8', 'NONE');
    return;
  }
  fs.readFile(fsPath, function (err, data) {
    if (err) { send(res, 404, 'Not found', 'text/plain; charset=utf-8', 'NONE'); return; }
    const ext = path.extname(fsPath).toLowerCase();
    send(res, 200, data, MIME[ext] || 'application/octet-stream', 'STATIC');
  });
}

const server = http.createServer(function (req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    send(res, 400, 'Bad request', 'text/plain; charset=utf-8', 'NONE');
    return;
  }
  if (pathname.indexOf('/api/') === 0) {
    const heroM = pathname.match(/^\/api\/hero\/([a-z0-9-]+)$/);
    if (heroM) {
      handleHero(heroM[1], res).catch(function (err) {
        send(res, 500, JSON.stringify({ error: err.message }), 'application/json; charset=utf-8', 'NONE');
      });
      return;
    }
    const target = apiTarget(pathname);
    if (!target) {
      send(res, 404, JSON.stringify({ error: 'route inconnue' }), 'application/json; charset=utf-8', 'NONE');
      return;
    }
    handleApi(target, res).catch(function (err) {
      send(res, 500, JSON.stringify({ error: err.message }), 'application/json; charset=utf-8', 'NONE');
    });
    return;
  }
  if (pathname.indexOf('/img/') === 0) { serveImg(pathname, res); return; }
  if (pathname === '/images' || pathname.indexOf('/images/') === 0) {
    const p2 = pathname.replace(/^\/images/, '/img');
    serveImg(p2, res);
    return;
  }
  serveStatic(pathname, res);
});

server.listen(PORT, function () {
  console.log('Draft MLBB advisor -> http://localhost:' + PORT);
});
