import { Router } from "express";
import {
  createShortUrl,
  getAllUrls,
  getUrlDetails,
  getUrlAnalytics,
  redirectToOriginalUrl,
  deleteUrl,
  updateUrl,
} from "../controllers/urlController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

/**
 * @openapi
 * /api/urls:
 *   post:
 *     summary: Create a short URL
 *     description: Creates a shortened URL owned by the authenticated user. Accepts an optional custom shortCode.
 *     tags:
 *       - URLs
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUrlRequest'
 *     responses:
 *       201:
 *         description: Short URL created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Url'
 *       400:
 *         description: Invalid request payload or validation failure
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - missing, invalid, or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       409:
 *         description: Short code collision / code already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   get:
 *     summary: Get all short URLs owned by user
 *     description: Retrieves a paginated list of short URLs owned by the authenticated user with optional search, sorting, and minClicks filters.
 *     tags:
 *       - URLs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number (1-indexed)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page (1 to 100)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, clicks, originalUrl, shortCode]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *       - in: query
 *         name: minClicks
 *         schema:
 *           type: integer
 *         description: Minimum click count filter
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search query matching originalUrl or shortCode
 *     responses:
 *       200:
 *         description: A paginated list of short URLs owned by the authenticated user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UrlListResponse'
 *       400:
 *         description: Invalid query parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - missing, invalid, or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 */
router.post("/api/urls", authenticate, createShortUrl);
router.get("/api/urls", authenticate, getAllUrls);

/**
 * @openapi
 * /api/urls/{shortCode}/analytics:
 *   get:
 *     summary: Get short URL analytics
 *     description: Retrieves click analytics and historical click timestamps for a short code owned by the authenticated user.
 *     tags:
 *       - Analytics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shortCode
 *         required: true
 *         schema:
 *           type: string
 *         description: The short code of the URL
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Limit number of click history entries returned (1 to 500)
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter clicks from this ISO date-time
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter clicks up to this ISO date-time
 *     responses:
 *       200:
 *         description: Analytics data for the requested short URL
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AnalyticsResponse'
 *       400:
 *         description: Invalid query parameters or date formats
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - missing, invalid, or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Forbidden - URL belongs to another user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Short URL not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/api/urls/:shortCode/analytics", authenticate, getUrlAnalytics);

/**
 * @openapi
 * /api/urls/{shortCode}:
 *   get:
 *     summary: Get short URL details
 *     description: Retrieves details of a short URL by its short code (owner only).
 *     tags:
 *       - URLs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shortCode
 *         required: true
 *         schema:
 *           type: string
 *         description: The short code of the URL
 *     responses:
 *       200:
 *         description: Short URL details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Url'
 *       401:
 *         description: Unauthorized - missing, invalid, or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Forbidden - URL belongs to another user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Short URL not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   patch:
 *     summary: Update short URL
 *     description: Updates the originalUrl and/or shortCode of an existing short link (owner only).
 *     tags:
 *       - URLs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shortCode
 *         required: true
 *         schema:
 *           type: string
 *         description: The current short code of the URL
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUrlRequest'
 *     responses:
 *       200:
 *         description: Updated short URL object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Url'
 *       400:
 *         description: Invalid payload or validation failure
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized - missing, invalid, or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Forbidden - URL belongs to another user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Short URL not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Target shortCode already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   delete:
 *     summary: Delete short URL
 *     description: Deletes a short URL document and cascades deletion to associated click records (owner only).
 *     tags:
 *       - URLs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shortCode
 *         required: true
 *         schema:
 *           type: string
 *         description: The short code of the URL to delete
 *     responses:
 *       200:
 *         description: Short URL deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessMessageResponse'
 *       401:
 *         description: Unauthorized - missing, invalid, or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Forbidden - URL belongs to another user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Short URL not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/api/urls/:shortCode", authenticate, getUrlDetails);
router.patch("/api/urls/:shortCode", authenticate, updateUrl);
router.delete("/api/urls/:shortCode", authenticate, deleteUrl);

/**
 * @openapi
 * /{shortCode}:
 *   get:
 *     summary: Redirect short code to original URL
 *     description: Increments click count, records a click entry, and redirects client with HTTP 302 to the original destination URL. Public endpoint - no authentication required.
 *     tags:
 *       - Redirection
 *     parameters:
 *       - in: path
 *         name: shortCode
 *         required: true
 *         schema:
 *           type: string
 *         description: The short code to redirect
 *     responses:
 *       302:
 *         description: Redirecting to original URL
 *       404:
 *         description: Short URL not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/:shortCode", redirectToOriginalUrl);

export default router;
