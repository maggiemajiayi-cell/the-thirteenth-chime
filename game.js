/* ==============================================
   THE FORGOTTEN ROOM — GAME ENGINE
   ============================================== */

// ─── STATE ───────────────────────────────────────────────────────────────────
const state = {
  currentRoom: 'study',
  inventory: [],            // array of item ids
  solvedPuzzles: new Set(), // puzzle ids that are completed
  notes: [],                // [{title, body}]
  selectedItem: null,       // item id currently "held" for use
  gameStartTime: null,
};

// ─── ITEMS ───────────────────────────────────────────────────────────────────
const ITEMS = {
  key_small: { id: 'key_small', name: 'Brass Key', icon: '🗝️', desc: 'A small brass key. Looks like it fits a drawer or a small lock.' },
  paper_clue: { id: 'paper_clue', name: 'Torn Letter', icon: '📄', desc: 'A torn piece of paper. It reads: "The code is hidden in plain sight — count the candles, count the roses, count the raven\'s eyes."' },
  lantern: { id: 'lantern', name: 'Lantern', icon: '🔦', desc: 'An oil lantern. It can illuminate dark areas.' },
  crowbar: { id: 'crowbar', name: 'Crowbar', icon: '🔧', desc: 'A heavy iron crowbar. Could pry open something stuck shut.' },
  cellar_key: { id: 'cellar_key', name: 'Cellar Key', icon: '🔑', desc: 'A large iron key. Must unlock something heavy.' },
  code_page: { id: 'code_page', name: 'Cipher Page', icon: '📋', desc: 'A page with symbols mapped to numbers: 🕯️=3, 🌹=7, 👁️=2. The final code: 372.' },
};

