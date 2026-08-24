/* ==========================================================
   TICK TACK TOE — Game Logic, AI, Theme System & Sound
   ========================================================== */

// ── Level config ─────────────────────────────────────────
const LEVELS = {
  easy: {
    label: 'Easy', theme: 'classic',
    unlockCost: 0, winReward: 5, drawReward: 2,
    aiDelay: [400, 750],  // [min, max] ms
    boardSize: 3,
    winLength: 3,
  },
  medium: {
    label: 'Medium', theme: 'forest',
    unlockCost: 20, winReward: 15, drawReward: 4,
    aiDelay: [300, 600],
    boardSize: 3,
    winLength: 3,
  },
  hard: {
    label: 'Hard', theme: 'volcanic',
    unlockCost: 50, winReward: 40, drawReward: 8,
    aiDelay: [280, 620],
    boardSize: 4,
    winLength: 3,
  },
  expert: {
    label: 'Expert', theme: 'space',
    unlockCost: 100, winReward: 60, drawReward: 12,
    aiDelay: [120, 280],  // faster — feels more intense
    boardSize: 5,
    winLength: 3,
  },
  legend: {
    label: 'Legend', theme: 'neon',
    unlockCost: 200, winReward: 100, drawReward: 20,
    aiDelay: [40, 130],   // near-instant — terrifying
    boardSize: 6,
    winLength: 3,
  },
  master: {
    label: 'Master', theme: 'space',
    unlockCost: 320, winReward: 130, drawReward: 24,
    aiDelay: [25, 90],
    boardSize: 7,
    winLength: 3,
  },
  mythic: {
    label: 'Mythic', theme: 'neon',
    unlockCost: 480, winReward: 170, drawReward: 32,
    aiDelay: [10, 70],
    boardSize: 8,
    winLength: 3,
  },
};

const TIMER_BONUS_MAX = 45;
const STREAK_BONUS_STEP = 6;
const MIN_WIN_LENGTH = 3;
const PVP_BOARD_SIZE = 3;

let GameCenter = null;
try {
  if (window.Capacitor) {
    GameCenter = Capacitor.Plugins?.GameCenter || null;
  }
} catch (_) {}

// ── Theme config ─────────────────────────────────────────
const THEME_META = {
  classic:  { name: 'Classic',  icon: '✦' },
  forest:   { name: 'Forest',   icon: '🌿' },
  volcanic: { name: 'Volcanic', icon: '🌋' },
  space:    { name: 'Space',    icon: '🚀' },
  neon:     { name: 'Neon',     icon: '👾' },
};

// ── State ────────────────────────────────────────────────
let state = {
  coins: 0,
  unlockedLevels: ['easy'],
  currentDifficulty: null,
  board: Array(9).fill(null),
  boardSize: 3,
  winLength: 3,
  winCombos: [],
  currentPlayer: 'X',
  gameOver: false,
  scores: { player: 0, ai: 0, draws: 0 },
  thinking: false,
  totalScore: 0,
  winStreak: 0,
  roundStartAt: 0,
  elapsedSeconds: 0,
  leaderboardEntries: [],
  leaderboardPage: 0,
  leaderboardPageSize: 10,
  leaderboardTotalPlayerCount: 0,
  leaderboardLocalRank: null,
  leaderboardLocalScore: null,
  online: {
    available: false,
    authenticated: false,
    alias: null,
    playerID: null,
    multiplayerRestricted: false,
  },
  pvp: {
    active: false,
    searching: false,
    isLocalTurn: true,
    symbol: 'X',
    localPlayerName: 'You',
    opponentName: 'Opponent',
    opponentID: null,
    localPlayerID: null,
    matchID: null,
  },
};

let _roundTimer = null;

function createWinCombos(size, winLength) {
  const combos = [];
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      directions.forEach(([dRow, dCol]) => {
        const endRow = row + (winLength - 1) * dRow;
        const endCol = col + (winLength - 1) * dCol;
        if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) return;

        const combo = [];
        for (let step = 0; step < winLength; step++) {
          combo.push((row + step * dRow) * size + (col + step * dCol));
        }
        combos.push(combo);
      });
    }
  }

  return combos;
}

function getCellCenter(index, size) {
  const row = Math.floor(index / size);
  const col = index % size;
  return [col + 0.5, row + 0.5];
}

function createBoardState(size) {
  return Array(size * size).fill(null);
}

function updateBoardMeta() {
  const gridLabel = document.getElementById('board-grid-label');
  const targetLabel = document.getElementById('board-target-label');
  if (!gridLabel || !targetLabel) return;

  gridLabel.textContent = `${state.boardSize}x${state.boardSize} grid`;
  targetLabel.textContent = state.boardSize > 3
    ? `${state.winLength}+ in a row pays more`
    : `${state.winLength} in a row wins`;
}

function getBoardAriaLabel(index) {
  const row = Math.floor(index / state.boardSize) + 1;
  const col = (index % state.boardSize) + 1;
  return `Row ${row}, column ${col}`;
}

function renderBoard() {
  const board = document.getElementById('board');
  if (!board) return;

  board.innerHTML = '';
  board.style.setProperty('--board-size', String(state.boardSize));
  board.classList.toggle('board-lg', state.boardSize >= 5);
  board.classList.toggle('board-xl', state.boardSize >= 6);

  for (let index = 0; index < state.board.length; index++) {
    const cell = document.createElement('div');
    const row = Math.floor(index / state.boardSize);
    const col = index % state.boardSize;
    cell.className = 'cell';
    if (col === state.boardSize - 1) cell.classList.add('edge-right');
    if (row === state.boardSize - 1) cell.classList.add('edge-bottom');
    cell.dataset.index = String(index);
    cell.setAttribute('role', 'button');
    cell.setAttribute('aria-label', getBoardAriaLabel(index));
    cell.addEventListener('click', () => handleCellClick(index));
    board.appendChild(cell);
  }

  const svg = document.getElementById('win-line-svg');
  if (svg) {
    svg.setAttribute('viewBox', `0 0 ${state.boardSize} ${state.boardSize}`);
  }

  updateBoardMeta();
}

function applyLevelBoard(level) {
  state.boardSize = level.boardSize;
  state.winLength = level.winLength;
  state.winCombos = createWinCombos(level.boardSize, level.winLength);
  state.board = createBoardState(level.boardSize);
  renderBoard();
}

function formatElapsed(seconds) {
  return `${seconds.toFixed(1)}s`;
}

function updateRoundTimerUI() {
  const timer = document.getElementById('round-timer');
  const streak = document.getElementById('win-streak');
  if (timer) timer.textContent = formatElapsed(state.elapsedSeconds);
  if (streak) streak.textContent = String(state.winStreak);
}

function stopRoundTimer() {
  if (_roundTimer) {
    clearInterval(_roundTimer);
    _roundTimer = null;
  }
}

function startRoundTimer() {
  stopRoundTimer();
  state.roundStartAt = Date.now();
  state.elapsedSeconds = 0;
  updateRoundTimerUI();
  _roundTimer = setInterval(() => {
    state.elapsedSeconds = (Date.now() - state.roundStartAt) / 1000;
    updateRoundTimerUI();
  }, 100);
}

function getTimerBonus() {
  const bonus = Math.max(0, Math.round(TIMER_BONUS_MAX - state.elapsedSeconds * 3));
  return bonus;
}

function getStreakBonus() {
  if (state.winStreak <= 0) return 0;
  return state.winStreak * STREAK_BONUS_STEP;
}

function getRewardBreakdown(baseCoins, timerBonus, streakBonus) {
  const parts = [];
  if (baseCoins > 0) parts.push(`base ${baseCoins}`);
  if (timerBonus > 0) parts.push(`speed +${timerBonus}`);
  if (streakBonus > 0) parts.push(`streak +${streakBonus}`);
  return parts.join(' · ');
}

