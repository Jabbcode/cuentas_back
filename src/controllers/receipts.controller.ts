import { Response, NextFunction } from 'express';
import * as receiptsService from '../services/receipts.service.js';
import { AuthRequest } from '../types/index.js';

export async function scanReceipt(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // Check if file was uploaded
    if (!req.file) {
      res.status(400).json({ error: 'No se proporcionó una imagen' });
      return;
    }

    // Validate file type
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(req.file.mimetype)) {
      res.status(400).json({
        error: 'Formato de archivo no válido. Use JPG, PNG o WEBP'
      });
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (req.file.size > maxSize) {
      res.status(400).json({
        error: 'El archivo es demasiado grande. Máximo 10MB'
      });
      return;
    }

    // Process the receipt with duplicate detection
    const result = await receiptsService.scanReceipt(req.file.buffer, req.user!.userId);

    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({
        error: error.message || 'Error al procesar la factura'
      });
      return;
    }

    next(error);
  }
}

export async function ocrOnly(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // Check if file was uploaded
    if (!req.file) {
      res.status(400).json({ error: 'No se proporcionó una imagen' });
      return;
    }

    // Validate file type
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimes.includes(req.file.mimetype)) {
      res.status(400).json({
        error: 'Formato de archivo no válido. Use JPG, PNG o WEBP'
      });
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (req.file.size > maxSize) {
      res.status(400).json({
        error: 'El archivo es demasiado grande. Máximo 10MB'
      });
      return;
    }

    // Extract text only (no AI)
    const result = await receiptsService.ocrOnly(req.file.buffer);

    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({
        error: error.message || 'Error al extraer texto de la imagen'
      });
      return;
    }

    next(error);
  }
}
