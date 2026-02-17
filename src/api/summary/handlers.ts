import { Effect } from "effect";
import { HttpApiBuilder } from "@effect/platform";
import { Api } from "../index.js";
import { SummaryKey, SummaryQueryParams, LeaderboardQueryParams } from "./dtos.js";
import { TursoClient } from "../../database/client.js";
import { DatabaseError } from "../../domain/errors.js";
import { buildDateFilter, DateFilter } from "../../services/date-filters.js";
import { AppConfig } from "../../lib/config.js";

/**
 * SQL query templates for summary endpoints.
 * The {date_filter} placeholder will be replaced with actual filter conditions.
 */
const QUERIES: Record<SummaryKey, string> = {
  "market-events": `
    SELECT e.cmdr,
           SUM(COALESCE(mb.value, 0)) AS total_buy,
           SUM(COALESCE(ms.value, 0)) AS total_sell,
           SUM(COALESCE(mb.value, 0)) + SUM(COALESCE(ms.value, 0)) AS total_transaction_volume,
           SUM(COALESCE(mb.count, 0)) + SUM(COALESCE(ms.count, 0)) AS total_trade_quantity
    FROM event e
    LEFT JOIN market_buy_event mb ON mb.event_id = e.id
    LEFT JOIN market_sell_event ms ON ms.event_id = e.id
    WHERE e.cmdr IS NOT NULL AND {date_filter}
    GROUP BY e.cmdr
    HAVING total_transaction_volume > 0
    ORDER BY total_trade_quantity DESC
  `,
  "missions-completed": `
    SELECT e.cmdr, COUNT(*) AS missions_completed
    FROM mission_completed_event mc
    JOIN event e ON e.id = mc.event_id
    WHERE e.cmdr IS NOT NULL AND {date_filter}
    GROUP BY e.cmdr
    ORDER BY missions_completed DESC
  `,
  "missions-failed": `
    SELECT e.cmdr, COUNT(*) AS missions_failed
    FROM mission_failed_event mf
    JOIN event e ON e.id = mf.event_id
    WHERE e.cmdr IS NOT NULL AND {date_filter}
    GROUP BY e.cmdr
    ORDER BY missions_failed DESC
  `,
  "bounty-vouchers": `
    SELECT e.cmdr, e.starsystem, rv.faction, SUM(rv.amount) AS bounty_vouchers
    FROM redeem_voucher_event rv
    JOIN event e ON e.id = rv.event_id
    WHERE e.cmdr IS NOT NULL AND rv.type = 'bounty' AND {date_filter}
    GROUP BY e.cmdr, e.starsystem, rv.faction
    ORDER BY bounty_vouchers DESC
  `,
  "combat-bonds": `
    SELECT e.cmdr, e.starsystem, rv.faction, SUM(rv.amount) AS combat_bonds
    FROM redeem_voucher_event rv
    JOIN event e ON e.id = rv.event_id
    WHERE e.cmdr IS NOT NULL AND rv.type = 'CombatBond' AND {date_filter}
    GROUP BY e.cmdr, e.starsystem, rv.faction
    ORDER BY combat_bonds DESC
  `,
  "influence-by-faction": `
    SELECT e.cmdr, mci.faction_name, SUM(LENGTH(mci.influence)) AS influence
    FROM mission_completed_influence mci
    JOIN mission_completed_event mce ON mce.event_id = mci.mission_id
    JOIN event e ON e.id = mce.event_id
    WHERE e.cmdr IS NOT NULL AND {date_filter}
    GROUP BY e.cmdr, mci.faction_name
    ORDER BY influence DESC, e.cmdr
  `,
  "influence-eic": `
    SELECT e.cmdr, mci.faction_name, SUM(LENGTH(mci.influence)) AS influence
    FROM mission_completed_influence mci
    JOIN mission_completed_event mce ON mce.event_id = mci.mission_id
    JOIN event e ON e.id = mce.event_id
    WHERE e.cmdr IS NOT NULL
      AND mci.faction_name LIKE ?
      AND {date_filter}
    GROUP BY e.cmdr, mci.faction_name
    ORDER BY influence DESC, e.cmdr
  `,
  "exploration-sales": `
    SELECT cmdr, SUM(total_sales) AS total_exploration_sales
    FROM (
      SELECT e.cmdr, se.earnings AS total_sales
      FROM sell_exploration_data_event se
      JOIN event e ON e.id = se.event_id
      WHERE e.cmdr IS NOT NULL AND {date_filter}
      UNION ALL
      SELECT e.cmdr, ms.total_earnings AS total_sales
      FROM multi_sell_exploration_data_event ms
      JOIN event e ON e.id = ms.event_id
      WHERE e.cmdr IS NOT NULL AND {date_filter}
    )
    GROUP BY cmdr
    ORDER BY total_exploration_sales DESC
  `,
  "bounty-fines": `
    SELECT e.cmdr, SUM(cc.bounty) AS bounty_fines
    FROM commit_crime_event cc
    JOIN event e ON e.id = cc.event_id
    WHERE e.cmdr IS NOT NULL AND {date_filter}
    GROUP BY e.cmdr
    ORDER BY bounty_fines DESC
  `,
  "murder-count": `
    SELECT e.cmdr, e.starsystem, cc.victim_faction AS faction, COUNT(*) AS murder_count
    FROM commit_crime_event cc
    JOIN event e ON e.id = cc.event_id
    WHERE e.cmdr IS NOT NULL
      AND LOWER(cc.crime_type) = 'murder'
      AND {date_filter}
    GROUP BY e.cmdr, e.starsystem, cc.victim_faction
    ORDER BY murder_count DESC
  `,
};

