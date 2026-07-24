// game.js — core engine + rendering + Firebase sync.
// Structure:
//   1. Identity & room helpers
//   2. Firebase read/write helpers
//   3. Game actions (the only functions that write to Firebase)
//   4. Render functions (pure — read `state` and paint the DOM)
//   5. Event wiring

// ---------- 1. Identity & room helpers ----------

const MY_UID = (function(){
  let id = localStorage.getItem('monopoly_uid');
  if (!id){ id = 'p_' + Math.random().toString(36).slice(2, 10); localStorage.setItem('monopoly_uid', id); }
  return id;
})();

function roomCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i=0;i<5;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

let ROOM_ID = null;
let state = null; // local mirror of the room, kept in sync via onValue
let myName = '';

// ---------- 2. Firebase read/write helpers ----------

function roomRef(path){ return db.ref('rooms/' + ROOM_ID + (path ? '/' + path : '')); }

let activeRoomListenerRef = null;

function subscribeRoom(){
  if (typeof prevMoneyByUid !== 'undefined') prevMoneyByUid = {};
  if (typeof moneyDeltaByUid !== 'undefined') moneyDeltaByUid = {};
  unsubscribeRoom();
  activeRoomListenerRef = roomRef();
  activeRoomListenerRef.on('value', snap => {
    state = snap.val();
    if (!state){ showToast('Room not found (it may have expired).'); goToLobby(); return; }
    // Self-healing: if a roll animation flag is left over from a dropped connection
    // (the roller's tab closed mid-roll), any client clears it after a grace period.
    // Safe because turnPhase never changes during the animation window, so clearing
    // this just re-enables the Roll button — nothing gets double-applied.
    if (state.rolling && Date.now() - state.rolling.endsAt > 4000){
      roomRef('rolling').set(null);
    }
    checkAfkTimeouts();
    renderAll();
  });
}

// Detaches the live Firebase listener. Without this, a player who's left back to the
// lobby would still get pulled back into the game screen the next time anyone else's
// move triggers an update — this is what makes "Leave" (and clearing the URL hash)
// actually stick.
function unsubscribeRoom(){
  if (activeRoomListenerRef){ activeRoomListenerRef.off('value'); activeRoomListenerRef = null; }
  teardownPresence();
}

function log(msg){
  const entry = { msg, ts: Date.now() };
  const ref = roomRef('log').push();
  ref.set(entry);
  // trim old log entries client-side occasionally (best-effort, not critical)
}

// ---------- Presence & AFK auto-bankruptcy ----------
// There's no server here (just Firebase RTDB + clients), so "is this player still
// around" is tracked with the standard Realtime Database presence pattern: each
// client arms an onDisconnect() write for its own player/spectator node the moment
// it's actually connected, so if that connection drops for ANY reason — tab closed,
// crashed, phone killed the page — Firebase itself (not this client, which by
// definition can't run code anymore) flips `connected` to false and stamps
// `lastSeen`. A tab that's merely backgrounded on mobile without truly losing its
// connection never triggers this at all, which is exactly why it doesn't get treated
// as a departure.
//
// AFK_BANKRUPT_MS is the grace period after that before an absence turns into an
// actual bankruptcy — long enough to survive a brief mobile background/reconnect,
// short enough that the table isn't stuck waiting on someone who isn't coming back.
const AFK_BANKRUPT_MS = 2 * 60 * 1000;

let presenceConnectedRef = null;
let presenceRole = null; // 'players' | 'spectators' | null — which node this client's presence lives under

// Call right after subscribeRoom() with 'players' or 'spectators' depending on which
// list this client just joined/rejoined as.
function setupPresence(role){
  presenceRole = role;
  if (presenceConnectedRef) presenceConnectedRef.off('value');
  presenceConnectedRef = db.ref('.info/connected');
  presenceConnectedRef.on('value', snap => {
    if (!ROOM_ID || !presenceRole || snap.val() !== true) return;
    const myRef = roomRef(presenceRole + '/' + MY_UID);
    // Re-armed on every (re)connect, keyed off MY_UID (persisted in localStorage) —
    // this is what lets a rejoin be recognized as the SAME player coming back,
    // rather than a coincidence, and it clears any near-expired AFK clock the moment
    // they're back, since `connected` flips true immediately.
    myRef.child('connected').onDisconnect().set(false);
    myRef.child('lastSeen').onDisconnect().set(firebase.database.ServerValue.TIMESTAMP);
    myRef.child('connected').set(true);
    myRef.child('lastSeen').set(firebase.database.ServerValue.TIMESTAMP);
  });
}

function teardownPresence(){
  if (presenceConnectedRef){ presenceConnectedRef.off('value'); presenceConnectedRef = null; }
  presenceRole = null;
}

// Runs on every room update, PLUS a standing interval below (state can otherwise sit
// unchanged while an AFK clock quietly runs out, with nothing to trigger a re-check).
// Any connected client can run this — there's no single owner to delegate it to — and
// it's safe for more than one to run it concurrently: handleBankruptcy() re-fetches
// fresh data and bails out immediately if the player's already bankrupt, so a second
// call from another client just becomes a harmless no-op, the same pattern already
// used for the "rolling" self-heal above.
function checkAfkTimeouts(){
  if (!state || state.status !== 'playing' || !state.players) return;
  const now = Date.now();
  Object.keys(state.players).forEach(uid => {
    const p = state.players[uid];
    if (!p || p.bankrupt) return;
    if (p.connected === false && typeof p.lastSeen === 'number' && (now - p.lastSeen) >= AFK_BANKRUPT_MS){
      log(`⏱️ ${p.name} has been disconnected for 2 minutes and is out of the game.`);
      handleBankruptcy(uid, p.debtTo || null);
    }
  });
}
// Independent of any particular room update — catches the case where nothing else
// changes while an AFK clock is quietly running out.
setInterval(checkAfkTimeouts, 20000);

// ---------- 3. Game actions ----------