// ─── PUZZLE DEFINITIONS ──────────────────────────────────────────────────────
const PUZZLES = {
  // Bookshelf puzzle: rearrange books (multiple choice)
  bookshelf: {
    id: 'bookshelf',
    title: 'The Bookshelf',
    desc: 'Three books stick out further than the rest. Their spines read "A", "Z", and "M". Which order do they go in to match the inscription: "Begin with the end, end with what lies between"?',
    type: 'choice',
    choices: ['A → Z → M', 'Z → A → M', 'M → A → Z', 'Z → M → A'],
    answer: 1, // Z → A → M
    reward: 'key_small',
    rewardNote: { title: 'BOOKSHELF SECRET', body: 'Behind the rearranged books, you found a hidden Brass Key.' },
    successText: 'The books click into place. A hidden compartment slides open revealing a small brass key!',
  },

  // Painting puzzle: find the combination
  painting: {
    id: 'painting',
    title: 'The Painting',
    desc: 'A dark oil painting depicts a moonlit graveyard. Counting carefully, you see: 3 candles, 7 roses, and a raven with 2 eyes. Something about this feels important...',
    type: 'observe',
    successText: 'You study the painting carefully. Three candles... seven roses... a raven staring back with two cold eyes. You commit this to memory.',
    rewardNote: { title: 'PAINTING OBSERVATION', body: 'The painting shows: 3 candles 🕯️, 7 roses 🌹, 2 raven eyes 👁️. Perhaps these numbers form a code: 3 - 7 - 2?' },
  },

  // Desk puzzle: open the locked drawer with the brass key
  desk: {
    id: 'desk',
    title: 'The Writing Desk',
    desc: 'A heavy oak desk covered in old manuscripts. The central drawer is locked tight. There\'s also a peculiar manuscript with strange symbols on it.',
    type: 'key_use',
    requiredItem: 'key_small',
    reward: 'paper_clue',
    rewardNote: { title: 'DESK DRAWER', body: 'Inside the locked drawer: a torn letter referencing "candles, roses, and a raven\'s eyes." It confirms the painting code.' },
    successText: 'The brass key turns perfectly. The drawer slides open. Inside you find a torn letter and a cipher page!',
    lockedText: 'The central drawer is locked. You\'d need a key to open it.',
    extraReward: 'code_page',
  },

  // Safe puzzle: 3-digit combination
  safe: {
    id: 'safe',
    title: 'The Iron Safe',
    desc: 'An old iron safe is mounted into the wall. There\'s a 3-digit combination dial. The engraving above reads: "🕯️🌹👁️"',
    type: 'keypad',
    answer: '372',
    requiredSolved: ['painting'],
    reward: 'cellar_key',
    rewardNote: { title: 'SAFE OPENED', body: 'The safe swings open! Inside: a large iron key labelled "CELLAR." There must be another room below.' },
    successText: '3... 7... 2. The mechanism clicks. The safe swings open! You find the cellar key inside.',
    hintText: 'The engravings suggest: candles, roses, raven\'s eyes. Study the painting for the numbers.',
  },

  // Door (study): locked, needs cellar key
  door_study: {
    id: 'door_study',
    title: 'The Locked Door',
    desc: 'The heavy oak door is the way out — but it\'s secured with a large padlock and two separate deadbolts. This won\'t budge.',
    type: 'observe',
    successText: 'The door is heavily barricaded from the outside. Padlocked. Bolted twice. There must be another way out...',
  },

  // Lamp
  lamp: {
    id: 'lamp',
    title: 'The Oil Lamp',
    desc: 'An antique oil lamp. It\'s still lit, casting warm orange light. Underneath the base, scratched into the metal: "When all is dark, fire shows the way."',
    type: 'observe',
    successText: 'The lamp casts warm light across the room. Scratched beneath its base: "When all is dark, fire shows the way." You take the lamp — it might be useful.',
    reward: 'lantern',
    rewardNote: { title: 'OIL LAMP', body: 'Took the oil lantern from the desk lamp. It will help illuminate dark places.' },
  },

  // Cellar: barrel
  barrel: {
    id: 'barrel',
    title: 'The Old Barrel',
    desc: 'A massive oak barrel. You tip it slightly — something heavy slides inside. The lid is jammed shut.',
    type: 'key_use',
    requiredItem: 'crowbar',
    reward: null,
    successText: 'You pry the barrel lid open with the crowbar. Inside: just old, musty wine. But hidden under a false bottom — a folded note!',
    lockedText: 'The barrel lid is jammed shut. You\'d need something to pry it open.',
    rewardNote: { title: 'BARREL SECRET', body: 'A note under the false bottom reads: "The hatch lock combination mirrors the year this house was built: 1847."' },
    specialAction: 'barrel_opened',
  },

  // Cellar: toolbox
  toolbox: {
    id: 'toolbox',
    title: 'The Toolbox',
    desc: 'A battered metal toolbox. The latch is broken, so the lid hangs open. Inside you find various rusted tools — and a heavy iron crowbar.',
    type: 'collect',
    reward: 'crowbar',
    rewardNote: { title: 'TOOLBOX', body: 'Found a crowbar in the toolbox. Could be used to pry something open.' },
    successText: 'You rummage through the toolbox and pull out a heavy crowbar. This could be useful.',
  },

  // Cellar: wall writing
  'wall-code': {
    id: 'wall-code',
    title: 'Writing on the Wall',
    desc: 'Scratched into the stone wall, barely visible:  "I  VIII  IV  VII"\nBelow it, a Roman numeral key: I=1, V=5, X=10.\nWhat year does this represent?',
    type: 'observe',
    successText: 'You decipher the Roman numerals: I=1, VIII=8, IV=4, VII=7. Together: 1847. You add this to your notes.',
    rewardNote: { title: 'WALL INSCRIPTION', body: 'Roman numerals on the wall: I VIII IV VII = 1847. This must be a code for something.' },
  },

  // Cellar: iron hatch (escape!)
  hatch: {
    id: 'hatch',
    title: 'The Iron Hatch',
    desc: 'A heavy iron hatch set into the floor. A 4-digit combination lock secures it. Above the lock, a compass rose is engraved with the points marked N=1, E=8, S=4, W=7.',
    type: 'keypad',
    answer: '1847',
    requiredSolved: ['wall-code'],
    successText: 'The lock clicks open! You heave the hatch upward — a shaft of cold night air rushes in. FREEDOM!',
    isEscape: true,
    hintText: 'The wall writings and the compass rose directions might tell you the combination...',
  },
};

