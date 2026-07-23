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

  const isHost = MY_UID === state.hostUid;
  const settings = state.settings || {};
  const ruleFullset = document.getElementById('rule-fullset');
  const ruleTrading = document.getElementById('rule-trading');
  const ruleFreeParking = document.getElementById('rule-freeparking');
  ruleFullset.checked = settings.requireFullSetToBuild !== false;
  ruleTrading.checked = settings.tradingEnabled !== false;
  ruleFreeParking.checked = !!settings.freeParkingJackpot;
  [ruleFullset, ruleTrading, ruleFreeParking].forEach(el => {
    el.disabled = !isHost;
    el.closest('.rule-row').classList.toggle('disabled', !isHost);
  });
  document.getElementById('rules-readonly-hint').style.display = isHost ? 'none' : 'block';
  ruleFullset.onchange = () => updateSetting('requireFullSetToBuild', ruleFullset.checked);
  ruleTrading.onchange = () => updateSetting('tradingEnabled', ruleTrading.checked);
  ruleFreeParking.onchange = () => updateSetting('freeParkingJackpot', ruleFreeParking.checked);
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
  renderTradeButton();
  refreshOpenTradeModalIfNeeded();
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
  btn.style.display = 'inline-flex';
  const count = pendingIncomingTrades().length;
  const badge = document.getElementById('trades-badge');
  if (count > 0){ badge.style.display='flex'; badge.textContent = count; }
  else { badge.style.display='none'; }
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
  if (isMine && tile.type === 'property'){
    const buildCheck = canBuildOn(tileIndex);
    controls += `<div class="modal-actions">
      <button class="btn" id="mbtn-build" ${buildCheck.ok ? '' : 'disabled title="'+escapeHtml(buildCheck.reason)+'"'}>Build (${pdata.houses>=4?'Hotel':'House'} — $${tile.house})</button>
      <button class="btn btn-secondary" id="mbtn-sell" ${pdata.houses<=0?'disabled':''}>Sell house (+$${Math.floor(tile.house/2)})</button>
    </div>
    ${!buildCheck.ok ? `<p class="muted" style="font-size:.78rem;">${escapeHtml(buildCheck.reason)}</p>` : ''}`;
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
  document.getElementById('btn-trades').addEventListener('click', openTradeCenter);
  document.getElementById('btn-leave-game').addEventListener('click', () => {
    if (confirm('Leave this game?')) goToLobby();
  });
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') e.target.classList.remove('show');
  });
});
