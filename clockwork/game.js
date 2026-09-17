/* The Thirteenth Chime: fixed-view room escape and three-part repair objective. */
const views = [
  { id: 'gears', name: 'Gear Wall' },
  { id: 'workshop', name: 'The Workshop' },
  { id: 'door', name: 'Iron Door' },
];

const detailNames = {
  drawer: 'Workbench · Drawer',
  door: 'Iron Door · Lock',
  painting: 'Gear Wall · Bell Tower Painting',
  clock: 'Gear Wall · Adjustable Clock',
  shaft: 'Workshop · Central Drive Shaft',
};

const game = {
  currentView: 1,
  closeUp: null,
  transitioning: false,
  drawerDigits: [0, 0, 0, 0],
  drawerOpen: false,
  clock: { hour: 12, minute: 30, solved: false },
  puzzles: { visual: false, sound: false, touch: false },
  components: {
    glasses: { collected: false, inserted: false },
    musicBox: { collected: false, inserted: false },
    windingKey: { collected: false, inserted: false },
  },
  keyCollected: false,
  selectedItem: null,
  repairProgress: 0,
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
const gameMessage = document.getElementById('game-message');
let introActive = false;
let introWatchdog = null;
let messageTimer = null;

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

function showMessage(message, duration = 2800) {
  window.clearTimeout(messageTimer);
  gameMessage.textContent = message;
  gameMessage.classList.add('visible');
  messageTimer = window.setTimeout(() => gameMessage.classList.remove('visible'), duration);
}

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
  Object.keys(detailNames).forEach(detail => {
    const element = document.getElementById('room-' + detail + '-detail');
    const active = game.closeUp === detail;
    element.classList.toggle('active-room', active);
    element.setAttribute('aria-hidden', String(!active));
  });
  const roomName = game.closeUp
    ? (game.closeUp === 'door' && game.doorUnlocked ? 'Iron Door · Open' : detailNames[game.closeUp])
    : (game.currentView === 2 && game.doorUnlocked ? 'Iron Door · Open' : views[game.currentView].name);
  document.getElementById('hud-room').textContent = roomName;
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
    window.setTimeout(() => { game.transitioning = false; }, 420);
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

function openCloseUp(name, requiredView) {
  if (game.transitioning || game.closeUp || (requiredView !== undefined && game.currentView !== requiredView)) return;
  game.closeUp = name;
  renderView();
}

function openDrawer() {
  game.drawerOpen = true;
  document.getElementById('drawer-closed-plate').classList.add('puzzle-hidden');
  document.getElementById('drawer-open-tray').classList.remove('puzzle-hidden');
  showMessage('Four tumblers settle. The old drawer sighs open.');
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

const inventoryItems = {
  key: {
    button: document.getElementById('inventory-key'),
    icon: document.getElementById('inventory-key-icon'),
    name: 'Brass key',
    available: () => game.keyCollected,
  },
  glasses: {
    button: document.getElementById('inventory-glasses'),
    icon: document.getElementById('inventory-glasses-icon'),
    name: 'Antique glasses',
    available: () => game.components.glasses.collected && !game.components.glasses.inserted,
  },
};

function renderInventory() {
  Object.entries(inventoryItems).forEach(([id, item]) => {
    const available = item.available();
    item.button.disabled = !available;
    item.button.classList.toggle('selected', game.selectedItem === id);
    item.button.setAttribute('aria-pressed', String(game.selectedItem === id));
    item.icon.classList.toggle('puzzle-hidden', !available);
  });
  const label = document.getElementById('inventory-label');
  if (game.selectedItem && inventoryItems[game.selectedItem]) {
    label.textContent = `${inventoryItems[game.selectedItem].name} · selected`;
  } else if (Object.values(inventoryItems).some(item => item.available())) {
    label.textContent = 'Select an item to inspect or use it';
  } else if (game.components.glasses.inserted) {
    label.textContent = 'Glasses fitted to the drive shaft';
  } else {
    label.textContent = 'Nothing collected yet';
  }
}

Object.entries(inventoryItems).forEach(([id, item]) => {
  item.button.addEventListener('click', () => {
    if (!item.available()) return;
    game.selectedItem = game.selectedItem === id ? null : id;
    renderInventory();
    if (game.selectedItem) {
      showMessage(id === 'glasses'
        ? 'Fine brass spectacles. Their pale lenses catch details the eye misses.'
        : 'A worn brass key, cut for an older mechanism.');
    }
  });
});

function takeKey() {
  if (game.transitioning || game.closeUp !== 'drawer' || !game.drawerOpen || game.keyCollected) return;
  game.keyCollected = true;
  document.getElementById('drawer-key').classList.add('puzzle-hidden');
  renderInventory();
  showMessage('The brass key joins your inventory. It does not fit the final lock.');
}

function renderClock() {
  const hourAngle = game.clock.hour * 30;
  const minuteAngle = game.clock.minute * 6;
  document.getElementById('clock-hour-hand').setAttribute('transform', `rotate(${hourAngle} 500 220)`);
  document.getElementById('clock-minute-hand').setAttribute('transform', `rotate(${minuteAngle} 500 220)`);
  const hourControl = document.getElementById('clock-hour-hitarea');
  const minuteControl = document.getElementById('clock-minute-hitarea');
  hourControl.setAttribute('transform', `rotate(${hourAngle} 500 220)`);
  minuteControl.setAttribute('transform', `rotate(${minuteAngle} 500 220)`);
  hourControl.setAttribute('aria-label', `Hour hand at ${game.clock.hour}. Move forward one hour`);
  minuteControl.setAttribute('aria-label', `Minute hand at ${String(game.clock.minute).padStart(2, '0')}. Move forward fifteen minutes`);
}

function giveClockFeedback() {
  const clock = document.getElementById('adjustable-clock');
  clock.classList.remove('mechanical-tick');
  void clock.getBoundingClientRect();
  clock.classList.add('mechanical-tick');
}

function turnClockHand(hand) {
  if (game.transitioning || game.closeUp !== 'clock' || game.clock.solved) return;
  if (hand === 'hour') game.clock.hour = game.clock.hour % 12 + 1;
  if (hand === 'minute') game.clock.minute = (game.clock.minute + 15) % 60;
  renderClock();
  giveClockFeedback();
  if (game.clock.hour === 3 && game.clock.minute === 0) solveClock();
}

function solveClock() {
  if (game.clock.solved) return;
  game.clock.solved = true;
  game.puzzles.visual = true;
  document.getElementById('adjustable-clock').classList.add('clock-unlocked');
  window.setTimeout(() => {
    document.getElementById('clock-compartment').classList.remove('puzzle-hidden');
    document.getElementById('clock-compartment-label').classList.remove('puzzle-hidden');
    if (!game.components.glasses.collected) document.getElementById('clock-glasses').classList.remove('puzzle-hidden');
    showMessage('A hidden catch releases behind the clock face.');
  }, 650);
}

function takeGlasses() {
  const glasses = game.components.glasses;
  if (game.transitioning || game.closeUp !== 'clock' || !game.clock.solved || glasses.collected) return;
  glasses.collected = true;
  document.getElementById('clock-glasses').classList.add('puzzle-hidden');
  renderInventory();
  showMessage('You take the antique glasses. The lenses shimmer with a precise, watchful light.');
}

function updateRepairProgress() {
  game.repairProgress = Object.values(game.components).filter(component => component.inserted).length;
  const shaftDetail = document.getElementById('room-shaft-detail');
  shaftDetail.classList.toggle('shaft-active', game.repairProgress === 3);
  shaftDetail.setAttribute('aria-label', game.repairProgress === 3
    ? 'The repaired central drive shaft is running'
    : `Close-up of the central drive shaft, ${game.repairProgress} of 3 components fitted`);
  document.getElementById('shaft-status').textContent = game.repairProgress === 3
    ? 'THE DRIVE SHAFT ANSWERS — THE FINAL LOCK RELEASES'
    : `${game.repairProgress} OF 3 COMPONENTS SEATED`;
}

function insertComponent(componentName) {
  if (game.transitioning || game.closeUp !== 'shaft') return;
  const component = game.components[componentName];
  if (!component || component.inserted) return;
  if (game.selectedItem !== componentName) {
    showMessage(componentName === 'glasses'
      ? 'The sight socket waits for something made to sharpen vision.'
      : 'This socket waits for a component not yet recovered.');
    return;
  }
  component.inserted = true;
  game.selectedItem = null;
  if (componentName === 'glasses') {
    document.getElementById('socket-glasses-item').classList.remove('puzzle-hidden');
    const socket = document.getElementById('socket-sight');
    socket.classList.add('filled');
    socket.setAttribute('aria-label', 'Sight socket, filled with the antique glasses');
  }
  updateRepairProgress();
  renderInventory();
  showMessage('The glasses settle into the sight socket. One part of the mechanism remembers its purpose.');
}

function allComponentsInserted() {
  return Object.values(game.components).every(component => component.collected && component.inserted);
}

function unlockDoor() {
  if (game.transitioning || game.closeUp !== 'door' || game.doorUnlocked) return;
  if (!allComponentsInserted()) {
    const lock = document.getElementById('door-lock-visual');
    lock.classList.remove('lock-rattle');
    void lock.getBoundingClientRect();
    lock.classList.add('lock-rattle');
    const remaining = 3 - game.repairProgress;
    showMessage(`The iron door refuses you. The drive shaft still lacks ${remaining} ${remaining === 1 ? 'component' : 'components'}.`);
    return;
  }
  game.doorUnlocked = true;
  game.selectedItem = null;
  document.getElementById('door-open-view').classList.remove('puzzle-hidden');
  document.getElementById('door-open-detail').classList.remove('puzzle-hidden');
  document.getElementById('door-lock-hotspot').classList.add('puzzle-hidden');
  renderInventory();
  renderView();
}

function runAction(element) {
  switch (element.dataset.action) {
    case 'zoom-door': openCloseUp('door', 2); break;
    case 'zoom-drawer': openCloseUp('drawer', 0); break;
    case 'zoom-painting': openCloseUp('painting', 0); break;
    case 'zoom-clock': openCloseUp('clock', 0); break;
    case 'zoom-shaft': openCloseUp('shaft', 1); break;
    case 'take-key': takeKey(); break;
    case 'take-glasses': takeGlasses(); break;
    case 'turn-hour': turnClockHand('hour'); break;
    case 'turn-minute': turnClockHand('minute'); break;
    case 'insert-component': insertComponent(element.dataset.component); break;
    case 'unlock-door': unlockDoor(); break;
  }
}

document.querySelectorAll('[data-action]').forEach(element => {
  const interact = () => runAction(element);
  element.addEventListener('click', interact);
  element.addEventListener('keydown', event => {
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

renderClock();
updateRepairProgress();
renderInventory();