function getLineBonus(comboLength, cfg) {
  const extraMarks = Math.max(0, comboLength - MIN_WIN_LENGTH);
  if (!extraMarks) return 0;
  const bonusPerExtra = Math.max(10, Math.round(cfg.winReward * 0.22));
  return extraMarks * bonusPerExtra;
}

function getModeCount() {
  return Object.keys(LEVELS).length;
}

function renderMenuProgress() {
  const score = document.getElementById('menu-score');
  const coins = document.getElementById('menu-coins');
  const modeCount = document.getElementById('mode-count');
  const rankedScore = document.getElementById('menu-ranked-score');
  const rankedRank = document.getElementById('menu-ranked-rank');
  if (score) score.textContent = String(state.totalScore);
  if (coins) coins.textContent = String(state.coins);
  if (modeCount) modeCount.textContent = String(getModeCount());
  if (rankedScore) {
    const top = state.leaderboardEntries[0]?.score;
    rankedScore.textContent = typeof top === 'number' ? String(top) : '-';
  }
  if (rankedRank) {
    rankedRank.textContent = typeof state.leaderboardLocalRank === 'number'
      ? `Rank #${state.leaderboardLocalRank}`
      : 'Rank -';
  }
}

function toggleOnlineMenu(forceOpen) {
  const drawer = document.getElementById('online-drawer');
  if (!drawer) return;
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : drawer.hidden;
  drawer.hidden = !shouldOpen;
}

function renderHeroPlayerIdentity() {
  const heroName = document.getElementById('hero-player-name');
  const heroNote = document.getElementById('hero-player-note');
  const heroLogin = document.getElementById('hero-login-cta');
  const onlinePlayerId = document.getElementById('online-player-id');

  if (state.online.authenticated) {
    const identity = state.online.alias || 'Game Center player';
    if (heroName) heroName.textContent = identity;
    if (onlinePlayerId) onlinePlayerId.textContent = identity;
    if (heroNote) heroNote.textContent = 'Local progress stays on this device. Game Center is active for ranking and live matches.';
    if (heroLogin) heroLogin.textContent = 'Refresh Game Center';
  } else {
    if (heroName) heroName.textContent = 'Guest player';
    if (onlinePlayerId) onlinePlayerId.textContent = 'Guest player';
    if (heroNote) heroNote.textContent = 'Offline play stores progress only on this device. Sign in later if you want ranked scores or live matches.';
    if (heroLogin) heroLogin.textContent = 'Sign in for online play';
  }
}

function setOnlineStatus(text, authenticated = false) {
  const status = document.getElementById('gc-status');
  if (status) {
    status.textContent = text;
    status.style.color = authenticated ? '#8ef0b5' : 'var(--muted)';
  }
}

function setOnlineMessage(text) {
  const message = document.getElementById('gc-message');
  if (message) message.textContent = text;
}

function setPvpStatus(text, active = false) {
  const status = document.getElementById('pvp-status');
  if (status) {
    status.textContent = text;
    status.style.color = active ? '#8ec5ff' : 'var(--muted)';
  }
}

function setPvpMessage(text) {
  const message = document.getElementById('pvp-message');
  if (message) message.textContent = text;
}

function renderLeaderboard(entries = state.leaderboardEntries) {
  const list = document.getElementById('leaderboard-list');
  const pagination = document.getElementById('leaderboard-pagination');
  const pageIndicator = document.getElementById('leaderboard-page-indicator');
  const prev = document.getElementById('leaderboard-prev');
  const next = document.getElementById('leaderboard-next');
  const currentUser = document.getElementById('leaderboard-current-user');
  const currentValue = document.getElementById('leaderboard-current-value');
  if (!list) return;

  list.innerHTML = '';
  if (!entries.length) {
    if (pagination) pagination.hidden = true;
    if (currentUser) currentUser.hidden = true;
    const empty = document.createElement('li');
    empty.className = 'leaderboard-empty';
    empty.textContent = state.online.authenticated
      ? 'No ranked scores yet.'
      : 'Sign in to load the score board.';
    list.appendChild(empty);
    renderMenuProgress();
    return;
  }

  const totalPages = Math.max(1, Math.ceil((state.leaderboardTotalPlayerCount || entries.length) / state.leaderboardPageSize));
  if (pagination) pagination.hidden = totalPages <= 1;
  if (pageIndicator) pageIndicator.textContent = `Page ${state.leaderboardPage + 1} / ${totalPages}`;
  if (prev) prev.disabled = state.leaderboardPage <= 0;
  if (next) next.disabled = state.leaderboardPage >= totalPages - 1;

  if (currentUser) {
    const hasLocalRank = typeof state.leaderboardLocalRank === 'number' && typeof state.leaderboardLocalScore === 'number';
    currentUser.hidden = !hasLocalRank;
    if (hasLocalRank && currentValue) {
      currentValue.textContent = `#${state.leaderboardLocalRank} · ${state.leaderboardLocalScore}`;
    }
  }

  entries.forEach((entry) => {
    const item = document.createElement('li');
    item.className = 'leaderboard-entry';
    if (state.online.playerID && entry.gamePlayerID === state.online.playerID) {
      item.classList.add('current-user');
    }
    item.innerHTML = `
      <span class="leaderboard-rank">#${entry.rank}</span>
      <span class="leaderboard-name">${entry.displayName || entry.alias || 'Player'}</span>
      <span class="leaderboard-score">${entry.score}</span>
    `;
    list.appendChild(item);
  });
  renderMenuProgress();
}

function changeLeaderboardPage(direction) {
  const nextPage = Math.max(0, state.leaderboardPage + direction);
  if (nextPage === state.leaderboardPage) return;
  state.leaderboardPage = nextPage;
  loadOnlineLeaderboard();
}

function renderOnlineState() {
  if (!GameCenter) {
    state.online.available = false;
    setOnlineStatus('Native iOS only');
    setOnlineMessage('Online features appear inside the installed iOS app.');
    setPvpStatus('Unavailable');
    setPvpMessage('Install the iOS build for live opponents and ranked scores.');
    renderLeaderboard([]);
    renderHeroPlayerIdentity();
    return;
  }

  state.online.available = true;
  if (state.online.authenticated) {
    setOnlineStatus(`Signed in: ${state.online.alias || 'Player'}`, true);
    setOnlineMessage('Game Center is connected for optional ranking and live matches.');
  } else {
    setOnlineStatus('Game Center ready');
    setOnlineMessage('Sign in only for ranked scores and live matches. Offline progress stays on this device.');
  }

  if (state.pvp.searching) {
    setPvpStatus('Searching', true);
    setPvpMessage('Looking for a real-time opponent through Game Center.');
  } else if (state.pvp.active) {
    setPvpStatus('Live match', true);
    setPvpMessage(`Connected with ${state.pvp.opponentName}.`);
  } else if (state.online.multiplayerRestricted) {
    setPvpStatus('Restricted');
    setPvpMessage('This Game Center account cannot use multiplayer.');
  } else {
    setPvpStatus(state.online.authenticated ? 'Ready' : 'Offline', state.online.authenticated);
    setPvpMessage('Quick-match finds a live opponent and starts a clean head-to-head board.');
  }

  renderLeaderboard();
  renderHeroPlayerIdentity();
}

