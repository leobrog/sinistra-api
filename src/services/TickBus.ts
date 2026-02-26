/**
 * TickBus — shared PubSub for new-tick events
 *
 * Published by the tick monitor whenever a new BGS tick is detected.
 * The published value is the new tick's ISO timestamp (e.g. "2026-02-25T18:21:21.000Z").
 *
 * Subscribers use this timestamp as an upper-bound to look up the Zoy hash tickid
 * from the event table (events submitted before this time carry the just-completed tick hash).
 */

import { Context, PubSub } from "effect"

export class TickBus extends Context.Tag("TickBus")<
  TickBus,
  PubSub.PubSub<string>
>() {}
