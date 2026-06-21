import "dotenv/config";
import {env} from "prisma/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import { Logger, ILogObj } from "tslog";
import Express from "express";
import { AuthorizationServer, DateInterval, AuthorizationServerOptions } from "@jmondi/oauth2-server";
import { handleExpressError, handleExpressResponse } from "@jmondi/oauth2-server/express";

import { ClientRepository } from "./repositories/client_repository.js";
import { ScopeRepository } from "./repositories/scope_repository.js";
import { TokenRepository } from "./repositories/token_repository.js";
import { UserRepository } from "./repositories/user_repository.js";
import { MyCustomJwtService } from "./utils/custom_jwt_service.js";
import {MagicLinkGrant} from "./grants/magic_link_grant";
import {MagicLinkTokenRepository} from "./repositories/magic_link_token_repository";
import {Scope} from "./entities/scope";
import { clearSession, readSession, setSession } from "./utils/session.js";
import { linkSentPage, loginFailedPage, loginPage } from "./views.js";


const log: Logger<ILogObj> = new Logger();

// Only redirect back to https URLs on our own domain — prevents the login
// flow from being abused as an open redirect.
function safeRedirect(target: string | undefined): string {
  const fallback = (process.env.AUTH_PUBLIC_URL || "") + "/login";
  if (!target) return fallback;
  try {
    const u = new URL(target);
    if (u.protocol === "https:" && (u.hostname === "pa-f.net" || u.hostname.endsWith(".pa-f.net"))) {
      return u.toString();
    }
  } catch { /* not an absolute URL */ }
  return fallback;
}

// Reconstruct the URL the user originally tried to reach, from the headers
// Envoy forwards to the ext_authz endpoint.
function originalUrl(req: Express.Request): string {
  const h = req.headers;
  const proto = (h["x-forwarded-proto"] as string) || "https";
  const host = (h["x-forwarded-host"] as string) || (h["host"] as string) || "";
  const uri =
    (h["x-forwarded-uri"] as string) ||
    (h["x-envoy-original-path"] as string) ||
    (h["x-original-uri"] as string) ||
    (h["x-forwarded-path"] as string) ||
    "/";
  return `${proto}://${host}${uri}`;
}


