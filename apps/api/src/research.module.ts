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

@ApiTags("research")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
class ResearchController {
  constructor(
    @Inject(PlatformService) private platform: PlatformService,
    @Inject(Store) private store: Store,
    @Inject(MercadoLivreAdapter) private ml: MercadoLivreAdapter,
    @Inject(ShopeeAdapter) private shopee: ShopeeAdapter,
  ) {}
  @Get("competitors") competitors() {
    return this.store.all("competitorSnapshot");
  }
  @Contract("competitors")
  @Post("competitors/import")
  competitorsImport(@Body() body: unknown, @Req() req: any) {
    return this.platform.importCompetitors(body, req.user.email);
  }
  @Get("keywords") keywords() {
    return this.store.all("keyword");
  }
  @Contract("keyword")
  @Post("keywords")
  keyword(@Body() body: unknown) {
    return this.store.create(
      "keyword",
      z
        .object({
          term: z.string().min(1).max(120),
          source: z.string().min(3).max(500),
          volume: z.number().int().nonnegative().nullable().default(null),
        })
        .parse(body),
    );
  }
}
@Module({ controllers: [ResearchController] })
export class ResearchModule {}