// ─── PARTICLE SPAWNER ────────────────────────────────────────────────────────
function spawnParticles() {
  const container = document.getElementById('particles');
  for (let i = 0; i < 35; i++) {
    setTimeout(() => {
      const p = document.createElement('div');
      p.className = 'particle';
      const size = Math.random() * 3 + 1;
      p.style.cssText = `
        width: ${size}px; height: ${size}px;
        left: ${Math.random() * 100}%;
        animation-duration: ${8 + Math.random() * 12}s;
        animation-delay: ${Math.random() * 10}s;
        opacity: 0;
      `;
      container.appendChild(p);
    }, i * 150);
  }
}

// ─── SCREEN TRANSITIONS ──────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ─── START GAME ──────────────────────────────────────────────────────────────
function startGame() {
  // Reset state
  state.currentRoom = 'study';
  state.inventory = [];
  state.solvedPuzzles = new Set();
  state.notes = [];
  state.selectedItem = null;
  state.gameStartTime = Date.now();

  showScreen('game-screen');
  renderSidebar();
  goRoom('study');
  showDialogue('You regain consciousness. Your head throbs. The room smells of old wood and secrets. <em>Find a way out.</em>');
}

// ─── ROOM NAVIGATION ─────────────────────────────────────────────────────────
const ROOM_NAMES = { study: 'The Study', cellar: 'The Cellar' };

function goRoom(roomId) {
  // Check access
  if (roomId === 'cellar' && !state.solvedPuzzles.has('safe')) {
    showDialogue('The trapdoor to the cellar seems to be secured with a lock. You\'ll need a key to open it.');
    return;
  }
  document.querySelectorAll('.room').forEach(r => r.classList.remove('active-room'));
  document.getElementById(`room-${roomId}`).classList.add('active-room');
  state.currentRoom = roomId;
  document.getElementById('hud-room').textContent = ROOM_NAMES[roomId] || roomId;
  closeDialogue();
  closeAllModals();
}

// ─── INTERACTION ─────────────────────────────────────────────────────────────
function interact(objId) {
  // If we have an item selected (use mode), try using it
  if (state.selectedItem) {
    tryUseItem(objId);
    return;
  }

  const puzzle = PUZZLES[objId];
  if (!puzzle) {
    showDialogue('Nothing unusual here.');
    return;
  }

  // Special case: safe door in study → go to cellar
  if (objId === 'door' || objId === 'door_study') {
    if (state.solvedPuzzles.has('hatch')) { triggerWin(); return; }
    openPuzzle('door_study');
    return;
  }

  // Already solved?
  if (state.solvedPuzzles.has(objId)) {
    showDialogue(`You've already examined this. <em>${getRevisitText(objId)}</em>`);
    return;
  }

  openPuzzle(objId);
}

function getRevisitText(id) {
  const texts = {
    bookshelf: 'The books are back in their secret order. The compartment is empty.',
    painting: 'The painting still watches you. 3 candles, 7 roses, 2 eyes...',
    desk: 'The drawer is open and empty.',
    safe: 'The safe hangs open. Nothing left inside.',
    lamp: 'The lamp sits on the desk, still glowing faintly.',
    barrel: 'The barrel is open, its false bottom exposed.',
    toolbox: 'Empty toolbox. You took the crowbar.',
    'wall-code': 'The inscription: I VIII IV VII — 1847.',
    'wall-code': 'The wall still shows the Roman numerals.',
  };
  return texts[id] || 'Nothing more to find here.';
}