async function createRoom(name, maxPlayers, startingMoney){
  ROOM_ID = roomCode();
  myName = name;
  const color = TOKEN_COLORS[0];
  const startMoney = (Number.isFinite(startingMoney) && startingMoney >= 0) ? startingMoney : 1500;
  const room = {
    hostUid: MY_UID,
    status: 'lobby',
    settings: { startingMoney: startMoney, freeParkingJackpot: false, maxPlayers, requireFullSetToBuild: true, tradingEnabled: true, cashRuleMode: 'sell', collectRentIfOwnerInJail: true, jailFineAmount: 50, goBonusEnabled: false, goBonusAmount: 200 },
    players: {
      [MY_UID]: { name, color, money: startMoney, position: 0, inJail:false, jailTurns:0, bankrupt:false, jailFreeCards:0, debtTo: null }
    },
    turnOrder: [MY_UID],
    currentTurn: MY_UID,
    turnPhase: 'roll',
    dice: [1,1],
    doublesStreak: 0,
    properties: {},
    pendingBuy: null,
    pendingCard: null,
    freeParkingPot: 0,
    log: {},
    winner: null,
    createdAt: Date.now()
  };
  await db.ref('rooms/' + ROOM_ID).set(room);
  location.hash = ROOM_ID;
  subscribeRoom();
  setupPresence('players');
  showScreen('waiting');
}

async function joinRoom(code, name){
  ROOM_ID = code.toUpperCase();
  const snap = await roomRef().get();
  if (!snap.exists()){ showToast("That room code doesn't exist."); ROOM_ID = null; return false; }
  const room = snap.val();

  // If this browser (MY_UID persists in localStorage, so it survives a closed/
  // reopened tab) already has a seat in this room, this is a RECONNECT — recognized
  // regardless of the room's current status — not a new join. Handles the case where
  // someone's tab closed mid-game and they came back by typing the room code in again
  // instead of using the auto-rejoin link: they resume their own seat rather than
  // getting turned away or added again as a new spectator.
  if (room.players && room.players[MY_UID]){
    myName = room.players[MY_UID].name;
    location.hash = ROOM_ID;
    subscribeRoom();
    setupPresence('players');
    showScreen(room.status === 'lobby' ? 'waiting' : 'game');
    showToast('Welcome back!');
    return true;
  }

  if (room.status !== 'lobby'){
    // A genuinely new person showing up after the game has already started (or
    // already ended) can't take a seat mid-game — they join as a read-only
    // spectator instead of being turned away.
    myName = name;
    await roomRef('spectators/' + MY_UID).set({ name, joinedAt: Date.now() });
    location.hash = ROOM_ID;
    subscribeRoom();
    setupPresence('spectators');
    showScreen('game');
    showToast(room.status === 'ended' ? 'That game already ended — joining as a spectator.' : 'That game already started — joining as a spectator.');
    return true;
  }

  const existing = Object.keys(room.players || {});
  if (existing.length >= (room.settings?.maxPlayers || 6) && !existing.includes(MY_UID)){
    showToast('That room is full.'); ROOM_ID = null; return false;
  }
  myName = name;
  const usedColors = existing.map(k => room.players[k].color);
  const color = TOKEN_COLORS.find(c => !usedColors.includes(c)) || TOKEN_COLORS[existing.length % TOKEN_COLORS.length];
  await roomRef('players/' + MY_UID).set({
    name, color, money: room.settings?.startingMoney ?? 1500, position:0,
    inJail:false, jailTurns:0, bankrupt:false, jailFreeCards:0, debtTo: null
  });
  location.hash = ROOM_ID;
  subscribeRoom();
  setupPresence('players');
  showScreen('waiting');
  return true;
}

async function tryRejoin(){
  const hash = location.hash.replace('#','').trim();
  if (!hash) return false;
  const snap = await db.ref('rooms/' + hash).get();
  if (!snap.exists()) return false;
  const room = snap.val();
  if (room.players && room.players[MY_UID]){
    ROOM_ID = hash;
    myName = room.players[MY_UID].name;
    subscribeRoom();
    setupPresence('players');
    showScreen(room.status === 'lobby' ? 'waiting' : 'game');
    return true;
  }
  if (room.spectators && room.spectators[MY_UID]){
    ROOM_ID = hash;
    myName = room.spectators[MY_UID].name;
    subscribeRoom();
    setupPresence('spectators');
    showScreen('game');
    return true;
  }
  return false;
}

async function updateSetting(key, value){
  if (!state || MY_UID !== state.hostUid || state.status !== 'lobby') return;
  await roomRef('settings/' + key).set(value);
}

function startGame(){
  if (MY_UID !== state.hostUid) return;
  const order = Object.keys(state.players).sort(() => Math.random() - 0.5);
  const props = {};
  BOARD.forEach(t => { if (t.type==='property' || t.type==='railroad' || t.type==='utility') props[t.i] = { owner:null, houses:0, mortgaged:false, landedSincePurchase:false }; });
  roomRef().update({
    status: 'playing',
    turnOrder: order,
    // seatOrder is the full roster set once at game start and never mutated afterwards
    // (turnOrder shrinks as players go bankrupt, since it drives turn rotation) — the
    // player panel renders from seatOrder so bankrupt/left players stay visible with
    // their status updated instead of disappearing from the list.
    seatOrder: order,
    currentTurn: order[0],
    turnPhase: 'roll',
    properties: props
  });
  log(`Game started. Turn order: ${order.map(u=>state.players[u].name).join(' → ')}`);
}

function isMyTurn(){ return state && state.status==='playing' && state.currentTurn === MY_UID; }

const DICE_TUMBLE_MS = 900;
const HOP_STEP_MS = 160;

