import request from "supertest";
import app from "../src/app.js";
import { connectToDatabase, getDatabase, closeDatabaseConnection } from "../src/mongodb.js";

describe("URL Shortener API Integration Tests", () => {
  let db;

  beforeAll(async () => {
    // Connect to a dedicated test database
    await connectToDatabase("url_shortener_test");
    db = getDatabase();
  });

  beforeEach(async () => {
    // Clean test collections to ensure test isolation
    await db.collection("urls").deleteMany({});
    await db.collection("clicks").deleteMany({});
  });

  afterAll(async () => {
    // Clean up test data and close database connection
    if (db) {
      await db.collection("urls").deleteMany({});
      await db.collection("clicks").deleteMany({});
    }
    await closeDatabaseConnection();
  });

  describe("POST /api/urls", () => {
    it("should successfully create a short URL with auto-generated code", async () => {
      const res = await request(app)
        .post("/api/urls")
        .send({ originalUrl: "https://example.com" });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("_id");
      expect(res.body.originalUrl).toBe("https://example.com");
      expect(res.body).toHaveProperty("shortCode");
      expect(res.body.clicks).toBe(0);
      expect(res.body).toHaveProperty("createdAt");
      expect(res.body).toHaveProperty("shortUrl");
    });

    it("should reject an invalid originalUrl", async () => {
      const res = await request(app)
        .post("/api/urls")
        .send({ originalUrl: "invalid-url-string" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toBe("Invalid URL format.");
    });

    it("should create a URL with a custom shortCode", async () => {
      const res = await request(app)
        .post("/api/urls")
        .send({ originalUrl: "https://example.com", shortCode: "custom123" });

      expect(res.status).toBe(201);
      expect(res.body.shortCode).toBe("custom123");
    });

    it("should reject a duplicate shortCode with HTTP 409", async () => {
      await request(app)
        .post("/api/urls")
        .send({ originalUrl: "https://example.com", shortCode: "duplicate123" });

      const res = await request(app)
        .post("/api/urls")
        .send({ originalUrl: "https://another.com", shortCode: "duplicate123" });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: "Short code already exists." });
    });
  });

  describe("GET /api/urls/:shortCode", () => {
    it("should return details for an existing shortCode", async () => {
      await request(app)
        .post("/api/urls")
        .send({ originalUrl: "https://example.com", shortCode: "getcode" });

      const res = await request(app).get("/api/urls/getcode");

      expect(res.status).toBe(200);
      expect(res.body.shortCode).toBe("getcode");
      expect(res.body.originalUrl).toBe("https://example.com");
    });

    it("should return HTTP 404 for a non-existing shortCode", async () => {
      const res = await request(app).get("/api/urls/nonexistent999");

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Short URL not found." });
    });
  });

  describe("PATCH /api/urls/:shortCode", () => {
    it("should update originalUrl", async () => {
      await request(app)
        .post("/api/urls")
        .send({ originalUrl: "https://old.com", shortCode: "patchcode" });

      const res = await request(app)
        .patch("/api/urls/patchcode")
        .send({ originalUrl: "https://new.com" });

      expect(res.status).toBe(200);
      expect(res.body.originalUrl).toBe("https://new.com");
      expect(res.body.shortCode).toBe("patchcode");
    });

    it("should update shortCode", async () => {
      await request(app)
        .post("/api/urls")
        .send({ originalUrl: "https://example.com", shortCode: "oldcode" });

      const res = await request(app)
        .patch("/api/urls/oldcode")
        .send({ shortCode: "newcode" });

      expect(res.status).toBe(200);
      expect(res.body.shortCode).toBe("newcode");
    });

    it("should return 400 for invalid input", async () => {
      await request(app)
        .post("/api/urls")
        .send({ originalUrl: "https://example.com", shortCode: "invalidtest" });

      const res = await request(app)
        .patch("/api/urls/invalidtest")
        .send({ originalUrl: "not-a-valid-url" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });

    it("should return 404 for non-existing shortCode", async () => {
      const res = await request(app)
        .patch("/api/urls/nonexistentcode")
        .send({ originalUrl: "https://example.com" });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Short URL not found." });
    });

    it("should return 409 for duplicate shortCode", async () => {
      await request(app)
        .post("/api/urls")
        .send({ originalUrl: "https://one.com", shortCode: "existingone" });

      await request(app)
        .post("/api/urls")
        .send({ originalUrl: "https://two.com", shortCode: "existingtwo" });

      const res = await request(app)
        .patch("/api/urls/existingtwo")
        .send({ shortCode: "existingone" });

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: "Short code already exists." });
    });
  });

  describe("DELETE /api/urls/:shortCode", () => {
    it("should delete an existing URL and return 404 when deleting again", async () => {
      await request(app)
        .post("/api/urls")
        .send({ originalUrl: "https://delete-target.com", shortCode: "delcode" });

      const firstDel = await request(app).delete("/api/urls/delcode");
      expect(firstDel.status).toBe(200);
      expect(firstDel.body).toEqual({ message: "Short URL deleted successfully." });

      const secondDel = await request(app).delete("/api/urls/delcode");
      expect(secondDel.status).toBe(404);
      expect(secondDel.body).toEqual({ error: "Short URL not found." });
    });
  });

  describe("GET /api/urls", () => {
    beforeEach(async () => {
      await request(app)
        .post("/api/urls")
        .send({ originalUrl: "https://github.com/a", shortCode: "codea" });

      await request(app)
        .post("/api/urls")
        .send({ originalUrl: "https://github.com/b", shortCode: "codeb" });

      await request(app)
        .post("/api/urls")
        .send({ originalUrl: "https://google.com", shortCode: "codec" });
    });

    it("should support pagination", async () => {
      const res = await request(app).get("/api/urls?page=1&limit=2");
      expect(res.status).toBe(200);
      expect(res.body.urls.length).toBe(2);
      expect(res.body.pagination).toEqual({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
    });

    it("should support search query", async () => {
      const res = await request(app).get("/api/urls?search=github");
      expect(res.status).toBe(200);
      expect(res.body.urls.length).toBe(2);
    });

    it("should support sorting", async () => {
      const res = await request(app).get("/api/urls?sortBy=originalUrl&order=asc");
      expect(res.status).toBe(200);
      expect(res.body.urls[0].originalUrl).toBe("https://github.com/a");
    });

    it("should support minClicks filtering", async () => {
      // Simulate clicks on codea
      await request(app).get("/codea");
      await request(app).get("/codea");

      const res = await request(app).get("/api/urls?minClicks=2");
      expect(res.status).toBe(200);
      expect(res.body.urls.length).toBe(1);
      expect(res.body.urls[0].shortCode).toBe("codea");
    });

    it("should return HTTP 400 for invalid query parameters", async () => {
      const res = await request(app).get("/api/urls?page=0");
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    });
  });

  describe("GET /api/urls/:shortCode/analytics", () => {
    it("should return analytics for an existing URL", async () => {
      await request(app)
        .post("/api/urls")
        .send({ originalUrl: "https://example.com", shortCode: "analycode" });

      await request(app).get("/analycode");

      const res = await request(app).get("/api/urls/analycode/analytics");
      expect(res.status).toBe(200);
      expect(res.body.shortCode).toBe("analycode");
      expect(res.body.clicks).toBe(1);
      expect(res.body.clickHistory.length).toBe(1);
    });

    it("should support limit query parameter for click history", async () => {
      await request(app)
        .post("/api/urls")
        .send({ originalUrl: "https://example.com", shortCode: "limicode" });

      await request(app).get("/limicode");
      await request(app).get("/limicode");

      const res = await request(app).get("/api/urls/limicode/analytics?limit=1");
      expect(res.status).toBe(200);
      expect(res.body.clickHistory.length).toBe(1);
    });

    it("should validate invalid dates and return HTTP 400", async () => {
      const res = await request(app).get("/api/urls/analycode/analytics?from=invalid-date");
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "from must be a valid ISO date string." });
    });

    it("should return HTTP 404 for a non-existing shortCode", async () => {
      const res = await request(app).get("/api/urls/nonexistentanalytics/analytics");
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Short URL not found." });
    });
  });

  describe("GET /:shortCode (Redirection)", () => {
    it("should redirect to original URL and increment click count", async () => {
      await request(app)
        .post("/api/urls")
        .send({ originalUrl: "https://example.com", shortCode: "redir123" });

      const redirRes = await request(app).get("/redir123");
      expect(redirRes.status).toBe(302);
      expect(redirRes.headers.location).toBe("https://example.com");

      const detailsRes = await request(app).get("/api/urls/redir123");
      expect(detailsRes.body.clicks).toBe(1);
    });
  });

  describe("GET /health", () => {
    it("should return HTTP 200 and status ok", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok" });
    });
  });

  describe("GET /api-docs", () => {
    it("should serve Swagger UI documentation (redirect or 200)", async () => {
      const res = await request(app).get("/api-docs/");
      expect([200, 301, 302]).toContain(res.status);
    });
  });
});