/**
 * Base queries with LIMIT 5 for top5 endpoints
 */
const BASE_QUERIES: Record<SummaryKey, string> = {
  "market-events": QUERIES["market-events"].replace("DESC", "DESC LIMIT 5"),
  "missions-completed": QUERIES["missions-completed"].replace("DESC", "DESC LIMIT 5"),
  "missions-failed": QUERIES["missions-failed"].replace("DESC", "DESC LIMIT 5"),
  "bounty-vouchers": QUERIES["bounty-vouchers"].replace("DESC", "DESC LIMIT 5"),
  "combat-bonds": QUERIES["combat-bonds"].replace("DESC", "DESC LIMIT 5"),
  "influence-by-faction": QUERIES["influence-by-faction"].replace("e.cmdr", "e.cmdr LIMIT 5"),
  "influence-eic": QUERIES["influence-eic"].replace("e.cmdr", "e.cmdr LIMIT 5"),
  "exploration-sales": QUERIES["exploration-sales"].replace("DESC", "DESC LIMIT 5"),
  "bounty-fines": QUERIES["bounty-fines"].replace("DESC", "DESC LIMIT 5"),
  "murder-count": QUERIES["murder-count"].replace("DESC", "DESC LIMIT 5"),
};

/**
 * Build date filter SQL condition from DateFilter result
 */
const buildDateFilterSql = (filter: DateFilter): string => {
  if (filter.type === "tick" && filter.tickId) {
    return `e.tickid = '${filter.tickId}'`;
  }
  if (filter.type === "date" && filter.startDate && filter.endDate) {
    return `e.timestamp BETWEEN '${filter.startDate}' AND '${filter.endDate}'`;
  }
  return "1=1"; // No filter
};

/**
 * Build date filter SQL for subqueries (uses 'ex' alias instead of 'e')
 */
const buildDateFilterSqlSub = (filter: DateFilter): string => {
  if (filter.type === "tick" && filter.tickId) {
    return `ex.tickid = '${filter.tickId}'`;
  }
  if (filter.type === "date" && filter.startDate && filter.endDate) {
    return `ex.timestamp BETWEEN '${filter.startDate}' AND '${filter.endDate}'`;
  }
  return "1=1"; // No filter
};

/**
 * Execute a summary query with date filtering
 */
