import { HttpApi } from "@effect/platform";
import { EventsApi } from "./events/api.ts";
import { ActivitiesApi } from "./activities/api.ts";
import { ObjectivesApi } from "./objectives/api.ts";
import { SummaryApi } from "./summary/api.ts";
import { ColoniesApi } from "./colonies/api.ts";
import { ProtectedFactionsApi } from "./protected-factions/api.ts";
import { SystemApi } from "./system/api.ts";
import { AuthApi } from "./auth/api.ts";
import { DiscordSummaryApi } from "./discord-summary/api.ts";
import { CommandersApi } from "./commanders/api.ts";
import { DiscoveryApi } from "./discovery/api.ts";

// API composition - all endpoint groups
export const Api = HttpApi.make("sinistra-api")
  .add(EventsApi)
  .add(ActivitiesApi)
  .add(ObjectivesApi)
  .add(SummaryApi)
  .add(ColoniesApi)
  .add(ProtectedFactionsApi)
  .add(SystemApi)
  .add(AuthApi)
  .add(DiscordSummaryApi)
  .add(CommandersApi)
  .add(DiscoveryApi);
