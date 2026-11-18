import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  ConflictException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { Store, mockMode } from "./store";
import { encrypt, decrypt } from "./security";
export interface MarketplaceAdapter {
  listItems(): Promise<unknown>;
  publish(id: string, payload: unknown): Promise<unknown>;
}
export async function retryRead(
  url: string,
  init: RequestInit = {},
  fetcher: typeof fetch = fetch,
) {
  for (let attempt = 0; attempt < 4; attempt++) {
    let response: Response;
    try {
      response = await fetcher(url, {
        ...init,
        signal: AbortSignal.timeout(15000),
      });
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 250 * 2 ** attempt));
      continue;
    }
    if (response.ok) return response.json();
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 3)
      throw new ServiceUnavailableException(
        `API externa respondeu ${response.status}`,
      );
    const delay = Math.min(
      10000,
      Number(response.headers.get("retry-after") || 0) * 1000 ||
        250 * 2 ** attempt,
    );
    await new Promise((r) => setTimeout(r, delay));
  }
  throw new ServiceUnavailableException();
}
@Injectable()
export class MercadoLivreAdapter implements MarketplaceAdapter {
  private refreshing: Promise<any> | null = null;
  private nextRequest = 0;
  constructor(@Inject(Store) private store: Store) {}
  private config() {
    for (const k of [
      "ML_CLIENT_ID",
      "ML_CLIENT_SECRET",
      "ML_REDIRECT_URI",
      "TOKEN_ENCRYPTION_KEY",
    ])
      if (!process.env[k])
        throw new ServiceUnavailableException(`Configuração ausente: ${k}`);
  }
  async authorizationUrl() {
    if (mockMode())
      return {
        mode: "MOCK",
        url: null,
        message: "OAuth desabilitado no modo mock",
      };
    this.config();
    const state = randomBytes(32).toString("hex");
    await this.store.create("setting", {
      key: `oauth:${state}`,
      value: { expires: Date.now() + 600000, used: false },
    });
    return {
      mode: "REAL",
      url: `https://auth.mercadolivre.com.br/authorization?${new URLSearchParams({ response_type: "code", client_id: process.env.ML_CLIENT_ID!, redirect_uri: process.env.ML_REDIRECT_URI!, state })}`,
    };
  }
  async callback(code: string, state: string) {
    if (mockMode())
      throw new ConflictException("OAuth real indisponível no mock");
    this.config();
    // Atomic consume prevents concurrent callback replay in PostgreSQL.
    if (this.store.db) {
      const consumed = await this.store.db.setting.deleteMany({
        where: {
          key: `oauth:${state}`,
          value: { path: ["expires"], gt: Date.now() },
        },
      });
      if (consumed.count !== 1)
        throw new ConflictException("Estado OAuth inválido/expirado");
    } else throw new ConflictException("OAuth requer PostgreSQL");
    const tokens = await this.tokenRequest({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.ML_REDIRECT_URI!,
    });
    await this.saveTokens(tokens);
    return { connected: true };
  }
  private async tokenRequest(values: Record<string, string>) {
    // Rotating credentials cannot safely be retried after an ambiguous network failure.
    const res = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        ...values,
        client_id: process.env.ML_CLIENT_ID!,
        client_secret: process.env.ML_CLIENT_SECRET!,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok)
      throw new ServiceUnavailableException(
        `OAuth falhou (${res.status}); reconecte se necessário`,
      );
    const t = await res.json();
    if (!t.access_token || !t.refresh_token || !Number.isFinite(t.expires_in))
      throw new ServiceUnavailableException("Resposta OAuth inválida");
    return t;
  }
  private async saveTokens(t: any) {
    const data = {
      encryptedTokens: encrypt(t),
      expiresAt: new Date(Date.now() + t.expires_in * 1000),
    };
    if (await this.store.find("integration", "MERCADO_LIVRE"))
      await this.store.update("integration", "MERCADO_LIVRE", data);
    else
      await this.store.create("integration", { id: "MERCADO_LIVRE", ...data });
  }
  private async accessToken() {
    this.config();
    const integration = await this.store.find("integration", "MERCADO_LIVRE");
    if (!integration?.encryptedTokens)
      throw new ServiceUnavailableException("Conta não conectada");
    const tokens = decrypt(integration.encryptedTokens);
    if (new Date(integration.expiresAt).getTime() > Date.now() + 60000)
      return tokens.access_token;
    if (!this.refreshing)
      this.refreshing = this.tokenRequest({
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
      })
        .then(async (t) => {
          await this.saveTokens(t);
          return t.access_token;
        })
        .finally(() => {
          this.refreshing = null;
        });
    return this.refreshing;
  }
  async listItems() {
    if (mockMode())
      return {
        mode: "MOCK",
        items: [],
        message: "Nenhum anúncio real consultado",
      };
    const token = await this.accessToken();
    const wait = Math.max(0, this.nextRequest - Date.now());
    this.nextRequest = Date.now() + wait + 500;
    await new Promise((r) => setTimeout(r, wait));
    const user = await retryRead("https://api.mercadolibre.com/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const items = await retryRead(
      `https://api.mercadolibre.com/users/${encodeURIComponent(user.id)}/items/search`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return { mode: "REAL", ...items };
  }
  async publish(_id: string, _payload: unknown): Promise<unknown> {
    throw new ConflictException(
      "Publicação real bloqueada até homologação das políticas por categoria e permissões da conta",
    );
  }
}
export interface ShopeeItem {
  itemId: string;
  title: string;
  price: number;
  currency: "BRL";
}
@Injectable()
export class ShopeeAdapter implements MarketplaceAdapter {
  async listItems() {
    if (!mockMode())
      throw new ServiceUnavailableException(
        "Shopee real não homologada; requer credenciais, escopos e assinatura específicos",
      );
    return { mode: "MOCK", items: [] as ShopeeItem[] };
  }
  async publish(_id: string, _payload: unknown): Promise<unknown> {
    throw new ConflictException("Publicação Shopee indisponível no MVP");
  }
}
