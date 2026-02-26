# Firestore Security Rules Setup

## Problem
You're seeing: `FirebaseError: Missing or insufficient permissions` when trying to read subscription status.

This happens because Firestore security rules need to allow authenticated users to read their own subscription document.

## Quick Fix (2 minutes)

### Option 1: Firebase Console (Recommended)

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com
   - Select your project

2. **Navigate to Firestore Database**
   - Click **Firestore Database** in the left sidebar
   - Click **Rules** tab

3. **Replace the rules with:**
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // Users can read/write their own user document
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
       
       // Users can read their own subscription document
       match /subscriptions/{userId} {
         allow read: if request.auth != null && request.auth.uid == userId;
         // Only server (Admin SDK) can write subscriptions
         allow write: if false;
       }
       
       // Users can read/write their own profile
       match /userProfiles/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
       
       // Public read access for news, notifications, processing times, etc.
       match /news/{document=**} {
         allow read: if true;
         allow write: if false;
       }
       
       match /notifications/{document=**} {
         allow read: if request.auth != null;
         allow write: if false;
       }
       
       match /currentProcessingTimes/{document=**} {
         allow read: if true;
         allow write: if false;
       }
       
       match /pdStats/{document=**} {
         allow read: if true;
         allow write: if false;
       }
       
       match /dailyApproval/{document=**} {
         allow read: if true;
         allow write: if false;
       }
       
       // Deny all other access
       match /{document=**} {
         allow read, write: if false;
       }
     }
   }
   ```

4. **Click "Publish"**

### Option 2: Firebase CLI (If you have it set up)

1. **Deploy rules:**
   ```bash
   firebase deploy --only firestore:rules
   ```

## What These Rules Do

- ✅ **Users can read their own subscription** - Fixes the permission error
- ✅ **Users can read/write their own user document** - For settings, preferences
- ✅ **Users can read/write their own profile** - For profile data
- ✅ **Public read access** - For news, processing times, stats (no auth required)
- ✅ **Authenticated read access** - For notifications (requires login)
- ❌ **No client writes to subscriptions** - Only server (Admin SDK) can write via webhooks

## Security Notes

- Subscription writes are only allowed via Admin SDK (server-side)
- Users can only read their own subscription document (matched by userId)
- All other collections have appropriate read/write restrictions

## Testing

After updating the rules:
1. Refresh your browser
2. Try subscribing again
3. The permission errors should be gone
4. Subscription status should update in real-time
