# Draft MLBB Advisor

Application web locale (FR) pour préparer ses drafts Mobile Legends : **Build adaptatif**, **Simulateur 5v5** et **Pick & Ban** avec compteurs suggérés.  
Données issues de [mlbbhub.com](https://mlbbhub.com), **synchronisées en local** → fonctionne **100 % hors ligne**.

---

## Démarrage

```bash
node server.js        # http://localhost:3000
```
Aucune dépendance npm à installer (Node ≥ 18).

- **Mode hors ligne forcé** (jamais d’appel réseau) :
  ```bash
  OFFLINE=1 node server.js          # macOS / Linux
  set OFFLINE=1 && node server.js   # Windows (cmd)
  ```
- **Port personnalisé** : `PORT=8080 node server.js`

---

## Les 3 pages

| Page | URL | Rôle |
|------|-----|------|
| **Conseiller de build** | `/` (index.html) | Build + ajustements selon l’équipe adverse |
| **Simulateur 5v5** | `/simulateur.html` | Taux de victoire de deux équipes de 5 |
| **Pick & Ban** | `/pick.html` | 5 meilleurs contres selon le rôle et les ennemis |

Navigation commune en haut de chaque page.

### 1. Conseiller de build (`/`)
- Renseigne **ton héros** + les **ennemis** (et tes alliés).
- Affiche **build mlbbhub** de référence pour ce héros/voie, avec **variantes d’emblème/talents** cliquables et sélection du **talent core**.
- **Ajustements** : items remplacés par des contre-mesures (anti-soin, anti-crit, anti-shield, défense magique/physique…), selon les menaces identifiées.
- **Plan** d’achat (rush items) + **conditions** (« si 2+ tanks… ») + **progression par paliers**.
- Glossaire (voies, talents core, archétypes).

### 2. Simulateur 5v5 (`/simulateur.html`)
- Deux équipes de 5 héros ; `Simuler`, `Échanger`, `Effacer`.
- Barre de **probabilité de victoire** + verdict (avantage / désavantage).
- Cartes explicatives : **Méta**, **Duels**, **Composition**, **Phases** (early/mid/late).
- Lien direct « Build → » vers le conseiller pour chaque héros.

### 3. Pick & Ban (`/pick.html`)
- Choix du **rôle** (Roam / EXP / Jungle / Mid / Gold / Tous).
- Renseigne les **ennemis** (et ton équipe déjà prise).
- Propose **5 contre-suggérés** (score = meta + avantage direct vérifié dans les deux sens).
- **Filtre par voie réelle** du héros (données mlbbhub), avec repli automatique sur tous rôles si aucun contre dédié.
- Bouton **Build →** vers le conseiller (analyse lancée automatiquement à l’arrivée).

---

## Modèle de recommandation

- **Meta** : log-odds autour de 50 % (WR/PR/BR) + bonus de tier (S→D).
- **Duels** : avantage moyen (en points de percentage) entre ton héros et les ennemis, lu dans les deux sens (ton profil + profil de l’ennemi ; le second est inversé).
- **Composition** : équilibre dégâts (physique/magique/vrai) et besoins d’équipe.
- **Phases** : early / mid / late d’après `winRateByDuration`.
- Le moteur est 100 % côté client (`engine.js`), testé par harnais Node.

---

## Structure du projet

```
server.js              Proxy + cache + mode hors-ligne + route /img/
public/
  index.html           Conseiller de build
  simulateur.html      Simulateur 5v5
  pick.html            Pick & Ban
  app.js               UI du conseiller (build, variantes, ajustements)
  simulateur.js        Logique du simulateur
  pick.js              Logique du Pick & Ban
  engine.js            Moteur d’analyse (parsers mlbbhub, analyse, duels, simulateur, compteurs)
  common.js            Helpers partagés (portraits, voies, résolution de noms)
  fr.js                Dictionnaire FR (items, talents, emblèmes, textes)
  style.css            Feuille de style unique (thème sombre + nav)
  img/                 Images locales
    portraits/{slug}.webp   Portraits héros
    items/{slug}.png        Icônes d’items
    emblems/{slug}.png      Icônes d’emblèmes
    spells/{slug}.png       Icônes de battle spells
    talents/{slug}.png      Icônes de talents
    portraits.json          Manifeste { slug → chemin local }
data/cache/            Cache des réponses mlbbhub (pages, stats, matchups)
tools/build-offline.js Synchronisation complète des données + images en local
```

---

## API interne

| Route | Retour |
|-------|--------|
| `GET /api/heroes` | Index des héros (WR/PR/BR, tier, rôles) |
| `GET /api/items` | Catalogue d’items |
| `GET /api/stats` | Statistiques globales |
| `GET /api/stats/{slug}?matchups=true` | Profil détaillé d’un héros |
| `GET /api/matchups/{slug}` | Duels (best/worst matchups) |
| `GET /api/hero/{slug}` | Fiche markdown + portrait local |
| `GET /img/{type}/{fichier}` | Image locale (portrait, item, emblem, spell, talent) |

Toutes les réponses API portent l’en-tête `X-Draft-MLBB-Cache` : `HIT` (cache frais), `MISS` (venu du réseau), `STALE` (cache ancien utilisé hors-ligne), `STATIC`.

---

## Hors-ligne

L’application est **entièrement locale** après la première synchronisation :
- **Données** : `data/cache/` (pages héros, stats, matchups).
- **Images** : `public/img/` (portraits, icônes).

Au premier accès, le serveur met en cache les réponses réseau (TTL 24 h) et télécharge au besoin les portraits/icônes manquants.  
Si Internet tombe : les données du cache sont servies en `STALE` sans blocage (backoff 15 min).

### Mettre à jour les données
```bash
node tools/build-offline.js   # nécessite Internet
# puis redémarrer le serveur
node server.js
```
Le script resynchronise : héros, items, matchups, portraits, icônes (emblèmes / sorts / talents).

---

## Notes techniques

- **Stack** : Node.js natif (`http`/`https`/`fs`), **zéro dépendance**, front vanilla JS (pas de framework).
- **Sémantique des duels** : `increaseWinRate` = swing en points de percentage du point de vue du héros de la page ; les *bestMatchups* sont positifs, les *worstMatchups* négatifs. Un duel lu depuis le profil de l’ennemi est inversé pour rester cohérent.
- **Portraits** : URL récupérée depuis la fiche mlbbhub, puis stockée en local (`.webp`) et référencée par le manifeste `public/img/portraits.json`.
- **Voies** : champ `- Lane:` de la fiche héros + voies des builds — source fiable pour le filtre de rôle du Pick & Ban.
- **Noms de héros** restent en anglais ; l’interface est en français.

---

## Tests

Harnais Node sans navigateur (stubs DOM/fetch) permettant de valider le rendu et la logique des 3 pages sans ouvrir le navigateur.

| Script | Ce qu’il vérifie |
|--------|------------------|
| `node test-engine.js` | Moteur d’analyse : TOTAL = données curées |
| `node test-render.js` | Rendu des sections du conseiller (pas d’`undefined`) |
| `node test-emblem.js` | Mapping emblèmes / talents |
| `node test-pages.js` | Page Pick & Ban (rôles, voies, pas d’`undefined`/`NaN`) |
| `node test-live.js` | Parcours complet via le serveur local |

> Les scripts de test sont des outils de développement (hors dépôt) et s’appuient sur les caches locaux de `data/cache/` — ils ne nécessitent donc **aucun accès réseau**.

---

## Crédits

Données et builds : [mlbbhub.com](https://mlbbhub.com) (patch, tiers, WR/PR/BR, matchups, builds). Application locale indépendante, sans lien avec Moonton.