async function rollDice(){
  if (!isMyTurn() || state.turnPhase !== 'roll') return;
  if (state.players[MY_UID].money < 0) return; // must clear debt (sell/mortgage/bankrupt) first

  const d1 = 1 + Math.floor(Math.random()*6);
  const d2 = 1 + Math.floor(Math.random()*6);
  const isDouble = d1 === d2;
  const doublesStreak = (state.doublesStreak||0) + (isDouble?1:0);
  const tripleDoubles = isDouble && doublesStreak >= 3;
  const steps = d1 + d2;
  const startPos = state.players[MY_UID].position;
  const totalMs = DICE_TUMBLE_MS + steps*HOP_STEP_MS + 150;

  // Broadcast the roll + planned hop path so every client (including this one) animates
  // the dice and the token, and hides action buttons for that whole window — this is
  // what prevents button-spamming, since no client renders Roll/End Turn/jail buttons
  // while `rolling` is set.
  await roomRef().update({
    rolling: { endsAt: Date.now() + totalMs },
    moveHop: tripleDoubles ? null : { uid: MY_UID, from: startPos, steps, tumbleMs: DICE_TUMBLE_MS, stepMs: HOP_STEP_MS, nonce: Date.now() }
  });

  setTimeout(async () => {
    await roomRef().update({ dice: [d1,d2], rolling: null, moveHop: null });
    if (tripleDoubles){
      await sendToJail(MY_UID, 'rolled three doubles in a row');
      await roomRef('doublesStreak').set(0);
      await endTurn();
      return;
    }
    await roomRef('doublesStreak').set(isDouble ? doublesStreak : 0);
    await movePlayer(MY_UID, steps);
  }, totalMs);
}

// Call this at the end of resolving whatever happened on a tile / card / purchase decision.
// Grants another roll if the player just rolled doubles (and isn't now in jail).
async function finishAction(uid){
  const fresh = (await roomRef().get()).val();
  const player = fresh.players[uid];
  if (player.bankrupt) return;
  if ((fresh.doublesStreak||0) > 0 && !player.inJail){
    await roomRef('turnPhase').set('roll');
    log(`${player.name} rolled doubles and goes again!`);
  } else {
    await roomRef('turnPhase').set('end');
  }
}

async function movePlayer(uid, steps){
  const room = (await roomRef().get()).val();
  const player = room.players[uid];
  let newPos = (player.position + steps + 40) % 40;
  const passedGo = steps > 0 && (player.position + steps) >= 40;
  const updates = {};
  updates[`players/${uid}/position`] = newPos;
  if (passedGo){
    updates[`players/${uid}/money`] = player.money + 200;
  }
  await roomRef().update(updates);
  if (passedGo) log(`${player.name} passed GO and collected $200.`);
  await resolveTile(uid, newPos);
}

async function resolveTile(uid, tileIndex){
  const room = (await roomRef().get()).val();
  const tile = BOARD[tileIndex];
  const player = room.players[uid];

  if (tile.type === 'go'){
    if (room.settings?.goBonusEnabled){
      const bonus = Number(room.settings.goBonusAmount);
      const amt = Number.isFinite(bonus) && bonus >= 0 ? bonus : 200;
      await roomRef(`players/${uid}/money`).set(player.money + amt);
      log(`${player.name} landed right on GO and collected an extra $${amt}!`);
    } else {
      log(`${player.name} landed on ${tile.name}.`);
    }
    await finishAction(uid);
    return;
  }
  if (tile.type === 'jail'){
    log(`${player.name} landed on ${tile.name}.`);
    await finishAction(uid);
    return;
  }
  if (tile.type === 'free'){
    const pot = room.freeParkingPot || 0;
    if (room.settings?.freeParkingJackpot && pot > 0){
      await roomRef().update({
        [`players/${uid}/money`]: player.money + pot,
        freeParkingPot: 0
      });
      log(`${player.name} landed on Free Parking and collected the $${pot} pot!`);
    } else {
      log(`${player.name} landed on Free Parking.`);
    }
    await finishAction(uid);
    return;
  }
  if (tile.type === 'gotojail'){
    await sendToJail(uid, 'landed on Go To Jail');
    await finishAction(uid);
    return;
  }
  if (tile.type === 'tax'){
    log(`${player.name} landed on ${tile.name} and owes $${tile.amount}.`);
    const inDebt = await chargePlayer(uid, tile.amount, null);
    if (!inDebt) await finishAction(uid);
    return;
  }
  if (tile.type === 'chance' || tile.type === 'chest'){
    await drawCard(uid, tile.type);
    return; // drawCard resolves its own turnPhase via finishAction
  }
  if (tile.type === 'property' || tile.type === 'railroad' || tile.type === 'utility'){
    const pdata = room.properties[tileIndex];
    if (!pdata.owner){
      log(`${player.name} landed on ${tile.name} (unowned, $${tile.price}).`);
      await roomRef('pendingBuy').set({ tileIndex, uid });
      await roomRef('turnPhase').set('action');
    } else if (pdata.owner === uid){
      const justUnlocked = tile.type === 'property' && !pdata.landedSincePurchase;
      if (justUnlocked){
        await roomRef(`properties/${tileIndex}/landedSincePurchase`).set(true);
      }
      log(`${player.name} landed on their own property, ${tile.name}.${justUnlocked ? ' (Houses can now be built here.)' : ''}`);
      await finishAction(uid);
    } else if (pdata.mortgaged){
      log(`${player.name} landed on ${tile.name}, but it's mortgaged — no rent due.`);
      await finishAction(uid);
    } else if (room.players[pdata.owner]?.inJail && room.settings?.collectRentIfOwnerInJail === false){
      log(`${player.name} landed on ${tile.name}, but ${room.players[pdata.owner].name} is in jail — house rule says no rent is due.`);
      await finishAction(uid);
    } else {
      const rent = computeRent(room, tileIndex);
      const bigHit = rent >= player.money * 0.35 || (player.money - rent) < 100;
      log(pickLine(bigHit ? 'rent_bigHit' : 'rent_minor', { name: player.name, amount: rent, tile: tile.name, owner: room.players[pdata.owner].name }));
      const inDebt = await chargePlayer(uid, rent, pdata.owner);
      if (!inDebt) await finishAction(uid);
    }
    return;
  }
}

