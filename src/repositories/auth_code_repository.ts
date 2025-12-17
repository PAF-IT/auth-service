import { PrismaClient } from "../../generated/prisma/client";
import { DateInterval, generateRandomToken, OAuthAuthCode, OAuthAuthCodeRepository } from "@jmondi/oauth2-server";
import { AuthCode } from "../entities/auth_code";
import { Client } from "../entities/client";
import { Scope } from "../entities/scope";
import { User } from "../entities/user";

export class AuthCodeRepository implements OAuthAuthCodeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getByIdentifier(authCodeCode: string): Promise<AuthCode> {
    const entity = await this.prisma.oAuthAuthCode.findUnique({
      where: {
        code: authCodeCode,
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
      console.info("AuthCodeRepository.getByIdentifier: authCodeCode '"+authCodeCode+ "' not found");
      // TODO: fix return type issue instead of @ts-ignore it!
      // @ts-ignore
      return null;
    }

    return new AuthCode({
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

  async isRevoked(authCodeCode: string): Promise<boolean> {
    const authCode = await this.getByIdentifier(authCodeCode);
    return authCode?.isExpired;
  }

  issueAuthCode(client: Client, user: User | undefined, scopes: Scope[]): OAuthAuthCode {
    return new AuthCode({
      redirectUri: null,
      code: generateRandomToken(),
      codeChallenge: null,
      codeChallengeMethod: "S256",
      expiresAt: new DateInterval("15m").getEndDate(),
      client,
      user,
      scopes,
    });
  }

  async persist(authCode: AuthCode): Promise<void> {
    await this.prisma.oAuthAuthCode.create({
      data: {
        code: authCode.code,
        redirectUri: authCode.redirectUri,
        codeChallenge: authCode.codeChallenge,
        codeChallengeMethod: authCode.codeChallengeMethod ?? "plain",
        expiresAt: authCode.expiresAt,
        clientId: authCode.clientId,
        userId: authCode.userId,
      }
    });
  }

  async revoke(authCodeCode: string): Promise<void> {
    await this.prisma.oAuthAuthCode.update({
      where: { code: authCodeCode },
      data: {
        expiresAt: new Date(0),
      },
    });
  }
}
