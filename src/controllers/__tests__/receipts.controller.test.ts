import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeReq, fakeRes, fakeNext } from './http-fakes.js';

const mocked = vi.hoisted(() => ({
  scanReceipt: vi.fn(),
  ocrOnly: vi.fn(),
}));

vi.mock('../../bootstrap.js', () => ({ receiptsService: mocked }));

import * as controller from '../receipts.controller.js';

function fakeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    buffer: Buffer.from('img'),
    mimetype: 'image/jpeg',
    size: 1024,
    ...overrides,
  } as Express.Multer.File;
}

describe('receipts.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('scanReceipt', () => {
    it('sin archivo -> 400', async () => {
      const res = fakeRes();

      await controller.scanReceipt(fakeReq({ file: undefined }), res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mocked.scanReceipt).not.toHaveBeenCalled();
    });

    it('mimetype no permitido -> 400', async () => {
      const res = fakeRes();
      const req = fakeReq({ file: fakeFile({ mimetype: 'application/pdf' }) });

      await controller.scanReceipt(req, res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mocked.scanReceipt).not.toHaveBeenCalled();
    });

    it('archivo > 10MB -> 400', async () => {
      const res = fakeRes();
      const req = fakeReq({ file: fakeFile({ size: 11 * 1024 * 1024 }) });

      await controller.scanReceipt(req, res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mocked.scanReceipt).not.toHaveBeenCalled();
    });

    it('archivo válido: llama al service con el buffer y userId', async () => {
      mocked.scanReceipt.mockResolvedValue({ duplicate: false });
      const res = fakeRes();
      const file = fakeFile();
      const req = fakeReq({ file });

      await controller.scanReceipt(req, res, fakeNext());

      expect(mocked.scanReceipt).toHaveBeenCalledWith(file.buffer, 'user-1');
      expect(res.json).toHaveBeenCalledWith({ duplicate: false });
    });

    it('error del service -> 500 con su mensaje (no next)', async () => {
      mocked.scanReceipt.mockRejectedValue(new Error('Error al procesar la factura con IA'));
      const res = fakeRes();
      const next = fakeNext();

      await controller.scanReceipt(fakeReq({ file: fakeFile() }), res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Error al procesar la factura con IA' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('ocrOnly', () => {
    it('sin archivo -> 400', async () => {
      const res = fakeRes();

      await controller.ocrOnly(fakeReq({ file: undefined }), res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mocked.ocrOnly).not.toHaveBeenCalled();
    });

    it('archivo válido: responde con el texto extraído', async () => {
      mocked.ocrOnly.mockResolvedValue({ rawText: 'texto ocr' });
      const res = fakeRes();
      const file = fakeFile();

      await controller.ocrOnly(fakeReq({ file }), res, fakeNext());

      expect(mocked.ocrOnly).toHaveBeenCalledWith(file.buffer);
      expect(res.json).toHaveBeenCalledWith({ rawText: 'texto ocr' });
    });

    it('error del service -> 500 con su mensaje', async () => {
      mocked.ocrOnly.mockRejectedValue(new Error('Error al extraer texto de la imagen'));
      const res = fakeRes();

      await controller.ocrOnly(fakeReq({ file: fakeFile() }), res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
