import { describe, it, expect } from "bun:test";
import { Effect, Layer, ConfigProvider, Exit } from "effect";
import { JwtService, JwtServiceLive } from "./jwt.ts";

describe("JwtService", () => {
    // Create a ConfigProvider with a test secret
    const testConfig = ConfigProvider.fromMap(new Map([["JWT_SECRET", "super-secret-test-key-must-be-long-enough"]]));
    
    // Provide the config to the JwtServiceLive layer
    const TestLayer = JwtServiceLive.pipe(
        Layer.provide(Layer.setConfigProvider(testConfig))
    );

    it("should sign and verify a token successfully", async () => {
        const payload = { userId: "123", email: "test@example.com" };

        const program = Effect.gen(function* () {
            const jwt = yield* JwtService;
            const token = yield* jwt.sign(payload);
            expect(typeof token).toBe("string");
            expect(token.length).toBeGreaterThan(0);

            const decoded = yield* jwt.verify(token);
            return decoded;
        });

        const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));

        expect(result).toMatchObject(payload);
        expect(result.iat).toBeDefined();
        expect(result.exp).toBeDefined();
    });

    it("should fail verification for an invalid token", async () => {
        const program = Effect.gen(function* () {
            const jwt = yield* JwtService;
            return yield* jwt.verify("invalid.token.string");
        });

        const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(TestLayer)));

        expect(Exit.isFailure(exit)).toBe(true);
    });

    it("should fail verification when signed with a different secret", async () => {
        // Setup another layer with a different secret
        const maliciousConfig = ConfigProvider.fromMap(new Map([["JWT_SECRET", "different-secret-key-that-is-also-long"]]));
        const MaliciousLayer = JwtServiceLive.pipe(
            Layer.provide(Layer.setConfigProvider(maliciousConfig))
        );

        const payload = { userId: "123" };

        // Sign with malicious layer
        const token = await Effect.runPromise(
            Effect.gen(function* () {
                const jwt = yield* JwtService;
                return yield* jwt.sign(payload);
            }).pipe(Effect.provide(MaliciousLayer))
        );

        // Verify with original TestLayer
        const verifyProgram = Effect.gen(function* () {
            const jwt = yield* JwtService;
            return yield* jwt.verify(token);
        });

        const exit = await Effect.runPromiseExit(verifyProgram.pipe(Effect.provide(TestLayer)));
        expect(Exit.isFailure(exit)).toBe(true);
    });
});