// ─── PUZZLE MODAL ─────────────────────────────────────────────────────────────
function openPuzzle(puzzleId) {
  const puzzle = PUZZLES[puzzleId];
  if (!puzzle) return;

  closeDialogue();
  const modal = document.getElementById('puzzle-modal');
  const content = document.getElementById('puzzle-content');

  let html = `<h2 class="puzzle-title">${puzzle.title}</h2>`;
  html += `<p class="puzzle-desc">${puzzle.desc}</p>`;

  if (puzzle.type === 'observe') {
    html += `<button class="puzzle-btn" onclick="solvePuzzle('${puzzleId}', null)">🔍 Examine</button>`;

  } else if (puzzle.type === 'collect') {
    html += `<button class="puzzle-btn" onclick="solvePuzzle('${puzzleId}', null)">✋ Take it</button>`;

  } else if (puzzle.type === 'key_use') {
    if (hasItem(puzzle.requiredItem)) {
      html += `<button class="puzzle-btn" onclick="solvePuzzle('${puzzleId}', null)">🗝️ Use ${ITEMS[puzzle.requiredItem].name}</button>`;
    } else {
      html += `<p style="color:#9e8d78;font-style:italic;margin-bottom:16px;">🔒 ${puzzle.lockedText}</p>`;
      html += `<p style="font-size:0.75rem;color:#5a4f4a;font-family:var(--font-mono);">You need a specific item to interact with this.</p>`;
    }

  } else if (puzzle.type === 'choice') {
    html += `<div class="choice-grid">`;
    puzzle.choices.forEach((c, i) => {
      html += `<button class="choice-btn" onclick="solvePuzzle('${puzzleId}', ${i})">${c}</button>`;
    });
    html += `</div>`;

  } else if (puzzle.type === 'keypad') {
    // Check if prerequisite solved
    if (puzzle.requiredSolved && puzzle.requiredSolved.some(id => !state.solvedPuzzles.has(id))) {
      html += `<p style="color:#9e8d78;font-style:italic;margin-bottom:16px;">🔒 The lock mechanism is unknown to you yet. Find more clues.</p>`;
      html += `<p style="font-size:0.75rem;color:#5a4f4a;font-family:var(--font-mono);">${puzzle.hintText || 'Look around for clues...'}</p>`;
    } else {
      const digits = puzzle.answer.length;
      html += `<input class="puzzle-input" id="keypad-input" type="text" placeholder="${'_'.repeat(digits)}" maxlength="${digits}" readonly />`;
      html += `<div class="keypad">`;
      for (let i = 1; i <= 9; i++) {
        html += `<button class="key-btn" onclick="keypadPress('${puzzleId}', '${i}')">${i}</button>`;
      }
      html += `<button class="key-btn" onclick="keypadPress('${puzzleId}', 'C')" style="color:#ff8888">C</button>`;
      html += `<button class="key-btn" onclick="keypadPress('${puzzleId}', '0')">0</button>`;
      html += `<button class="key-btn" onclick="keypadPress('${puzzleId}', 'OK')" style="color:#6aef9e;font-size:0.85rem">ENTER</button>`;
      html += `</div>`;
    }
  }

  html += `<button class="puzzle-close-btn" onclick="closePuzzle()">✕ Step Away</button>`;
  content.innerHTML = html;
  modal.classList.remove('hidden');
}

function keypadPress(puzzleId, key) {
  const input = document.getElementById('keypad-input');
  if (!input) return;
  const puzzle = PUZZLES[puzzleId];

  if (key === 'C') { input.value = ''; return; }
  if (key === 'OK') {
    solvePuzzle(puzzleId, input.value);
    return;
  }
  if (input.value.length < puzzle.answer.length) {
    input.value += key;
  }
}

// ─── SOLVE PUZZLE ─────────────────────────────────────────────────────────────
function solvePuzzle(puzzleId, answer) {
  const puzzle = PUZZLES[puzzleId];
  if (!puzzle) return;

  let correct = false;

  if (puzzle.type === 'observe' || puzzle.type === 'collect' || puzzle.type === 'key_use') {
    correct = true;
  } else if (puzzle.type === 'choice') {
    correct = (answer === puzzle.answer);
  } else if (puzzle.type === 'keypad') {
    correct = (String(answer) === String(puzzle.answer));
  }

  if (!correct) {
    // Wrong answer
    const input = document.getElementById('keypad-input');
    if (input) {
      input.classList.add('shake');
      setTimeout(() => { input.classList.remove('shake'); input.value = ''; }, 500);
    }
    const choiceBtns = document.querySelectorAll('.choice-btn');
    choiceBtns.forEach(b => { b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 500); });
    showDialogue('That doesn\'t seem right. Look for more clues...');
    return;
  }

  // ✅ Correct!
  state.solvedPuzzles.add(puzzleId);
  closePuzzle();

  // Show success dialogue
  showDialogue(puzzle.successText || 'You solved it!');

  // Give reward item
  if (puzzle.reward) {
    addItem(puzzle.reward);
  }
  if (puzzle.extraReward) {
    addItem(puzzle.extraReward);
  }

  // Remove item if key_use type consumed it
  if (puzzle.type === 'key_use' && puzzle.requiredItem) {
    // Keep the item (keys don't break), just mark as found
  }

  // Add note
  if (puzzle.rewardNote) {
    addNote(puzzle.rewardNote.title, puzzle.rewardNote.body);
  }

  // Special actions
  if (puzzle.specialAction === 'barrel_opened') {
    addNote('BARREL NOTE', 'A hidden note reads: "The hatch lock combination mirrors the year this house was built: 1847."');
  }

  // Make cellar accessible when safe is solved
  if (puzzleId === 'safe') {
    makeRoomAccessible();
  }

  // Win condition
  if (puzzle.isEscape) {
    setTimeout(() => triggerWin(), 1800);
  }
}

