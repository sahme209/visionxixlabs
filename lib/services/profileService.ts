import { doc, getDoc, onSnapshot, Unsubscribe } from "firebase/firestore";
import { db } from "../firebase";
import { User } from "firebase/auth";

export interface UserProfile {
  formType: string;
  priorityDate: string;
  country: string;
  receiptNumber?: string;
  serviceCenter?: string;
  processingPath?: string; // "Consular" or "AOS"
  currentStage?: string; // "uscis", "approved", "nvc", "dq", "medical", "interview", "visaIssued"
  completed: boolean;
}

export interface ProfileLoadState {
  status: "idle" | "loading" | "ready" | "missing" | "error";
  profile: UserProfile | null;
  error?: string;
}

/**
 * Load user profile from Firestore
 * Matches iOS ProfileDataService pattern
 */
export async function loadUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const profileRef = doc(db, "userProfiles", userId);
    const profileSnap = await getDoc(profileRef);
    
    if (!profileSnap.exists()) {
      return null;
    }
    
    const data = profileSnap.data();
    return {
      formType: data.formType || "",
      priorityDate: data.priorityDate || "",
      country: data.country || "",
      receiptNumber: data.receiptNumber || "",
      serviceCenter: data.serviceCenter || "",
      processingPath: data.processingPath || "Consular",
      currentStage: data.currentStage || "uscis",
      completed: data.completed || false,
    };
  } catch (error) {
    console.error("Error loading profile:", error);
    throw error;
  }
}

/**
 * Subscribe to profile changes (for real-time updates)
 */
export function subscribeToProfile(
  userId: string,
  callback: (profile: UserProfile | null) => void
): Unsubscribe {
  if (!userId || userId.trim() === "") {
    console.warn("[ProfileService] Empty userId provided to subscribeToProfile");
    callback(null);
    return () => {}; // Return no-op unsubscribe
  }

  const profileRef = doc(db, "userProfiles", userId);
  
  return onSnapshot(
    profileRef,
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      
      const data = snap.data();
      callback({
        formType: data.formType || "",
        priorityDate: data.priorityDate || "",
        country: data.country || "",
        receiptNumber: data.receiptNumber || "",
        serviceCenter: data.serviceCenter || "",
        processingPath: data.processingPath || "Consular",
        currentStage: data.currentStage || "uscis",
        completed: data.completed || false,
      });
    },
    (error: any) => {
      const isPermissionError =
        error?.code === "permission-denied" ||
        (typeof error?.message === "string" &&
          (error.message.toLowerCase().includes("permission") ||
            error.message.toLowerCase().includes("insufficient")));
      
      if (isPermissionError) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[ProfileService] Permission denied for userProfiles, profile unavailable");
        }
      } else {
        console.error("[ProfileService] Error subscribing to profile:", error);
      }
      callback(null);
    }
  );
}
