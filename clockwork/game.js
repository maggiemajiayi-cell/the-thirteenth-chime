/* Clockmaker's Curse: fixed-view point-and-click starting version. */
const views = [
  { id: 'gears', name: 'Gear Wall' },
  { id: 'workshop', name: 'The Workshop' },
  { id: 'door', name: 'Iron Door' },
];

const game = {
  currentView: 1,
  doorCloseUp: false,
  transitioning: false,
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
  game.doorCloseUp = false;
  renderView();
}

function renderView() {
  views.forEach((view, viewIndex) => {
    const element = document.getElementById('room-' + view.id);
    const active = !game.doorCloseUp && viewIndex === game.currentView;
    element.classList.toggle('active-room', active);
    element.setAttribute('aria-hidden', String(!active));
  });
  const closeUp = document.getElementById('room-door-detail');
  closeUp.classList.toggle('active-room', game.doorCloseUp);
  closeUp.setAttribute('aria-hidden', String(!game.doorCloseUp));
  document.getElementById('hud-room').textContent = game.doorCloseUp
    ? 'Iron Door · Close-up'
    : views[game.currentView].name;
  document.getElementById('go-back').hidden = !game.doorCloseUp;
  document.getElementById('turn-left').hidden = game.doorCloseUp;
  document.getElementById('turn-right').hidden = game.doorCloseUp;
}

function startGame() {
  if (game.transitioning) return;
  game.transitioning = true;
  game.doorCloseUp = false;
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
  if (game.transitioning || game.doorCloseUp || !document.getElementById('game-screen').classList.contains('active')) return;
  displayView((game.currentView + direction + views.length) % views.length);
}

function goBack() {
  if (game.transitioning || !game.doorCloseUp) return;
  game.doorCloseUp = false;
  renderView();
}

function lookAtDoor() {
  if (game.transitioning || game.doorCloseUp) return;
  game.doorCloseUp = true;
  renderView();
}

document.querySelectorAll('.hotspot').forEach(hotspot => {
  const inspect = () => {
    if (hotspot.dataset.action === 'zoom-door') lookAtDoor();
  };
  hotspot.addEventListener('click', inspect);
  hotspot.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      inspect();
    }
  });
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeVolumePanel();
});
