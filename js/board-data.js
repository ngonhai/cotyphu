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
  { i:0,  type:'go',        name:'Về Quê' },
  { i:1,  type:'property',  name:'Đại học Lâm nghiệp',      group:'brown', price:60,  rent:[2,10,30,90,160,250],  house:50 },
  { i:2,  type:'chest',     name:'Bất Ngờ' },
  { i:3,  type:'property',  name:'Đại học Nông nghiệp',        group:'brown', price:60,  rent:[4,20,60,180,320,450], house:50 },
  { i:4,  type:'tax',       name:'Tiền Học lại',        amount:200,  taxKind:'income'},
  { i:5,  type:'railroad',  name:'GS25',     price:200, rent:[25,50,100,200] },
  { i:6,  type:'property',  name:'Đại học Hà Nội',      group:'lightblue', price:100, rent:[6,30,90,270,400,550], house:50 },
  { i:7,  type:'chance',    name:'Cơ Hội' },
  { i:8,  type:'property',  name:'Đại học Khoa học Xã hội & Nhân văn',     group:'lightblue', price:100, rent:[6,30,90,270,400,550], house:50 },
  { i:9,  type:'property',  name:'Đại học Kiến trúc Hà Nội',   group:'lightblue', price:120, rent:[8,40,100,300,450,600], house:50 },
  { i:10, type:'jail',      name:'học Quân sự' },
  { i:11, type:'property',  name:'Học viện Ngân hàng',group:'pink', price:140, rent:[10,50,150,450,625,750], house:100 },
  { i:12, type:'utility',   name:'Trà đá Cổng Trường',         price:150 },
  { i:13, type:'property',  name:'Đại học Thủy lợi',         group:'pink', price:140, rent:[10,50,150,450,625,750], house:100 },
  { i:14, type:'property',  name:'Đại học Công đoàn',    group:'pink', price:160, rent:[12,60,180,500,700,900], house:100 },
  { i:15, type:'railroad',  name:'CircleK',   price:200, rent:[25,50,100,200] },
  { i:16, type:'property',  name:'Đại học Thương mại',       group:'orange', price:180, rent:[14,70,200,550,750,950], house:100 },
  { i:17, type:'chest',     name:'Bất Ngờ' },
  { i:18, type:'property',  name:'Đại học Công nghiệp Hà Nội',     group:'orange', price:180, rent:[14,70,200,550,750,950], house:100 },
  { i:19, type:'property',  name:'Đại học Sư phạm Hà Nội',   group:'orange', price:200, rent:[16,80,220,600,800,1000], house:100 },
  { i:20, type:'free',      name:'Học Bổng' },
  { i:21, type:'property',  name:'Đại học Ngoại thương',     group:'red', price:220, rent:[18,90,250,700,875,1050], house:150 },
  { i:22, type:'chance',    name:'Cơ Hội' },
  { i:23, type:'property',  name:'Học viện Ngoại giao',      group:'red', price:220, rent:[18,90,250,700,875,1050], house:150 },
  { i:24, type:'property',  name:'Đại học Luật Hà Nội',    group:'red', price:240, rent:[20,100,300,750,925,1100], house:150 },
  { i:25, type:'railroad',  name:'Mixue', price:200, rent:[25,50,100,200] },
  { i:26, type:'property',  name:'Đại học Bách khoa Hà Nội',   group:'yellow', price:260, rent:[22,110,330,800,975,1150], house:150 },
  { i:27, type:'property',  name:'Đại học Kinh tế Quốc dân',  group:'yellow', price:260, rent:[22,110,330,800,975,1150], house:150 },
  { i:28, type:'utility',   name:'Căng-tin Trường',         price:150 },
  { i:29, type:'property',  name:'Đại học Xây dựng Hà Nội',    group:'yellow', price:280, rent:[24,120,360,850,1025,1200], house:150 },
  { i:30, type:'gotojail',  name:'Ra Đảo Quân sự' },
  { i:31, type:'property',  name:'Đại học Y Hà Nội',       group:'green', price:300, rent:[26,130,390,900,1100,1275], house:200 },
  { i:32, type:'property',  name:'Đà Đại học Dược Hà Nội',    group:'green', price:300, rent:[26,130,390,900,1100,1275], house:200 },
  { i:33, type:'chest',     name:'Túi Mù May Mắn' },
  { i:34, type:'property',  name:'Học viện Y Dược học Cổ truyền',    group:'green', price:320, rent:[28,150,450,1000,1200,1400], house:200 },
  { i:35, type:'railroad',  name:'Bingxue',  price:200, rent:[25,50,100,200] },
  { i:36, type:'chance',    name:'Vận May' },
  { i:37, type:'property',  name:'Đại học VinUni',     group:'darkblue', price:350, rent:[35,175,500,1100,1300,1500], house:200 },
  { i:38, type:'tax',       name:'Học phí Học kỳ',        amount:100,  taxKind:'luxury'},
  { i:39, type:'property',  name:'Đại học RMIT',     group:'darkblue', price:400, rent:[50,200,600,1400,1700,2000], house:200 }
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
//   { text: 'Pay a $15 fine', action: 'cash', amount: -15, weight: 3 }
//   { text: 'Advance to GO. Collect $200', action: 'goto', to: 0, collectGo:true, weight: 0.5 }
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
//   'choose_tile'     { collectGo? }             rare! the player picks ANY tile on the board to teleport
//                                                 to themselves (via a click-to-choose overlay), instead of
//                                                 the game picking a fixed destination. collectGo:true awards
//                                                 $200 if the tile they pick happens to be "before" their
//                                                 current position (i.e. they'd pass GO to get there).
//
// Example — add a new Chance card that gives the player $75:
//   { text: 'You found $75 on the sidewalk', action: 'cash', amount: 75 }
//
// Want a brand-new *type* of effect (not listed above)? Add a new `case 'yourAction':`
// branch inside the `drawCard()` function in js/game.js, following the same pattern as
// the existing cases (read `room`/`player`, compute `updates`, write with roomRef().update(),
// then call `await finishAction(uid);` at the end so doubles/turn-passing still works correctly).
// ---------------------------------------------------------------------------

