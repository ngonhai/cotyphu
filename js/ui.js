// ui.js — rendering + DOM event wiring. Reads `state` (from game.js) and paints the page.

function showScreen(name){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  if (name === 'game') fitBoardToViewport();
}

// ---------- Board sizing ----------
// CSS alone (dvh/vw calc against an assumed header/side-panel size) drifts from
// reality at some zoom levels/browsers, which is what let the board render larger
// than its actual space and get clipped by its own frame. This measures the *real*
// rendered space inside #board-wrap — on both desktop (board-wrap shares a row with
// the side panel) and mobile (board-wrap is flex:1 in a column above the stacked side
// panel — see CSS) — and sets #board's pixel size directly from those real numbers.
// The gold frame is a box-shadow drawn on #board itself, so it always exactly hugs
// the board at whatever size this produces; there's no separate frame element that
// could get out of sync or overhang past it.
function fitBoardToViewport(){
  const wrap = document.getElementById('board-wrap');
  const board = document.getElementById('board');
  if (!wrap || !board) return;

  const cs = getComputedStyle(wrap);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const availW = wrap.clientWidth - padX;
  const availH = wrap.clientHeight - padY;
  if (availW <= 0 || availH <= 0) return; // not laid out yet (e.g. screen still hidden)

  const size = Math.max(240, Math.min(availW, availH, 940));
  board.style.width = size + 'px';
  board.style.height = size + 'px';
}

function goToLobby(){
  unsubscribeRoom();
  ROOM_ID = null;
  location.hash = '';
  showScreen('lobby');
}

let toastTimer = null;
function showToast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

function renderAll(){
  if (!state) return;
  if (state.status === 'lobby'){
    showScreen('waiting');
    renderWaitingRoom();
    hideWinnerBanner();
  } else if (state.status === 'playing'){
    showScreen('game');
    renderGame();
    hideWinnerBanner();
  } else if (state.status === 'ended'){
    showScreen('game');
    renderGame();
    renderWinnerBanner();
    maybeShowWinnerModal();
  }
}

// Shows a one-time celebratory popup for whoever is left standing after everyone
// else has gone bankrupt. Guarded so it only pops up once per game (renderAll runs
// on every Firebase update, and the room/winner won't change again after this).
let winnerModalShownFor = null;
function maybeShowWinnerModal(){
  if (!state.winner) return;
  const key = ROOM_ID + ':' + state.winner;
  if (winnerModalShownFor === key) return;
  winnerModalShownFor = key;

  const modal = document.getElementById('modal');
  const iWon = state.winner === MY_UID;
  modal.innerHTML = `
    <div class="modal-card winner-modal">
      <div class="winner-modal-emoji">🏆🎉</div>
      <h2>${escapeHtml(state.players[state.winner].name)} wins!</h2>
      <p>${iWon ? "Congratulations — you're the last one standing!" : 'Everyone else went bankrupt — thanks for playing!'}</p>
      <div class="modal-actions">
        <button class="btn" id="winner-modal-close">${iWon ? 'Nice!' : 'Close'}</button>
      </div>
    </div>`;
  modal.classList.add('show');
  document.getElementById('winner-modal-close').onclick = () => modal.classList.remove('show');
}

// ---------- Waiting room ----------

