import type { DuplicateCheckResponse } from '../schemas/receipt.schema.js';

export interface ReceiptsService {
  scanReceipt(imageBuffer: Buffer, userId: string): Promise<DuplicateCheckResponse>;
  ocrOnly(imageBuffer: Buffer): Promise<{ rawText: string }>;
}
