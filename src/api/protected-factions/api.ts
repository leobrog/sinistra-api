import { HttpApiGroup, HttpApiEndpoint, OpenApi } from "@effect/platform";
import {
  ProtectedFactionIdParam,
  CreateProtectedFactionRequest,
  CreateProtectedFactionResponse,
  UpdateProtectedFactionRequest,
  StatusResponse,
  ProtectedFactionsListResponse,
  ProtectedFactionResponse,
  SystemNamesResponse,
} from "./dtos.ts";
import { DatabaseError, ProtectedFactionNotFoundError, ProtectedFactionAlreadyExistsError } from "../../domain/errors.ts";
import { ApiKeyAuth, ApiKeyError } from "../middleware/apikey.ts";

/**
 * Protected Factions API Group
 *
 * CRUD operations for protected factions tracking and EDDN system lookups.
 */
export const ProtectedFactionsApi = HttpApiGroup.make("protected-factions")
  // GET /api/protected-faction - Get all protected factions
  .add(
    HttpApiEndpoint.get("getAllProtectedFactions", "/api/protected-faction")
      .addSuccess(ProtectedFactionsListResponse)
      .addError(ApiKeyError, { status: 401 })
      .addError(DatabaseError, { status: 500 })
      .middleware(ApiKeyAuth)
      .annotate(OpenApi.Title, "Get All Protected Factions")
      .annotate(OpenApi.Description, "Retrieve all protected factions.")
  )
  // POST /api/protected-faction - Create a new protected faction
  .add(
    HttpApiEndpoint.post("createProtectedFaction", "/api/protected-faction")
      .addSuccess(CreateProtectedFactionResponse, { status: 201 })
      .addError(ApiKeyError, { status: 401 })
      .addError(ProtectedFactionAlreadyExistsError, { status: 400 })
      .addError(DatabaseError, { status: 500 })
      .setPayload(CreateProtectedFactionRequest)
      .middleware(ApiKeyAuth)
      .annotate(OpenApi.Title, "Create Protected Faction")
      .annotate(OpenApi.Description, "Add a new faction to the protected list.")
  )
  // GET /api/protected-faction/systems - Get all system names
  .add(
    HttpApiEndpoint.get("getAllSystemNames", "/api/protected-faction/systems")
      .addSuccess(SystemNamesResponse)
      .addError(ApiKeyError, { status: 401 })
      .addError(DatabaseError, { status: 500 })
      .middleware(ApiKeyAuth)
      .annotate(OpenApi.Title, "Get All System Names")
      .annotate(
        OpenApi.Description,
        "Retrieve a list of all star system names from EDDN data, sorted alphabetically."
      )
  )
  // GET /api/protected-faction/:id - Get protected faction by ID
  .add(
    HttpApiEndpoint.get("getProtectedFactionById", "/api/protected-faction/:id")
      .addSuccess(ProtectedFactionResponse)
      .addError(ApiKeyError, { status: 401 })
      .addError(ProtectedFactionNotFoundError, { status: 404 })
      .addError(DatabaseError, { status: 500 })
      .setPath(ProtectedFactionIdParam)
      .middleware(ApiKeyAuth)
      .annotate(OpenApi.Title, "Get Protected Faction by ID")
      .annotate(OpenApi.Description, "Retrieve a specific protected faction by its ID.")
  )
  // PUT /api/protected-faction/:id - Update protected faction
  .add(
    HttpApiEndpoint.put("updateProtectedFaction", "/api/protected-faction/:id")
      .addSuccess(StatusResponse)
      .addError(ApiKeyError, { status: 401 })
      .addError(ProtectedFactionNotFoundError, { status: 404 })
      .addError(DatabaseError, { status: 500 })
      .setPath(ProtectedFactionIdParam)
      .setPayload(UpdateProtectedFactionRequest)
      .middleware(ApiKeyAuth)
      .annotate(OpenApi.Title, "Update Protected Faction")
      .annotate(OpenApi.Description, "Update an existing protected faction's information.")
  )
  // DELETE /api/protected-faction/:id - Delete protected faction
  .add(
    HttpApiEndpoint.del("deleteProtectedFaction", "/api/protected-faction/:id")
      .addSuccess(StatusResponse)
      .addError(ApiKeyError, { status: 401 })
      .addError(DatabaseError, { status: 500 })
      .setPath(ProtectedFactionIdParam)
      .middleware(ApiKeyAuth)
      .annotate(OpenApi.Title, "Delete Protected Faction")
      .annotate(OpenApi.Description, "Remove a faction from the protected list.")
  )
  .prefix("/");
