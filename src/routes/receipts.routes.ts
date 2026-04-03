import { Router } from 'express';
import multer from 'multer';
import * as receiptsController from '../controllers/receipts.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

// Configure multer for memory storage (we'll process the buffer directly)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
});

// All routes require authentication
router.use(authMiddleware);

/**
 * POST /api/receipts/scan
 * Scan a receipt image and extract structured data using OCR + AI
 *
 * Body: multipart/form-data
 * - image: file (JPG, PNG, WEBP)
 *
 * Response:
 * {
 *   amount: number,
 *   description: string,
 *   date: string (ISO),
 *   suggestedCategory: string,
 *   confidence: "high" | "medium" | "low",
 *   rawText?: string
 * }
 */
router.post('/scan', upload.single('image'), receiptsController.scanReceipt);

/**
 * POST /api/receipts/ocr
 * Extract text from receipt image using OCR only (FREE - No AI)
 *
 * Body: multipart/form-data
 * - image: file (JPG, PNG, WEBP)
 *
 * Response:
 * {
 *   rawText: string
 * }
 */
router.post('/ocr', upload.single('image'), receiptsController.ocrOnly);

export default router;
