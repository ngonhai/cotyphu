// firebase-config.js
//
// 1. Go to https://console.firebase.google.com -> Add project (free, no card needed).
// 2. In the project, click "Build > Realtime Database" -> Create Database -> start in TEST MODE
//    (we tighten the rules below in step 4).
// 3. Click the gear icon > Project settings > scroll to "Your apps" > click the web icon (</>)
//    to register a web app. Copy the config object it gives you and paste the values below.
// 4. In Realtime Database > Rules, paste this (lets any client read/write only inside /rooms,
//    which is fine for a small private game with friends):
//
//   {
//     "rules": {
//       "rooms": {
//         "$roomId": {
//           ".read": true,
//           ".write": true
//         }
//       }
//     }
//   }
//
// 5. Fill in the values below with YOUR project's config (safe to be public in client code -
//    these are not secret keys, access is controlled by the Database Rules above).

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
