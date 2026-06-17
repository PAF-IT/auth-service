// Minimal server-rendered HTML for the login surface. Intentionally tiny —
// this is the SSO login page, not a styled product UI.

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:28rem;margin:4rem auto;padding:0 1rem;line-height:1.5}
input,button{font:inherit;padding:.5rem .6rem;box-sizing:border-box}
input{width:100%;margin:.5rem 0}
button{cursor:pointer}
.muted{color:#666;font-size:.9rem}
.error{color:#b00}
</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
}

// `redirect` is the (already-validated) URL to return to after login.
export function loginPage(redirect: string): string {
  return page(
    "Sign in",
    `<p>Enter your email and we'll send you a magic link.</p>
     <form method="POST" action="/auth/magic-link/send">
       <input type="hidden" name="redirect" value="${escapeHtml(redirect)}">
       <input type="email" name="email" required placeholder="you@example.com" autofocus>
       <button type="submit">Send magic link</button>
     </form>`,
  );
}

export function linkSentPage(email: string): string {
  return page(
    "Check your email",
    `<p>If <strong>${escapeHtml(email)}</strong> is a registered member, a magic link is on its way.</p>
     <p class="muted">Staging: the link is also printed in the auth-service pod logs.</p>`,
  );
}

export function loginFailedPage(): string {
  return page(
    "Sign in failed",
    `<p class="error">That link is invalid or has expired.</p>
     <p><a href="/login">Try again</a></p>`,
  );
}
