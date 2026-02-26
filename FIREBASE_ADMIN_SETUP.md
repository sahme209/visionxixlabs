# Firebase Admin SDK Setup

The subscription webhook uses Firebase Admin SDK to write to Firestore without user authentication. This requires server-side credentials.

## Option 1: Service Account Key (Recommended for Production)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings → Service Accounts
4. Click "Generate New Private Key"
5. Download the JSON file
6. **Minify the JSON** (convert to single line):
   - Use an online tool: https://jsonformatter.org/json-minify
   - Or use command line: `cat serviceAccountKey.json | jq -c`
7. Add the minified JSON as an environment variable:

### For Vercel:
1. Go to your Vercel project settings
2. Navigate to Environment Variables
3. Add a new variable:
   - **Key:** `FIREBASE_SERVICE_ACCOUNT_KEY`
   - **Value:** Paste the minified JSON (entire content on one line)
   - **Environments:** Production, Preview, Development
4. Save and redeploy

### For Local Development:
Add to `.env.local`:
```env
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"visaflow-ec7d4","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"...","universe_domain":"googleapis.com"}'
```

**Important Notes:**
- ✅ **YES, paste the ENTIRE JSON** (all fields including private_key, client_email, etc.)
- ✅ The JSON must be **minified to a single line** (no line breaks)
- ✅ The `\n` characters in the private_key field should remain as `\n` (they're part of the string)
- ❌ Don't include any extra quotes or formatting

### Quick Minify Method:

If you have the JSON file locally, run:
```bash
cat serviceAccountKey.json | jq -c
```

Then copy the output and paste it into Vercel.

Or use an online minifier:
1. Open https://jsonformatter.org/json-minify
2. Paste your JSON
3. Click "Minify"
4. Copy the result
5. Paste into Vercel environment variable

## Option 2: Application Default Credentials (Alternative)

If running on Google Cloud Platform, you can use Application Default Credentials. However, this is not recommended for Vercel deployments.

## Troubleshooting

If you see the error: "Unable to detect a Project Id in the current environment"

1. Make sure `FIREBASE_SERVICE_ACCOUNT_KEY` is set correctly
2. Verify the JSON is valid and minified (single line)
3. Ensure the service account has Firestore write permissions
4. Check that `NEXT_PUBLIC_FIREBASE_PROJECT_ID` is also set (as a fallback)

## Service Account Permissions

The service account needs the following IAM roles:
- **Cloud Datastore User** (for Firestore access)
- Or use the **Firebase Admin SDK Administrator Service Agent** role
