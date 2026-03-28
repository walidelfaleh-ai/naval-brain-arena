const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = Number(process.env.PORT) || 3000;

const ROWS = 11;
const COLS = 9;
const ROW_LABELS = 'ABCDEFGHIJK'.split('');
const COL_LABELS = Array.from({ length: COLS }, (_, index) => String(index));
const MATCH_WAIT_MS = 20000;
const MATCHING_MIN_MS = 3000;
const TURN_MS = 10000;
const ATTACK_REVEAL_MS = 2000;
const MAX_CONSECUTIVE_SKIPS = 3;
const FLEET = [
  { id: 'patrol', name: 'Patrol', lineSize: 3, size: 4 },
  { id: 'frigate', name: 'Frigate', lineSize: 4, size: 5 },
  { id: 'destroyer', name: 'Destroyer', lineSize: 5, size: 6 }
];
const BOT_PLAYER_NAMES = [
  'Lucas Marin',
  'Noah Silva',
  'Emma Laurent',
  'Mia Duarte',
  'Leo Martin',
  'Jade Morel',
  'Nina Costa',
  'Adam Roy'
];
const AVATAR_POOL = [
  { id: 'captain-ray', icon: '🧑‍✈️', tint: '#38bdf8' },
  { id: 'iron-beard', icon: '🧔', tint: '#f59e0b' },
  { id: 'storm-lady', icon: '👩‍✈️', tint: '#f472b6' },
  { id: 'shark-eye', icon: '😼', tint: '#60a5fa' },
  { id: 'bolt-face', icon: '🤖', tint: '#a78bfa' },
  { id: 'wave-fox', icon: '🦊', tint: '#fb7185' },
  { id: 'sea-panda', icon: '🐼', tint: '#34d399' },
  { id: 'ember-owl', icon: '🦉', tint: '#f97316' }
];

const waitingPlayers = [];
const privateMatches = new Map();
const playerWaitTimers = new Map();
const games = new Map();
const socketToGame = new Map();

app.get('/health', (_req, res) => {
  res.json({ ok: true, games: games.size, queued: waitingPlayers.length, board: { rows: ROWS, cols: COLS }, turnSeconds: TURN_MS / 1000 });
});

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    name: 'Naval Brain Arena server',
    socket: '/socket.io',
    health: '/health',
    games: games.size,
    queued: waitingPlayers.length
  });
});

io.on('connection', (socket) => {
  socket.emit('gameState', buildIdleState());

  socket.on('joinQueue', (payload) => {
    handleJoinQueue(socket, payload);
  });

  socket.on('createPrivateMatch', (payload) => {
    handleCreatePrivateMatch(socket, payload);
  });

  socket.on('joinPrivateMatch', (payload) => {
    handleJoinPrivateMatch(socket, payload);
  });

  socket.on('attack', (target) => {
    handleAttack(socket, target);
  });

  socket.on('sendEmote', (payload) => {
    handleSendEmote(socket, payload);
  });

  socket.on('leaveGame', () => {
    handleLeaveGame(socket);
  });

  socket.on('disconnect', () => {
    handleDisconnect(socket);
  });
});

server.listen(PORT, () => {
  console.log(`Battleship server listening on http://localhost:${PORT}`);
});

function buildIdleState(overrides = {}) {
  return {
    gameId: null,
    phase: 'home',
    matchMode: null,
    matchCode: null,
    selfTeam: null,
    activeTeam: null,
    resolvingAttack: false,
    isMyTurn: false,
    vsBot: false,
    winner: null,
    username: '',
    opponentName: null,
    selfAvatar: null,
    opponentAvatar: null,
    connectionLabel: 'Ready',
    statusMessage: 'Choose a username and click Start to search for a match.',
    ownBoard: null,
    enemyBoard: null,
    log: [],
    emotes: [],
    rowLabels: ROW_LABELS,
    colLabels: COL_LABELS,
    fleetSummary: [],
    turnSecondsLeft: TURN_MS / 1000,
    selfSkips: 0,
    enemySkips: 0,
    ...overrides
  };
}

