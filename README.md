# URL Shortener API

A RESTful URL Shortener service built with Node.js, Express, and MongoDB.

## Features

- Short URL creation with auto-generated or custom short codes
- Redirection service with click tracking
- Click analytics and history with date filtering
- Pagination, search, sorting, and minClicks filtering
- MongoDB indexing for fast queries and uniqueness constraints
- Swagger/OpenAPI interactive UI documentation at `/api-docs`
- Rate limiting and security middleware (Helmet, CORS)
- Fully containerized with Docker & Docker Compose

---

## Local Setup (Without Docker)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017
   MONGODB_DB_NAME=url_shortener
   NODE_ENV=development
   ```

3. **Start the application:**
   ```bash
   npm run dev
   ```
   Or for production mode:
   ```bash
   npm start
   ```

4. **Run tests:**
   ```bash
   npm test
   ```

---

## Docker Deployment

The application is containerized using Docker and Docker Compose for easy deployment and container orchestration.

### Prerequisites
- Docker Engine (v20.10+)
- Docker Compose (v2.0+)

### Docker Commands

- **Build and start containers in the foreground:**
  ```bash
  docker compose up --build
  ```

- **Start containers in detached mode (background):**
  ```bash
  docker compose up -d --build
  ```

- **View application logs:**
  ```bash
  docker compose logs -f app
  ```

- **Stop running containers:**
  ```bash
  docker compose stop
  ```

- **Stop and remove containers and networks:**
  ```bash
  docker compose down
  ```

- **Stop and remove containers, networks, AND persistent volumes (deletes database data):**
  ```bash
  docker compose down -v
  ```

---

## Continuous Integration (CI)

This project uses **GitHub Actions** for automated continuous integration (`.github/workflows/ci.yml`).

- **Triggers:** Automatically runs on every `push` to `main` and on every `pull_request` targeting `main`.
- **Workflow Pipeline:**
  1. Checks out repository code.
  2. Sets up Node.js 20 environment with npm caching.
  3. Spins up a temporary MongoDB 7 service container on port 27017.
  4. Runs `npm ci` for clean dependency installation.
  5. Executes `npm run check` for automated JavaScript syntax validation across all codebase files.
  6. Executes `npm test` to run all Jest + Supertest integration tests against MongoDB.

---

## Production Deployment

The application is cloud-ready and can be deployed to platforms like **Render**, **Railway**, **Fly.io**, or **Heroku** connected to a managed MongoDB database service such as **MongoDB Atlas**.

### Required Environment Variables

Configure the following environment variables in your cloud deployment platform settings:

| Variable | Description | Example / Required Format |
|---|---|---|
| `PORT` | HTTP port provided by hosting environment | `10000` (automatically set by Render) |
| `MONGODB_URI` | Connection string for managed MongoDB (e.g. Atlas) | `mongodb+srv://<user>:<password>@cluster.mongodb.net` |
| `MONGODB_DB_NAME` | Name of the database to connect to | `url_shortener` |
| `NODE_ENV` | Environment mode | `production` |

### Cloud Deployment (e.g. Render)

1. **Deploying Web Service:**
   - Connect your GitHub repository to Render.
   - Create a new **Web Service**.
   - Build Command: `npm ci`
   - Start Command: `npm start`
2. **Database Setup:**
   - Create a MongoDB cluster on MongoDB Atlas (or Render Managed MongoDB).
   - Set `MONGODB_URI` in Environment Variables to your Atlas connection string (ensure IP whitelist includes `0.0.0.0/0` or deployment IPs).
   - Set `MONGODB_DB_NAME=url_shortener`.
   - Set `NODE_ENV=production`.
3. **Health Check Configuration:**
   - Set Health Check Path in Render settings to `/health`.

---

## API & Documentation

- **Base URL:** `http://localhost:3000` (or your production cloud URL)
- **Health Check Endpoint:** `GET /health` (Returns `{"status": "ok"}`)
- **Swagger OpenAPI Documentation:** `http://localhost:3000/api-docs` (or `<your-production-url>/api-docs`)