function makeRoomAccessible() {
  // Add a cellar entry point visually
  addNote('CELLAR KEY', 'A large iron key — there must be a cellar below. Search the room for a hidden trapdoor.');
}

// ─── INVENTORY SIDEBAR ────────────────────────────────────────────────────────
function hasItem(id) { return state.inventory.includes(id); }

function addItem(id) {
  if (!state.inventory.includes(id)) {
    state.inventory.push(id);
    renderSidebar();
    flashSidebar();
  }
}

function renderSidebar() {
  const list = document.getElementById('inv-sidebar-list');
  const empty = document.getElementById('inv-sidebar-empty');
  if (!list) return;

  // Clear old cards (keep empty placeholder)
  list.querySelectorAll('.inv-card').forEach(c => c.remove());

  if (state.inventory.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  state.inventory.forEach(id => {
    const item = ITEMS[id];
    const card = document.createElement('div');
    card.className = 'inv-card' + (state.selectedItem === id ? ' selected' : '');
    card.id = `inv-card-${id}`;
    card.title = item.desc;
    card.innerHTML = `
      <div class="inv-card-icon">${item.icon}</div>
      <div class="inv-card-name">${item.name}</div>
    `;
    card.addEventListener('click', () => selectItem(id));
    list.appendChild(card);
  });

  updateSidebarFooter();
}

function updateSidebarFooter() {
  const footer = document.getElementById('inv-sidebar-footer');
  if (!footer) return;
  if (state.selectedItem && ITEMS[state.selectedItem]) {
    const item = ITEMS[state.selectedItem];
    document.getElementById('inv-footer-icon').textContent = item.icon;
    document.getElementById('inv-footer-name').textContent = item.name;
    document.getElementById('inv-footer-desc').textContent = item.desc;
    footer.style.display = 'flex';
  } else {
    footer.style.display = 'none';
  }
}

function flashSidebar() {
  const sidebar = document.getElementById('inv-sidebar');
  if (!sidebar) return;
  sidebar.style.boxShadow = '-4px 0 25px rgba(212,168,83,0.55)';
  setTimeout(() => { sidebar.style.boxShadow = ''; }, 1500);
}

function selectItem(id) {
  state.selectedItem = (state.selectedItem === id) ? null : id;
  // Update card selected state
  document.querySelectorAll('.inv-card').forEach(c => c.classList.remove('selected'));
  if (state.selectedItem) {
    const card = document.getElementById(`inv-card-${id}`);
    if (card) card.classList.add('selected');
  }
  updateSidebarFooter();
  updateUsePrompt();
}

function cancelUse() {
  state.selectedItem = null;
  document.querySelectorAll('.inv-card').forEach(c => c.classList.remove('selected'));
  updateSidebarFooter();
  updateUsePrompt();
}

function updateUsePrompt() {
  const prompt = document.getElementById('use-prompt');
  const nameEl = document.getElementById('use-item-name');
  if (!prompt) return;
  if (state.selectedItem) {
    const item = ITEMS[state.selectedItem];
    nameEl.textContent = `${item.icon} ${item.name}`;
    prompt.classList.remove('hidden');
  } else {
    prompt.classList.add('hidden');
  }
}

function tryUseItem(targetId) {
  const puzzle = PUZZLES[targetId];
  if (!puzzle) {
    showDialogue('You can\'t use that here.');
    cancelUse();
    return;
  }
  if (puzzle.type === 'key_use' && puzzle.requiredItem === state.selectedItem) {
    if (state.solvedPuzzles.has(targetId)) {
      showDialogue('You\'ve already used this here.');
    } else {
      cancelUse();
      solvePuzzle(targetId, null);
    }
  } else {
    showDialogue(`The ${ITEMS[state.selectedItem].name} doesn't work on that.`);
  }
  cancelUse();
}

// Legacy stubs (kept so any old HTML onclick still works)
function openInventory() { }
function closeInventory() { document.getElementById('inventory-modal')?.classList.add('hidden'); }


// ─── NOTES ───────────────────────────────────────────────────────────────────
function addNote(title, body) {
  state.notes.push({ title, body });
}

function openNotes() {
  const modal = document.getElementById('notes-modal');
  const content = document.getElementById('notes-content');
  if (state.notes.length === 0) {
    content.innerHTML = '<p class="notes-empty">No notes yet. Examine objects to discover clues.</p>';
  } else {
    content.innerHTML = state.notes.map(n =>
      `<div class="note-entry"><strong>${n.title}</strong>${n.body}</div>`
    ).join('');
  }
  modal.classList.remove('hidden');
}

function closeNotes() { document.getElementById('notes-modal').classList.add('hidden'); }

// ─── DIALOGUE ────────────────────────────────────────────────────────────────
let dialogueTimeout = null;
function showDialogue(text) {
  const box = document.getElementById('dialogue-box');
  const textEl = document.getElementById('dialogue-text');
  textEl.innerHTML = text;
  box.classList.remove('hidden');
  if (dialogueTimeout) clearTimeout(dialogueTimeout);
  dialogueTimeout = setTimeout(() => closeDialogue(), 6000);
}
function closeDialogue() {
  document.getElementById('dialogue-box').classList.add('hidden');
  if (dialogueTimeout) clearTimeout(dialogueTimeout);
}

// ─── MODALS CLOSE ────────────────────────────────────────────────────────────
function closePuzzle() { document.getElementById('puzzle-modal').classList.add('hidden'); }
function closeAllModals() {
  closePuzzle();
  closeInventory();
  closeNotes();
}

// ─── WIN / LOSE ───────────────────────────────────────────────────────────────
function triggerWin() {
  const elapsed = Math.floor((Date.now() - state.gameStartTime) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  document.getElementById('win-time').textContent = `Escaped in ${m}m ${s}s`;
  showScreen('win-screen');
}

function triggerLose() {
  showScreen('lose-screen');
}

function resetGame() {
  showScreen('landing-screen');
}

// ─── KEYBOARD SHORTCUTS ───────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closePuzzle();
    closeInventory();
    closeNotes();
    closeDialogue();
    cancelUse();
  }
  if (e.key === 'i' || e.key === 'I') openInventory();
  if (e.key === 'n' || e.key === 'N') openNotes();
});

// ─── CELLAR ACCESS VIA SAFE ──────────────────────────────────────────────────
// Patch desk interaction to check if cellar key interaction is needed
const origInteract = window.interact;

// Add desk cellar-door interaction
function addCellarTrapdoor() {
  // Visual hint added to study room after safe solved
}

// Override the safe to open cellar area
const originalSolveSafe = PUZZLES.safe;

// ─── INIT ─────────────────────────────────────────────────────────────────────
spawnParticles();

// Add desk examination override — desk needs cellar_key to enter cellar
// Here we hook: when player examines desk after solving safe,
// they can discover the trapdoor. We handle this by making the safe unlock
// the cellar room directly via the already-provided goRoom logic.

// Patch: add cellar entry to study room after safe is solved
const originalSolvePuzzle = solvePuzzle;

// Visual: highlight the cellar entry after safe is flagged solved
// This is handled in the goRoom function's existing check.

console.log('%c🗝️ THE FORGOTTEN ROOM', 'color:#d4a853;font-size:24px;font-weight:bold;font-family:serif;');
console.log('%cVersion 1.0 | Solve the puzzles, escape the room.', 'color:#8b6914;font-family:serif;');
