import { Effect, Option } from "effect";
import { HttpApiBuilder } from "@effect/platform";
import { v4 as uuid } from "uuid";
import { Api } from "../index.js";
import { ProtectedFactionRepository, EddnRepository } from "../../domain/repositories.js";
import { ProtectedFaction } from "../../domain/models.js";
import type { ProtectedFactionId } from "../../domain/ids.js";
// DTO types imported but used via Schema validation in handlers
import { ProtectedFactionNotFoundError } from "../../domain/errors.js";

/**
 * Convert ProtectedFaction domain model to response DTO
 */
const factionToResponse = (faction: ProtectedFaction) => ({
  id: faction.id,
  name: faction.name,
  webhook_url: Option.getOrNull(faction.webhookUrl),
  description: Option.getOrNull(faction.description),
  protected: faction.protected,
});

/**
 * Handler for GET /api/protected-faction - Get all protected factions
 */
export const getAllProtectedFactions = HttpApiBuilder.handler(
  Api,
  "protected-factions",
  "getAllProtectedFactions",
  () =>
    Effect.gen(function* () {
      const factionRepo = yield* ProtectedFactionRepository;
      const factions = yield* factionRepo.findAll();
      return factions.map(factionToResponse);
    })
);

/**
 * Handler for POST /api/protected-faction - Create a new protected faction
 */
export const createProtectedFaction = HttpApiBuilder.handler(
  Api,
  "protected-factions",
  "createProtectedFaction",
  ({ payload }) =>
    Effect.gen(function* () {
      const factionRepo = yield* ProtectedFactionRepository;

      const newFaction = new ProtectedFaction({
        id: uuid() as ProtectedFactionId,
        name: payload.name,
        webhookUrl: Option.fromNullable(payload.webhook_url),
        description: Option.fromNullable(payload.description),
        protected: payload.protected ?? true,
      });

      yield* factionRepo.create(newFaction);

      return {
        id: newFaction.id,
      };
    })
);

/**
 * Handler for GET /api/protected-faction/:id - Get protected faction by ID
 */
export const getProtectedFactionById = HttpApiBuilder.handler(
  Api,
  "protected-factions",
  "getProtectedFactionById",
  ({ path }) =>
    Effect.gen(function* () {
      const factionRepo = yield* ProtectedFactionRepository;
      const factionOption = yield* factionRepo.findById(path.id);

      if (Option.isNone(factionOption)) {
        return yield* Effect.fail(
          new ProtectedFactionNotFoundError({ id: path.id })
        );
      }

      return factionToResponse(factionOption.value);
    })
);

/**
 * Handler for PUT /api/protected-faction/:id - Update protected faction
 */
export const updateProtectedFaction = HttpApiBuilder.handler(
  Api,
  "protected-factions",
  "updateProtectedFaction",
  ({ path, payload }) =>
    Effect.gen(function* () {
      const factionRepo = yield* ProtectedFactionRepository;
      const factionOption = yield* factionRepo.findById(path.id);

      if (Option.isNone(factionOption)) {
        return yield* Effect.fail(
          new ProtectedFactionNotFoundError({ id: path.id })
        );
      }

      const existing = factionOption.value;

      const updated = new ProtectedFaction({
        id: existing.id,
        name: payload.name !== undefined ? payload.name : existing.name,
        webhookUrl:
          payload.webhook_url !== undefined
            ? Option.fromNullable(payload.webhook_url)
            : existing.webhookUrl,
        description:
          payload.description !== undefined
            ? Option.fromNullable(payload.description)
            : existing.description,
        protected: payload.protected !== undefined ? payload.protected : existing.protected,
      });

      yield* factionRepo.update(updated);

      return {
        status: "updated",
      };
    })
);

/**
 * Handler for DELETE /api/protected-faction/:id - Delete protected faction
 */
export const deleteProtectedFaction = HttpApiBuilder.handler(
  Api,
  "protected-factions",
  "deleteProtectedFaction",
  ({ path }) =>
    Effect.gen(function* () {
      const factionRepo = yield* ProtectedFactionRepository;
      yield* factionRepo.delete(path.id);

      return {
        status: "deleted",
      };
    })
);

/**
 * Handler for GET /api/protected-faction/systems - Get all system names from EDDN
 */
export const getAllSystemNames = HttpApiBuilder.handler(
  Api,
  "protected-factions",
  "getAllSystemNames",
  () =>
    Effect.gen(function* () {
      const eddnRepo = yield* EddnRepository;

      // Query all distinct system names from EDDN system info
      // Note: This is a simplified implementation. In production, you might want
      // to add pagination or caching for better performance with large datasets.
      const systems = yield* eddnRepo.getAllSystemNames();

      return systems.sort((a, b) => a.localeCompare(b));
    })
);

export const ProtectedFactionsApiLive = HttpApiBuilder.group(
  Api,
  "protected-factions",
  (handlers) =>
    handlers
      .handle("getAllProtectedFactions", getAllProtectedFactions)
      .handle("createProtectedFaction", createProtectedFaction)
      .handle("getProtectedFactionById", getProtectedFactionById)
      .handle("updateProtectedFaction", updateProtectedFaction)
      .handle("deleteProtectedFaction", deleteProtectedFaction)
      .handle("getAllSystemNames", getAllSystemNames)
);