function setOpponentLabels() {
  const label = state.pvp.active ? `${state.pvp.opponentName} (${state.pvp.symbol === 'X' ? 'O' : 'X'})` : 'AI (O)';
  const badge = state.pvp.active ? state.pvp.opponentName : 'AI (O)';
  const playerLabel = state.pvp.active ? `${state.pvp.localPlayerName} (${state.pvp.symbol})` : 'You (X)';
  const scoreLabelOpponent = document.getElementById('score-label-opponent');
  const scoreLabelPlayer = document.getElementById('score-label-player');
  const badgeAI = document.getElementById('badge-ai');
  const badgePlayer = document.getElementById('badge-player');
  if (scoreLabelOpponent) scoreLabelOpponent.textContent = label;
  if (scoreLabelPlayer) scoreLabelPlayer.textContent = playerLabel;
  if (badgeAI) badgeAI.textContent = badge;
  if (badgePlayer) badgePlayer.textContent = playerLabel;
}

function getPvpRemoteSymbol() {
  return state.pvp.symbol === 'X' ? 'O' : 'X';
}

function setPvpIdentity(localPlayerID, opponentID, opponentName = 'Opponent') {
  state.pvp.localPlayerID = localPlayerID || null;
  state.pvp.opponentID = opponentID || null;
  state.pvp.opponentName = opponentName;

  const localKey = localPlayerID || 'local';
  const remoteKey = opponentID || 'remote';
  state.pvp.symbol = localKey.localeCompare(remoteKey) <= 0 ? 'X' : 'O';
  state.pvp.isLocalTurn = state.pvp.symbol === 'X';
}

function resetPvpState() {
  state.pvp.active = false;
  state.pvp.searching = false;
  state.pvp.symbol = 'X';
  state.pvp.isLocalTurn = true;
  state.pvp.localPlayerName = 'You';
  state.pvp.opponentName = 'Opponent';
  state.pvp.opponentID = null;
  state.pvp.localPlayerID = null;
  state.pvp.matchID = null;
}

function syncPvpScoreboard() {
  if (!state.pvp.active) return;
  sendPvpEvent({
    type: 'score',
    localWins: state.scores.player,
    remoteWins: state.scores.ai,
    draws: state.scores.draws,
  });
}

function startPvpRound(shouldNotifyRemote = false) {
  if (!state.pvp.active) return;
  state.currentDifficulty = 'pvp';
  state.winStreak = 0;
  const mode = {
    label: 'PvP',
    theme: 'classic',
    boardSize: PVP_BOARD_SIZE,
    winLength: 3,
  };

  document.getElementById('game-difficulty-label').textContent = 'PVP';
  document.getElementById('game-theme-label').textContent = `${state.pvp.opponentName} · ${state.pvp.symbol === 'X' ? 'You open' : 'Opponent opens'}`;
  applyTheme(mode.theme);
  applyLevelBoard(mode);
  resetBoard();
  setOpponentLabels();
  showScreen('game');

  if (shouldNotifyRemote) {
    sendPvpEvent({ type: 'reset' });
  }
}

async function initializeOnline() {
  renderOnlineState();
  if (!GameCenter) return;

  try {
    const availability = await GameCenter.isAvailable();
    state.online.available = Boolean(availability.available);
    state.online.authenticated = Boolean(availability.authenticated);
  } catch (_) {}

  const plugin = GameCenter;
  if (plugin.addListener) {
    plugin.addListener('authChanged', (payload) => {
      state.online.authenticated = Boolean(payload.authenticated);
      state.online.alias = payload.alias || null;
      state.online.playerID = payload.gamePlayerID || null;
      state.online.multiplayerRestricted = Boolean(payload.multiplayerRestricted);
      renderOnlineState();
      if (state.online.authenticated) loadOnlineLeaderboard();
    });

    plugin.addListener('matchStatusChanged', (payload) => {
      const status = payload.status;
      if (status === 'searching') {
        state.pvp.searching = true;
      } else if (status === 'matched') {
        state.pvp.searching = false;
        state.pvp.active = true;
        state.pvp.localPlayerName = state.online.alias || 'You';
        const opponent = Array.isArray(payload.opponents) ? payload.opponents[0] : null;
        setPvpIdentity(
          payload.localPlayerID || null,
          opponent?.gamePlayerID || null,
          opponent?.displayName || opponent?.alias || 'Opponent'
        );
        state.scores = { player: 0, ai: 0, draws: 0 };
        updateScoreUI();
        setOpponentLabels();
        startPvpRound(false);
      } else if (status === 'cancelled' || status === 'ended' || status === 'error') {
        state.pvp.searching = false;
        if (status !== 'error' && state.pvp.active) {
          resetPvpState();
          setOpponentLabels();
        }
      }
      renderOnlineState();
    });

    plugin.addListener('matchEvent', ({ playerID, payload }) => {
      if (!state.pvp.active || !payload) return;
      if (payload.type === 'move' && typeof payload.index === 'number') {
        applyRemoteMove(payload.index);
      }
      if (payload.type === 'reset') {
        startPvpRound(false);
      }
      if (payload.type === 'end') {
        leavePvpMode(false);
      }
      if (payload.type === 'score') {
        if (typeof payload.remoteWins === 'number') state.scores.player = payload.remoteWins;
        if (typeof payload.localWins === 'number') state.scores.ai = payload.localWins;
        if (typeof payload.draws === 'number') state.scores.draws = payload.draws;
        updateScoreUI();
      }
    });

    plugin.addListener('matchPresenceChanged', ({ state: presence, displayName }) => {
      if (presence === 'disconnected') {
        showToast(`${displayName || 'Opponent'} left the match.`);
        leavePvpMode(false);
      }
    });
  }

  renderOnlineState();
  if (state.online.authenticated) {
    loadOnlineLeaderboard();
  }
}

async function authenticateGameCenter() {
  if (!GameCenter) {
    showToast('Game Center is available in the native iOS app.');
    return;
  }

  try {
    const result = await GameCenter.authenticate();
    state.online.authenticated = Boolean(result.authenticated);
    state.online.alias = result.alias || null;
    state.online.playerID = result.gamePlayerID || null;
    state.online.multiplayerRestricted = Boolean(result.multiplayerRestricted);
    renderOnlineState();
    if (state.online.authenticated) {
      showToast(`Signed in as ${state.online.alias || 'Player'}`);
      loadOnlineLeaderboard();
    }
  } catch (error) {
    showToast(error.message || 'Game Center sign-in failed');
  }
}

async function loadOnlineLeaderboard() {
  if (!GameCenter || !state.online.authenticated) {
    renderLeaderboard([]);
    return;
  }

  try {
    const result = await GameCenter.loadLeaderboard({
      page: state.leaderboardPage,
      pageSize: state.leaderboardPageSize,
    });
    state.leaderboardEntries = Array.isArray(result.entries) ? result.entries : [];
    state.leaderboardTotalPlayerCount = result.totalPlayerCount || state.leaderboardEntries.length;
    state.leaderboardLocalRank = result.localRank ?? null;
    state.leaderboardLocalScore = result.localScore ?? null;
    renderOnlineState();
  } catch (error) {
    showToast(error.message || 'Could not load leaderboard');
  }
}

async function submitOnlineScore() {
  if (!GameCenter || !state.online.authenticated) return;
  try {
    await GameCenter.submitScore({ score: state.totalScore });
    loadOnlineLeaderboard();
  } catch (_) {}
}

async function startOnlineMatchmaking() {
  if (!GameCenter) {
    showToast('Matchmaking is available in the native iOS app.');
    return;
  }
  if (!state.online.authenticated) {
    showToast('Sign in to Game Center first.');
    return;
  }
  if (state.online.multiplayerRestricted) {
    showToast('Multiplayer is restricted on this account.');
    return;
  }

  state.pvp.searching = true;
  renderOnlineState();
  try {
    await GameCenter.startMatchmaking();
  } catch (error) {
    state.pvp.searching = false;
    renderOnlineState();
    showToast(error.message || 'Matchmaking failed');
  }
}

async function cancelOnlineMatchmaking() {
  if (!GameCenter) return;
  try {
    await GameCenter.cancelMatchmaking();
  } catch (_) {}
  state.pvp.searching = false;
  renderOnlineState();
}

