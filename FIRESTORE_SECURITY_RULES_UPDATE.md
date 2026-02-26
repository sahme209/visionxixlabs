# Firestore Security Rules Update

## ✅ NEW RULES ADDED

Added security rules for 7 new collections:

1. **System Daily Stats** - `/systemDailyStats/{date}`
2. **System Monthly Stats** - `/systemMonthlyStats/{month}`
3. **System Coverage** - `/systemCoverage/{scopeId}`
4. **Trends Data** - `/trends/{scopeId}`
5. **PD Stats** - `/pdStats/{scopeId}`
6. **RFE Stats** - `/rfeStats/{scopeId}`
7. **Calendar Approvals** - `/calendarApprovals/{month}`

## 🔒 PERMISSIONS

All new collections follow the same pattern as existing stats collections:
- **Read**: `allow read: if true;` (public read access)
- **Write**: `allow write: if isAdmin();` (admin-only write access)

## 📝 FILES

- **Updated Rules File**: `VisaNova-IOS/firestore-security-rules-updated-with-system-stats.txt`

## 🚀 DEPLOYMENT

To apply these rules:

1. **Copy the rules** from `firestore-security-rules-updated-with-system-stats.txt`
2. **Go to Firebase Console** → Firestore Database → Rules
3. **Paste the updated rules**
4. **Click "Publish"**

Alternatively, if using Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

## ✅ VERIFICATION

After deploying, the permission errors should be resolved:
- ✅ `systemDailyStats` - readable
- ✅ `systemMonthlyStats` - readable
- ✅ `systemCoverage` - readable
- ✅ `trends` - readable
- ✅ `pdStats` - readable
- ✅ `rfeStats` - readable
- ✅ `calendarApprovals` - readable

All collections remain admin-write-only for data integrity.