function renderWaitingRoom(){
  document.getElementById('room-code-display').textContent = ROOM_ID;
  const list = document.getElementById('waiting-players');
  list.innerHTML = '';
  const players = Object.entries(state.players || {});
  const amHost = MY_UID === state.hostUid;
  players.forEach(([uid, p]) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="token-dot" style="background:${p.color}"></span> <span class="player-li-name">${escapeHtml(p.name)}</span> ${uid===state.hostUid ? '<span class="tag">HOST</span>' : ''} ${uid===MY_UID ? '<span class="tag you">YOU</span>' : ''}`;
    if (amHost && uid !== state.hostUid){
      const kickBtn = document.createElement('button');
      kickBtn.className = 'btn-kick';
      kickBtn.type = 'button';
      kickBtn.textContent = 'Kick';
      kickBtn.onclick = () => {
        if (confirm(`Kick ${p.name} from the room?`)) kickPlayer(uid);
      };
      li.appendChild(kickBtn);
    }
    list.appendChild(li);
  });
  document.getElementById('waiting-count').textContent = `${players.length} / ${state.settings?.maxPlayers ?? 6} players`;
  const startBtn = document.getElementById('btn-start-game');
  startBtn.style.display = (MY_UID === state.hostUid) ? 'block' : 'none';
  startBtn.disabled = players.length < 2;
  document.getElementById('waiting-hint').style.display = (MY_UID === state.hostUid) ? 'none' : 'block';

  const isHost = MY_UID === state.hostUid;
  const settings = state.settings || {};
  const ruleFullset = document.getElementById('rule-fullset');
  const ruleTrading = document.getElementById('rule-trading');
  const ruleFreeParking = document.getElementById('rule-freeparking');
  const ruleRentInJail = document.getElementById('rule-rentinjail');
  const inputJailFine = document.getElementById('input-jailfine');
  ruleFullset.checked = settings.requireFullSetToBuild !== false;
  ruleTrading.checked = settings.tradingEnabled !== false;
  ruleFreeParking.checked = !!settings.freeParkingJackpot;
  ruleRentInJail.checked = settings.collectRentIfOwnerInJail !== false;
  inputJailFine.value = settings.jailFineAmount ?? 50;
  [ruleFullset, ruleTrading, ruleFreeParking, ruleRentInJail].forEach(el => {
    el.disabled = !isHost;
    el.closest('.rule-row').classList.toggle('disabled', !isHost);
  });
  inputJailFine.disabled = !isHost;
  inputJailFine.closest('.rule-row').classList.toggle('disabled', !isHost);
  document.getElementById('rules-readonly-hint').style.display = isHost ? 'none' : 'block';
  ruleFullset.onchange = () => updateSetting('requireFullSetToBuild', ruleFullset.checked);
  ruleTrading.onchange = () => updateSetting('tradingEnabled', ruleTrading.checked);
  ruleFreeParking.onchange = () => updateSetting('freeParkingJackpot', ruleFreeParking.checked);
  ruleRentInJail.onchange = () => updateSetting('collectRentIfOwnerInJail', ruleRentInJail.checked);
  inputJailFine.onchange = () => {
    const val = parseInt(inputJailFine.value);
    updateSetting('jailFineAmount', (Number.isFinite(val) && val >= 0) ? val : 50);
  };

  const cashMode = settings.cashRuleMode === 'mortgage' ? 'mortgage' : 'sell';
  const cashRadios = document.querySelectorAll('input[name="cashRuleMode"]');
  cashRadios.forEach(r => {
    r.checked = (r.value === cashMode);
    r.disabled = !isHost;
    r.onchange = () => updateSetting('cashRuleMode', r.value);
  });
  const cashModeRow = document.getElementById('rule-cashmode');
  if (cashModeRow) cashModeRow.classList.toggle('disabled', !isHost);

  const ruleGoBonusToggle = document.getElementById('rule-gobonus-toggle');
  const inputGoBonusAmount = document.getElementById('input-gobonus-amount');
  ruleGoBonusToggle.checked = !!settings.goBonusEnabled;
  inputGoBonusAmount.value = settings.goBonusAmount ?? 200;
  ruleGoBonusToggle.disabled = !isHost;
  inputGoBonusAmount.disabled = !isHost || !ruleGoBonusToggle.checked;
  document.getElementById('rule-gobonus').classList.toggle('disabled', !isHost);
  ruleGoBonusToggle.onchange = () => {
    updateSetting('goBonusEnabled', ruleGoBonusToggle.checked);
    inputGoBonusAmount.disabled = !isHost || !ruleGoBonusToggle.checked;
  };
  inputGoBonusAmount.onchange = () => {
    const val = parseInt(inputGoBonusAmount.value);
    updateSetting('goBonusAmount', (Number.isFinite(val) && val >= 0) ? val : 200);
  };
}

// ---------- Game board ----------

function renderGame(){
  document.getElementById('game-room-code-label').textContent = ROOM_ID;
  document.getElementById('spectator-badge').style.display = isSpectator() ? 'inline-block' : 'none';
  maybeAnimateMoveHop();
  renderBoard();
  renderPlayerPanel();
  renderDice();
  renderActionBar();
  renderLog();
  renderPropertyDrawerButton();
  renderBankruptButton();
  renderTradeButton();
  refreshOpenTradeModalIfNeeded();
}

// True for anyone watching the game who never took (or no longer has) a seat — either
// a spectator who joined after the game started, or the rare case of a raw state where
// this uid has no player record at all. Bankrupt players still have a player record
// (they're spectating too, but stay visible in the player list), so this deliberately
// only checks for a MISSING record, not a bankrupt one.
function isSpectator(){
  return !!(state && !state.players[MY_UID]);
}

// Header "Bankrupt" button: only visible while the game is live and you haven't
// already given up — once you're bankrupt/spectating there's nothing left to give up.
function renderBankruptButton(){
  const btn = document.getElementById('btn-bankrupt');
  const me = state.players[MY_UID];
  const show = state.status === 'playing' && me && !me.bankrupt;
  btn.style.display = show ? 'inline-flex' : 'none';
}

function refreshOpenTradeModalIfNeeded(){
  const modal = document.getElementById('modal');
  if (!modal.classList.contains('show')) return;
  const incomingPanel = document.getElementById('trade-tab-incoming');
  if (!incomingPanel) return; // trade center isn't the open modal
  renderIncomingTrades();
  renderOutgoingTrades();
  const tabs = modal.querySelectorAll('.trade-tab-btn');
  if (tabs[0]) tabs[0].textContent = `Incoming (${pendingIncomingTrades().length})`;
  if (tabs[1]) tabs[1].textContent = `Sent (${pendingOutgoingTrades().length})`;
}

function renderTradeButton(){
  const btn = document.getElementById('btn-trades');
  if (isSpectator()){ btn.style.display = 'none'; return; }
  btn.style.display = 'inline-flex';
  const count = pendingIncomingTrades().length;
  const badge = document.getElementById('trades-badge');
  if (count > 0){ badge.style.display='flex'; badge.textContent = count; }
  else { badge.style.display='none'; }
}

function renderBoard(){
  const board = document.getElementById('board-grid');
  if (board.childElementCount === 0){
    // build tiles once
    BOARD.forEach(tile => {
      const pos = tileGridPos(tile.i);
      const div = document.createElement('div');
      div.className = 'tile tile-' + tile.type + (tile.group ? ' group-' + tile.group : '');
      div.style.gridRow = pos.row;
      div.style.gridColumn = pos.col;
      div.dataset.i = tile.i;
      div.dataset.side = tileInwardSide(pos);
      div.innerHTML = tileInnerHtml(tile);
      div.addEventListener('click', () => onTileClick(tile.i));
      board.appendChild(div);
    });
    const center = document.createElement('div');
    center.className = 'board-center';
    center.id = 'board-center';
    center.style.gridRow = '2 / 11';
    center.style.gridColumn = '2 / 11';
    center.innerHTML = '<div class="board-title">Boardwalk<br>Night</div>';
    board.appendChild(center);
  }

  // update ownership ring + monopoly glow + houses
  BOARD.forEach(tile => {
    if (!(tile.type==='property'||tile.type==='railroad'||tile.type==='utility')) return;
    const pdata = state.properties[tile.i];
    const el = board.querySelector(`[data-i="${tile.i}"]`);
    el.classList.toggle('mortgaged', !!pdata.mortgaged);

    if (pdata.owner){
      el.classList.add('owned');
      el.style.setProperty('--owner-color', state.players[pdata.owner].color);
    } else {
      el.classList.remove('owned');
      el.style.removeProperty('--owner-color');
    }

    const isMonopoly = tile.type === 'property' && pdata.owner && groupFullSetOwner(tile.group) === pdata.owner;
    el.classList.toggle('monopoly', !!isMonopoly);

    let houseWrap = el.querySelector('.houses');
    if (houseWrap) houseWrap.remove();
    if (pdata.houses > 0){
      houseWrap = document.createElement('div');
      houseWrap.className = 'houses';
      houseWrap.innerHTML = pdata.houses === 5 ? '<span class="hotel">🏨</span>' : '🏠'.repeat(pdata.houses);
      el.appendChild(houseWrap);
    }
  });

  renderTokens();
}

function hexToRgba(hex, alpha){
  const h = hex.replace('#','');
  const r = parseInt(h.substring(0,2),16), g = parseInt(h.substring(2,4),16), b = parseInt(h.substring(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Which edge of a tile faces the board's center — used to place the color-group dot
// so all of them point inward toward the middle of the board, like a compass.
function tileInwardSide(pos){
  if (pos.row === 11) return 'top';
  if (pos.row === 1) return 'bottom';
  if (pos.col === 1) return 'right';
  if (pos.col === 11) return 'left';
  return 'bottom';
}

// True if a single player owns every tile in a color group (a "monopoly").
function groupFullSetOwner(group){
  const tiles = BOARD.filter(t => t.group === group);
  if (tiles.length === 0 || tiles.some(t => !state.properties[t.i]?.owner)) return null;
  const owners = new Set(tiles.map(t => state.properties[t.i].owner));
  return owners.size === 1 ? [...owners][0] : null;
}

function tileInnerHtml(tile){
  const icon = { chance:'❓', chest:'📦', tax:'💰', jail:'🚔', free:'🅿️', gotojail:'👮', go:'➡️' }[tile.type] || '';
  const price = tile.price ? `<div class="tile-price">$${tile.price}</div>` : '';
  const dot = tile.group ? `<div class="group-dot group-${tile.group}"></div>` : '';
  return `${dot}<div class="tile-name">${icon} ${escapeHtml(tile.name)}</div>${price}`;
}

// ---------- Step-by-step token hop animation ----------
// While a player's real DB position hasn't caught up yet, we manually walk a single
// "hop token" tile-by-tile so everyone sees the token physically move, rather than
// snapping straight to the destination.

let hoppingUid = null;   // uid currently being manually animated (skipped by renderTokens)
let hopState = null;     // { uid, expectedFinalTile, key }
let hopTimers = [];
let hopReleaseFallbackTimer = null;

function clearHopTimers(){ hopTimers.forEach(clearTimeout); hopTimers = []; }

function ensureHopTokenEl(uid){
  let el = document.getElementById('hop-token');
  if (!el){
    el = document.createElement('div');
    el.id = 'hop-token';
    el.className = 'player-token hopping';
  }
  el.style.background = state.players[uid].color;
  return el;
}

function placeHopTokenOnTile(uid, tileIndex){
  const el = ensureHopTokenEl(uid);
  const tileEl = document.querySelector(`[data-i="${tileIndex}"]`);
  if (tileEl){
    tileEl.appendChild(el);
    el.classList.remove('bounce');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add('bounce');
  }
}

function removeHopTokenEl(){
  const el = document.getElementById('hop-token');
  if (el) el.remove();
}

function maybeAnimateMoveHop(){
  if (state.moveHop){
    const { uid, from, steps, tumbleMs, stepMs, nonce } = state.moveHop;
    const key = `${uid}-${from}-${steps}-${nonce}`;
    if (!hopState || hopState.key !== key){
      clearHopTimers();
      if (hopReleaseFallbackTimer){ clearTimeout(hopReleaseFallbackTimer); hopReleaseFallbackTimer = null; }
      const expectedFinalTile = (from + steps) % 40;
      hopState = { uid, expectedFinalTile, key };
      hoppingUid = uid;
      placeHopTokenOnTile(uid, from % 40); // sit at the start tile through the dice tumble
      hopTimers.push(setTimeout(() => {
        for (let s=1; s<=steps; s++){
          hopTimers.push(setTimeout(() => {
            placeHopTokenOnTile(uid, (from + s) % 40);
          }, (s-1) * stepMs));
        }
      }, tumbleMs));
    }
    return;
  }
  // Release the hop lock once the real DB position has caught up to where we animated to.
  if (hopState){
    const p = state.players[hopState.uid];
    if (p && p.position === hopState.expectedFinalTile){
      removeHopTokenEl();
      hoppingUid = null;
      hopState = null;
      if (hopReleaseFallbackTimer){ clearTimeout(hopReleaseFallbackTimer); hopReleaseFallbackTimer = null; }
    } else if (!hopReleaseFallbackTimer){
      // Safety net: if a Chance/Chest card relocates the player again right after landing,
      // position will never equal expectedFinalTile — release after a short grace period
      // instead of leaving the token stuck forever.
      hopReleaseFallbackTimer = setTimeout(() => {
        removeHopTokenEl();
        hoppingUid = null;
        hopState = null;
        hopReleaseFallbackTimer = null;
        renderTokens();
      }, 1500);
    }
  }
}

function renderTokens(){
  document.querySelectorAll('.player-token').forEach(t => { if (t.id !== 'hop-token') t.remove(); });
  const grouped = {};
  Object.entries(state.players).forEach(([uid,p]) => {
    if (p.bankrupt || uid === hoppingUid) return;
    grouped[p.position] = grouped[p.position] || [];
    grouped[p.position].push([uid,p]);
  });
  Object.entries(grouped).forEach(([pos, arr]) => {
    const el = document.querySelector(`[data-i="${pos}"]`);
    if (!el) return;
    arr.forEach(([uid,p], idx) => {
      const tok = document.createElement('div');
      tok.className = 'player-token' + (uid===MY_UID ? ' me' : '') + (p.inJail ? ' in-jail' : '');
      tok.style.background = p.color;
      tok.style.transform = `translate(${idx*7}px, ${idx*7}px)`;
      tok.title = p.inJail ? `${p.name} — in jail` : p.name;
      el.appendChild(tok);
    });
  });
}

// Tracks each player's money from the previous render so we can flash a "+$X"/"-$X"
// next to their balance whenever it changes, then let it fade on its own (see the
// money-delta CSS animation). Keyed by uid; reset whenever a fresh room is joined.
let prevMoneyByUid = {};
// Tracks each player's currently-showing delta element + its removal timer, so if a
// new change lands before the old flash has finished, we swap it in immediately
// instead of stacking two on top of each other or leaving the old one to finish late.
let moneyDeltaByUid = {};

// IMPORTANT: this updates existing card DOM nodes in place instead of wiping and
// rebuilding the whole panel every call (renderGame — and therefore this — reruns on
// *every* Firebase update, not just money changes: dice rolling, log entries, turn
// changes, etc. all trigger it). Wiping innerHTML each time was destroying the
// money-delta flash's <span> mid-animation within milliseconds of it appearing, which
// is why it looked instant no matter how long the CSS animation was set to.
function renderPlayerPanel(){
  const wrap = document.getElementById('player-panel');
  const order = state.seatOrder || state.turnOrder;

  order.forEach(uid => {
    const p = state.players[uid];
    if (!p) return;

    let card = wrap.querySelector(`.player-card[data-uid="${uid}"]`);
    if (!card){
      card = document.createElement('div');
      card.dataset.uid = uid;
      card.innerHTML = `
        <span class="token-dot"></span>
        <div class="player-info">
          <div class="player-name"></div>
          <div class="player-money"><span class="money-amount"></span></div>
        </div>
      `;
      wrap.appendChild(card);
    }

    const inDebt = !p.bankrupt && p.money < 0;
    card.className = 'player-card' + (state.currentTurn===uid ? ' active-turn' : '') + (p.bankrupt ? ' bankrupt' : '') + (inDebt ? ' in-debt' : '');
    card.querySelector('.token-dot').style.background = p.color;
    card.querySelector('.player-name').innerHTML =
      `${escapeHtml(p.name)}${uid===MY_UID?' (you)':''}${p.inJail?' 🚔':''}${p.bankrupt ? ' <span class="status-badge bankrupt-badge">Bankrupt</span>' : ''}`;

    // Host-only Kick button, hidden for the host's own card and for anyone already out.
    let kickBtn = card.querySelector('.btn-kick');
    if (MY_UID === state.hostUid && uid !== state.hostUid && !p.bankrupt){
      if (!kickBtn){
        kickBtn = document.createElement('button');
        kickBtn.className = 'btn-kick';
        kickBtn.type = 'button';
        kickBtn.textContent = 'Kick';
        card.appendChild(kickBtn);
      }
      kickBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm(`Kick ${p.name} from the game? They'll be marked bankrupt.`)) kickPlayer(uid);
      };
    } else if (kickBtn){
      kickBtn.remove();
    }

    const moneyWrap = card.querySelector('.player-money');
    moneyWrap.classList.toggle('debt', inDebt);
    moneyWrap.querySelector('.money-amount').textContent = `$${p.money}${inDebt?' ⚠️ in debt':''}`;

    let turnBadge = card.querySelector('.turn-badge');
    if (state.currentTurn === uid){
      if (!turnBadge){ turnBadge = document.createElement('span'); turnBadge.className = 'turn-badge'; turnBadge.textContent = 'TURN'; card.appendChild(turnBadge); }
    } else if (turnBadge){
      turnBadge.remove();
    }

    const prev = prevMoneyByUid[uid];
    const diff = (typeof prev === 'number') ? p.money - prev : 0;
    if (diff !== 0 && !p.bankrupt){
      const existing = moneyDeltaByUid[uid];
      if (existing){ clearTimeout(existing.timer); existing.el.remove(); }
      const delta = document.createElement('span');
      delta.className = 'money-delta ' + (diff > 0 ? 'positive' : 'negative');
      delta.textContent = (diff > 0 ? '+' : '-') + '$' + Math.abs(diff);
      moneyWrap.appendChild(delta);
      const timer = setTimeout(() => { delta.remove(); delete moneyDeltaByUid[uid]; }, 2250);
      moneyDeltaByUid[uid] = { el: delta, timer };
    }
    prevMoneyByUid[uid] = p.money;
  });

  // Drop cards for any uid no longer in the seat order (doesn't normally happen mid-game,
  // but keeps this safe if it ever does).
  Array.from(wrap.querySelectorAll('.player-card')).forEach(card => {
    if (!order.includes(card.dataset.uid)) card.remove();
  });

  let pot = wrap.querySelector('.jackpot-line');
  if (state.settings?.freeParkingJackpot){
    if (!pot){ pot = document.createElement('div'); pot.className = 'jackpot-line'; wrap.appendChild(pot); }
    pot.textContent = `🅿️ Free Parking pot: $${state.freeParkingPot||0}`;
    wrap.appendChild(pot); // keep it pinned after the (possibly reordered) player cards
  } else if (pot){
    pot.remove();
  }
}