function handleJoinQueue(socket, payload) {
  const username = sanitizeUsername(payload?.username);
  const avatarId = sanitizeAvatarId(payload?.avatarId);
  const uploadedAvatarDataUrl = sanitizeUploadedAvatar(payload?.uploadedAvatarDataUrl);
  if (!username) {
    socket.emit('gameState', buildIdleState({ statusMessage: 'Choose a username before starting a match.' }));
    return;
  }

  removeFromQueue(socket.id);
  clearWaitTimer(socket.id);

  const activeGameId = socketToGame.get(socket.id);
  if (activeGameId) {
    destroyGame(activeGameId);
  }

  waitingPlayers.push({ socketId: socket.id, username, avatarId, uploadedAvatarDataUrl, joinedAt: Date.now() });
  socket.emit('gameState', buildIdleState({
    phase: 'matching',
    username,
    connectionLabel: 'Searching...',
    statusMessage: 'Searching for another player. Bot fallback in 20 seconds if nobody joins.'
  }));

  const opponent = waitingPlayers.find((entry) => entry.socketId !== socket.id);
  if (opponent) {
    removeFromQueue(socket.id);
    removeFromQueue(opponent.socketId);
    clearWaitTimer(opponent.socketId);
    createHumanVsHumanGame(opponent, { socketId: socket.id, username, avatarId, uploadedAvatarDataUrl, joinedAt: Date.now() });
    return;
  }

  const timeout = setTimeout(() => {
    const stillWaiting = waitingPlayers.find((entry) => entry.socketId === socket.id);
    if (stillWaiting) {
      removeFromQueue(socket.id);
      createBotGame(stillWaiting);
    }
  }, MATCH_WAIT_MS);

  playerWaitTimers.set(socket.id, timeout);
}

function handleCreatePrivateMatch(socket, payload) {
  const username = sanitizeUsername(payload?.username);
  const avatarId = sanitizeAvatarId(payload?.avatarId);
  const uploadedAvatarDataUrl = sanitizeUploadedAvatar(payload?.uploadedAvatarDataUrl);
  if (!username) {
    socket.emit('gameState', buildIdleState({ statusMessage: 'Choose a username before creating a friend room.' }));
    return;
  }

  removeFromQueue(socket.id);
  removePrivateMatchBySocket(socket.id);
  clearWaitTimer(socket.id);

  const activeGameId = socketToGame.get(socket.id);
  if (activeGameId) {
    destroyGame(activeGameId);
  }

  const code = generatePrivateCode();
  privateMatches.set(code, { socketId: socket.id, username, avatarId, uploadedAvatarDataUrl, joinedAt: Date.now() });
  socket.emit('gameState', buildIdleState({
    phase: 'matching',
    matchMode: 'private',
    matchCode: code,
    username,
    connectionLabel: 'Friend room',
    statusMessage: 'Share this 6-character code with your friend.'
  }));
}

function handleJoinPrivateMatch(socket, payload) {
  const username = sanitizeUsername(payload?.username);
  const avatarId = sanitizeAvatarId(payload?.avatarId);
  const uploadedAvatarDataUrl = sanitizeUploadedAvatar(payload?.uploadedAvatarDataUrl);
  const code = sanitizePrivateCode(payload?.code);

  if (!username) {
    socket.emit('gameState', buildIdleState({ statusMessage: 'Choose a username before joining a friend room.' }));
    return;
  }

  if (!code) {
    socket.emit('gameState', buildIdleState({ statusMessage: 'Enter a valid 6-character friend code.' }));
    return;
  }

  const host = privateMatches.get(code);
  if (!host || host.socketId === socket.id) {
    socket.emit('gameState', buildIdleState({ statusMessage: 'Friend room not found.' }));
    return;
  }

  removeFromQueue(socket.id);
  removePrivateMatchBySocket(socket.id);
  clearWaitTimer(socket.id);

  const activeGameId = socketToGame.get(socket.id);
  if (activeGameId) {
    destroyGame(activeGameId);
  }

  privateMatches.delete(code);
  createHumanVsHumanGame(
    host,
    { socketId: socket.id, username, avatarId, uploadedAvatarDataUrl, joinedAt: Date.now() },
    { matchMode: 'private', matchCode: code, introMessage: `${username} joined the private room.` }
  );
}

function handleAttack(socket, target) {
  const playerInfo = getPlayerContext(socket.id);
  if (!playerInfo) {
    socket.emit('serverMessage', 'No active game found.');
    return;
  }

  const { game, team } = playerInfo;
  if (game.phase !== 'battle') {
    socket.emit('serverMessage', 'The battle is not active yet.');
    return;
  }

  if (game.resolvingAttack) {
    socket.emit('serverMessage', 'Wait for the current impact to resolve.');
    return;
  }

  if (game.activeTeam !== team) {
    socket.emit('serverMessage', 'Wait for your turn.');
    return;
  }

  resolveAttack(game, team, target?.row, target?.col);
}

