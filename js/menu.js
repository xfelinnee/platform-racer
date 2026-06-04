// Settings + screen management
const Settings = {
  data: {
    musicVol: 50,
    sfxVol: 70,
    difficulty: 'normal',
    particles: true,
    best: 0,
  },
  load() {
    try {
      const s = JSON.parse(localStorage.getItem('platformRacer') || '{}');
      Object.assign(this.data, s);
    } catch (e) {}
  },
  save() {
    localStorage.setItem('platformRacer', JSON.stringify(this.data));
  },
};

const Screens = {
  show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  },
  hideAll() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  },
};

function initSettingsUI() {
  Settings.load();
  const d = Settings.data;

  const music = document.getElementById('musicVol');
  const sfx = document.getElementById('sfxVol');
  music.value = d.musicVol;
  sfx.value = d.sfxVol;
  document.getElementById('musicVolVal').textContent = d.musicVol;
  document.getElementById('sfxVolVal').textContent = d.sfxVol;
  document.getElementById('hudBest').textContent = d.best;

  music.addEventListener('input', () => {
    d.musicVol = +music.value;
    document.getElementById('musicVolVal').textContent = music.value;
    Audio2.setVolumes(d.musicVol, d.sfxVol);
    Settings.save();
  });
  sfx.addEventListener('input', () => {
    d.sfxVol = +sfx.value;
    document.getElementById('sfxVolVal').textContent = sfx.value;
    Audio2.setVolumes(d.musicVol, d.sfxVol);
    Settings.save();
  });

  setupSeg('difficulty', d.difficulty, (val) => { d.difficulty = val; Settings.save(); });
  setupSeg('particles', d.particles ? 'on' : 'off', (val) => { d.particles = (val === 'on'); Settings.save(); });
}

function setupSeg(id, current, onChange) {
  const seg = document.getElementById(id);
  seg.querySelectorAll('button').forEach(b => {
    b.classList.toggle('on', b.dataset.val === current);
    b.addEventListener('click', () => {
      seg.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      onChange(b.dataset.val);
    });
  });
}

// ---------- LOGIN / PROFILE LIST ----------
function renderProfiles(onPick) {
  const listEl = document.getElementById('profileList');
  const profiles = Profiles.list();
  listEl.innerHTML = '';

  if (profiles.length === 0) {
    listEl.innerHTML = '<div class="profile-empty">No profiles yet. Create one below.</div>';
    return;
  }

  profiles.sort((a, b) => b.best - a.best);
  for (const p of profiles) {
    const row = document.createElement('div');
    row.className = 'profile-row';
    row.innerHTML =
      `<span class="pr-name"></span>` +
      `<span class="pr-meta"><span><span class="coin-ico"></span>${p.coins}</span><span>BEST ${p.best}m</span></span>` +
      `<button class="pr-delete" title="Delete">&times;</button>`;
    row.querySelector('.pr-name').textContent = p.name;

    row.addEventListener('click', () => onPick(p.name));
    row.querySelector('.pr-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Delete profile "${p.name}"? This cannot be undone.`)) {
        Profiles.remove(p.name);
        renderProfiles(onPick);
      }
    });
    listEl.appendChild(row);
  }
}

// ---------- LEVEL / XP BAR ----------
function renderLevel() {
  const pr = Profiles.progress();
  if (!pr) return;
  document.getElementById('lvlBadge').textContent = `LVL ${pr.level}`;
  const badge = document.getElementById('prestigeBadge');
  badge.textContent = pr.prestige > 0 ? `\u2605 P${pr.prestige}` : '';
  badge.style.display = pr.prestige > 0 ? 'inline-flex' : 'none';

  const pct = pr.atMax ? 100 : Math.max(0, Math.min(100, (pr.xp / pr.need) * 100));
  document.getElementById('xpFill').style.width = pct + '%';
  document.getElementById('xpText').textContent = pr.atMax
    ? (pr.canPrestige ? 'MAX \u00b7 Ready to Prestige' : 'MAX LEVEL')
    : `${pr.xp} / ${pr.need} XP`;

  const btn = document.getElementById('prestigeBtn');
  btn.style.display = pr.canPrestige ? 'block' : 'none';
}

// ---------- SHOP ----------
// tab: 'buffs' | 'hats' | 'clothes'
// handlers: { buyUpgrade, buyCosmetic, equip }
function renderShop(tab, handlers) {
  const p = Profiles.current();
  if (!p) return;
  document.getElementById('shopCoins').textContent = p.coins;

  // reflect active tab button
  document.querySelectorAll('#shopTabs .shop-tab').forEach(b => {
    b.classList.toggle('on', b.dataset.tab === tab);
  });

  const itemsEl = document.getElementById('shopItems');
  itemsEl.innerHTML = '';

  if (tab === 'buffs') {
    for (const up of Profiles.UPGRADES) {
      const owned = p.owned[up.id];
      const canAfford = p.coins >= up.price;
      const card = document.createElement('div');
      card.className = 'shop-item' + (owned ? ' owned' : (canAfford ? '' : ' cant'));
      card.innerHTML = `<h3></h3><p></p><button class="si-buy" ${owned ? 'disabled' : ''}></button>`;
      card.querySelector('h3').textContent = up.name;
      card.querySelector('p').textContent = up.desc;
      const btn = card.querySelector('.si-buy');
      if (owned) btn.textContent = 'OWNED';
      else { btn.innerHTML = `<span class="coin-ico"></span>${up.price}`; btn.addEventListener('click', () => handlers.buyUpgrade(up.id)); }
      itemsEl.appendChild(card);
    }
    return;
  }

  // cosmetics: hats or clothes
  const type = (tab === 'hats') ? 'hat' : 'clothes';
  const list = (tab === 'hats') ? Profiles.HATS : Profiles.CLOTHES;
  for (const item of list) {
    const owned = Profiles.ownsCosmetic(type, item.id);
    const isEquipped = Profiles.equipped(type) === item.id;
    const canAfford = p.coins >= item.price;
    const card = document.createElement('div');
    card.className = 'shop-item' + (isEquipped ? ' equipped' : (owned ? ' owned' : (canAfford ? '' : ' cant')));
    card.innerHTML = `<h3></h3><p></p><button class="si-buy"></button>`;
    card.querySelector('h3').textContent = item.name;
    card.querySelector('p').textContent = item.desc;
    const btn = card.querySelector('.si-buy');
    if (!owned) {
      btn.innerHTML = `<span class="coin-ico"></span>${item.price}`;
      btn.addEventListener('click', () => handlers.buyCosmetic(type, item.id));
    } else {
      btn.textContent = isEquipped ? 'EQUIPPED' : 'Equip';
      btn.addEventListener('click', () => handlers.equip(type, item.id));
    }
    itemsEl.appendChild(card);
  }
}
