import type { IBankingProvider } from '../../ports/IBankingProvider.js';
import type {
  TrueLayerAccount,
  TrueLayerProvider,
  TrueLayerTransaction,
  ExchangedTokens,
} from '../../../types/index.js';
import { TrueLayerClient } from './TrueLayerClient.js';

export class TrueLayerAdapter implements IBankingProvider {
  private readonly client: TrueLayerClient;

  constructor(client: TrueLayerClient) {
    this.client = client;
  }

  getAuthUrl(stateToken: string): string {
    return this.client.getAuthUrl(stateToken);
  }

  async exchangeCode(code: string): Promise<ExchangedTokens> {
    return this.client.exchangeCode(code);
  }

  async refreshToken(refreshTokenValue: string): Promise<ExchangedTokens> {
    return this.client.refreshToken(refreshTokenValue);
  }

  async getAccounts(accessToken: string): Promise<TrueLayerAccount[]> {
    return this.client.getAccounts(accessToken);
  }

  async getProviders(countryCode?: string): Promise<TrueLayerProvider[]> {
    return this.client.getProviders(countryCode);
  }

  async getTransactions(
    accessToken: string,
    accountId: string,
    from: Date,
    to: Date
  ): Promise<TrueLayerTransaction[]> {
    return this.client.getTransactions(accessToken, accountId, from, to);
  }
}

export function createTrueLayerAdapter(): TrueLayerAdapter {
  const client = new TrueLayerClient({
    clientId: process.env.TRUELAYER_CLIENT_ID ?? '',
    clientSecret: process.env.TRUELAYER_CLIENT_SECRET ?? '',
    redirectUri: process.env.TRUELAYER_REDIRECT_URI ?? 'http://localhost:3000/api/banking/callback',
    authUrl: process.env.TRUELAYER_AUTH_URL ?? 'https://auth.truelayer-sandbox.com',
    apiUrl: process.env.TRUELAYER_API_URL ?? 'https://api.truelayer-sandbox.com',
    sandbox: process.env.TRUELAYER_SANDBOX === 'true',
    providers: process.env.TRUELAYER_PROVIDERS,
    countryCode: process.env.TRUELAYER_COUNTRY_CODE,
  });

  return new TrueLayerAdapter(client);
}