let diceAnimTimer = null;
function renderDice(){
  const die1 = document.getElementById('die1');
  const die2 = document.getElementById('die2');
  if (state.rolling){
    if (!diceAnimTimer){
      die1.classList.add('rolling-die');
      die2.classList.add('rolling-die');
      diceAnimTimer = setInterval(() => {
        die1.textContent = DICE_FACES[1 + Math.floor(Math.random()*6)];
        die2.textContent = DICE_FACES[1 + Math.floor(Math.random()*6)];
      }, 90);
    }
    return;
  }
  if (diceAnimTimer){ clearInterval(diceAnimTimer); diceAnimTimer = null; }
  die1.classList.remove('rolling-die');
  die2.classList.remove('rolling-die');
  const [d1,d2] = state.dice || [1,1];
  die1.textContent = DICE_FACES[d1];
  die2.textContent = DICE_FACES[d2];
}
const DICE_FACES = {1:'⚀',2:'⚁',3:'⚂',4:'⚃',5:'⚄',6:'⚅'};

function renderActionBar(){
  const bar = document.getElementById('action-bar');
  bar.innerHTML = '';
  if (state.status === 'ended') return;

  if (isSpectator()){
    bar.innerHTML = `<div class="waiting-msg">👀 You're spectating — sit back and watch!</div>`;
    return;
  }

  const me = state.players[MY_UID];

  // Being in debt takes priority over everything else — whether or not it's your turn,
  // you need to raise cash or declare bankruptcy before anything else can happen for you.
  if (me && !me.bankrupt && me.money < 0){
    renderDebtBar(bar, me);
    return;
  }

  if (me && me.bankrupt){
    bar.innerHTML = `<div class="waiting-msg">👋 You're out of the game — spectating the rest.</div>`;
    return;
  }

  if (state.rolling){
    bar.innerHTML = `<div class="waiting-msg">🎲 Rolling…</div>`;
    return;
  }

  const myTurn = isMyTurn();

  if (!myTurn){
    bar.innerHTML = `<div class="waiting-msg">Waiting for ${escapeHtml(state.players[state.currentTurn]?.name || '...')} to play…</div>`;
    return;
  }

  // Jail-escape options (pay fine / use card / roll for doubles) only apply at the
  // START of a turn (turnPhase 'roll'). If a player just got sent to jail mid-turn
  // (e.g. landed on Go To Jail, drew a card, or hit three doubles in a row), turnPhase
  // is 'end' — they must click "End Turn" and wait for their next turn to try for jail,
  // rather than immediately rolling again in the turn that jailed them.
  if (me.inJail && state.turnPhase === 'roll'){
    const fine = state.settings?.jailFineAmount ?? 50;
    bar.appendChild(btn(`Pay $${fine} to get out`, payJailFine, me.money < fine));
    bar.appendChild(btn(`Use Jail-Free Card (${me.jailFreeCards||0})`, useJailCard, (me.jailFreeCards||0) < 1));
    bar.appendChild(btn('Roll for doubles', rollForJail));
    return;
  }

  if (state.turnPhase === 'roll'){
    bar.appendChild(btn('🎲 Roll Dice', rollDice));
  } else if (state.turnPhase === 'action' && state.pendingBuy && state.pendingBuy.uid === MY_UID){
    const tile = BOARD[state.pendingBuy.tileIndex];
    bar.appendChild(btn(`Buy ${tile.name} — $${tile.price}`, buyProperty, me.money < tile.price));
    bar.appendChild(btn('Decline', declineBuy, false, true));
  } else if (state.turnPhase === 'end'){
    bar.appendChild(btn('End Turn', endTurn));
  }
}

