import { HttpApi } from "@effect/platform";
import { EventsApi } from "./events/api.js";
import { ActivitiesApi } from "./activities/api.js";
import { ObjectivesApi } from "./objectives/api.js";
import { SummaryApi } from "./summary/api.js";
import { ColoniesApi } from "./colonies/api.js";
import { ProtectedFactionsApi } from "./protected-factions/api.js";
import { SystemApi } from "./system/api.js";
import { AuthApi } from "./auth/api.js";
import { DiscordSummaryApi } from "./discord-summary/api.js";
import { CommandersApi } from "./commanders/api.js";
import { DiscoveryApi } from "./discovery/api.js";

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
