# Vercel Deployment Guide

## Quick Setup Steps

✅ **Deployed**: https://opusgraph.vercel.app

Since you've already connected your repository to Vercel, follow these steps:

### 1. Configure Environment Variables

In your Vercel project dashboard:

1. Go to **Settings** → **Environment Variables**
2. Add the following required variables:

#### Required Variables:

```
NEXT_PUBLIC_SUPABASE_URL
```
- Value: Your Supabase project URL (e.g., `https://vszoxfmjkasnjpzieyyd.supabase.co`)
- Environment: Production, Preview, Development (all environments)

```
NEXT_PUBLIC_SUPABASE_ANON_KEY
```
- Value: Your Supabase anon/public key
- Environment: Production, Preview, Development (all environments)
- You can find this in: Supabase Dashboard → Project Settings → API → Project API keys → `anon` `public`

#### Optional Variables (for future features):

```
GOOGLE_PLACES_API_KEY
```
- For location search integration (not yet implemented)
- Environment: Production, Preview, Development

```
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
```
- For Stripe subscription integration (not yet implemented)
- Environment: Production only (for webhook secret)

### 2. Build Settings

Vercel should auto-detect Next.js, but verify:

- **Framework Preset**: Next.js
- **Build Command**: `npm run build` (default)
- **Output Directory**: `.next` (default)
- **Install Command**: `npm install` (default)
- **Node.js Version**: 18.x or higher (should auto-detect)

### 3. Deploy

After adding environment variables:

1. Go to **Deployments** tab
2. Click **Redeploy** on the latest deployment (or push a new commit)
3. Vercel will rebuild with the new environment variables

### 4. Verify Deployment

Once deployed, test:

1. Visit your Vercel URL (e.g., `https://opusgraph.vercel.app`)
2. Check that the app loads without errors
3. Test the admin interface at `/admin/works/new` (you'll need to authenticate first)

## Post-Deployment Setup

### 5. Set Up Your Admin User

After your first deployment:

1. **Enable Authentication in Supabase:**
   - Go to Supabase Dashboard → Authentication → Settings
   - Configure email provider or your preferred auth method

2. **Sign up for an account:**
   - Visit your Vercel deployment URL
   - Create an account using Supabase Auth

3. **Make yourself a super admin:**
   - Go to Supabase Dashboard → SQL Editor
   - Run this query (replace `YOUR-EMAIL` with your auth email):
   
   ```sql
   -- First, get your user ID
   SELECT id, email FROM auth.users WHERE email = 'YOUR-EMAIL';
   
   -- Then, set yourself as super admin (replace USER_ID with the id from above)
   INSERT INTO user_profile(user_id, first_name, last_name, admin_role)
   VALUES ('USER_ID', 'Your Name', '', 'super_admin')
   ON CONFLICT (user_id) DO UPDATE SET admin_role='super_admin';
   ```

### 6. Configure Authentication Redirects

In Supabase Dashboard → Authentication → URL Configuration:

- **Site URL**: Your Vercel deployment URL (e.g., `https://opusgraph.vercel.app`)
- **Redirect URLs**: Add your Vercel URL:
  ```
  https://opusgraph.vercel.app/**
  ```

## Troubleshooting

### Build Fails

- Check that all environment variables are set correctly
- Verify Node.js version is 18+ in Vercel settings
- Check build logs for specific errors

### Environment Variables Not Working

- Make sure you've added them to all environments (Production, Preview, Development)
- Redeploy after adding variables
- Variables starting with `NEXT_PUBLIC_` are exposed to the browser - ensure they're safe to expose

### Authentication Issues

- Verify Supabase URL and anon key are correct
- Check Supabase redirect URLs include your Vercel domain
- Ensure Supabase Auth is enabled in your project

### Database Connection Issues

- Verify your Supabase project is active
- Check that RLS policies are correctly set up
- Ensure your user profile has the correct admin role

## Custom Domain (Optional)

If you want to use a custom domain:

1. Go to Vercel Dashboard → Settings → Domains
2. Add your domain
3. Follow DNS configuration instructions
4. Update Supabase redirect URLs to include your custom domain

## Monitoring

- Check Vercel's **Analytics** tab for performance metrics
- Monitor **Functions** tab for serverless function logs
- Use Supabase Dashboard → Logs for database activity