const CHANCE_CARDS = [
  { text: 'Về Quê ăn Tết. Nhận 200k₫', action: 'goto', to: 0, collectGo:true },
  { text: 'Tốc biến đến RMIT', action: 'goto', to: 39, weight:0.2 },
  { text: 'Nhảy đến Học viện Ngân hàng', action: 'goto', to: 11, collectGo:true },
  { text: 'Đến cửa hàng gần nhất', action: 'nearest_rail' },
  { text: 'Nhặt được 50k₫ gần Cầu Giấy', action: 'cash', amount: 50 },
  { text: 'Học lại KTCT Mác-Lênin tốn 60k₫', action: 'cash', amount: -60 },
  { text: 'Một lượt-ra-ngoài free. Giữ để dùng hoặc đem trao đổi', action: 'jailfree' },
  { text: 'Lùi 3 bước', action: 'move', amount: -3 },
  { text: 'Chỉ là học Quân sự thôi', action: 'gotojail', weight:0.8 },
  { text: 'Bị phát hiện mang theo công nghệ in ấn đi thi CK. Cút luôn vào \'Tù\'', action: 'gotojail', weight:0.8 },
  { text: 'Nộp phí bảo kê cho BĐS: 25k₫/Nhà, 100k₫/CS2', action: 'repairs', house:25, hotel:100 },
  { text: 'Bị hai ngón 50k₫', action: 'cash', amount: -50, weight:1.2 },
  { text: 'Lùi 1 bước. Tiến 3 bước', action: 'move', amount: 2 },
  { text: 'Khát quá! Đến chỗ ăn uống gần nhất', action: 'nearest_utility' },
  { text: 'Chủ nhật rảnh rỗi quá. Cho mỗi người chơi 50k₫', action: 'pay_each', amount: 50 },
  { text: 'Họ rủ đi chơi mà từ chối, bù mỗi người chơi 150k₫', action: 'pay_each', amount: 150, weight:0.01 },
  { text: 'Chúa thương tình, phát lúa cho mình 150k₫', action: 'cash', amount: 150, weight:0.8 },
  { text: 'Ngừng lọ 1 hôm. Bú 100k₫ từ cô giáo', action: 'cash', amount: 100 },
  { text: 'Đi đến Circle K mua ít đồ', action: 'goto', to: 15, collectGo:true },
  { text: 'Đi đến Đại học Hà Nội', action: 'goto', to: 6, collectGo:true },
  { text: '✨ Hà Nội Tour! Chọn BẤT KỲ ô nào trên bàn và teleport đến ✨', action: 'choose_tile', collectGo:true, weight:0.005 }
];

