import {GrantIdentifier, OAuthUserRepository} from "@jmondi/oauth2-server";
import {PrismaClient} from "../../generated/prisma/client.js";

import {Client} from "../entities/client.js";
import {User} from "../entities/user.js";
import { Logger, ILogObj } from "tslog";
import { parseJsonStringArray } from "../utils/prisma-helpers.js";


const log: Logger<ILogObj> = new Logger();

export class UserRepository implements OAuthUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getUserByCredentials(
    identifier: string,
    _password?: string,
    _grantType?: GrantIdentifier,
    _client?: Client,
  ): Promise<User> {
    const memberId = Number(identifier);
    const member = Number.isFinite(memberId)
      ? await this.prisma.member.findUnique({where: {id: memberId}})
      : null;

    if (!member) {
      log.debug("UserRepository.getUserByCredentials: member '" + identifier + "' not found");
      // @ts-ignore — upstream return type doesn't allow null
      return null;
    }

    return new User({id: String(member.id), email: member.email, roles: parseJsonStringArray(member.roles)});
  }

  async getUserByEmail(email: string): Promise<User> {
    const member = await this.prisma.member.findFirst({where: {email}});

    if (!member) {
      log.debug("UserRepository.getUserByEmail: member '" + email + "' not found");
      // @ts-ignore — upstream return type doesn't allow null
      return null;
    }

    return new User({id: String(member.id), email: member.email, roles: parseJsonStringArray(member.roles)});
  }
}