function ownsFullGroupIn(room, uid, group){
  return BOARD.filter(t => t.group === group).every(t => room.properties[t.i].owner === uid);
}

function computeRent(room, tileIndex){
  const tile = BOARD[tileIndex];
  const pdata = room.properties[tileIndex];
  if (tile.type === 'property'){
    if (pdata.houses === 0 && pdata.owner && ownsFullGroupIn(room, pdata.owner, tile.group)){
      return tile.rent[0] * 2; // standard rule: an undeveloped full color set charges double rent
    }
    return tile.rent[pdata.houses];
  }
  if (tile.type === 'railroad'){
    const owner = pdata.owner;
    const ownedCount = BOARD.filter(t => t.type==='railroad' && room.properties[t.i].owner===owner).length;
    return tile.rent[ownedCount-1];
  }
  if (tile.type === 'utility'){
    const owner = pdata.owner;
    const ownedCount = BOARD.filter(t => t.type==='utility' && room.properties[t.i].owner===owner).length;
    const diceSum = (room.dice||[1,1]).reduce((a,b)=>a+b,0);
    return diceSum * (ownedCount >= 2 ? 10 : 4);
  }
  return 0;
}

// Charges (or, if amount is negative, pays) `uid`. Unlike before, going negative no
// longer triggers automatic bankruptcy — the player is left in debt (negative money,
// `debtTo` recorded for later asset hand-over) and must raise cash by selling houses
// or mortgaging property (see sellHouse/toggleMortgage), or declare bankruptcy themselves
// via the "Declare Bankruptcy" button. Returns true if this charge put the player in debt,
// so callers know to skip finishAction() until the debt is resolved.
async function chargePlayer(uid, amount, toUid){
  const room = (await roomRef().get()).val();
  const player = room.players[uid];
  const newMoney = player.money - amount;
  const updates = { [`players/${uid}/money`]: newMoney };
  if (toUid){
    updates[`players/${toUid}/money`] = room.players[toUid].money + amount;
  } else if (amount > 0 && room.settings?.freeParkingJackpot){
    // Money paid to the bank (tax, card fines, repairs — anything with no player
    // recipient) feeds the Free Parking pot when that house rule is on.
    updates['freeParkingPot'] = (room.freeParkingPot||0) + amount;
  }
  const wentIntoDebt = newMoney < 0;
  if (wentIntoDebt){
    updates[`players/${uid}/debtTo`] = toUid || null;
    if (room.currentTurn === uid) updates['turnPhase'] = 'debt';
  }
  await roomRef().update(updates);
  if (wentIntoDebt){
    log(`⚠️ ${player.name} can't cover that and is short $${Math.abs(newMoney)}.`);
  }
  return wentIntoDebt;
}

// Call after any action that might raise enough cash to clear a debt (selling a house,
// mortgaging a property). If the player's money is back to zero or above, clears the
// debt marker and — if it was their turn that got paused for it — resumes the turn.
async function maybeResolveDebt(uid){
  const fresh = (await roomRef().get()).val();
  const player = fresh.players[uid];
  if (!player || player.bankrupt || player.money < 0) return;
  const updates = {};
  if (player.debtTo !== undefined && player.debtTo !== null) updates[`players/${uid}/debtTo`] = null;
  if (Object.keys(updates).length) await roomRef().update(updates);
  if (fresh.currentTurn === uid && fresh.turnPhase === 'debt'){
    await finishAction(uid);
  }
}

// Voluntary bankruptcy, triggered by the player themselves via the "Declare Bankruptcy"
// button — this is the only way a player goes bankrupt now (see chargePlayer above).
async function declareBankruptcy(){
  const me = state.players[MY_UID];
  if (!me || me.bankrupt) return;
  if (me.money >= 0){ showToast("You're not in debt right now."); return; }
  await handleBankruptcy(MY_UID, me.debtTo || null);
}

// The header "Bankrupt" button — a voluntary give-up available any time (not just
// when in debt). The player becomes a spectator: they stay connected and watch the
// rest of the game play out, same as handleBankruptcy already sets up for anyone who
// goes bankrupt (turn rotation skips them, their properties are released to the bank).
async function giveUpBankruptcy(){
  if (!state || state.status !== 'playing') return;
  const me = state.players[MY_UID];
  if (!me || me.bankrupt) return;
  await handleBankruptcy(MY_UID, me.debtTo || null);
}

// The "Leave" button during an active game: marks the player bankrupt (so everyone
// else's player list reflects it) before sending them back to the lobby, so a departed
// player doesn't just vanish leaving a phantom turn slot. If the game already ended, or
// the player is already bankrupt/spectating, there's nothing to update — just leave.
// A spectator leaving instead removes their spectators/ entry so they don't linger in
// the room after choosing to go.
async function leaveGame(){
  if (state){
    const me = state.players[MY_UID];
    if (me && !me.bankrupt && state.status === 'playing'){
      await handleBankruptcy(MY_UID, me.debtTo || null);
    } else if (!me && state.spectators && state.spectators[MY_UID]){
      await roomRef('spectators/' + MY_UID).remove();
    }
  }
  goToLobby();
}

// Host-only "Kick" button — works in the waiting room and mid-game alike.
// - In the lobby, nobody has money/properties yet, so there's nothing to bankrupt:
//   the kicked player's seat is just removed outright.
// - Once the game is playing, a kick is handled exactly like the player going
//   bankrupt (handleBankruptcy already does the right thing: releases their
//   properties, rotates the turn order, ends the game if only one player is left,
//   etc.) — we just pass `{ kicked: true }` so the log line says they were kicked
//   rather than that they went bankrupt on their own.
async function kickPlayer(uid){
  if (!state || MY_UID !== state.hostUid) return; // only the host can kick
  if (uid === state.hostUid) return; // host can't kick themselves
  const player = state.players[uid];
  if (!player) return;

  if (state.status === 'lobby'){
    log(`👢 ${player.name} was kicked by the host.`);
    await roomRef(`players/${uid}`).remove();
    return;
  }

  if (state.status === 'playing' && !player.bankrupt){
    await handleBankruptcy(uid, player.debtTo || null, { kicked: true });
  }
}

