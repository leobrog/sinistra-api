import { HttpApi } from "@effect/platform";
import { EventsApi } from "./events/api.ts";
import { ActivitiesApi } from "./activities/api.ts";
import { ObjectivesApi } from "./objectives/api.ts";

// API composition - add endpoint groups as they're implemented
export const Api = HttpApi.make("sinistra-api")
  .add(EventsApi)
  .add(ActivitiesApi)
  .add(ObjectivesApi);
