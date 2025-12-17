import {
    AbstractGrant,
    DateInterval,
    GrantIdentifier,
    OAuthException,
    RequestInterface
} from "@jmondi/oauth2-server";
import {Client} from "../entities/client";
import {User} from "../entities/user";
import {MagicLinkTokenRepository} from "../repositories/magic_link_token_repository";
import {OAuthTokenRepository} from "@jmondi/oauth2-server/src/repositories/access_token.repository";
import {OAuthScopeRepository} from "@jmondi/oauth2-server/src/repositories/scope.repository";
import {JwtInterface} from "@jmondi/oauth2-server/src/utils/jwt";
import {AuthorizationServerOptions} from "@jmondi/oauth2-server/src/authorization_server";
import {UserRepository} from "../repositories/user_repository";
import {ClientRepository} from "../repositories/client_repository";

export class MagicLinkGrant extends AbstractGrant {

    readonly identifier: GrantIdentifier = "custom:magic_link";
    protected readonly supportedGrantTypes: GrantIdentifier[] = ["custom:magic_link"];
    private _clientRepository;
    private magicLinkTokenRepository: MagicLinkTokenRepository;
    protected userRepository: UserRepository;

    constructor(
        clientRepository: ClientRepository,
        magicLinkTokenRepository: MagicLinkTokenRepository,
        tokenRepository: OAuthTokenRepository,
        scopeRepository: OAuthScopeRepository,
        userRepository: UserRepository,
        jwt: JwtInterface,
        options: AuthorizationServerOptions,
    ) {
        super(clientRepository, tokenRepository, scopeRepository, jwt, options);
        this._clientRepository = clientRepository;
        this.magicLinkTokenRepository = magicLinkTokenRepository
        this.userRepository = userRepository;
    }

    async respondToAccessTokenRequest(req: RequestInterface) {

        // Validate client
        await this.validateClient(req);

        // Get the token from request
        const token = this.getRequestParameter("token", req);

        if (!token) {
            throw OAuthException.badRequest("token missing");
        }

        // Verify the magic link token
        const entities = await this.verifyMagicToken(token);

        if (!entities?.user) {
            throw OAuthException.invalidGrant();
        }

        // Issue access token
        const accessToken = await this.issueAccessToken(
            new DateInterval("15m"),
            entities.client,
            entities.user
        );

        return this.makeBearerTokenResponse(entities.client, accessToken);
    }

    private async verifyMagicToken(token: string): Promise<{user: User, client: Client} | null> {
        // Implement your token verification logic
        // This should:
        // 1. Check if token exists and is valid
        // 2. Check if token hasn't expired
        // 3. Return the associated user
        // 4. Invalidate the token after use

        console.log("[DEBUG] Verifying magic token:", token);
        const magicToken = await this.magicLinkTokenRepository.getByIdentifier(token);

        console.log("[DEBUG] Magic token found:", !!magicToken);
        console.log("[DEBUG] Magic token expired:", magicToken?.isExpired);
        console.log("[DEBUG] Magic token userId:", magicToken?.userId);

        if (!magicToken || magicToken.isExpired || !magicToken.userId) {
            console.log("[DEBUG] Token verification failed - returning null");
            return null;
        }

        const client = await this._clientRepository.getByIdentifier(magicToken.clientId);
        const user = await this.userRepository.getUserByCredentials(magicToken.userId);

        console.log("[DEBUG] Client found:", !!client);
        console.log("[DEBUG] User found:", !!user);

        // Delete token after verification (single use)
        await this.magicLinkTokenRepository.delete(magicToken.code);

        return {user, client};
    }
}