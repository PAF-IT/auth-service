import type { Request, Response } from "express";

// Single SSO session cookie, scoped to the whole pa-f.net domain so one login
// is valid across every *.pa-f.net subdomain. Signed (cookie-parser) and
// httpOnly so the browser can't read or forge it; the access token inside is
// re-validated against the DB on every gateway ext_authz check.

const COOKIE_NAME = "paf_session";

export type Session = { accessToken: string; exp: number };

function cookieDomain(): string | undefined {
  // e.g. ".pa-f.net". Omit in local dev so localhost works.
  return process.env.COOKIE_DOMAIN || undefined;
}

export function readSession(req: Request): Session | null {
  const raw = (req.signedCookies as Record<string, string> | undefined)?.[COOKIE_NAME];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.accessToken || parsed.exp * 1000 < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setSession(res: Response, session: Session): void {
  res.cookie(COOKIE_NAME, JSON.stringify(session), {
    httpOnly: true,
    signed: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    domain: cookieDomain(),
    maxAge: Math.max(0, session.exp * 1000 - Date.now()),
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    signed: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    domain: cookieDomain(),
  });
}
