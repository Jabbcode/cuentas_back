export interface CategoryEmailData {
  name: string;
  icon?: string;
  spent: number;
  budget?: number;
}

export interface MonthlySummaryParams {
  to: string;
  userName: string;
  month: string;
  year: number;
  totalExpenses: number;
  totalIncome: number;
  categoryBreakdown: CategoryEmailData[];
}
