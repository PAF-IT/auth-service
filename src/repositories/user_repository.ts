import {GrantIdentifier, OAuthUserRepository} from "@jmondi/oauth2-server";
import {PrismaClient} from "../../generated/prisma/client.js";

import {Client} from "../entities/client.js";
import {User} from "../entities/user.js";

export class UserRepository implements OAuthUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getUserByCredentials(
    identifier: string,
    password?: string,
    _grantType?: GrantIdentifier,
    _client?: Client,
  ): Promise<User> {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: identifier },
    });

    if (!dbUser) {
      console.info("UserRepository.getUserByCredentials: user '"+identifier+ "' not found");
      // TODO: fix return type issue instead of @ts-ignore it!
      // @ts-ignore
      return null;
    }

    const user = new User({
      id: dbUser.id,
      email: dbUser.email,
      passwordHash: dbUser.passwordHash,
    });

    // verity password and if user is allowed to use grant, etc...
    if (password) await user.verify(password);

    return user;
  }

  async getUserByEmail(email: string): Promise<User> {
    const dbUser = await this.prisma.user.findUnique({
      where: { email: email },
    });

    if (!dbUser) {
      console.info("UserRepository.getUserByEmail: user '"+email+ "' not found");
      // TODO: fix return type issue instead of @ts-ignore it!
      // @ts-ignore
      return null;
    }

    return new User({
      id: dbUser.id,
      email: dbUser.email,
      passwordHash: dbUser.passwordHash,
    });
  }
}