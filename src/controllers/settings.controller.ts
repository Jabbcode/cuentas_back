import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/index.js';
import * as settingsService from '../services/settings.service.js';
import {
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
} from '../schemas/settings.schema.js';

// Get user profile
export async function getProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const profile = await settingsService.getUserProfile(userId);
    res.json(profile);
  } catch (error) {
    next(error);
  }
}

// Update user profile
export async function updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const data = updateProfileSchema.parse(req.body);

    const updatedProfile = await settingsService.updateUserProfile(userId, data);

    res.json({
      profile: updatedProfile,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    next(error);
  }
}

// Change password
export async function changePassword(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const data = changePasswordSchema.parse(req.body);

    const result = await settingsService.changePassword(userId, data);

    res.json(result);
  } catch (error) {
    next(error);
  }
}

// Delete account
export async function deleteAccount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const data = deleteAccountSchema.parse(req.body);

    const result = await settingsService.deleteUserAccount(userId, data.password);

    res.json(result);
  } catch (error) {
    next(error);
  }
}

// Get account statistics
export async function getStatistics(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const stats = await settingsService.getAccountStatistics(userId);
    res.json(stats);
  } catch (error) {
    next(error);
  }
}