function renderDebtBar(bar, me){
  const raiseCashHint = state.settings?.cashRuleMode === 'mortgage'
    ? 'Mortgage properties'
    : 'Sell houses/hotels back to the bank';
  const banner = document.createElement('div');
  banner.className = 'debt-banner';
  banner.innerHTML = `⚠️ You're short <strong>$${Math.abs(me.money)}</strong>. ${escapeHtml(raiseCashHint)} to cover it, or declare bankruptcy.`;
  bar.appendChild(banner);
  const row = document.createElement('div');
  row.className = 'debt-actions';
  row.appendChild(btn('Manage My Properties', openPropertiesDrawer));
  row.appendChild(btn('Declare Bankruptcy', confirmBankruptcy, false, true));
  bar.appendChild(row);
}

function confirmBankruptcy(){
  if (confirm("Declare bankruptcy? You'll be out of the game and your remaining properties will be handed over.")){
    declareBankruptcy();
  }
}

function btn(label, fn, disabled, secondary){
  const b = document.createElement('button');
  b.className = 'btn' + (secondary ? ' btn-secondary' : '');
  b.textContent = label;
  b.disabled = !!disabled;
  b.addEventListener('click', fn);
  return b;
}

// Wraps every occurrence of a player's name in an already-HTML-escaped log message with
// a span colored to that player's token color, so it's easy to scan who's who at a glance.
function colorizeLogMessage(escapedMsg){
  let result = escapedMsg;
  Object.values(state.players || {}).forEach(p => {
    const escapedName = escapeHtml(p.name);
    if (!escapedName || !result.includes(escapedName)) return;
    result = result.split(escapedName).join(`<span class="log-name" style="color:${p.color}">${escapedName}</span>`);
  });
  return result;
}