async function handleBankruptcy(uid, creditorUid, opts){
  const room = (await roomRef().get()).val();
  const player = room.players[uid];
  if (player.bankrupt) return;
  log(opts?.kicked ? `👢 ${player.name} was kicked by the host and is out of the game.` : pickLine('bankruptcy', { name: player.name }));
  const updates = { [`players/${uid}/bankrupt`]: true, [`players/${uid}/money`]: 0, [`players/${uid}/debtTo`]: null };
  // hand over (or release) properties
  Object.keys(room.properties).forEach(idx => {
    if (room.properties[idx].owner === uid){
      updates[`properties/${idx}/owner`] = creditorUid || null;
      updates[`properties/${idx}/houses`] = 0;
      updates[`properties/${idx}/mortgaged`] = creditorUid ? room.properties[idx].mortgaged : false;
      updates[`properties/${idx}/landedSincePurchase`] = false;
    }
  });
  const newOrder = room.turnOrder.filter(u => u !== uid);
  updates['turnOrder'] = newOrder;

  const stillIn = newOrder.filter(u => !room.players[u].bankrupt);
  if (stillIn.length <= 1){
    updates['status'] = 'ended';
    updates['winner'] = stillIn[0] || null;
  } else if (room.currentTurn === uid){
    // the player who just went bankrupt was mid-turn: hand play to the next surviving player
    const oldIdx = room.turnOrder.indexOf(uid);
    const nextUid = newOrder[oldIdx % newOrder.length];
    updates['currentTurn'] = nextUid;
    updates['turnPhase'] = 'roll';
    updates['pendingBuy'] = null;
    updates['doublesStreak'] = 0;
  }
  await roomRef().update(updates);
  if (stillIn.length <= 1){
    log(stillIn[0] ? pickLine('gameWin', { name: room.players[stillIn[0]].name }) : '🏆 Nobody is left — the game ends with no winner.');
  }
}

async function sendToJail(uid, reason){
  await roomRef().update({
    [`players/${uid}/position`]: 10,
    [`players/${uid}/inJail`]: true,
    [`players/${uid}/jailTurns`]: 0,
    doublesStreak: 0
  });
  log(pickLine('sentToJail', { name: state.players[uid].name, reason }));
}

// Picks a card from a deck, respecting each card's optional `weight` (see the
// CHANCE_CARDS / CHEST_CARDS comment block in board-data.js for how to tune these).
// A card with no `weight` field defaults to 1, same as every card had before this
// existed — so decks with no weights set behave exactly like a plain uniform draw.
function pickWeightedCard(deck){
  const total = deck.reduce((sum, c) => sum + (c.weight ?? 1), 0);
  let roll = Math.random() * total;
  for (const card of deck){
    roll -= (card.weight ?? 1);
    if (roll < 0) return card;
  }
  return deck[deck.length - 1]; // float rounding fallback
}

async function drawCard(uid, deckType){
  const deck = deckType === 'chance' ? CHANCE_CARDS : CHEST_CARDS;
  const card = pickWeightedCard(deck);
  const room = (await roomRef().get()).val();
  const player = room.players[uid];
  log(`${player.name} drew a ${deckType==='chance'?'Chance':'Community Chest'} card: "${card.text}"`);
  if (uid === MY_UID && typeof showToast === 'function') showToast(card.text);

  switch(card.action){
    case 'goto': {
      const passesGo = card.to < player.position;
      await roomRef(`players/${uid}/position`).set(card.to);
      if (card.collectGo && passesGo){
        await roomRef(`players/${uid}/money`).set(player.money + 200);
      }
      await resolveTile(uid, card.to);
      return;
    }
    case 'move': {
      const newPos = (player.position + card.amount + 40) % 40;
      await roomRef(`players/${uid}/position`).set(newPos);
      await resolveTile(uid, newPos);
      return;
    }
    case 'cash': {
      const inDebt = await chargePlayer(uid, -card.amount, null);
      if (!inDebt) await finishAction(uid);
      return;
    }
    case 'jailfree':
      await roomRef(`players/${uid}/jailFreeCards`).set((player.jailFreeCards||0) + 1);
      await finishAction(uid);
      return;
    case 'gotojail':
      await sendToJail(uid, 'drew a card');
      await finishAction(uid);
      return;
    case 'repairs': {
      let total = 0;
      Object.keys(room.properties).forEach(idx => {
        const p = room.properties[idx];
        if (p.owner === uid){ total += p.houses===5 ? card.hotel : p.houses*card.house; }
      });
      const inDebt = await chargePlayer(uid, total, null);
      if (!inDebt) await finishAction(uid);
      return;
    }
    case 'pay_each': {
      const updates = {};
      let total = 0;
      room.turnOrder.forEach(other => {
        if (other===uid || room.players[other].bankrupt) return;
        updates[`players/${other}/money`] = room.players[other].money + card.amount;
        total += card.amount;
      });
      const newMoney = player.money - total;
      updates[`players/${uid}/money`] = newMoney;
      const inDebt = newMoney < 0;
      if (inDebt){
        updates[`players/${uid}/debtTo`] = null; // owed to the whole table — treat like a bank debt
        updates['turnPhase'] = 'debt';
      }
      await roomRef().update(updates);
      if (inDebt) log(`⚠️ ${player.name} can't cover that and is short $${Math.abs(newMoney)}.`);
      if (!inDebt) await finishAction(uid);
      return;
    }
    case 'collect_each': {
      const updates = {};
      let total = 0;
      room.turnOrder.forEach(other => {
        if (other===uid || room.players[other].bankrupt) return;
        const otherNewMoney = room.players[other].money - card.amount;
        updates[`players/${other}/money`] = otherNewMoney;
        // The payer isn't the one taking their turn right now, so this doesn't pause
        // the current player's turn — the other player will see their own debt banner
        // and can resolve it (sell/mortgage/bankrupt) whenever they're ready.
        if (otherNewMoney < 0) updates[`players/${other}/debtTo`] = uid;
        total += card.amount;
      });
      updates[`players/${uid}/money`] = player.money + total;
      await roomRef().update(updates);
      await finishAction(uid);
      return;
    }
    case 'nearest_rail': {
      const rails = BOARD.filter(t=>t.type==='railroad').map(t=>t.i);
      const next = rails.find(i => i > player.position) ?? rails[0];
      const passesGo = next < player.position;
      await roomRef(`players/${uid}/position`).set(next);
      if (passesGo) await roomRef(`players/${uid}/money`).set(player.money + 200);
      const fresh = (await roomRef().get()).val();
      const pdata = fresh.properties[next];
      if (pdata.owner && pdata.owner !== uid && fresh.players[pdata.owner]?.inJail && fresh.settings?.collectRentIfOwnerInJail === false){
        log(`${player.name} advanced to ${BOARD[next].name}, but ${fresh.players[pdata.owner].name} is in jail — house rule says no rent is due.`);
        await finishAction(uid);
      } else if (pdata.owner && pdata.owner !== uid){
        const rent = computeRent(fresh, next) * 2;
        const inDebt = await chargePlayer(uid, rent, pdata.owner);
        if (!inDebt) await finishAction(uid);
      } else {
        await resolveTile(uid, next);
      }
      return;
    }
    case 'nearest_utility': {
      const utils = BOARD.filter(t=>t.type==='utility').map(t=>t.i);
      const next = utils.find(i => i > player.position) ?? utils[0];
      const passesGo = next < player.position;
      await roomRef(`players/${uid}/position`).set(next);
      if (passesGo) await roomRef(`players/${uid}/money`).set(player.money + 200);
      await resolveTile(uid, next);
      return;
    }
  }
}

