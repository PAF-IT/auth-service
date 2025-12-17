import {DateInterval, generateRandomToken, OAuthAuthCodeRepository} from "@jmondi/oauth2-server";
import {PrismaClient} from "../../generated/prisma/client";
import {MagicLinkToken} from "../entities/magic_link_token";
import {Client} from "../entities/client";
import {User} from "../entities/user";
import {Scope} from "../entities/scope";


export class MagicLinkTokenRepository implements OAuthAuthCodeRepository {
    constructor(private readonly prisma: PrismaClient) {}

    async getByIdentifier(code: string): Promise<MagicLinkToken> {
        const entity = await this.prisma.oAuthAuthCode.findUnique({
            where: {
                code: code,
            },
            include: {
                client: {
                    include: {
                        scopes: true,
                    },
                },
                user: true,
                scopes: true,
            },
        });

        if (!entity) {
            console.info("MagicLinkTokenRepository.getByIdentifier: code '"+code+ "' not found");
            // TODO: fix return type issue instead of @ts-ignore it!
            // @ts-ignore
            return null;
        }

        return new MagicLinkToken({
            code: entity.code,
            redirectUri: entity.redirectUri ?? undefined,
            codeChallenge: entity.codeChallenge ?? undefined,
            codeChallengeMethod: entity.codeChallengeMethod as "S256" | "plain",
            expiresAt: entity.expiresAt,
            client: {
                id: entity.client.id,
                name: entity.client.name,
                secret: entity.client.secret,
                redirectUris: entity.client.redirectUris as string[],
                allowedGrants: entity.client.allowedGrants as any[],
                scopes: entity.client.scopes.map(s => ({
                    name: s.name,
                })),
            },
            user: entity.user ? {
                id: entity.user.id,
                email: entity.user.email,
            } : undefined,
            scopes: entity.scopes.map(s => ({
                name: s.name,
            })),
        });
    }

    async issueAuthCode(client: Client, user: User | undefined, scopes: Scope[]): Promise<MagicLinkToken> {
        const token = new MagicLinkToken({
            redirectUri: null,
            code: generateRandomToken(),
            codeChallenge: null,
            codeChallengeMethod: "S256",
            expiresAt: new DateInterval("15m").getEndDate(),
            client,
            user,
            scopes,
        });
        await this.persist(token);
        return token;
    }

    async delete(code: string): Promise<void> {
        await this.prisma.oAuthAuthCode.delete({where: {code: code}});
    }

    isExpired(magicToken: MagicLinkToken): boolean {
        return magicToken.expiresAt < new Date();
    }


    async isRevoked(code: string): Promise<boolean> {
        const authCode = await this.getByIdentifier(code);
        return authCode?.isExpired;
    }

    async persist({ user, client, scopes, ...authCode }: MagicLinkToken): Promise<void> {
        await this.prisma.oAuthAuthCode.create({ data: authCode });
    }

    async revoke(code: string): Promise<void> {
        await this.prisma.oAuthAuthCode.update({
            where: { code: code },
            data: {
                expiresAt: new Date(0),
            },
        });
    }
}