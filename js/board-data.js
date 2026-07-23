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
  { i:0,  type:'go',        name:'GO' },
  { i:1,  type:'property',  name:'Willow Court',      group:'brown', price:60,  rent:[2,10,30,90,160,250],  house:50 },
  { i:2,  type:'chest',     name:'Community Chest' },
  { i:3,  type:'property',  name:'Cedar Lane',        group:'brown', price:60,  rent:[4,20,60,180,320,450], house:50 },
  { i:4,  type:'tax',       name:'Income Tax',        amount:200 },
  { i:5,  type:'railroad',  name:'Union Station',     price:200, rent:[25,50,100,200] },
  { i:6,  type:'property',  name:'Birch Avenue',      group:'lightblue', price:100, rent:[6,30,90,270,400,550], house:50 },
  { i:7,  type:'chance',    name:'Chance' },
  { i:8,  type:'property',  name:'Spruce Avenue',     group:'lightblue', price:100, rent:[6,30,90,270,400,550], house:50 },
  { i:9,  type:'property',  name:'Magnolia Avenue',   group:'lightblue', price:120, rent:[8,40,100,300,450,600], house:50 },
  { i:10, type:'jail',      name:'Jail / Just Visiting' },
  { i:11, type:'property',  name:'Rosewood Boulevard',group:'pink', price:140, rent:[10,50,150,450,625,750], house:100 },
  { i:12, type:'utility',   name:'Power Co.',         price:150 },
  { i:13, type:'property',  name:'Tulip Way',         group:'pink', price:140, rent:[10,50,150,450,625,750], house:100 },
  { i:14, type:'property',  name:'Camellia Court',    group:'pink', price:160, rent:[12,60,180,500,700,900], house:100 },
  { i:15, type:'railroad',  name:'Central Station',   price:200, rent:[25,50,100,200] },
  { i:16, type:'property',  name:'Harbor View',       group:'orange', price:180, rent:[14,70,200,550,750,950], house:100 },
  { i:17, type:'chest',     name:'Community Chest' },
  { i:18, type:'property',  name:'Bayside Drive',     group:'orange', price:180, rent:[14,70,200,550,750,950], house:100 },
  { i:19, type:'property',  name:'Lighthouse Lane',   group:'orange', price:200, rent:[16,80,220,600,800,1000], house:100 },
  { i:20, type:'free',      name:'Free Parking' },
  { i:21, type:'property',  name:'Falcon Street',     group:'red', price:220, rent:[18,90,250,700,875,1050], house:150 },
  { i:22, type:'chance',    name:'Chance' },
  { i:23, type:'property',  name:'Eagle Avenue',      group:'red', price:220, rent:[18,90,250,700,875,1050], house:150 },
  { i:24, type:'property',  name:'Hawk Boulevard',    group:'red', price:240, rent:[20,100,300,750,925,1100], house:150 },
  { i:25, type:'railroad',  name:'Riverside Station', price:200, rent:[25,50,100,200] },
  { i:26, type:'property',  name:'Golden Gate Way',   group:'yellow', price:260, rent:[22,110,330,800,975,1150], house:150 },
  { i:27, type:'property',  name:'Sunset Boulevard',  group:'yellow', price:260, rent:[22,110,330,800,975,1150], house:150 },
  { i:28, type:'utility',   name:'Water Co.',         price:150 },
  { i:29, type:'property',  name:'Sunrise Avenue',    group:'yellow', price:280, rent:[24,120,360,850,1025,1200], house:150 },
  { i:30, type:'gotojail',  name:'Go To Jail' },
  { i:31, type:'property',  name:'Maple Grove',       group:'green', price:300, rent:[26,130,390,900,1100,1275], house:200 },
  { i:32, type:'property',  name:'Oakridge Drive',    group:'green', price:300, rent:[26,130,390,900,1100,1275], house:200 },
  { i:33, type:'chest',     name:'Community Chest' },
  { i:34, type:'property',  name:'Pinecrest Lane',    group:'green', price:320, rent:[28,150,450,1000,1200,1400], house:200 },
  { i:35, type:'railroad',  name:'Lakeside Station',  price:200, rent:[25,50,100,200] },
  { i:36, type:'chance',    name:'Chance' },
  { i:37, type:'property',  name:'Emerald Tower',     group:'darkblue', price:350, rent:[35,175,500,1100,1300,1500], house:200 },
  { i:38, type:'tax',       name:'Luxury Tax',        amount:100 },
  { i:39, type:'property',  name:'Diamond Plaza',     group:'darkblue', price:400, rent:[50,200,600,1400,1700,2000], house:200 }
];

