import express from "express";
import cookieParser from "cookie-parser";

const AUTH_SERVICE_URL = required("AUTH_SERVICE_URL");
const OAUTH_CLIENT_ID = required("OAUTH_CLIENT_ID");
const OAUTH_CLIENT_SECRET = required("OAUTH_CLIENT_SECRET");
const COOKIE_SECRET = required("COOKIE_SECRET");
const PORT = parseInt(process.env.PORT || "3000");
const COOKIE_NAME = "session";

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`missing required env var ${name}`);
    process.exit(2);
  }
  return v;
}

type Session = { accessToken: string; email: string; exp: number };

function readSession(req: express.Request): Session | null {
  const raw = req.signedCookies[COOKIE_NAME];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.accessToken || parsed.exp * 1000 < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setSession(res: express.Response, session: Session) {
  res.cookie(COOKIE_NAME, JSON.stringify(session), {
    httpOnly: true,
    signed: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.max(0, session.exp * 1000 - Date.now()),
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

function page(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;line-height:1.5}
input,button{font:inherit;padding:.4rem .6rem}
form{margin:1rem 0}
.muted{color:#666}
.error{color:#b00}
</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
}

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser(COOKIE_SECRET));

app.get("/", (req, res) => {
  const session = readSession(req);
  if (session) {
    res.send(
      page(
        "Logged in",
        `<p>Logged in as <strong>${escapeHtml(session.email)}</strong>.</p>
         <form method="POST" action="/logout"><button type="submit">Log out</button></form>`,
      ),
    );
    return;
  }
  res.send(
    page(
      "Log in",
      `<p>Enter your email to receive a magic link.</p>
       <form method="POST" action="/login">
         <input type="email" name="email" required placeholder="you@example.com" autofocus>
         <button type="submit">Send link</button>
       </form>`,
    ),
  );
});

app.post("/login", async (req, res) => {
  const email = String(req.body.email || "").trim();
  if (!email) {
    res.status(400).send(page("Log in", `<p class="error">Email is required.</p><p><a href="/">Back</a></p>`));
    return;
  }
  try {
    const r = await fetch(`${AUTH_SERVICE_URL}/auth/magic-link/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, clientId: OAUTH_CLIENT_ID }),
    });
    if (!r.ok) console.error(`magic-link/send returned ${r.status}: ${await r.text()}`);
  } catch (e) {
    console.error("magic-link/send failed", e);
  }
  res.send(
    page(
      "Check your email",
      `<p>If <strong>${escapeHtml(email)}</strong> is a registered member, a magic link was sent.</p>
       <p class="muted">(For staging: check the auth-service pod logs for the link URL.)</p>
       <p><a href="/">Back</a></p>`,
    ),
  );
});

app.get("/callback", async (req, res) => {
  const token = String(req.query.token || "");
  if (!token) {
    res.status(400).send(page("Login failed", `<p class="error">Missing token.</p><p><a href="/">Back</a></p>`));
    return;
  }

  try {
    const tokenRes = await fetch(`${AUTH_SERVICE_URL}/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "custom:magic_link",
        client_id: OAUTH_CLIENT_ID,
        client_secret: OAUTH_CLIENT_SECRET,
        token,
      }),
    });
    if (!tokenRes.ok) {
      const detail = await tokenRes.text();
      console.error(`/token returned ${tokenRes.status}: ${detail}`);
      res
        .status(401)
        .send(page("Login failed", `<p class="error">Token exchange failed.</p><p><a href="/">Try again</a></p>`));
      return;
    }
    const tokenJson = (await tokenRes.json()) as {
      access_token: string;
      expires_in: number;
      token_type: string;
    };

    const introspectRes = await fetch(`${AUTH_SERVICE_URL}/token/introspect`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: tokenJson.access_token }),
    });
    let email = "(unknown)";
    if (introspectRes.ok) {
      const introspect = (await introspectRes.json()) as { active?: boolean; email?: string; username?: string };
      email = introspect.email ?? introspect.username ?? email;
    } else {
      console.error(`/token/introspect returned ${introspectRes.status}: ${await introspectRes.text()}`);
    }

    setSession(res, {
      accessToken: tokenJson.access_token,
      email,
      exp: Math.floor(Date.now() / 1000) + tokenJson.expires_in,
    });
    res.redirect("/");
  } catch (e) {
    console.error("callback failed", e);
    res
      .status(500)
      .send(page("Login failed", `<p class="error">Server error.</p><p><a href="/">Try again</a></p>`));
  }
});

app.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.redirect("/");
});

app.listen(PORT, () => {
  console.log(`test-client listening on :${PORT}, auth-service=${AUTH_SERVICE_URL}`);
});
