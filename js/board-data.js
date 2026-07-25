// board-data.js
// Defines the 40 tiles of the board. Names are original (not the branded ones)
// but the numeric structure (prices/rents/positions) follows the classic,
// well-known public-domain ruleset of the genre.

const COLOR_GROUPS = {
  brown:    '#7a4a2b',
  lightblue:'#a8dadc',
  pink:     '#d46bb3',
  orange:   '#e08a2b',
  red:      '#d1453b',
  yellow:   '#f0c33c',
  green:    '#3f9142',
  darkblue: '#20458f'
};

// rent = [base, 1house, 2houses, 3houses, 4houses, hotel]
const BOARD = [
  { i:0,  type:'go',        name:'Quê Gốc' },
  { i:1,  type:'property',  name:'Thanh Hóa',      group:'brown', price:60,  rent:[2,10,30,90,160,250],  house:50 },
  { i:2,  type:'chest',     name:'Bất Ngờ' },
  { i:3,  type:'property',  name:'Tuyên Quang',        group:'brown', price:60,  rent:[4,20,60,180,320,450], house:50 },
  { i:4,  type:'tax',       name:'Thuế Thu Nhập',        amount:200,  taxKind:'income'},
  { i:5,  type:'railroad',  name:'Sân bay Tân Sơn Nhất',     price:200, rent:[25,50,100,200] },
  { i:6,  type:'property',  name:'Hải Phòng',      group:'lightblue', price:100, rent:[6,30,90,270,400,550], house:50 },
  { i:7,  type:'chance',    name:'Cơ Hội' },
  { i:8,  type:'property',  name:'Thái Bình',     group:'lightblue', price:100, rent:[6,30,90,270,400,550], house:50 },
  { i:9,  type:'property',  name:'Nam Định',   group:'lightblue', price:120, rent:[8,40,100,300,450,600], house:50 },
  { i:10, type:'jail',      name:'Nơi Đảo Xa' },
  { i:11, type:'property',  name:'Nghệ An',group:'pink', price:140, rent:[10,50,150,450,625,750], house:100 },
  { i:12, type:'utility',   name:'Tập đoàn Điện lực EVN',         price:150 },
  { i:13, type:'property',  name:'Hà Tĩnh',         group:'pink', price:140, rent:[10,50,150,450,625,750], house:100 },
  { i:14, type:'property',  name:'Quảng Bình',    group:'pink', price:160, rent:[12,60,180,500,700,900], house:100 },
  { i:15, type:'railroad',  name:'Cảng Hải Phòng',   price:200, rent:[25,50,100,200] },
  { i:16, type:'property',  name:'Thừa Thiên Huế',       group:'orange', price:180, rent:[14,70,200,550,750,950], house:100 },
  { i:17, type:'chest',     name:'Bất Ngờ' },
  { i:18, type:'property',  name:'Khánh Hòa',     group:'orange', price:180, rent:[14,70,200,550,750,950], house:100 },
  { i:19, type:'property',  name:'Bình Thuận',   group:'orange', price:200, rent:[16,80,220,600,800,1000], house:100 },
  { i:20, type:'free',      name:'Nghỉ Ngơi' },
  { i:21, type:'property',  name:'Lâm Đồng',     group:'red', price:220, rent:[18,90,250,700,875,1050], house:150 },
  { i:22, type:'chance',    name:'Cơ Hội' },
  { i:23, type:'property',  name:'Bình Dương',      group:'red', price:220, rent:[18,90,250,700,875,1050], house:150 },
  { i:24, type:'property',  name:'Đồng Nice',    group:'red', price:240, rent:[20,100,300,750,925,1100], house:150 },
  { i:25, type:'railroad',  name:'Sân bay Nội Bài', price:200, rent:[25,50,100,200] },
  { i:26, type:'property',  name:'Cần Thơ',   group:'yellow', price:260, rent:[22,110,330,800,975,1150], house:150 },
  { i:27, type:'property',  name:'Phú Quốc',  group:'yellow', price:260, rent:[22,110,330,800,975,1150], house:150 },
  { i:28, type:'utility',   name:'Thủy Điện Yaly',         price:150 },
  { i:29, type:'property',  name:'Đà Lạt',    group:'yellow', price:280, rent:[24,120,360,850,1025,1200], house:150 },
  { i:30, type:'gotojail',  name:'Ra Đảo Ngay' },
  { i:31, type:'property',  name:'Hà Nội',       group:'green', price:300, rent:[26,130,390,900,1100,1275], house:200 },
  { i:32, type:'property',  name:'Đà Nẵng',    group:'green', price:300, rent:[26,130,390,900,1100,1275], house:200 },
  { i:33, type:'chest',     name:'Túi Mù May Mắn' },
  { i:34, type:'property',  name:'Hồ Chí Minh',    group:'green', price:320, rent:[28,150,450,1000,1200,1400], house:200 },
  { i:35, type:'railroad',  name:'Ga Hà Nội',  price:200, rent:[25,50,100,200] },
  { i:36, type:'chance',    name:'Vận May' },
  { i:37, type:'property',  name:'Thái Lãng',     group:'darkblue', price:350, rent:[35,175,500,1100,1300,1500], house:200 },
  { i:38, type:'tax',       name:'Sưu Thuế',        amount:100,  taxKind:'luxury'},
  { i:39, type:'property',  name:'Nam Tân',     group:'darkblue', price:400, rent:[50,200,600,1400,1700,2000], house:200 }
];

