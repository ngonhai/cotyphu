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
    "{name} looks at {tile} and decides to pass.",
    "{name} isn't interested in {tile} — passes it up.",
    "{name} could buy {tile}, but chooses not to.",
    "{name} takes a pass on {tile}."
  ],

  // declineBuy(): player didn't have enough cash to buy, even if they wanted to.
  declineBuy_cantAfford: [
    "{name} can't afford {tile} and has to pass.",
    "{name} doesn't have the cash for {tile} — no choice but to pass.",
    "{name} is short on funds and lets {tile} go.",
    "Not enough in the bank — {name} passes on {tile}."
  ],

  // resolveTile(): rent that leaves the payer in real trouble (see the bigHit
  // check next to where this is used in game.js).
  rent_bigHit: [
    "{name} pays ${amount} rent to {owner} on {tile} — that one hurt.",
    "Ouch — {name} hands {owner} ${amount} rent on {tile}, and it shows.",
    "{name} pays a painful ${amount} rent on {tile}, owned by {owner}.",
    "{name} is left reeling after paying {owner} ${amount} rent on {tile}."
  ],

  // resolveTile(): an ordinary, easily-affordable rent payment.
  rent_minor: [
    "{name} pays ${amount} rent to {owner} on {tile}.",
    "{name} covers the ${amount} rent on {tile} (owned by {owner}) without much trouble.",
    "A light ${amount} rent for {name} on {tile}, owned by {owner}."
  ],

  // sendToJail(): reason is whatever string was passed to sendToJail(uid, reason).
  sentToJail: [
    "{name} gets hauled off to jail ({reason}).",
    "Busted — {name} is sent to jail ({reason}).",
    "{name} lands themselves in jail ({reason})."
  ],

  // Player's money hits negative and they hit the "Declare Bankruptcy" button.
  bankruptcy: [
    "💥 {name} is wiped out and declares bankruptcy!",
    "💥 It's over for {name} — bankruptcy.",
    "💥 {name} can't recover and goes bankrupt."
  ],

  // Only one active (non-bankrupt) player remains.
  gameWin: [
    "🏆 {name} takes the whole board — victory!",
    "🏆 {name} wins it all!",
    "🏆 Last one standing: {name} wins!"
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
