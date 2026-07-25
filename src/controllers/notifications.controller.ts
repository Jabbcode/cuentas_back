import { Response, NextFunction } from 'express';
import { notificationsService } from '../bootstrap.js';
import { notificationPreferencesSchema } from '../schemas/notification.schema.js';
import { AuthRequest } from '../types/index.js';
import { sendMonthlySummaryEmail } from '../lib/email/index.js';
import { getMonthRange } from '../lib/utils/date.utils.js';

export async function getNotifications(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const notifications = await notificationsService.getNotifications(req.user!.userId);
    const unreadCount = await notificationsService.getUnreadCount(req.user!.userId);
    res.json({ notifications, unreadCount });
  } catch (error) {
    next(error);
  }
}

export async function markAsRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const notification = await notificationsService.markAsRead(id, req.user!.userId);
    res.json(notification);
  } catch (error) {
    if (error instanceof Error && error.message === 'Notificación no encontrada') {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
}

export async function markAllAsRead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await notificationsService.markAllAsRead(req.user!.userId);
    res.json({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (error) {
    next(error);
  }
}

export async function deleteNotification(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await notificationsService.deleteNotification(id, req.user!.userId);
    res.status(204).send();
  } catch (error) {
    if (error instanceof Error && error.message === 'Notificación no encontrada') {
      res.status(404).json({ error: error.message });
      return;
    }
    next(error);
  }
}

export async function getPreferences(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const prefs = await notificationsService.getPreferences(req.user!.userId);
    res.json(prefs);
  } catch (error) {
    next(error);
  }
}

export async function updatePreferences(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const prefs = notificationPreferencesSchema.partial().parse(req.body);
    const updated = await notificationsService.updatePreferences(req.user!.userId, prefs);
    res.json(updated);
  } catch (error) {
    next(error);
  }
}

// TEST ONLY — remove before production
export async function sendTestEmail(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const user = await notificationsService.getUserContactInfo(userId);
    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const range = getMonthRange(year, month - 1);

    const summary = await notificationsService.buildMonthlySummary(userId, range);

    const monthNames = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];

    await sendMonthlySummaryEmail({
      to: user.email,
      userName: user.name,
      month: monthNames[month - 1],
      year,
      ...summary,
    });

    res.json({ message: `Email enviado a ${user.email}` });
  } catch (error) {
    next(error);
  }
}
