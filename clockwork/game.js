/* The Thirteenth Chime: fixed-view room escape and three-part repair objective. */
const views = [
  { id: 'gears', name: 'Gear Wall' },
  { id: 'workshop', name: 'The Workshop' },
  { id: 'door', name: 'Chamber of Resonance' },
];

const detailNames = {
  drawer: 'Workbench · Drawer',
  door: 'Iron Door · Lock',
  painting: 'Gear Wall · Bell Tower Painting',
  clock: 'Gear Wall · Adjustable Clock',
  shaft: 'Workshop · Repair Desk',
  'sound-device': 'Resonance Chamber · Wall Mechanism',
  trapdoor: 'Resonance Chamber · Floor Plate',
  frozen: 'Resonance Chamber · The Frozen Heart',
  note: 'Inventory · Worn Paper',
};

function createInitialGameState() {
  return {
    currentView: 1,
    closeUp: null,
    transitioning: false,
    drawerDigits: [0, 0, 0, 0],
    drawerOpen: false,
    paperCollected: false,
    paperUsed: false,
    inventoryOrder: [],
    clock: { hour: 12, minute: 30, solved: false },
    soundPuzzle: { cluePlaying: false, taps: [], lastTap: 0, solved: false },
    frozen: { valveUnlocked: false, valveRotations: 0, drainageStarted: false, drained: false },
    puzzles: { visual: false, sound: false, touch: false },
    components: {
      glasses: { collected: false, inserted: false },
      musicBox: { collected: false, inserted: false },
      windingKey: { collected: false, inserted: false },
    },
    keyCollected: false,
    keyUsed: false,
    selectedItem: null,
    repairProgress: 0,
    pendulumFinalComplete: false,
    doorAccessible: false,
    doorUnlocked: false,
    endingTriggered: false,
    cinematicPlaying: false,
  };
}

const game = createInitialGameState();

const drawerSolution = '1158';

const fade = document.getElementById('scene-fade');
const bgm = document.getElementById('bgm');
const introVideo = document.getElementById('intro-video');
const endingCinematic = document.getElementById('ending-cinematic');
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
let renderedPendulumProgress = 0;
let pendulumAnimationRunning = false;
let pendulumWebAnimation = null;
const pendingPendulumSteps = [];
const soundRhythm = ['short', 'short', 'long', 'short'];
const soundClueTimes = [0, 450, 900, 1950, 2400];
let effectsAudioContext = null;
let soundClueTimers = [];
let sessionGeneration = 0;
const gameTimers = new Set();
const cinematicTimers = new Set();
const cinematicAudioNodes = new Set();
let cinematicFrame = null;

function scheduleGame(callback, delay = 0) {
  const generation = sessionGeneration;
  const timer = window.setTimeout(() => {
    gameTimers.delete(timer);
    if (generation === sessionGeneration) callback();
  }, delay);
  gameTimers.add(timer);
  return timer;
}

function scheduleCinematic(callback, delay = 0) {
  const generation = sessionGeneration;
  const timer = window.setTimeout(() => {
    cinematicTimers.delete(timer);
    if (generation === sessionGeneration && game.cinematicPlaying) callback();
  }, delay);
  cinematicTimers.add(timer);
  return timer;
}

function cancelPendingAsync() {
  sessionGeneration += 1;
  gameTimers.forEach(timer => window.clearTimeout(timer));
  cinematicTimers.forEach(timer => window.clearTimeout(timer));
  gameTimers.clear();
  cinematicTimers.clear();
  soundClueTimers = [];
  window.clearTimeout(messageTimer);
  window.clearTimeout(introWatchdog);
  if (cinematicFrame !== null) cancelAnimationFrame(cinematicFrame);
  cinematicFrame = null;
  cinematicAudioNodes.forEach(node => {
    try { node.stop(); } catch (_) {}
    try { node.disconnect(); } catch (_) {}
  });
  cinematicAudioNodes.clear();
  if (pendulumWebAnimation) pendulumWebAnimation.cancel();
  pendulumWebAnimation = null;
}

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
  messageTimer = scheduleGame(() => gameMessage.classList.remove('visible'), duration);
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
  if (index === 1) scheduleGame(playPendingPendulumStep, 80);
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
    : views[game.currentView].name;
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
  scheduleGame(() => {
    introActive = true;
    introOverlay.classList.remove('is-hidden');
    introOverlay.setAttribute('aria-hidden', 'false');
    introVideo.currentTime = 0;
    introVideo.play().catch(() => finishIntro());
    introWatchdog = scheduleGame(finishIntro, 20000);
    scheduleGame(() => fade.classList.remove('visible'), 60);
  }, 240);
}

