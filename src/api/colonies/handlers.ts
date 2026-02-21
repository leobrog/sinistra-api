import { Effect, Option } from "effect";
import { HttpApiBuilder } from "@effect/platform";
import { v4 as uuid } from "uuid";
import { Api } from "../index.js";
import { ColonyRepository } from "../../domain/repositories.js";
import { Colony } from "../../domain/models.js";
import type { ColonyId } from "../../domain/ids.js";
// DTO types imported but used via Schema validation in handlers
import { ColonyNotFoundError } from "../../domain/errors.js";

/**
 * Convert Colony domain model to response DTO
 */
const colonyToResponse = (colony: Colony) => ({
  id: colony.id,
  cmdr: Option.getOrNull(colony.cmdr),
  starsystem: Option.getOrNull(colony.starsystem),
  ravenurl: Option.getOrNull(colony.ravenurl),
  priority: colony.priority,
});

/**
 * Handler for GET /api/colonies - Get all colonies
 */
export const getAllColonies = HttpApiBuilder.handler(Api, "colonies", "getAllColonies", () =>
  Effect.gen(function* () {
    const colonyRepo = yield* ColonyRepository;
    const colonies = yield* colonyRepo.findAll();
    return colonies.map(colonyToResponse);
  })
);

/**
 * Handler for POST /api/colonies - Create a new colony
 */
export const createColony = HttpApiBuilder.handler(Api, "colonies", "createColony", ({ payload }) =>
  Effect.gen(function* () {
    const colonyRepo = yield* ColonyRepository;

    const newColony = new Colony({
      id: uuid() as ColonyId,
      cmdr: Option.fromNullable(payload.cmdr),
      starsystem: Option.some(payload.starsystem),
      ravenurl: Option.fromNullable(payload.ravenurl),
      priority: payload.priority ?? 0,
    });

    yield* colonyRepo.create(newColony);

    return {
      status: "Colony added successfully",
      id: newColony.id,
    };
  })
);

/**
 * Handler for GET /api/colonies/:id - Get colony by ID
 */
export const getColonyById = HttpApiBuilder.handler(Api, "colonies", "getColonyById", ({ path }) =>
  Effect.gen(function* () {
    const colonyRepo = yield* ColonyRepository;
    const colonyOption = yield* colonyRepo.findById(path.id);

    if (Option.isNone(colonyOption)) {
      return yield* Effect.fail(new ColonyNotFoundError({ id: path.id }));
    }

    return colonyToResponse(colonyOption.value);
  })
);

/**
 * Handler for PUT /api/colonies/:id - Update colony
 */
export const updateColony = HttpApiBuilder.handler(Api, "colonies", "updateColony", ({ path, payload }) =>
  Effect.gen(function* () {
    const colonyRepo = yield* ColonyRepository;
    const colonyOption = yield* colonyRepo.findById(path.id);

    if (Option.isNone(colonyOption)) {
      return yield* Effect.fail(new ColonyNotFoundError({ id: path.id }));
    }

    const existing = colonyOption.value;

    const updated = new Colony({
      id: existing.id,
      cmdr: payload.cmdr !== undefined ? Option.fromNullable(payload.cmdr) : existing.cmdr,
      starsystem: payload.starsystem !== undefined ? Option.fromNullable(payload.starsystem) : existing.starsystem,
      ravenurl: payload.ravenurl !== undefined ? Option.fromNullable(payload.ravenurl) : existing.ravenurl,
      priority: payload.priority !== undefined ? payload.priority : existing.priority,
    });

    yield* colonyRepo.update(updated);

    return {
      status: "Colony updated successfully",
    };
  })
);

/**
 * Handler for DELETE /api/colonies/:id - Delete colony
 */
export const deleteColony = HttpApiBuilder.handler(Api, "colonies", "deleteColony", ({ path }) =>
  Effect.gen(function* () {
    const colonyRepo = yield* ColonyRepository;
    yield* colonyRepo.delete(path.id);

    return {
      status: "Colony deleted successfully",
    };
  })
);

/**
 * Handler for GET /api/colonies/search - Search colonies
 */
export const searchColonies = HttpApiBuilder.handler(Api, "colonies", "searchColonies", ({ urlParams }) =>
  Effect.gen(function* () {
    const colonyRepo = yield* ColonyRepository;

    // If we have search params, filter; otherwise return all
    let colonies: Colony[];

    if (urlParams.cmdr) {
      colonies = yield* colonyRepo.findByCmdr(urlParams.cmdr);
    } else if (urlParams.starsystem) {
      colonies = yield* colonyRepo.findBySystem(urlParams.starsystem);
    } else {
      // TODO: Add findBySystemAddress support if needed
      colonies = yield* colonyRepo.findAll();
    }

    return colonies.map(colonyToResponse);
  })
);

/**
 * Handler for GET /api/colonies/priority - Get priority colonies
 */
export const getPriorityColonies = HttpApiBuilder.handler(Api, "colonies", "getPriorityColonies", () =>
  Effect.gen(function* () {
    const colonyRepo = yield* ColonyRepository;
    const colonies = yield* colonyRepo.findPriority();
    return colonies.map(colonyToResponse);
  })
);

/**
 * Handler for POST /api/colonies/:id/priority - Set colony priority
 */
export const setColonyPriority = HttpApiBuilder.handler(
  Api,
  "colonies",
  "setColonyPriority",
  ({ path, payload }) =>
    Effect.gen(function* () {
      const colonyRepo = yield* ColonyRepository;
      const colonyOption = yield* colonyRepo.findById(path.id);

      if (Option.isNone(colonyOption)) {
        return yield* Effect.fail(new ColonyNotFoundError({ id: path.id }));
      }

      const existing = colonyOption.value;

      const updated = new Colony({
        ...existing,
        priority: payload.priority,
      });

      yield* colonyRepo.update(updated);

      return {
        status: "Colony priority updated successfully",
        id: updated.id,
        starsystem: Option.getOrNull(updated.starsystem),
        priority: updated.priority,
      };
    })
);

export const ColoniesApiLive = HttpApiBuilder.group(
  Api,
  "colonies",
  (handlers) =>
    handlers
      .handle("getAllColonies", getAllColonies)
      .handle("createColony", createColony)
      .handle("getColonyById", getColonyById)
      .handle("updateColony", updateColony)
      .handle("deleteColony", deleteColony)
      .handle("searchColonies", searchColonies)
      .handle("getPriorityColonies", getPriorityColonies)
      .handle("setColonyPriority", setColonyPriority)
);