function renderLog(){
  const el = document.getElementById('log-panel');
  const entries = Object.values(state.log || {}).sort((a,b) => a.ts - b.ts).slice(-40);
  el.innerHTML = entries.map(e => `<div class="log-entry">${colorizeLogMessage(escapeHtml(e.msg))}</div>`).join('');
  el.scrollTop = el.scrollHeight;
}

function renderWinnerBanner(){
  const el = document.getElementById('winner-banner');
  if (state.winner){
    el.textContent = `🏆 ${state.players[state.winner].name} wins the game!`;
  } else {
    el.textContent = `Game over.`;
  }
  el.style.display = 'block';
}

// Used any time we're NOT showing the ended-game state (new round started, back in
// the lobby, etc.) — without this the banner set by renderWinnerBanner() had no
// counterpart to turn it back off, so "<name> wins the game!" kept showing at the
// top of the next game too. Clearing textContent as well (not just hiding) means a
// stale name can't flash on screen for a frame before the next real update arrives.
function hideWinnerBanner(){
  const el = document.getElementById('winner-banner');
  el.style.display = 'none';
  el.textContent = '';
}

// ---------- Property management drawer ----------

function renderPropertyDrawerButton(){
  document.getElementById('btn-properties').style.display = isSpectator() ? 'none' : 'inline-flex';
}

