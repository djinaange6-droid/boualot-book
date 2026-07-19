import { initializeApp } from "firebase/app";
// Importe les services Firebase dont ton application a besoin (ex: Auth, Firestore)
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Récupération sécurisée des clés depuis ton fichier .env
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialisation de Firebase
const app = initializeApp(firebaseConfig);

// Exportation des services pour pouvoir les utiliser partout dans tes composants (ex: App.tsx)
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;