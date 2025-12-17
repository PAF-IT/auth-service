import "dotenv/config";
import {env} from "prisma/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import bodyParser from "body-parser";
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


async function bootstrap() {
    const adapter = new PrismaMariaDb({
        host: env("DATABASE_HOST") || 'localhost',
        user: env("DATABASE_USER"),
        password: env("DATABASE_PASSWORD"),
        database: env("DATABASE_NAME"),
        port: parseInt(env("DATABASE_PORT") || '3306'),
        connectionLimit: 10
    });
    const prisma = new PrismaClient({adapter});
    const clientRepository = new ClientRepository(prisma);
    const userRepository = new UserRepository(prisma);
    const magicLinkTokenRepository = new MagicLinkTokenRepository(prisma);

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
        new TokenRepository(prisma),
        new ScopeRepository(prisma),
        new MyCustomJwtService(process.env.OAUTH_CODES_SECRET!),
        serverOptions
    );
    const magicLinkGrant = new MagicLinkGrant(
        clientRepository,
        magicLinkTokenRepository,
        new TokenRepository(prisma),
        new ScopeRepository(prisma),
        userRepository,
        new MyCustomJwtService(process.env.OAUTH_CODES_SECRET!),
        serverOptions,
    );

    authorizationServer.enableGrantTypes(
        [{grant: magicLinkGrant}, new DateInterval("15m")]
    );

    const app = Express();

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));

    // app.get("/authorize", async (req: Express.Request, res: Express.Response) => {
    //     try {
    //         // Validate the HTTP request and return an AuthorizationRequest object.
    //         const authRequest = await authorizationServer.validateAuthorizationRequest(req);
    //
    //         // The auth request object can be serialized and saved into a user's session.
    //         // You will probably want to redirect the user at this point to a login endpoint.
    //
    //         // Once the user has logged in set the user on the AuthorizationRequest
    //         console.log("Once the user has logged in set the user on the AuthorizationRequest");
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
            console.log("/auth/magic-link/send req=" + JSON.stringify(req.body));
            const { email, clientId } = req.body;
            const user = await userRepository.getUserByEmail(email);
            console.log("/auth/magic-link/send user=" + user);

            const client = await clientRepository.getByIdentifier(clientId)

            // TODO: check if user scope includes requested service/client/URL

            if (user && client) {

                const scopes: Scope[] = []

                // Create magic token
                const token = await magicLinkTokenRepository.issueAuthCode(client, user, scopes);

                // Generate magic link
                const magicLink = `${process.env.APP_URL}/auth/magic-link/verify?token=${token.code}`;
                console.log("/auth/magic-link/send: magicLink=", magicLink);

                // Send email
                // await emailService.send({
                //   to: email,
                //   subject: "Your magic login link",
                //   body: `Click here to log in: ${magicLink}`
                // });
            }
            return res.json({ message: "If the email exists, a magic link was sent" });
        } catch (e) {
            handleExpressError(e, res);
            return;
        }
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
    console.log("app is listening on http://localhost:3000");
}

bootstrap().catch(console.log);