// ---------------------------------------------------------------------------
// CHANCE_CARDS / CHEST_CARDS — fully editable card decks.
//
// Each card is: { text: 'what the card says', action: 'one of the types below', ...extra fields }
// To add your own card: just add a new object to either array. To pick which
// action it performs, use one of these action types (handled in drawCard() in game.js):
//
// ODDS: add a `weight` number to any card to make it come up more or less often.
// Default weight is 1 (every card is equally likely, exactly like a real deck), so
// you only need to add `weight` to the cards you want to change:
//   - weight: 3   → 3x more likely than a default (weight 1) card
//   - weight: 0.5 → half as likely
// Weights are relative, not percentages — the deck is drawn from proportionally,
// so it's fine to only tag a couple of cards; everything else just stays at 1.
// Example — make "Pay a $15 fine" show up 3x as often, and the $200 goto-GO card
// half as likely:
//   { text: 'Pay a $15 fine.', action: 'cash', amount: -15, weight: 3 }
//   { text: 'Advance to GO. Collect $200.', action: 'goto', to: 0, collectGo:true, weight: 0.5 }
//
//   'cash'            { amount }                pay (negative) or receive (positive) from the bank
//   'goto'            { to, collectGo? }        jump to board index `to`; collectGo:true awards $200 if you pass GO getting there
//   'move'            { amount }                move relative N spaces (negative = backwards), resolves whatever tile you land on
//   'gotojail'        {}                        go directly to jail
//   'jailfree'        {}                        gain a Get Out of Jail Free card (keepable, tradeable)
//   'repairs'         { house, hotel }           pay (house * houses-you-own) + (hotel * hotels-you-own)
//   'pay_each'        { amount }                 pay every other active player `amount`
//   'collect_each'    { amount }                 collect `amount` from every other active player
//   'nearest_rail'    {}                         advance to the next railroad clockwise, pay double rent if it's owned
//   'nearest_utility' {}                         advance to the next utility clockwise
//
// Example — add a new Chance card that gives the player $75:
//   { text: 'You found $75 on the sidewalk.', action: 'cash', amount: 75 }
//
// Want a brand-new *type* of effect (not listed above)? Add a new `case 'yourAction':`
// branch inside the `drawCard()` function in js/game.js, following the same pattern as
// the existing cases (read `room`/`player`, compute `updates`, write with roomRef().update(),
// then call `await finishAction(uid);` at the end so doubles/turn-passing still works correctly).
// ---------------------------------------------------------------------------

