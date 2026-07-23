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
  apiKey: "AIzaSyCNWhZlKjyVQR7O93GGO21k-ZedF99MYiM",
  authDomain: "monopoly-407c8.firebaseapp.com",
  databaseURL: "https://monopoly-407c8-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "monopoly-407c8",
  storageBucket: "monopoly-407c8.firebasestorage.app",
  messagingSenderId: "168413879724",
  appId: "1:168413879724:web:fa97126c00f85264caee09",
  measurementId: "G-HM97CEJNCT"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
