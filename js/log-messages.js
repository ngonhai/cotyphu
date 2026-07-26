// log-messages.js
// ---------------------------------------------------------------------------
// LOG_MESSAGES — all the "flavor text" phrasings used in the game log. This is
// the one place to edit if you want the log to read differently.
//
// Each key below is a *moment* in the game (e.g. "declined to buy because they
// couldn't afford it" is a different moment from "declined to buy by choice",
// even though both end with the same declineBuy() call in game.js — see the
// comment on each key for exactly when it's used). Each moment has a LIST of
// possible phrasings; one is picked at random every time so the log doesn't
// read identically every game.
//
// TO EDIT WORDING: just rewrite the strings in place.
// TO ADD A NEW PHRASING to an existing moment: add another string to that array —
//   no other code needs to change.
// TO REMOVE a phrasing: delete its string (keep at least one per array).
// PLACEHOLDERS: {name}, {tile}, {amount}, {reason}, etc. get swapped in
//   automatically — keep whichever ones already appear in the array you're
//   editing, in the same {curly} form.
//
// TO WIRE UP A BRAND-NEW MOMENT that doesn't have flavor text yet: add a new
// key here, then swap the plain log(`...`) call for it in game.js with:
//   log(pickLine('yourNewKey', { name: player.name, ... }));
// ---------------------------------------------------------------------------

const LOG_MESSAGES = {

  // declineBuy(): player could afford the property but chose to pass anyway.
  declineBuy_choice: [
    "{name} đéo thích mua {tile}",
    "{name} nhìn ô {tile} rồi nhếch mép bỏ đi",
    "{name} chưa muốn mua {tile} lúc này",
    "{tile} không quyến rũ được {name}",
    "{tile} không mups đối với {name}"
  ],

  // declineBuy(): player didn't have enough cash to buy, even if they wanted to.
  declineBuy_cantAfford: [
    "{name} đéo có tiền nên không mua được {tile}",
    "{name} nhìn {tile} tiếc nuối",
    "{name} để giành {tile} cho lần sau",
    "{name} để giành {tile} cho người khác",
    "{tile} ngoài tầm với của {name}"
  ],

  // resolveTile(): rent that leaves the payer in real trouble (see the bigHit
  // check next to where this is used in game.js).
  rent_bigHit: [
    "{name} trả ${amount} cho {owner} trên đất {tile} — đau thì vl",
    "Đm — {name} phải trả {owner} ${amount} tiền thăm quan {tile}",
    "{name} ngậm ngùi trả ${amount} khi đến {tile}, cái mà {owner} sở hữu",
    "{name} đã khóc sau khi trả {owner} ${amount} ở {tile}"
  ],

  // resolveTile(): an ordinary, easily-affordable rent payment.
  rent_minor: [
    "{name} bố thí ${amount} cho {owner} khi đến {tile}",
    "{name} lo liệu ổn thỏa ${amount} khi giẫm {tile}.",
    " ${amount} đéo thấm vào đâu tiền {name} khi giẫm {tile}, và {owner} thì húp."
  ],

  // sendToJail(): reason is whatever string was passed to sendToJail(uid, reason).
  sentToJail: [
    "{name} cút cmm vào tù ({reason}).",
    "Ngon — {name} tù ngay ({reason}).",
    "{name} chào buồng 36 ({reason})."
  ],

  // Player's money hits negative and they hit the "Declare Bankruptcy" button.
  bankruptcy: [
    "💥 {name} vỡ nợ!",
    "💥 {name} kích hoạt chế độ không kếch xù!",
    "💥 {name} đéo muốn chơi tiếp!"
  ],

  // Only one active (non-bankrupt) player remains.
  gameWin: [
    "🏆 {name} thắng = may mắn!",
    "🏆 {name} bú win",
    "🏆 Còn thở: {name}!"
  ],
 
  // respondTrade(): receiver accepted a valid trade offer.
  acceptTrade: [
    "🤝 {name} và {fromName} phối giống thành công một thương vụ",
    "🤝 {name} cùng {fromName} bắt tay một kèo buôn bán",
    "🤝 {name} đã chấp nhận deal của {fromName}",
    "🤝 {fromName} và {name} cooked something!"
  ],
 
  // respondTrade(): the player who made the offer cancelled it before a response.
  cancelTrade: [
    "{name} hủy kèo đến {toName}.",
    "{name} không thích {toName}.",
    "{toName}: \"{name} cút cmmd!!!\""
  ],
 
  // respondTrade(): player received a trade offer and declined it.
  declineTrade: [
    "{name} nay dám từ chối {fromName}",
    "{name} đéo thích nói chuyện với {fromName}",
    "{name} từ chối trade của {fromName}",
    "{fromName} bị {name} từ chối...",
    "Deal của {fromName} không giòn đối với {name}"
  ]
};

// Picks one phrasing at random from LOG_MESSAGES[key] and fills in {placeholders}
// from `vars`. If a placeholder in the template has no matching key in `vars`,
// it's just removed rather than left as literal "{text}" in the log.
function pickLine(key, vars = {}){
  const options = LOG_MESSAGES[key];
  if (!options || options.length === 0) return '';
  const template = options[Math.floor(Math.random() * options.length)];
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
}
