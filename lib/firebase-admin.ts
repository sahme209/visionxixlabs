import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";

let adminApp: App | null = null;
let adminDb: Firestore | null = null;
let adminAuth: Auth | null = null;

function getAdminDb(): Firestore {
  if (adminDb) {
    return adminDb;
  }

  // Initialize Firebase Admin SDK
  if (!adminApp) {
    if (!getApps().length) {
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
      
      // Use service account key from environment variable (recommended for production)
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        try {
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
          adminApp = initializeApp({
            credential: cert(serviceAccount),
            projectId: serviceAccount.project_id || projectId,
          });
        } catch (error) {
          console.error("Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:", error);
          throw new Error("Failed to initialize Firebase Admin SDK: Invalid service account key");
        }
      } else if (projectId) {
        // If no service account key, but we have project ID, try to initialize with project ID
        // This will use Application Default Credentials if available
        try {
          adminApp = initializeApp({
            projectId: projectId,
          });
        } catch (error) {
          console.error("Error initializing Firebase Admin SDK with project ID:", error);
          throw new Error("Failed to initialize Firebase Admin SDK: Please provide FIREBASE_SERVICE_ACCOUNT_KEY environment variable");
        }
      } else {
        throw new Error("Firebase Admin SDK initialization failed: Missing FIREBASE_SERVICE_ACCOUNT_KEY or NEXT_PUBLIC_FIREBASE_PROJECT_ID environment variable");
      }
    } else {
      adminApp = getApps()[0];
    }
  }

  adminDb = getFirestore(adminApp);
  return adminDb;
}

function getAdminAuth(): Auth {
  if (adminAuth) {
    return adminAuth;
  }

  // Initialize Firebase Admin SDK if not already initialized
  if (!adminApp) {
    getAdminDb(); // This will initialize adminApp
  }

  adminAuth = getAuth(adminApp!);
  return adminAuth;
}

export { getAdminDb, getAdminAuth };