async function buyProperty(){
  if (!state.pendingBuy || state.pendingBuy.uid !== MY_UID) return;
  const { tileIndex } = state.pendingBuy;
  const tile = BOARD[tileIndex];
  const player = state.players[MY_UID];
  if (player.money < tile.price) { showToast("You can't afford this."); return; }
  await roomRef().update({
    [`properties/${tileIndex}/owner`]: MY_UID,
    [`players/${MY_UID}/money`]: player.money - tile.price,
    [`properties/${tileIndex}/landedSincePurchase`]: false,
    pendingBuy: null
  });
  log(`${player.name} bought ${tile.name} for $${tile.price}.`);
  await finishAction(MY_UID);
}

async function declineBuy(){
  if (!state.pendingBuy || state.pendingBuy.uid !== MY_UID) return;
  const tile = BOARD[state.pendingBuy.tileIndex];
  const player = state.players[MY_UID];
  const key = player.money < tile.price ? 'declineBuy_cantAfford' : 'declineBuy_choice';
  log(pickLine(key, { name: player.name, tile: tile.name }));
  await roomRef('pendingBuy').set(null);
  await finishAction(MY_UID);
}

async function payJailFine(){
  if (!isMyTurn() || !state.players[MY_UID].inJail || state.turnPhase !== 'roll') return;
  const fine = state.settings?.jailFineAmount ?? 50;
  const updates = {
    [`players/${MY_UID}/money`]: state.players[MY_UID].money - fine,
    [`players/${MY_UID}/inJail`]: false,
    [`players/${MY_UID}/jailTurns`]: 0
  };
  if (state.settings?.freeParkingJackpot){
    updates['freeParkingPot'] = (state.freeParkingPot||0) + fine;
  }
  await roomRef().update(updates);
  log(`${state.players[MY_UID].name} paid $${fine} to get out of jail.`);
  await roomRef('turnPhase').set('end');
}

async function useJailCard(){
  if (!isMyTurn() || !state.players[MY_UID].inJail || state.turnPhase !== 'roll') return;
  if ((state.players[MY_UID].jailFreeCards||0) < 1) return;
  await roomRef().update({
    [`players/${MY_UID}/jailFreeCards`]: state.players[MY_UID].jailFreeCards - 1,
    [`players/${MY_UID}/inJail`]: false,
    [`players/${MY_UID}/jailTurns`]: 0
  });
  log(`${state.players[MY_UID].name} used a Get Out of Jail Free card.`);
  await roomRef('turnPhase').set('end');
}

