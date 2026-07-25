import Anthropic from '@anthropic-ai/sdk';
import Tesseract from 'tesseract.js';
import crypto from 'crypto';
import { buildReceiptAnalysisPrompt } from '../prompts/receipt-analysis.prompt.js';
import type { ScanReceiptResponse, DuplicateCheckResponse } from '../schemas/receipt.schema.js';
import { AppError, ValidationError } from '../lib/errors.js';
import { RECEIPT_MESSAGES } from '../lib/constants/receipt.constants.js';
import type { TransactionsService, TxWithAccountCategory } from './transactions.service.port.js';
import type { ReceiptsService } from './receipts.service.port.js';

// Initialize Claude API client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export class ReceiptsServiceImpl implements ReceiptsService {
  constructor(private transactionsService: TransactionsService) {}

  /**
   * Calculate SHA256 hash of image buffer
   */
  private calculateImageHash(imageBuffer: Buffer): string {
    return crypto.createHash('sha256').update(imageBuffer).digest('hex');
  }

  /**
   * Check for exact duplicate by image hash
   */
  private async checkExactDuplicate(
    imageHash: string,
    userId: string
  ): Promise<TxWithAccountCategory | null> {
    return this.transactionsService.findByImageHash(userId, imageHash);
  }

  /**
   * Check for similar transactions by amount, date, and description
   */
  private async checkSimilarTransactions(
    amount: number,
    date: string,
    description: string,
    userId: string
  ) {
    const targetDate = new Date(date);
    const twoDaysBefore = new Date(targetDate);
    twoDaysBefore.setDate(twoDaysBefore.getDate() - 2);
    const twoDaysAfter = new Date(targetDate);
    twoDaysAfter.setDate(twoDaysAfter.getDate() + 2);

    // Find transactions with similar amount (±0.50€) and date (±2 days)
    const similarTransactions = await this.transactionsService.findSimilarByAmountAndDate(userId, {
      amountGte: amount - 0.5,
      amountLte: amount + 0.5,
      dateGte: twoDaysBefore,
      dateLte: twoDaysAfter,
    });

    // Filter by description similarity (if description exists)
    if (description && similarTransactions.length > 0) {
      const descLower = description.toLowerCase();
      const matches = similarTransactions.filter((tx) => {
        if (!tx.description) return false;
        const txDescLower = tx.description.toLowerCase();

        // Simple similarity: check if one contains key words from the other
        const words = descLower.split(/\s+/).filter((w) => w.length > 3);
        const matchedWords = words.filter((word) => txDescLower.includes(word));

        return matchedWords.length >= Math.min(2, words.length * 0.5);
      });

      return matches[0]; // Return first match
    }

    return similarTransactions[0]; // Return first similar transaction
  }

  /**
   * Extract text from image using Tesseract OCR
   */
  private async extractTextFromImage(imageBuffer: Buffer): Promise<string> {
    try {
      const result = await Tesseract.recognize(imageBuffer, 'spa');

      return result.data.text;
    } catch (error) {
      throw new AppError(RECEIPT_MESSAGES.OCR_ERROR, 500, 'INTEGRATION_ERROR');
    }
  }

  /**
   * Process extracted text with Claude to structure receipt data
   */
  private async processReceiptWithClaude(ocrText: string): Promise<ScanReceiptResponse> {
    const prompt = buildReceiptAnalysisPrompt(ocrText);

    try {
      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Extract JSON from Claude's response
      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

      // Try to parse JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new AppError(RECEIPT_MESSAGES.AI_NO_JSON, 500, 'INTEGRATION_ERROR');
      }

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      } catch {
        throw new AppError(RECEIPT_MESSAGES.AI_MALFORMED_JSON, 500, 'INTEGRATION_ERROR');
      }

      const rawItems = Array.isArray(data.items) ? (data.items as Record<string, unknown>[]) : [];

      return {
        amount: parseFloat(String(data.amount ?? 0)) || 0,
        description:
          typeof data.description === 'string' ? data.description : 'Gasto sin descripción',
        date: typeof data.date === 'string' ? data.date : new Date().toISOString().split('T')[0],
        suggestedCategory:
          typeof data.suggestedCategory === 'string' ? data.suggestedCategory : undefined,
        confidence: (data.confidence as ScanReceiptResponse['confidence']) ?? 'low',
        rawText: ocrText,
        imageHash: '',
        items: rawItems.map((item) => ({
          name: typeof item.name === 'string' ? item.name : 'Producto sin nombre',
          quantity: parseFloat(String(item.quantity ?? 1)) || 1,
          unitPrice: parseFloat(String(item.unitPrice ?? 0)) || 0,
          totalPrice: parseFloat(String(item.totalPrice ?? 0)) || 0,
        })),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(RECEIPT_MESSAGES.AI_PROCESSING_ERROR, 500, 'INTEGRATION_ERROR');
    }
  }

  /**
   * Main function: Scan receipt and extract structured data with duplicate detection
   */
  async scanReceipt(imageBuffer: Buffer, userId: string): Promise<DuplicateCheckResponse> {
    // Step 1: Calculate image hash
    const imageHash = this.calculateImageHash(imageBuffer);

    // Step 2: Check for exact duplicate (same image)
    const exactDuplicate = await this.checkExactDuplicate(imageHash, userId);

    if (exactDuplicate) {
      return {
        duplicate: true,
        matchType: 'exact',
        existingTransaction: {
          id: exactDuplicate.id,
          amount: Number(exactDuplicate.amount),
          description: exactDuplicate.description,
          date: exactDuplicate.date.toISOString(),
          createdAt: exactDuplicate.createdAt.toISOString(),
          account: exactDuplicate.account,
          category: exactDuplicate.category,
        },
      };
    }

    // Step 3: Extract text with OCR
    const ocrText = await this.extractTextFromImage(imageBuffer);

    if (!ocrText || ocrText.trim().length < 10) {
      throw new ValidationError(RECEIPT_MESSAGES.UNREADABLE_TEXT);
    }

    // Step 4: Process with Claude
    const structuredData = await this.processReceiptWithClaude(ocrText);
    structuredData.imageHash = imageHash; // Add hash to structured data

    // Step 5: Check for similar transactions
    const similarTransaction = await this.checkSimilarTransactions(
      structuredData.amount,
      structuredData.date,
      structuredData.description,
      userId
    );

    if (similarTransaction) {
      return {
        duplicate: true,
        matchType: 'similar',
        existingTransaction: {
          id: similarTransaction.id,
          amount: Number(similarTransaction.amount),
          description: similarTransaction.description,
          date: similarTransaction.date.toISOString(),
          createdAt: similarTransaction.createdAt.toISOString(),
          account: similarTransaction.account,
          category: similarTransaction.category,
        },
        scannedData: structuredData,
      };
    }

    // Step 6: No duplicates found
    return {
      duplicate: false,
      matchType: 'none',
      scannedData: structuredData,
    };
  }

  /**
   * OCR-only function: Extract text without AI processing (FREE)
   */
  async ocrOnly(imageBuffer: Buffer): Promise<{ rawText: string }> {
    const rawText = await this.extractTextFromImage(imageBuffer);

    if (!rawText || rawText.trim().length < 10) {
      throw new ValidationError(RECEIPT_MESSAGES.UNREADABLE_TEXT);
    }

    return { rawText };
  }
}
