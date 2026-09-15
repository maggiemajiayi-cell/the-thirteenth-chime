/* Clockmaker's Curse: fixed-view room escape with a first playable lock. */
const views = [
  { id: 'gears', name: 'Gear Wall' },
  { id: 'workshop', name: 'The Workshop' },
  { id: 'door', name: 'Iron Door' },
];

const game = {
  currentView: 1,
  closeUp: null,
  transitioning: false,
  drawerDigits: [0, 0, 0, 0],
  drawerOpen: false,
  keyCollected: false,
  keySelected: false,
  doorUnlocked: false,
};

const fade = document.getElementById('scene-fade');
const bgm = document.getElementById('bgm');
const introVideo = document.getElementById('intro-video');
const introOverlay = document.getElementById('intro-video-overlay');
const volumeControl = document.getElementById('volume-control');
const volumeToggle = document.getElementById('volume-toggle');
const volumePanel = document.getElementById('volume-panel');
const volumeIcon = document.getElementById('volume-icon');
const volumeMarks = document.querySelectorAll('.volume-mark');
let introActive = false;
let introWatchdog = null;

function ensureBgm() {
  if (bgm.paused && !bgm.muted) bgm.play().catch(() => {});
}

function setVolume(level, resumePlayback = true) {
  const safeLevel = [0, 25, 50, 75, 100].includes(level) ? level : 25;
  bgm.volume = safeLevel / 100;
  bgm.muted = safeLevel === 0;
  volumeIcon.dataset.level = String(safeLevel);
  volumeToggle.setAttribute('aria-label', `Adjust volume, currently ${safeLevel} percent`);
  volumeMarks.forEach(mark => {
    const active = Number(mark.dataset.volume) === safeLevel;
    mark.classList.toggle('active', active);
    mark.setAttribute('aria-pressed', String(active));
  });
  try { localStorage.setItem('clockwork-volume-v2', String(safeLevel)); } catch (_) {}
  if (resumePlayback && safeLevel > 0 && document.getElementById('game-screen').classList.contains('active')) ensureBgm();
}

function closeVolumePanel() {
  volumePanel.classList.add('is-hidden');
  volumeToggle.setAttribute('aria-expanded', 'false');
}

volumeToggle.addEventListener('click', event => {
  event.stopPropagation();
  const opening = volumePanel.classList.contains('is-hidden');
  volumePanel.classList.toggle('is-hidden', !opening);
  volumeToggle.setAttribute('aria-expanded', String(opening));
});

volumeMarks.forEach(mark => {
  mark.addEventListener('click', event => {
    event.stopPropagation();
    setVolume(Number(mark.dataset.volume));
  });
});

document.addEventListener('click', event => {
  if (!volumeControl.contains(event.target)) closeVolumePanel();
});

let initialVolume = 25;
try {
  const savedVolume = localStorage.getItem('clockwork-volume-v2');
  if (savedVolume !== null) initialVolume = Number(savedVolume);
} catch (_) {}
setVolume(initialVolume, false);

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.toggle('active', screen.id === id);
  });
}

function displayView(index) {
  game.currentView = index;
  game.closeUp = null;
  renderView();
}

function renderView() {
  views.forEach((view, viewIndex) => {
    const element = document.getElementById('room-' + view.id);
    const active = !game.closeUp && viewIndex === game.currentView;
    element.classList.toggle('active-room', active);
    element.setAttribute('aria-hidden', String(!active));
  });
  ['door', 'drawer'].forEach(detail => {
    const element = document.getElementById('room-' + detail + '-detail');
    const active = game.closeUp === detail;
    element.classList.toggle('active-room', active);
    element.setAttribute('aria-hidden', String(!active));
  });
  document.getElementById('hud-room').textContent = game.closeUp === 'drawer'
    ? 'Workbench · Drawer'
    : game.closeUp === 'door'
      ? game.doorUnlocked ? 'Iron Door · Open' : 'Iron Door · Lock'
      : game.currentView === 2 && game.doorUnlocked ? 'Iron Door · Open' : views[game.currentView].name;
  document.getElementById('go-back').hidden = !game.closeUp;
  document.getElementById('turn-left').hidden = !!game.closeUp;
  document.getElementById('turn-right').hidden = !!game.closeUp;
}

function startGame() {
  if (game.transitioning) return;
  game.transitioning = true;
  game.closeUp = null;
  closeVolumePanel();
  fade.classList.add('visible');

  ensureBgm();
  window.setTimeout(() => {
    introActive = true;
    introOverlay.classList.remove('is-hidden');
    introOverlay.setAttribute('aria-hidden', 'false');
    introVideo.currentTime = 0;
    introVideo.play().catch(() => finishIntro());
    introWatchdog = window.setTimeout(finishIntro, 20000);
    window.setTimeout(() => fade.classList.remove('visible'), 60);
  }, 240);
}