const executeSummaryQuery = (
  key: SummaryKey,
  queryParams: SummaryQueryParams,
  isTop5: boolean
): Effect.Effect<unknown[], DatabaseError | Error, TursoClient | AppConfig> =>
  Effect.gen(function* () {
    const client = yield* TursoClient;
    const config = yield* AppConfig;

    // Get query template
    const sqlTemplate = isTop5 ? BASE_QUERIES[key] : QUERIES[key];

    // Build date filter
    let dateFilter: DateFilter;

    if (queryParams.start_date && queryParams.end_date) {
      // Custom date range
      dateFilter = {
        type: "date",
        startDate: queryParams.start_date,
        endDate: queryParams.end_date,
        label: `${queryParams.start_date} to ${queryParams.end_date}`,
      };
    } else if (queryParams.period) {
      // Predefined period
      dateFilter = yield* buildDateFilter(queryParams.period, client);
    } else {
      // No filter (all time)
      dateFilter = {
        type: "date",
        label: "All Time",
      };
    }

    // Build SQL filter condition
    let dateFilterSql = buildDateFilterSql(dateFilter);

    // Add system filter if provided
    const args: unknown[] = [];
    if (queryParams.system_name) {
      dateFilterSql += " AND e.starsystem = ?";
      args.push(queryParams.system_name);
    }

    // Replace placeholder
    let sql = sqlTemplate.replace("{date_filter}", dateFilterSql);

    // Add faction filter for influence-eic query
    if (key === "influence-eic") {
      args.unshift(`%${config.faction.name}%`); // LIKE parameter goes first
    }

    // Execute query
    const result = yield* Effect.tryPromise({
      try: () => client.execute({ sql, args }),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to execute summary query: ${error}`,
          cause: error,
        }),
    });

    return result.rows;
  });

/**
 * Handler for GET /api/summary/:key
 */
export const getSummary = HttpApiBuilder.handle(Api, "getSummary", ({ path, query }) =>
  Effect.gen(function* () {
    const rows = yield* executeSummaryQuery(path.key, query, false);
    return rows;
  })
);

/**
 * Handler for GET /api/summary/top5/:key
 */
export const getSummaryTop5 = HttpApiBuilder.handle(Api, "getSummaryTop5", ({ path, query }) =>
  Effect.gen(function* () {
    const rows = yield* executeSummaryQuery(path.key, query, true);
    return rows;
  })
);

/**
 * Handler for GET /api/summary/leaderboard
 */
export const getLeaderboard = HttpApiBuilder.handle(Api, "getLeaderboard", ({ query }) =>
  Effect.gen(function* () {
    const client = yield* TursoClient;
    const config = yield* AppConfig;

    // Build date filter
    let dateFilter: DateFilter;
    if (query.period) {
      dateFilter = yield* buildDateFilter(query.period, client);
    } else {
      dateFilter = { type: "date", label: "All Time" };
    }

    const dateFilterSql = buildDateFilterSql(dateFilter);
    const dateFilterSqlSub = buildDateFilterSqlSub(dateFilter);

    // Build system filter
    const args: unknown[] = [];
    let systemFilterSql = "";
    let systemFilterSqlSub = "";
    if (query.system_name) {
      systemFilterSql = " AND e.starsystem = ?";
      systemFilterSqlSub = " AND ex.starsystem = ?";
      args.push(query.system_name);
    }

    // Faction filter for influence calculation
    const factionLikePattern = `%${config.faction.name}%`;

    const sql = `
      SELECT e.cmdr,
             c.squadron_rank AS rank,
             SUM(CASE WHEN mb.event_id IS NOT NULL THEN mb.value ELSE 0 END) AS total_buy,
             SUM(CASE WHEN ms.event_id IS NOT NULL THEN ms.value ELSE 0 END) AS total_sell,
             CASE
               WHEN SUM(CASE WHEN ms.event_id IS NOT NULL THEN ms.value ELSE 0 END) > 0
               THEN SUM(CASE WHEN ms.event_id IS NOT NULL THEN ms.value ELSE 0 END)
                    - SUM(CASE WHEN mb.event_id IS NOT NULL THEN mb.value ELSE 0 END)
               ELSE 0
             END AS profit,
             ROUND(
               CASE
                 WHEN SUM(CASE WHEN ms.event_id IS NOT NULL THEN ms.value ELSE 0 END) > 0 AND
                      SUM(CASE WHEN mb.event_id IS NOT NULL THEN mb.value ELSE 0 END) > 0
                 THEN (SUM(CASE WHEN ms.event_id IS NOT NULL THEN ms.value ELSE 0 END)
                       - SUM(CASE WHEN mb.event_id IS NOT NULL THEN mb.value ELSE 0 END)) * 100.0
                      / SUM(CASE WHEN mb.event_id IS NOT NULL THEN mb.value ELSE 0 END)
                 ELSE 0
               END, 2
             ) AS profitability,
             SUM(CASE WHEN mb.event_id IS NOT NULL THEN mb.count ELSE 0 END) +
             SUM(CASE WHEN ms.event_id IS NOT NULL THEN ms.count ELSE 0 END) AS total_quantity,
             SUM(CASE WHEN mb.event_id IS NOT NULL THEN mb.value ELSE 0 END) +
             SUM(CASE WHEN ms.event_id IS NOT NULL THEN ms.value ELSE 0 END) AS total_volume,
             (
               SELECT COUNT(*)
               FROM mission_completed_event mc
               JOIN event ex ON ex.id = mc.event_id
               WHERE ex.cmdr = e.cmdr AND ${dateFilterSqlSub}${systemFilterSqlSub}
             ) AS missions_completed,
             (
               SELECT COUNT(*)
               FROM mission_failed_event mf
               JOIN event ex ON ex.id = mf.event_id
               WHERE ex.cmdr = e.cmdr AND ${dateFilterSqlSub}${systemFilterSqlSub}
             ) AS missions_failed,
             (
               SELECT SUM(rv.amount)
               FROM redeem_voucher_event rv
               JOIN event ex ON ex.id = rv.event_id
               WHERE ex.cmdr = e.cmdr AND rv.type = 'bounty' AND ${dateFilterSqlSub}${systemFilterSqlSub}
             ) AS bounty_vouchers,
             (
               SELECT SUM(rv.amount)
               FROM redeem_voucher_event rv
               JOIN event ex ON ex.id = rv.event_id
               WHERE ex.cmdr = e.cmdr AND rv.type = 'CombatBond' AND ${dateFilterSqlSub}${systemFilterSqlSub}
             ) AS combat_bonds,
             (
               SELECT SUM(t.total_sales)
               FROM (
                 SELECT se.earnings AS total_sales
                 FROM sell_exploration_data_event se
                 JOIN event ex ON ex.id = se.event_id
                 WHERE ex.cmdr = e.cmdr AND ${dateFilterSqlSub}${systemFilterSqlSub}
                 UNION ALL
                 SELECT me.total_earnings AS total_sales
                 FROM multi_sell_exploration_data_event me
                 JOIN event ex ON ex.id = me.event_id
                 WHERE ex.cmdr = e.cmdr AND ${dateFilterSqlSub}${systemFilterSqlSub}
               ) t
             ) AS exploration_sales,
             (
               SELECT SUM(LENGTH(mci.influence))
               FROM mission_completed_influence mci
               JOIN mission_completed_event mce ON mce.event_id = mci.mission_id
               JOIN event ex ON ex.id = mce.event_id
               WHERE ex.cmdr = e.cmdr
                 AND mci.faction_name LIKE ?
                 AND ${dateFilterSqlSub}${systemFilterSqlSub}
             ) AS influence_eic,
             (
               SELECT SUM(cc.bounty)
               FROM commit_crime_event cc
               JOIN event ex ON ex.id = cc.event_id
               WHERE ex.cmdr = e.cmdr AND ${dateFilterSqlSub}${systemFilterSqlSub}
             ) AS bounty_fines
      FROM event e
      LEFT JOIN cmdr c ON c.name = e.cmdr
      LEFT JOIN market_buy_event mb ON mb.event_id = e.id
      LEFT JOIN market_sell_event ms ON ms.event_id = e.id
      WHERE e.cmdr IS NOT NULL AND ${dateFilterSql}${systemFilterSql}
      GROUP BY e.cmdr
      ORDER BY e.cmdr
    `;

    // Build args: [factionLikePattern, ...systemFilterArgs (0 or 1)]
    const finalArgs = [factionLikePattern, ...args];

    const result = yield* Effect.tryPromise({
      try: () => client.execute({ sql, args: finalArgs }),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to execute leaderboard query: ${error}`,
          cause: error,
        }),
    });

    return result.rows;
  })
);

