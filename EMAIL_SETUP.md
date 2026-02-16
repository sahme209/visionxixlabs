# Email Setup Instructions

The contact form now sends emails directly from the website instead of opening the mail app.

## Setup with Resend (Recommended)

1. **Create a Resend account**
   - Go to https://resend.com
   - Sign up for a free account (100 emails/day free tier)

2. **Get your API key**
   - Navigate to API Keys in your Resend dashboard
   - Create a new API key
   - Copy the key

3. **Add domain (optional but recommended)**
   - Add your domain in Resend dashboard
   - Verify DNS records
   - This allows you to send from your own domain (e.g., `contact@visionxixlabs.com`)

4. **Configure environment variables**
   - Create or update `.env.local` file in the root directory:
   ```
   RESEND_API_KEY=re_your_api_key_here
   RESEND_FROM_EMAIL=onboarding@resend.dev
   CONTACT_EMAIL=support@visionxixlabs.com
   ```
   
   - If you've added your domain, use:
   ```
   RESEND_FROM_EMAIL=contact@visionxixlabs.com
   ```

5. **Restart your development server**
   ```bash
   npm run dev
   ```

## Alternative Email Services

### Option 2: SendGrid
Replace the API route with SendGrid integration:
```typescript
// Install: npm install @sendgrid/mail
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
```

### Option 3: Nodemailer with SMTP
Use Nodemailer with your existing SMTP server:
```typescript
// Install: npm install nodemailer
import nodemailer from 'nodemailer';
```

### Option 4: Formspree (No Backend Needed)
Use Formspree service - update the form action to point to Formspree endpoint.

## Testing

1. Fill out the contact form
2. Submit the form
3. Check your email inbox (and spam folder)
4. Verify the email was received with all form data

## Troubleshooting

- **Emails not sending**: Check that `RESEND_API_KEY` is set correctly
- **Check server logs**: Look for error messages in the console
- **Resend dashboard**: Check the Resend dashboard for delivery status
- **Rate limits**: Free tier has 100 emails/day limit
