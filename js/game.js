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

function subscribeRoom(){
  roomRef().on('value', snap => {
    state = snap.val();
    if (!state){ showToast('Room not found (it may have expired).'); goToLobby(); return; }
    renderAll();
  });
}

function log(msg){
  const entry = { msg, ts: Date.now() };
  const ref = roomRef('log').push();
  ref.set(entry);
  // trim old log entries client-side occasionally (best-effort, not critical)
}

// ---------- 3. Game actions ----------

async function createRoom(name, maxPlayers){
  ROOM_ID = roomCode();
  myName = name;
  const color = TOKEN_COLORS[0];
  const room = {
    hostUid: MY_UID,
    status: 'lobby',
    settings: { startingMoney: 1500, freeParkingJackpot: false, maxPlayers },
    players: {
      [MY_UID]: { name, color, money: 1500, position: 0, inJail:false, jailTurns:0, bankrupt:false, jailFreeCards:0 }
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
  showScreen('waiting');
}

async function joinRoom(code, name){
  ROOM_ID = code.toUpperCase();
  const snap = await roomRef().get();
  if (!snap.exists()){ showToast("That room code doesn't exist."); ROOM_ID = null; return false; }
  const room = snap.val();
  if (room.status !== 'lobby'){ showToast('That game has already started.'); ROOM_ID = null; return false; }
  const existing = Object.keys(room.players || {});
  if (existing.length >= (room.settings?.maxPlayers || 6) && !existing.includes(MY_UID)){
    showToast('That room is full.'); ROOM_ID = null; return false;
  }
  myName = name;
  const usedColors = existing.map(k => room.players[k].color);
  const color = TOKEN_COLORS.find(c => !usedColors.includes(c)) || TOKEN_COLORS[existing.length % TOKEN_COLORS.length];
  await roomRef('players/' + MY_UID).set({
    name, color, money: room.settings?.startingMoney ?? 1500, position:0,
    inJail:false, jailTurns:0, bankrupt:false, jailFreeCards:0
  });
  location.hash = ROOM_ID;
  subscribeRoom();
  showScreen('waiting');
  return true;
}

async function tryRejoin(){
  const hash = location.hash.replace('#','').trim();
  if (!hash) return false;
  const snap = await db.ref('rooms/' + hash).get();
  if (!snap.exists()) return false;
  const room = snap.val();
  if (!room.players || !room.players[MY_UID]) return false;
  ROOM_ID = hash;
  myName = room.players[MY_UID].name;
  subscribeRoom();
  showScreen(room.status === 'lobby' ? 'waiting' : 'game');
  return true;
}

function startGame(){
  if (MY_UID !== state.hostUid) return;
  const order = Object.keys(state.players).sort(() => Math.random() - 0.5);
  const props = {};
  BOARD.forEach(t => { if (t.type==='property' || t.type==='railroad' || t.type==='utility') props[t.i] = { owner:null, houses:0, mortgaged:false }; });
  roomRef().update({
    status: 'playing',
    turnOrder: order,
    currentTurn: order[0],
    turnPhase: 'roll',
    properties: props
  });
  log(`Game started. Turn order: ${order.map(u=>state.players[u].name).join(' → ')}`);
}

function isMyTurn(){ return state && state.status==='playing' && state.currentTurn === MY_UID; }

async function rollDice(){
  if (!isMyTurn() || state.turnPhase !== 'roll') return;
  const me = state.players[MY_UID];

  // Jail resolution happens via separate buttons (payJail/useCard/rollForDoubles); if inJail we shouldn't reach here.
  const d1 = 1 + Math.floor(Math.random()*6);
  const d2 = 1 + Math.floor(Math.random()*6);
  const isDouble = d1 === d2;
  let doublesStreak = (state.doublesStreak||0) + (isDouble?1:0);
  if (isDouble && doublesStreak >= 3){
    // three doubles in a row -> go to jail, forfeit move
    await sendToJail(MY_UID, 'rolled three doubles in a row');
    await roomRef().update({ dice:[d1,d2], doublesStreak:0 });
    await endTurn();
    return;
  }

  await roomRef('dice').set([d1,d2]);
  await roomRef('doublesStreak').set(isDouble ? doublesStreak : 0);
  await movePlayer(MY_UID, d1+d2);
  // Note: if this lands on an unowned property, turnPhase becomes 'action' (pending buy)
  // and the doubles reroll (if any) is granted by finishAction() once that's resolved.
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

  if (tile.type === 'go' || tile.type === 'jail' || tile.type === 'free'){
    log(`${player.name} landed on ${tile.name}.`);
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
    await chargePlayer(uid, tile.amount, null);
    if (room.settings?.freeParkingJackpot){
      await roomRef('freeParkingPot').set((room.freeParkingPot||0) + tile.amount);
    }
    await finishAction(uid);
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
      log(`${player.name} landed on their own property, ${tile.name}.`);
      await finishAction(uid);
    } else if (pdata.mortgaged){
      log(`${player.name} landed on ${tile.name}, but it's mortgaged — no rent due.`);
      await finishAction(uid);
    } else {
      const rent = computeRent(room, tileIndex);
      log(`${player.name} landed on ${tile.name} (owned by ${room.players[pdata.owner].name}) and owes $${rent} rent.`);
      await chargePlayer(uid, rent, pdata.owner);
      await finishAction(uid);
    }
    return;
  }
}

function computeRent(room, tileIndex){
  const tile = BOARD[tileIndex];
  const pdata = room.properties[tileIndex];
  if (tile.type === 'property'){
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

async function chargePlayer(uid, amount, toUid){
  const room = (await roomRef().get()).val();
  const player = room.players[uid];
  const newMoney = player.money - amount;
  const updates = { [`players/${uid}/money`]: newMoney };
  if (toUid){
    updates[`players/${toUid}/money`] = room.players[toUid].money + amount;
  }
  await roomRef().update(updates);
  if (newMoney < 0){
    await handleBankruptcy(uid, toUid);
  }
}

async function handleBankruptcy(uid, creditorUid){
  const room = (await roomRef().get()).val();
  const player = room.players[uid];
  if (player.bankrupt) return;
  log(`💥 ${player.name} went bankrupt!`);
  const updates = { [`players/${uid}/bankrupt`]: true, [`players/${uid}/money`]: 0 };
  // hand over (or release) properties
  Object.keys(room.properties).forEach(idx => {
    if (room.properties[idx].owner === uid){
      updates[`properties/${idx}/owner`] = creditorUid || null;
      updates[`properties/${idx}/houses`] = 0;
      updates[`properties/${idx}/mortgaged`] = creditorUid ? room.properties[idx].mortgaged : false;
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
    log(`🏆 ${stillIn[0] ? room.players[stillIn[0]].name : 'Nobody'} wins the game!`);
  }
}

async function sendToJail(uid, reason){
  await roomRef().update({
    [`players/${uid}/position`]: 10,
    [`players/${uid}/inJail`]: true,
    [`players/${uid}/jailTurns`]: 0,
    doublesStreak: 0
  });
  log(`${state.players[uid].name} was sent to jail (${reason}).`);
}

async function drawCard(uid, deckType){
  const deck = deckType === 'chance' ? CHANCE_CARDS : CHEST_CARDS;
  const card = deck[Math.floor(Math.random()*deck.length)];
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
    case 'cash':
      await chargePlayer(uid, -card.amount, null);
      await finishAction(uid);
      return;
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
      await chargePlayer(uid, total, null);
      await finishAction(uid);
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
      updates[`players/${uid}/money`] = player.money - total;
      await roomRef().update(updates);
      await finishAction(uid);
      return;
    }
    case 'collect_each': {
      const updates = {};
      let total = 0;
      room.turnOrder.forEach(other => {
        if (other===uid || room.players[other].bankrupt) return;
        updates[`players/${other}/money`] = room.players[other].money - card.amount;
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
      if (pdata.owner && pdata.owner !== uid){
        const rent = computeRent(fresh, next) * 2;
        await chargePlayer(uid, rent, pdata.owner);
        await finishAction(uid);
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
    pendingBuy: null
  });
  log(`${player.name} bought ${tile.name} for $${tile.price}.`);
  await finishAction(MY_UID);
}

async function declineBuy(){
  if (!state.pendingBuy || state.pendingBuy.uid !== MY_UID) return;
  const tile = BOARD[state.pendingBuy.tileIndex];
  log(`${state.players[MY_UID].name} declined to buy ${tile.name}.`);
  await roomRef('pendingBuy').set(null);
  await finishAction(MY_UID);
}

async function payJailFine(){
  if (!isMyTurn() || !state.players[MY_UID].inJail) return;
  await roomRef().update({
    [`players/${MY_UID}/money`]: state.players[MY_UID].money - 50,
    [`players/${MY_UID}/inJail`]: false,
    [`players/${MY_UID}/jailTurns`]: 0
  });
  log(`${state.players[MY_UID].name} paid $50 to get out of jail.`);
  await roomRef('turnPhase').set('roll');
}

async function useJailCard(){
  if (!isMyTurn() || !state.players[MY_UID].inJail) return;
  if ((state.players[MY_UID].jailFreeCards||0) < 1) return;
  await roomRef().update({
    [`players/${MY_UID}/jailFreeCards`]: state.players[MY_UID].jailFreeCards - 1,
    [`players/${MY_UID}/inJail`]: false,
    [`players/${MY_UID}/jailTurns`]: 0
  });
  log(`${state.players[MY_UID].name} used a Get Out of Jail Free card.`);
  await roomRef('turnPhase').set('roll');
}

async function rollForJail(){
  if (!isMyTurn() || !state.players[MY_UID].inJail) return;
  const d1 = 1+Math.floor(Math.random()*6), d2 = 1+Math.floor(Math.random()*6);
  await roomRef('dice').set([d1,d2]);
  const me = state.players[MY_UID];
  if (d1===d2){
    await roomRef().update({ [`players/${MY_UID}/inJail`]: false, [`players/${MY_UID}/jailTurns`]: 0 });
    log(`${me.name} rolled doubles (${d1}-${d2}) and is released from jail!`);
    await movePlayer(MY_UID, d1+d2);
  } else {
    const turns = (me.jailTurns||0) + 1;
    if (turns >= 3){
      await roomRef().update({ [`players/${MY_UID}/money`]: me.money-50, [`players/${MY_UID}/inJail`]: false, [`players/${MY_UID}/jailTurns`]: 0 });
      log(`${me.name} failed to roll doubles 3 times, paid $50 and is released.`);
      await movePlayer(MY_UID, d1+d2);
    } else {
      await roomRef(`players/${MY_UID}/jailTurns`).set(turns);
      log(`${me.name} rolled ${d1}-${d2} in jail (attempt ${turns}/3).`);
      await roomRef('turnPhase').set('end');
    }
  }
}

async function endTurn(){
  if (!isMyTurn()) return;
  const order = state.turnOrder;
  const idx = order.indexOf(MY_UID);
  const nextUid = order[(idx+1) % order.length];
  await roomRef().update({ currentTurn: nextUid, turnPhase: 'roll', doublesStreak: 0 });
}

async function buildHouse(tileIndex){
  const tile = BOARD[tileIndex];
  const pdata = state.properties[tileIndex];
  const player = state.players[MY_UID];
  if (pdata.owner !== MY_UID) return;
  if (!ownsFullGroup(MY_UID, tile.group)) { showToast('You need the full color set to build.'); return; }
  if (pdata.houses >= 5) { showToast('Already has a hotel.'); return; }
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
  await roomRef().update({
    [`properties/${tileIndex}/houses`]: pdata.houses - 1,
    [`players/${MY_UID}/money`]: player.money + Math.floor(tile.house/2)
  });
  log(`${player.name} sold a house on ${tile.name}.`);
}

async function toggleMortgage(tileIndex){
  const tile = BOARD[tileIndex];
  const pdata = state.properties[tileIndex];
  const player = state.players[MY_UID];
  if (pdata.owner !== MY_UID) return;
  if (!pdata.mortgaged){
    if (pdata.houses > 0){ showToast('Sell houses on this property first.'); return; }
    await roomRef().update({
      [`properties/${tileIndex}/mortgaged`]: true,
      [`players/${MY_UID}/money`]: player.money + Math.floor(tile.price/2)
    });
    log(`${player.name} mortgaged ${tile.name}.`);
  } else {
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

// ---------- 4 & 5 are in ui.js ----------
