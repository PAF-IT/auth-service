import {
    OAuthClient,
    OAuthAuthCode,
    OAuthScope,
    OAuthUser,
    CodeChallengeMethod } from "@jmondi/oauth2-server";
import { Client } from "./client";
import { Scope } from "./scope";
import { User } from "./user";

type Optional = Partial<{
    user: OAuthUser;
    scopes: OAuthScope[];
}>;

type Required = {
    client: OAuthClient;
};

export class MagicLinkToken implements OAuthAuthCode {
    readonly code: string;
    codeChallenge?: string;
    codeChallengeMethod?: CodeChallengeMethod;
    redirectUri?: string;
    user?: User;
    userId?: string;
    client: Client;
    clientId: string;
    expiresAt: Date;
    // createdAt: Date;
    scopes: Scope[];

    constructor({ user, client, scopes, ...entity }: OAuthAuthCode & Required & Optional) {
        this.code = entity.code;
        this.codeChallenge = entity.codeChallenge ? entity.codeChallenge : undefined;
        this.codeChallengeMethod = entity.codeChallengeMethod ? entity.codeChallengeMethod : undefined;
        this.redirectUri = entity.redirectUri ? entity.redirectUri : undefined;
        this.user = user ? new User(user) : undefined;
        this.userId = user?.id as string;
        this.client = new Client(client);
        this.clientId = client.id;
        this.scopes = scopes?.map(s => new Scope(s)) ?? [];
        this.expiresAt = entity.expiresAt ?? new Date();
        // this.createdAt = new Date();
    }

    get isExpired(): boolean {
        return new Date() > this.expiresAt;
    }
}
