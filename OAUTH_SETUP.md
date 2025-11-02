# OAuth Setup Guide - OpenChat

This guide walks you through setting up GitHub and Google OAuth for OpenChat.

## Prerequisites

- Access to GitHub account (for GitHub OAuth)
- Access to Google Cloud Console (for Google OAuth)
- OpenChat deployed or running locally

## GitHub OAuth Setup

### Step 1: Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **"OAuth Apps"** in the left sidebar
3. Click **"New OAuth App"**

### Step 2: Configure OAuth App

Fill in the form with these details:

- **Application name**: `OpenChat` (or your preferred name)
- **Homepage URL**:
  - Production: `https://osschat.dev`
  - Local dev: `http://localhost:3001`
- **Authorization callback URL**:
  - Production: `https://osschat.dev/api/auth/callback/github`
  - Local dev: `http://localhost:3001/api/auth/callback/github`

### Step 3: Get Credentials

1. Click **"Register application"**
2. You'll see your **Client ID** - copy it
3. Click **"Generate a new client secret"**
4. Copy the **Client Secret** (you'll only see this once!)

### Step 4: Configure Email Permissions

**IMPORTANT**: GitHub OAuth requires the `user:email` scope.

For GitHub Apps (if you created an App instead of OAuth App):
- Navigate to: *Permissions and Events* > *Account Permissions* > *Email Addresses*
- Set to: **Read-Only**

For OAuth Apps, the `user:email` scope is included by default.

### Step 5: Add to Environment Variables

Add these to your Dokploy environment variables:

```bash
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
```

For local development, add to `.env.local`:

```bash
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
```

---

## Google OAuth Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click the project dropdown at the top
3. Click **"New Project"**
4. Name it `OpenChat` and click **"Create"**

### Step 2: Enable Google+ API

1. In the left sidebar, go to **"APIs & Services"** > **"Library"**
2. Search for **"Google+ API"** or **"Google Identity Services"**
3. Click it and press **"Enable"**

### Step 3: Configure OAuth Consent Screen

1. Go to **"APIs & Services"** > **"OAuth consent screen"**
2. Select **"External"** (unless you have Google Workspace)
3. Click **"Create"**
4. Fill in the required fields:
   - **App name**: `OpenChat`
   - **User support email**: Your email
   - **Developer contact**: Your email
5. Click **"Save and Continue"**
6. Skip the "Scopes" section (default scopes are fine)
7. Add test users if needed
8. Click **"Save and Continue"**

### Step 4: Create OAuth Credentials

1. Go to **"APIs & Services"** > **"Credentials"**
2. Click **"Create Credentials"** > **"OAuth client ID"**
3. Select **"Web application"**
4. Name it `OpenChat Web`

### Step 5: Configure Authorized URLs

**Authorized JavaScript origins** (optional):
- Production: `https://osschat.dev`
- Local dev: `http://localhost:3001`

**Authorized redirect URIs** (required):
- Production: `https://osschat.dev/api/auth/callback/google`
- Local dev: `http://localhost:3001/api/auth/callback/google`

### Step 6: Get Credentials

1. Click **"Create"**
2. Copy the **Client ID** (ends with `.apps.googleusercontent.com`)
3. Copy the **Client Secret**

### Step 7: Add to Environment Variables

Add these to your Dokploy environment variables:

```bash
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

For local development, add to `.env.local`:

```bash
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

---

## Environment Variables Summary

Your complete OAuth environment variables should look like this:

```bash
# ==============================================================================
# Authentication
# ==============================================================================
BETTER_AUTH_SECRET=Wj+P6CwKFzq3wC9EMIIRAZboyXKlmIGxT7oN/XctYmQ=

# GitHub OAuth
GITHUB_CLIENT_ID=abc123xyz789
GITHUB_CLIENT_SECRET=ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789

# Google OAuth
GOOGLE_CLIENT_ID=123456789012-abcdefghijklmnopqrstuvwxyz012345.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-aBcDeFgHiJkLmNoPqRsTuV
```

---

## Callback URL Reference

| Provider | Local Development | Production |
|----------|------------------|------------|
| GitHub   | `http://localhost:3001/api/auth/callback/github` | `https://osschat.dev/api/auth/callback/github` |
| Google   | `http://localhost:3001/api/auth/callback/google` | `https://osschat.dev/api/auth/callback/google` |

**Note**: If your app runs on a different port locally (e.g., 3000), adjust the URLs accordingly.

---

## Testing OAuth Setup

### Local Development

1. Start the development servers:
   ```bash
   bun run dev
   ```

2. Navigate to `http://localhost:3001/auth/sign-in`

3. Click **"Continue with GitHub"** or **"Continue with Google"**

4. You should be redirected to the provider's consent page

5. After authorizing, you should be redirected back to `/dashboard`

### Production

1. Add all environment variables to Dokploy

2. Redeploy your application

3. Navigate to `https://osschat.dev/auth/sign-in`

4. Test both GitHub and Google OAuth flows

5. Verify that:
   - OAuth redirects work
   - Session persists after login
   - Dashboard is accessible
   - Last login method badge appears on return

---

## Troubleshooting

### "Redirect URI mismatch" Error

**Problem**: The callback URL doesn't match what's configured in GitHub/Google.

**Solution**:
- Verify the callback URL in your OAuth app settings matches exactly
- Check for trailing slashes (don't include them)
- Ensure protocol matches (http vs https)

### "Invalid client" Error

**Problem**: Client ID or Secret is incorrect.

**Solution**:
- Double-check environment variables are set correctly
- Regenerate client secret if unsure
- Ensure no extra spaces in the credentials

### GitHub: "Email not found" Error

**Problem**: GitHub account doesn't have a public email or email permission not granted.

**Solution**:
- Add `user:email` scope to GitHub OAuth App permissions
- For GitHub Apps, set Email Addresses permission to Read-Only

### Google: "Access blocked" Error

**Problem**: OAuth consent screen not configured or app not verified.

**Solution**:
- Complete the OAuth consent screen setup
- Add yourself as a test user during development
- For production, submit for verification (optional for small apps)

### Session Not Persisting

**Problem**: User gets logged out on page refresh.

**Solution**:
- Ensure `BETTER_AUTH_SECRET` is set and consistent
- Check that cookies are being set (inspect browser cookies)
- Verify middleware is not blocking session cookies
- In production, ensure `useSecureCookies` is true and you're using HTTPS

### Last Login Method Not Showing

**Problem**: Badge doesn't appear on login page.

**Solution**:
- The plugin stores the method in a cookie after first login
- You must sign in once for the badge to appear on subsequent visits
- Check browser cookies for `better-auth.last_used_login_method`

---

## Security Notes

1. **Never commit OAuth secrets to git** - Use environment variables only
2. **Use different OAuth apps for dev and production** - Prevents credential leakage
3. **Rotate secrets periodically** - Regenerate client secrets every 6-12 months
4. **Monitor OAuth usage** - Check GitHub/Google dashboards for unusual activity
5. **Enable 2FA** - Protect your GitHub/Google accounts with two-factor authentication

---

## Next Steps

Once OAuth is set up and tested:

1. Remove the development OAuth credentials from local `.env.local`
2. Add production credentials to Dokploy
3. Test in production environment
4. Monitor Sentry for any authentication errors
5. Set up additional providers if needed (Discord, Twitter, etc.)

---

## Additional Resources

- [Better Auth Documentation](https://www.better-auth.com/)
- [GitHub OAuth Apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)
- [Google OAuth Setup](https://developers.google.com/identity/protocols/oauth2)
- [Better Auth Convex Integration](https://www.better-auth.com/docs/integrations/convex)
