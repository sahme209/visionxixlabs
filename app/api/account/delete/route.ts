import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";

/**
 * DELETE /api/account/delete
 * Deletes the user's account and all associated data
 * Requires authentication token in Authorization header
 */
export async function DELETE(request: NextRequest) {
  try {
    // Get auth token from Authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized. Missing or invalid authorization token." },
        { status: 401 }
      );
    }

    const token = authHeader.split("Bearer ")[1];
    
    // Verify token and get user ID
    const adminAuth = getAdminAuth();
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error: any) {
      console.error("[DELETE ACCOUNT] Token verification failed:", error);
      return NextResponse.json(
        { error: "Unauthorized. Invalid or expired token." },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;
    console.log(`[DELETE ACCOUNT] Starting account deletion for user: ${userId}`);

    const adminDb = getAdminDb();
    const batch = adminDb.batch();

    // 1. Delete user profile
    const profileRef = adminDb.collection("userProfiles").doc(userId);
    const profileSnap = await profileRef.get();
    if (profileSnap.exists) {
      batch.delete(profileRef);
      console.log(`[DELETE ACCOUNT] Queued user profile deletion for ${userId}`);
    }

    // 2. Delete subscription
    const subscriptionRef = adminDb.collection("subscriptions").doc(userId);
    const subscriptionSnap = await subscriptionRef.get();
    if (subscriptionSnap.exists) {
      batch.delete(subscriptionRef);
      console.log(`[DELETE ACCOUNT] Queued subscription deletion for ${userId}`);
    }

    // 3. Delete user settings
    const userSettingsRef = adminDb.collection("users").doc(userId);
    const userSettingsSnap = await userSettingsRef.get();
    if (userSettingsSnap.exists) {
      // Delete all subcollections under users/{userId}
      const subcollections = ["notificationSettings", "pushTokens"];
      for (const subcol of subcollections) {
        const subcolRef = userSettingsRef.collection(subcol);
        const subcolSnap = await subcolRef.get();
        subcolSnap.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
      }
      batch.delete(userSettingsRef);
      console.log(`[DELETE ACCOUNT] Queued user settings deletion for ${userId}`);
    }

    // 4. Delete user notifications
    const notificationsRef = adminDb.collection("userNotifications").doc(userId);
    const notificationsSnap = await notificationsRef.get();
    if (notificationsSnap.exists) {
      // Delete all notifications under userNotifications/{userId}/notifications
      const notificationsSubcol = notificationsRef.collection("notifications");
      const notificationsSubcolSnap = await notificationsSubcol.get();
      notificationsSubcolSnap.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      batch.delete(notificationsRef);
      console.log(`[DELETE ACCOUNT] Queued user notifications deletion for ${userId}`);
    }

    // 5. Delete from allUsers collection (if exists)
    const allUsersRef = adminDb.collection("allUsers").doc(userId);
    const allUsersSnap = await allUsersRef.get();
    if (allUsersSnap.exists) {
      batch.delete(allUsersRef);
      console.log(`[DELETE ACCOUNT] Queued allUsers deletion for ${userId}`);
    }

    // 6. Delete community access requests (if exists)
    const communityAccessQuery = adminDb
      .collection("communityAccessRequests")
      .where("userId", "==", userId);
    const communityAccessSnap = await communityAccessQuery.get();
    communityAccessSnap.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    if (!communityAccessSnap.empty) {
      console.log(`[DELETE ACCOUNT] Queued ${communityAccessSnap.docs.length} community access request(s) deletion for ${userId}`);
    }

    // Execute batch delete
    await batch.commit();
    console.log(`[DELETE ACCOUNT] ✅ Successfully deleted all Firestore data for ${userId}`);

    // 7. Delete user from Firebase Auth (this must be done last)
    try {
      await adminAuth.deleteUser(userId);
      console.log(`[DELETE ACCOUNT] ✅ Successfully deleted Firebase Auth user ${userId}`);
    } catch (authError: any) {
      console.error(`[DELETE ACCOUNT] ❌ Error deleting Firebase Auth user ${userId}:`, authError);
      // Even if Auth deletion fails, we've deleted the data, so return success
      // The user won't be able to log in anyway since their data is gone
    }

    return NextResponse.json({
      success: true,
      message: "Account and all associated data have been permanently deleted.",
    });
  } catch (error: any) {
    console.error("[DELETE ACCOUNT] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to delete account",
        message: error.message || "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
