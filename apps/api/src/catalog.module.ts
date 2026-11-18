import { Contract } from "./contracts";
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

@ApiTags("catalog")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
class CatalogController {
  constructor(
    @Inject(PlatformService) private platform: PlatformService,
    @Inject(Store) private store: Store,
    @Inject(MercadoLivreAdapter) private ml: MercadoLivreAdapter,
    @Inject(ShopeeAdapter) private shopee: ShopeeAdapter,
  ) {}
  @Get("products") products() {
    return this.store.all("product");
  }
  @Contract("product")
  @Post("products")
  create(@Body() body: unknown, @Req() req: any) {
    return this.platform.createProduct(body, req.user.email);
  }
  @Get("suppliers") suppliers() {
    return this.store.all("supplier");
  }
  @Contract("supplier")
  @Post("suppliers")
  supplier(@Body() body: unknown) {
    return this.store.create(
      "supplier",
      z.object({ name: z.string().min(1).max(200) }).parse(body),
    );
  }
}
@Module({ controllers: [CatalogController] })
export class CatalogModule {}
