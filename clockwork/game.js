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
  soundOn: true,
};

const fade = document.getElementById('scene-fade');
const bgm = document.getElementById('bgm');
const introVideo = document.getElementById('intro-video');
const introOverlay = document.getElementById('intro-video-overlay');
let introActive = false;
let introWatchdog = null;
let captionTimer = null;

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
  clearCaption();
  fade.classList.add('visible');

  bgm.volume = 0.25;
  if (game.soundOn) bgm.play().catch(() => {});
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
  clearCaption();
  displayView((game.currentView + direction + views.length) % views.length);
}

function goBack() {
  if (game.transitioning || !game.doorCloseUp) return;
  clearCaption();
  game.doorCloseUp = false;
  renderView();
}

function lookAtDoor() {
  if (game.transitioning || game.doorCloseUp) return;
  game.doorCloseUp = true;
  renderView();
  showCaption('The iron door fills your view. Use ↓ to return to the room.');
}

function showCaption(text) {
  clearCaption();
  const caption = document.getElementById('scene-caption');
  caption.textContent = text;
  caption.classList.add('visible');
  captionTimer = window.setTimeout(clearCaption, 5500);
}

function clearCaption() {
  if (captionTimer) window.clearTimeout(captionTimer);
  captionTimer = null;
  const caption = document.getElementById('scene-caption');
  caption.textContent = '';
  caption.classList.remove('visible');
}

function toggleSound() {
  game.soundOn = !game.soundOn;
  bgm.muted = !game.soundOn;
  if (game.soundOn && document.getElementById('game-screen').classList.contains('active')) {
    bgm.play().catch(() => {});
  }
  const button = document.getElementById('sound-toggle');
  button.textContent = game.soundOn ? 'Sound on' : 'Sound off';
  button.setAttribute('aria-pressed', String(game.soundOn));
}

document.querySelectorAll('.hotspot').forEach(hotspot => {
  const inspect = () => {
    if (hotspot.dataset.action === 'zoom-door') lookAtDoor();
    else showCaption(hotspot.dataset.description);
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
  if (event.key === 'Escape') clearCaption();
});