function finishIntro() {
  if (!introActive) return;
  introActive = false;
  window.clearTimeout(introWatchdog);
  introVideo.pause();
  fade.classList.add('visible');
  window.setTimeout(() => {
    introOverlay.classList.add('is-hidden');
    introOverlay.setAttribute('aria-hidden', 'true');
    displayView(1);
    showScreen('game-screen');
    window.setTimeout(() => fade.classList.remove('visible'), 60);
    window.setTimeout(() => {
      game.transitioning = false;
    }, 420);
  }, 240);
}

introVideo.addEventListener('ended', finishIntro);
introVideo.addEventListener('error', finishIntro);

function turnView(direction) {
  if (game.transitioning || game.closeUp || !document.getElementById('game-screen').classList.contains('active')) return;
  displayView((game.currentView + direction + views.length) % views.length);
}

function goBack() {
  if (game.transitioning || !game.closeUp) return;
  game.closeUp = null;
  renderView();
}

function lookAtDoor() {
  if (game.transitioning || game.closeUp) return;
  game.closeUp = 'door';
  renderView();
}

function lookAtDrawer() {
  if (game.transitioning || game.closeUp || game.currentView !== 0) return;
  game.closeUp = 'drawer';
  renderView();
}

function openDrawer() {
  game.drawerOpen = true;
  document.getElementById('drawer-closed-plate').classList.add('puzzle-hidden');
  document.getElementById('drawer-open-tray').classList.remove('puzzle-hidden');
}

document.querySelectorAll('.puzzle-wheel').forEach(wheel => {
  const advance = () => {
    if (game.transitioning || game.closeUp !== 'drawer' || game.drawerOpen) return;
    const index = Number(wheel.dataset.wheel);
    game.drawerDigits[index] = (game.drawerDigits[index] + 1) % 10;
    wheel.querySelector('text').textContent = String(game.drawerDigits[index]);
    wheel.setAttribute('aria-label', `Digit ${index + 1}: ${game.drawerDigits[index]}. Click to advance`);
    if (game.drawerDigits.join('') === '1158') openDrawer();
  };
  wheel.addEventListener('click', advance);
  wheel.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      advance();
    }
  });
});

const inventoryKey = document.getElementById('inventory-key');
function renderInventory() {
  inventoryKey.disabled = !game.keyCollected;
  inventoryKey.classList.toggle('selected', game.keySelected);
  inventoryKey.setAttribute('aria-pressed', String(game.keySelected));
  document.getElementById('inventory-key-icon').classList.toggle('puzzle-hidden', !game.keyCollected);
  document.getElementById('inventory-label').textContent = game.keyCollected
    ? game.keySelected ? 'Brass key · selected' : 'Brass key · click to select'
    : 'Nothing collected yet';
}

inventoryKey.addEventListener('click', () => {
  if (!game.keyCollected) return;
  game.keySelected = !game.keySelected;
  renderInventory();
});

function takeKey() {
  if (game.transitioning || game.closeUp !== 'drawer' || !game.drawerOpen || game.keyCollected) return;
  game.keyCollected = true;
  document.getElementById('drawer-key').classList.add('puzzle-hidden');
  renderInventory();
}

function unlockDoor() {
  if (game.transitioning || game.closeUp !== 'door' || game.doorUnlocked) return;
  if (!game.keySelected) {
    const lock = document.getElementById('door-lock-visual');
    lock.classList.remove('lock-rattle');
    void lock.getBoundingClientRect();
    lock.classList.add('lock-rattle');
    return;
  }
  game.doorUnlocked = true;
  game.keySelected = false;
  document.getElementById('door-open-view').classList.remove('puzzle-hidden');
  document.getElementById('door-open-detail').classList.remove('puzzle-hidden');
  document.getElementById('door-lock-hotspot').classList.add('puzzle-hidden');
  renderInventory();
  renderView();
}

document.querySelectorAll('[data-action]').forEach(hotspot => {
  const interact = () => {
    switch (hotspot.dataset.action) {
      case 'zoom-door': lookAtDoor(); break;
      case 'zoom-drawer': lookAtDrawer(); break;
      case 'take-key': takeKey(); break;
      case 'unlock-door': unlockDoor(); break;
    }
  };
  hotspot.addEventListener('click', interact);
  hotspot.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      interact();
    }
  });
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeVolumePanel();
    goBack();
  }
});
