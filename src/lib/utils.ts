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