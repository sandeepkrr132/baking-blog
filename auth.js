/* ========================================
   Supabase Auth - official @supabase/supabase-js client
   ========================================
   Loaded AFTER supabase.js (vendored UMD bundle, exposes global `supabase`).
   The client owns access-token refresh + rotation + session persistence, so
   we no longer hand-roll tokens in localStorage (the old approach never
   refreshed because GoTrue rejects expired tokens with 403, not 401).
   ======================================== */

const SUPABASE_URL = 'https://bynfesgbvgcmkpnwysil.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5bmZlc2didmdjbWtwbnd5c2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwMTI4NzMsImV4cCI6MjEwMDU4ODg3M30.SrevjTSZq231d9PCfQAs_gOvykeJ9a0j5-NwAui7esk';

// The vendored UMD bundle exposes the factory as global `supabase`.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,   // proactively refresh access tokens before they expire
        persistSession: true,     // keep the session in localStorage across reloads
        detectSessionInUrl: true  // pick up OAuth tokens/code in the callback URL
    }
});
window.supabaseClient = supabaseClient;

// Clean up the legacy hand-rolled token keys (pre-supabase-js). They can't be
// migrated into the client, and leaving them around is misleading. Users sign
// in once more after this deploy.
try {
    localStorage.removeItem('sb-access-token');
    localStorage.removeItem('sb-refresh-token');
    localStorage.removeItem('sb-user');
} catch (e) {}

// Normalize a Supabase User into the shape the rest of the app expects.
function normalizeUser(user) {
    if (!user) return null;
    const meta = user.user_metadata || {};
    return {
        id: user.id,
        email: user.email,
        user_metadata: {
            full_name: meta.full_name || meta.name || (user.email ? user.email.split('@')[0] : 'Baker'),
            avatar_url: meta.avatar_url || meta.picture || null
        }
    };
}

// Access token for the current session (kept for any raw-fetch fallbacks).
async function getAccessToken() {
    const { data } = await supabaseClient.auth.getSession();
    return data?.session?.access_token ?? null;
}

// Server-verified current user. getUser() verifies the token with the auth
// server and refreshes it automatically when expired, so a stale local
// session can never masquerade as a logged-in user.
async function getCurrentUser() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (error || !user) return null;
    return normalizeUser(user);
}

// Backward-compatible alias used by every page.
async function checkSession() {
    return await getCurrentUser();
}

// Google sign-in (client handles OAuth + PKCE + session storage).
async function signInWithGoogleProvider() {
    const PROD_URL = 'https://baking-blog-three.vercel.app';
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: PROD_URL + '/auth-callback.html'
        }
    });
    if (error) throw new Error(error.message);
}

// Email / password sign-up.
async function emailSignUp(email, password, name) {
    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: name ? { full_name: name } : {} }
    });
    if (error) throw new Error(error.message);
    return data;
}

// Email / password sign-in.
async function emailSignIn(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return data;
}

// OAuth callback completion. detectSessionInUrl captures the tokens/code on
// client init; getSession() finishes the exchange (PKCE) and returns the user.
async function handleAuthCallback() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error || !session) return null;
    return normalizeUser(session.user);
}

// Sign out.
async function signOut() {
    try { await supabaseClient.auth.signOut(); } catch (e) { /* ignore */ }
    window.location.href = 'index.html';
}

// React to session events. Only a genuine SIGNED_OUT on a page that requires
// auth should send the user to login. TOKEN_REFRESHED / INITIAL_SESSION /
// SIGNED_IN are handled silently by the client (a background refresh must
// never surface as an error to the user).
supabaseClient.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
        const page = window.location.pathname.split('/').pop() || 'index.html';
        const protectedPages = ['my-recipes.html', 'saved.html', 'create-recipe.html'];
        if (protectedPages.includes(page)) {
            window.location.href = 'login.html';
        }
    }
});
