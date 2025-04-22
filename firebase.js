// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAwMtxFN4-CpFbQ8XynsmV4rIHRMlf_PI0",
  authDomain: "darkmagicdueling-785af.firebaseapp.com",
  projectId: "darkmagicdueling-785af",
  storageBucket: "darkmagicdueling-785af.firebasestorage.app",
  messagingSenderId: "556777022448",
  appId: "1:556777022448:web:177acc2cdacb86f1bdb335"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db, app };
