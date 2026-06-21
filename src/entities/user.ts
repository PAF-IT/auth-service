import { OAuthUser as UserModel, OAuthUser } from "@jmondi/oauth2-server";

export class User implements UserModel, OAuthUser {
  readonly id: string;
  email: string;
  roles: string[];

  constructor(entity: UserModel & { roles: string[] }) {
    this.id = entity.id as string;
    this.email = entity.email;
    this.roles = entity.roles;
  }
}
