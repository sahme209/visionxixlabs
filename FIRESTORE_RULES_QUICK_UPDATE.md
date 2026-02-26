# Firestore Security Rules - Quick Update Guide

## ❌ CURRENT ERROR

You're seeing permission errors because the new collections don't have security rules yet:
- `systemDailyStats` - Missing permissions
- `systemMonthlyStats` - Missing permissions  
- `rfeStats` - Missing permissions
- `pdStats` - Missing permissions
- `trends` - Missing permissions (will be needed soon)
- `systemCoverage` - Missing permissions (will be needed soon)
- `calendarApprovals` - Missing permissions (will be needed soon)

## ✅ SOLUTION

Add these rules to your Firestore security rules (before the `match /userNotification` rule):

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

## 🚀 HOW TO UPDATE

### Option 1: Firebase Console (Recommended)
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Firestore Database** → **Rules** tab
4. Copy the rules from `VisaNova-IOS/firestore-security-rules-complete.txt` (I've updated it)
5. Paste into the rules editor
6. Click **Publish**

### Option 2: Firebase CLI
```bash
# If you have firebase.json set up with rules file
firebase deploy --only firestore:rules

# Or manually copy the rules
cp VisaNova-IOS/firestore-security-rules-complete.txt firestore.rules
firebase deploy --only firestore:rules
```

## ✅ VERIFICATION

After updating the rules, the permission errors should disappear. All 7 new collections will be:
- ✅ Publicly readable (for client apps)
- ✅ Admin-write-only (for data integrity)

## 📝 FILES UPDATED

- ✅ `VisaNova-IOS/firestore-security-rules-complete.txt` - Updated with new rules
- ✅ `VisaNova-IOS/firestore-security-rules-updated-with-system-stats.txt` - Complete rules file

## 🔒 SECURITY NOTE

These rules match your existing pattern:
- `allow read: if true;` - Public read access (same as i130Approvals, i130Stats, etc.)
- `allow write: if isAdmin();` - Admin-only write (same as all other stats collections)

This is secure because:
1. All aggregated data is public (same as your existing stats)
2. Only admins can write (prevents data corruption)
3. Matches your existing security model
