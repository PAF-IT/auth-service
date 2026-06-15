import { PrismaClient } from "../../generated/prisma/client.js";
import { GrantIdentifier, OAuthClient, OAuthClientRepository } from "@jmondi/oauth2-server";

import { Client } from "../entities/client.js";
import { parseAllowedGrants, parseRedirectUris } from "../utils/prisma-helpers.js";
import { Logger, ILogObj } from "tslog";


const log: Logger<ILogObj> = new Logger();

export class ClientRepository implements OAuthClientRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getByIdentifier(clientId: string): Promise<Client> {
    log.debug("[DEBUG] ClientRepository.getByIdentifier: client '" +clientId+ "'");
    const dbClient = await this.prisma.oAuthClient.findUnique({
      where: {
        id: clientId,
      },
      include: {
        scopes: true,
      },
    });

    if (!dbClient) {
      log.debug("[DEBUG] ClientRepository.getByIdentifier: client '" +clientId+ "' not found");
      // TODO: fix return type issue instead of @ts-ignore it!
      // @ts-ignore
      return null;
    }

    return new Client({
      id: dbClient.id,
      name: dbClient.name,
      secret: dbClient.secret,
      redirectUris: parseRedirectUris(dbClient.redirectUris),
      allowedGrants: parseAllowedGrants(dbClient.allowedGrants),
      scopes: dbClient.scopes.map(s => ({
        name: s.name,
      })),
    });
  }

  async isClientValid(grantType: GrantIdentifier, client: OAuthClient, clientSecret?: string): Promise<boolean> {
    log.debug("[DEBUG] ClientRepository.isClientValid: grantType=" +grantType+ ", client=" + client + " clientSecret=" + clientSecret);
    if (client.secret && client.secret !== clientSecret) {
      return false;
    }
    return client.allowedGrants.includes(grantType);
  }
}
