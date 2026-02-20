// Helper to map User DB columns (snake_case) to Domain Model (camelCase)
export const mapRowToUser = (row: any): unknown => {
    return {
        ...row,
        planTier: row.plan_tier,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
        company: row.company === null ? undefined : row.company
    }
}

// Helper to map Cmdr DB columns (snake_case) to Domain Model (camelCase)
export const mapRowToCmdr = (row: any): unknown => {
    return {
        id: row.id,
        name: row.name,
        rankCombat: row.rank_combat === null ? undefined : row.rank_combat,
        rankTrade: row.rank_trade === null ? undefined : row.rank_trade,
        rankExplore: row.rank_explore === null ? undefined : row.rank_explore,
        rankCqc: row.rank_cqc === null ? undefined : row.rank_cqc,
        rankEmpire: row.rank_empire === null ? undefined : row.rank_empire,
        rankFederation: row.rank_federation === null ? undefined : row.rank_federation,
        rankPower: row.rank_power === null ? undefined : row.rank_power,
        credits: row.credits === null ? undefined : row.credits,
        assets: row.assets === null ? undefined : row.assets,
        inaraUrl: row.inara_url === null ? undefined : row.inara_url,
        squadronName: row.squadron_name === null ? undefined : row.squadron_name,
        squadronRank: row.squadron_rank === null ? undefined : row.squadron_rank,
    }
}

// Helper to map Colony DB columns (snake_case) to Domain Model (camelCase)
export const mapRowToColony = (row: any): unknown => {
    return {
        id: row.id,
        cmdr: row.cmdr === null ? undefined : row.cmdr,
        starsystem: row.starsystem === null ? undefined : row.starsystem,
        ravenurl: row.ravenurl === null ? undefined : row.ravenurl,
        priority: row.priority,
    }
}

// Helper to map ProtectedFaction DB columns (snake_case) to Domain Model (camelCase)
export const mapRowToProtectedFaction = (row: any): unknown => {
    return {
        id: row.id,
        name: row.name,
        webhookUrl: row.webhook_url === null ? undefined : row.webhook_url,
        description: row.description === null ? undefined : row.description,
        // SQLite uses INTEGER for booleans: 0 = false, 1 = true
        protected: row.protected === 1,
    }
}

// Helper to map TickState DB columns (snake_case) to Domain Model (camelCase)
export const mapRowToTickState = (row: any): unknown => {
    return {
        id: row.id,
        tickid: row.tickid,
        ticktime: row.ticktime,
        // Convert ISO 8601 string to Date
        lastUpdated: row.last_updated,
    }
}

// Helper to map EddnMessage DB columns (snake_case) to Domain Model (camelCase)
export const mapRowToEddnMessage = (row: any): unknown => {
    return {
        id: row.id,
        schemaRef: row.schema_ref,
        headerGatewayTimestamp: row.header_gateway_timestamp === null ? undefined : row.header_gateway_timestamp,
        messageType: row.message_type === null ? undefined : row.message_type,
        messageJson: row.message_json,
        timestamp: row.timestamp,
    }
}

// Helper to map EddnSystemInfo DB columns (snake_case) to Domain Model (camelCase)
export const mapRowToEddnSystemInfo = (row: any): unknown => {
    return {
        id: row.id,
        eddnMessageId: row.eddn_message_id === null ? undefined : row.eddn_message_id,
        systemName: row.system_name,
        controllingFaction: row.controlling_faction === null ? undefined : row.controlling_faction,
        controllingPower: row.controlling_power === null ? undefined : row.controlling_power,
        population: row.population === null ? undefined : row.population,
        security: row.security === null ? undefined : row.security,
        government: row.government === null ? undefined : row.government,
        allegiance: row.allegiance === null ? undefined : row.allegiance,
        updatedAt: row.updated_at,
    }
}

// Helper to map EddnFaction DB columns (snake_case) to Domain Model (camelCase)
export const mapRowToEddnFaction = (row: any): unknown => {
    return {
        id: row.id,
        eddnMessageId: row.eddn_message_id === null ? undefined : row.eddn_message_id,
        systemName: row.system_name,
        name: row.name,
        influence: row.influence === null ? undefined : row.influence,
        state: row.state === null ? undefined : row.state,
        allegiance: row.allegiance === null ? undefined : row.allegiance,
        government: row.government === null ? undefined : row.government,
        // JSON fields - parse from TEXT
        recoveringStates: row.recovering_states === null ? undefined : JSON.parse(row.recovering_states),
        activeStates: row.active_states === null ? undefined : JSON.parse(row.active_states),
        pendingStates: row.pending_states === null ? undefined : JSON.parse(row.pending_states),
        updatedAt: row.updated_at,
    }
}

// Helper to map EddnConflict DB columns (snake_case) to Domain Model (camelCase)
export const mapRowToEddnConflict = (row: any): unknown => {
    return {
        id: row.id,
        eddnMessageId: row.eddn_message_id === null ? undefined : row.eddn_message_id,
        systemName: row.system_name,
        faction1: row.faction1 === null ? undefined : row.faction1,
        faction2: row.faction2 === null ? undefined : row.faction2,
        stake1: row.stake1 === null ? undefined : row.stake1,
        stake2: row.stake2 === null ? undefined : row.stake2,
        wonDays1: row.won_days1 === null ? undefined : row.won_days1,
        wonDays2: row.won_days2 === null ? undefined : row.won_days2,
        status: row.status === null ? undefined : row.status,
        warType: row.war_type === null ? undefined : row.war_type,
        updatedAt: row.updated_at,
    }
}

// Helper to map EddnPowerplay DB columns (snake_case) to Domain Model (camelCase)
export const mapRowToEddnPowerplay = (row: any): unknown => {
    return {
        id: row.id,
        eddnMessageId: row.eddn_message_id === null ? undefined : row.eddn_message_id,
        systemName: row.system_name,
        // JSON field - parse from TEXT
        power: row.power === null ? undefined : JSON.parse(row.power),
        powerplayState: row.powerplay_state === null ? undefined : row.powerplay_state,
        controlProgress: row.control_progress === null ? undefined : row.control_progress,
        reinforcement: row.reinforcement === null ? undefined : row.reinforcement,
        undermining: row.undermining === null ? undefined : row.undermining,
        updatedAt: row.updated_at,
    }
}