function handleSendEmote(socket, payload) {
  const playerInfo = getPlayerContext(socket.id);
  if (!playerInfo) {
    socket.emit('serverMessage', 'No active game found.');
    return;
  }

  const { game, team } = playerInfo;
  if (game.phase !== 'battle') {
    return;
  }

  const emote = sanitizeEmote(payload?.emote);
  if (!emote) {
    return;
  }

  const sender = game.players[team];
  const emoteEvent = {
    id: `emote-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    team,
    username: sender.username,
    emote,
    createdAt: Date.now()
  };
  game.emotes.push(emoteEvent);
  game.emotes = game.emotes.slice(-8);
  broadcastEmote(game, emoteEvent);
  broadcastGameState(game);
}

function handleDisconnect(socket) {
  removeFromQueue(socket.id);
  removePrivateMatchBySocket(socket.id);
  clearWaitTimer(socket.id);

  const playerInfo = getPlayerContext(socket.id);
  if (!playerInfo) {
    return;
  }

  const { game, team } = playerInfo;
  const otherTeam = team === 'BLUE' ? 'RED' : 'BLUE';
  const winnerName = game.players[otherTeam].username;
  finishGame(game, otherTeam, `${game.players[team].username} disconnected. ${winnerName} wins by default.`);
}

function handleLeaveGame(socket) {
  removeFromQueue(socket.id);
  removePrivateMatchBySocket(socket.id);
  clearWaitTimer(socket.id);

  const playerInfo = getPlayerContext(socket.id);
  if (!playerInfo) {
    socket.emit('gameState', buildIdleState());
    return;
  }

  const { game, team } = playerInfo;
  const otherTeam = team === 'BLUE' ? 'RED' : 'BLUE';
  if (game.finished) {
    destroyGame(game.id);
    socket.emit('gameState', buildIdleState());
    return;
  }

  finishGame(game, otherTeam, `${game.players[team].username} left the battle.`);
  socketToGame.delete(socket.id);
  socket.emit('gameState', buildIdleState());
}

function createHumanVsHumanGame(waitingEntry, challengerEntry, options = {}) {
  const blueSocket = io.sockets.sockets.get(waitingEntry.socketId);
  const redSocket = io.sockets.sockets.get(challengerEntry.socketId);
  if (!blueSocket || !redSocket) {
    return;
  }

  const game = createBaseGame(false);
  game.matchMode = options.matchMode || 'random';
  game.matchCode = options.matchCode || null;
  game.players.BLUE = {
    socketId: waitingEntry.socketId,
    username: waitingEntry.username,
    isBot: false,
    avatar: pickAvatar(waitingEntry.avatarId, null, waitingEntry.uploadedAvatarDataUrl)
  };
  game.players.RED = {
    socketId: challengerEntry.socketId,
    username: challengerEntry.username,
    isBot: false,
    avatar: pickAvatar(challengerEntry.avatarId, game.players.BLUE.avatar.id, challengerEntry.uploadedAvatarDataUrl)
  };
  queueBattleStart(
    game,
    options.introMessage || `${challengerEntry.username} joined the queue just in time. Match found.`,
    [waitingEntry.joinedAt, challengerEntry.joinedAt]
  );
}

function createBotGame(waitingEntry) {
  const blueSocket = io.sockets.sockets.get(waitingEntry.socketId);
  if (!blueSocket) {
    return;
  }

  const game = createBaseGame(true);
  game.matchMode = 'random';
  game.matchCode = null;
  game.players.BLUE = {
    socketId: waitingEntry.socketId,
    username: waitingEntry.username,
    isBot: false,
    avatar: pickAvatar(waitingEntry.avatarId, null, waitingEntry.uploadedAvatarDataUrl)
  };
  game.players.RED = {
    socketId: `bot-${game.id}`,
    username: pickBotPlayerName(),
    isBot: true,
    avatar: pickAvatar(null, game.players.BLUE.avatar.id)
  };
  queueBattleStart(
    game,
    `No human opponent found after 20 seconds. ${game.players.RED.username} joined the battle.`,
    [waitingEntry.joinedAt]
  );
}

function createBaseGame(vsBot) {
  const boards = createPairedBoards();
  return {
    id: `game-${Math.random().toString(36).slice(2, 10)}`,
    phase: 'matching',
    matchMode: 'random',
    matchCode: null,
    activeTeam: null,
    vsBot,
    winner: null,
    statusMessage: '',
    players: { BLUE: null, RED: null },
    boards,
    log: [],
    emotes: [],
    botState: { targets: [] },
    lastAttackByTeam: { BLUE: null, RED: null },
    missedTurns: { BLUE: 0, RED: 0 },
    pendingIntroMessage: '',
    matchReadyAt: null,
    matchStartTimer: null,
    resolvingAttack: false,
    resolveTimer: null,
    turnStartedAt: Date.now(),
    turnExpiresAt: Date.now() + TURN_MS,
    turnTimer: null,
    finished: false
  };
}

function startBattle(game, introMessage) {
  game.phase = 'battle';
  game.activeTeam = 'BLUE';
  game.pendingIntroMessage = '';
  game.matchReadyAt = null;
  game.matchStartTimer = null;
  game.resolvingAttack = false;
  addLog(game, introMessage);
  addLog(game, `${game.players.BLUE.username} commands Blue. ${game.players.RED.username} commands Red.`);
  addLog(game, 'Three ships were deployed automatically by the game engine.');
  addLog(game, `${game.players.BLUE.username} opens the battle for Blue.`);
  game.statusMessage = introMessage;
  scheduleTurn(game);
  broadcastGameState(game);
  maybeScheduleBotTurn(game);
}

function queueBattleStart(game, introMessage, joinedAtValues = []) {
  const remainingDelay = Math.max(
    0,
    ...joinedAtValues.map((joinedAt) => Math.max(0, MATCHING_MIN_MS - (Date.now() - joinedAt)))
  );

  game.phase = 'matching';
  game.activeTeam = null;
  game.pendingIntroMessage = introMessage;
  game.matchReadyAt = Date.now() + remainingDelay;
  game.statusMessage = remainingDelay > 0 ? 'Opponent found. Preparing the battle...' : 'Battle starting.';
  saveGame(game);
  broadcastGameState(game);

  game.matchStartTimer = setTimeout(() => {
    const latest = games.get(game.id);
    if (!latest || latest.finished) {
      return;
    }

    startBattle(latest, latest.pendingIntroMessage || introMessage);
  }, remainingDelay);
}

function saveGame(game) {
  games.set(game.id, game);
  for (const team of ['BLUE', 'RED']) {
    const player = game.players[team];
    if (player && !player.isBot) {
      socketToGame.set(player.socketId, game.id);
    }
  }
}

function destroyGame(gameId) {
  const game = games.get(gameId);
  if (!game) {
    return;
  }

  clearWaitTimer(game.players.BLUE?.socketId);
  clearWaitTimer(game.players.RED?.socketId);
  clearTurnTimer(game);
  clearMatchStartTimer(game);
  clearResolveTimer(game);

  for (const team of ['BLUE', 'RED']) {
    const player = game.players[team];
    if (player && !player.isBot) {
      socketToGame.delete(player.socketId);
    }
  }

  games.delete(gameId);
}

function broadcastGameState(game) {
  for (const team of ['BLUE', 'RED']) {
    const player = game.players[team];
    if (!player || player.isBot) {
      continue;
    }

    const socket = io.sockets.sockets.get(player.socketId);
    if (socket) {
      socket.emit('gameState', buildClientState(game, team));
    }
  }
}

function broadcastEmote(game, emoteEvent) {
  for (const team of ['BLUE', 'RED']) {
    const player = game.players[team];
    if (!player || player.isBot) {
      continue;
    }

    const socket = io.sockets.sockets.get(player.socketId);
    if (socket) {
      socket.emit('emoteBurst', emoteEvent);
    }
  }
}

function broadcastAttackWindup(game, attackWindup) {
  for (const team of ['BLUE', 'RED']) {
    const player = game.players[team];
    if (!player || player.isBot) {
      continue;
    }

    const socket = io.sockets.sockets.get(player.socketId);
    if (socket) {
      socket.emit('attackWindup', attackWindup);
    }
  }
}

function buildClientState(game, team) {
  const enemyTeam = team === 'BLUE' ? 'RED' : 'BLUE';
  const ownPlayer = game.players[team];
  const enemyPlayer = game.players[enemyTeam];

  return {
    gameId: game.id,
    phase: game.phase,
    matchMode: game.matchMode,
    matchCode: game.matchCode,
    selfTeam: team,
    activeTeam: game.activeTeam,
    resolvingAttack: game.resolvingAttack,
    isMyTurn: game.phase === 'battle' && game.activeTeam === team && !game.resolvingAttack,
    vsBot: game.vsBot,
    winner: game.winner,
    username: ownPlayer.username,
    opponentName: enemyPlayer.username,
    selfAvatar: ownPlayer.avatar,
    opponentAvatar: enemyPlayer.avatar,
    connectionLabel: buildConnectionLabel(game),
    statusMessage: buildStatusMessage(game, team),
    ownBoard: sanitizeOwnBoard(game.boards[team]),
    enemyBoard: sanitizeEnemyBoard(game.boards[enemyTeam]),
    log: [...game.log].slice(-14).reverse(),
    rowLabels: ROW_LABELS,
    colLabels: COL_LABELS,
    fleetSummary: game.boards[team].ships.map((ship) => ({
      id: ship.id,
      name: ship.name,
      size: ship.size,
      hits: ship.hits,
      sunk: ship.sunk,
      remaining: ship.size - ship.hits
    })),
    enemyFleetSummary: game.boards[enemyTeam].ships.map((ship) => ({
      id: ship.id,
      name: ship.name,
      size: ship.size,
      hits: ship.hits,
      sunk: ship.sunk,
      remaining: ship.size - ship.hits
    })),
    emotes: game.emotes.map((item) => ({ ...item })),
    lastSelfAttack: game.lastAttackByTeam[team],
    turnSecondsLeft: game.resolvingAttack ? 0 : Math.max(0, Math.ceil((game.turnExpiresAt - Date.now()) / 1000)),
    selfSkips: game.missedTurns[team],
    enemySkips: game.missedTurns[enemyTeam]
  };
}

function buildStatusMessage(game, team) {
  if (game.phase === 'matching') {
    const secondsLeft = game.matchReadyAt ? Math.max(0, Math.ceil((game.matchReadyAt - Date.now()) / 1000)) : 0;
    if (game.players.BLUE && game.players.RED) {
      return secondsLeft > 0
        ? `Opponent found. Battle starts in ${secondsLeft} second${secondsLeft > 1 ? 's' : ''}.`
        : 'Opponent found. Entering battle.';
    }

    if (game.matchMode === 'private') {
      return game.matchCode
        ? `Waiting for your friend to join with code ${game.matchCode}.`
        : 'Preparing private room.';
    }

    return game.vsBot
      ? 'Preparing a solo battle.'
      : 'Searching for another player.';
  }

  if (game.phase === 'gameover') {
    return game.winner === team
      ? 'Victory. You destroyed all 3 enemy ships or won by timeout forfeit.'
      : 'Defeat. You lost all ships or forfeited after skipped turns.';
  }

  if (game.resolvingAttack) {
    return 'Impact en cours. Le prochain tour arrive dans 2 secondes.';
  }

  const secondsLeft = Math.max(0, Math.ceil((game.turnExpiresAt - Date.now()) / 1000));
  return game.activeTeam === team
    ? `Your turn. Click one enemy cell within ${secondsLeft} seconds.`
    : `${game.players[game.activeTeam].username} must fire within ${secondsLeft} seconds.`;
}

function buildConnectionLabel(game) {
  if (game.phase === 'matching') {
    if (game.matchMode === 'private') {
      return game.players.BLUE && game.players.RED ? 'Friend found!' : 'Waiting for friend';
    }
    return game.players.BLUE && game.players.RED ? 'Opponent found!' : 'Searching...';
  }

  return game.vsBot ? 'Playing vs Bot' : 'Matched';
}

function sanitizeOwnBoard(board) {
  return {
    rows: buildCells((row, col) => {
      const cell = board.cells[row][col];
      return {
        attacked: cell.attacked,
        result: cell.attacked ? (cell.shipId ? 'hit' : 'miss') : 'unknown',
        hasShip: Boolean(cell.shipId),
        shipId: cell.shipId,
        shipSegmentHit: cell.attacked && Boolean(cell.shipId)
      };
    }),
    ships: board.ships.map((ship) => ({ ...ship }))
  };
}

function sanitizeEnemyBoard(board) {
  return {
    rows: buildCells((row, col) => {
      const cell = board.cells[row][col];
      return {
        attacked: cell.attacked,
        result: cell.attacked ? (cell.shipId ? 'hit' : 'miss') : 'unknown',
        hasShip: false,
        shipId: undefined,
        shipSegmentHit: false
      };
    }),
    ships: board.ships.map((ship) => ({
      id: ship.id,
      name: ship.name,
      size: ship.size,
      orientation: ship.orientation,
      positions: [],
      hits: ship.hits,
      sunk: ship.sunk
    }))
  };
}

function buildCells(project) {
  return Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLS }, (_, col) => ({
      row,
      col,
      label: `${ROW_LABELS[row]}${COL_LABELS[col]}`,
      ...project(row, col)
    }))
  );
}

function createEmptyBoard() {
  return {
    cells: Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => ({ attacked: false, shipId: null }))
    ),
    ships: []
  };
}

function createPairedBoards() {
  const blueBoard = createRandomBoard();
  const forbidden = new Set();

  for (const ship of blueBoard.ships) {
    for (const position of ship.positions) {
      forbidden.add(`${position.row}-${position.col}`);
    }
  }

  const redBoard = createRandomBoard(forbidden);
  return { BLUE: blueBoard, RED: redBoard };
}

function createRandomBoard(forbiddenPositions = new Set()) {
  const board = createEmptyBoard();
  const occupied = new Set();

  for (const shipTemplate of FLEET) {
    let placed = false;
    let attempts = 0;
    while (!placed) {
      attempts += 1;
      if (attempts > 5000) {
        return createRandomBoard(forbiddenPositions);
      }

      const orientation = Math.random() > 0.5 ? 'horizontal' : 'vertical';
      const row = Math.floor(Math.random() * ROWS);
      const col = Math.floor(Math.random() * COLS);
      const layout = getShipLayout(row, col, shipTemplate.lineSize, orientation);
      const positions = layout?.positions;
      if (!positions) {
        continue;
      }

      const overlaps = positions.some((position) => occupied.has(`${position.row}-${position.col}`));
      if (overlaps) {
        continue;
      }

      const conflictsWithForbidden = positions.some((position) => forbiddenPositions.has(`${position.row}-${position.col}`));
      if (conflictsWithForbidden) {
        continue;
      }

      const contactSummary = summarizeShipContacts(board, positions);
      if (contactSummary.newShipContactCount > 1) {
        continue;
      }

      const invalidExistingTouch = Object.entries(contactSummary.existingShipContacts)
        .some(([shipId, contactCount]) => {
          const existingShip = board.ships.find((ship) => ship.id === shipId);
          return existingShip && (existingShip.contactCells || 0) + contactCount > 1;
        });
      if (invalidExistingTouch) {
        continue;
      }

      positions.forEach((position) => occupied.add(`${position.row}-${position.col}`));
      const ship = {
        id: shipTemplate.id,
        name: shipTemplate.name,
        size: shipTemplate.size,
        orientation,
        positions,
        head: layout.head,
        hits: 0,
        sunk: false,
        contactCells: contactSummary.newShipContactCount
      };

      for (const [shipId, contactCount] of Object.entries(contactSummary.existingShipContacts)) {
        const existingShip = board.ships.find((item) => item.id === shipId);
        if (existingShip) {
          existingShip.contactCells = (existingShip.contactCells || 0) + contactCount;
        }
      }

      for (const position of positions) {
        board.cells[position.row][position.col].shipId = ship.id;
      }

      board.ships.push(ship);
      placed = true;
    }
  }

  return board;
}

function getShipPositions(row, col, size, orientation) {
  const positions = [];
  for (let index = 0; index < size; index += 1) {
    const nextRow = orientation === 'vertical' ? row + index : row;
    const nextCol = orientation === 'horizontal' ? col + index : col;
    if (nextRow < 0 || nextRow >= ROWS || nextCol < 0 || nextCol >= COLS) {
      return null;
    }
    positions.push({ row: nextRow, col: nextCol });
  }
  return positions;
}

function getShipLayout(row, col, lineSize, orientation) {
  const linePositions = getShipPositions(row, col, lineSize, orientation);
  if (!linePositions) {
    return null;
  }

  const headCandidates = [];
  for (const position of linePositions) {
    if (orientation === 'horizontal') {
      headCandidates.push({ row: position.row - 1, col: position.col });
      headCandidates.push({ row: position.row + 1, col: position.col });
    } else {
      headCandidates.push({ row: position.row, col: position.col - 1 });
      headCandidates.push({ row: position.row, col: position.col + 1 });
    }
  }

  const validHeadCandidates = shuffleArray(headCandidates).filter((candidate) => {
    if (candidate.row < 0 || candidate.row >= ROWS || candidate.col < 0 || candidate.col >= COLS) {
      return false;
    }

    return !linePositions.some((position) => position.row === candidate.row && position.col === candidate.col);
  });

  if (validHeadCandidates.length === 0) {
    return null;
  }

  const head = validHeadCandidates[0];
  return {
    positions: [...linePositions, head],
    head
  };
}

function shuffleArray(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function summarizeShipContacts(board, positions) {
  const ownContactCells = new Set();
  const existingShipContacts = {};

  for (const position of positions) {
    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
        if (rowOffset === 0 && colOffset === 0) {
          continue;
        }

        const nextRow = position.row + rowOffset;
        const nextCol = position.col + colOffset;
        if (nextRow < 0 || nextRow >= ROWS || nextCol < 0 || nextCol >= COLS) {
          continue;
        }

        const neighbour = board.cells[nextRow][nextCol];
        if (!neighbour.shipId) {
          continue;
        }

        ownContactCells.add(`${position.row}-${position.col}`);
        if (!existingShipContacts[neighbour.shipId]) {
          existingShipContacts[neighbour.shipId] = new Set();
        }
        existingShipContacts[neighbour.shipId].add(`${nextRow}-${nextCol}`);
      }
    }
  }

  return {
    newShipContactCount: ownContactCells.size,
    existingShipContacts: Object.fromEntries(
      Object.entries(existingShipContacts).map(([shipId, contactCells]) => [shipId, contactCells.size])
    )
  };
}

function resolveAttack(game, attackingTeam, row, col) {
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || row >= ROWS || col < 0 || col >= COLS) {
    return;
  }

  const defendingTeam = attackingTeam === 'BLUE' ? 'RED' : 'BLUE';
  const attacker = game.players[attackingTeam];
  const defender = game.players[defendingTeam];
  const defendingBoard = game.boards[defendingTeam];
  const coordinate = `${ROW_LABELS[row]}${COL_LABELS[col]}`;
  const lastAttack = game.lastAttackByTeam[attackingTeam];

  if (lastAttack && lastAttack.row === row && lastAttack.col === col) {
    const attackerSocket = io.sockets.sockets.get(attacker.socketId);
    attackerSocket?.emit('serverMessage', 'You cannot click the same last cell twice in a row.');
    broadcastGameState(game);
    return;
  }

  game.lastAttackByTeam[attackingTeam] = { row, col };

  clearTurnTimer(game);
  clearResolveTimer(game);
  game.resolvingAttack = true;
  broadcastAttackWindup(game, {
    id: `windup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    row,
    col,
    team: attackingTeam
  });
  broadcastGameState(game);
  game.resolveTimer = setTimeout(() => {
    const latest = games.get(game.id);
    if (!latest || latest.phase !== 'battle' || latest.finished) {
      return;
    }

    const latestDefendingBoard = latest.boards[defendingTeam];
    const targetCell = latestDefendingBoard.cells[row][col];
    let sunkShip = null;

    if (targetCell.attacked) {
      addLog(latest, `${attacker.username} fired again at ${coordinate} and wastes the turn.`);
    } else if (targetCell.shipId) {
      targetCell.attacked = true;
      const ship = latestDefendingBoard.ships.find((item) => item.id === targetCell.shipId);
      ship.hits += 1;
      addLog(latest, `${attacker.username} hit ${coordinate}.`);

      if (ship.hits === ship.size) {
        ship.sunk = true;
        sunkShip = ship;
        addLog(latest, `${attacker.username} sank ${defender.username}'s ${ship.name}.`);
      }

      if (latest.vsBot && attackingTeam === 'RED') {
        rememberBotHit(latest, row, col, Boolean(sunkShip));
      }
    } else {
      targetCell.attacked = true;
      addLog(latest, `${attacker.username} missed at ${coordinate}.`);
    }

    latest.resolveTimer = null;
    latest.resolvingAttack = false;

    if (latestDefendingBoard.ships.every((ship) => ship.sunk)) {
      finishGame(latest, attackingTeam, `${attacker.username} destroyed the last ship and wins the game.`);
      return;
    }

    latest.activeTeam = defendingTeam;
    scheduleTurn(latest);
    broadcastGameState(latest);
    maybeScheduleBotTurn(latest);
  }, ATTACK_REVEAL_MS);
}