const CHANCE_CARDS = [
  { text: 'Về Quê. Nhận $200.', action: 'goto', to: 0, collectGo:true },
  { text: 'Tốc biến đến Nam Tân.', action: 'goto', to: 39, weight:0.4 },
  { text: 'Thăm quê Bác, Nghệ An.', action: 'goto', to: 11, collectGo:true },
  { text: 'Đến Sân Cảng gần nhất. Trả gấp đôi nếu nó có chủ.', action: 'nearest_rail' },
  { text: 'Nhặt được $50 gần Cầu Đen', action: 'cash', amount: 50 },
  { text: 'Một lượt ra tù free. Giữ để dùng hoặc đem trao đổi.', action: 'jailfree' },
  { text: 'Lùi 3 bước.', action: 'move', amount: -3 },
  { text: 'Cút luôn vào Tù.', action: 'gotojail' },
  { text: 'Có BĐS thì nộp phí bảo kê: $25/Nhà, $100/KS.', action: 'repairs', house:25, hotel:100 },
  { text: 'Bị hai ngòn $15 .', action: 'cash', amount: -15 },
  { text: 'Đến Nhà Máy gần nhất.', action: 'nearest_utility' },
  { text: 'Đột nhiên phóng khoáng. Cho mỗi người $50.', action: 'pay_each', amount: 50 },
  { text: 'Chúa thương tình. Góp cho mình $150.', action: 'cash', amount: 150 },
  { text: 'Ngừng lọ 1 hôm. Bú $100.', action: 'cash', amount: 100 },
  { text: 'Du lịch Cảng Hải Phòng.', action: 'goto', to: 15, collectGo:true },
  { text: 'Ngủ Phòng Hai.', action: 'goto', to: 6, collectGo:true }
];

const CHEST_CARDS = [
  { text: 'Về Quê. Nhận $200.', action: 'goto', to: 0, collectGo:true },
  { text: 'Nhận bố thí $200 từ người lạ.', action: 'cash', amount: 200 },
  { text: 'Ốm người thiêu, mất $50.', action: 'cash', amount: -50 },
  { text: 'Làm YouTube, nhận $50.', action: 'cash', amount: 50 },
  { text: 'Một lượt ra tù free. Giữ để dùng hoặc đem trao đổi.', action: 'jailfree' },
  { text: 'Cút luôn vào Tù.', action: 'gotojail' },
  { text: 'Tổ chức mừng thọ bản thân. Thu $50 từ mỗi người chơi.', action: 'collect_each', amount: 50 },
  { text: 'Quỹ đen bùng nổ. Bú $100.', action: 'cash', amount: 100 },
  { text: 'Trốn thuế. Thêm $20.', action: 'cash', amount: 20 },
  { text: 'Không phải người Thanh Hóa. $10 và 1 respect.', action: 'collect_each', amount: 10, weight:3 },
  { text: 'Bảo hiểm nhân thọ. Bú $100.', action: 'cash', amount: 100 },
  { text: 'Bắt Taxi đi viện mất $100.', action: 'cash', amount: -100 },
  { text: 'Đặt Xanh SM mất $150.', action: 'cash', amount: -150 },
  { text: 'Có người ném $25 vào mặt rồi 7 chọ.', action: 'cash', amount: 25 },
  { text: 'Phí bảo kê BĐS: $40/Nhá, $115/KS.', action: 'repairs', house:40, hotel:115 },
  { text: 'You thắng cược $10.', action: 'cash', amount: 10 },
  { text: 'You thừa kế $100 từ cháu họ.', action: 'cash', amount: 100 }
];

const TOKEN_COLORS = ['#E8613C', '#3E8FB0', '#8860D0', '#D4A72C', '#4FA187', '#D0668A', '#7A7F87', '#C9A227'];

// Grid position on an 11x11 board (row, col), used for CSS placement.
function tileGridPos(i){
  if (i <= 10) return { row: 11, col: 11 - i };       // bottom row, right to left (0=GO bottom-right, 10=Jail bottom-left)
  if (i <= 20) return { row: 11 - (i - 10), col: 1 }; // left column, bottom to top
  if (i <= 30) return { row: 1, col: 1 + (i - 20) };  // top row, left to right
  return { row: 1 + (i - 30), col: 11 };              // right column, top to bottom
}
