import { Global, Module } from "@nestjs/common";
import { Store, mockMode } from "./store";
import { PlatformService } from "./platform";
import { AuthGuard, issueToken, passwordMatches } from "./security";
import { AiService } from "./ai";
import { MercadoLivreAdapter, ShopeeAdapter } from "./integrations";
@Global()
@Module({
  providers: [
    Store,
    PlatformService,
    AiService,
    MercadoLivreAdapter,
    ShopeeAdapter,
    AuthGuard,
  ],
  exports: [
    Store,
    PlatformService,
    AiService,
    MercadoLivreAdapter,
    ShopeeAdapter,
    AuthGuard,
  ],
})
export class CoreModule {}
