import { Schema } from "effect"

// Discord verification request (POST /api/verify_discord)
export class DiscordVerifyRequest extends Schema.Class<DiscordVerifyRequest>("DiscordVerifyRequest")({
  discord_id: Schema.String,
  discord_username: Schema.String,
}) {}

// User response (for Discord verification)
export class UserResponse extends Schema.Class<UserResponse>("UserResponse")({
  id: Schema.optionalWith(Schema.String, { nullable: true }), // null for new users
  username: Schema.String,
  discord_id: Schema.String,
  discord_username: Schema.String,
  is_admin: Schema.Boolean,
  tenant_name: Schema.optionalWith(Schema.String, { nullable: true }),
  account_status: Schema.Literal("existing", "new"),
  token: Schema.optionalWith(Schema.String, { nullable: true }), // JWT token for existing users
}) {}

// Discord OAuth callback query parameters (GET /api/auth/discord/callback)
export class DiscordOAuthCallbackQuery extends Schema.Class<DiscordOAuthCallbackQuery>("DiscordOAuthCallbackQuery")({
  code: Schema.String,
  state: Schema.optional(Schema.String), // URL params cannot be nullable
}) {}

// Discord OAuth user info (from Discord API)
export class DiscordUser extends Schema.Class<DiscordUser>("DiscordUser")({
  id: Schema.String,
  username: Schema.String,
  discriminator: Schema.String,
  avatar: Schema.optionalWith(Schema.String, { nullable: true }),
  email: Schema.optionalWith(Schema.String, { nullable: true }),
}) {}