function onTileClick(tileIndex){
  const tile = BOARD[tileIndex];
  if (!(tile.type==='property' || tile.type==='railroad' || tile.type==='utility')) return;
  openPropertyDetail(tileIndex);
}

function openPropertyDetail(tileIndex){
  const tile = BOARD[tileIndex];
  const pdata = state.properties[tileIndex];
  const modal = document.getElementById('modal');
  const owner = pdata.owner ? state.players[pdata.owner].name : 'Unowned';
  let rentLines = '';
  if (tile.type === 'property'){
    const labels = ['Base (or full set: double)','1 house','2 houses','3 houses','4 houses','Hotel'];
    rentLines = tile.rent.map((r,i) => `<div class="rent-row">${labels[i]}<span>$${i===0 ? r+' / '+(r*2) : r}</span></div>`).join('');
  } else if (tile.type === 'railroad'){
    rentLines = tile.rent.map((r,i) => `<div class="rent-row">${i+1} railroad${i?'s':''}<span>$${r}</span></div>`).join('');
  } else {
    rentLines = `<div class="rent-row">1 utility<span>4× dice roll</span></div><div class="rent-row">2 utilities<span>10× dice roll</span></div>`;
  }

  let controls = '';
  const isMine = pdata.owner === MY_UID;
  const cashRuleMode = state.settings?.cashRuleMode === 'mortgage' ? 'mortgage' : 'sell';
  if (isMine && tile.type === 'property'){
    const buildCheck = canBuildOn(tileIndex);
    const sellBlocked = cashRuleMode === 'mortgage';
    controls += `<div class="modal-actions">
      <button class="btn" id="mbtn-build" ${buildCheck.ok ? '' : 'disabled title="'+escapeHtml(buildCheck.reason)+'"'}>Build (${pdata.houses>=4?'Hotel':'House'} — $${tile.house})</button>
      <button class="btn btn-secondary" id="mbtn-sell" ${(pdata.houses<=0 || sellBlocked)?'disabled':''} ${sellBlocked?'title="House rule: Mortgage Mode is on — sell is off."':''}>Sell house (+$${Math.floor(tile.house/2)})</button>
    </div>
    ${!buildCheck.ok ? `<p class="muted" style="font-size:.78rem;">${escapeHtml(buildCheck.reason)}</p>` : ''}
    ${sellBlocked ? `<p class="muted" style="font-size:.78rem;">House rule: Mortgage Mode is on, so houses can't be sold back — mortgage the property instead.</p>` : ''}`;
  }
  if (isMine && pdata.houses===0 && isMyTurn()){
    const mortgageBlocked = cashRuleMode === 'sell' && !pdata.mortgaged;
    controls += `<div class="modal-actions">
      <button class="btn btn-secondary" id="mbtn-mortgage" ${mortgageBlocked?'disabled':''} ${mortgageBlocked?'title="House rule: Sell Mode is on — mortgaging is off."':''}>${pdata.mortgaged ? `Pay off mortgage (-$${Math.floor(tile.price/2*1.1)})` : `Mortgage (+$${Math.floor(tile.price/2)})`}</button>
    </div>
    ${mortgageBlocked ? `<p class="muted" style="font-size:.78rem;">House rule: Sell Mode is on, so properties can't be mortgaged — sell houses back to the bank instead.</p>` : ''}`;
  }

  const levelBadge = tile.type === 'property'
    ? `<div class="level-badge level-${pdata.houses}">${
        pdata.houses === 0 ? 'No buildings yet' :
        pdata.houses === 5 ? '🏨 Hotel — max level' :
        `🏠 Level ${pdata.houses} of 4`
      }</div>`
    : '';

  modal.innerHTML = `
    <div class="modal-card group-${tile.group||''}">
      <button class="modal-close" id="modal-close">✕</button>
      <h3>${escapeHtml(tile.name)}</h3>
      <div class="modal-owner">Owner: ${escapeHtml(owner)}${pdata.mortgaged ? ' (mortgaged)' : ''}</div>
      ${levelBadge}
      <div class="rent-table">${rentLines}</div>
      ${controls}
    </div>`;
  modal.classList.add('show');
  document.getElementById('modal-close').onclick = () => modal.classList.remove('show');
  const buildBtn = document.getElementById('mbtn-build');
  if (buildBtn) buildBtn.onclick = () => { buildHouse(tileIndex); modal.classList.remove('show'); };
  const sellBtn = document.getElementById('mbtn-sell');
  if (sellBtn) sellBtn.onclick = () => { sellHouse(tileIndex); modal.classList.remove('show'); };
  const mortBtn = document.getElementById('mbtn-mortgage');
  if (mortBtn) mortBtn.onclick = () => { toggleMortgage(tileIndex); modal.classList.remove('show'); };
}

function openPropertiesDrawer(){
  const modal = document.getElementById('modal');
  const mine = BOARD.filter(t => state.properties[t.i] && state.properties[t.i].owner === MY_UID);
  modal.innerHTML = `
    <div class="modal-card">
      <button class="modal-close" id="modal-close">✕</button>
      <h3>My Properties</h3>
      <div class="my-props-list">
        ${mine.length===0 ? "<p class=\"muted\">You don't own any properties yet.</p>" : mine.map(t => `
          <div class="my-prop-row" data-i="${t.i}">
            <span class="swatch group-${t.group||''}"></span>
            ${escapeHtml(t.name)} ${state.properties[t.i].mortgaged ? '<em>(mortgaged)</em>' : ''}
            ${state.properties[t.i].houses>0 ? (state.properties[t.i].houses===5?'🏨':'🏠'.repeat(state.properties[t.i].houses)) : ''}
          </div>`).join('')}
      </div>
    </div>`;
  modal.classList.add('show');
  document.getElementById('modal-close').onclick = () => modal.classList.remove('show');
  modal.querySelectorAll('.my-prop-row').forEach(row => {
    row.addEventListener('click', () => openPropertyDetail(parseInt(row.dataset.i)));
  });
}

// ---------- Trade Center ----------

