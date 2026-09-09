export interface DashboardSummary {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyNet: number;
  month: string;
}

export interface CategoryBreakdownItem {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  monthlyLimit?: number;
  total: number;
  percentage: number;
}

export interface MonthlyTrendItem {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface MonthlySummaryCategoryItem {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  total: number;
  percentage: number;
}

export interface MonthlySummary {
  month: number;
  year: number;
  totalExpenses: number;
  totalIncome: number;
  net: number;
  categories: MonthlySummaryCategoryItem[];
}

export interface FixedVsVariable {
  fixed: number;
  variable: number;
  total: number;
  fixedPercentage: number;
  variablePercentage: number;
}

export interface DashboardService {
  getSummary(userId: string): Promise<DashboardSummary>;
  getByCategory(userId: string, type?: 'expense' | 'income'): Promise<CategoryBreakdownItem[]>;
  getMonthlyTrend(userId: string, months?: number): Promise<MonthlyTrendItem[]>;
  getMonthlySummary(userId: string, month: number, year: number): Promise<MonthlySummary>;
  getFixedVsVariable(userId: string): Promise<FixedVsVariable>;
}
