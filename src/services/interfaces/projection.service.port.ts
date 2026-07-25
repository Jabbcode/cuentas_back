export interface CategoryProjection {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  total: number;
  items: {
    id: string;
    name: string;
    amount: number;
    dueDay: number;
  }[];
}

export interface ProjectionData {
  month: string;
  year: number;
  monthNumber: number;
  totalExpenses: number;
  totalIncome: number;
  netBalance: number;
  expensesByCategory: CategoryProjection[];
  incomesByCategory: CategoryProjection[];
  comparison: {
    previousMonth: string;
    expensesDiff: number;
    incomeDiff: number;
    netDiff: number;
    expensesPercentage: number;
    incomePercentage: number;
  };
}

export interface ProjectionService {
  getNextMonthProjection(userId: string): Promise<ProjectionData>;
}