function startPvpMatch() {
  startPvpRound(false);
}

function leavePvpMode(notifyRemote = true) {
  if (notifyRemote && GameCenter && state.pvp.active) {
    GameCenter.sendMatchEvent({ event: { type: 'end' } }).catch(() => {});
    GameCenter.endMatch().catch(() => {});
  }
  resetPvpState();
  setOpponentLabels();
  renderOnlineState();
}

async function sendPvpEvent(payload) {
  if (!GameCenter || !state.pvp.active) return;
  try {
    await GameCenter.sendMatchEvent({ event: payload });
  } catch (_) {}
}

function applyRemoteMove(index) {
  if (state.gameOver || state.board[index] !== null) return;
  placeMarker(index, getPvpRemoteSymbol());
  playSound('placeO');
  const result = checkGameOver();
  if (result) {
    handleResult(result);
    return;
  }
  state.currentPlayer = state.pvp.symbol;
  state.thinking = false;
  state.pvp.isLocalTurn = true;
  updateTurnUI();
}

// ════════════════════════════════════════════════════════
//   WEB AUDIO — Context, iOS unlock, SFX, Music
// ════════════════════════════════════════════════════════
let _audioCtx   = null;
let _musicGain  = null;   // master gain for music (keeps music quieter than SFX)
let _musicTimer = null;   // setTimeout handle for the music loop
let _musicMuted = false;
let _sfxMuted   = false;
let _audioUnlockTimer = null;

// ── Create / get shared AudioContext ─────────────────────
function getAudioCtx() {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return _audioCtx;
}

function ensureAudioRunning() {
  try {
    const ctx = getAudioCtx();
    if (ctx.state !== 'running') ctx.resume();
  } catch (_) {}
}

// ── iOS UNLOCK ───────────────────────────────────────────
// iOS/WKWebView keeps AudioContext suspended until a REAL
// BufferSource node is started synchronously inside a
// user-gesture handler.  Call this once from startGame().
function unlockAudio() {
  try {
    const ctx = getAudioCtx();
    if (ctx.state !== 'running') ctx.resume();
    // Play a 1-sample silent buffer - this is the iOS/WKWebView trick
    const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    // One more delayed resume helps on some iOS devices after route changes.
    clearTimeout(_audioUnlockTimer);
    _audioUnlockTimer = setTimeout(() => ensureAudioRunning(), 120);
  } catch (_) {}
}

// ── Music master gain node ────────────────────────────────
function getMusicGain() {
  const ctx = getAudioCtx();
  if (!_musicGain || _musicGain.context !== ctx) {
    _musicGain = ctx.createGain();
    _musicGain.gain.value = 0.13;
    _musicGain.connect(ctx.destination);
  }
  return _musicGain;
}

// ── Low-level tone builders ──────────────────────────────
/**
 * Schedule one synthesised note (SFX path — direct to destination).
 * @param {number} freq Hz  @param {string} type oscillator type
 * @param {number} vol peak @param {number} attack s @param {number} decay s
 * @param {number} [offset=0] seconds from ctx.currentTime
 */
function tone(freq, type, vol, attack, decay, offset = 0) {
  if (_sfxMuted) return;
  try {
    const ctx  = getAudioCtx();
    if (ctx.state !== 'running') ctx.resume();
    const now  = ctx.currentTime + offset;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
    osc.start(now);
    osc.stop(now + attack + decay + 0.05);
  } catch (_) {}
}

/** Schedule one music note (routes through _musicGain). */
function musicTone(freq, type, vol, attack, decay, offset) {
  try {
    const ctx   = getAudioCtx();
    if (ctx.state !== 'running') ctx.resume();
    const gn    = getMusicGain();
    const now   = ctx.currentTime + offset;
    const osc   = ctx.createOscillator();
    const gain  = ctx.createGain();
    osc.connect(gain);
    gain.connect(gn);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
    osc.start(now);
    osc.stop(now + attack + decay + 0.05);
  } catch (_) {}
}

/** SFX arpeggio helper */
function arp(notes, spacing, type = 'sine', vol = 0.25, attack = 0.01, decay = 0.18) {
  notes.forEach((f, i) => tone(f, type, vol, attack, decay, i * spacing));
}

// ════════════════════════════════════════════════════════
//   THEME SONGS  — looping background music per theme
//   Each note: { f: Hz, d: duration_seconds }
//   f = 0  →  rest (silence)
// ════════════════════════════════════════════════════════
const MUSIC = {

  // Classic — warm C-major melody, sine, 110 BPM
  // Feel: cheerful, playful board-game vibe
  classic: {
    type: 'sine', vol: 1.0,
    attack: 0.02, decay: 0.18,
    notes: [
      {f:523,d:0.27},{f:659,d:0.27},{f:784,d:0.27},{f:659,d:0.27},  // C5 E5 G5 E5
      {f:523,d:0.55},{f:0,  d:0.27},                                  // C5 —
      {f:587,d:0.27},{f:523,d:0.27},{f:494,d:0.27},{f:523,d:0.27},  // D5 C5 B4 C5
      {f:659,d:0.55},{f:0,  d:0.27},                                  // E5 —
      {f:784,d:0.27},{f:659,d:0.27},{f:523,d:0.27},{f:440,d:0.27},  // G5 E5 C5 A4
      {f:523,d:0.55},{f:0,  d:0.55},                                  // C5 rest
    ],
  },

  // Forest — D-minor pentatonic, triangle wave, 85 BPM
  // Feel: organic, breathing, like birdsong in trees
  forest: {
    type: 'triangle', vol: 1.0,
    attack: 0.01, decay: 0.28,
    notes: [
      {f:294,d:0.35},{f:349,d:0.35},{f:440,d:0.35},{f:523,d:0.35},  // D4 F4 A4 C5
      {f:587,d:0.71},{f:0,  d:0.35},                                  // D5 —
      {f:523,d:0.35},{f:440,d:0.35},{f:349,d:0.35},{f:294,d:0.35},  // C5 A4 F4 D4
      {f:294,d:1.06},{f:0,  d:0.71},                                  // D4 long rest
      {f:349,d:0.35},{f:440,d:0.35},{f:523,d:0.35},{f:587,d:0.35},  // F4 A4 C5 D5
      {f:440,d:0.71},{f:349,d:0.35},{f:0,  d:0.71},                  // A4 F4 rest
    ],
  },

  // Volcanic — E power riff, sawtooth, 140 BPM
  // Feel: heavy, driving, relentless
  volcanic: {
    type: 'sawtooth', vol: 0.75,
    attack: 0.005, decay: 0.09,
    notes: [
      {f:82, d:0.21},{f:82, d:0.11},{f:98, d:0.11},{f:82, d:0.21},{f:73, d:0.11},{f:0,d:0.11},
      {f:82, d:0.21},{f:82, d:0.11},{f:117,d:0.11},{f:110,d:0.21},{f:0,  d:0.21},
      {f:82, d:0.43},{f:82, d:0.21},{f:98, d:0.21},
      {f:82, d:0.21},{f:0,  d:0.11},{f:82, d:0.11},{f:82, d:0.21},{f:73, d:0.11},{f:0,d:0.11},
      {f:98, d:0.43},{f:110,d:0.21},{f:82, d:0.43},{f:0,  d:0.43},
    ],
  },

  // Space — slow ambient pads, sine, 55 BPM
  // Feel: floating, otherworldly, vast
  space: {
    type: 'sine', vol: 1.0,
    attack: 0.25, decay: 1.6,
    notes: [
      {f:262,d:2.2},{f:0,  d:0.5},
      {f:392,d:2.2},{f:0,  d:0.5},
      {f:466,d:1.6},{f:392,d:1.6},{f:0,  d:0.5},
      {f:349,d:1.6},{f:330,d:1.6},{f:0,  d:0.5},
      {f:262,d:3.0},{f:0,  d:1.0},
    ],
  },

  // Neon — 8-bit chiptune arpeggio, square wave, 165 BPM
  // Feel: electric, urgent, cyberpunk arcade
  neon: {
    type: 'square', vol: 0.65,
    attack: 0.002, decay: 0.07,
    notes: [
      {f:523,d:0.09},{f:659,d:0.09},{f:784,d:0.09},{f:1047,d:0.09},
      {f:784,d:0.09},{f:659,d:0.09},{f:523,d:0.18},{f:0,   d:0.09},
      {f:440,d:0.09},{f:523,d:0.09},{f:659,d:0.09},{f:784, d:0.09},
      {f:659,d:0.09},{f:523,d:0.09},{f:440,d:0.18},{f:0,   d:0.09},
      {f:523,d:0.09},{f:659,d:0.09},{f:784,d:0.09},{f:1047,d:0.09},
      {f:880,d:0.09},{f:784,d:0.09},{f:659,d:0.09},{f:523, d:0.09},
      {f:494,d:0.09},{f:523,d:0.09},{f:659,d:0.09},{f:784, d:0.09},
      {f:523,d:0.18},{f:0,  d:0.18},
    ],
  },
};

