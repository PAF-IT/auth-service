import { OAuthUser as UserModel, OAuthUser } from "@jmondi/oauth2-server";

export class User implements UserModel, OAuthUser {
  readonly id: string;
  email: string;

  constructor(entity: UserModel) {
    this.id = entity.id as string;
    this.email = entity.email;
  }
}
