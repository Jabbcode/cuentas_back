import type {
  TrueLayerAccount,
  TrueLayerTransaction,
  TrueLayerProvider,
  ExchangedTokens,
} from '../../types/index.js';

export interface IBankingProvider {
  getAuthUrl(stateToken: string): string;

  exchangeCode(code: string): Promise<ExchangedTokens>;

  refreshToken(refreshToken: string): Promise<ExchangedTokens>;

  getAccounts(accessToken: string): Promise<TrueLayerAccount[]>;

  getTransactions(
    accessToken: string,
    accountId: string,
    from: Date,
    to: Date
  ): Promise<TrueLayerTransaction[]>;

  getProviders(countryCode?: string): Promise<TrueLayerProvider[]>;
}
