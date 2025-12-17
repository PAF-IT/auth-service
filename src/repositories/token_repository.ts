import { PrismaClient } from "../../generated/prisma/client.js";
import { DateInterval, generateRandomToken, OAuthClient, OAuthTokenRepository } from "@jmondi/oauth2-server";

import { Client } from "../entities/client.js";
import { Scope } from "../entities/scope.js";
import { Token } from "../entities/token.js";
import { User } from "../entities/user.js";

export class TokenRepository implements OAuthTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getByAccessToken(accessToken: string): Promise<Token> {
    const token = await this.prisma.oAuthToken.findUnique({
      where: {
        accessToken,
      },
      include: {
        user: true,
        client: {
          include: {
            scopes: true,
          },
        },
        scopes: true,
      },
    });

    if(!token) {
      console.info("TokenRepository.getByAccessToken: token '" + accessToken + "' not found");
      // TODO: fix return type issue instead of @ts-ignore it!
      // @ts-ignore
      return null;
    }

    return new Token({
      accessToken: token.accessToken,
      accessTokenExpiresAt: token.accessTokenExpiresAt,
      refreshToken: token.refreshToken,
      refreshTokenExpiresAt: token.refreshTokenExpiresAt,
      client: {
        id: token.client.id,
        name: token.client.name,
        secret: token.client.secret,
        redirectUris: token.client.redirectUris as string[],
        allowedGrants: token.client.allowedGrants as any[],
        scopes: token.client.scopes.map(s => ({
          name: s.name,
        })),
      },
      user: token.user ? {
        id: token.user.id,
        email: token.user.email,
        passwordHash: token.user.passwordHash,
      } : null,
      scopes: token.scopes.map(s => ({
        name: s.name,
      })),
    });
  }

  async issueToken(client: Client, scopes: Scope[], user?: User): Promise<Token> {
    return new Token({
      accessToken: generateRandomToken(),
      accessTokenExpiresAt: new DateInterval("2h").getEndDate(),
      refreshToken: null,
      refreshTokenExpiresAt: null,
      client,
      user: user,
      scopes,
    });
  }

  async getByRefreshToken(refreshToken: string): Promise<Token> {
    const token = await this.prisma.oAuthToken.findUnique({
      where: { refreshToken },
      include: {
        client: {
          include: {
            scopes: true,
          },
        },
        scopes: true,
        user: true,
      },
    });

    if (!token) {
      console.info("TokenRepository.getByRefreshToken: token '" + refreshToken + "' not found");
      // TODO: fix return type issue instead of @ts-ignore it!
      // @ts-ignore
      return null;
    }

    return new Token({
      accessToken: token.accessToken,
      accessTokenExpiresAt: token.accessTokenExpiresAt,
      refreshToken: token.refreshToken,
      refreshTokenExpiresAt: token.refreshTokenExpiresAt,
      client: {
        id: token.client.id,
        name: token.client.name,
        secret: token.client.secret,
        redirectUris: token.client.redirectUris as string[],
        allowedGrants: token.client.allowedGrants as any[],
        scopes: token.client.scopes.map(s => ({
          name: s.name,
        })),
      },
      user: token.user ? {
        id: token.user.id,
        email: token.user.email,
        passwordHash: token.user.passwordHash,
      } : null,
      scopes: token.scopes.map(s => ({
        name: s.name,
      })),
    });
  }

  async isRefreshTokenRevoked(token: Token): Promise<boolean> {
    return Date.now() > (token.refreshTokenExpiresAt?.getTime() ?? 0);
  }

  async issueRefreshToken(token: Token, _: OAuthClient): Promise<Token> {
    token.refreshToken = generateRandomToken();
    token.refreshTokenExpiresAt = new DateInterval("2h").getEndDate();
    await this.prisma.oAuthToken.update({
      where: {
        accessToken: token.accessToken,
      },
      data: {
        refreshToken: token.refreshToken,
        refreshTokenExpiresAt: token.refreshTokenExpiresAt,
      },
    });
    return token;
  }

  async persist(token: Token): Promise<void> {
    await this.prisma.oAuthToken.upsert({
      where: {
        accessToken: token.accessToken,
      },
      update: {},
      create: {
        accessToken: token.accessToken,
        accessTokenExpiresAt: token.accessTokenExpiresAt,
        refreshToken: token.refreshToken,
        refreshTokenExpiresAt: token.refreshTokenExpiresAt,
        clientId: token.clientId,
        userId: token.userId,
      },
    });
  }

  async revoke(accessToken: Token): Promise<void> {
    accessToken.revoke();
    await this.update(accessToken);
  }

  private async update(token: Token): Promise<void> {
    await this.prisma.oAuthToken.update({
      where: {
        accessToken: token.accessToken,
      },
      data: {
        accessTokenExpiresAt: token.accessTokenExpiresAt,
        refreshToken: token.refreshToken,
        refreshTokenExpiresAt: token.refreshTokenExpiresAt,
        clientId: token.clientId,
        userId: token.userId,
      },
    });
  }
}
