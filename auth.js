/* ========================================
   Supabase Auth - Google OAuth
   ======================================== */

const SUPABASE_URL = 'https://bynfesgbvgcmkpnwysil.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5bmZlc2didmdjbWtwbnd5c2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwMTI4NzMsImV4cCI6MjEwMDU4ODg3M30.SrevjTSZq231d9PCfQAs_gOvykeJ9a0j5-NwAui7esk';

// ========================================
// Access token for authenticated API calls
// ========================================
function getAccessToken() {
    return localStorage.getItem('sb-access-token');
}

// ========================================
// Sign in with Google
// ========================================
async function signInWithGoogleProvider() {
    const PROD_URL = 'https://baking-blog-three.vercel.app';
    const redirectUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(PROD_URL + '/auth-callback.html')}`;
    window.location.href = redirectUrl;
}

// ========================================
// Sign up with Email/Password
// ========================================
async function emailSignUp(email, password, name) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email,
            password,
            data: name ? { full_name: name } : {}
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error_description || data.msg || 'Signup failed');
    }

    // If session returned, store tokens
    if (data.access_token) {
        localStorage.setItem('sb-access-token', data.access_token);
        localStorage.setItem('sb-refresh-token', data.refresh_token);
    }

    return data;
}

// ========================================
// Sign in with Email/Password
// ========================================
async function emailSignIn(email, password) {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error_description || data.msg || 'Login failed');
    }

    localStorage.setItem('sb-access-token', data.access_token);
    localStorage.setItem('sb-refresh-token', data.refresh_token);

    return data;
}

// ========================================
// Handle OAuth callback
// ========================================
async function handleAuthCallback() {
    const hash = window.location.hash;
    const search = window.location.search;

    // Check for auth code or tokens in URL
    if (hash.includes('access_token') || search.includes('code')) {
        const params = new URLSearchParams(hash.substring(1) || search);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken) {
            localStorage.setItem('sb-access-token', accessToken);
            if (refreshToken) {
                localStorage.setItem('sb-refresh-token', refreshToken);
            }
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
            return await getCurrentUser();
        }
    }

    // Try to refresh existing session
    return await getCurrentUser();
}

// ========================================
// Decode JWT payload
// ========================================
function decodeJwt(token) {
    try {
        const payload = token.split('.')[1];
        const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
        return decoded;
    } catch (e) {
        return null;
    }
}

// ========================================
// Get current user
// ========================================
async function getCurrentUser() {
    const accessToken = localStorage.getItem('sb-access-token');
    if (!accessToken) return null;

    // First try the API
    try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (response.ok) {
            const raw = await response.json();
            // Normalize: Supabase returns raw_user_meta_data, we want user_metadata
            const user = {
                id: raw.id,
                email: raw.email,
                user_metadata: raw.user_metadata || raw.raw_user_meta_data || {}
            };
            localStorage.setItem('sb-user', JSON.stringify(user));
            return user;
        } else if (response.status === 401) {
            const refreshed = await refreshSession();
            if (refreshed) return refreshed;
        }
    } catch (e) {
        console.error('Auth API check failed, falling back to JWT:', e);
    }

    // Fallback: decode user data from the JWT itself
    const payload = decodeJwt(accessToken);
    if (payload && payload.email) {
        const meta = payload.user_metadata || payload.raw_user_meta_data || {};
        const user = {
            id: payload.sub,
            email: payload.email,
            user_metadata: {
                full_name: meta.full_name || meta.name || payload.email.split('@')[0],
                avatar_url: meta.avatar_url || meta.picture || null
            }
        };
        localStorage.setItem('sb-user', JSON.stringify(user));
        return user;
    }

    // Last resort: check cached user
    const cached = localStorage.getItem('sb-user');
    if (cached) {
        try { return JSON.parse(cached); } catch (e) {}
    }

    return null;
}

// ========================================
// Refresh session
// ========================================
async function refreshSession() {
    const refreshToken = localStorage.getItem('sb-refresh-token');
    if (!refreshToken) return null;

    try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refresh_token: refreshToken })
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('sb-access-token', data.access_token);
            localStorage.setItem('sb-refresh-token', data.refresh_token);
            return data.user;
        }
    } catch (e) {
        console.error('Token refresh failed:', e);
    }

    // Refresh failed, clear tokens
    localStorage.removeItem('sb-access-token');
    localStorage.removeItem('sb-refresh-token');
    return null;
}

// ========================================
// Sign out
// ========================================
async function signOut() {
    const accessToken = localStorage.getItem('sb-access-token');
    if (accessToken) {
        try {
            await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${accessToken}`
                }
            });
        } catch (e) {
            // Ignore logout errors
        }
    }
    localStorage.removeItem('sb-access-token');
    localStorage.removeItem('sb-refresh-token');
    window.location.href = 'index.html';
}

// ========================================
// Check session (returns promise)
// ========================================
async function checkSession() {
    return await getCurrentUser();
}