function describeTradeSide(side){
  const parts = [];
  if (side.cash) parts.push(`$${side.cash}`);
  (side.properties||[]).forEach(idx => parts.push(BOARD[idx].name));
  if (side.jailFreeCards) parts.push(`${side.jailFreeCards} Jail-Free card${side.jailFreeCards>1?'s':''}`);
  return parts.length ? parts.join(', ') : 'nothing';
}

function openTradeCenter(){
  const modal = document.getElementById('modal');
  modal.innerHTML = `
    <div class="modal-card" style="max-width:460px;">
      <button class="modal-close" id="modal-close">✕</button>
      <h3>Trades</h3>
      <div class="trade-tabs">
        <button class="trade-tab-btn active" data-tab="incoming">Incoming (${pendingIncomingTrades().length})</button>
        <button class="trade-tab-btn" data-tab="outgoing">Sent (${pendingOutgoingTrades().length})</button>
      </div>
      <div class="trade-tab-panel active" id="trade-tab-incoming"></div>
      <div class="trade-tab-panel" id="trade-tab-outgoing"></div>
      <button class="btn btn-block" id="btn-new-trade" style="margin-top:14px;">+ Propose a Trade</button>
    </div>`;
  modal.classList.add('show');
  document.getElementById('modal-close').onclick = () => modal.classList.remove('show');
  modal.querySelectorAll('.trade-tab-btn').forEach(b => b.addEventListener('click', () => {
    modal.querySelectorAll('.trade-tab-btn').forEach(x=>x.classList.remove('active'));
    modal.querySelectorAll('.trade-tab-panel').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    document.getElementById('trade-tab-' + b.dataset.tab).classList.add('active');
  }));
  document.getElementById('btn-new-trade').onclick = () => openTradeBuilder();
  renderIncomingTrades();
  renderOutgoingTrades();
}

function renderIncomingTrades(){
  const wrap = document.getElementById('trade-tab-incoming');
  if (!wrap) return;
  const trades = pendingIncomingTrades();
  if (trades.length === 0){ wrap.innerHTML = '<p class="muted">No incoming offers right now.</p>'; return; }
  wrap.innerHTML = trades.map(t => `
    <div class="trade-card" data-id="${t.id}">
      <div class="trade-parties">${escapeHtml(state.players[t.fromUid].name)} → you</div>
      <div class="trade-side"><span class="label">They give:</span> ${escapeHtml(describeTradeSide(t.give))}</div>
      <div class="trade-side"><span class="label">They want:</span> ${escapeHtml(describeTradeSide(t.receive))}</div>
      ${t.note ? `<div class="trade-note">"${escapeHtml(t.note)}"</div>` : ''}
      <div class="trade-actions">
        <button class="btn" data-act="accept">Accept</button>
        <button class="btn btn-secondary" data-act="counter">Counter</button>
        <button class="btn btn-secondary" data-act="decline">Decline</button>
      </div>
    </div>`).join('');
  wrap.querySelectorAll('.trade-card').forEach(card => {
    const id = card.dataset.id;
    const trade = state.trades[id];
    card.querySelector('[data-act="accept"]').onclick = () => { respondTrade(id, 'accept'); document.getElementById('modal').classList.remove('show'); };
    card.querySelector('[data-act="decline"]').onclick = () => { respondTrade(id, 'decline'); renderIncomingTrades(); };
    card.querySelector('[data-act="counter"]').onclick = () => openTradeBuilder({
      toUid: trade.fromUid, give: trade.receive, receive: trade.give, counterOf: trade.id
    });
  });
}

function renderOutgoingTrades(){
  const wrap = document.getElementById('trade-tab-outgoing');
  if (!wrap) return;
  const trades = Object.values(state.trades||{}).filter(t => t.fromUid === MY_UID).sort((a,b)=>b.createdAt-a.createdAt).slice(0,15);
  if (trades.length === 0){ wrap.innerHTML = '<p class="muted">You haven\'t sent any trade offers yet.</p>'; return; }
  wrap.innerHTML = trades.map(t => `
    <div class="trade-card" data-id="${t.id}">
      <div class="trade-parties">You → ${escapeHtml(state.players[t.toUid].name)}
        ${t.status !== 'pending' ? `<span class="trade-status-tag ${t.status}">${t.status}</span>` : ''}
      </div>
      <div class="trade-side"><span class="label">You give:</span> ${escapeHtml(describeTradeSide(t.give))}</div>
      <div class="trade-side"><span class="label">You want:</span> ${escapeHtml(describeTradeSide(t.receive))}</div>
      ${t.status === 'pending' ? `<div class="trade-actions"><button class="btn btn-secondary" data-act="cancel">Cancel offer</button></div>` : ''}
    </div>`).join('');
  wrap.querySelectorAll('[data-act="cancel"]').forEach(btn => {
    const id = btn.closest('.trade-card').dataset.id;
    btn.onclick = () => { respondTrade(id, 'cancel'); renderOutgoingTrades(); };
  });
}

