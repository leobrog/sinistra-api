import { HttpApi } from "@effect/platform";
import { UsersApi } from "./users.ts";

export const Api = HttpApi.make("sinistra-api").add(UsersApi);
