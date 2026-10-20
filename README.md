<div align="center">

# 🔗 URL Shortener API

**REST API behind Shortly — shorten links, redirect them, and track every click.**

[![CI](https://github.com/ARYAN10227/url-shortener-api/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/ARYAN10227/url-shortener-api/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT-000000?logo=jsonwebtokens&logoColor=white)
![Render](https://img.shields.io/badge/Deployed_on-Render-46E3B7?logo=render&logoColor=black)

[**📘 Live API docs (Swagger)**](https://url-shortener-api-h1dj.onrender.com/api-docs) ·
[**❤️ Health check**](https://url-shortener-api-h1dj.onrender.com/health) ·
[**🖥️ Frontend repo**](https://github.com/ARYAN10227/url-shortener-frontend)

</div>

A production-ready RESTful URL Shortener service built with Node.js, Express, and MongoDB, featuring multi-user JWT authentication and resource ownership authorization.

> ⏳ Hosted on Render's free tier. A [keep-alive job](.github/workflows/keepalive.yml) pings
> `/health/db` every 14 minutes, so the server stays awake and the free MongoDB Atlas cluster stays
> active. If it ever does sleep, the first request can take up to a minute.

## 🎯 Try it in 10 seconds (demo account)

No sign-up needed. A shared, public demo account comes with sample links and click history:

| | |
|---|---|
| Email | `demo@urlshortener.dev` |
| Password | `demo1234` |
| One-click | `POST /api/auth/demo` → returns a JWT for the demo account |

```sh
TOKEN=$(curl -s -X POST https://url-shortener-api-h1dj.onrender.com/api/auth/demo | jq -r .token)
curl -s https://url-shortener-api-h1dj.onrender.com/api/urls -H "Authorization: Bearer $TOKEN" | jq
```

If the demo links are ever all deleted, the next demo login re-creates them. Turn the demo off
with `DEMO_ENABLED=false`.

## 🛡️ Production hardening

- **Correct client IPs behind Render's proxy** (`trust proxy`), so rate limits apply per visitor
  instead of one shared bucket for the whole site, and generated short URLs use `https://`.
- **Malformed JSON → `400`**, oversized bodies → `413`, never a confusing `500`.
- **Reserved short codes** (`api`, `api-docs`, `health`, …) can't be claimed, so a custom alias can
  never shadow an API route.
- **Cryptographically random 7-character base62 codes** (≈3.5 trillion combinations).
- Every fix is covered by the integration suite, which runs in CI against a real MongoDB.

## Features

- **User Authentication**: Secure user registration, password hashing with `bcryptjs`, and JSON Web Token (JWT) issuing.
- **URL Ownership & Authorization**: Multi-tenant resource isolation ensuring users can only view, edit, delete, and inspect analytics for their own shortened URLs.
- **Public Short URL Redirection**: Seamless, unauthenticated redirection (`GET /:shortCode`) with instant click count increments and detailed click timestamp tracking.
- **Short URL Management**: Create shortened URLs with random alphanumeric codes or custom user-defined short codes.
- **Detailed Analytics**: Track total clicks and fetch historical click timestamps with optional date-time range filtering (`fromDate`, `toDate`).
- **Query Capabilities**: URL listing with pagination, search by original URL/shortCode, multi-field sorting, and minimum click count filtering.
- **Database Optimization**: Indexed MongoDB collections (`users`, `urls`, `clicks`) for fast indexed lookups and uniqueness constraints.
- **Swagger / OpenAPI 3.0 Documentation**: Interactive API documentation at `/api-docs` with JWT Bearer authorization support.
- **Security & Reliability**: Helmet HTTP headers, CORS configuration, centralized error handling, and rate limiting on `/api` routes.
- **Containerization & CI/CD**: Ready for Docker/Docker Compose deployment and GitHub Actions CI workflow.

---

## Authentication & Authorization Architecture

### Authentication Flow
1. **Registration (`POST /api/auth/register`)**:
   - Clients submit `name`, `email`, and `password` (minimum 6 characters).
   - Validates email formatting and checks for duplicates.
   - Hashes password using `bcryptjs` (salt rounds: 10). Plain-text passwords and password hashes are never exposed.
   - Automatically issues a signed JWT token containing user identifiers.
2. **Login (`POST /api/auth/login`)**:
   - Authenticates user credentials via `bcrypt.compare`.
   - Returns a signed JWT token on success.
3. **Current Profile (`GET /api/auth/me`)**:
   - Authenticated route returning the current user's profile (`_id`, `name`, `email`, `createdAt`).

### JWT Bearer Authorization
Protected API routes require an `Authorization` HTTP header with the format:
```http
Authorization: Bearer <your_jwt_token>
```

### URL Ownership Rules
- **Creation (`POST /api/urls`)**: The URL is automatically tagged with the authenticated user's ID (`userId: req.user._id`). The client cannot spoof ownership.
- **Listing (`GET /api/urls`)**: Returns only the URLs belonging to the authenticated user.
- **Details (`GET /api/urls/:shortCode`)**: Returns `403 Forbidden` if another user attempts to view details of a URL they do not own.
- **Modification (`PATCH /api/urls/:shortCode`)**: Returns `403 Forbidden` if a non-owner tries to modify the URL.
- **Deletion (`DELETE /api/urls/:shortCode`)**: Returns `403 Forbidden` if a non-owner attempts deletion. Cascades deletion to associated click records on success.
- **Analytics (`GET /api/urls/:shortCode/analytics`)**: Returns `403 Forbidden` if a non-owner attempts to inspect analytics.

### Public Redirection
- **`GET /:shortCode` remains completely public**: Any user or browser can open shortened links without authentication. Clicks are logged and tracked automatically.

### Legacy URL Compatibility
- Existing URLs created prior to authentication (lacking a `userId` field) cannot be modified, deleted, or viewed via user management endpoints by arbitrary users, ensuring backwards compatibility and data isolation.

---

## API Endpoints Reference

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new user account and receive JWT | No |
| `POST` | `/api/auth/login` | Log in with email and password to receive JWT | No |
| `POST` | `/api/auth/demo` | One-click login to the public demo account (JWT valid 1 day) | No |
| `GET` | `/api/auth/me` | Retrieve profile of the logged-in user | **Yes (Bearer)** |

#### Example: User Registration
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Aryan Raj",
    "email": "user@example.com",
    "password": "securePassword123"
  }'
```

Response (`201 Created`):
```json
{
  "message": "User registered successfully.",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "name": "Aryan Raj",
    "email": "user@example.com",
    "createdAt": "2026-08-24T00:00:00.000Z"
  }
}
```

---

### URL Management Endpoints (Protected)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/urls` | Create short URL (auto-generated or custom code) | **Yes (Bearer)** |
| `GET` | `/api/urls` | Get paginated list of user's URLs | **Yes (Bearer)** |
| `GET` | `/api/urls/:shortCode` | Get URL details (owner only) | **Yes (Bearer)** |
| `PATCH` | `/api/urls/:shortCode` | Update destination URL or short code (owner only) | **Yes (Bearer)** |
| `DELETE` | `/api/urls/:shortCode` | Delete short URL and its click history (owner only) | **Yes (Bearer)** |
| `GET` | `/api/urls/:shortCode/analytics` | Get click analytics and history (owner only) | **Yes (Bearer)** |

#### Example: Create Short URL
```bash
curl -X POST http://localhost:3000/api/urls \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_jwt_token>" \
  -d '{
    "originalUrl": "https://example.com/very/long/url",
    "shortCode": "custom123"
  }'
```

---

### Public & System Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/:shortCode` | Public short link redirection (HTTP 302) | No |
| `GET` | `/health` | Health check endpoint (`{"status": "ok"}`) | No |
| `GET` | `/api-docs` | Interactive Swagger UI API documentation | No |

---

## Environment Variables

Configure the following environment variables in `.env` (or cloud dashboard):

| Variable | Required | Description | Example / Default |
|---|---|---|---|
| `PORT` | Optional | Port for the HTTP server | `3000` |
| `MONGODB_URI` | **Required** | MongoDB connection URI | `mongodb://localhost:27017` or Atlas URI |
| `MONGODB_DB_NAME` | Optional | Target MongoDB database name | `url_shortener` |
| `NODE_ENV` | Optional | Node environment (`development`, `production`, `test`) | `development` |
| `JWT_SECRET` | **Required** | Secret key used to sign and verify JWT tokens | `your_super_secret_jwt_key_32_chars` |
| `JWT_EXPIRES_IN` | Optional | Lifetime expiration of issued JWTs | `7d` |
| `DEMO_ENABLED` | Optional | Enable the public demo account and `POST /api/auth/demo` | `true` |
| `DEMO_EMAIL` / `DEMO_PASSWORD` | Optional | Demo account credentials | `demo@urlshortener.dev` / `demo1234` |
| `TRUST_PROXY_HOPS` | Optional | Reverse proxies in front of the app (Render = 1) | `1` |

---

## Local Setup (Without Docker)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure `.env` file:**
   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017
   MONGODB_DB_NAME=url_shortener
   NODE_ENV=development
   JWT_SECRET=your_secret_jwt_key
   JWT_EXPIRES_IN=7d
   ```

3. **Start the application:**
   ```bash
   npm run dev    # with watch mode
   # or
   npm start      # standard mode
   ```

4. **Run syntax checks & tests:**
   ```bash
   npm run check
   npm test
   ```

---

## Docker Deployment

The application includes `Dockerfile` and `docker-compose.yml` configurations:

```bash
# Build and run containers
docker compose up -d --build

# View logs
docker compose logs -f app

# Stop containers
docker compose down
```

---

## Production Deployment (Render / Cloud)

1. **MongoDB Atlas**: Ensure database access user exists and network IP whitelist is configured to `0.0.0.0/0`.
2. **Environment Variables**: Set `MONGODB_URI`, `MONGODB_DB_NAME`, `JWT_SECRET`, `JWT_EXPIRES_IN`, and `NODE_ENV=production`.
3. **Build & Start**: Build Command: `npm ci`, Start Command: `npm start`.
4. **Health Check**: Set health check path to `/health`.

---

<div align="center">

Built by **Aryan Raj** ·
[GitHub](https://github.com/ARYAN10227) ·
[LinkedIn](https://linkedin.com/in/aryan-raj-2b3868340)

</div>
