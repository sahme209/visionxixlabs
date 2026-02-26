# Apply Website Request Feature to visionxixlabs

`git push` fails with `pack-objects died of signal 10` (SIGBUS) on your Mac. Use this workaround:

## Option 1: Apply patch in visionxixlabs clone

```bash
# 1. Clone visionxixlabs (if you don't have it)
git clone https://github.com/sahme209/visionxixlabs.git ~/Desktop/visionxixlabs
cd ~/Desktop/visionxixlabs

# 2. Apply the patch
git am /Users/samirahmed/Desktop/VisaNova-IOS-Android-Web/visionxix-website-request.patch

# 3. If there are conflicts, resolve them, then:
# git add .
# git am --continue

# 4. Install deps and run migration
npm install
# Add DATABASE_URL to .env, then:
npm run db:migrate

# 5. Push
git push origin main
```

## Option 2: Copy files manually

Copy these from `VisaNova-IOS-Android-Web` into your visionxixlabs repo:

- `app/request/` (entire folder)
- `app/request/thank-you/` (entire folder)
- `app/admin/leads/` (entire folder)
- `app/api/leads/` (entire folder)
- `app/api/admin/leads/` (entire folder)
- `lib/db.ts`
- `lib/leads/` (entire folder)
- `lib/admin/` (entire folder)
- `prisma/` (schema + migration)
- `VERIFICATION_SUMMARY.md`

Then update `package.json` (add prisma, @prisma/client, zod; add db:migrate script; update build script).

---

**About Signal 10:** It's often memory-related. You can try:
- Restart your Mac and push again
- `brew upgrade git` (newer Git may handle it better)
- Push from a different machine/CI