// ── Music playback ───────────────────────────────────────
function playMusicLoop(theme) {
  if (_musicMuted) return;
  const song = MUSIC[theme];
  if (!song) return;

  try {
    const ctx  = getAudioCtx();
    const gn   = getMusicGain();
    gn.gain.cancelScheduledValues(ctx.currentTime);
    gn.gain.setValueAtTime(0.13, ctx.currentTime);
    let   t    = ctx.currentTime + 0.08;  // tiny lead-in

    song.notes.forEach(({ f, d }) => {
      if (f > 0) {
        musicTone(f, song.type, song.vol * 0.12, song.attack, song.decay, t - ctx.currentTime);
      }
      t += d;
    });

    // Restart loop just before it ends so there's no gap
    const loopMs = (t - ctx.currentTime) * 1000;
    _musicTimer = setTimeout(() => playMusicLoop(theme), Math.max(loopMs - 180, 50));
  } catch (_) {}
}

function stopMusic() {
  clearTimeout(_musicTimer);
  _musicTimer = null;
  // Fade out gently instead of a hard cut.
  try {
    const ctx = getAudioCtx();
    const gn  = getMusicGain();
    gn.gain.cancelScheduledValues(ctx.currentTime);
    gn.gain.setValueAtTime(gn.gain.value, ctx.currentTime);
    gn.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
  } catch (_) {}
}

function startMusic(theme) {
  stopMusic();
  if (_musicMuted) return;
  ensureAudioRunning();
  try {
    const ctx = getAudioCtx();
    const gn  = getMusicGain();
    gn.gain.cancelScheduledValues(ctx.currentTime);
    gn.gain.setValueAtTime(0.13, ctx.currentTime);
  } catch (_) {}
  // tiny delay so the unlock + first SFX don't clash
  setTimeout(() => playMusicLoop(theme), 300);
}

// ── Toggle controls ──────────────────────────────────────
function toggleMusic() {
  unlockAudio();
  _musicMuted = !_musicMuted;
  const btn = document.getElementById('btn-music');
  btn.classList.toggle('muted', _musicMuted);
  localStorage.setItem('ttt_music_muted', _musicMuted ? '1' : '0');

  if (_musicMuted) {
    stopMusic();
  } else if (state.currentDifficulty) {
    startMusic(LEVELS[state.currentDifficulty].theme);
  }
}

function toggleSFX() {
  unlockAudio();
  _sfxMuted = !_sfxMuted;
  const btn = document.getElementById('btn-sfx');
  btn.classList.toggle('muted', _sfxMuted);
  localStorage.setItem('ttt_sfx_muted', _sfxMuted ? '1' : '0');
}

/** Theme sound definitions (SFX) */
const SOUNDS = {
  classic: {
    placeX:  () => tone(440, 'sine', 0.28, 0.008, 0.12),
    placeO:  () => tone(330, 'sine', 0.28, 0.008, 0.12),
    win:     () => arp([523, 659, 784, 1047], 0.1, 'sine', 0.28, 0.01, 0.18),
    lose:    () => arp([330, 277, 220], 0.13, 'sine', 0.22, 0.01, 0.22),
    draw:    () => { tone(440,'sine',0.2,0.01,0.2); tone(440,'sine',0.12,0.01,0.2,0.28); },
    unlock:  () => arp([523, 659, 784, 1047], 0.08, 'sine', 0.28, 0.01, 0.14),
  },
  forest: {
    placeX:  () => { tone(294,'triangle',0.38,0.004,0.22); tone(588,'triangle',0.08,0.004,0.12); },
    placeO:  () => { tone(220,'triangle',0.38,0.004,0.22); tone(440,'triangle',0.08,0.004,0.12); },
    win:     () => arp([392, 494, 587, 784], 0.11, 'triangle', 0.35, 0.005, 0.25),
    lose:    () => arp([294, 220, 196], 0.14, 'triangle', 0.28, 0.005, 0.3),
    draw:    () => { tone(392,'triangle',0.28,0.005,0.35); tone(294,'triangle',0.2,0.005,0.35,0.4); },
    unlock:  () => arp([392, 523, 659, 784], 0.09, 'triangle', 0.32, 0.005, 0.2),
  },
  volcanic: {
    placeX:  () => { tone(110,'sawtooth',0.14,0.004,0.09); tone(220,'sawtooth',0.06,0.004,0.06); },
    placeO:  () => { tone(146,'sawtooth',0.14,0.004,0.09); tone(293,'sawtooth',0.06,0.004,0.06); },
    win:     () => arp([110, 165, 220, 330, 440, 880], 0.07, 'sawtooth', 0.1, 0.005, 0.1),
    lose:    () => arp([220, 165, 110, 73], 0.16, 'sawtooth', 0.13, 0.005, 0.25),
    draw:    () => { tone(146,'sawtooth',0.1,0.01,0.3); tone(110,'sawtooth',0.1,0.01,0.3,0.35); },
    unlock:  () => arp([220, 330, 440, 660], 0.07, 'sawtooth', 0.1, 0.005, 0.1),
  },
  space: {
    placeX:  () => { tone(880,'sine',0.22,0.025,0.45); tone(1760,'sine',0.04,0.025,0.3); },
    placeO:  () => { tone(660,'sine',0.22,0.025,0.45); tone(1320,'sine',0.04,0.025,0.3); },
    win:     () => arp([523, 659, 784, 1047, 1319], 0.13, 'sine', 0.2, 0.025, 0.45),
    lose:    () => arp([440, 330, 220, 110], 0.18, 'sine', 0.16, 0.025, 0.4),
    draw:    () => { tone(523,'sine',0.15,0.03,0.6); tone(659,'sine',0.1,0.03,0.5,0.65); },
    unlock:  () => { arp([659,784,1047,1319],0.11,'sine',0.2,0.025,0.4); tone(2093,'sine',0.06,0.02,0.5,0.38); },
  },
  neon: {
    placeX:  () => tone(523, 'square', 0.10, 0.002, 0.065),
    placeO:  () => tone(659, 'square', 0.10, 0.002, 0.065),
    win:     () => arp([784, 880, 988, 1047, 1175, 1319], 0.045, 'square', 0.09, 0.002, 0.065),
    lose:    () => arp([294, 261, 220, 196], 0.09, 'square', 0.09, 0.002, 0.1),
    draw:    () => { tone(440,'square',0.09,0.002,0.1); tone(440,'square',0.07,0.002,0.1,0.18); },
    unlock:  () => arp([523, 659, 784, 1047, 1319, 1568], 0.038, 'square', 0.09, 0.002, 0.06),
  },
};

