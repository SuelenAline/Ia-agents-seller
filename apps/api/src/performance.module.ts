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

@ApiTags("performance")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
class PerformanceController {
  constructor(
    @Inject(PlatformService) private platform: PlatformService,
    @Inject(Store) private store: Store,
    @Inject(MercadoLivreAdapter) private ml: MercadoLivreAdapter,
    @Inject(ShopeeAdapter) private shopee: ShopeeAdapter,
  ) {}
  @Get("performance") performance() {
    return this.platform.history();
  }
  @Contract("observation")
  @Post("performance/observations")
  async observation(@Body() body: unknown, @Req() req: any) {
    const data = z
      .object({
        productId: z.string(),
        date: z
          .string()
          .date()
          .refine(
            (d) =>
              d >= "2025-01-01" && d <= new Date().toISOString().slice(0, 10),
            "Use data observada a partir de 2025, sem datas futuras",
          ),
        channel: z.enum(["MERCADO_LIVRE", "SHOPEE"]),
        orders: z.number().int().nonnegative(),
        visits: z.number().int().nonnegative().nullable(),
        price: z.number().positive().nullable(),
        revenue: z.number().nonnegative(),
        adSpend: z.number().nonnegative(),
        cost: z.number().nonnegative(),
      })
      .parse(body);
    if (!(await this.store.find("product", data.productId)))
      throw new ConflictException("Produto ausente");
    if (
      (await this.store.all("performance")).some(
        (r) =>
          r.productId === data.productId &&
          r.channel === data.channel &&
          !r.historical &&
          new Date(r.date).toISOString().slice(0, 10) === data.date,
      )
    )
      throw new ConflictException("Observação já cadastrada");
    const result = await this.store.create("performance", {
      ...data,
      date: new Date(data.date),
      historical: false,
    });
    await this.store.audit(
      req.user.email,
      "PERFORMANCE_OBSERVATION",
      result.id,
    );
    return result;
  }
  @Contract("history")
  @Post("history/import")
  import(@Body() body: unknown, @Req() req: any) {
    return this.platform.importHistorical(body, req.user.email);
  }
}
@Module({ controllers: [PerformanceController] })
export class PerformanceModule {}