function scheduleTurn(game) {
  clearTurnTimer(game);
  game.turnStartedAt = Date.now();
  game.turnExpiresAt = game.turnStartedAt + TURN_MS;
  game.turnTimer = setTimeout(() => handleTurnTimeout(game.id), TURN_MS);
}

function clearTurnTimer(game) {
  if (game?.turnTimer) {
    clearTimeout(game.turnTimer);
    game.turnTimer = null;
  }
}

function clearMatchStartTimer(game) {
  if (game?.matchStartTimer) {
    clearTimeout(game.matchStartTimer);
    game.matchStartTimer = null;
  }
}

function clearResolveTimer(game) {
  if (game?.resolveTimer) {
    clearTimeout(game.resolveTimer);
    game.resolveTimer = null;
  }
}

function handleTurnTimeout(gameId) {
  const game = games.get(gameId);
  if (!game || game.phase !== 'battle' || game.finished) {
    return;
  }

  const team = game.activeTeam;
  const otherTeam = team === 'BLUE' ? 'RED' : 'BLUE';
  const player = game.players[team];
  game.missedTurns[team] += 1;
  addLog(game, `${player.username} did not fire in time and loses this turn.`);

  if (game.missedTurns[team] >= MAX_CONSECUTIVE_SKIPS) {
    finishGame(game, otherTeam, `${player.username} skipped 3 turns in a row and loses the game.`);
    return;
  }

  game.activeTeam = otherTeam;
  scheduleTurn(game);
  broadcastGameState(game);
  maybeScheduleBotTurn(game);
}

