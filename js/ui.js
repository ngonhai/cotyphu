// ui.js — rendering + DOM event wiring. Reads `state` (from game.js) and paints the page.

function showScreen(name){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
}

function goToLobby(){
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
  } else if (state.status === 'playing'){
    showScreen('game');
    renderGame();
  } else if (state.status === 'ended'){
    showScreen('game');
    renderGame();
    renderWinnerBanner();
  }
}

// ---------- Waiting room ----------

function renderWaitingRoom(){
  document.getElementById('room-code-display').textContent = ROOM_ID;
  const list = document.getElementById('waiting-players');
  list.innerHTML = '';
  const players = Object.entries(state.players || {});
  players.forEach(([uid, p]) => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="token-dot" style="background:${p.color}"></span> ${escapeHtml(p.name)} ${uid===state.hostUid ? '<span class="tag">HOST</span>' : ''} ${uid===MY_UID ? '<span class="tag you">YOU</span>' : ''}`;
    list.appendChild(li);
  });
  document.getElementById('waiting-count').textContent = `${players.length} / ${state.settings?.maxPlayers ?? 6} players`;
  const startBtn = document.getElementById('btn-start-game');
  startBtn.style.display = (MY_UID === state.hostUid) ? 'block' : 'none';
  startBtn.disabled = players.length < 2;
  document.getElementById('waiting-hint').style.display = (MY_UID === state.hostUid) ? 'none' : 'block';
}

// ---------- Game board ----------

function renderGame(){
  document.getElementById('game-room-code-label').textContent = ROOM_ID;
  renderBoard();
  renderPlayerPanel();
  renderDice();
  renderActionBar();
  renderLog();
  renderPropertyDrawerButton();
}

function renderBoard(){
  const board = document.getElementById('board');
  if (board.childElementCount === 0){
    // build tiles once
    BOARD.forEach(tile => {
      const pos = tileGridPos(tile.i);
      const div = document.createElement('div');
      div.className = 'tile tile-' + tile.type + (tile.group ? ' group-' + tile.group : '');
      div.style.gridRow = pos.row;
      div.style.gridColumn = pos.col;
      div.dataset.i = tile.i;
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

  // update ownership stripes + houses
  BOARD.forEach(tile => {
    if (!(tile.type==='property'||tile.type==='railroad'||tile.type==='utility')) return;
    const pdata = state.properties[tile.i];
    const el = board.querySelector(`[data-i="${tile.i}"]`);
    el.classList.toggle('mortgaged', !!pdata.mortgaged);
    let ownerStripe = el.querySelector('.owner-stripe');
    if (pdata.owner){
      if (!ownerStripe){ ownerStripe = document.createElement('div'); ownerStripe.className='owner-stripe'; el.appendChild(ownerStripe); }
      ownerStripe.style.background = state.players[pdata.owner].color;
    } else if (ownerStripe){ ownerStripe.remove(); }
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

function tileInnerHtml(tile){
  const icon = { chance:'❓', chest:'📦', tax:'💰', jail:'🚔', free:'🅿️', gotojail:'👮', go:'➡️' }[tile.type] || '';
  const price = tile.price ? `<div class="tile-price">$${tile.price}</div>` : '';
  return `<div class="tile-name">${icon} ${escapeHtml(tile.name)}</div>${price}`;
}

function renderTokens(){
  document.querySelectorAll('.player-token').forEach(t => t.remove());
  const grouped = {};
  Object.entries(state.players).forEach(([uid,p]) => {
    if (p.bankrupt) return;
    grouped[p.position] = grouped[p.position] || [];
    grouped[p.position].push([uid,p]);
  });
  Object.entries(grouped).forEach(([pos, arr]) => {
    const el = document.querySelector(`[data-i="${pos}"]`);
    if (!el) return;
    arr.forEach(([uid,p], idx) => {
      const tok = document.createElement('div');
      tok.className = 'player-token' + (uid===MY_UID ? ' me' : '');
      tok.style.background = p.color;
      tok.style.transform = `translate(${idx*7}px, ${idx*7}px)`;
      tok.title = p.name;
      el.appendChild(tok);
    });
  });
}

function renderPlayerPanel(){
  const wrap = document.getElementById('player-panel');
  wrap.innerHTML = '';
  state.turnOrder.forEach(uid => {
    const p = state.players[uid];
    const card = document.createElement('div');
    card.className = 'player-card' + (state.currentTurn===uid ? ' active-turn' : '') + (p.bankrupt ? ' bankrupt' : '');
    card.innerHTML = `
      <span class="token-dot" style="background:${p.color}"></span>
      <div class="player-info">
        <div class="player-name">${escapeHtml(p.name)}${uid===MY_UID?' (you)':''}${p.inJail?' 🚔':''}</div>
        <div class="player-money">$${p.money}</div>
      </div>
      ${state.currentTurn===uid ? '<span class="turn-badge">TURN</span>' : ''}
    `;
    wrap.appendChild(card);
  });
  if (state.settings?.freeParkingJackpot){
    const pot = document.createElement('div');
    pot.className = 'jackpot-line';
    pot.textContent = `🅿️ Free Parking pot: $${state.freeParkingPot||0}`;
    wrap.appendChild(pot);
  }
}

function renderDice(){
  const [d1,d2] = state.dice || [1,1];
  document.getElementById('die1').textContent = DICE_FACES[d1];
  document.getElementById('die2').textContent = DICE_FACES[d2];
}
const DICE_FACES = {1:'⚀',2:'⚁',3:'⚂',4:'⚃',5:'⚄',6:'⚅'};

function renderActionBar(){
  const bar = document.getElementById('action-bar');
  bar.innerHTML = '';
  if (state.status === 'ended') return;

  const myTurn = isMyTurn();
  const me = state.players[MY_UID];

  if (!myTurn){
    bar.innerHTML = `<div class="waiting-msg">Waiting for ${escapeHtml(state.players[state.currentTurn]?.name || '...')} to play…</div>`;
    return;
  }

  if (me.inJail){
    bar.appendChild(btn('Pay $50 to get out', payJailFine, me.money < 50));
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

function btn(label, fn, disabled, secondary){
  const b = document.createElement('button');
  b.className = 'btn' + (secondary ? ' btn-secondary' : '');
  b.textContent = label;
  b.disabled = !!disabled;
  b.addEventListener('click', fn);
  return b;
}

function renderLog(){
  const el = document.getElementById('log-panel');
  const entries = Object.values(state.log || {}).sort((a,b) => a.ts - b.ts).slice(-40);
  el.innerHTML = entries.map(e => `<div class="log-entry">${escapeHtml(e.msg)}</div>`).join('');
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

// ---------- Property management drawer ----------

function renderPropertyDrawerButton(){
  document.getElementById('btn-properties').style.display = 'inline-flex';
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
    const labels = ['Base','1 house','2 houses','3 houses','4 houses','Hotel'];
    rentLines = tile.rent.map((r,i) => `<div class="rent-row">${labels[i]}<span>$${r}</span></div>`).join('');
  } else if (tile.type === 'railroad'){
    rentLines = tile.rent.map((r,i) => `<div class="rent-row">${i+1} railroad${i?'s':''}<span>$${r}</span></div>`).join('');
  } else {
    rentLines = `<div class="rent-row">1 utility<span>4× dice roll</span></div><div class="rent-row">2 utilities<span>10× dice roll</span></div>`;
  }

  let controls = '';
  const isMine = pdata.owner === MY_UID;
  if (isMine && tile.type === 'property' && isMyTurn()){
    controls += `<div class="modal-actions">
      <button class="btn" id="mbtn-build" ${!ownsFullGroup(MY_UID, tile.group) || pdata.houses>=5 ? 'disabled' : ''}>Build (${pdata.houses>=4?'Hotel':'House'} — $${tile.house})</button>
      <button class="btn btn-secondary" id="mbtn-sell" ${pdata.houses<=0?'disabled':''}>Sell house (+$${Math.floor(tile.house/2)})</button>
    </div>`;
  }
  if (isMine && pdata.houses===0 && isMyTurn()){
    controls += `<div class="modal-actions">
      <button class="btn btn-secondary" id="mbtn-mortgage">${pdata.mortgaged ? `Pay off mortgage (-$${Math.floor(tile.price/2*1.1)})` : `Mortgage (+$${Math.floor(tile.price/2)})`}</button>
    </div>`;
  }

  modal.innerHTML = `
    <div class="modal-card group-${tile.group||''}">
      <button class="modal-close" id="modal-close">✕</button>
      <h3>${escapeHtml(tile.name)}</h3>
      <div class="modal-owner">Owner: ${escapeHtml(owner)}${pdata.mortgaged ? ' (mortgaged)' : ''}</div>
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

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ---------- Event wiring ----------

document.addEventListener('DOMContentLoaded', async () => {
  const rejoined = await tryRejoin();
  if (!rejoined) showScreen('lobby');

  document.getElementById('btn-create-room').addEventListener('click', () => {
    const name = document.getElementById('input-name-create').value.trim();
    const maxPlayers = parseInt(document.getElementById('select-max-players').value);
    if (!name){ showToast('Enter your name first.'); return; }
    createRoom(name, maxPlayers);
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
  document.getElementById('btn-leave-game').addEventListener('click', () => {
    if (confirm('Leave this game?')) goToLobby();
  });
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') e.target.classList.remove('show');
  });
});
