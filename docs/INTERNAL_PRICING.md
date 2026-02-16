# Internal pricing tiers (not displayed on site)

Pricing is for your reference only. It is **not** shown on the public website.

## 1. Edit tiers and prices

Edit **`lib/pricingTiersInternal.ts`**:

- Update `price` for each tier (e.g. `"£2,500"`, `"From $5,000"`, `"Custom"`).
- Add or remove tiers, change `includes`, `duration`, `bestFor`, or `notes`.

This file is not imported by any public page.

## 2. View the internal pricing page

1. Set a secret in your environment:
   - **Local:** In `.env.local` add:
     ```bash
     INTERNAL_PRICING_KEY=your_secret_here
     ```
   - **Vercel:** Project → Settings → Environment Variables → add `INTERNAL_PRICING_KEY` with a value only you know.

2. Open in the browser:
   ```
   https://visionxixlabs.com/internal/pricing?key=your_secret_here
   ```
   (Locally: `http://localhost:3000/internal/pricing?key=your_secret_here`)

3. If the `key` query param does not match `INTERNAL_PRICING_KEY`, the page returns 404. The URL is not linked from the site.

## 3. Optional: block from search engines

The route is not linked anywhere. To avoid indexing, you can add `/internal` to your `robots.txt` disallow list if you have one.
