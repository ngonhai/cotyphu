// sounds.js
// Simple sound-effect manager. Add new sounds by adding a key to SOUND_FILES,
// then call playSound('yourKey') anywhere in game.js / ui.js.
//
// Files live in /sounds/. Add the mp3 there, add one line below — no other
// setup needed.

const SOUND_FILES = {
  gameStart:       'sounds/game-start.mp3',
  jailIn:          'sounds/jail-in.mp3',
  jailOut:         'sounds/jail-out.mp3',
  diceRoll:        'sounds/roll-dice.mp3',

  buyProperty:     'sounds/buy-property-house.mp3',
  buyUtility:      'sounds/buy-property-utility.mp3' ,
  buyRailroad:     'sounds/buy-property-railway.mp3',

  sellHouse:         'sounds/sell-house.mp3',
  buildHouse:        'sounds/build-house.wav',
  mortgage:           'sounds/sell-property.mp3',
  unmortgage:         'sounds/unmortgage.mp3',
  sellPropertyToBank: 'sounds/sell-property.mp3',

  footstep:        'sounds/footstep.wav',
  cardGain:        'sounds/card-gain.mp3',
  cardLose:        'sounds/card-lose.mp3',
  landOnGo:           'sounds/land-on-go.mp3',
  landOnFreeParking:  'sounds/land-on-free-parking.mp3',
  fullSet:            'sounds/full-set.mp3',

  declineBuy:      'sounds/decline-buy.mp3',
  buttonHover:     'sounds/button-hover.wav'
};

// Preload everything up front so the first play() has no delay.
const _sounds = {};
for (const key in SOUND_FILES){
  const audio = new Audio(SOUND_FILES[key]);
  audio.preload = 'auto';
  _sounds[key] = audio;
}

// Master on/off switch, persisted so the player's mute choice survives reload.
let soundEnabled = localStorage.getItem('monopoly_sound_enabled') !== 'off';

function setSoundEnabled(enabled){
  soundEnabled = enabled;
  localStorage.setItem('monopoly_sound_enabled', enabled ? 'on' : 'off');
}

function playSound(key){
  if (!soundEnabled) return;
  const src = _sounds[key];
  if (!src){
    console.warn(`playSound: no sound registered for key "${key}"`);
    return;
  }
  // Cloning lets the same sound overlap itself (e.g. two rapid jail-ins)
  // instead of cutting off mid-play.
  const instance = src.cloneNode();
  instance.volume = src.volume;
  instance.play().catch(() => {
    // Browsers block audio.play() before the user has interacted with the
    // page at least once — this is expected on first load and safe to ignore.
  });
}
