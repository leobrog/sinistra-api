import { describe, it, expect, mock, beforeEach } from "bun:test"
import { Effect } from "effect"
import {
  sendWebhook,
  getUserRoles,
  exchangeOAuthCode,
  buildOAuthUrl,
} from "./discord.js"

describe("DiscordService", () => {
  beforeEach(() => {
    // Clear any mocks before each test
    mock.restore()
  })

  describe("sendWebhook", () => {
    it("should send a simple text webhook successfully", async () => {
      // Mock successful webhook response (204 No Content)
      (globalThis as any).fetch = mock(async () => {
        return new Response(null, { status: 204 })
      })

      const result = await Effect.runPromise(
        sendWebhook("https://discord.com/api/webhooks/test", {
          content: "Test message",
        })
      )

      expect(result).toBeUndefined() // Void return
      expect((globalThis as any).fetch).toHaveBeenCalledTimes(1)
    })

    it("should send webhook with embeds", async () => {
      (globalThis as any).fetch = mock(async () => {
        return new Response(null, { status: 204 })
      })

      const result = await Effect.runPromise(
        sendWebhook("https://discord.com/api/webhooks/test", {
          embeds: [
            {
              title: "Test Embed",
              description: "Test description",
              color: 0x00ff00,
            },
          ],
        })
      )

      expect(result).toBeUndefined()
    })

    it("should fail when webhook returns error status", async () => {
      (globalThis as any).fetch = mock(async () => {
        return new Response("Bad Request", { status: 400 })
      })

      const exit = await Effect.runPromiseExit(
        sendWebhook("https://discord.com/api/webhooks/test", {
          content: "Test message",
        })
      )

      expect(exit._tag).toBe("Failure")
    })
  })

  describe("getUserRoles", () => {
    it("should fetch user roles successfully", async () => {
      let callCount = 0;
      (globalThis as any).fetch = mock(async (url: string | URL) => {
        callCount++
        const urlStr = url.toString()

        // First call: fetch guild member
        if (urlStr.includes("/members/")) {
          return new Response(
            JSON.stringify({
              user: {
                id: "123",
                username: "testuser",
                discriminator: "0001",
                avatar: null,
              },
              roles: ["role1", "role2"],
              nick: null,
            }),
            { status: 200 }
          )
        }

        // Second call: fetch guild roles
        if (urlStr.includes("/roles")) {
          return new Response(
            JSON.stringify([
              { id: "role1", name: "Admin" },
              { id: "role2", name: "Moderator" },
              { id: "role3", name: "Member" },
            ]),
            { status: 200 }
          )
        }

        return new Response("Not Found", { status: 404 })
      })

      const result = await Effect.runPromise(getUserRoles("123", "guild123", "bot_token"))

      expect(result).toEqual(["Admin", "Moderator"])
      expect(callCount).toBe(2)
    })

    it("should return empty array when user not in guild", async () => {
      (globalThis as any).fetch = mock(async () => {
        return new Response("Not Found", { status: 404 })
      })

      const result = await Effect.runPromise(getUserRoles("123", "guild123", "bot_token"))

      expect(result).toEqual([])
    })

    it("should return empty array when user has no roles", async () => {
      let callCount = 0;
      (globalThis as any).fetch = mock(async (url: string | URL) => {
        callCount++
        const urlStr = url.toString()

        if (urlStr.includes("/members/")) {
          return new Response(
            JSON.stringify({
              user: {
                id: "123",
                username: "testuser",
                discriminator: "0001",
                avatar: null,
              },
              roles: [],
              nick: null,
            }),
            { status: 200 }
          )
        }

        return new Response("Not Found", { status: 404 })
      })

      const result = await Effect.runPromise(getUserRoles("123", "guild123", "bot_token"))

      expect(result).toEqual([])
      // Should only make one call (member fetch), not the roles call
      expect(callCount).toBe(1)
    })

    it("should fail when API returns error", async () => {
      (globalThis as any).fetch = mock(async () => {
        return new Response("Server Error", { status: 500 })
      })

      const exit = await Effect.runPromiseExit(getUserRoles("123", "guild123", "bot_token"))

      expect(exit._tag).toBe("Failure")
    })
  })

  describe("exchangeOAuthCode", () => {
    it("should exchange code for user data successfully", async () => {
      let callCount = 0;
      (globalThis as any).fetch = mock(async (url: string | URL) => {
        callCount++
        const urlStr = url.toString()

        // First call: token exchange
        if (urlStr.includes("/oauth2/token")) {
          return new Response(
            JSON.stringify({
              access_token: "test_access_token",
              token_type: "Bearer",
              expires_in: 3600,
              scope: "identify",
            }),
            { status: 200 }
          )
        }

        // Second call: fetch user info
        if (urlStr.includes("/users/@me")) {
          return new Response(
            JSON.stringify({
              id: "123456789",
              username: "testuser",
              discriminator: "0001",
              avatar: "avatar_hash",
              email: "test@example.com",
            }),
            { status: 200 }
          )
        }

        return new Response("Not Found", { status: 404 })
      })

      const result = await Effect.runPromise(
        exchangeOAuthCode("auth_code", "client_id", "client_secret", "http://localhost/callback")
      )

      expect(result.id).toBe("123456789")
      expect(result.username).toBe("testuser")
      expect(result.email).toBe("test@example.com")
      expect(callCount).toBe(2)
    })

    it("should fail when token exchange fails", async () => {
      (globalThis as any).fetch = mock(async () => {
        return new Response("Invalid code", { status: 400 })
      })

      const exit = await Effect.runPromiseExit(
        exchangeOAuthCode("bad_code", "client_id", "client_secret", "http://localhost/callback")
      )

      expect(exit._tag).toBe("Failure")
    })

    it("should fail when user fetch fails", async () => {
      let callCount = 0;
      (globalThis as any).fetch = mock(async (url: string | URL) => {
        callCount++
        const urlStr = url.toString()

        // First call: token exchange succeeds
        if (urlStr.includes("/oauth2/token")) {
          return new Response(
            JSON.stringify({
              access_token: "test_access_token",
              token_type: "Bearer",
              expires_in: 3600,
              scope: "identify",
            }),
            { status: 200 }
          )
        }

        // Second call: user fetch fails
        if (urlStr.includes("/users/@me")) {
          return new Response("Unauthorized", { status: 401 })
        }

        return new Response("Not Found", { status: 404 })
      })

      const exit = await Effect.runPromiseExit(
        exchangeOAuthCode("auth_code", "client_id", "client_secret", "http://localhost/callback")
      )

      expect(exit._tag).toBe("Failure")
    })
  })

  describe("buildOAuthUrl", () => {
    it("should build OAuth URL with default scopes", () => {
      const url = buildOAuthUrl("client_123", "http://localhost/callback")

      expect(url).toContain("https://discord.com/oauth2/authorize")
      expect(url).toContain("client_id=client_123")
      expect(url).toContain("redirect_uri=http%3A%2F%2Flocalhost%2Fcallback")
      expect(url).toContain("response_type=code")
      expect(url).toContain("scope=identify")
    })

    it("should build OAuth URL with custom scopes", () => {
      const url = buildOAuthUrl("client_123", "http://localhost/callback", [
        "identify",
        "email",
        "guilds",
      ])

      expect(url).toContain("scope=identify+email+guilds")
    })
  })
})