function openTradeBuilder(prefill){
  const modal = document.getElementById('modal');
  const others = otherActivePlayers();
  if (others.length === 0){ showToast('No one else to trade with.'); return; }
  const defaultTarget = prefill?.toUid || others[0];

  modal.innerHTML = `
    <div class="modal-card trade-builder" style="max-width:460px;">
      <button class="modal-close" id="modal-close">✕</button>
      <h3>${prefill?.counterOf ? 'Counter Offer' : 'Propose a Trade'}</h3>
      <label>Trade with</label>
      <select id="tb-target">
        ${others.map(u => `<option value="${u}" ${u===defaultTarget?'selected':''}>${escapeHtml(state.players[u].name)}</option>`).join('')}
      </select>

      <div class="trade-cash-row">
        <div>
          <label>You give ($)</label>
          <input type="text" inputmode="numeric" id="tb-give-cash" value="${prefill?.give?.cash||0}">
        </div>
        <div>
          <label>You want ($)</label>
          <input type="text" inputmode="numeric" id="tb-receive-cash" value="${prefill?.receive?.cash||0}">
        </div>
      </div>

      <label>Your properties to give</label>
      <div class="prop-checklist" id="tb-give-props"></div>

      <label>Their properties to request</label>
      <div class="prop-checklist" id="tb-receive-props"></div>

      <label>Note (optional)</label>
      <input type="text" id="tb-note" maxlength="80" value="${escapeHtml(prefill?.note||'')}" placeholder="e.g. throwing in cash to sweeten it">

      <div class="modal-actions">
        <button class="btn" id="tb-submit">Send Offer</button>
        <button class="btn btn-secondary" id="tb-cancel">Cancel</button>
      </div>
    </div>`;
  modal.classList.add('show');
  document.getElementById('modal-close').onclick = () => modal.classList.remove('show');
  document.getElementById('tb-cancel').onclick = () => modal.classList.remove('show');

  const targetSelect = document.getElementById('tb-target');
  function refreshPropLists(){
    const target = targetSelect.value;
    const myProps = tradablePropertiesOf(MY_UID);
    const theirProps = tradablePropertiesOf(target);
    const preGive = new Set(prefill?.give?.properties||[]);
    const preReceive = new Set(prefill?.receive?.properties||[]);
    document.getElementById('tb-give-props').innerHTML = myProps.length ? myProps.map(t => `
      <label class="prop-check-row"><input type="checkbox" value="${t.i}" ${preGive.has(t.i)?'checked':''}> ${escapeHtml(t.name)}</label>`).join('')
      : '<p class="muted" style="font-size:.8rem;">You have no tradable properties (houses must be sold first).</p>';
    document.getElementById('tb-receive-props').innerHTML = theirProps.length ? theirProps.map(t => `
      <label class="prop-check-row"><input type="checkbox" value="${t.i}" ${preReceive.has(t.i)?'checked':''}> ${escapeHtml(t.name)}</label>`).join('')
      : '<p class="muted" style="font-size:.8rem;">They have no tradable properties right now.</p>';
  }
  targetSelect.onchange = refreshPropLists;
  refreshPropLists();

  document.getElementById('tb-submit').onclick = () => {
    const toUid = targetSelect.value;
    const giveCash = parseInt(document.getElementById('tb-give-cash').value) || 0;
    const receiveCash = parseInt(document.getElementById('tb-receive-cash').value) || 0;
    const giveProps = Array.from(document.querySelectorAll('#tb-give-props input:checked')).map(el => parseInt(el.value));
    const receiveProps = Array.from(document.querySelectorAll('#tb-receive-props input:checked')).map(el => parseInt(el.value));
    const note = document.getElementById('tb-note').value.trim();
    if (giveCash===0 && receiveCash===0 && giveProps.length===0 && receiveProps.length===0){
      showToast('Add at least something to the trade.'); return;
    }
    if (giveCash > state.players[MY_UID].money){ showToast("You don't have that much cash."); return; }
    proposeTrade({
      toUid,
      give: { cash: giveCash, properties: giveProps },
      receive: { cash: receiveCash, properties: receiveProps },
      note,
      counterOf: prefill?.counterOf || null
    });
    modal.classList.remove('show');
  };
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---------- Event wiring ----------

document.addEventListener('DOMContentLoaded', async () => {
  // ResizeObserver catches every case that changes the board's available space —
  // window resize, browser zoom, and the mobile/desktop layout breakpoint flipping —
  // which plain 'resize' events don't reliably cover (zoom in particular).
  const boardWrapEl = document.getElementById('board-wrap');
  if (boardWrapEl && 'ResizeObserver' in window){
    new ResizeObserver(() => fitBoardToViewport()).observe(boardWrapEl);
  } else {
    window.addEventListener('resize', fitBoardToViewport);
  }

  const rejoined = await tryRejoin();
  if (!rejoined) showScreen('lobby');

  document.getElementById('btn-create-room').addEventListener('click', () => {
    const name = document.getElementById('input-name-create').value.trim();
    const maxPlayers = parseInt(document.getElementById('select-max-players').value);
    const rawStartingCash = parseInt(document.getElementById('input-starting-cash').value);
    const startingCash = (Number.isFinite(rawStartingCash) && rawStartingCash >= 0) ? rawStartingCash : 1500;
    if (!name){ showToast('Enter your name first.'); return; }
    createRoom(name, maxPlayers, startingCash);
  });

  const startingCashInput = document.getElementById('input-starting-cash');
  const cashChips = Array.from(document.querySelectorAll('.cash-chip'));
  cashChips.forEach(chip => {
    chip.addEventListener('click', () => {
      cashChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      startingCashInput.value = chip.dataset.value;
    });
  });
  startingCashInput.addEventListener('input', () => {
    const match = cashChips.find(c => c.dataset.value === startingCashInput.value);
    cashChips.forEach(c => c.classList.toggle('active', c === match));
  });

  document.getElementById('btn-join-room').addEventListener('click', () => {
    const name = document.getElementById('input-name-join').value.trim();
    const code = document.getElementById('input-room-code').value.trim();
    if (!name || !code){ showToast('Enter your name and the room code.'); return; }
    joinRoom(code, name);
  });

  document.getElementById('btn-start-game').addEventListener('click', startGame);
  document.getElementById('btn-leave-waiting').addEventListener('click', goToLobby);
  document.getElementById('btn-properties').addEventListener('click', openPropertiesDrawer);
  document.getElementById('btn-trades').addEventListener('click', openTradeCenter);
  document.getElementById('btn-bankrupt').addEventListener('click', () => {
    if (confirm("Declare bankruptcy? You'll hand over your properties and become a spectator for the rest of the game.")){
      giveUpBankruptcy();
    }
  });
  document.getElementById('btn-leave-game').addEventListener('click', () => {
    if (confirm("Leave this game? You'll be marked bankrupt and taken back to the lobby.")) leaveGame();
  });
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') e.target.classList.remove('show');
  });
});
