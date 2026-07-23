# Boardwalk Night 🎲

A free, browser-based board game (Monopoly-style) for you and your friends —
each person plays from their own phone or laptop, anywhere. Runs entirely on
GitHub Pages (static hosting) + a free Firebase Realtime Database for sync.
No servers to pay for, no domain needed.

## 1. One-time setup: Firebase (the "backend", free)

1. Go to https://console.firebase.google.com → **Add project** (you can decline Google Analytics, not needed).
2. In your project, open **Build → Realtime Database → Create Database**. Choose any region close to you, start in **test mode** for now.
3. Click the **gear icon → Project settings**, scroll to "Your apps", click the **`</>`** (web) icon, and register an app (nickname doesn't matter). It will show you a `firebaseConfig` object.
4. Open `js/firebase-config.js` in this project and paste your values into the matching fields (`apiKey`, `authDomain`, `databaseURL`, etc.). These values are safe to be public in client-side code — access is controlled by the Database Rules, not by hiding these.
5. Back in the Firebase console, go to **Realtime Database → Rules** and paste this, then **Publish**:
   ```json
   {
     "rules": {
       "rooms": {
         "$roomId": {
           ".read": true,
           ".write": true
         }
       }
     }
   }
   ```
   This is intentionally open (anyone with a room code can read/write that room) — fine for a private game with friends who you send the link to. Nobody can guess a 5-character room code, but if you want it locked down further later, Firebase Auth can be added.

## 2. Host it for free on GitHub Pages

1. Create a new GitHub repository (public or private both work with Pages on a free personal account, though private repos need GitHub Pro for Pages — public is simplest).
2. Push everything in this folder to that repo:
   ```bash
   cd monopoly
   git init
   git add .
   git commit -m "Boardwalk Night"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
3. In the repo, go to **Settings → Pages**. Under "Build and deployment", set **Source: Deploy from a branch**, **Branch: main / (root)**. Save.
4. After ~1 minute, your game is live at:
   `https://YOUR_USERNAME.github.io/YOUR_REPO/`

Send that link to your friends. Whoever creates a room gets a 5-letter code; everyone else clicks **Join a room** and types it in (or you can just share the URL directly after creating — it appends `#ROOMCODE` to the address, so pasting the exact link from your address bar drops them straight into the room name field... actually for now they still need to type the code once; see "nice-to-haves" below for auto-fill).

## 3. How to play

- One person picks **Create a room**, enters their name, picks max players, and shares the room code shown.
- Everyone else picks **Join a room** and enters that code + their name.
- While waiting, the **host** can toggle **House Rules** (everyone else sees the current settings, read-only):
  - **Require full color set to build houses** — ON is the standard rule (own the whole color group, then build anywhere on your turn). OFF is a house rule: you don't need the full set, but you can only build by physically landing on that exact property.
  - **Allow player trading** — lets anyone send a trade offer to anyone else, at any time, not just on their turn.
  - **Free Parking jackpot** — taxes collect into a pot; landing on Free Parking wins it.
- Once 2+ people have joined, the host clicks **Start Game**.
- Standard rules are implemented: buying properties, rent (including railroads and utilities), Chance/Community Chest cards, jail (pay $50 / use a card / roll for doubles), houses & hotels, mortgaging, passing GO, bankruptcy, and a win check.
- Tap any property tile (on the board, or via **My Properties**) to see its rent table and build/sell/mortgage.
- **Trades** (header button) works anytime, regardless of whose turn it is:
  - **Incoming** tab shows every open offer sent to you at once — Accept, Decline, or Counter each independently (leaving one alone = deciding later, it just stays in the list).
  - **Sent** tab shows your own outgoing offers, with a Cancel option while they're still pending.
  - **Propose a Trade** lets you pick a player, check off properties from each side, and set cash amounts (and Jail-Free cards, if either of you has one).
  - Trades are re-validated the moment someone hits Accept (so if a property was mortgaged, built on, or sold in the meantime, it'll tell you why the trade can't go through instead of silently breaking).

### What's intentionally simplified for v1 (good candidates for your house rules!)
- **No auction when a player declines to buy.** Real rules auction it off to everyone; right now it just stays unowned.
- **Even-building isn't enforced** (in real rules you must build houses evenly across a color group).
- Trading is properties + cash + Jail-Free cards only — no bundling with in-progress mortgages beyond a straight ownership transfer (the mortgage status moves with the property as-is).

## 4. Where to add your own house rules

The whole game logic lives in `js/game.js`, and it's organized as one function per event:
`resolveTile()`, `drawCard()`, `rollDice()`, `buyProperty()`, `buildHouse()`, `handleBankruptcy()`, etc.
Each one reads the room state from Firebase, computes an update, and writes it back — so to add a rule you generally:

1. Find the function tied to the moment your rule affects (e.g. "landing on Free Parking" → the `tile.type === 'free'` branch in `resolveTile()`).
2. Add your logic there (it can read `room.settings` for a toggle, same as `freeParkingJackpot`).
3. Add a `log(...)` line so everyone sees it happen in the sidebar feed.

Some easy first additions if you want ideas: double rent on full color-group monopolies even with 0 houses, a house rule for landing exactly on GO paying double salary, custom card decks (just edit `CHANCE_CARDS` / `CHEST_CARDS` in `js/board-data.js`), or shorter/longer games by changing `startingMoney` in `createRoom()`.

## 5. Project structure

```
monopoly/
├── index.html          screens: lobby / waiting room / game
├── css/style.css        all styling (mobile responsive included)
├── js/board-data.js      the 40 tiles, prices/rents, card decks
├── js/firebase-config.js  your Firebase credentials (fill this in!)
├── js/game.js             game engine — all state mutations happen here
└── js/ui.js               rendering + button wiring (reads state, paints DOM)
```

## 6. A note on names

Property/board names here are original (not the licensed ones from the physical board game) — feel free to rename them in `js/board-data.js` to inside jokes with your friend group; that's half the fun of house rules anyway.

## Troubleshooting
- **"Room not found"**: the Realtime Database URL in `firebase-config.js` is probably wrong, or Rules weren't published.
- **Nothing syncs between devices**: open your browser console (F12) and check for a Firebase permission error — usually means the Rules step above wasn't published yet.
- **Board looks huge/tiny on a phone**: it's built with CSS Grid + `minmax()`, should auto-fit, but if a specific device looks off, it's an easy tweak in the `@media (max-width: 860px)` block in `style.css`.
