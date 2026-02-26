# Shoutout Scheduler Improvements

**Date:** 2026-02-25
**Scope:** `api/src/schedulers/shoutout-scheduler.ts` + `api/src/schedulers/index.ts`

## Problems

1. **Fixed 20:00 UTC trigger** — fires regardless of when the tick lands. The tick can arrive anywhere between 15:00–18:00 UTC (or later), so the summary may use data a full tick old.
2. **Pipe-table formatting** — Discord renders in proportional font; fixed-width columns with `|` separators look cramped and are unreadable on mobile.
3. **No BGS context** — raw counts with no faction influence or state from EDDN.

## Goals

1. Become tick-driven like the conflict scheduler (subscribe to `TickBus`, fire 15 minutes after each tick).
2. Use Discord embeds (`embeds[]` in the webhook JSON payload) for clean mobile-friendly formatting.
3. Add EDDN context per system entry: our faction's current influence % and active states.

---

## Architecture

### Trigger change

`runShoutoutScheduler` subscribes to `TickBus`. On each `tickId`:
1. Sleep 15 minutes (let EDDN data settle and give commanders time to scan systems post-tick).
2. Run all three jobs with the received `tickId`.

The `msUntilUtcTime` helper and the fixed-time sleep loop are removed entirely.

`runShoutoutScheduler` gains `TickBus` as a service dependency. `index.ts` injects the shared `bus` instance (same as tick-monitor and conflict-scheduler).

### Discord embeds

Replace `postToDiscord(url, content: string)` with `postEmbedsToDiscord(url, embeds: DiscordEmbed[])`.

Payload shape:
```json
{ "embeds": [ { "description": "...", "color": 3447003 }, ... ] }
```

Limits to respect:
- Max 10 embeds per message
- `description` max 4096 chars per embed
- 6000 total chars across all embeds in one message

If a job produces more than 10 embeds (very large ticks), split into multiple webhook calls.

### EDDN context lookup

A shared helper `getOurFactionBySystem(client, factionName)` queries:
```sql
SELECT system_name, influence, active_states
FROM eddn_faction
WHERE name = ?
```
Returns `Map<system, { influence: number | null, states: string[] }>`.

`active_states` is stored as JSON (`["Boom"]`, `["Retreat"]`, etc.) — parse and join with `·`.
If no EDDN data exists for a system, the context line is omitted silently.

---

## Job Formats

### Job 1 — BGS Tick Summary (BGS webhook)

One embed per non-empty section. Header line in each embed's description:

```
📊 BGS Tick Summary · zoy-8d52ae155b7e06f9532f

── Influence ──────────────────────
Grabil — Citizen Party of Grabil — THREAR: +8
↳ CIU at 34.2% · Boom

Col 285 Sector HE-V b2-1 — Diamond Frogs — IAN SERVO: +1
↳ CIU at 12.1% · None

── Missions ───────────────────────
Grabil — Citizen Party of Grabil — THREAR: ×4
↳ CIU at 34.2% · Boom

── Market ─────────────────────────
Col 285 Sector KN-T b3-1 — Lee Taylor: 29M cr / 9,920t
Scorpii Sector HH-V b2-3 — THREAR: 3.6M cr / 153t

── CZs ────────────────────────────
Grabil — CIU — THREAR: 3× high
↳ CIU at 34.2% · Boom
```

Volume is formatted as `XM cr` / `XK cr` / `X cr` depending on magnitude.
Tonnage is formatted with commas.

### Job 2 — Space CZ Summary (conflict webhook)

Single embed. Grouped by system → CZ type, CMDRs on one line per type:

```
⚔️ Space CZs · zoy-8d52ae155b7e06f9532f

── Grabil ─────────────────────────
high  · THREAR: ×3, IAN SERVO: ×1
med   · THREAR: ×2

── Col 285 Sector HE-V b2-1 ───────
low   · CMDR NAME: ×1
```

### Job 3 — Ground CZ Summary (shoutout webhook)

Single embed. Grouped by system → settlement → CZ type:

```
🪖 Ground CZs · zoy-8d52ae155b7e06f9532f

── Grabil — Overlook Settlement ───
med  · THREAR: ×2

── Col 285 Sector HE-V b2-1 — Fort Whoever ───
low  · IAN SERVO: ×1
```

---

## Files to Change

| File | Change |
|------|--------|
| `src/schedulers/shoutout-scheduler.ts` | Full rewrite: TickBus subscription, embed builders, EDDN lookup |
| `src/schedulers/index.ts` | Inject `TickBus` into `runShoutoutScheduler` |

No migrations required. No new tables.

---

## What Is Removed

- `msUntilUtcTime` helper (no longer needed)
- Fixed 20:00/20:01/20:02 UTC sleep loop
- `postToDiscord(url, content: string)` plain-text helper
- Pipe-table formatting in all three build functions
