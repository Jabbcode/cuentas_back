import { Response, NextFunction } from 'express';
import * as categoriesService from '../services/categories.service.js';
import { createCategorySchema, updateCategorySchema } from '../schemas/category.schema.js';
import { AuthRequest } from '../types/index.js';

export async function getCategories(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const type = req.query.type as 'expense' | 'income' | undefined;
    const categories = await categoriesService.getCategories(req.user!.userId, type);
    res.json(categories);
  } catch (error) {
    next(error);
  }
}

export async function getCategoryById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const category = await categoriesService.getCategoryById(id, req.user!.userId);
    res.json(category);
  } catch (error) {
    if (error instanceof Error && error.message === 'Categoría no encontrada') {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
}

export async function createCategory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = createCategorySchema.parse(req.body);
    const category = await categoriesService.createCategory(data, req.user!.userId);
    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
}

export async function updateCategory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const data = updateCategorySchema.parse(req.body);
    const category = await categoriesService.updateCategory(id, data, req.user!.userId);
    res.json(category);
  } catch (error) {
    if (error instanceof Error && error.message === 'Categoría no encontrada') {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
}

export async function deleteCategory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await categoriesService.deleteCategory(id, req.user!.userId);
    res.status(204).send();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Categoría no encontrada') {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error.message.includes('transacciones asociadas')) {
        res.status(400).json({ error: error.message });
        return;
      }
    }
    next(error);
  }
}
