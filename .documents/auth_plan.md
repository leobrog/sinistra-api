# Authentication & Authorization Plan

## 1. Overview
We will implement a standard Email/Password authentication flow using **JWT (JSON Web Tokens)** for stateless session management. 
- [x] **Password Hashing**: We will utilize `Bun.password` (Argon2id by default) for secure, native performance.
- [x] **Token Generation**: We will use the `jose` library to sign and verify JWTs.
- [ ] **Protection**: We will create an Effect Middleware to intercept requests, validate tokens, and enforce permissions.

## 2. Dependencies
- **`jose`**: For JWT operations.
  ```bash
  bun add jose
  ```

## 3. Environment Variables
Add `JWT_SECRET` to `.env` (and `.env.example`).
```env
JWT_SECRET=your_super_secure_random_secret_key_at_least_32_chars
```

## 4. Implementation Steps

### Phase 1: Core Security Utilities
1.  **Password Hashing**: 
    -   Refactor `POST /users` (Create User) in `src/api/handlers.ts` to use `Bun.password.hash(payload.password)` instead of the current mock.
2.  **JWT Service**:
    -   Create `src/lib/jwt.ts` (or `src/domain/services/JwtService.ts`).
    -   Export functions to `sign(payload)` and `verify(token)`.

### Phase 2: Login Endpoint
1.  **Define Route**: Add `login` endpoint to `src/api/users.ts`.
    -   Input: `Email`, `Password`.
    -   Output: `{ accessToken: string, user: UserResponse }`.
2.  **Implement Handler**: Add `login` handler in `src/api/handlers.ts`.
    -   Find user by email.
    -   Verify password using `Bun.password.verify`.
    -   Generate JWT.
    -   Return response.

### Phase 3: Authentication Middleware
1.  **Create Middleware**: `src/api/middleware/auth.ts`.
    -   Extract `Authorization` header.
    -   Verify JWT.
    -   If valid, define a context tag (e.g., `AuthenticatedUser`) holding the `userId`.
    -   If invalid/missing, return `401 Unauthorized`.

### Phase 4: Route Protection & Authorization
1.  **Apply Security**:
    -   Update `src/api/users.ts` to mark routes as protected (using `HttpApi.middleware` or per-endpoint security definition if available in the abstraction, otherwise applying the middleware in `handlers.ts` or `main.ts` layer composition).
2.  **Ownership Check**:
    -   In `handlers.ts`, for routes like `createApiKey`, `listApiKeys`, etc., ensure the `userId` in the path matches the `userId` from the authenticated context.
    -   Return `403 Forbidden` if they don't match.

## 5. API Changes

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| POST | `/users` | No | Register (Hash password) |
| POST | `/users/login` | No | **(NEW)** Login, returns JWT |
| GET | `/users/:id` | **Yes** | Get User (Must match ID) |
| DELETE | `/users/:id` | **Yes** | Delete User (Must match ID) |
| POST | `/users/:id/apikeys` | **Yes** | Create API Key (Must match ID) |
| GET | `/users/:id/apikeys` | **Yes** | List API Keys (Must match ID) |
| DELETE | `/users/:id/apikeys/:keyId`| **Yes** | Delete API Key (Must match ID) |

## 6. Testing Strategy
-   Create a test user.
-   Login to get token.
-   Access protected route with token -> **Success**.
-   Access protected route without token -> **401 Unauthorized**.
-   Access another user's route with valid token -> **403 Forbidden**.
