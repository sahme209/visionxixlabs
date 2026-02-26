import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { updateSubscriptionStatusAdmin } from "@/lib/services/subscriptionServiceAdmin";
import { sendSubscriptionEmail } from "@/lib/services/emailService";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { generateTimeline } from "@/lib/services/timelineService";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-12-15.clover",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

export async function POST(request: NextRequest) {
  if (!webhookSecret || webhookSecret.trim() === "") {
    console.error("[WEBHOOK] STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No Stripe signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (!subscriptionId) {
          console.error("No subscription ID in checkout session");
          break;
        }

        // Get subscription details (includes status, trial, and period info)
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price.id;
        const planType = priceId?.includes("annual") ? "annual" : "monthly";
        const currentPeriodEndUnix = (subscription as any).current_period_end as number | undefined;
        const trialEndUnix = (subscription as any).trial_end as number | undefined;

        const status = subscription.status as Stripe.Subscription.Status;
        const currentPeriodEnd = currentPeriodEndUnix
          ? new Date(currentPeriodEndUnix * 1000)
          : undefined;
        const trialEnd = trialEndUnix ? new Date(trialEndUnix * 1000) : undefined;

        // For backward compatibility, keep expiresAt aligned with currentPeriodEnd
        const expiresAt =
          currentPeriodEnd ||
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Fallback ~30 days

        // Get user ID from multiple sources (priority order)
        let userId: string | null = null;
        
        // 1. Try session metadata first
        if (session.metadata?.userId) {
          userId = session.metadata.userId;
        }
        // 2. Try subscription metadata
        else if (subscription.metadata?.userId) {
          userId = subscription.metadata.userId;
        }
        // 3. Try customer metadata
        else if (customerId) {
          try {
            const customer = await stripe.customers.retrieve(customerId);
            userId = (customer as Stripe.Customer).metadata?.userId || null;
          } catch (err) {
            console.error("Error retrieving customer:", err);
          }
        }

        if (userId) {
          console.log(`[WEBHOOK] ✅ Found userId: ${userId} for subscription: ${subscriptionId}`);
          console.log(
            `[WEBHOOK] Updating subscription status for user: ${userId}, subscription: ${subscriptionId}, status: ${status}, expiresAt: ${expiresAt.toISOString()}`
          );
          try {
            await updateSubscriptionStatusAdmin(userId, {
              // Gate access only for trialing/active; past_due and others are handled in other events
              isSubscribed: status === "trialing" || status === "active",
              planType,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              expiresAt,
              status: status as any,
              trialEnd,
              currentPeriodEnd,
              // Once a subscription with a trial exists, mark trial as used
              hasUsedTrial: !!trialEndUnix,
            });
            console.log(`[WEBHOOK] ✅ Subscription status updated successfully for user: ${userId}, expiresAt: ${expiresAt.toISOString()}`);
            
            // Send subscription email with timeline
            try {
              const adminAuth = getAdminAuth();
              const adminDb = getAdminDb();
              
              // Get user email
              let userEmail: string | null = null;
              let userName: string | null = null;
              try {
                const userRecord = await adminAuth.getUser(userId);
                userEmail = userRecord.email || null;
                userName = userRecord.displayName || null;
              } catch (authError) {
                console.error(`[WEBHOOK] Error getting user email:`, authError);
                // Try to get email from customer
                if (customerId) {
                  try {
                    const customer = await stripe.customers.retrieve(customerId);
                    userEmail = (customer as Stripe.Customer).email || null;
                  } catch (err) {
                    console.error(`[WEBHOOK] Error getting customer email:`, err);
                  }
                }
              }
              
              if (userEmail) {
                // Load user profile to generate timeline
                const profileRef = adminDb.collection("userProfiles").doc(userId);
                const profileSnap = await profileRef.get();
                
                let timeline = undefined;
                if (profileSnap.exists) {
                  const profileData = profileSnap.data();
                  if (profileData?.priorityDate && profileData?.formType) {
                    try {
                      const priorityDate = profileData.priorityDate.toDate 
                        ? profileData.priorityDate.toDate() 
                        : new Date(profileData.priorityDate);
                      
                      const generatedTimeline = await generateTimeline(
                        profileData.formType,
                        priorityDate,
                        profileData.country || undefined,
                        (profileData.processingPath as "Consular" | "AOS") || "Consular",
                        undefined,
                        profileData.currentStage || undefined,
                        profileData.serviceCenter || undefined
                      );
                      
                      if (generatedTimeline) {
                        timeline = {
                          formType: generatedTimeline.formType,
                          priorityDate: generatedTimeline.priorityDate,
                          stages: generatedTimeline.stages.map(stage => ({
                            id: stage.id,
                            name: stage.name,
                            description: stage.description,
                            stageType: stage.stageType,
                            earliestDate: stage.earliestDate,
                            latestDate: stage.latestDate,
                            isCompleted: stage.isCompleted,
                            isCurrent: stage.isCurrent,
                          })),
                        };
                      }
                    } catch (timelineError) {
                      console.error(`[WEBHOOK] Error generating timeline:`, timelineError);
                    }
                  }
                }
                
                // Send email (non-blocking - don't fail webhook if email fails)
                sendSubscriptionEmail({
                  email: userEmail,
                  name: userName || undefined,
                  isSubscribed: true,
                  timeline,
                }).catch((emailError) => {
                  console.error(`[WEBHOOK] Error sending subscription email:`, emailError);
                  // Don't throw - email failure shouldn't fail the webhook
                });
              } else {
                console.warn(`[WEBHOOK] ⚠️ No email found for user ${userId}, skipping subscription email`);
              }
            } catch (emailError) {
              console.error(`[WEBHOOK] Error in email sending process:`, emailError);
              // Don't throw - email failure shouldn't fail the webhook
            }
          } catch (updateError: any) {
            console.error(`[WEBHOOK] ❌ Error updating subscription status for user ${userId}:`, updateError);
            console.error(`[WEBHOOK] Error details:`, updateError.message, updateError.stack);
            throw updateError; // Re-throw to return error response
          }
        } else {
          console.error(`[WEBHOOK] ❌ Could not find userId for subscription: ${subscriptionId}`);
          console.error(`[WEBHOOK] Session metadata:`, JSON.stringify(session.metadata, null, 2));
          console.error(`[WEBHOOK] Subscription metadata:`, JSON.stringify(subscription.metadata, null, 2));
          if (customerId) {
            try {
              const customer = await stripe.customers.retrieve(customerId);
              console.error(`[WEBHOOK] Customer metadata:`, JSON.stringify((customer as Stripe.Customer).metadata, null, 2));
              console.error(`[WEBHOOK] Customer email:`, (customer as Stripe.Customer).email);
            } catch (err) {
              console.error(`[WEBHOOK] Error retrieving customer:`, err);
            }
          }
          // Return error so Stripe knows to retry
          throw new Error(`Could not find userId for subscription ${subscriptionId}`);
        }

        break;
      }

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const status = subscription.status as Stripe.Subscription.Status;

        const priceId = subscription.items.data[0]?.price.id;
        const planType = priceId?.includes("annual") ? "annual" : "monthly";
        const currentPeriodEndUnix = (subscription as any).current_period_end as number | undefined;
        const trialEndUnix = (subscription as any).trial_end as number | undefined;

        const currentPeriodEnd = currentPeriodEndUnix
          ? new Date(currentPeriodEndUnix * 1000)
          : undefined;
        const trialEnd = trialEndUnix ? new Date(trialEndUnix * 1000) : undefined;

        const customer = await stripe.customers.retrieve(customerId);
        const userId = (customer as Stripe.Customer).metadata?.userId;

        if (userId) {
          await updateSubscriptionStatusAdmin(userId, {
            isSubscribed: status === "trialing" || status === "active",
            planType,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
            expiresAt: currentPeriodEnd,
            status: status as any,
            trialEnd,
            currentPeriodEnd,
            hasUsedTrial: !!trialEndUnix,
          });
          console.log(
            `[WEBHOOK] ✅ customer.subscription.created for user ${userId}, status: ${status}, trialEnd: ${
              trialEnd ? trialEnd.toISOString() : "none"
            }`
          );
        }

        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const cancelAtPeriodEnd = (subscription as any).cancel_at_period_end === true;
        const status = subscription.status as Stripe.Subscription.Status;

        const priceId = subscription.items.data[0]?.price.id;
        const planType = priceId?.includes("annual") ? "annual" : "monthly";
        const currentPeriodEndUnix = (subscription as any).current_period_end as number | undefined;
        const trialEndUnix = (subscription as any).trial_end as number | undefined;

        const currentPeriodEnd = currentPeriodEndUnix
          ? new Date(currentPeriodEndUnix * 1000)
          : undefined;
        const trialEnd = trialEndUnix ? new Date(trialEndUnix * 1000) : undefined;

        if (status === "active" || status === "trialing") {
          const expiresAt =
            currentPeriodEnd ||
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

          // Get user ID from customer metadata
          const customer = await stripe.customers.retrieve(customerId);
          const userId = (customer as Stripe.Customer).metadata?.userId;

          if (userId) {
            await updateSubscriptionStatusAdmin(userId, {
              isSubscribed: status === "trialing" || status === "active",
              planType,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscription.id,
              expiresAt,
              cancelAtPeriodEnd: cancelAtPeriodEnd, // Track if cancelled at period end
              status: status as any,
              trialEnd,
              currentPeriodEnd,
              hasUsedTrial: !!trialEndUnix,
            });
            console.log(
              `[WEBHOOK] ✅ Updated subscription for user ${userId}, status: ${status}, cancelAtPeriodEnd: ${cancelAtPeriodEnd}, expiresAt: ${
                expiresAt?.toISOString() || "n/a"
              }`
            );
          }
        } else if (status === "canceled") {
          // Subscription cancelled - check if it's at period end or immediate
          const customer = await stripe.customers.retrieve(customerId);
          const userId = (customer as Stripe.Customer).metadata?.userId;

          if (userId) {
            const expiresAt = currentPeriodEnd || new Date();
            
            // If period hasn't ended yet, keep access until it does
            if (expiresAt > new Date()) {
              await updateSubscriptionStatusAdmin(userId, {
                isSubscribed: true, // Keep access until period ends
                cancelAtPeriodEnd: true,
                expiresAt,
                status: status as any,
                trialEnd,
                currentPeriodEnd,
                hasUsedTrial: !!trialEndUnix,
              });
            } else {
              // Period has ended, revoke access - user can resubscribe
              await updateSubscriptionStatusAdmin(userId, {
                isSubscribed: false,
                cancelAtPeriodEnd: false,
                expiresAt: currentPeriodEnd,
                status: status as any,
                trialEnd,
                currentPeriodEnd,
                hasUsedTrial: !!trialEndUnix,
              });
              console.log(`[WEBHOOK] ✅ Subscription period ended for user ${userId}, access revoked - user can resubscribe`);
            }
          }
        } else {
          // Subscription expired or other non-active status
          const customer = await stripe.customers.retrieve(customerId);
          const userId = (customer as Stripe.Customer).metadata?.userId;

          if (userId) {
            await updateSubscriptionStatusAdmin(userId, {
              isSubscribed: false,
              status: status as any,
              trialEnd,
              currentPeriodEnd,
              hasUsedTrial: !!trialEndUnix,
            });
          }
        }

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const currentPeriodEndUnix = (subscription as any).current_period_end as number | undefined;
        const currentPeriodEnd = currentPeriodEndUnix ? new Date(currentPeriodEndUnix * 1000) : undefined;

        const customer = await stripe.customers.retrieve(customerId);
        const userId = (customer as Stripe.Customer).metadata?.userId;

        if (userId) {
          // Fully clear subscription state so user can resubscribe
          await updateSubscriptionStatusAdmin(userId, {
            isSubscribed: false,
            status: "canceled",
            cancelAtPeriodEnd: false,
            expiresAt: currentPeriodEnd, // Keep for reference; past date indicates ended
          });
          console.log(`[WEBHOOK] ✅ Subscription deleted for user ${userId}, access revoked - user can resubscribe`);
        }

        break;
      }

      case "invoice.payment_succeeded":
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string | null;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : (invoice.customer as Stripe.Customer)?.id || null;

        if (!subscriptionId || !customerId) {
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const status = subscription.status as Stripe.Subscription.Status;
        const currentPeriodEndUnix = (subscription as any).current_period_end as number | undefined;
        const trialEndUnix = (subscription as any).trial_end as number | undefined;

        const currentPeriodEnd = currentPeriodEndUnix
          ? new Date(currentPeriodEndUnix * 1000)
          : undefined;
        const trialEnd = trialEndUnix ? new Date(trialEndUnix * 1000) : undefined;

        const customer = await stripe.customers.retrieve(customerId);
        const userId = (customer as Stripe.Customer).metadata?.userId;

        if (userId) {
          await updateSubscriptionStatusAdmin(userId, {
            isSubscribed: status === "trialing" || status === "active",
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
            expiresAt: currentPeriodEnd,
            status: status as any,
            trialEnd,
            currentPeriodEnd,
            hasUsedTrial: !!trialEndUnix,
          });
          console.log(
            `[WEBHOOK] ✅ invoice.paid processed for user ${userId}, status: ${status}, next billing: ${
              currentPeriodEnd ? currentPeriodEnd.toISOString() : "n/a"
            }`
          );
        }

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string | null;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : (invoice.customer as Stripe.Customer)?.id || null;

        if (!subscriptionId || !customerId) {
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const currentPeriodEndUnix = (subscription as any).current_period_end as number | undefined;
        const trialEndUnix = (subscription as any).trial_end as number | undefined;

        const currentPeriodEnd = currentPeriodEndUnix
          ? new Date(currentPeriodEndUnix * 1000)
          : undefined;
        const trialEnd = trialEndUnix ? new Date(trialEndUnix * 1000) : undefined;

        const customer = await stripe.customers.retrieve(customerId);
        const userId = (customer as Stripe.Customer).metadata?.userId;

        if (userId) {
          // Mark status as past_due and revoke access immediately
          await updateSubscriptionStatusAdmin(userId, {
            isSubscribed: false,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
            expiresAt: currentPeriodEnd,
            status: "past_due",
            trialEnd,
            currentPeriodEnd,
            hasUsedTrial: !!trialEndUnix,
          });
          console.log(
            `[WEBHOOK] ⚠️ invoice.payment_failed for user ${userId} – subscription set to past_due and access revoked`
          );
        }

        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
