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

// ---------------------------------------------------------------------------
// TOAST_MESSAGES — variety pools for showToast() (ui.js), with one important
// difference from LOG_MESSAGES above: a toast needs to feel like a single
// assistant giving *one* answer, not rephrasing itself mid-sentence. Spam-
// clicking "Buy" with no money should show the exact same toast every time,
// not a fresh random line on every click — that would read like the game is
// babbling. So pickToastLine() below only rerolls when the *situation itself*
// changes (a different key than whatever toast last showed); repeating the
// same key in a row reuses the line it already picked.
//
// KEYED BY THE EXACT STRING each showToast(...) call already passes — this is
// deliberate: pickToastLine() falls back to treating an unrecognized key as
// the message itself, so every existing showToast("...") call site keeps
// working untouched whether or not it has an entry here. Adding variety to a
// toast that doesn't have one yet is just adding an array below with that same
// exact string as one of the options — no call site needs to change.
const TOAST_MESSAGES = {
  'Tên thì đéo nhập': [
    'Tên thì đéo nhập',
    'Quên nhập tên rồi kìa',
    'Tên đâu mà tạo phòng?',
    'Điền tên vào đã nào bạn ơi'
  ],
  'Tên đâu?? Code đâu??': [
    'Tên đâu?? Code đâu??',
    'Thiếu tên hoặc code phòng rồi kìa',
    'Điền đủ cả tên lẫn code đã'
  ],
  'Không đủ money !!!': [
    'Không đủ money !!!',
    'Nghèo thì đéo mua được đâu',
    'Ví lép kẹp rồi, mua sao được',
    'Không đủ tiền mua đất này đâu'
  ],
  'Bạn không đủ tiền mặt': [
    'Bạn không đủ tiền mặt',
    'Đưa cái đéo gì khi trong túi rỗng',
    'Không đủ tiền mặt để đem đi trade đâu'
  ],
  'Đéo đủ tiền 😭:((((': [
    'Đéo đủ tiền 😭:((((',
    'Nghèo thì xây bằng niềm tin à 😭',
    'Không đủ tiền xây nhà đâu bạn'
  ],
  'Không đủ tiền': [
    'Không đủ tiền',
    'Ví bạn không đủ cho khoản này đâu',
    'Không đủ tiền đâu, xoay xở đi đã'
  ],
  'Không đủ tiền đấu giá...': [
    'Không đủ tiền đấu giá...',
    'Đấu giá bằng niềm tin à, tiền đâu?',
    'Không đủ tiền để trả giá này đâu'
  ],
  'Nợ thì đéo lo... Xây cc 🐧': [
    'Nợ thì đéo lo... Xây cc 🐧',
    'Đang nợ ngập đầu mà đòi xây? 🐧',
    'Trả nợ đi đã rồi hẵng xây'
  ],
  'Bạn đang không mắc nợ.': [
    'Bạn đang không mắc nợ.',
    'Có nợ đéo đâu mà tuyên bố phá sản',
    'Đang dư dả mà đòi nghỉ học à'
  ],
  'Không có phòng như vậy nhé!': [
    'Không có phòng như vậy nhé!',
    'Code phòng này không tồn tại đâu',
    'Tìm không ra phòng với code đó'
  ],
  'Room hết slot 3s trước': [
    'Room hết slot 3s trước',
    'Phòng đầy người rồi, chịu thôi',
    'Hết chỗ trong phòng này rồi'
  ],
  'Chưa có gì để đem vào giao dịch': [
    'Chưa có gì để đem vào giao dịch',
    'Trống trơn thế này thì trade cái gì',
    'Thêm gì đó vào giao dịch đã chứ'
  ],
  'Một nước một vua thì trade với ai?': [
    'Một nước một vua thì trade với ai?',
    'Có mỗi mình thì trade với ai bây giờ',
    'Chờ thêm người vào đã rồi trade'
  ],
  'Không có nhiều lượt ra khỏi khu Quân sự miễn phí đến vậy đâu': [
    'Không có nhiều lượt ra khỏi khu Quân sự miễn phí đến vậy đâu',
    'Làm gì có nhiều Jail-Free Card thế mà đem trade'
  ],
  'Không thể bán một nơi đang thế chấp': [
    'Không thể bán một nơi đang thế chấp',
    'Đất đang thế chấp, chưa bán được đâu'
  ],
  'Tháo dỡ các tòa nhà trên đất này trước đã': [
    'Tháo dỡ các tòa nhà trên đất này trước đã',
    'Còn nhà trên đất kìa, hạ hết đã rồi tính'
  ]
};

// Remembers only the single most-recently-shown toast (key + resolved line) —
// not a history — so the very next *different* toast rerolls fresh, but any
// immediate repeat of the same key (spam-clicking the same disabled action)
// keeps saying the same thing instead of cycling through the variety pool.
let lastToastKey = null;
let lastToastLine = '';

function pickToastLine(key, vars = {}){
  if (key === lastToastKey) return lastToastLine;
  const options = TOAST_MESSAGES[key];
  const template = (options && options.length) ? options[Math.floor(Math.random() * options.length)] : key;
  const line = template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
  lastToastKey = key;
  lastToastLine = line;
  return line;
}