async function rollForJail(){
  if (!isMyTurn() || !state.players[MY_UID].inJail || state.turnPhase !== 'roll') return;
  const me = state.players[MY_UID];
  const attempt = (me.jailTurns||0) + 1; // which jail-roll attempt this is: 1, 2, or 3
  const d1 = 1+Math.floor(Math.random()*6), d2 = 1+Math.floor(Math.random()*6);
  const steps = d1 + d2;
  const isDouble = d1 === d2;
  // House rule: only the 3rd attempt's doubles actually moves the token this turn.
  // Doubles on attempt 1 or 2 just clear "in jail" status — the token stays parked
  // on the jail tile until the player's next ordinary turn.
  const movesThisTurn = isDouble && attempt >= 3;
  const totalMs = DICE_TUMBLE_MS + (movesThisTurn ? steps*HOP_STEP_MS : 0) + 150;

  await roomRef().update({
    rolling: { endsAt: Date.now() + totalMs },
    moveHop: movesThisTurn ? { uid: MY_UID, from: 10, steps, tumbleMs: DICE_TUMBLE_MS, stepMs: HOP_STEP_MS, nonce: Date.now() } : null
  });

  setTimeout(async () => {
    await roomRef().update({ dice: [d1,d2], rolling: null, moveHop: null });

    if (isDouble && attempt < 3){
      // 1st/2nd attempt doubles: freed, but stays put this turn.
      await roomRef().update({ [`players/${MY_UID}/inJail`]: false, [`players/${MY_UID}/jailTurns`]: 0 });
      log(`${me.name} rolled doubles (${d1}-${d2}) and is out of jail — they'll move on their next turn.`);
      await roomRef('turnPhase').set('end');
    } else if (isDouble){
      // 3rd attempt doubles: freed AND moves immediately, same as the classic rule.
      await roomRef().update({ [`players/${MY_UID}/inJail`]: false, [`players/${MY_UID}/jailTurns`]: 0 });
      log(`${me.name} rolled doubles (${d1}-${d2}) on their last attempt and is released from jail!`);
      await movePlayer(MY_UID, steps);
    } else if (attempt >= 3){
      // 3rd attempt, no doubles: forced out at half the usual fine, and still stays put.
      const fine = Math.round((state.settings?.jailFineAmount ?? 50) / 2);
      const releaseUpdates = { [`players/${MY_UID}/money`]: me.money-fine, [`players/${MY_UID}/inJail`]: false, [`players/${MY_UID}/jailTurns`]: 0 };
      if (state.settings?.freeParkingJackpot){
        releaseUpdates['freeParkingPot'] = (state.freeParkingPot||0) + fine;
      }
      await roomRef().update(releaseUpdates);
      log(`${me.name} failed to roll doubles after 3 attempts, paid a reduced $${fine} fine, and is released.`);
      await roomRef('turnPhase').set('end');
    } else {
      // 1st/2nd attempt, no doubles: still stuck, try again next turn.
      await roomRef(`players/${MY_UID}/jailTurns`).set(attempt);
      log(`${me.name} rolled ${d1}-${d2} in jail (attempt ${attempt}/3).`);
      await roomRef('turnPhase').set('end');
    }
  }, totalMs);
}

async function endTurn(){
  if (!isMyTurn() || state.turnPhase === 'debt') return;
  const order = state.turnOrder;
  const idx = order.indexOf(MY_UID);
  const nextUid = order[(idx+1) % order.length];
  await roomRef().update({ currentTurn: nextUid, turnPhase: 'roll', doublesStreak: 0 });
}

function canBuildOn(tileIndex){
  const tile = BOARD[tileIndex];
  if (tile.type !== 'property') return { ok:false, reason:'Only color properties can have houses.' };
  const pdata = state.properties[tileIndex];
  if (!pdata || pdata.owner !== MY_UID) return { ok:false, reason:'You don\'t own this property.' };
  if (pdata.houses >= 5) return { ok:false, reason:'Already has a hotel.' };
  if (!isMyTurn()) return { ok:false, reason:'You can only build on your own turn.' };
  const requireFullSet = state.settings?.requireFullSetToBuild !== false;
  if (requireFullSet){
    if (!ownsFullGroup(MY_UID, tile.group)) return { ok:false, reason:'You need the whole color set to build.' };
    return { ok:true };
  }
  // House rule: no full-set requirement, but you must be standing exactly on this tile right now,
  // and it must not be the same visit you bought it on (i.e. you need to land here again later).
  if (state.players[MY_UID].position !== tileIndex) return { ok:false, reason:'House rule: you must land on this exact property to build here.' };
  if (!pdata.landedSincePurchase) return { ok:false, reason:'You just bought this — land here again on a future turn before you can build.' };
  return { ok:true };
}

async function buildHouse(tileIndex){
  if (state.players[MY_UID].money < 0){ showToast("You're in debt — resolve that before building."); return; }
  const check = canBuildOn(tileIndex);
  if (!check.ok){ showToast(check.reason); return; }
  const tile = BOARD[tileIndex];
  const pdata = state.properties[tileIndex];
  const player = state.players[MY_UID];
  if (player.money < tile.house) { showToast("Can't afford that."); return; }
  await roomRef().update({
    [`properties/${tileIndex}/houses`]: pdata.houses + 1,
    [`players/${MY_UID}/money`]: player.money - tile.house
  });
  log(`${player.name} built ${pdata.houses+1===5?'a hotel':'a house'} on ${tile.name}.`);
}

async function sellHouse(tileIndex){
  const tile = BOARD[tileIndex];
  const pdata = state.properties[tileIndex];
  const player = state.players[MY_UID];
  if (pdata.owner !== MY_UID || pdata.houses <= 0) return;
  if (state.settings?.cashRuleMode === 'mortgage'){
    showToast('House rule: Mortgage Mode is on — mortgage properties instead of selling houses.');
    return;
  }
  await roomRef().update({
    [`properties/${tileIndex}/houses`]: pdata.houses - 1,
    [`players/${MY_UID}/money`]: player.money + Math.floor(tile.house/2)
  });
  log(`${player.name} sold a house on ${tile.name}.`);
  await maybeResolveDebt(MY_UID);
}

async function toggleMortgage(tileIndex){
  const tile = BOARD[tileIndex];
  const pdata = state.properties[tileIndex];
  const player = state.players[MY_UID];
  if (pdata.owner !== MY_UID) return;
  if (!pdata.mortgaged){
    if (state.settings?.cashRuleMode === 'sell'){
      showToast('House rule: Sell Mode is on — sell houses back to the bank instead of mortgaging.');
      return;
    }
    if (pdata.houses > 0){ showToast('Sell houses on this property first.'); return; }
    await roomRef().update({
      [`properties/${tileIndex}/mortgaged`]: true,
      [`players/${MY_UID}/money`]: player.money + Math.floor(tile.price/2)
    });
    log(`${player.name} mortgaged ${tile.name}.`);
    await maybeResolveDebt(MY_UID);
  } else {
    if (player.money < 0){ showToast("You can't pay off a mortgage while you're in debt."); return; }
    const cost = Math.floor(tile.price/2 * 1.1);
    if (player.money < cost){ showToast("Can't afford to unmortgage."); return; }
    await roomRef().update({
      [`properties/${tileIndex}/mortgaged`]: false,
      [`players/${MY_UID}/money`]: player.money - cost
    });
    log(`${player.name} paid off the mortgage on ${tile.name}.`);
  }
}