function playSound(name) {
  if (_sfxMuted) return;
  const level  = state.currentDifficulty || 'easy';
  const theme  = LEVELS[level]?.theme || 'classic';
  const sounds = SOUNDS[theme] || SOUNDS.classic;
  try { if (sounds[name]) sounds[name](); } catch (_) {}
}


// ── Persistence ──────────────────────────────────────────
function saveState() {
  localStorage.setItem('ttt_coins',    JSON.stringify(state.coins));
  localStorage.setItem('ttt_unlocked', JSON.stringify(state.unlockedLevels));
  localStorage.setItem('ttt_total_score', JSON.stringify(state.totalScore));
}

function loadState() {
  const coins    = localStorage.getItem('ttt_coins');
  const unlocked = localStorage.getItem('ttt_unlocked');
  const totalScore = localStorage.getItem('ttt_total_score');
  if (coins    !== null) state.coins          = JSON.parse(coins);
  if (unlocked !== null) state.unlockedLevels = JSON.parse(unlocked);
  if (totalScore !== null) state.totalScore   = JSON.parse(totalScore);
  // Restore mute prefs
  _musicMuted = localStorage.getItem('ttt_music_muted') === '1';
  _sfxMuted   = localStorage.getItem('ttt_sfx_muted')   === '1';
}

// ── Boot ─────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadState();
  renderCoins();
  renderMenuProgress();
  applyLevelBoard(LEVELS.easy);
  renderLevelCards();
  syncAudioButtons();
  showScreen('menu');
  initializeOnline();
});

// ── Screen management ────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${name}`).classList.add('active');
}

function goToMenu() {
  stopMusic();
  stopRoundTimer();
  if (state.pvp.active) {
    leavePvpMode();
  }
  applyTheme('classic');
  showScreen('menu');
  renderLevelCards();
}

// ── Theme application ────────────────────────────────────
function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
}

// ── Level unlock ─────────────────────────────────────────
function unlockLevel(level) {
  const cost = LEVELS[level].unlockCost;
  if (state.coins < cost) {
    showToast(`Not enough coins. You need ${cost} 🪙.`);
    return;
  }
  state.coins -= cost;
  state.unlockedLevels.push(level);
  saveState();
  renderCoins(true);
  renderMenuProgress();
  renderLevelCards();
  // Play unlock sound in that level's theme context
  const prevDiff = state.currentDifficulty;
  state.currentDifficulty = level;
  playSound('unlock');
  state.currentDifficulty = prevDiff;
  showToast(`${LEVELS[level].label} unlocked.`);
}

function renderLevelCards() {
  Object.keys(LEVELS).forEach(level => {
    const card    = document.getElementById(`card-${level}`);
    const overlay = document.getElementById(`overlay-${level}`);
    if (!card) return;
    const unlocked = state.unlockedLevels.includes(level);
    card.classList.toggle('unlocked', unlocked);
    card.classList.toggle('locked',   !unlocked);
    if (overlay) overlay.style.display = unlocked ? 'none' : 'flex';
  });
}

// ── Game start ───────────────────────────────────────────
function startGame(difficulty) {
  if (difficulty === 'pvp') {
    startPvpMatch();
    return;
  }
  if (!state.unlockedLevels.includes(difficulty)) {
    showToast('This mode is still locked.');
    return;
  }

  // ── Unlock iOS audio on this user-gesture ──────────────
  unlockAudio();

  state.currentDifficulty = difficulty;
  state.scores = { player: 0, ai: 0, draws: 0 };
  updateScoreUI();

  const level  = LEVELS[difficulty];
  const tMeta  = THEME_META[level.theme];

  document.getElementById('game-difficulty-label').textContent = level.label.toUpperCase();
  document.getElementById('game-theme-label').textContent      = `${tMeta.name} · ${level.boardSize}x${level.boardSize}`;

  applyTheme(level.theme);
  applyLevelBoard(level);
  syncAudioButtons();
  startMusic(level.theme);
  resetBoard();
  showScreen('game');
}

// ── Board reset ──────────────────────────────────────────
function resetBoard() {
  state.board       = createBoardState(state.boardSize);
  state.currentPlayer = 'X';
  state.gameOver    = false;
  state.thinking    = false;
  state.pvp.isLocalTurn = !state.pvp.active || state.pvp.symbol === 'X';

  renderBoard();

  const line = document.getElementById('win-line');
  line.style.transition       = 'none';
  line.style.strokeDasharray  = String(state.boardSize * 2);
  line.style.strokeDashoffset = String(state.boardSize * 2);
  line.style.visibility       = 'hidden';
  line.setAttribute('x1', '-10'); line.setAttribute('y1', '-10');
  line.setAttribute('x2', '-10'); line.setAttribute('y2', '-10');
  requestAnimationFrame(() => { line.style.transition = ''; });

  startRoundTimer();
  updateTurnUI();
  updateBoardMeta();
}

// ── Cell click ───────────────────────────────────────────
function handleCellClick(index) {
  if (state.gameOver || state.thinking)       return;
  if (state.pvp.active) {
    if (!state.pvp.isLocalTurn || state.currentPlayer !== state.pvp.symbol) return;
  } else if (state.currentPlayer !== 'X') {
    return;
  }
  if (state.board[index] !== null)            return;

  unlockAudio();
  const localMarker = state.pvp.active ? state.pvp.symbol : 'X';
  const remoteMarker = state.pvp.active ? getPvpRemoteSymbol() : 'O';
  placeMarker(index, localMarker);
  playSound('placeX');

  const result = checkGameOver();
  if (result) { handleResult(result); return; }

  if (state.pvp.active) {
    state.currentPlayer = remoteMarker;
    state.thinking = false;
    state.pvp.isLocalTurn = false;
    updateTurnUI();
    sendPvpEvent({ type: 'move', index, player: localMarker });
    return;
  }

  // Trigger AI
  state.currentPlayer = 'O';
  state.thinking      = true;
  updateTurnUI();
  showThinking();

  const [dMin, dMax] = LEVELS[state.currentDifficulty].aiDelay;
  const delay        = dMin + Math.random() * (dMax - dMin);

  setTimeout(() => {
    hideThinking();
    const aiMove = getAIMove(state.board, state.currentDifficulty);
    if (aiMove !== null) {
      placeMarker(aiMove, 'O');
      playSound('placeO');
      const res = checkGameOver();
      if (res) { handleResult(res); return; }
    }
    state.currentPlayer = 'X';
    state.thinking      = false;
    updateTurnUI();
  }, delay);
}

function placeMarker(index, player) {
  state.board[index] = player;
  const cell = document.querySelector(`.cell[data-index="${index}"]`);
  cell.classList.add(player === 'X' ? 'x-mark' : 'o-mark', 'taken');
  cell.setAttribute('aria-label', `${getBoardAriaLabel(index)} filled with ${player}`);
  cell.innerHTML = `<span class="mark">${player}</span>`;
  requestAnimationFrame(() => requestAnimationFrame(() => cell.classList.add('placed')));
}

// ════════════════════════════════════════════════════════
//   AI LOGIC
// ════════════════════════════════════════════════════════
function getAIMove(board, difficulty) {
  const empty = board.map((v, i) => v === null ? i : null).filter(i => i !== null);
  if (empty.length === 0) return null;

  if (difficulty === 'easy')               return aiEasy(empty);
  if (difficulty === 'medium')             return aiMedium(board, empty);
  if (difficulty === 'hard')               return aiStrategic(board, empty, 2);
  if (difficulty === 'expert')             return aiStrategic(board, empty, 3);
  if (difficulty === 'legend')             return aiStrategic(board, empty, 4);
  return aiEasy(empty);
}