const CHANCE_CARDS = [
  { text: 'Advance to GO. Collect $200.', action: 'goto', to: 0, collectGo:true },
  { text: 'Advance to Diamond Plaza.', action: 'goto', to: 39 },
  { text: 'Advance to Rosewood Boulevard. If you pass GO, collect $200.', action: 'goto', to: 11, collectGo:true },
  { text: 'Advance to the nearest Railroad. Pay double rent if owned.', action: 'nearest_rail' },
  { text: 'Bank pays you a dividend of $50.', action: 'cash', amount: 50 },
  { text: 'Get out of Jail Free. This card can be kept until needed.', action: 'jailfree' },
  { text: 'Go back 3 spaces.', action: 'move', amount: -3 },
  { text: 'Go directly to Jail. Do not collect $200.', action: 'gotojail' },
  { text: 'Make general repairs: pay $25 per house, $100 per hotel.', action: 'repairs', house:25, hotel:100 },
  { text: 'Pay a $15 fine.', action: 'cash', amount: -15 },
  { text: 'Advance to the nearest Utility.', action: 'nearest_utility' },
  { text: 'You have been elected board president. Pay each player $50.', action: 'pay_each', amount: 50 },
  { text: 'Your building loan matures. Collect $150.', action: 'cash', amount: 150 },
  { text: 'You have won a crossword competition. Collect $100.', action: 'cash', amount: 100 },
  { text: 'Take a trip to Central Station.', action: 'goto', to: 15, collectGo:true },
  { text: 'Advance to Birch Avenue. If you pass GO, collect $200.', action: 'goto', to: 6, collectGo:true }
];

const CHEST_CARDS = [
  { text: 'Advance to GO. Collect $200.', action: 'goto', to: 0, collectGo:true },
  { text: 'Bank error in your favor. Collect $200.', action: 'cash', amount: 200 },
  { text: 'Doctor\'s fees. Pay $50.', action: 'cash', amount: -50 },
  { text: 'From sale of stock you get $50.', action: 'cash', amount: 50 },
  { text: 'Get out of Jail Free. This card can be kept until needed.', action: 'jailfree' },
  { text: 'Go directly to Jail. Do not collect $200.', action: 'gotojail' },
  { text: 'Grand Opera Night. Collect $50 from every player.', action: 'collect_each', amount: 50 },
  { text: 'Holiday fund matures. Collect $100.', action: 'cash', amount: 100 },
  { text: 'Income tax refund. Collect $20.', action: 'cash', amount: 20 },
  { text: 'It is your birthday. Collect $10 from every player.', action: 'collect_each', amount: 10 },
  { text: 'Life insurance matures. Collect $100.', action: 'cash', amount: 100 },
  { text: 'Pay hospital fees of $100.', action: 'cash', amount: -100 },
  { text: 'Pay school fees of $150.', action: 'cash', amount: -150 },
  { text: 'Receive $25 consultancy fee.', action: 'cash', amount: 25 },
  { text: 'You are assessed for street repair: $40 per house, $115 per hotel.', action: 'repairs', house:40, hotel:115 },
  { text: 'You have won second prize in a contest. Collect $10.', action: 'cash', amount: 10 },
  { text: 'You inherit $100.', action: 'cash', amount: 100 }
];

const TOKEN_COLORS = ['#E8613C', '#3E8FB0', '#8860D0', '#D4A72C', '#4FA187', '#D0668A', '#7A7F87', '#C9A227'];

// Grid position on an 11x11 board (row, col), used for CSS placement.
function tileGridPos(i){
  if (i <= 10) return { row: 11, col: 11 - i };       // bottom row, right to left (0=GO bottom-right, 10=Jail bottom-left)
  if (i <= 20) return { row: 11 - (i - 10), col: 1 }; // left column, bottom to top
  if (i <= 30) return { row: 1, col: 1 + (i - 20) };  // top row, left to right
  return { row: 1 + (i - 30), col: 11 };              // right column, top to bottom
}
