import { Effect, Option } from "effect";
import { HttpApiBuilder } from "@effect/platform";
import { ColoniesApi } from "./api.ts";
import { ColonyRepository } from "../../domain/repositories.ts";
import { Colony } from "../../domain/models.ts";
import { ColonyId } from "../../domain/ids.ts";
import {
  CreateColonyRequest,
  UpdateColonyRequest,
  SetPriorityRequest,
  SearchColoniesQuery,
} from "./dtos.ts";
import { ColonyNotFoundError } from "../../domain/errors.ts";

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
export const getAllColonies = HttpApiBuilder.handle(ColoniesApi, "getAllColonies", () =>
  Effect.gen(function* () {
    const colonyRepo = yield* ColonyRepository;
    const colonies = yield* colonyRepo.findAll();
    return colonies.map(colonyToResponse);
  })
);

/**
 * Handler for POST /api/colonies - Create a new colony
 */
export const createColony = HttpApiBuilder.handle(ColoniesApi, "createColony", ({ payload }) =>
  Effect.gen(function* () {
    const colonyRepo = yield* ColonyRepository;

    const newColony = new Colony({
      id: ColonyId.make(),
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
export const getColonyById = HttpApiBuilder.handle(ColoniesApi, "getColonyById", ({ path }) =>
  Effect.gen(function* () {
    const colonyRepo = yield* ColonyRepository;
    const colonyOption = yield* colonyRepo.findById(path.id);

    return yield* Effect.gen(function* () {
      const colony = yield* Effect.fromOption(() => new ColonyNotFoundError({ id: path.id }))(colonyOption);
      return colonyToResponse(colony);
    });
  })
);

/**
 * Handler for PUT /api/colonies/:id - Update colony
 */
export const updateColony = HttpApiBuilder.handle(ColoniesApi, "updateColony", ({ path, payload }) =>
  Effect.gen(function* () {
    const colonyRepo = yield* ColonyRepository;
    const colonyOption = yield* colonyRepo.findById(path.id);

    return yield* Effect.gen(function* () {
      const existing = yield* Effect.fromOption(() => new ColonyNotFoundError({ id: path.id }))(colonyOption);

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
    });
  })
);

/**
 * Handler for DELETE /api/colonies/:id - Delete colony
 */
export const deleteColony = HttpApiBuilder.handle(ColoniesApi, "deleteColony", ({ path }) =>
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
export const searchColonies = HttpApiBuilder.handle(ColoniesApi, "searchColonies", ({ query }) =>
  Effect.gen(function* () {
    const colonyRepo = yield* ColonyRepository;

    // If we have search params, filter; otherwise return all
    let colonies: Colony[];

    if (query.cmdr) {
      colonies = yield* colonyRepo.findByCmdr(query.cmdr);
    } else if (query.starsystem) {
      colonies = yield* colonyRepo.findBySystem(query.starsystem);
    } else {
      colonies = yield* colonyRepo.findAll();
    }

    return colonies.map(colonyToResponse);
  })
);

/**
 * Handler for GET /api/colonies/priority - Get priority colonies
 */
export const getPriorityColonies = HttpApiBuilder.handle(ColoniesApi, "getPriorityColonies", () =>
  Effect.gen(function* () {
    const colonyRepo = yield* ColonyRepository;
    const colonies = yield* colonyRepo.findPriority();
    return colonies.map(colonyToResponse);
  })
);

/**
 * Handler for POST /api/colonies/:id/priority - Set colony priority
 */
export const setColonyPriority = HttpApiBuilder.handle(
  ColoniesApi,
  "setColonyPriority",
  ({ path, payload }) =>
    Effect.gen(function* () {
      const colonyRepo = yield* ColonyRepository;
      const colonyOption = yield* colonyRepo.findById(path.id);

      return yield* Effect.gen(function* () {
        const existing = yield* Effect.fromOption(() => new ColonyNotFoundError({ id: path.id }))(colonyOption);

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
      });
    })
);

export const ColoniesHandlers = HttpApiBuilder.group(
  ColoniesApi,
  "colonies",
  (handlers) =>
    handlers
      .pipe(getAllColonies)
      .pipe(createColony)
      .pipe(getColonyById)
      .pipe(updateColony)
      .pipe(deleteColony)
      .pipe(searchColonies)
      .pipe(getPriorityColonies)
      .pipe(setColonyPriority)
);