const CHEST_CARDS = [
  { text: 'Về Quê ăn Tết. Nhận 200k₫', action: 'goto', to: 0, collectGo:true },
  { text: 'Về Quê nghỉ hè. Nhận 200k₫', action: 'goto', to: 0, collectGo:true },
  { text: 'Nhận bố thí 200k₫ từ người lạ', action: 'cash', amount: 200 },
  { text: 'Học lại KTCT Mác-Lênin tốn 60k₫', action: 'cash', amount: -60 },
  { text: 'Ốm người thiêu, mất 50k₫', action: 'cash', amount: -50 },
  { text: 'Đô nết kênh MixiGaming 200k₫', action: 'cash', amount: -200, weight:0.5 },
  { text: 'Từ chốn Linh Lang, sang động Đình Thôn. Thế mà tiêu mỗi 200k₫', action: 'cash', amount: -200, weight:0.5 },
  { text: 'Làm YouTube, nhận 50k₫ donate', action: 'cash', amount: 50 },
  { text: 'Làm hộ bài, bú 50k₫', action: 'cash', amount: 50 },
  { text: 'Một lượt-ra-ngoài của khu Quân sự free. Giữ để dùng hoặc đem trao đổi', action: 'jailfree' },
  { text: 'Cút luôn vào khu Quân sự', action: 'gotojail', weight:1.1 },
  { text: 'Tổ chức mừng thọ bản thân. Thu 50k₫ từ mỗi người chơi', action: 'collect_each', amount: 50 },
  { text: 'Bị mỗi người ném 100k₫ vào mặt', action: 'collect_each', amount: 100, weight:0.3 },
  { text: 'Bị mọi người chơi some, thu mỗi 150k₫', action: 'collect_each', amount: 150, weight:0.01 },
  { text: 'Chơi some mọi người, trả mỗi người 150k₫', action: 'pay_each', amount: 150, weight:0.01 },
  { text: 'Bao trà sữa cho bạn bè 50k₫/mạng', action: 'pay_each', amount: 50, weight:0.4 },
  { text: 'Mời mọi người bún đậu ở quán đường Nguyễn Ngọc Vũ 50k₫/mạng', action: 'pay_each', amount: 50, weight:0.4 },
  { text: 'Thủng săm trên đường, sửa xe mất 70k₫', action: 'cash', amount: -70, weight:0.6 },
  { text: 'Đi xe buýt, bị móc đuýt. -50k₫', action: 'cash', amount: -50, weight:0.7 },
  { text: 'Quỹ Nỗi-Buồn-Trượt-Môn quyên tặng 100k₫', action: 'cash', amount: 100 },
  { text: 'Trốn thuế. Thêm 20k₫', action: 'cash', amount: 20 },
  { text: 'Không phải người Thanh Hóa. Nhận 36k₫ và 1 respect', action: 'cash', amount: 36 },
  { text: 'Hỗ trợ học lại. Nhận mỗi người 10k₫', action: 'collect_each', amount: 10, weight:3 },
  { text: 'Bảo hiểm nhân thọ. Bú 100k₫', action: 'cash', amount: 100, weight:0.9 },
  { text: 'Đi hiến máu tình nguyện. Làm quà nho nhỏ 50k₫', action: 'cash', amount: 50 },
  { text: 'Bắt Taxi đi thi sáng mất 50k₫', action: 'cash', amount: -50 },
  { text: 'Đêm qua chơi đậm sâu! Nay tốn 100k₫ đi khám', action: 'cash', amount: -100 },
  { text: 'Đặt Xanh SM mất 150k₫', action: 'cash', amount: -150, weight:0.03 },
  { text: 'Cháy nhà trọ. May mà chỉ mất 100k₫', action: 'cash', amount: -100, weight:0.9 },
  { text: 'Có người ném 25k₫ vào mặt rồi 7 chọ', action: 'cash', amount: 25 },
  { text: 'Phí bảo kê BĐS: 40k₫/Nhà, 115k₫/CS2', action: 'repairs', house:40, hotel:115, weight:0.4 },
  { text: 'Tiền sinh lời từ mặt bằng: 35k₫/Nhà, 110k₫/CS2', action: 'repairs', house:-35, hotel:-110, weight:0.4 },
  { text: 'Đánh con 36, về con 63. Mất cmn 10k₫', action: 'cash', amount: -10, weight:2 },
  { text: 'Mua combo gà rán 59k₫', action: 'cash', amount: -59, weight:0.8 },
  { text: 'Đi làm thêm. Nhận 100k₫', action: 'cash', amount: 100, weight:0.9 },
  { text: 'Thừa kế 100k₫ từ cháu họ', action: 'cash', amount: 100 }
];

const TOKEN_COLORS = ['#E8613C', '#3E8FB0', '#8860D0', '#D4A72C', '#4FA187', '#D0668A', '#7A7F87', '#C9A227', '#303841'];

// Purely cosmetic — shown centered on a player's token, chosen for fun at the lobby
// screen (see renderTokenCustomizer() in ui.js). '' is the first option, meaning "no
// expression, just the plain color dot" — kept as a real selectable choice (not just
// an implicit default) so it always renders in the same picker grid as everything else.
const TOKEN_EMOJIS = ['', '😎','🤓','🥰','🥳','🤑','🤖','👽','🥴','😠','🫨','🙂‍↕️','🤫','🫢','🫣','🐶','🫠','😎'];

// Grid position on an 11x11 board (row, col), used for CSS placement.
function tileGridPos(i){
  if (i <= 10) return { row: 11, col: 11 - i };       // bottom row, right to left (0=GO bottom-right, 10=Jail bottom-left)
  if (i <= 20) return { row: 11 - (i - 10), col: 1 }; // left column, bottom to top
  if (i <= 30) return { row: 1, col: 1 + (i - 20) };  // top row, left to right
  return { row: 1 + (i - 30), col: 11 };              // right column, top to bottom
}
