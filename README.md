# Family List

A mobile-friendly shared to-do / grocery list. Static site on GitHub Pages,
Firestore for real-time sync. No build step, no server, no login.

- Everyone on the link sees the same list, synced live.
- Each item has a title, optional due date/time, priority, and an optional
  "Buy item?" toggle that reveals a "Place to buy" field.
- Sort by due date or by priority. Filter by All / Active / Completed and by
  Tasks / Buy items.

## What you do once (about 10 minutes)

You'll create a Firebase project, paste its config into `firebase-config.js`,
push to GitHub, and turn on Pages. That's it.

### 1. Create the Firebase project

1. Open https://console.firebase.google.com/ and sign in.
2. Click **Add project**, give it any name (e.g. `family-todo`), accept the
   defaults, and skip Google Analytics if asked.
3. Inside the project, in the left sidebar pick **Build → Firestore Database**.
4. Click **Create database** → choose a region near you → start in
   **production mode** (we'll loosen the rules in step 3 below).

### 2. Register a Web app and copy the config

1. In the project, click the gear icon → **Project settings**.
2. Scroll to **Your apps** and click the **`</>`** (Web) icon.
3. Give the app any nickname. **Do not** check "Firebase Hosting".
4. Firebase shows a `firebaseConfig = { ... }` block. Copy those values into
   [firebase-config.js](firebase-config.js):

   ```js
   export const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };

   export const firebaseConfigured = true;  // <-- flip this to true
   ```

   These values are safe to commit to a public repo. They identify your project
   but don't grant access on their own — access is controlled by the rules in
   the next step.

### 3. Set Firestore security rules (permissive to start)

Go to **Firestore Database → Rules** and replace the rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tasks/{taskId} {
      allow read, write: if true;
    }
  }
}
```

Click **Publish**. This lets anyone with the URL read and write the `tasks`
collection. Fine for a private family list whose URL isn't shared. See
**Locking it down later** at the bottom of this README when you want auth.

### 4. Put it on GitHub Pages

1. Create a new repo on GitHub named **`family-todo`** (the name matters — the
   site will live at `https://<your-username>.github.io/family-todo/`).
2. Push these files to the repo:

   ```
   git init
   git add .
   git commit -m "Initial family list"
   git branch -M main
   git remote add origin https://github.com/<your-username>/family-todo.git
   git push -u origin main
   ```

3. On GitHub, go to **Settings → Pages**.
4. Under **Build and deployment → Source**, pick **Deploy from a branch**.
5. Branch: `main`, folder: `/ (root)`. Save.
6. Wait a minute, then open `https://<your-username>.github.io/family-todo/`.

### 5. Share the link

Send the URL to your wife (and the rest of the family). On first visit, the app
asks for a display name — it's stored on the device and used to tag who added
or completed items.

Tip: on iPhone, tap the share icon → **Add to Home Screen** to get an app-like
icon.

## Using it

- **+** in the top right adds an item.
- Tap a row to edit it. The trash button is inside the editor.
- The checkbox marks done. Completed items collapse under a "N completed"
  section at the bottom.
- The chips at the top filter by status (All / Active / Completed) and kind
  (All / Tasks / Buy items). Your selection sticks per device.
- "Sort by" toggles between due date and priority.
- Tap your name chip in the top right to change it.

## Locking it down later

When you want more than "anyone with the URL", you have a couple of options:

**Option A — Anonymous auth + simple gate.** Enable **Authentication → Sign-in
method → Anonymous** in the Firebase console, then tighten rules to require a
signed-in user:

```
match /tasks/{taskId} {
  allow read, write: if request.auth != null;
}
```

This still doesn't restrict *which* anonymous users can access. It mostly stops
random crawlers.

**Option B — Restrict by email.** Enable **Authentication → Sign-in method →
Google**, add a sign-in flow to `app.js`, and use rules like:

```
match /tasks/{taskId} {
  allow read, write:
    if request.auth != null &&
       request.auth.token.email in [
         "you@example.com",
         "wife@example.com"
       ];
}
```

The current app doesn't include the sign-in UI — you'd add a Firebase Auth call
in `app.js` before the Firestore subscription. Worth doing once you're sure the
URL is in the wild.

## Files

- [index.html](index.html) — markup and dialogs
- [styles.css](styles.css) — warm peach + teal theme
- [app.js](app.js) — Firestore sync, CRUD, filters, sort, name prompt
- [firebase-config.js](firebase-config.js) — paste your config here
- [.nojekyll](.nojekyll) — tells GitHub Pages to serve files as-is

## Troubleshooting

- **"Firebase isn't configured yet" banner.** You haven't set
  `firebaseConfigured = true` in `firebase-config.js`, or the values are still
  placeholders.
- **"Couldn't read tasks" banner.** Your Firestore rules block reads. Re-check
  step 3 above and click **Publish** after editing rules.
- **Page is 404 on GitHub Pages.** Pages can take a minute to deploy after the
  first push. Also check **Settings → Pages** shows the green "Your site is
  live at …" message.
- **Subpath broken / assets 404.** All asset paths are relative
  (`styles.css`, `app.js`) so they should resolve under any subpath. If you
  forked under a different repo name, the URL just changes accordingly — no
  code change needed.
