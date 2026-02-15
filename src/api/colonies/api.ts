import { HttpApiGroup, HttpApiEndpoint, OpenApi } from "@effect/platform";
import {
  ColonyIdParam,
  CreateColonyRequest,
  CreateColonyResponse,
  UpdateColonyRequest,
  StatusResponse,
  SetPriorityRequest,
  SetPriorityResponse,
  SearchColoniesQuery,
  ColoniesListResponse,
  ColonyResponse,
} from "./dtos.ts";
import { DatabaseError, ColonyNotFoundError } from "../../domain/errors.ts";
import { ApiKeyAuth, ApiKeyError } from "../middleware/apikey.ts";

/**
 * Colonies API Group
 *
 * CRUD operations for Elite Dangerous colonies/settlements tracking.
 */
export const ColoniesApi = HttpApiGroup.make("colonies")
  // GET /api/colonies - Get all colonies
  .add(
    HttpApiEndpoint.get("getAllColonies", "/api/colonies")
      .addSuccess(ColoniesListResponse)
      .addError(ApiKeyError, { status: 401 })
      .addError(DatabaseError, { status: 500 })
      .middleware(ApiKeyAuth)
      .annotate(OpenApi.Title, "Get All Colonies")
      .annotate(OpenApi.Description, "Retrieve all tracked colonies/settlements.")
  )
  // POST /api/colonies - Create a new colony
  .add(
    HttpApiEndpoint.post("createColony", "/api/colonies")
      .addSuccess(CreateColonyResponse, { status: 201 })
      .addError(ApiKeyError, { status: 401 })
      .addError(DatabaseError, { status: 500 })
      .setPayload(CreateColonyRequest)
      .middleware(ApiKeyAuth)
      .annotate(OpenApi.Title, "Create Colony")
      .annotate(OpenApi.Description, "Add a new colony to track.")
  )
  // GET /api/colonies/search - Search colonies
  .add(
    HttpApiEndpoint.get("searchColonies", "/api/colonies/search")
      .addSuccess(ColoniesListResponse)
      .addError(ApiKeyError, { status: 401 })
      .addError(DatabaseError, { status: 500 })
      .setUrlParams(SearchColoniesQuery)
      .middleware(ApiKeyAuth)
      .annotate(OpenApi.Title, "Search Colonies")
      .annotate(
        OpenApi.Description,
        "Search colonies by commander name, star system, or system address."
      )
  )
  // GET /api/colonies/priority - Get priority colonies
  .add(
    HttpApiEndpoint.get("getPriorityColonies", "/api/colonies/priority")
      .addSuccess(ColoniesListResponse)
      .addError(ApiKeyError, { status: 401 })
      .addError(DatabaseError, { status: 500 })
      .middleware(ApiKeyAuth)
      .annotate(OpenApi.Title, "Get Priority Colonies")
      .annotate(
        OpenApi.Description,
        "Retrieve colonies marked as priority, ordered by priority level (highest first)."
      )
  )
  // GET /api/colonies/:id - Get colony by ID
  .add(
    HttpApiEndpoint.get("getColonyById", "/api/colonies/:id")
      .addSuccess(ColonyResponse)
      .addError(ApiKeyError, { status: 401 })
      .addError(ColonyNotFoundError, { status: 404 })
      .addError(DatabaseError, { status: 500 })
      .setPath(ColonyIdParam)
      .middleware(ApiKeyAuth)
      .annotate(OpenApi.Title, "Get Colony by ID")
      .annotate(OpenApi.Description, "Retrieve a specific colony by its ID.")
  )
  // PUT /api/colonies/:id - Update colony
  .add(
    HttpApiEndpoint.put("updateColony", "/api/colonies/:id")
      .addSuccess(StatusResponse)
      .addError(ApiKeyError, { status: 401 })
      .addError(ColonyNotFoundError, { status: 404 })
      .addError(DatabaseError, { status: 500 })
      .setPath(ColonyIdParam)
      .setPayload(UpdateColonyRequest)
      .middleware(ApiKeyAuth)
      .annotate(OpenApi.Title, "Update Colony")
      .annotate(OpenApi.Description, "Update an existing colony's information.")
  )
  // DELETE /api/colonies/:id - Delete colony
  .add(
    HttpApiEndpoint.del("deleteColony", "/api/colonies/:id")
      .addSuccess(StatusResponse)
      .addError(ApiKeyError, { status: 401 })
      .addError(DatabaseError, { status: 500 })
      .setPath(ColonyIdParam)
      .middleware(ApiKeyAuth)
      .annotate(OpenApi.Title, "Delete Colony")
      .annotate(OpenApi.Description, "Remove a colony from tracking.")
  )
  // POST /api/colonies/:id/priority - Set colony priority
  .add(
    HttpApiEndpoint.post("setColonyPriority", "/api/colonies/:id/priority")
      .addSuccess(SetPriorityResponse)
      .addError(ApiKeyError, { status: 401 })
      .addError(ColonyNotFoundError, { status: 404 })
      .addError(DatabaseError, { status: 500 })
      .setPath(ColonyIdParam)
      .setPayload(SetPriorityRequest)
      .middleware(ApiKeyAuth)
      .annotate(OpenApi.Title, "Set Colony Priority")
      .annotate(OpenApi.Description, "Set or update the priority level of a colony.")
  )
  .prefix("/");