async function bootstrap() {
    const adapter = new PrismaMariaDb({
        host: env("MYSQL_HOST") || 'localhost',
        user: env("MYSQL_USER"),
        password: env("MYSQL_PASSWORD"),
        database: env("MYSQL_DB_NAME"),
        port: parseInt(env("MYSQL_PORT") || '3306'),
        connectionLimit: 10,
        // The shared MySQL 8 server authenticates this user with
        // caching_sha2_password. Over a non-TLS connection the mariadb driver
        // won't fetch the server's RSA public key unless we opt in, so every
        // connection attempt fails and the pool times out (active=0 idle=0).
        allowPublicKeyRetrieval: true
    });
    const prisma = new PrismaClient({adapter});
    const clientRepository = new ClientRepository(prisma);
    const userRepository = new UserRepository(prisma);
    const tokenRepository = new TokenRepository(prisma);
    const magicLinkTokenRepository = new MagicLinkTokenRepository(prisma);

    const SSO_CLIENT_ID = process.env.SSO_CLIENT_ID!;
    const SSO_CLIENT_SECRET = process.env.SSO_CLIENT_SECRET!;

    const serverOptions: AuthorizationServerOptions = {
        requiresPKCE: true,
        requiresS256: true,
        notBeforeLeeway: 0,
        tokenCID: "id",
        scopeDelimiter: " ",
        authenticateIntrospect: false,
        authenticateRevoke: true,
    };

    const authorizationServer = new AuthorizationServer(
        clientRepository,
        tokenRepository,
        new ScopeRepository(prisma),
        new MyCustomJwtService(process.env.OAUTH_CODES_SECRET!),
        serverOptions
    );
    const magicLinkGrant = new MagicLinkGrant(
        clientRepository,
        magicLinkTokenRepository,
        tokenRepository,
        new ScopeRepository(prisma),
        userRepository,
        new MyCustomJwtService(process.env.OAUTH_CODES_SECRET!),
        serverOptions,
    );

    authorizationServer.enableGrantTypes(
        [{grant: magicLinkGrant}, new DateInterval("1h")]
    );

    const app = Express();

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(cookieParser(process.env.COOKIE_SECRET));

    // Login page (unauthenticated). Carries the post-login destination.
    app.get("/login", (req: Express.Request, res: Express.Response) => {
        const redirect = safeRedirect(
            typeof req.query.redirect === "string" ? req.query.redirect : undefined,
        );
        res.type("html").send(loginPage(redirect));
    });

    // app.get("/authorize", async (req: Express.Request, res: Express.Response) => {
    //     try {
    //         // Validate the HTTP request and return an AuthorizationRequest object.
    //         const authRequest = await authorizationServer.validateAuthorizationRequest(req);
    //
    //         // The auth request object can be serialized and saved into a user's session.
    //         // You will probably want to redirect the user at this point to a login endpoint.
    //
    //         // Once the user has logged in set the user on the AuthorizationRequest
    //         log.debug("Once the user has logged in set the user on the AuthorizationRequest");
    //         authRequest.user = { id: "abc", email: "user@example.com" };
    //
    //         // At this point you should redirect the user to an authorization page.
    //         // This form will ask the user to approve the client and the scopes requested.
    //
    //         // Once the user has approved or denied the client update the status
    //         // (true = approved, false = denied)
    //         authRequest.isAuthorizationApproved = true;
    //
    //         // Return the HTTP redirect response
    //         const oauthResponse = await authorizationServer.completeAuthorizationRequest(authRequest);
    //         return handleExpressResponse(res, oauthResponse);
    //     } catch (e) {
    //         handleExpressError(e, res);
    //     }
    // });

    app.post("/auth/magic-link/send", async (req: Express.Request, res: Express.Response) => {
        try {
            const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
            const redirect = safeRedirect(
                typeof req.body?.redirect === "string" ? req.body.redirect : undefined,
            );
            // Log entry before any DB work so a failing lookup below is still
            // traceable — otherwise a thrown query leaves no record the handler ran.
            log.debug(`/auth/magic-link/send: received email=${email || "(empty)"}`);
            if (!email) {
                return res.status(400).json({ error: "email is required" });
            }

            // The login flow always authenticates against the internal SSO client.
            const user = await userRepository.getUserByEmail(email);
            const client = await clientRepository.getByIdentifier(SSO_CLIENT_ID);
            log.debug(
                `/auth/magic-link/send: email=${email} user=${user ? user.id : "null"} ` +
                `client=${client ? client.id : "null"}`,
            );

            if (user && client) {
                const scopes: Scope[] = [];
                const token = await magicLinkTokenRepository.issueAuthCode(client, user, scopes);

                // The magic link lands on /callback (registered as the SSO client's
                // redirect URI) and carries where to go after a successful login.
                const redirects = client.redirectUris as string[];
                if (!redirects?.length) {
                    throw new Error(`OAuthClient ${client.id} has no redirectUris`);
                }
                const magicLink =
                    `${redirects[0]}?token=${token.code}&redirect=${encodeURIComponent(redirect)}`;
                log.debug("/auth/magic-link/send: magicLink=", magicLink);

                // Send email
                // await emailService.send({
                //   to: email,
                //   subject: "Your magic login link",
                //   body: `Click here to log in: ${magicLink}`
                // });
            }

            // Always the same response — don't reveal whether the email is a member.
            return res.type("html").send(linkSentPage(email));
        } catch (e) {
            // handleExpressError only formats OAuthErrors and re-throws anything
            // else (e.g. DB errors), which would silently surface as a bare 500.
            // Log it and keep the uniform response so we don't reveal internals.
            log.error("/auth/magic-link/send error", e);
            const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
            return res.type("html").send(linkSentPage(email));
        }
    });

    // Magic-link landing: exchange the one-time code for an access token,
    // store it in the SSO cookie, then bounce to the original destination.
    app.get("/callback", async (req: Express.Request, res: Express.Response) => {
        try {
            const code = typeof req.query.token === "string" ? req.query.token : "";
            const redirect = safeRedirect(
                typeof req.query.redirect === "string" ? req.query.redirect : undefined,
            );
            if (!code) {
                return res.status(400).type("html").send(loginFailedPage());
            }

            const oauthResponse = await authorizationServer.respondToAccessTokenRequest({
                query: {},
                headers: {},
                body: {
                    grant_type: "custom:magic_link",
                    client_id: SSO_CLIENT_ID,
                    client_secret: SSO_CLIENT_SECRET,
                    token: code,
                },
            } as any);

            const body = oauthResponse.body as { access_token?: string; expires_in?: number };
            if (!body.access_token) {
                return res.status(401).type("html").send(loginFailedPage());
            }

            setSession(res, {
                accessToken: body.access_token,
                exp: Math.floor(Date.now() / 1000) + (body.expires_in ?? 0),
            });
            return res.redirect(redirect);
        } catch (e) {
            log.error("/callback error", e);
            return res.status(401).type("html").send(loginFailedPage());
        }
    });

    // Gateway ext_authz endpoint. Valid session -> 200 + identity headers that
    // Envoy injects into the upstream request. Otherwise -> 302 to login,
    // carrying the originally-attempted URL.
    app.get("/auth/verify", async (req: Express.Request, res: Express.Response) => {
        const toLogin = () => {
            const loginUrl =
                `${process.env.AUTH_PUBLIC_URL || ""}/login` +
                `?redirect=${encodeURIComponent(safeRedirect(originalUrl(req)))}`;
            return res.redirect(302, loginUrl);
        };

        try {
            const session = readSession(req);
            if (!session) return toLogin();

            const introspection = await authorizationServer.introspect({
                query: {},
                headers: {},
                body: { token: session.accessToken },
            } as any);

            const data = introspection.body as { active?: boolean; sub?: string | number; email?: string };
            if (!data.active || data.sub === undefined) return toLogin();

            const user = await userRepository.getUserByCredentials(String(data.sub));
            const roles = user ? user.roles : ["member"];

            res.setHeader("X-User-Id", String(data.sub));
            if (data.email) res.setHeader("X-User-Email", data.email);
            res.setHeader("X-User-Roles", roles.join(","));
            return res.status(200).end();
        } catch (e) {
            log.error("/auth/verify error", e);
            return toLogin();
        }
    });

    app.post("/logout", (_req: Express.Request, res: Express.Response) => {
        clearSession(res);
        return res.redirect(302, `${process.env.AUTH_PUBLIC_URL || ""}/login`);
    });

    app.post("/token", async (req: Express.Request, res: Express.Response) => {
        try {
            const oauthResponse = await authorizationServer.respondToAccessTokenRequest(req);
            return handleExpressResponse(res, oauthResponse);
        } catch (e) {
            handleExpressError(e, res);
            return;
        }
    });

    app.post("/token/introspect", async (req: Express.Request, res: Express.Response) => {
        try {
            const oauthResponse = await authorizationServer.introspect(req);
            return handleExpressResponse(res, oauthResponse);
        } catch (e) {
            handleExpressError(e, res);
            return;
        }
    });

    app.get("/", (_: Express.Request, res: Express.Response) => {
        res.json({
            success: true,
            GET: ["/authorize"],
            POST: ["/token"],
        });
    });

    app.listen(3000);
    log.info(`app is listening on ${env("APP_URL")}`);
}

bootstrap().catch((e) => log.error("bootstrap failed", e));
