import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBMaN2qVdHiRSAqwcv4zHtQVuSRx5XCzwk",
  authDomain: "shopping-list-394a1.firebaseapp.com",
  projectId: "shopping-list-394a1",
  storageBucket: "shopping-list-394a1.firebasestorage.app",
  messagingSenderId: "267434270849",
  appId: "1:267434270849:web:fd9a0e39a8029baef7ed80"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();