/**
 * Auth utilities for Empowered Vote SSO integration.
 *
 * Flow:
 * 1. Check URL hash for access_token (post-SSO redirect)
 * 2. Fall back to localStorage
 * 3. Fall back to silent session renewal via ev_session cookie
 *
 * See: EV-Accounts/docs/INTEGRATION-GUIDE-v2.md §3.3
 */

const TOKEN_KEY = 'ev_token';

const AUTH_BASE = import.meta.env.PROD && import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

export interface UserSession {
  tier: 'inform' | 'connected' | 'empowered';
  jurisdiction: {
    city: string | null;
    state: string | null;
  } | null;
}

function storeToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Extract access_token from URL hash after SSO redirect.
 * Cleans the hash from the URL so it isn't bookmarked or shared.
 */
function extractHashToken(): string | null {
  if (!window.location.hash) return null;
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const token = hash.get('access_token');
  if (token) {
    storeToken(token);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  return token;
}

/**
 * Attempt silent session renewal using the ev_session httpOnly cookie.
 * This works when the user is already logged in on another EV app.
 * Silently returns null if no session exists or the request fails.
 */
async function silentSessionRenewal(): Promise<string | null> {
  try {
    const res = await fetch(`${AUTH_BASE}/auth/session`, { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.access_token) {
      storeToken(data.access_token);
      return data.access_token;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve the current access token, trying sources in priority order:
 * hash fragment → localStorage → silent cookie renewal
 */
export async function resolveToken(): Promise<string | null> {
  const hashToken = extractHashToken();
  if (hashToken) return hashToken;

  const stored = getStoredToken();
  if (stored) return stored;

  return silentSessionRenewal();
}

/**
 * Fetch the current user's tier and jurisdiction from /api/account/me.
 * Clears the stored token if it is expired or invalid.
 * Returns null if the request fails or the user is unauthenticated.
 */
export async function fetchUserSession(token: string): Promise<UserSession | null> {
  try {
    const res = await fetch(`${AUTH_BASE}/account/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      // Expired or revoked — clear so we don't retry with a bad token
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    const data = await res.json();
    return {
      tier: data.tier,
      jurisdiction: data.jurisdiction
        ? { city: data.jurisdiction.city ?? null, state: data.jurisdiction.state ?? null }
        : null,
    };
  } catch {
    return null;
  }
}

/**
 * Build the SSO login redirect URL that returns the user to Treasury Tracker.
 */
export function getLoginUrl(): string {
  const returnUrl = window.location.origin + '/';
  return `https://accounts.empowered.vote/login?redirect=${encodeURIComponent(returnUrl)}`;
}