function finishGame(game, winnerTeam, message) {
  if (!game || game.finished) {
    return;
  }

  game.finished = true;
  game.phase = 'gameover';
  game.winner = winnerTeam;
  game.activeTeam = null;
  game.statusMessage = message;
  clearTurnTimer(game);
  clearMatchStartTimer(game);
  clearResolveTimer(game);
  game.resolvingAttack = false;
  addLog(game, message);
  broadcastGameState(game);
}

function maybeScheduleBotTurn(game) {
  if (!game.vsBot || game.phase !== 'battle' || game.activeTeam !== 'RED') {
    return;
  }

  const botDelayMs = Math.floor(Math.random() * (TURN_MS + 1));
  setTimeout(() => {
    const latest = games.get(game.id);
    if (!latest || latest.phase !== 'battle' || latest.activeTeam !== 'RED' || latest.finished) {
      return;
    }

    const target = chooseBotTarget(latest);
    resolveAttack(latest, 'RED', target.row, target.col);
  }, botDelayMs);
}

function chooseBotTarget(game) {
  const board = game.boards.BLUE;

  while (game.botState.targets.length > 0) {
    const target = game.botState.targets.shift();
    if (target && !board.cells[target.row][target.col].attacked) {
      return target;
    }
  }

  const candidates = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      if (!board.cells[row][col].attacked) {
        candidates.push({ row, col });
      }
    }
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}

