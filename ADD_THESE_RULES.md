# Add These Rules to Fix Permission Errors

## 🔴 CURRENT ERROR

```
[StatsDataService] ❌ Error fetching daily stats: Missing or insufficient permissions.
[StatsDataService] ❌ Error fetching monthly stats: Missing or insufficient permissions.
[StatsDataService] ❌ Error fetching RFE stats: Missing or insufficient permissions.
```

## ✅ SOLUTION - Copy These Rules

**Add these 7 rule blocks to your Firestore security rules file.**

**Location:** Add them **BEFORE** the `match /userNotification` rule (around line 72 in `firestore-security-rules-complete.txt`)

```javascript
// ✅ System Daily Stats (public read, admin write) ✅ NEW
match /systemDailyStats/{date} {
  allow read: if true;
  allow write: if isAdmin();
}

// ✅ System Monthly Stats (public read, admin write) ✅ NEW
match /systemMonthlyStats/{month} {
  allow read: if true;
  allow write: if isAdmin();
}

// ✅ System Coverage (public read, admin write) ✅ NEW
match /systemCoverage/{scopeId} {
  allow read: if true;
  allow write: if isAdmin();
}

// ✅ Trends Data (public read, admin write) ✅ NEW
match /trends/{scopeId} {
  allow read: if true;
  allow write: if isAdmin();
}

// ✅ PD Stats (public read, admin write) ✅ NEW
match /pdStats/{scopeId} {
  allow read: if true;
  allow write: if isAdmin();
}

// ✅ RFE Stats (public read, admin write) ✅ NEW
match /rfeStats/{scopeId} {
  allow read: if true;
  allow write: if isAdmin();
}

// ✅ Calendar Approvals (public read, admin write) ✅ NEW
match /calendarApprovals/{month} {
  allow read: if true;
  allow write: if isAdmin();
}
```

## 📍 WHERE TO ADD

In `firestore-security-rules-complete.txt`, add these rules **after line 70** (after the `i129fEmbassyStats` rules) and **before line 72** (before the `userNotification` rule).

## 🚀 HOW TO DEPLOY

1. **Open Firebase Console**: https://console.firebase.google.com/
2. **Select your project**
3. **Go to**: Firestore Database → Rules tab
4. **Copy the ENTIRE rules file** from `VisaNova-IOS/firestore-security-rules-complete.txt`
5. **Paste** into the rules editor
6. **Click "Publish"**

OR use Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

## ✅ AFTER DEPLOYMENT

The permission errors will stop. All new collections will be:
- ✅ Publicly readable (same as your existing stats)
- ✅ Admin-write-only (secure)

## 📝 NOTE

I've already updated `VisaNova-IOS/firestore-security-rules-complete.txt` with these rules. Just copy that entire file and paste it into Firebase Console.
