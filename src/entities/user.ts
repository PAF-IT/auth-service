import { OAuthUser as UserModel, OAuthUser } from "@jmondi/oauth2-server";

export class User implements UserModel, OAuthUser {
  readonly id: string;
  email: string;
  sciMember: boolean;

  constructor(entity: UserModel & { sciMember?: boolean }) {
    this.id = entity.id as string;
    this.email = entity.email;
    this.sciMember = entity.sciMember ?? false;
  }

  // Roles synthesized from membership flags. Everyone authenticated is a
  // "member"; sci members additionally get "sci".
  get roles(): string[] {
    return this.sciMember ? ["member", "sci"] : ["member"];
  }
}
