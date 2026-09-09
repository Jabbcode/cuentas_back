import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeReq, fakeRes, fakeNext } from './http-fakes.js';

const mocked = vi.hoisted(() => ({
  getCategories: vi.fn(),
  getCategoryById: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  getCategorySpending: vi.fn(),
}));

vi.mock('../../bootstrap.js', () => ({ categoriesService: mocked }));

import * as controller from '../categories.controller.js';

describe('categories.controller', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getCategories', () => {
    it('pasa el type de query al service', async () => {
      mocked.getCategories.mockResolvedValue([]);
      const req = fakeReq({ query: { type: 'expense' } });

      await controller.getCategories(req, fakeRes(), fakeNext());

      expect(mocked.getCategories).toHaveBeenCalledWith('user-1', 'expense');
    });

    it('sin type: pasa undefined', async () => {
      mocked.getCategories.mockResolvedValue([]);

      await controller.getCategories(fakeReq(), fakeRes(), fakeNext());

      expect(mocked.getCategories).toHaveBeenCalledWith('user-1', undefined);
    });
  });

  describe('getCategoryById', () => {
    it('responde 200 con la categoría', async () => {
      mocked.getCategoryById.mockResolvedValue({ id: 'cat-1' });
      const res = fakeRes();

      await controller.getCategoryById(fakeReq({ params: { id: 'cat-1' } }), res, fakeNext());

      expect(res.json).toHaveBeenCalledWith({ id: 'cat-1' });
    });

    it('Categoría no encontrada -> 404', async () => {
      mocked.getCategoryById.mockRejectedValue(new Error('Categoría no encontrada'));
      const res = fakeRes();

      await controller.getCategoryById(fakeReq({ params: { id: 'cat-1' } }), res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('createCategory', () => {
    it('responde 201 con la categoría creada', async () => {
      mocked.createCategory.mockResolvedValue({ id: 'cat-1' });
      const req = fakeReq({ body: { name: 'Comida', type: 'expense' } });
      const res = fakeRes();

      await controller.createCategory(req, res, fakeNext());

      expect(mocked.createCategory).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Comida', type: 'expense' }),
        'user-1'
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('body inválido cae en next', async () => {
      const next = fakeNext();

      await controller.createCategory(fakeReq({ body: { type: 'expense' } }), fakeRes(), next);

      expect(mocked.createCategory).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('updateCategory', () => {
    it('responde 200 con la categoría actualizada', async () => {
      mocked.updateCategory.mockResolvedValue({ id: 'cat-1', name: 'Nueva' });
      const req = fakeReq({ params: { id: 'cat-1' }, body: { name: 'Nueva' } });
      const res = fakeRes();

      await controller.updateCategory(req, res, fakeNext());

      expect(res.json).toHaveBeenCalledWith({ id: 'cat-1', name: 'Nueva' });
    });

    it('Categoría no encontrada -> 404', async () => {
      mocked.updateCategory.mockRejectedValue(new Error('Categoría no encontrada'));
      const req = fakeReq({ params: { id: 'cat-1' }, body: {} });
      const res = fakeRes();

      await controller.updateCategory(req, res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteCategory', () => {
    it('responde 204', async () => {
      mocked.deleteCategory.mockResolvedValue(undefined);
      const res = fakeRes();

      await controller.deleteCategory(fakeReq({ params: { id: 'cat-1' } }), res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('Categoría no encontrada -> 404', async () => {
      mocked.deleteCategory.mockRejectedValue(new Error('Categoría no encontrada'));
      const res = fakeRes();

      await controller.deleteCategory(fakeReq({ params: { id: 'cat-1' } }), res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('con transacciones asociadas -> 400', async () => {
      mocked.deleteCategory.mockRejectedValue(
        new Error('No se puede eliminar: tiene transacciones asociadas')
      );
      const res = fakeRes();

      await controller.deleteCategory(fakeReq({ params: { id: 'cat-1' } }), res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('error no mapeado cae en next', async () => {
      const error = new Error('otro error');
      mocked.deleteCategory.mockRejectedValue(error);
      const next = fakeNext();

      await controller.deleteCategory(fakeReq({ params: { id: 'cat-1' } }), fakeRes(), next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getCategorySpending', () => {
    it('responde 200 con el gasto de la categoría', async () => {
      mocked.getCategorySpending.mockResolvedValue({ total: 100 });
      const res = fakeRes();

      await controller.getCategorySpending(fakeReq({ params: { id: 'cat-1' } }), res, fakeNext());

      expect(res.json).toHaveBeenCalledWith({ total: 100 });
    });

    it('Categoría no encontrada -> 404', async () => {
      mocked.getCategorySpending.mockRejectedValue(new Error('Categoría no encontrada'));
      const res = fakeRes();

      await controller.getCategorySpending(fakeReq({ params: { id: 'cat-1' } }), res, fakeNext());

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