function finishIntro() {
  if (!introActive) return;
  introActive = false;
  window.clearTimeout(introWatchdog);
  introVideo.pause();
  fade.classList.add('visible');
  scheduleGame(() => {
    introOverlay.classList.add('is-hidden');
    introOverlay.setAttribute('aria-hidden', 'true');
    displayView(1);
    showScreen('game-screen');
    scheduleGame(() => fade.classList.remove('visible'), 60);
    scheduleGame(() => { game.transitioning = false; }, 420);
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
  const previousCloseUp = game.closeUp;
  game.closeUp = null;
  renderView();
  if (previousCloseUp === 'shaft' && game.currentView === 1) {
    scheduleGame(playPendingPendulumStep, 80);
  }
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
    if (drawerSolution && game.drawerDigits.join('') === drawerSolution) openDrawer();
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
  note: {
    button: document.getElementById('inventory-note'),
    icon: document.getElementById('inventory-note-icon'),
    name: 'Worn paper',
    available: () => game.paperCollected && !game.paperUsed,
  },
  key: {
    button: document.getElementById('inventory-key'),
    icon: document.getElementById('inventory-key-icon'),
    name: 'Brass key',
    available: () => game.keyCollected && !game.keyUsed,
  },
  glasses: {
    button: document.getElementById('inventory-glasses'),
    icon: document.getElementById('inventory-glasses-icon'),
    name: 'Antique glasses',
    available: () => game.components.glasses.collected && !game.components.glasses.inserted,
  },
  musicBox: {
    button: document.getElementById('inventory-musicbox'),
    icon: document.getElementById('inventory-musicbox-icon'),
    name: 'Antique music box',
    available: () => game.components.musicBox.collected && !game.components.musicBox.inserted,
  },
  windingKey: {
    button: document.getElementById('inventory-windingkey'),
    icon: document.getElementById('inventory-windingkey-icon'),
    name: 'Golden winding key',
    available: () => game.components.windingKey.collected && !game.components.windingKey.inserted,
  },
};

function addInventoryItem(id) {
  if (!game.inventoryOrder.includes(id)) game.inventoryOrder.push(id);
}

function removeInventoryItem(id) {
  const index = game.inventoryOrder.indexOf(id);
  if (index !== -1) game.inventoryOrder.splice(index, 1);
  if (game.selectedItem === id) game.selectedItem = null;
}

function renderInventory() {
  Object.entries(inventoryItems).forEach(([id, item]) => {
    const available = item.available() && game.inventoryOrder.includes(id);
    item.button.hidden = !available;
    item.button.disabled = !available;
    item.button.classList.toggle('selected', game.selectedItem === id);
    item.button.setAttribute('aria-pressed', String(game.selectedItem === id));
    item.icon.classList.toggle('puzzle-hidden', !available);
  });
  const slotContainer = document.querySelector('.inventory-slots');
  game.inventoryOrder.forEach(id => {
    const item = inventoryItems[id];
    if (item && item.available()) slotContainer.appendChild(item.button);
  });
  const label = document.getElementById('inventory-label');
  if (game.selectedItem && inventoryItems[game.selectedItem]) {
    label.textContent = `${inventoryItems[game.selectedItem].name} · selected`;
  } else if (Object.values(inventoryItems).some(item => item.available())) {
    label.textContent = 'Select an item to inspect or use it';
  } else if (game.repairProgress > 0) {
    label.textContent = `${game.repairProgress} of 3 components fitted to the repair desk`;
  } else {
    label.textContent = 'Nothing collected yet';
  }
}

Object.entries(inventoryItems).forEach(([id, item]) => {
  item.button.addEventListener('click', () => {
    if (!item.available()) return;
    if (id === 'note') {
      game.selectedItem = null;
      game.closeUp = 'note';
      renderInventory();
      renderView();
      showMessage('The worn paper bears four deliberate figures: 1158.');
      return;
    }
    game.selectedItem = game.selectedItem === id ? null : id;
    renderInventory();
    if (game.selectedItem) {
      const descriptions = {
        glasses: 'Fine brass spectacles. Their pale lenses catch details the eye misses.',
        musicBox: 'A miniature music box of dark wood and intricate brasswork.',
        windingKey: 'An ornate golden winding key, cold from the heart of the vessel.',
        key: 'A worn brass key, cut for an older mechanism.',
      };
      showMessage(descriptions[id]);
    }
  });
});

function takePaperNote() {
  if (game.transitioning || game.currentView !== 1 || game.closeUp || game.paperCollected || game.paperUsed) return;
  game.paperCollected = true;
  document.getElementById('floor-note').classList.add('puzzle-hidden');
  addInventoryItem('note');
  renderInventory();
  showMessage('You pick up a brittle scrap of paper. Its ink has not entirely faded.');
}

function takeKey() {
  if (game.transitioning || game.closeUp !== 'drawer' || !game.drawerOpen || game.keyCollected) return;
  game.keyCollected = true;
  game.paperUsed = true;
  document.getElementById('drawer-key').classList.add('puzzle-hidden');
  document.getElementById('floor-note').classList.add('puzzle-hidden');
  removeInventoryItem('note');
  addInventoryItem('key');
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
  scheduleGame(() => {
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
  addInventoryItem('glasses');
  renderInventory();
  showMessage('You take the antique glasses. The lenses shimmer with a precise, watchful light.');
}

function getEffectsAudioContext() {
  if (!effectsAudioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    effectsAudioContext = new AudioContextClass();
  }
  if (effectsAudioContext.state === 'suspended') effectsAudioContext.resume().catch(() => {});
  return effectsAudioContext;
}

function effectsVolume(multiplier = 1) {
  return bgm.muted ? 0 : Math.min(1, bgm.volume * multiplier);
}

function playMechanicalSound(kind = 'tick') {
  const volume = effectsVolume(kind === 'reject' || kind === 'unlock' ? .42 : kind === 'ui' ? .18 : .58);
  if (volume <= 0) return;
  const context = getEffectsAudioContext();
  if (!context) return;
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.connect(gain);
  gain.connect(context.destination);

  if (kind === 'ui') {
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(660, now);
    oscillator.frequency.exponentialRampToValueAtTime(440, now + .075);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + .085);

    const overtone = context.createOscillator();
    const overtoneGain = context.createGain();
    overtone.connect(overtoneGain);
    overtoneGain.connect(context.destination);
    overtone.type = 'sine';
    overtone.frequency.setValueAtTime(990, now);
    overtone.frequency.exponentialRampToValueAtTime(660, now + .055);
    overtoneGain.gain.setValueAtTime(volume * .28, now);
    overtoneGain.gain.exponentialRampToValueAtTime(.0001, now + .065);

    oscillator.start(now);
    oscillator.stop(now + .09);
    overtone.start(now);
    overtone.stop(now + .07);
    return;
  }

  if (kind === 'reject' || kind === 'unlock') {
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(kind === 'unlock' ? 92 : 155, now);
    oscillator.frequency.exponentialRampToValueAtTime(kind === 'unlock' ? 38 : 62, now + (kind === 'unlock' ? .65 : .27));
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + (kind === 'unlock' ? .7 : .3));
    oscillator.start(now);
    oscillator.stop(now + (kind === 'unlock' ? .71 : .31));
    return;
  }

  const isPlate = kind === 'plate';
  oscillator.type = isPlate ? 'triangle' : 'square';
  oscillator.frequency.setValueAtTime(isPlate ? 760 : 1480, now);
  oscillator.frequency.exponentialRampToValueAtTime(isPlate ? 430 : 810, now + .075);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(.0001, now + .1);
  oscillator.start(now);
  oscillator.stop(now + .11);
}

function strikeSoundHammer() {
  const hammer = document.getElementById('sound-hammer');
  hammer.classList.remove('hammer-strike');
  void hammer.getBoundingClientRect();
  hammer.classList.add('hammer-strike');
  playMechanicalSound('tick');
}

function playSoundClue() {
  if (game.transitioning || game.closeUp !== 'sound-device' || game.soundPuzzle.cluePlaying) return;
  getEffectsAudioContext();
  game.soundPuzzle.cluePlaying = true;
  const detail = document.getElementById('room-sound-device-detail');
  detail.classList.add('sound-device-playing');
  soundClueTimers = soundClueTimes.map(delay => scheduleGame(strikeSoundHammer, delay));
  soundClueTimers.push(scheduleGame(() => {
    game.soundPuzzle.cluePlaying = false;
    detail.classList.remove('sound-device-playing');
    soundClueTimers = [];
  }, 2600));
}

function updateTapIndicator(count) {
  const marks = Array.from({ length: 5 }, (_, index) => index < count ? '●' : '○');
  document.getElementById('rhythm-tap-count').textContent = marks.join(' ');
}

function animatePlate(className) {
  const plate = document.getElementById('striking-plate');
  plate.classList.remove(className);
  void plate.getBoundingClientRect();
  plate.classList.add(className);
  scheduleGame(() => plate.classList.remove(className), className === 'plate-reject' ? 430 : 180);
}

function intervalMatchesRhythm(type, interval) {
  return type === 'short'
    ? interval >= 250 && interval <= 750
    : interval >= 800 && interval <= 1600;
}

function rejectRhythmAttempt() {
  game.soundPuzzle.taps = [];
  game.soundPuzzle.lastTap = 0;
  updateTapIndicator(0);
  animatePlate('plate-reject');
  playMechanicalSound('reject');
  showMessage('The plate answers with a deadened mechanical thud.');
}

function solveSoundPuzzle() {
  if (game.soundPuzzle.solved) return;
  game.soundPuzzle.solved = true;
  game.puzzles.sound = true;
  document.getElementById('room-trapdoor-detail').classList.add('trapdoor-solved');
  document.getElementById('striking-plate').setAttribute('aria-label', 'The solved brass plate glows above the open trapdoor');
  updateTapIndicator(5);
  showMessage('The rhythm takes hold. Gears turn beneath the floor and the trapdoor opens.');
}

function strikeRhythmPlate() {
  if (game.transitioning || game.closeUp !== 'trapdoor' || game.soundPuzzle.solved) return;
  getEffectsAudioContext();
  const now = performance.now();
  const taps = game.soundPuzzle.taps;

  if (taps.length > 0) {
    const interval = now - game.soundPuzzle.lastTap;
    if (interval < 250) return;
    const expected = soundRhythm[taps.length - 1];
    animatePlate('plate-strike');
    playMechanicalSound('plate');
    if (!intervalMatchesRhythm(expected, interval)) {
      rejectRhythmAttempt();
      return;
    }
  } else {
    animatePlate('plate-strike');
    playMechanicalSound('plate');
  }

  taps.push(now);
  game.soundPuzzle.lastTap = now;
  updateTapIndicator(taps.length);
  if (taps.length === 5) solveSoundPuzzle();
}

function takeMusicBox() {
  const musicBox = game.components.musicBox;
  if (game.transitioning || game.closeUp !== 'trapdoor' || !game.soundPuzzle.solved || musicBox.collected) return;
  musicBox.collected = true;
  document.getElementById('hidden-music-box').classList.add('puzzle-hidden');
  addInventoryItem('musicBox');
  renderInventory();
  showMessage('You recover the antique music box. A tiny brass cylinder waits inside its dark wooden case.');
}

function renderFrozenVessel() {
  const detail = document.getElementById('room-frozen-detail');
  detail.classList.toggle('valve-unlocked', game.frozen.valveUnlocked);
  detail.classList.toggle('drainage-active', game.frozen.drainageStarted);
  detail.classList.toggle('vessel-drained', game.frozen.drained);
  document.getElementById('valve-lock').classList.toggle('puzzle-hidden', game.frozen.valveUnlocked);
  document.getElementById('frozen-key').classList.toggle('puzzle-hidden', game.components.windingKey.collected);
  document.getElementById('valve-wheel').style.transform = `rotate(${game.frozen.valveRotations * 90}deg)`;
  document.getElementById('drain-valve').setAttribute('aria-label', game.frozen.valveUnlocked
    ? `Unlocked drainage valve, ${game.frozen.valveRotations} of 4 rotations`
    : 'Locked brass drainage valve');
}

function operateFrozenValve() {
  if (game.transitioning || game.closeUp !== 'frozen') return;
  if (!game.frozen.valveUnlocked) {
    if (game.selectedItem !== 'key' || !game.keyCollected || game.keyUsed) {
      showMessage('The valve is sealed. Something must unlock it.');
      return;
    }
    game.frozen.valveUnlocked = true;
    game.keyUsed = true;
    removeInventoryItem('key');
    document.getElementById('valve-lock').classList.add('puzzle-hidden');
    renderInventory();
    renderFrozenVessel();
    playMechanicalSound('plate');
    showMessage('The Brass Key turns once. The valve wheel is free, but still closed.');
    return;
  }
  if (game.frozen.drainageStarted) {
    showMessage(game.frozen.drained ? 'The vessel stands empty.' : 'Cold liquid is already draining through the pipe.');
    return;
  }
  if (game.frozen.valveRotations >= 4) return;
  game.frozen.valveRotations += 1;
  renderFrozenVessel();
  playMechanicalSound('plate');
  showMessage(`${game.frozen.valveRotations} of 4 valve turns. The frozen seals strain.`);
  if (game.frozen.valveRotations === 4) startFrozenDrainage();
}

function startFrozenDrainage() {
  if (game.frozen.drainageStarted) return;
  game.frozen.drainageStarted = true;
  renderFrozenVessel();
  showMessage('The drain opens. Pale blue liquid begins to leave the vessel.', 3600);
  scheduleGame(() => {
    game.frozen.drained = true;
    game.puzzles.touch = true;
    renderFrozenVessel();
    playMechanicalSound('plate');
    showMessage('The last frozen drop falls away. The vessel releases its golden heart.');
  }, 4200);
}

function takeWindingKey() {
  const windingKey = game.components.windingKey;
  if (game.transitioning || game.closeUp !== 'frozen' || windingKey.collected) return;
  if (!game.frozen.drained) {
    showMessage('The freezing liquid keeps it beyond reach.');
    return;
  }
  windingKey.collected = true;
  document.getElementById('frozen-key').classList.add('puzzle-hidden');
  addInventoryItem('windingKey');
  renderInventory();
  showMessage('You claim the Golden Winding Key. Its tiny gear engraving is cold beneath your fingers.');
}

function triggerWorkshopTremor() {
  const workshop = document.getElementById('room-workshop');
  workshop.classList.remove('pendulum-impact');
  void workshop.getBoundingClientRect();
  workshop.classList.add('pendulum-impact');
  scheduleGame(() => workshop.classList.remove('pendulum-impact'), 620);
}

function playPendingPendulumStep() {
  if (pendulumAnimationRunning || game.closeUp || game.currentView !== 1 || pendingPendulumSteps.length === 0) return;
  const pendulumAngles = [0, -12, -25, -55];
  const nextProgress = pendingPendulumSteps.shift();
  const oldAngle = pendulumAngles[renderedPendulumProgress];
  const newAngle = pendulumAngles[nextProgress];
  const overshootAngle = newAngle - 2.5;
  const pendulum = document.getElementById('workshop-pendulum');
  const workshop = document.getElementById('room-workshop');
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = reducedMotion ? 1 : 1100;

  pendulumAnimationRunning = true;
  workshop.classList.add('pendulum-moving');
  if (nextProgress === 3) {
    workshop.classList.add('final-activation');
    playMechanicalSound('unlock');
    showMessage('All three components answer. The central mechanism begins its final movement.', 3600);
  }
  pendulum.style.transform = `rotate(${newAngle}deg)`;
  pendulum.setAttribute('aria-label', `Massive pendulum, ${Math.abs(newAngle)} degrees left`);

  if (pendulum.animate && !reducedMotion) {
    if (pendulumWebAnimation) pendulumWebAnimation.cancel();
    pendulumWebAnimation = pendulum.animate([
      { transform: `rotate(${oldAngle}deg)`, offset: 0 },
      { transform: `rotate(${oldAngle - 1.2}deg)`, offset: .14 },
      { transform: `rotate(${overshootAngle}deg)`, offset: .78 },
      { transform: `rotate(${newAngle}deg)`, offset: 1 },
    ], { duration, easing: 'cubic-bezier(.34,.02,.2,1)', fill: 'none' });
  }

  scheduleGame(triggerWorkshopTremor, reducedMotion ? 0 : 790);
  scheduleGame(() => {
    renderedPendulumProgress = nextProgress;
    pendulumAnimationRunning = false;
    pendulumWebAnimation = null;
    workshop.classList.remove('pendulum-moving');
    if (nextProgress === 3) {
      game.pendulumFinalComplete = true;
      game.doorAccessible = true;
      document.getElementById('workshop-door-hotspot').classList.remove('puzzle-hidden');
      document.getElementById('workshop-door-hotspot').setAttribute('aria-hidden', 'false');
      showMessage('The pendulum locks into place. The central iron door is finally exposed.');
    }
    if (pendingPendulumSteps.length) scheduleGame(playPendingPendulumStep, reducedMotion ? 0 : 180);
  }, duration);
}

function updateRepairProgress() {
  const previousProgress = game.repairProgress;
  game.repairProgress = Object.values(game.components).filter(component => component.inserted).length;
  const pendulumAngles = [0, -12, -25, -55];
  const pendulum = document.getElementById('workshop-pendulum');
  const pendulumAngle = pendulumAngles[game.repairProgress];
  if (game.repairProgress === 0) {
    pendulum.style.transform = 'rotate(0deg)';
    pendulum.setAttribute('aria-label', 'Massive pendulum, vertical');
  } else if (game.repairProgress > previousProgress) {
    for (let step = previousProgress + 1; step <= game.repairProgress; step += 1) {
      if (!pendingPendulumSteps.includes(step)) pendingPendulumSteps.push(step);
    }
    if (!game.closeUp && game.currentView === 1) scheduleGame(playPendingPendulumStep, 80);
  } else if (!pendulumAnimationRunning) {
    pendulum.style.transform = `rotate(${pendulumAngle}deg)`;
  }
  const centralDoorHotspot = document.getElementById('workshop-door-hotspot');
  centralDoorHotspot.classList.toggle('puzzle-hidden', !game.doorAccessible);
  centralDoorHotspot.setAttribute('aria-hidden', String(!game.doorAccessible));
  const shaftDetail = document.getElementById('room-shaft-detail');
  shaftDetail.classList.toggle('shaft-active', game.repairProgress === 3);
  shaftDetail.setAttribute('aria-label', game.repairProgress === 3
    ? 'The completed repair desk is powering the drive shaft'
    : `Close-up of the repair desk, ${game.repairProgress} of 3 components fitted`);
  document.getElementById('shaft-status').textContent = game.repairProgress === 3
    ? 'THE REPAIR DESK ANSWERS — THE FINAL LOCK RELEASES'
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
  removeInventoryItem(componentName);
  if (componentName === 'glasses') {
    document.getElementById('socket-glasses-item').classList.remove('puzzle-hidden');
    document.getElementById('desk-glasses-item').classList.remove('puzzle-hidden');
    const socket = document.getElementById('socket-sight');
    const deskSocket = document.getElementById('desk-socket-sight');
    socket.classList.add('filled');
    deskSocket.classList.add('filled');
    socket.setAttribute('aria-label', 'Sight socket, filled with the antique glasses');
  } else if (componentName === 'musicBox') {
    document.getElementById('socket-musicbox-item').classList.remove('puzzle-hidden');
    document.getElementById('desk-musicbox-item').classList.remove('puzzle-hidden');
    const socket = document.getElementById('socket-sound');
    const deskSocket = document.getElementById('desk-socket-sound');
    socket.classList.add('filled');
    deskSocket.classList.add('filled');
    socket.setAttribute('aria-label', 'Sound socket, filled with the antique music box');
  } else if (componentName === 'windingKey') {
    document.getElementById('socket-windingkey-item').classList.remove('puzzle-hidden');
    document.getElementById('desk-windingkey-item').classList.remove('puzzle-hidden');
    const socket = document.getElementById('socket-touch');
    const deskSocket = document.getElementById('desk-socket-touch');
    socket.classList.add('filled');
    deskSocket.classList.add('filled');
    socket.setAttribute('aria-label', 'Touch socket, filled with the golden winding key');
  }
  updateRepairProgress();
  renderInventory();
  const insertionMessages = {
    glasses: 'The glasses settle into the sight socket. One part of the mechanism remembers its purpose.',
    musicBox: 'The music box locks into the sound socket. A muted resonance passes through the desk.',
    windingKey: 'The winding key seats in the touch socket. The desk shudders beneath your hand.',
  };
  showMessage(insertionMessages[componentName]);
}

function allComponentsInserted() {
  return Object.values(game.components).every(component => component.collected && component.inserted);
}

function lookAtRevealedDoor() {
  if (!allComponentsInserted() || !game.doorAccessible || !game.pendulumFinalComplete || game.currentView !== 1) return;
  startEndingCinematic();
}

function selectedVolumeRatio() {
  return Number(volumeIcon.dataset.level || 25) / 100;
}

function playCinematicTone(kind) {
  if (bgm.muted || !game.cinematicPlaying) return;
  const context = getEffectsAudioContext();
  if (!context) return;
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const settings = {
    door: { type: 'sawtooth', from: 76, to: 31, duration: 1.25, volume: .18 },
    step: { type: 'triangle', from: 112, to: 58, duration: .14, volume: .17 },
    tick: { type: 'square', from: 1280, to: 760, duration: .055, volume: .095 },
    heart: { type: 'sine', from: 86, to: 42, duration: .32, volume: .22 },
    stop: { type: 'sawtooth', from: 94, to: 28, duration: .75, volume: .25 },
  }[kind];
  if (!settings) return;
  oscillator.type = settings.type;
  oscillator.frequency.setValueAtTime(settings.from, now);
  oscillator.frequency.exponentialRampToValueAtTime(settings.to, now + settings.duration);
  gain.gain.setValueAtTime(selectedVolumeRatio() * settings.volume, now);
  gain.gain.exponentialRampToValueAtTime(.0001, now + settings.duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  cinematicAudioNodes.add(oscillator);
  oscillator.onended = () => {
    cinematicAudioNodes.delete(oscillator);
    oscillator.disconnect();
    gain.disconnect();
  };
  oscillator.start(now);
  oscillator.stop(now + settings.duration + .02);
}

function fadeBgmForCinematic(duration = 6500) {
  const initialLevel = bgm.volume;
  const generation = sessionGeneration;
  const startedAt = performance.now();
  const step = now => {
    if (generation !== sessionGeneration || !game.cinematicPlaying) return;
    const progress = Math.min(1, (now - startedAt) / duration);
    bgm.volume = initialLevel * (1 - progress);
    if (progress < 1) {
      cinematicFrame = requestAnimationFrame(step);
    } else {
      cinematicFrame = null;
      bgm.pause();
    }
  };
  cinematicFrame = requestAnimationFrame(step);
}

function scheduleCinematicAudio() {
  scheduleCinematic(() => playCinematicTone('door'), 500);
  scheduleCinematic(() => playCinematicTone('door'), 3100);
  [11600, 12400, 13200, 14000, 14800, 15600, 16400, 17200, 18000].forEach(delay => {
    scheduleCinematic(() => playCinematicTone('step'), delay);
  });
  [29200, 31100, 32900, 34600].forEach(delay => {
    scheduleCinematic(() => playCinematicTone('heart'), delay);
  });
  let tickTime = 28600;
  let interval = 690;
  while (tickTime < 40800) {
    scheduleCinematic(() => playCinematicTone('tick'), Math.round(tickTime));
    tickTime += interval;
    interval = Math.max(115, interval * .89);
  }
  scheduleCinematic(() => playCinematicTone('stop'), 40900);
}

function startEndingCinematic() {
  if (game.transitioning || game.endingTriggered || game.cinematicPlaying) return;
  game.transitioning = true;
  game.doorUnlocked = true;
  game.endingTriggered = true;
  game.cinematicPlaying = true;
  gameMessage.classList.remove('visible');
  closeVolumePanel();
  document.getElementById('game-screen').inert = true;
  endingCinematic.classList.remove('active');
  void endingCinematic.offsetWidth;
  endingCinematic.classList.add('active');
  endingCinematic.setAttribute('aria-hidden', 'false');
  fade.classList.remove('visible');
  fadeBgmForCinematic();
  scheduleCinematicAudio();
  scheduleCinematic(() => resetGame(), 47000);
}

function resetGame() {
  cancelPendingAsync();
  const freshState = createInitialGameState();
  Object.keys(game).forEach(key => delete game[key]);
  Object.assign(game, freshState);
  game.transitioning = true;

  introActive = false;
  introVideo.pause();
  try { introVideo.currentTime = 0; } catch (_) {}
  introOverlay.classList.add('is-hidden');
  introOverlay.setAttribute('aria-hidden', 'true');

  endingCinematic.classList.remove('active');
  endingCinematic.setAttribute('aria-hidden', 'true');
  document.getElementById('game-screen').inert = false;

  document.querySelectorAll('.puzzle-wheel').forEach((wheel, index) => {
    wheel.querySelector('text').textContent = '0';
    wheel.setAttribute('aria-label', `Digit ${index + 1}: 0. Click to advance`);
  });
  document.getElementById('drawer-closed-plate').classList.remove('puzzle-hidden');
  document.getElementById('drawer-open-tray').classList.add('puzzle-hidden');
  document.getElementById('drawer-key').classList.remove('puzzle-hidden');
  document.getElementById('floor-note').classList.remove('puzzle-hidden');

  document.getElementById('adjustable-clock').classList.remove('clock-unlocked', 'mechanical-tick');
  document.getElementById('clock-compartment').classList.add('puzzle-hidden');
  document.getElementById('clock-compartment-label').classList.add('puzzle-hidden');
  document.getElementById('clock-glasses').classList.add('puzzle-hidden');

  document.getElementById('room-sound-device-detail').classList.remove('sound-device-playing');
  document.getElementById('sound-hammer').classList.remove('hammer-strike');
  document.getElementById('room-trapdoor-detail').classList.remove('trapdoor-solved');
  document.getElementById('hidden-music-box').classList.remove('puzzle-hidden');
  document.getElementById('striking-plate').classList.remove('plate-strike', 'plate-reject');
  document.getElementById('striking-plate').setAttribute('aria-label', 'Strike the circular brass plate to reproduce the rhythm');
  updateTapIndicator(0);

  ['glasses', 'musicbox', 'windingkey'].forEach(name => {
    document.getElementById(`socket-${name}-item`).classList.add('puzzle-hidden');
    document.getElementById(`desk-${name}-item`).classList.add('puzzle-hidden');
  });
  const socketLabels = {
    sight: 'Sight socket, empty',
    sound: 'Sound socket, empty',
    touch: 'Touch socket, empty',
  };
  Object.entries(socketLabels).forEach(([name, label]) => {
    document.getElementById(`socket-${name}`).classList.remove('filled');
    document.getElementById(`socket-${name}`).setAttribute('aria-label', label);
    document.getElementById(`desk-socket-${name}`).classList.remove('filled');
  });

  const workshop = document.getElementById('room-workshop');
  workshop.classList.remove('pendulum-impact', 'pendulum-moving', 'final-activation');
  const pendulum = document.getElementById('workshop-pendulum');
  pendulum.style.transform = 'rotate(0deg)';
  pendulum.setAttribute('aria-label', 'Massive pendulum, vertical');
  renderedPendulumProgress = 0;
  pendulumAnimationRunning = false;
  pendingPendulumSteps.length = 0;
  document.getElementById('workshop-door-hotspot').classList.add('puzzle-hidden');
  document.getElementById('workshop-door-hotspot').setAttribute('aria-hidden', 'true');

  document.getElementById('door-open-detail').classList.add('puzzle-hidden');
  document.getElementById('door-lock-hotspot').classList.remove('puzzle-hidden');
  document.getElementById('door-lock-visual').classList.remove('lock-rattle');

  gameMessage.textContent = '';
  gameMessage.classList.remove('visible');
  closeVolumePanel();
  renderClock();
  renderFrozenVessel();
  updateRepairProgress();
  renderInventory();
  renderView();

  bgm.pause();
  try { bgm.currentTime = 0; } catch (_) {}
  bgm.volume = selectedVolumeRatio();
  bgm.muted = selectedVolumeRatio() === 0;

  fade.classList.add('visible');
  showScreen('landing-screen');
  scheduleGame(() => {
    fade.classList.remove('visible');
    game.transitioning = false;
  }, 650);
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
  document.getElementById('door-open-detail').classList.remove('puzzle-hidden');
  document.getElementById('door-lock-hotspot').classList.add('puzzle-hidden');
  renderInventory();
  renderView();
}

function runAction(element) {
  switch (element.dataset.action) {
    case 'zoom-central-door': lookAtRevealedDoor(); break;
    case 'zoom-drawer': openCloseUp('drawer', 0); break;
    case 'zoom-painting': openCloseUp('painting', 0); break;
    case 'zoom-clock': openCloseUp('clock', 0); break;
    case 'zoom-shaft': openCloseUp('shaft', 1); break;
    case 'zoom-sound-device': openCloseUp('sound-device', 2); break;
    case 'zoom-trapdoor': openCloseUp('trapdoor', 2); break;
    case 'zoom-frozen': openCloseUp('frozen', 2); break;
    case 'play-sound-clue': playSoundClue(); break;
    case 'strike-rhythm': strikeRhythmPlate(); break;
    case 'take-music-box': takeMusicBox(); break;
    case 'operate-valve': operateFrozenValve(); break;
    case 'take-winding-key': takeWindingKey(); break;
    case 'take-note': takePaperNote(); break;
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

function isVisibleInteraction(target) {
  if (!(target instanceof Element)) return false;
  const interactive = target.closest('button:not(:disabled), [data-action], .puzzle-wheel');
  return Boolean(interactive && !interactive.closest('[aria-hidden="true"]'));
}

document.addEventListener('pointerdown', event => {
  if (event.button === 0 && isVisibleInteraction(event.target)) playMechanicalSound('ui');
});

document.addEventListener('keydown', event => {
  if (!event.repeat && (event.key === 'Enter' || event.key === ' ') && isVisibleInteraction(event.target)) {
    playMechanicalSound('ui');
  }
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
renderFrozenVessel();
