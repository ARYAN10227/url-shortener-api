import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "URL Shortener API",
      version: "1.0.0",
      description: "A high-performance RESTful API for shortening URLs, tracking click analytics, and managing short links.",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Local Server",
      },
    ],
    components: {
      schemas: {
        Url: {
          type: "object",
          properties: {
            _id: {
              type: "string",
              example: "64f1a2b3c4d5e6f7a8b9c0d1",
              description: "MongoDB document ID",
            },
            originalUrl: {
              type: "string",
              example: "https://example.com/very-long-url-path",
              description: "The original long URL",
            },
            shortCode: {
              type: "string",
              example: "abcd12",
              description: "Unique alphanumeric short code",
            },
            shortUrl: {
              type: "string",
              example: "http://localhost:3000/abcd12",
              description: "Full short URL for redirection",
            },
            clicks: {
              type: "integer",
              example: 42,
              description: "Total number of clicks",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              example: "2026-08-23T11:00:00.000Z",
              description: "Timestamp when the short URL was created",
            },
          },
        },
        Pagination: {
          type: "object",
          properties: {
            page: {
              type: "integer",
              example: 1,
            },
            limit: {
              type: "integer",
              example: 10,
            },
            total: {
              type: "integer",
              example: 50,
            },
            totalPages: {
              type: "integer",
              example: 5,
            },
          },
        },
        UrlListResponse: {
          type: "object",
          properties: {
            urls: {
              type: "array",
              items: {
                $ref: "#/components/schemas/Url",
              },
            },
            pagination: {
              $ref: "#/components/schemas/Pagination",
            },
          },
        },
        ClickHistoryItem: {
          type: "object",
          properties: {
            clickedAt: {
              type: "string",
              format: "date-time",
              example: "2026-08-23T11:05:00.000Z",
            },
          },
        },
        AnalyticsResponse: {
          type: "object",
          properties: {
            shortCode: {
              type: "string",
              example: "abcd12",
            },
            originalUrl: {
              type: "string",
              example: "https://example.com/very-long-url-path",
            },
            clicks: {
              type: "integer",
              example: 42,
            },
            filteredClicks: {
              type: "integer",
              example: 10,
            },
            createdAt: {
              type: "string",
              format: "date-time",
              example: "2026-08-23T11:00:00.000Z",
            },
            clickHistory: {
              type: "array",
              items: {
                $ref: "#/components/schemas/ClickHistoryItem",
              },
            },
          },
        },
        CreateUrlRequest: {
          type: "object",
          required: ["originalUrl"],
          properties: {
            originalUrl: {
              type: "string",
              example: "https://example.com/very-long-url-path",
              description: "Valid HTTP or HTTPS URL to shortener",
            },
            shortCode: {
              type: "string",
              example: "custom123",
              description: "Optional custom short code (3-30 alphanumeric chars, hyphens, underscores)",
            },
          },
        },
        UpdateUrlRequest: {
          type: "object",
          properties: {
            originalUrl: {
              type: "string",
              example: "https://example.com/updated-url-path",
              description: "New valid HTTP/HTTPS original URL",
            },
            shortCode: {
              type: "string",
              example: "newcustom123",
              description: "New custom short code",
            },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            error: {
              type: "string",
              example: "Invalid URL format. URL must start with http:// or https://",
            },
          },
        },
        SuccessMessageResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Short URL deleted successfully.",
            },
          },
        },
        HealthCheckResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              example: "ok",
            },
          },
        },
      },
    },
  },
  apis: ["./src/app.js", "./src/routes/*.js", "./src/config/swagger.js"],
};

const swaggerSpec = swaggerJsdoc(options);

export function setupSwagger(app) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
