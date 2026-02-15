import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import * as Dtos from "./dtos.js"

export const DiscoveryApi = HttpApiGroup.make("discovery")
  .add(
    HttpApiEndpoint.get("discovery", "/discovery")
      .addSuccess(Dtos.DiscoveryResponse)
      .addError(Dtos.DiscoveryError, { status: 500 })
  )
  .prefix("/")
