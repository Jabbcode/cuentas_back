import { prisma } from './prisma.js';

const defaultCategories = {
  expense: [
    { name: 'Alimentación', icon: 'Utensils', color: '#FF6B6B' },
    { name: 'Transporte', icon: 'Car', color: '#4ECDC4' },
    { name: 'Vivienda', icon: 'Home', color: '#45B7D1' },
    { name: 'Servicios', icon: 'Lightbulb', color: '#96CEB4' },
    { name: 'Entretenimiento', icon: 'Gamepad2', color: '#FFEAA7' },
    { name: 'Ropa', icon: 'Shirt', color: '#DDA0DD' },
    { name: 'Salud', icon: 'Stethoscope', color: '#98D8C8' },
    { name: 'Educación', icon: 'GraduationCap', color: '#F7DC6F' },
    { name: 'Compras', icon: 'ShoppingCart', color: '#BB8FCE' },
    { name: 'Tecnología', icon: 'Smartphone', color: '#85C1E9' },
  ],
  income: [
    { name: 'Salario', icon: 'Wallet', color: '#2ECC71' },
    { name: 'Freelance', icon: 'Briefcase', color: '#3498DB' },
    { name: 'Inversiones', icon: 'TrendingUp', color: '#9B59B6' },
    { name: 'Regalos', icon: 'Gift', color: '#E74C3C' },
    { name: 'Otros ingresos', icon: 'Banknote', color: '#1ABC9C' },
  ],
};

export async function seedCategories(userId: string) {
  const categories = [];

  for (const [type, cats] of Object.entries(defaultCategories)) {
    for (const cat of cats) {
      categories.push({
        ...cat,
        type,
        userId,
      });
    }
  }

  await prisma.category.createMany({
    data: categories,
    skipDuplicates: true,
  });

  console.log(`Created ${categories.length} default categories for user ${userId}`);
}