/**
 * Handler for GET /api/summary/recruits
 */
export const getRecruits = HttpApiBuilder.handle(Api, "getRecruits", () =>
  Effect.gen(function* () {
    const client = yield* TursoClient;

    const sql = `
      SELECT e.cmdr AS commander,
             CASE WHEN COUNT(e.id) > 0 THEN 'Yes' ELSE 'No' END AS has_data,
             MAX(e.timestamp) AS last_active,
             CAST(julianday('now') - julianday(MIN(e.timestamp)) AS INT) AS days_since_join,
             (SELECT COALESCE(SUM(mb.count), 0) + COALESCE((
               SELECT SUM(ms.count)
               FROM market_sell_event ms
               JOIN event e2 ON e2.id = ms.event_id
               WHERE e2.cmdr = e.cmdr
             ), 0)
              FROM market_buy_event mb
              JOIN event e1 ON e1.id = mb.event_id
              WHERE e1.cmdr = e.cmdr) AS tonnage,
             (SELECT COUNT(*)
              FROM mission_completed_event mc
              JOIN event ev ON ev.id = mc.event_id
              WHERE ev.cmdr = e.cmdr) AS mission_count,
             (SELECT SUM(rv.amount)
              FROM redeem_voucher_event rv
              JOIN event ev ON ev.id = rv.event_id
              WHERE ev.cmdr = e.cmdr
                AND rv.type = 'bounty') AS bounty_claims,
             (SELECT SUM(total)
              FROM (
                SELECT se.earnings AS total
                FROM sell_exploration_data_event se
                JOIN event ev ON ev.id = se.event_id
                WHERE ev.cmdr = e.cmdr
                UNION ALL
                SELECT me.total_earnings AS total
                FROM multi_sell_exploration_data_event me
                JOIN event ev ON ev.id = me.event_id
                WHERE ev.cmdr = e.cmdr
              )) AS exp_value,
             (SELECT SUM(rv.amount)
              FROM redeem_voucher_event rv
              JOIN event ev ON ev.id = rv.event_id
              WHERE ev.cmdr = e.cmdr
                AND rv.type = 'CombatBond') AS combat_bonds,
             (SELECT SUM(cc.bounty)
              FROM commit_crime_event cc
              JOIN event ev ON ev.id = cc.event_id
              WHERE ev.cmdr = e.cmdr) AS bounty_fines
      FROM event e
      JOIN cmdr c ON c.name = e.cmdr
      WHERE e.cmdr IS NOT NULL
        AND c.squadron_rank = 'Recruit'
      GROUP BY e.cmdr
      ORDER BY days_since_join ASC
    `;

    const result = yield* Effect.tryPromise({
      try: () => client.execute({ sql, args: [] }),
      catch: (error) =>
        new DatabaseError({
          message: `Failed to execute recruits query: ${error}`,
          cause: error,
        }),
    });

    return result.rows;
  })
);

export const SummaryHandlers = HttpApiBuilder.group(
  Api,
  "summary",
  (handlers) =>
    handlers
      .pipe(getSummary)
      .pipe(getSummaryTop5)
      .pipe(getLeaderboard)
      .pipe(getRecruits)
);
