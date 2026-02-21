import { HttpApiGroup, HttpApiEndpoint } from "@effect/platform"
import { Schema } from "effect"
import {
  CreateObjectiveRequest,
  CreateObjectiveResponse,
  UpdateObjectiveRequest,
  UpdateObjectiveResponse,
  DeleteObjectiveResponse,
  GetObjectivesResponse,
} from "./dtos.ts"
import { ObjectiveId } from "../../domain/ids.ts"
import { DatabaseError, ObjectiveNotFoundError } from "../../domain/errors.ts"
import { ApiKeyAuth, ApiKeyError } from "../middleware/apikey.ts"

/**
 * Objectives API Group
 *
 * CRUD operations for BGS objectives with nested targets and settlements.
 */
export const ObjectivesApi = HttpApiGroup.make("objectives")
  // POST /objectives - Create objective
  .add(
    HttpApiEndpoint.post("createObjective", "/objectives")
      .addSuccess(CreateObjectiveResponse, { status: 201 })
      .addError(ApiKeyError, { status: 401 })
      .addError(DatabaseError, { status: 400 })
      .setPayload(CreateObjectiveRequest)
      .middleware(ApiKeyAuth)
  )
  // POST /api/objectives - Alternative path for create
  .add(
    HttpApiEndpoint.post("createObjectiveAlt", "/api/objectives")
      .addSuccess(CreateObjectiveResponse, { status: 201 })
      .addError(ApiKeyError, { status: 401 })
      .addError(DatabaseError, { status: 400 })
      .setPayload(CreateObjectiveRequest)
      .middleware(ApiKeyAuth)
  )
  // GET /objectives - Query objectives
  .add(
    HttpApiEndpoint.get("getObjectives", "/objectives")
      .addSuccess(GetObjectivesResponse)
      .addError(ApiKeyError, { status: 401 })
      .addError(DatabaseError, { status: 500 })
      .middleware(ApiKeyAuth)
  )
  // GET /api/objectives - Alternative path for query
  .add(
    HttpApiEndpoint.get("getObjectivesAlt", "/api/objectives")
      .addSuccess(GetObjectivesResponse)
      .addError(ApiKeyError, { status: 401 })
      .addError(DatabaseError, { status: 500 })
      .middleware(ApiKeyAuth)
  )
  // POST /api/objectives/:id - Update objective
  .add(
    HttpApiEndpoint.post("updateObjective", "/api/objectives/:id")
      .addSuccess(UpdateObjectiveResponse)
      .addError(ApiKeyError, { status: 401 })
      .addError(ObjectiveNotFoundError, { status: 404 })
      .addError(DatabaseError, { status: 500 })
      .setPayload(UpdateObjectiveRequest)
      .setPath(Schema.Struct({ id: ObjectiveId }))
      .middleware(ApiKeyAuth)
  )
  // POST /objectives/:id - Alternative path for update
  .add(
    HttpApiEndpoint.post("updateObjectiveAlt", "/objectives/:id")
      .addSuccess(UpdateObjectiveResponse)
      .addError(ApiKeyError, { status: 401 })
      .addError(ObjectiveNotFoundError, { status: 404 })
      .addError(DatabaseError, { status: 500 })
      .setPayload(UpdateObjectiveRequest)
      .setPath(Schema.Struct({ id: ObjectiveId }))
      .middleware(ApiKeyAuth)
  )
  // DELETE /api/objectives/:id - Delete objective
  .add(
    HttpApiEndpoint.del("deleteObjective", "/api/objectives/:id")
      .addSuccess(DeleteObjectiveResponse)
      .addError(ApiKeyError, { status: 401 })
      .addError(ObjectiveNotFoundError, { status: 404 })
      .addError(DatabaseError, { status: 500 })
      .setPath(Schema.Struct({ id: ObjectiveId }))
      .middleware(ApiKeyAuth)
  )
  // DELETE /objectives/:id - Alternative path for delete
  .add(
    HttpApiEndpoint.del("deleteObjectiveAlt", "/objectives/:id")
      .addSuccess(DeleteObjectiveResponse)
      .addError(ApiKeyError, { status: 401 })
      .addError(ObjectiveNotFoundError, { status: 404 })
      .addError(DatabaseError, { status: 500 })
      .setPath(Schema.Struct({ id: ObjectiveId }))
      .middleware(ApiKeyAuth)
  )
  .prefix("/")
