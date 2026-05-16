import type {
  ExchangedTokens,
  TrueLayerAccount,
  TrueLayerProvider,
  TrueLayerTransaction,
} from '../../../types/index.js';
import { ValidationError } from '../../../lib/errors.js';

interface TrueLayerConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authUrl: string;
  apiUrl: string;
  sandbox: boolean;
  providers?: string;
  countryCode?: string;
}

interface TrueLayerAccountsResponse {
  results: TrueLayerAccount[];
}

interface TrueLayerTransactionsResponse {
  results: TrueLayerTransaction[];
}

interface TrueLayerTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export class TrueLayerClient {
  private readonly config: TrueLayerConfig;

  constructor(config: TrueLayerConfig) {
    this.config = config;
  }

  getAuthUrl(stateToken: string): string {
    const providers = this.config.sandbox
      ? 'mock'
      : (this.config.providers ?? 'es-ob-all es-oauth-all');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      scope: 'info accounts balance transactions offline_access',
      redirect_uri: this.config.redirectUri,
      providers,
      state: stateToken,
    });

    if (this.config.countryCode) {
      params.set('country_id', this.config.countryCode);
    }

    return `${this.config.authUrl}/?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<ExchangedTokens> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
      code,
    });

    const response = await fetch(`${this.config.authUrl}/connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ValidationError(`TrueLayer token exchange failed: ${text}`);
    }

    const data = (await response.json()) as TrueLayerTokenResponse;
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    };
  }

  async refreshToken(refreshTokenValue: string): Promise<ExchangedTokens> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: refreshTokenValue,
    });

    const response = await fetch(`${this.config.authUrl}/connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ValidationError(`TrueLayer token refresh failed: ${text}`);
    }

    const data = (await response.json()) as TrueLayerTokenResponse;
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
    };
  }

  async getProviders(countryCode?: string): Promise<TrueLayerProvider[]> {
    const params = new URLSearchParams();
    if (countryCode) {
      params.set('filters[]', `country:${countryCode}`);
    }

    const url = `${this.config.authUrl}api/providers?clientId=cuentasapp-75f0ea&scopes=&country=es`;
    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      throw new ValidationError(`TrueLayer get providers failed: ${text}`);
    }

    return response.json() as Promise<TrueLayerProvider[]>;
  }

  async getAccounts(accessToken: string): Promise<TrueLayerAccount[]> {
    const response = await fetch(`${this.config.apiUrl}/data/v1/accounts`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ValidationError(`TrueLayer get accounts failed: ${text}`);
    }

    const data = (await response.json()) as TrueLayerAccountsResponse;
    return data.results;
  }

  async getTransactions(
    accessToken: string,
    accountId: string,
    from: Date,
    to: Date
  ): Promise<TrueLayerTransaction[]> {
    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
    });

    const response = await fetch(
      `${this.config.apiUrl}/data/v1/accounts/${accountId}/transactions?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new ValidationError(`TrueLayer get transactions failed: ${text}`);
    }

    const data = (await response.json()) as TrueLayerTransactionsResponse;
    return data.results;
  }
}
