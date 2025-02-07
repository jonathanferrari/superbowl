// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB2KO3xPA-Ys4FowuVtXx0PsLnPbOs8n-k",
  authDomain: "squares-sb.firebaseapp.com",
  projectId: "squares-sb",
  storageBucket: "squares-sb.firebasestorage.app",
  messagingSenderId: "1049103252546",
  appId: "1:1049103252546:web:7b151a8a29af7f942fc1db",
  measurementId: "G-JSLRXR4EZQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db, analytics };
