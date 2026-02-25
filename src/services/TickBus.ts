/**
 * TickBus — shared PubSub for new-tick events
 *
 * Published by the tick monitor whenever a new BGS tick is detected.
 * Any scheduler can subscribe and react to tick events without polling.
 */

import { Context, PubSub } from "effect"

export class TickBus extends Context.Tag("TickBus")<
  TickBus,
  PubSub.PubSub<string>
>() {}