function rememberBotHit(game, row, col, sunkShip) {
  if (sunkShip) {
    game.botState.targets = [];
    return;
  }

  const directions = [
    { row: -1, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: -1 },
    { row: 0, col: 1 }
  ];

  for (const direction of directions) {
    const nextRow = row + direction.row;
    const nextCol = col + direction.col;
    if (nextRow < 0 || nextRow >= ROWS || nextCol < 0 || nextCol >= COLS) {
      continue;
    }

    const alreadyQueued = game.botState.targets.some((target) => target.row === nextRow && target.col === nextCol);
    const alreadyAttacked = game.boards.BLUE.cells[nextRow][nextCol].attacked;
    if (!alreadyQueued && !alreadyAttacked) {
      game.botState.targets.push({ row: nextRow, col: nextCol });
    }
  }
}

function addLog(game, message) {
  game.log.push(message);
}

function getPlayerContext(socketId) {
  const gameId = socketToGame.get(socketId);
  if (!gameId) {
    return null;
  }

  const game = games.get(gameId);
  if (!game) {
    return null;
  }

  if (game.players.BLUE?.socketId === socketId) {
    return { game, team: 'BLUE' };
  }

  if (game.players.RED?.socketId === socketId) {
    return { game, team: 'RED' };
  }

  return null;
}

