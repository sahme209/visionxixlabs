import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase - works on both client and server
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

// Initialize Firebase (works on both client and server in Next.js)
// Only initialize if we have valid config (prevents build-time errors)
const hasValidConfig = firebaseConfig.apiKey && 
  firebaseConfig.authDomain && 
  firebaseConfig.projectId;

if (hasValidConfig) {
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }

    // Always initialize auth and db (they work on server-side in Next.js API routes)
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    // During build time, Firebase might not be available
    // Create dummy instances to prevent TypeScript errors
    // These will be replaced at runtime
    const dummyConfig = {
      apiKey: "dummy",
      authDomain: "dummy",
      projectId: "dummy",
    };
    app = initializeApp(dummyConfig, "dummy");
    auth = getAuth(app);
    db = getFirestore(app);
  }
} else {
  // Fallback for build time when env vars are not set
  const dummyConfig = {
    apiKey: "dummy",
    authDomain: "dummy",
    projectId: "dummy",
  };
  app = initializeApp(dummyConfig, "dummy");
  auth = getAuth(app);
  db = getFirestore(app);
}

export { auth, db };
