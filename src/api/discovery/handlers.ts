import { HttpApiBuilder } from "@effect/platform"
import { Effect } from "effect"
import { Api } from "../index.js"
import { DiscoveryResponse, DiscoveryError, EndpointConfig, HeaderRequirement } from "./dtos.js"
import { AppConfig } from "../../lib/config.js"

export const DiscoveryApiLive = HttpApiBuilder.group(
  Api,
  "discovery",
  (handlers) =>
    handlers.handle("discovery", () =>
      Effect.gen(function* () {
        const config = yield* AppConfig

        return new DiscoveryResponse({
          name: config.server.name,
          description: config.server.description,
          url: config.server.url,
          endpoints: {
            events: new EndpointConfig({
              path: "events",
              minPeriod: "10",
              maxBatch: "100",
            }),
            activities: new EndpointConfig({
              path: "activities",
              minPeriod: "60",
              maxBatch: "10",
            }),
            objectives: new EndpointConfig({
              path: "objectives",
              minPeriod: "30",
              maxBatch: "20",
            }),
          },
          headers: {
            apikey: new HeaderRequirement({
              required: true,
              description: "API key for authentication",
            }),
            apiversion: new HeaderRequirement({
              required: true,
              description: "The version of the API in x.y.z notation",
              current: config.server.apiVersion,
            }),
          },
        })
      }).pipe(
        Effect.catchAll((error) =>
          Effect.fail(
            new DiscoveryError({
              message: `Discovery endpoint error: ${error}`,
            })
          )
        )
      )
    )
)
