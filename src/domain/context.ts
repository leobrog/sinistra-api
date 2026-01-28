import { Context } from "effect"
import { User } from "./models.ts"

export class AuthenticatedUser extends Context.Tag("AuthenticatedUser")<
  AuthenticatedUser,
  {
    readonly user: User
  }
>() {}