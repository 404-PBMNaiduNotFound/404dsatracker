# Deployment Guide - Striver DSA⁴⁰⁴

## Quick Start - Local Development with Firebase Emulators

### Prerequisites
- Node.js 18+
- Firebase CLI (`npm install -g firebase-tools`)
- Your project cloned locally

### Setup Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start Firebase Emulators** (in one terminal):
   ```bash
   firebase emulators:start
   ```
   Wait for the output: `✔ All emulators started, it is now safe to connect your app.`

3. **Start the development server** (in another terminal):
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   - App: http://localhost:3000
   - Emulator UI: http://localhost:4000

5. **Sign in for testing:**
   - Email: `test@example.com`
   - Password: `password123`
   - The emulator will auto-create the account on first sign in

---

## Production Deployment - Vercel + Real Firebase

### Step 1: Configure Firebase

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your **tracker-3751e** project
3. Go to **Authentication** → **Settings**
4. Scroll to **Authorized domains**
5. Add your domains:
   - `localhost:3000` (for local testing)
   - Your Vercel domain when deployed (e.g., `your-app.vercel.app`)

### Step 2: Deploy to Vercel

1. In v0, click the **"Publish"** button (top right)
2. Vercel will deploy your app and provide a domain
3. Copy the domain from Vercel

### Step 3: Add Vercel Domain to Firebase

1. Go back to Firebase Console → Authentication → Settings
2. Add your Vercel domain to **Authorized domains**
3. Wait a few minutes for Firebase to propagate

### Step 4: Add Environment Variables to Vercel

1. In Vercel project settings → Environment Variables
2. Add your Firebase configuration:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=<your-api-key>
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tracker-3751e.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=tracker-3751e
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tracker-3751e.firebasestorage.app
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=662558145403
   NEXT_PUBLIC_FIREBASE_APP_ID=1:662558145403:web:b624b59a5a0997560d1bde
   ```

5. Redeploy from Vercel dashboard

### Step 5: Test on Production

1. Visit your Vercel domain
2. Sign in with your real Firebase account
3. All tabs should now work (Today, Week, Backlog, etc.)

---

## Tabs Not Opening - Troubleshooting

If the **Week** or **Backlog** tabs show a login page:

1. **Ensure you're signed in** - The app requires authentication for all tabs except the home page
2. **Check Firebase connection** - No red error notifications should appear in the bottom right
3. **Verify routes** - The routes exist at:
   - `/weeks` - Week tab
   - `/backlog` - Backlog tab
   - `/today` - Today tab (and others)

If tabs still don't open after sign in:

1. **Check browser console** (F12) for errors
2. **Verify authentication** by checking if user profile loads
3. **Clear browser cache** and reload

---

## Local Development Workflow

```bash
# Terminal 1: Start emulators
firebase emulators:start

# Terminal 2: Start dev server
npm run dev

# Terminal 3 (optional): Watch for build errors
npm run build
```

Visit `http://localhost:3000` and start developing!

---

## Environment Variables

### Local Development (.env.local)
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDemo
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

When using real Firebase (production):
```env
NEXT_PUBLIC_FIREBASE_API_KEY=<real-api-key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tracker-3751e.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tracker-3751e
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tracker-3751e.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=662558145403
NEXT_PUBLIC_FIREBASE_APP_ID=1:662558145403:web:b624b59a5a0997560d1bde
```

---

## Next.js Migration Complete

This app has been successfully migrated from **TanStack Router + Vite** to **Next.js 16 with App Router**:

- ✅ All 14 routes converted
- ✅ Firebase authentication integrated
- ✅ Production-ready build
- ✅ Full TypeScript support
- ✅ ESR and CSR pages working

All features are ready to use - just connect your Firebase project and deploy!
