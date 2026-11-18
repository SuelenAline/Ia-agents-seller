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

@ApiTags("dashboard")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
class DashboardController {
  constructor(
    @Inject(PlatformService) private platform: PlatformService,
    @Inject(Store) private store: Store,
    @Inject(MercadoLivreAdapter) private ml: MercadoLivreAdapter,
    @Inject(ShopeeAdapter) private shopee: ShopeeAdapter,
  ) {}
  @Get("dashboard") dashboard() {
    return this.platform.dashboard();
  }
}
@Module({ controllers: [DashboardController] })
export class DashboardModule {}