function removeFromQueue(socketId) {
  const index = waitingPlayers.findIndex((entry) => entry.socketId === socketId);
  if (index >= 0) {
    waitingPlayers.splice(index, 1);
  }
}

function removePrivateMatchBySocket(socketId) {
  for (const [code, entry] of privateMatches.entries()) {
    if (entry.socketId === socketId) {
      privateMatches.delete(code);
      return;
    }
  }
}

function clearWaitTimer(socketId) {
  if (!socketId) {
    return;
  }

  const timer = playerWaitTimers.get(socketId);
  if (timer) {
    clearTimeout(timer);
    playerWaitTimers.delete(socketId);
  }
}

function sanitizeUsername(value) {
  return String(value || '').trim().slice(0, 18);
}

function generatePrivateCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  } while (privateMatches.has(code));
  return code;
}

function sanitizePrivateCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(code) ? code : null;
}

function pickBotPlayerName() {
  return BOT_PLAYER_NAMES[Math.floor(Math.random() * BOT_PLAYER_NAMES.length)];
}

function pickAvatar(preferredId = null, excludedId = null, uploadedAvatarDataUrl = null) {
  if (uploadedAvatarDataUrl) {
    return {
      id: `upload-${Math.random().toString(36).slice(2, 10)}`,
      tint: '#94a3b8',
      source: 'upload',
      imageDataUrl: uploadedAvatarDataUrl
    };
  }

  if (preferredId) {
    const preferred = AVATAR_POOL.find((avatar) => avatar.id === preferredId && avatar.id !== excludedId);
    if (preferred) {
      return { ...preferred, source: 'preset' };
    }
  }

  const available = excludedId
    ? AVATAR_POOL.filter((avatar) => avatar.id !== excludedId)
    : AVATAR_POOL;
  const source = available.length > 0 ? available : AVATAR_POOL;
  const avatar = source[Math.floor(Math.random() * source.length)];
  return { ...avatar, source: 'preset' };
}

function sanitizeAvatarId(value) {
  const avatarId = String(value || '').trim();
  return AVATAR_POOL.some((avatar) => avatar.id === avatarId) ? avatarId : null;
}

function sanitizeUploadedAvatar(value) {
  const dataUrl = String(value || '').trim();
  if (!dataUrl) {
    return null;
  }

  if (!/^data:image\/(png|jpeg|jpg|webp);base64,[a-z0-9+/=]+$/i.test(dataUrl)) {
    return null;
  }

  return dataUrl.length <= 350000 ? dataUrl : null;
}

function sanitizeEmote(value) {
  const allowed = ['sword', 'bomb', 'laugh', 'cry', 'fire', 'cool'];
  return allowed.includes(value) ? value : null;
}
