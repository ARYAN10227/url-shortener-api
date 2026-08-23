import request from "supertest";
import app from "../src/app.js";
import { connectToDatabase, getDatabase, closeDatabaseConnection } from "../src/mongodb.js";

describe("URL Shortener API Integration Tests", () => {
  let db;
  let user1Token;
  let user1Id;
  let user2Token;
  let user2Id;

  beforeAll(async () => {
    // Connect to a dedicated test database
    await connectToDatabase("url_shortener_test");
    db = getDatabase();
  });

  beforeEach(async () => {
    // Clean test collections to ensure test isolation
    await db.collection("users").deleteMany({});
    await db.collection("urls").deleteMany({});
    await db.collection("clicks").deleteMany({});

    // Register User 1
    const regRes1 = await request(app)
      .post("/api/auth/register")
      .send({
        name: "User One",
        email: "user1@example.com",
        password: "password123",
      });
    user1Token = regRes1.body.token;
    user1Id = regRes1.body.user._id;

    // Register User 2
    const regRes2 = await request(app)
      .post("/api/auth/register")
      .send({
        name: "User Two",
        email: "user2@example.com",
        password: "password456",
      });
    user2Token = regRes2.body.token;
    user2Id = regRes2.body.user._id;
  });

  afterAll(async () => {
    // Clean up test data and close database connection
    if (db) {
      await db.collection("users").deleteMany({});
      await db.collection("urls").deleteMany({});
      await db.collection("clicks").deleteMany({});
    }
    await closeDatabaseConnection();
  });

  describe("Authentication API", () => {
    describe("POST /api/auth/register", () => {
      it("should successfully register a new user and return a JWT token without passwordHash", async () => {
        const res = await request(app)
          .post("/api/auth/register")
          .send({
            name: "New User",
            email: "newuser@example.com",
            password: "strongPassword1",
          });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty("token");
        expect(res.body).toHaveProperty("user");
        expect(res.body.user).toHaveProperty("_id");
        expect(res.body.user.name).toBe("New User");
        expect(res.body.user.email).toBe("newuser@example.com");
        expect(res.body.user).not.toHaveProperty("passwordHash");
        expect(res.body.user).not.toHaveProperty("password");
      });

      it("should reject registration with duplicate email with HTTP 409", async () => {
        const res = await request(app)
          .post("/api/auth/register")
          .send({
            name: "Duplicate User",
            email: "user1@example.com",
            password: "password123",
          });

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: "Email already registered." });
      });

      it("should reject registration with invalid email format", async () => {
        const res = await request(app)
          .post("/api/auth/register")
          .send({
            name: "Invalid Email",
            email: "invalid-email-address",
            password: "password123",
          });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "Invalid email format." });
      });

      it("should reject registration with short password (< 6 chars)", async () => {
        const res = await request(app)
          .post("/api/auth/register")
          .send({
            name: "Short Pass",
            email: "shortpass@example.com",
            password: "123",
          });

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "Password must be at least 6 characters long." });
      });
    });

    describe("POST /api/auth/login", () => {
      it("should successfully authenticate with valid credentials and return JWT token", async () => {
        const res = await request(app)
          .post("/api/auth/login")
          .send({
            email: "user1@example.com",
            password: "password123",
          });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("token");
        expect(res.body).toHaveProperty("user");
        expect(res.body.user.email).toBe("user1@example.com");
        expect(res.body.user).not.toHaveProperty("passwordHash");
      });

      it("should reject login with wrong password with HTTP 401", async () => {
        const res = await request(app)
          .post("/api/auth/login")
          .send({
            email: "user1@example.com",
            password: "wrongPassword",
          });

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: "Invalid email or password." });
      });

      it("should reject login with non-existent email with HTTP 401", async () => {
        const res = await request(app)
          .post("/api/auth/login")
          .send({
            email: "nonexistent@example.com",
            password: "password123",
          });

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: "Invalid email or password." });
      });
    });

    describe("GET /api/auth/me", () => {
      it("should return the authenticated user's profile with valid token", async () => {
        const res = await request(app)
          .get("/api/auth/me")
          .set("Authorization", `Bearer ${user1Token}`);

        expect(res.status).toBe(200);
        expect(res.body.user).toHaveProperty("_id");
        expect(res.body.user.email).toBe("user1@example.com");
        expect(res.body.user.name).toBe("User One");
        expect(res.body.user).not.toHaveProperty("passwordHash");
      });

      it("should return HTTP 401 when token is missing", async () => {
        const res = await request(app).get("/api/auth/me");

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty("error");
      });

      it("should return HTTP 401 when token is invalid", async () => {
        const res = await request(app)
          .get("/api/auth/me")
          .set("Authorization", "Bearer invalid.jwt.token");

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: "Invalid authentication token." });
      });
    });
  });

  describe("URL Management & Ownership Authorization", () => {
    describe("POST /api/urls", () => {
      it("should successfully create a short URL associated with authenticated user", async () => {
        const res = await request(app)
          .post("/api/urls")
          .set("Authorization", `Bearer ${user1Token}`)
          .send({ originalUrl: "https://example.com" });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty("_id");
        expect(res.body.originalUrl).toBe("https://example.com");
        expect(res.body).toHaveProperty("shortCode");
        expect(res.body.userId).toBe(user1Id);
        expect(res.body.clicks).toBe(0);
        expect(res.body).toHaveProperty("createdAt");
        expect(res.body).toHaveProperty("shortUrl");
      });

      it("should reject URL creation without authentication with HTTP 401", async () => {
        const res = await request(app)
          .post("/api/urls")
          .send({ originalUrl: "https://example.com" });

        expect(res.status).toBe(401);
      });

      it("should reject an invalid originalUrl", async () => {
        const res = await request(app)
          .post("/api/urls")
          .set("Authorization", `Bearer ${user1Token}`)
          .send({ originalUrl: "invalid-url-string" });

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty("error");
        expect(res.body.error).toBe("Invalid URL format.");
      });

      it("should create a URL with a custom shortCode", async () => {
        const res = await request(app)
          .post("/api/urls")
          .set("Authorization", `Bearer ${user1Token}`)
          .send({ originalUrl: "https://example.com", shortCode: "custom123" });

        expect(res.status).toBe(201);
        expect(res.body.shortCode).toBe("custom123");
      });

      it("should reject a duplicate shortCode with HTTP 409", async () => {
        await request(app)
          .post("/api/urls")
          .set("Authorization", `Bearer ${user1Token}`)
          .send({ originalUrl: "https://example.com", shortCode: "duplicate123" });

        const res = await request(app)
          .post("/api/urls")
          .set("Authorization", `Bearer ${user2Token}`)
          .send({ originalUrl: "https://another.com", shortCode: "duplicate123" });

        expect(res.status).toBe(409);
        expect(res.body).toEqual({ error: "Short code already exists." });
      });
    });

    describe("GET /api/urls (Scoped to authenticated user)", () => {
      beforeEach(async () => {
        // User 1 creates 2 URLs
        await request(app)
          .post("/api/urls")
          .set("Authorization", `Bearer ${user1Token}`)
          .send({ originalUrl: "https://github.com/a", shortCode: "codea" });

        await request(app)
          .post("/api/urls")
          .set("Authorization", `Bearer ${user1Token}`)
          .send({ originalUrl: "https://github.com/b", shortCode: "codeb" });

        // User 2 creates 1 URL
        await request(app)
          .post("/api/urls")
          .set("Authorization", `Bearer ${user2Token}`)
          .send({ originalUrl: "https://google.com", shortCode: "codec" });
      });

      it("should return only URLs owned by User 1", async () => {
        const res = await request(app)
          .get("/api/urls")
          .set("Authorization", `Bearer ${user1Token}`);

        expect(res.status).toBe(200);
        expect(res.body.urls.length).toBe(2);
        expect(res.body.urls.map((u) => u.shortCode)).toEqual(expect.arrayContaining(["codea", "codeb"]));
        expect(res.body.urls.map((u) => u.shortCode)).not.toContain("codec");
        expect(res.body.pagination.total).toBe(2);
      });

      it("should return only URLs owned by User 2", async () => {
        const res = await request(app)
          .get("/api/urls")
          .set("Authorization", `Bearer ${user2Token}`);

        expect(res.status).toBe(200);
        expect(res.body.urls.length).toBe(1);
        expect(res.body.urls[0].shortCode).toBe("codec");
        expect(res.body.pagination.total).toBe(1);
      });

      it("should reject unauthenticated request with HTTP 401", async () => {
        const res = await request(app).get("/api/urls");
        expect(res.status).toBe(401);
      });

      it("should support pagination", async () => {
        const res = await request(app)
          .get("/api/urls?page=1&limit=1")
          .set("Authorization", `Bearer ${user1Token}`);

        expect(res.status).toBe(200);
        expect(res.body.urls.length).toBe(1);
        expect(res.body.pagination.totalPages).toBe(2);
      });

      it("should support search query within user scope", async () => {
        const res = await request(app)
          .get("/api/urls?search=codea")
          .set("Authorization", `Bearer ${user1Token}`);

        expect(res.status).toBe(200);
        expect(res.body.urls.length).toBe(1);
        expect(res.body.urls[0].shortCode).toBe("codea");
      });

      it("should support sorting", async () => {
        const res = await request(app)
          .get("/api/urls?sortBy=originalUrl&order=asc")
          .set("Authorization", `Bearer ${user1Token}`);

        expect(res.status).toBe(200);
        expect(res.body.urls[0].originalUrl).toBe("https://github.com/a");
      });
    });

    describe("GET /api/urls/:shortCode (Details & Ownership)", () => {
      beforeEach(async () => {
        await request(app)
          .post("/api/urls")
          .set("Authorization", `Bearer ${user1Token}`)
          .send({ originalUrl: "https://example.com", shortCode: "getcode" });
      });

      it("should allow the owner (User 1) to get URL details", async () => {
        const res = await request(app)
          .get("/api/urls/getcode")
          .set("Authorization", `Bearer ${user1Token}`);

        expect(res.status).toBe(200);
        expect(res.body.shortCode).toBe("getcode");
        expect(res.body.originalUrl).toBe("https://example.com");
      });

      it("should reject non-owner (User 2) with HTTP 403 Forbidden", async () => {
        const res = await request(app)
          .get("/api/urls/getcode")
          .set("Authorization", `Bearer ${user2Token}`);

        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: "Forbidden: You do not own this URL." });
      });

      it("should return HTTP 404 for a non-existing shortCode", async () => {
        const res = await request(app)
          .get("/api/urls/nonexistent999")
          .set("Authorization", `Bearer ${user1Token}`);

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: "Short URL not found." });
      });
    });

    describe("PATCH /api/urls/:shortCode (Update & Ownership)", () => {
      beforeEach(async () => {
        await request(app)
          .post("/api/urls")
          .set("Authorization", `Bearer ${user1Token}`)
          .send({ originalUrl: "https://old.com", shortCode: "patchcode" });
      });

      it("should allow the owner to update originalUrl", async () => {
        const res = await request(app)
          .patch("/api/urls/patchcode")
          .set("Authorization", `Bearer ${user1Token}`)
          .send({ originalUrl: "https://new.com" });

        expect(res.status).toBe(200);
        expect(res.body.originalUrl).toBe("https://new.com");
        expect(res.body.shortCode).toBe("patchcode");
      });

      it("should reject update attempt by non-owner with HTTP 403 Forbidden", async () => {
        const res = await request(app)
          .patch("/api/urls/patchcode")
          .set("Authorization", `Bearer ${user2Token}`)
          .send({ originalUrl: "https://hacked.com" });

        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: "Forbidden: You do not own this URL." });
      });

      it("should return 404 for non-existing shortCode", async () => {
        const res = await request(app)
          .patch("/api/urls/nonexistentcode")
          .set("Authorization", `Bearer ${user1Token}`)
          .send({ originalUrl: "https://example.com" });

        expect(res.status).toBe(404);
      });
    });

    describe("DELETE /api/urls/:shortCode (Deletion & Ownership)", () => {
      beforeEach(async () => {
        await request(app)
          .post("/api/urls")
          .set("Authorization", `Bearer ${user1Token}`)
          .send({ originalUrl: "https://delete-target.com", shortCode: "delcode" });
      });

      it("should reject delete attempt by non-owner with HTTP 403 Forbidden", async () => {
        const res = await request(app)
          .delete("/api/urls/delcode")
          .set("Authorization", `Bearer ${user2Token}`);

        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: "Forbidden: You do not own this URL." });
      });

      it("should allow owner to delete URL and return 404 when deleting again", async () => {
        const firstDel = await request(app)
          .delete("/api/urls/delcode")
          .set("Authorization", `Bearer ${user1Token}`);

        expect(firstDel.status).toBe(200);
        expect(firstDel.body).toEqual({ message: "Short URL deleted successfully." });

        const secondDel = await request(app)
          .delete("/api/urls/delcode")
          .set("Authorization", `Bearer ${user1Token}`);

        expect(secondDel.status).toBe(404);
      });
    });

    describe("GET /api/urls/:shortCode/analytics (Analytics & Ownership)", () => {
      beforeEach(async () => {
        await request(app)
          .post("/api/urls")
          .set("Authorization", `Bearer ${user1Token}`)
          .send({ originalUrl: "https://example.com", shortCode: "analycode" });

        // Simulate public clicks
        await request(app).get("/analycode");
      });

      it("should allow owner to view analytics", async () => {
        const res = await request(app)
          .get("/api/urls/analycode/analytics")
          .set("Authorization", `Bearer ${user1Token}`);

        expect(res.status).toBe(200);
        expect(res.body.shortCode).toBe("analycode");
        expect(res.body.clicks).toBe(1);
        expect(res.body.clickHistory.length).toBe(1);
      });

      it("should reject non-owner from viewing analytics with HTTP 403 Forbidden", async () => {
        const res = await request(app)
          .get("/api/urls/analycode/analytics")
          .set("Authorization", `Bearer ${user2Token}`);

        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: "Forbidden: You do not own this URL." });
      });
    });
  });

  describe("Public Redirection & Health Checks", () => {
    it("should redirect to original URL and increment click count without authentication", async () => {
      await request(app)
        .post("/api/urls")
        .set("Authorization", `Bearer ${user1Token}`)
        .send({ originalUrl: "https://example.com", shortCode: "redir123" });

      const redirRes = await request(app).get("/redir123");
      expect(redirRes.status).toBe(302);
      expect(redirRes.headers.location).toBe("https://example.com");

      // Verify clicks incremented
      const detailsRes = await request(app)
        .get("/api/urls/redir123")
        .set("Authorization", `Bearer ${user1Token}`);
      expect(detailsRes.body.clicks).toBe(1);
    });

    it("GET /health should return HTTP 200 and status ok without authentication", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok" });
    });

    it("GET /api-docs should serve Swagger UI documentation without authentication", async () => {
      const res = await request(app).get("/api-docs/");
      expect([200, 301, 302]).toContain(res.status);
    });
  });
});
