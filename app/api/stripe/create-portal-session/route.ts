import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";

const getStripe = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  return new Stripe(secretKey, { apiVersion: "2025-12-15.clover" });
};

/**
 * POST /api/stripe/create-portal-session
 * Creates a Stripe Customer Portal session for the authenticated user.
 * Security: Never accept arbitrary customerId from client. Always look up from Firestore by userId.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in." },
        { status: 401 }
      );
    }

    const token = authHeader.split("Bearer ")[1];
    const adminAuth = getAdminAuth();
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json(
        { error: "Unauthorized. Invalid or expired token." },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe is not configured." },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const returnUrl =
      body.returnUrl ||
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/settings`;

    const adminDb = getAdminDb();
    const subscriptionRef = adminDb.collection("subscriptions").doc(userId);
    const subscriptionSnap = await subscriptionRef.get();

    if (!subscriptionSnap.exists) {
      return NextResponse.json(
        { error: "No subscription found. Subscribe first to manage billing." },
        { status: 404 }
      );
    }

    const data = subscriptionSnap.data();
    const stripeCustomerId = data?.stripeCustomerId as string | undefined;

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing record found. Subscribe first to manage billing." },
        { status: 404 }
      );
    }

    // Verify the Stripe customer belongs to this user (customer metadata)
    try {
      const customer = await stripe.customers.retrieve(stripeCustomerId);
      const customerUserId = (customer as Stripe.Customer).metadata?.userId;
      if (customerUserId && customerUserId !== userId) {
        return NextResponse.json(
          { error: "Invalid billing record." },
          { status: 403 }
        );
      }
    } catch (err) {
      console.error("[PORTAL] Error verifying customer:", err);
      return NextResponse.json(
        { error: "Could not verify billing record." },
        { status: 500 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("[PORTAL] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create portal session" },
      { status: 500 }
    );
  }
}