/** Easy: fully random */
function aiEasy(empty) {
  return empty[Math.floor(Math.random() * empty.length)];
}

/** Medium: win → block → 40% random → prefer center/corners */
function aiMedium(board, empty) {
  const win = findWinningMove(board, 'O');
  if (win !== null) return win;

  const block = findWinningMove(board, 'X');
  if (block !== null) return block;

  if (Math.random() < 0.4) return aiEasy(empty);

  const preferred = getPreferredMoves(board.length, state.boardSize);
  for (const i of preferred) if (board[i] === null) return i;
  return aiEasy(empty);
}

function aiStrategic(board, empty, lookahead) {
  const immediateWin = findWinningMove(board, 'O');
  if (immediateWin !== null) return immediateWin;

  const immediateBlock = findWinningMove(board, 'X');
  if (immediateBlock !== null) return immediateBlock;

  const candidates = rankCandidateMoves(board, empty).slice(0, Math.min(empty.length, 10));
  let bestMove = candidates[0] ?? empty[0];
  let bestScore = -Infinity;

  candidates.forEach((move) => {
    board[move] = 'O';
    const score = evaluateBoard(board, 'O') - evaluateBoard(board, 'X') - predictOpponentResponse(board, lookahead - 1);
    board[move] = null;
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  });

  return bestMove;
}

function predictOpponentResponse(board, depth) {
  if (depth < 0) return 0;
  const block = findWinningMove(board, 'X');
  if (block !== null) return 1000;

  const empty = board.map((v, i) => v === null ? i : null).filter(i => i !== null);
  const candidates = rankCandidateMoves(board, empty).slice(0, Math.min(empty.length, 8));
  let bestThreat = 0;

  candidates.forEach((move) => {
    board[move] = 'X';
    const threat = evaluateBoard(board, 'X') - evaluateBoard(board, 'O') + (depth > 0 ? aiStrategicFollowUp(board, depth - 1) : 0);
    board[move] = null;
    bestThreat = Math.max(bestThreat, threat);
  });

  return bestThreat;
}

function aiStrategicFollowUp(board, depth) {
  const win = findWinningMove(board, 'O');
  if (win !== null) return 800;
  if (depth < 0) return 0;

  const empty = board.map((v, i) => v === null ? i : null).filter(i => i !== null);
  const candidates = rankCandidateMoves(board, empty).slice(0, Math.min(empty.length, 6));
  let best = 0;

  candidates.forEach((move) => {
    board[move] = 'O';
    const value = evaluateBoard(board, 'O') - evaluateBoard(board, 'X');
    board[move] = null;
    best = Math.max(best, value);
  });

  return best;
}

function rankCandidateMoves(board, empty) {
  return [...empty].sort((a, b) => scoreMove(board, b, 'O') - scoreMove(board, a, 'O'));
}

function scoreMove(board, move, player) {
  board[move] = player;
  const score = evaluateBoard(board, player) + positionalScore(move, state.boardSize);
  board[move] = null;
  return score;
}

function positionalScore(index, size) {
  const row = Math.floor(index / size);
  const col = index % size;
  const center = (size - 1) / 2;
  return size - (Math.abs(row - center) + Math.abs(col - center));
}

function getPreferredMoves(boardLength, size) {
  const indices = Array.from({ length: boardLength }, (_, index) => index);
  return indices.sort((a, b) => positionalScore(b, size) - positionalScore(a, size));
}

function evaluateBoard(board, player) {
  let score = 0;

  for (const combo of state.winCombos) {
    let playerCount = 0;
    let opponentCount = 0;

    combo.forEach((index) => {
      if (board[index] === player) playerCount++;
      else if (board[index] !== null) opponentCount++;
    });

    if (playerCount && opponentCount) continue;
    if (playerCount === state.winLength) return 10000;
    if (opponentCount === state.winLength) return -10000;
    if (playerCount > 0) score += Math.pow(8, playerCount);
    if (opponentCount > 0) score -= Math.pow(7, opponentCount);
  }

  return score;
}

function findWinningMove(board, player) {
  for (let i = 0; i < board.length; i++) {
    if (board[i] === null) {
      board[i] = player;
      const wins = getWinner(board) === player;
      board[i] = null;
      if (wins) return i;
    }
  }
  return null;
}

// ── Win / Draw ───────────────────────────────────────────
function getWinner(board) {
  const winState = getWinningState(board);
  return winState ? winState.player : null;
}

function getWinningState(board) {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  let best = null;

  for (let row = 0; row < state.boardSize; row++) {
    for (let col = 0; col < state.boardSize; col++) {
      const startIndex = row * state.boardSize + col;
      const player = board[startIndex];
      if (!player) continue;

      directions.forEach(([dRow, dCol]) => {
        const prevRow = row - dRow;
        const prevCol = col - dCol;
        if (
          prevRow >= 0 && prevRow < state.boardSize &&
          prevCol >= 0 && prevCol < state.boardSize &&
          board[prevRow * state.boardSize + prevCol] === player
        ) {
          return;
        }

        const combo = [];
        let nextRow = row;
        let nextCol = col;

        while (
          nextRow >= 0 && nextRow < state.boardSize &&
          nextCol >= 0 && nextCol < state.boardSize &&
          board[nextRow * state.boardSize + nextCol] === player
        ) {
          combo.push(nextRow * state.boardSize + nextCol);
          nextRow += dRow;
          nextCol += dCol;
        }

        if (combo.length >= state.winLength && (!best || combo.length > best.combo.length)) {
          best = { player, combo };
        }
      });
    }
  }

  return best;
}

function getWinCombo(board) {
  return getWinningState(board)?.combo || null;
}

function isBoardFull(board) { return board.every(c => c !== null); }

function checkGameOver() {
  const winState = getWinningState(state.board);
  if (winState) return { type: 'win', player: winState.player, combo: winState.combo };
  if (isBoardFull(state.board)) return { type: 'draw' };
  return null;
}

// ── Result handling ──────────────────────────────────────
function handleResult(result) {
  state.gameOver = true;
  state.thinking = false;
  stopRoundTimer();

  if (result.type === 'win') {
    const combo = result.combo || getWinCombo(state.board);
    highlightWinCells(combo);
    drawWinLine(combo);
    setTimeout(() => playSound(result.player === 'X' ? 'win' : 'lose'), 180);
  } else {
    playSound('draw');
  }

  const modalDelay = result.type === 'win' ? 780 : 250;
  setTimeout(() => {
    const playerMarker = state.pvp.active ? state.pvp.symbol : 'X';
    if (result.type === 'win' && result.player === playerMarker) {
      state.winStreak++;
      state.scores.player++;
    } else if (result.type === 'win') {
      state.winStreak = 0;
      state.scores.ai++;
    } else {
      state.winStreak = 0;
      state.scores.draws++;
    }
    showResultModal(result);
    updateScoreUI();
    updateRoundTimerUI();
    if (state.pvp.active) {
      syncPvpScoreboard();
    }
  }, modalDelay);
}

function highlightWinCells(combo) {
  combo.forEach(i => document.querySelector(`.cell[data-index="${i}"]`).classList.add('win-cell'));
}

function drawWinLine(combo) {
  const a = combo[0];
  const c = combo[combo.length - 1];
  const [x1, y1] = getCellCenter(a, state.boardSize);
  const [x2, y2] = getCellCenter(c, state.boardSize);
  const line = document.getElementById('win-line');
  line.style.visibility       = 'visible';
  line.setAttribute('x1', x1); line.setAttribute('y1', y1);
  line.setAttribute('x2', x2); line.setAttribute('y2', y2);
  line.style.strokeDasharray  = String(state.boardSize * 2);
  line.style.strokeDashoffset = String(state.boardSize * 2);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    line.style.strokeDashoffset = '0';
  }));
}

