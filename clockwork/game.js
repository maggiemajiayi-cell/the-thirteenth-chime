/* Clockmaker's Curse: fixed-view point-and-click starting version. */
const views = [
  { id: 'gears', name: 'Gear Wall' },
  { id: 'workshop', name: 'The Workshop' },
  { id: 'door', name: 'Iron Door' },
];

const game = {
  currentView: 1,
  previousViews: [],
  transitioning: false,
  soundOn: true,
};

const fade = document.getElementById('scene-fade');
const bgm = document.getElementById('bgm');
const introVideo = document.getElementById('intro-video');
const introOverlay = document.getElementById('intro-video-overlay');
let introActive = false;
let introWatchdog = null;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.toggle('active', screen.id === id);
  });
}

function displayView(index) {
  game.currentView = index;
  views.forEach((view, viewIndex) => {
    const element = document.getElementById('room-' + view.id);
    const active = viewIndex === index;
    element.classList.toggle('active-room', active);
    element.setAttribute('aria-hidden', String(!active));
  });
  document.getElementById('hud-room').textContent = views[index].name;
  document.getElementById('go-back').disabled = game.previousViews.length === 0;
}

function startGame() {
  if (game.transitioning) return;
  game.transitioning = true;
  game.previousViews = [];
  closeDialogue();
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
      showDialogue('The clockwork room waits in silence. Click an object to look closer.');
    }, 420);
  }, 240);
}

introVideo.addEventListener('ended', finishIntro);
introVideo.addEventListener('error', finishIntro);

function turnView(direction) {
  if (game.transitioning || !document.getElementById('game-screen').classList.contains('active')) return;
  game.previousViews.push(game.currentView);
  closeDialogue();
  displayView((game.currentView + direction + views.length) % views.length);
}

function goBack() {
  if (game.transitioning || game.previousViews.length === 0) return;
  closeDialogue();
  displayView(game.previousViews.pop());
}

function showDialogue(text) {
  document.getElementById('dialogue-text').textContent = text;
  document.getElementById('dialogue-box').classList.remove('hidden');
}

function closeDialogue() {
  document.getElementById('dialogue-box').classList.add('hidden');
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
  hotspot.addEventListener('click', () => showDialogue(hotspot.dataset.description));
  hotspot.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      showDialogue(hotspot.dataset.description);
    }
  });
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeDialogue();
});
