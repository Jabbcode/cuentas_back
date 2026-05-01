import { Response, NextFunction } from 'express';
import * as tagsService from '../services/tags.service.js';
import { tagQuerySchema } from '../schemas/tag.schema.js';
import { AuthRequest } from '../types/index.js';

export async function getTags(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { name } = tagQuerySchema.parse(req.query);
    const tags = await tagsService.getTags(req.user!.userId, name);
    res.json(tags);
  } catch (error) {
    next(error);
  }
}

export async function getTagsSummary(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const summary = await tagsService.getTagsSummary(req.user!.userId);
    res.json(summary);
  } catch (error) {
    next(error);
  }
}

export async function deleteTag(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await tagsService.deleteTag(req.params.id as string, req.user!.userId);
    res.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message === 'Etiqueta no encontrada') {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
}
