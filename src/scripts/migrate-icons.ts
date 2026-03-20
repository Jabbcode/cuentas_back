import { prisma } from '../lib/prisma.js';

// Mapeo de emojis a iconos de Lucide
const emojiToLucideMap: Record<string, string> = {
  '🍔': 'Utensils',
  '🚗': 'Car',
  '🏠': 'Home',
  '💡': 'Lightbulb',
  '🎮': 'Gamepad2',
  '👕': 'Shirt',
  '🏥': 'Stethoscope',
  '📚': 'GraduationCap',
  '🛒': 'ShoppingCart',
  '📱': 'Smartphone',
  '💰': 'Wallet',
  '💼': 'Briefcase',
  '📈': 'TrendingUp',
  '🎁': 'Gift',
  '💵': 'Banknote',
  '✈️': 'Plane',
  '☕': 'Coffee',
  '🎵': 'Music',
  '🎬': 'Film',
  '💪': 'Dumbbell',
  '❤️': 'Heart',
  '👶': 'Baby',
  '🐾': 'PawPrint',
  '🔧': 'Wrench',
  '⛽': 'Fuel',
  '💳': 'CreditCard',
  '🏢': 'Building2',
  '📡': 'Wifi',
  '📞': 'Phone',
  '📺': 'Tv',
  '📖': 'BookOpen',
};

async function migrateIcons() {
  console.log('Starting icon migration...');

  const categories = await prisma.category.findMany();
  let updated = 0;

  for (const category of categories) {
    if (category.icon && emojiToLucideMap[category.icon]) {
      await prisma.category.update({
        where: { id: category.id },
        data: { icon: emojiToLucideMap[category.icon] },
      });
      console.log(`Updated: ${category.name} (${category.icon} -> ${emojiToLucideMap[category.icon]})`);
      updated++;
    }
  }

  console.log(`Migration complete. Updated ${updated} categories.`);
}

migrateIcons()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
