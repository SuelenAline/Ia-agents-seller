import "reflect-metadata";
import {
  Inject,
  Module,
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  Query,
  UseGuards,
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  UnauthorizedException,
  ConflictException,
} from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ApiTags, ApiBearerAuth, ApiBody } from "@nestjs/swagger";
import { z, ZodError } from "zod";
import { price } from "@seller/domain";
import { Store, mockMode } from "./store";
import { PlatformService } from "./platform";
import { AuthGuard, issueToken, passwordMatches } from "./security";
import { AiService } from "./ai";
import { MercadoLivreAdapter, ShopeeAdapter } from "./integrations";

@ApiTags("integrations")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
class IntegrationsController {
  constructor(
    @Inject(PlatformService) private platform: PlatformService,
    @Inject(Store) private store: Store,
    @Inject(MercadoLivreAdapter) private ml: MercadoLivreAdapter,
    @Inject(ShopeeAdapter) private shopee: ShopeeAdapter,
  ) {}
  @Get("integrations") async integrations() {
    const connected = await this.store.find("integration", "MERCADO_LIVRE");
    return {
      mode: mockMode() ? "MOCK" : "REAL",
      realActionsEnabled: false,
      mercadoLivre: {
        connected: Boolean(connected?.encryptedTokens),
        capabilities: ["oauth", "read-listings"],
        publication: "BLOCKED_PENDING_HOMOLOGATION",
      },
      shopee: {
        connected: false,
        capabilities: mockMode() ? ["mock"] : [],
        status: "REQUIRES_CREDENTIALS_AND_HOMOLOGATION",
      },
    };
  }
  @Get("integrations/ml/authorize") authorize() {
    return this.ml.authorizationUrl();
  }
  @Get("integrations/ml/items") items() {
    return this.ml.listItems();
  }
  @Get("integrations/shopee/items") shopeeItems() {
    return this.shopee.listItems();
  }
}
@Module({ controllers: [IntegrationsController] })
export class IntegrationsModule {}