function ownsFullGroup(uid, group){
  const tiles = BOARD.filter(t => t.group === group);
  return tiles.every(t => state.properties[t.i].owner === uid);
}

// ---------- Trading (works regardless of whose turn it is) ----------

function otherActivePlayers(){
  return state.turnOrder.filter(u => u !== MY_UID && !state.players[u].bankrupt);
}

function tradablePropertiesOf(uid){
  return BOARD.filter(t =>
    (t.type==='property' || t.type==='railroad' || t.type==='utility') &&
    state.properties[t.i] && state.properties[t.i].owner === uid &&
    (t.type !== 'property' || state.properties[t.i].houses === 0)
  );
}

async function proposeTrade({ toUid, give, receive, note, counterOf }){
  if (!state.settings?.tradingEnabled){ showToast('Trading is turned off for this game.'); return; }
  if (!toUid || toUid === MY_UID) return;
  const tradeId = 'trade_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
  const trade = {
    id: tradeId,
    fromUid: MY_UID,
    toUid,
    give: { cash: give.cash||0, properties: give.properties||[], jailFreeCards: give.jailFreeCards||0 },
    receive: { cash: receive.cash||0, properties: receive.properties||[], jailFreeCards: receive.jailFreeCards||0 },
    note: note || '',
    status: 'pending',
    createdAt: Date.now(),
    counterOf: counterOf || null
  };
  const updates = { [`trades/${tradeId}`]: trade };
  if (counterOf) updates[`trades/${counterOf}/status`] = 'countered';
  await roomRef().update(updates);
  log(`${state.players[MY_UID].name} sent a trade offer to ${state.players[toUid].name}.`);
  showToast('Trade offer sent!');
}

function validateTrade(trade){
  const giver = state.players[trade.fromUid];
  const receiver = state.players[trade.toUid];
  if (!giver || !receiver || giver.bankrupt || receiver.bankrupt) return { valid:false, reason:'A player in this trade is no longer active.' };
  if (giver.money < (trade.give.cash||0)) return { valid:false, reason:`${giver.name} no longer has enough cash.` };
  if (receiver.money < (trade.receive.cash||0)) return { valid:false, reason:`${receiver.name} no longer has enough cash.` };
  for (const idx of (trade.give.properties||[])){
    const p = state.properties[idx];
    if (!p || p.owner !== trade.fromUid) return { valid:false, reason:`${BOARD[idx].name} is no longer owned by ${giver.name}.` };
    if (p.houses > 0) return { valid:false, reason:`${BOARD[idx].name} has houses on it now — sell them first.` };
  }
  for (const idx of (trade.receive.properties||[])){
    const p = state.properties[idx];
    if (!p || p.owner !== trade.toUid) return { valid:false, reason:`${BOARD[idx].name} is no longer owned by ${receiver.name}.` };
    if (p.houses > 0) return { valid:false, reason:`${BOARD[idx].name} has houses on it now — sell them first.` };
  }
  if ((trade.give.jailFreeCards||0) > (giver.jailFreeCards||0)) return { valid:false, reason:`${giver.name} doesn't have enough Jail-Free cards anymore.` };
  if ((trade.receive.jailFreeCards||0) > (receiver.jailFreeCards||0)) return { valid:false, reason:`${receiver.name} doesn't have enough Jail-Free cards anymore.` };
  return { valid:true };
}

async function respondTrade(tradeId, action){
  const trade = state.trades?.[tradeId];
  if (!trade || trade.status !== 'pending') return;

  if (action === 'decline'){
    if (trade.toUid !== MY_UID) return;
    await roomRef(`trades/${tradeId}/status`).set('declined');
    log(`${state.players[MY_UID].name} declined a trade offer from ${state.players[trade.fromUid].name}.`);
    return;
  }
  if (action === 'cancel'){
    if (trade.fromUid !== MY_UID) return;
    await roomRef(`trades/${tradeId}/status`).set('cancelled');
    return;
  }
  if (action === 'accept'){
    if (trade.toUid !== MY_UID) return;
    const check = validateTrade(trade);
    if (!check.valid){
      showToast(check.reason);
      await roomRef(`trades/${tradeId}/status`).set('invalid');
      return;
    }
    const giver = state.players[trade.fromUid];
    const receiver = state.players[trade.toUid];
    const updates = {};
    updates[`players/${trade.fromUid}/money`] = giver.money - (trade.give.cash||0) + (trade.receive.cash||0);
    updates[`players/${trade.toUid}/money`] = receiver.money - (trade.receive.cash||0) + (trade.give.cash||0);
    (trade.give.properties||[]).forEach(idx => { updates[`properties/${idx}/owner`] = trade.toUid; updates[`properties/${idx}/landedSincePurchase`] = false; });
    (trade.receive.properties||[]).forEach(idx => { updates[`properties/${idx}/owner`] = trade.fromUid; updates[`properties/${idx}/landedSincePurchase`] = false; });
    updates[`players/${trade.fromUid}/jailFreeCards`] = (giver.jailFreeCards||0) - (trade.give.jailFreeCards||0) + (trade.receive.jailFreeCards||0);
    updates[`players/${trade.toUid}/jailFreeCards`] = (receiver.jailFreeCards||0) - (trade.receive.jailFreeCards||0) + (trade.give.jailFreeCards||0);
    updates[`trades/${tradeId}/status`] = 'accepted';
    await roomRef().update(updates);
    log(`🤝 ${state.players[trade.toUid].name} accepted a trade with ${state.players[trade.fromUid].name}.`);
  }
}

function pendingIncomingTrades(){
  return Object.values(state.trades || {}).filter(t => t.toUid === MY_UID && t.status === 'pending');
}
function pendingOutgoingTrades(){
  return Object.values(state.trades || {}).filter(t => t.fromUid === MY_UID && t.status === 'pending');
}

// ---------- 4 & 5 are in ui.js ----------