// ── Result modal ─────────────────────────────────────────
function showResultModal(result) {
  const level = state.currentDifficulty;
  const cfg   = LEVELS[level] || { label: 'PvP', winReward: 0, drawReward: 0 };
  let icon, title, message, coinEarned = 0;
  let rewardBreakdown = '';
  const playerMarker = state.pvp.active ? state.pvp.symbol : 'X';

  if (result.type === 'win' && result.player === playerMarker) {
    const timerBonus = getTimerBonus();
    const streakBonus = getStreakBonus();
    const lineLength = result.combo?.length || MIN_WIN_LENGTH;
    const lineBonus = getLineBonus(lineLength, cfg);
    coinEarned = state.pvp.active ? 0 : cfg.winReward + timerBonus + streakBonus + lineBonus;
    icon       = '🏆';
    title      = 'You win!';
    message    = lineLength > MIN_WIN_LENGTH
      ? `Strong round on ${cfg.label} in ${formatElapsed(state.elapsedSeconds)} with ${lineLength} in a row.`
      : `Strong round on ${cfg.label} in ${formatElapsed(state.elapsedSeconds)}. Keep climbing.`;
    rewardBreakdown = state.pvp.active
      ? 'Live PvP rounds update rank through the online leaderboard.'
      : getRewardBreakdown(cfg.winReward + lineBonus, timerBonus, streakBonus);
  } else if (result.type === 'win') {
    icon    = '😵';
    title   = state.pvp.active ? `${state.pvp.opponentName} wins!` : 'AI wins!';
    message = state.pvp.active ? 'Your opponent closed it out first. Queue the rematch.' : 'The AI had the better line this time. Run it back.';
  } else {
    icon       = '🤝';
    title      = 'Draw!';
    message    = 'No winner this round. The rematch is ready.';
    coinEarned = state.pvp.active ? 0 : cfg.drawReward;
    rewardBreakdown = state.pvp.active ? 'Live PvP draw logged.' : getRewardBreakdown(cfg.drawReward, 0, 0);
  }

  document.getElementById('modal-icon').textContent    = icon;
  document.getElementById('modal-title').textContent   = title;
  document.getElementById('modal-message').textContent = message;

  const coinsEl = document.getElementById('modal-coins');
  if (coinEarned > 0) {
    coinsEl.textContent  = `🪙 +${coinEarned} coins earned`;
    coinsEl.style.color  = 'var(--gold)';
    awardCoins(coinEarned);
    submitOnlineScore();
  } else {
    coinsEl.textContent  = state.pvp.active ? 'Online PvP result recorded' : 'No coin reward this round';
    coinsEl.style.color  = 'var(--muted)';
  }
  coinsEl.style.display = 'flex';

  const breakdownEl = document.getElementById('modal-reward-breakdown');
  if (breakdownEl) {
    breakdownEl.textContent = rewardBreakdown;
  }

  document.getElementById('result-modal').classList.add('show');
}

function scrollToLevels() {
  const levels = document.getElementById('levels');
  if (levels) {
    levels.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function resetLocalProgress() {
  const shouldReset = window.confirm('Delete coins, unlocked modes, score, and audio settings stored on this device?');
  if (!shouldReset) return;

  stopMusic();
  stopRoundTimer();
  closeModal();

  if (state.pvp.active) {
    leavePvpMode();
  }

  state.coins = 0;
  state.unlockedLevels = ['easy'];
  state.currentDifficulty = null;
  state.boardSize = LEVELS.easy.boardSize;
  state.winLength = LEVELS.easy.winLength;
  state.winCombos = createWinCombos(LEVELS.easy.boardSize, LEVELS.easy.winLength);
  state.board = createBoardState(LEVELS.easy.boardSize);
  state.currentPlayer = 'X';
  state.gameOver = false;
  state.thinking = false;
  state.scores = { player: 0, ai: 0, draws: 0 };
  state.totalScore = 0;
  state.winStreak = 0;
  state.roundStartAt = 0;
  state.elapsedSeconds = 0;

  _musicMuted = false;
  _sfxMuted = false;

  [
    'ttt_coins',
    'ttt_unlocked',
    'ttt_total_score',
    'ttt_music_muted',
    'ttt_sfx_muted',
  ].forEach((key) => localStorage.removeItem(key));

  renderCoins();
  renderMenuProgress();
  renderLevelCards();
  updateScoreUI();
  updateRoundTimerUI();
  syncAudioButtons();
  applyTheme('classic');
  applyLevelBoard(LEVELS.easy);
  showScreen('menu');
  showToast('Local progress removed from this device.');
}

function closeModal() {
  document.getElementById('result-modal').classList.remove('show');
  const breakdownEl = document.getElementById('modal-reward-breakdown');
  if (breakdownEl) breakdownEl.textContent = '';

  if (state.pvp.active && state.gameOver) {
    startPvpRound(true);
  }
}

// ── Coin system ──────────────────────────────────────────
function awardCoins(amount) {
  state.coins += amount;
  state.totalScore += amount;
  saveState();
  renderCoins(true);
  renderMenuProgress();
  spawnCoinBurst();
}

function renderCoins(animate = false) {
  document.getElementById('coin-count').textContent = state.coins;
  if (animate) {
    const hud = document.getElementById('coin-hud');
    hud.classList.remove('hud-bounce');
    void hud.offsetWidth;
    hud.classList.add('hud-bounce');
  }
}

function spawnCoinBurst() {
  const container = document.getElementById('burst-container');
  const rect      = document.getElementById('coin-hud').getBoundingClientRect();
  const ox = rect.left + rect.width  / 2;
  const oy = rect.top  + rect.height / 2;

  for (let i = 0; i < 14; i++) {
    const coin  = document.createElement('div');
    coin.className    = 'coin-particle';
    coin.textContent  = '🪙';
    const angle = Math.random() * Math.PI * 2;
    const dist  = 55 + Math.random() * 110;
    coin.style.left = `${ox}px`;
    coin.style.top  = `${oy}px`;
    coin.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    coin.style.setProperty('--dy', `${Math.sin(angle) * dist - 40}px`);
    coin.style.animationDelay = `${Math.random() * 0.18}s`;
    container.appendChild(coin);
    coin.addEventListener('animationend', () => coin.remove());
  }
}

// ── UI helpers ───────────────────────────────────────────
function updateTurnUI() {
  const playerMarker = state.pvp.active ? state.pvp.symbol : 'X';
  const opponentMarker = playerMarker === 'X' ? 'O' : 'X';
  document.getElementById('badge-player').classList.toggle('active', state.currentPlayer === playerMarker);
  document.getElementById('badge-ai').classList.toggle('active',     state.currentPlayer === opponentMarker);
}

function updateScoreUI() {
  document.getElementById('score-player').textContent = state.scores.player;
  document.getElementById('score-ai').textContent     = state.scores.ai;
  document.getElementById('score-draw').textContent   = state.scores.draws;
}

let _thinkingEl = null;
function showThinking() {
  const board = document.getElementById('board');
  _thinkingEl = document.createElement('div');
  _thinkingEl.className   = 'thinking';
  _thinkingEl.textContent = '🤖';
  board.appendChild(_thinkingEl);
}
function hideThinking() {
  if (_thinkingEl) { _thinkingEl.remove(); _thinkingEl = null; }
}

// ── Audio button sync ────────────────────────────────────
// Keeps button icons consistent with the mute state
function syncAudioButtons() {
  const bm = document.getElementById('btn-music');
  const bs = document.getElementById('btn-sfx');
  if (bm) bm.classList.toggle('muted', _musicMuted);
  if (bs) bs.classList.toggle('muted', _sfxMuted);
}

// ── Toast ────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('visible'), 2800);
}
