# Event-Driven Conflict Notifications

**Date:** 2026-02-22
**Scope:** Bun/Effect-TS backend only (`sinistra-api`)

## Problem

The conflict scheduler fires every 6 hours (00:00, 06:00, 12:00, 18:00 UTC) and posts all active conflicts regardless of whether anything changed. This creates noise and misses the real value: notifying when something actually happens in a conflict.

## Goal

Post to Discord **only** when a conflict state changes, immediately after the tick that contains the change:

1. **New conflict started** — our faction enters a new conflict
2. **Day scored** — either faction wins a CZ day (wonDays incremented)
3. **War won/lost** — either faction first reaches 4 wins (win threshold)

Conflicts are best-of-7, first to **4 wins**. Days can end in a draw (neither faction scores), so the total days played can exceed 4 before a winner is determined. When a conflict disappears from EDDN without either faction reaching 4 wins, silently clean up state (data gap; the win was already announced when the score hit 4).

## Architecture

### TickBus — shared PubSub

A `PubSub<string>` service named `TickBus` is created once in `SchedulersLive` and injected into both the tick monitor and conflict scheduler.

- Tick monitor **publishes** the new `tickId` when a new tick is detected
- Conflict scheduler **subscribes** and reacts to each new tickId
- Using `PubSub` (not `Queue`) so future schedulers can also subscribe to tick events (e.g. shoutout scheduler)

```
TickMonitor ──publish(tickId)──► TickBus ──subscribe──► ConflictScheduler
                                          └─subscribe──► (future: ShoutoutScheduler)
```

### `conflict_state` table

Persists the last known conflict state per system. Survives restarts. Deleted when a conflict resolves.

```sql
CREATE TABLE IF NOT EXISTS conflict_state (
  system        TEXT PRIMARY KEY,
  faction1      TEXT NOT NULL,
  faction2      TEXT NOT NULL,
  war_type      TEXT NOT NULL,
  won_days1     INTEGER NOT NULL DEFAULT 0,
  won_days2     INTEGER NOT NULL DEFAULT 0,
  stake1        TEXT,
  stake2        TEXT,
  last_tick_id  TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
```

**Startup behavior:** On first run with an empty table, all currently active conflicts are loaded as baseline with no notifications fired. From the next tick onward, diffs generate notifications.

## Change Detection Logic

On each `tickId` received from `TickBus`:

1. Extract current conflicts via existing `extractConflicts(tickId, factionName)` → `Map<system, ConflictEntry>`
2. Load previous state from `conflict_state` → `Map<system, ConflictEntry>`
3. Diff:

| Case | Action |
|------|--------|
| System in current, not in previous | Post "New conflict" message, insert into state |
| System in both, wonDays unchanged | Update `last_tick_id`, no notification |
| System in both, wonDays increased, neither at 4 | Post "Day scored" message, update state |
| System in both, either faction first hits 4 | Post "War won/lost" message, delete from state |
| System in previous, not in current | Silent delete from state (data gap or late resolution) |

4. Post one Discord message per change event (not batched)
5. Upsert `conflict_state` with new values

**Win threshold:** 4 wins for all conflict types (war, civil war, election). Best-of-7 format; draws (neither faction scores) are possible, so `wonDays1 + wonDays2` may be less than total days played. Neither faction can exceed 4 wins.

## Message Formats

### New conflict
```
⚔️ New conflict in **Alpha Centauri**
Sinistra vs Rival Faction (War)
Score: 0 – 0 | Stake: Asset Name
```

### Day scored
```
📅 Day scored in **Alpha Centauri**
Sinistra: 2 days ← | Rival Faction: 1 day
Stake: Asset Name
```
(Arrow `←` marks the faction that just scored)

### Our faction wins
```
🏆 Conflict resolved in **Alpha Centauri**
Sinistra wins (4 – 1)
Won: Asset Name
```

### Our faction loses
```
💀 Conflict resolved in **Alpha Centauri**
Rival Faction wins (4 – 2)
Lost: Asset Name
```

## Files to Change

| File | Change |
|------|--------|
| `src/schedulers/index.ts` | Create `TickBus` PubSub service, inject into tick monitor and conflict scheduler |
| `src/schedulers/tick-monitor.ts` | Publish `tickId` to `TickBus` after saving new tick to DB |
| `src/schedulers/conflict-scheduler.ts` | Replace 6h timer loop with `TickBus` subscription + diff logic |
| `src/database/migrations/XXXXXX_conflict_state.ts` | Add `conflict_state` table migration |
| `src/services/TickBus.ts` (new) | `Context.Tag` definition for the PubSub service |

## Effect-TS Sketch

```typescript
// TickBus service definition
export class TickBus extends Context.Tag("TickBus")<
  TickBus,
  PubSub.PubSub<string>
>() {}

// In tick-monitor.ts — after saving tick to DB:
const bus = yield* TickBus
yield* PubSub.publish(bus, newTickId)

// In conflict-scheduler.ts — main loop:
const bus = yield* TickBus
yield* Effect.scoped(
  PubSub.subscribe(bus).pipe(
    Effect.flatMap((sub) =>
      Effect.forever(
        Queue.take(sub).pipe(
          Effect.flatMap((tickId) => runConflictCheck(tickId))
        )
      )
    )
  )
)
```

## What Is Removed

- `msUntilNextSixHourly()` helper — no longer needed
- The 6h `Effect.sleep` / `Effect.forever(runCheck)` loop
- Bulk "Active Conflicts" message format (replaced by per-event messages)
