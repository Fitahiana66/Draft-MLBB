'use strict';

(function (root) {
  const items = {
    'Allow Throw': 'Allow Throw',
    'Antique Cuirass': 'Cuirasse antique',
    'Arcane Boots': 'Bottes arcaniques',
    'Ares Belt': "Ceinture d'Arès",
    'Athena\'s Shield': 'Bouclier d\'Athéna',
    'Azure Blade': 'Lame azurée',
    'Berserker\'s Fury': 'Fureur du Berserker',
    'Black Ice Shield': 'Bouclier de glace noire',
    'Blade Armor': 'Armure de lames',
    'Blade of Despair': 'Lame du désespoir',
    'Blade of the Heptaseas': 'Lame des Heptases',
    'Blood Wings': 'Ailes de sang',
    'Bloody Retribution': 'Rétribution sanglante',
    'Book of Sages': 'Livre des sages',
    'Boots': 'Bottes',
    'Broken Heart': 'Cœur brisé',
    'Brute Force Breastplate': 'Plastron de force brute',
    'Chastise Pauldron': 'Épaulière de châtiment',
    'Clock of Destiny': 'Horloge du destin',
    'Conceal': 'Dissimulation',
    'Concentrated Energy': 'Énergie concentrée',
    'Corrosion Scythe': 'Faux de corrosion',
    'Cursed Helmet': 'Casque maudit',
    'Dagger': 'Dague',
    'Demon Boots': 'Bottes du démon',
    'Demon Hunter Sword': 'Épée du chasseur de démons',
    'Dire Hit': 'Dire Hit',
    'Divine Glaive': 'Glaive divin',
    'Dominance Ice': 'Glace dominatrice',
    'Dreadnaught Armor': 'Dreadnaught Armor',
    'Elegant Gem': 'Gemme élégante',
    'Enchanted Talisman': 'Talisman enchanté',
    'Encourage': 'Encouragement',
    'Endless Battle': 'Bataille sans fin',
    'Exotic Veil': 'Voile exotique',
    'Expert Gloves': 'Gants d\'expert',
    'Favor': 'Faveur',
    'Feather of Heaven': 'Plume du ciel',
    'Flame Retribution': 'Rétribution de flammes',
    'Flask of the Oasis': 'Fiole de l\'oasis',
    'Fleeting Time': 'Temps fugace',
    'Flower of Hope': 'Fleur d\'espoir',
    'Fury Hammer': 'Marteau de fureur',
    'Genius Wand': 'Baguette du génie',
    'Glowing Wand': 'Baguette incandescente',
    'Golden Staff': 'Bâton doré',
    'Great Dragon Spear': 'Lance du grand dragon',
    'Guardian Helmet': 'Casque de gardien',
    'Haas\'s Claws': 'Griffes de Haas',
    'Healing Necklace': 'Collier de soin',
    'Hero\'s Ring': 'Anneau du héros',
    'Holy Crystal': 'Cristal sacré',
    'Hunter Strike': 'Frappe du chasseur',
    'Ice Queen Wand': 'Baguette de la reine des glaces',
    'Ice Retribution': 'Rétribution glacée',
    'Immortality': 'Immortalité',
    'Iron Hunting Bow': 'Arc de chasse de fer',
    'Javelin': 'Javelot',
    'Knife': 'Couteau',
    'Lantern of Hope': 'Lanterne de l\'espoir',
    'Leather Jerkin': 'Veste de cuir',
    'Legion Sword': 'Épée de légion',
    'Lightning Truncheon': 'Bâton de la foudre',
    'Magic Blade': 'Lame magique',
    'Magic Boots': 'Bottes magiques',
    'Magic Necklace': 'Collier magique',
    'Magic Potion': 'Potion magique',
    'Magic Resist Cloak': 'Cape de résistance magique',
    'Magic Wand': 'Baguette magique',
    'Malefic Gun': 'Pistolet maléfique',
    'Malefic Roar': 'Rugissement maléfique',
    'Molten Essence': 'Essence en fusion',
    'Mystery Codex': 'Codex mystique',
    'Mystic Container': 'Contenant mystique',
    'Ogre Tomahawk': 'Tomahawk d\'ogre',
    'Oracle': 'Oracle',
    'Power Crystal': 'Cristal de puissance',
    'Power Potion': 'Potion de puissance',
    'Queen\'s Wings': 'Ailes de la reine',
    'Radiant Armor': 'Armure radieuse',
    'Rapid Boots': 'Bottes de rapidité',
    'Regular Spear': 'Lance ordinaire',
    'Rock Potion': 'Potion de roche',
    'Rogue Meteor': 'Météore errant',
    'Rose Gold Meteor': 'Météore d\'or rose',
    'Sea Halberd': 'Lame des sept mers',
    'Silence Robe': 'Robe du silence',
    'Sky Piercer': 'Perce-ciel',
    'Starlium Scythe': 'Faux starlium',
    'Steel Legplates': 'Jambières d\'acier',
    'Swift Boots': 'Bottes rapides',
    'Swift Crossbow': 'Arbalète rapide',
    'Throw Forbidden': 'Throw Forbidden',
    'Thunder Belt': 'Ceinture de tonnerre',
    'Tome of Evil': 'Tome du mal',
    'Tough Boots': 'Bottes robustes',
    'Vampire Mallet': 'Masse du vampire',
    'Vitality Crystal': 'Cristal de vitalité',
    'War Axe': 'Hache de guerre',
    'Warrior Boots': 'Bottes de guerrier',
    'Wind of Nature': 'Vent de la nature',
    'Windtalker': 'Parle-vent',
    'Winter Crown': 'Bâton d\'hiver',
    'Wishing Lantern': 'Lanterne des souhaits'
  };

  const talents = {
    'Rupture': 'Rupture',
    'Firmness': 'Fermeté',
    'Vitality': 'Vitalité',
    'Tenacity': 'Ténacité',
    'Festival of Blood': 'Festival de sang',
    'Brave Smite': 'Frappe vaillante',
    'Concussive Blast': 'Onde de choc',
    'Weapon Master': 'Maître d\'armes',
    'Lethal Ignition': 'Ignition létale',
    'Inspire': 'Inspiration',
    'Bargain Hunter': 'Bon négociateur',
    'Swift': 'Rapidité',
    'Fatal': 'Fatalité',
    'Quantum Charge': 'Charge quantique',
    'Weakness Finder': 'Trouveur de faiblesses',
    'Wilderness Blessing': 'Bénédiction sauvage',
    'Seasoned Hunter': 'Chasseur aguerri',
    'Impure Rage': 'Rage impure',
    'Agility': 'Agilité',
    'Mystic Ritual': 'Rituel mystique',
    'Pull Yourself Together': 'Reprends-toi',
    'Focusing Mark': 'Marque de concentration',
    'Master Assassin': 'Maître assassin',
    'Killing Spree': 'Carnage',
    'Vengeance': 'Vengeance',
    'Brave Smite ': 'Frappe vaillante'
  };

  const emblems = {
    'Fighter': 'Combattant',
    'Assassin': 'Assassin',
    'Mage': 'Mage',
    'Marksman': 'Tireur',
    'Tank': 'Tank',
    'Support': 'Soutien',
    'Captain': 'Capitaine'
  };

  const lanes = [
    ['EXP (Experience)', 'Voie « solo » de la carte (souvent le haut). Tu joues seul : tu prends l’expérience, le 1v1 et la pression de ton côté pendant que les autres tournent.'],
    ['Mid', 'Voie du milieu : en général un mage. Tu contrôles le centre de la carte et tu aides les deux côtés (rotations rapides).'],
    ['Gold (Voie dorée)', 'Voie du carry : un tireur (Marksman) y farme l’or en priorité pour atteindre son pic de puissance tardif.'],
    ['Jungle', 'Le joueur de jungle : il farme les monstres, ganke les voies et sécurise les objectifs (tortue, seigneur).'],
    ['Roam', 'Rôle de soutien mobile sans voie fixe : il accompagne, place la vision et lance les combats pour l’équipe.'],
    ['Hybrid', 'Hybride : build ou rôle qui mélange deux approches (ex. moitié dégâts, moitié résistance, ou jouable sur deux voies).']
  ];

  const archetypes = [
    ['Damage Dealer', 'Porte-dégâts principal : build orienté attaque/puissance pure.'],
    ['Sustain', 'Régénération / longévité : tu tiens les combats longs grâce aux soins ou à l’encaissement.'],
    ['Burst', 'Rafale : gros pic de dégâts pour éliminer une cible en un combo très rapide.'],
    ['Combo', 'Jeu en enchaînement de sorts (combo) plutôt qu’en dégâts continus.'],
    ['Pickoff', '« Capture » : isoler une cible seule et la tuer avant que l’équipe adverse réagisse.'],
    ['Bruiser', 'Combattant semi-tank : mi-dégâts mi-résistance, échange en première ligne.'],
    ['Tank', 'Tank : encaisse les dégâts et ouvre le combat, peu de dégâts directs.'],
    ['Frontline', 'Première ligne : tu te places devant pour absorber et protéger tes carries.'],
    ['Front-to-Back', 'Du front vers l’arrière : tu tapes d’abord le tank (anti-tank) puis tu remontes vers les carrys.'],
    ['Tempo', 'Rythme : build qui accélère ton farm/tes rotations tôt pour dicter la partie.'],
    ['Control', 'Contrôle : enchaînement de CC (étourdissements, projections) pour verrouiller l’adversaire.'],
    ['Anti-Dive', 'Anti-plongeon : outils pour survivre quand un assassin/plongeur saute directement sur toi.'],
    ['Anti-Sustain', 'Anti-régénération : coupe les soins et boucliers ennemis (effet Lifebane).'],
    ['Anti-Tank', 'Anti-tank : pénétration d’armure et dégâts en % de PV pour percer les gros résistants.'],
    ['Anti-Burst', 'Anti-rafale : résistances et boucliers pour encaisser un combo « one-shot ».'],
    ['Anti-Physical', 'Anti-physique : réduit ou renvoie les dégâts physiques (armure, contre-critique).'],
    ['Anti-Armor', 'Anti-armure : pénétration pour ignorer une partie de la défense ennemie.'],
    ['Conceal', 'Camouflage : build qui joue sur l’invisibilité pour surprendre (roam pickoff).'],
    ['Deathball', '« Boule de neige » groupée : jouer à 5 ensemble pour rouler sur les objectifs.'],
    ['Kiting', 'Kite : garder la distance et harceler en reculant, sans se faire attraper.'],
    ['Poke', 'Harcèlement à distance avant l’engagement (sorts longue portée).'],
    ['Reset', 'Reset : réinitialiser un sort ou ton burst pour enchaîner plusieurs cibles.'],
    ['Execute', 'Exécution : achève les cibles à faible PV (dégâts vrais, seuil d’exécution).'],
    ['Snowball', 'Snowball : convertir une petite avance en avance énorme (items qui empilent sur les kills).'],
    ['Isolate', 'Isolation : mettre une cible à l’écart pour la combattre seule (ex. arène de Yin).'],
    ['Objective', 'Objectifs : build optimisé pour détruire vite les tortues, seigneurs et tourelles.'],
    ['Crit', 'Critique : build basé sur les coups critiques (Chance de critique).'],
    ['On-Hit', 'Effets à l’impact : dégâts supplémentaires ajoutés à chaque attaque de base.'],
    ['CDR', 'Réduction de recharge : sortir tes sorts beaucoup plus souvent.'],
    ['Safe Late Game', 'Late game sûr : un peu moins de puissance contre plus de survie, pour tenir les combats tardifs.'],
    ['Default', 'Build par défaut : le plus standard quand la partie ne dicte rien de particulier.'],
    ['Flex', 'Slots flexibles : items remplaçables selon l’équipe adverse (nos « swaps »).'],
    ['Flicker', 'Flash / téléportation : sert à engager ou à s’échapper.'],
    ['Dire Hit', 'Sort de roam : marque une cible et augmente les dégâts de l’équipe sur elle.'],
    ['Encourage', 'Bénédiction de roam : buff d’équipe (bouclier / attaque) autour de toi.'],
    ['Vengeance', 'Sort de roam : renvoie une partie des dégâts que tu subis.'],
    ['Favor', 'Bénédiction de roam : accélère et soigne les alliés proches.'],
    ['Revitalize', 'Bénédiction de roam : soin/régénération pour le groupe.'],
    ['Sprint', 'Sort de roam : forte accélération pour chasser ou fuir.'],
    ['Catch and Peel', 'Attraper et protéger : tu punis la cible qui s’expose tout en bloquant l’avance adverse.'],
    ['Drain', 'Drain : siphonner les ressources (soins/PV) pour épuiser l’adversaire.'],
    ['Invade', 'Invade : aller voler les buffs/monstres dans la jungle adverse dès le début.'],
    ['Snowball Execute', 'Snowball + exécution : accumuler l’avance puis achever les cibles faibles.'],
    ['Aura', 'Aura : effet de zone permanent autour de toi qui buff tes alliés ou affaiblit les ennemis.']
  ];

  const plan = {
    outlook: { avantage: 'Avantage', equilibre: 'Équilibré', desavantage: 'Désavantage', inconnu: 'Indéterminé' },
    posture: { agressif: 'Agressif', equilibre: 'Équilibré', defensif: 'Défensif' }
  };

  const talentEffects = {
    'Impure Rage': 'Chaque compétence qui touche inflige 4% des PV max de la cible en dégâts adaptatifs (max 120 sur les non-héros) et rend 2% de mana. Recharge : 5 s. (Très fort sur les héros à sorts rapides.)',
    'Lethal Ignition': 'Si tes dégâts dépassent 7% des PV max d\'un héros 3 fois en 5 s, il brûle pour 162-750 dégâts adaptatifs. Recharge : 15 s. (Finisher de burst.)',
    'Killing Spree': 'En touchant un héros sous 30% de PV : tu récupères 15% des PV perdus et gagnes 20% de vitesse pendant 3 s (recharge au kill). (Snowball / survie après kill.)',
    'Quantum Charge': 'Les attaques de base donnent +30% de vitesse (1,5 s) et rendent 75-180 PV. Recharge : 8 s.',
    'Brave Smite': 'Infliger des dégâts avec un sort te soigne de 5% de tes PV max. Recharge : 6 s.',
    'Concussive Blast': 'La prochaine attaque de base inflige 100 (+7% de tes PV max) dégâts magiques de zone. Recharge : 15 s.',
    'Focusing Mark': 'Après avoir touché un héros, tes alliés lui infligent +6% de dégâts et +10% de vitesse pendant 3 s. Recharge : 4 s.',
    'Weakness Finder': 'Les attaques de base ralentissent de 50% et réduisent la vitesse d\'attaque de la cible de 30% pendant 1 s. Recharge : 10 s.',
    'War Cry': 'Après 3 coups distincts (attaques/sorts) sur un héros : +8% sur tous tes dégâts pendant 6 s. Recharge : 6 s.',
    'Temporal Reign': 'Le prochain ultime réduit la recharge de tes autres sorts (×1,5) pendant 4 s (+2 s sur kill/assist). Recharge : 20 s.',
    'Rupture': 'Slot 1 — +5 pénétration adaptative (devient physique ou magique selon ton attaque dominante).',
    'Fatal': 'Slot 1 — +5% chance de critique et +5% dégâts critiques.',
    'Thrill': 'Slot 1 — +16 attaque adaptative.',
    'Swift': 'Slot 1 — +10% vitesse d\'attaque.',
    'Vitality': 'Slot 1 — +225 PV max.',
    'Firmness': 'Slot 1 — +8 défense physique et magique.',
    'Agility': 'Slot 1 — +4% vitesse de déplacement.',
    'Inspire': 'Slot 1 — +5% réduction de recharge et +2 régén de mana.',
    'Wilderness Blessing': 'Slot 2 — +10% vitesse en jungle et rivière (réduit en combat contre un héros).',
    'Seasoned Hunter': 'Slot 2 — +15% dégâts au Seigneur et à la Tortue (réduit sur les monstres normaux).',
    'Tenacity': 'Slot 2 — +5% réduction de dégâts sous 50% de PV.',
    'Master Assassin': 'Slot 2 — +7% dégâts s\'il n\'y a qu\'un seul héros ennemi à proximité (parfait pour les duels/pickoffs).',
    'Bargain Hunter': 'Slot 2 — les équipements coûtent 95% de leur prix.',
    'Festival of Blood': 'Slot 2 — +6% vol de vie magique (+0,5% par kill, max 12 stacks).',
    'Pull Yourself Together': 'Slot 2 — réduit de 12% la recharge des sorts de combat et des actifs d\'objets.',
    'Weapon Master': 'Slot 2 — +8% sur l\'attaque/puissance fournie par les objets, emblèmes, talents et compétences.'
  };

  const coreTalents = ['Impure Rage', 'Lethal Ignition', 'Killing Spree', 'Brave Smite', 'Concussive Blast', 'Focusing Mark', 'Weakness Finder', 'Quantum Charge', 'War Cry', 'Temporal Reign'];

  const talentTier = {};
  ['Rupture', 'Fatal', 'Thrill', 'Swift', 'Vitality', 'Firmness', 'Agility', 'Inspire'].forEach(function (n) { talentTier[n] = 1; });
  ['Wilderness Blessing', 'Seasoned Hunter', 'Tenacity', 'Master Assassin', 'Bargain Hunter', 'Festival of Blood', 'Pull Yourself Together', 'Weapon Master'].forEach(function (n) { talentTier[n] = 2; });
  coreTalents.forEach(function (n) { talentTier[n] = 3; });

  function talentEffect(name) {
    if (name == null) return '';
    const key = String(name).trim();
    return talentEffects[key] || '';
  }

  function make(table) {
    return function (name) {
      if (name == null) return '';
      const key = String(name).trim();
      return table[key] || key;
    };
  }

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  const replaceable = Object.keys(items)
    .filter(function (k) { return items[k] !== k; })
    .sort(function (a, b) { return b.length - a.length; });
  const itemRx = new RegExp('\\b(' + replaceable.map(escapeRe).join('|') + ')\\b', 'g');

  function frText(text) {
    if (text == null) return '';
    return String(text).replace(itemRx, function (m) { return items[m]; });
  }

  function frReason(text) {
    if (!text) return text;
    let m;
    if ((m = text.match(/^(.+?)'s durability and kit give them a strong matchup advantage against (.+?) throughout the game\.$/))) {
      return 'La robustesse et le kit de ' + m[1] + ' lui donnent un net avantage sur ' + m[2] + ' sur toute la partie.';
    }
    if ((m = text.match(/^(.+?) has a statistical edge over (.+?) based on ranked matchup data\. Pick (.+?) to gain an advantage in draft\.$/))) {
      return m[1] + ' a un avantage statistique sur ' + m[2] + ' d\'après les données de matchups ranked : un bon choix de draft contre lui.';
    }
    if ((m = text.match(/^(.+?) has a favourable matchup against (.+?) based on ranked data, so expect a win rate advantage in this matchup\.$/))) {
      return 'Matchup favorable pour ' + m[1] + ' face à ' + m[2] + ' d\'après les données ranked : avantage de win rate à attendre.';
    }
    if ((m = text.match(/^(.+?) can close the gap on (.+?) and win fights at close range where mages are vulnerable\.$/))) {
      return m[1] + ' peut combler l\'écart sur ' + m[2] + ' et gagner les combats au corps-à-corps, là où les mages sont vulnérables.';
    }
    return text;
  }

  root.MLBBFR = {
    items: items,
    talents: talents,
    emblems: emblems,
    lanes: lanes,
    archetypes: archetypes,
    plan: plan,
    talentEffects: talentEffects,
    coreTalents: coreTalents,
    talentTier: talentTier,
    item: make(items),
    talent: make(talents),
    emblem: make(emblems),
    talentEffect: talentEffect,
    text: frText,
    reason: frReason
  };
})(typeof window !== 'undefined' ? window : globalThis);
