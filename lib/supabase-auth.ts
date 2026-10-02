import { cookies } from "next/headers";

const ACCESS_COOKIE = "cc_access_token";
const REFRESH_COOKIE = "cc_refresh_token";

export type AuthUser = {
  id: string;
  email?: string | null;
};

type AuthSessionPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: AuthUser;
  error?: string;
  error_description?: string;
  msg?: string;
  message?: string;
};

export type RpcResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
};

function supabaseBaseUrl() {
  const rawUrl = process.env.SUPABASE_URL;
  if (!rawUrl) throw new Error("SUPABASE_URL manquante.");

  return rawUrl
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/i, "");
}

function publishableKey() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error("SUPABASE_PUBLISHABLE_KEY manquante.");
  return key;
}

function authError(payload: AuthSessionPayload | null, fallback: string) {
  return (
    payload?.error_description ||
    payload?.msg ||
    payload?.message ||
    payload?.error ||
    fallback
  );
}

async function authFetch(path: string, init: RequestInit) {
  return fetch(`${supabaseBaseUrl()}${path}`, {
    ...init,
    headers: {
      apikey: publishableKey(),
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}

async function storeSession(payload: AuthSessionPayload) {
  if (!payload.access_token || !payload.refresh_token) return;

  const store = await cookies();
  const secure = process.env.NODE_ENV === "production";

  store.set(ACCESS_COOKIE, payload.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(60, payload.expires_in ?? 3600),
  });

  store.set(REFRESH_COOKIE, payload.refresh_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookies() {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function signInWithPassword(email: string, password: string) {
  const response = await authFetch("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  const payload = (await response.json().catch(() => null)) as AuthSessionPayload | null;

  if (!response.ok || !payload?.access_token || !payload.refresh_token) {
    return {
      ok: false,
      status: response.status,
      error: authError(payload, "Connexion impossible."),
      user: null,
    };
  }

  await storeSession(payload);

  return {
    ok: true,
    status: response.status,
    error: null,
    user: payload.user ?? null,
  };
}

export async function signUpWithPassword(
  email: string,
  password: string,
  displayName: string
) {
  const response = await authFetch("/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      data: { display_name: displayName },
    }),
  });

  const payload = (await response.json().catch(() => null)) as AuthSessionPayload | null;

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: authError(payload, "Création du compte impossible."),
      signedIn: false,
      user: null,
    };
  }

  const signedIn = Boolean(payload?.access_token && payload?.refresh_token);
  if (signedIn && payload) await storeSession(payload);

  return {
    ok: true,
    status: response.status,
    error: null,
    signedIn,
    user: payload?.user ?? null,
  };
}

async function readUser(accessToken: string) {
  const response = await authFetch("/auth/v1/user", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) return null;
  return (await response.json()) as AuthUser;
}

async function refreshSession(refreshToken: string) {
  const response = await authFetch("/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  const payload = (await response.json().catch(() => null)) as AuthSessionPayload | null;
  if (!response.ok || !payload?.access_token || !payload.refresh_token) return null;

  await storeSession(payload);
  return payload;
}

export async function getAuthenticatedSession(): Promise<{
  user: AuthUser;
  accessToken: string;
} | null> {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;

  if (accessToken) {
    const user = await readUser(accessToken);
    if (user?.id) return { user, accessToken };
  }

  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    await clearSessionCookies();
    return null;
  }

  const refreshed = await refreshSession(refreshToken);
  if (!refreshed?.access_token) {
    await clearSessionCookies();
    return null;
  }

  const user = refreshed.user ?? (await readUser(refreshed.access_token));
  if (!user?.id) {
    await clearSessionCookies();
    return null;
  }

  return { user, accessToken: refreshed.access_token };
}

export async function authenticatedRpc<T>(
  functionName: string,
  body: Record<string, unknown>,
  accessToken: string
): Promise<RpcResult<T>> {
  const response = await fetch(
    `${supabaseBaseUrl()}/rest/v1/rpc/${functionName}`,
    {
      method: "POST",
      headers: {
        apikey: publishableKey(),
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );

  const raw = await response.text();
  let parsed: unknown = null;

  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw;
    }
  }

  if (!response.ok) {
    const obj = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    const error =
      (typeof obj?.message === "string" && obj.message) ||
      (typeof obj?.details === "string" && obj.details) ||
      (typeof parsed === "string" && parsed) ||
      `RPC ${functionName} impossible.`;

    return { ok: false, status: response.status, data: null, error };
  }

  return { ok: true, status: response.status, data: parsed as T, error: null };
}
