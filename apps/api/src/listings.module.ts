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
  BadRequestException,
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

@ApiTags("listings")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
class ListingsController {
  constructor(
    @Inject(PlatformService) private platform: PlatformService,
    @Inject(Store) private store: Store,
    @Inject(MercadoLivreAdapter) private ml: MercadoLivreAdapter,
    @Inject(ShopeeAdapter) private shopee: ShopeeAdapter,
  ) {}
  @Get("listings") listings() {
    return this.store.all("listing");
  }
  @Get("listing-versions") versions() {
    return this.store.all("listingVersion");
  }
  @Contract("draft")
  @Post("listings/draft")
  async draft(@Body() body: unknown, @Req() req: any) {
    const data = z
      .object({
        productId: z.string(),
        channel: z.enum(["MERCADO_LIVRE", "SHOPEE"]),
        title: z.string().min(1).max(120),
        description: z.string().min(1).max(10000),
        price: z.number().positive(),
      })
      .parse(body);
    if (data.title.length > (data.channel === "MERCADO_LIVRE" ? 60 : 120))
      throw new BadRequestException("Título excede o limite local do canal");
    const p = await this.store.find("product", data.productId);
    if (!p || !p.validated || data.price < Number(p.minimumPrice))
      throw new ConflictException("Ficha não validada ou preço abaixo do piso");
    const proposal = await this.store.create("approval", {
      kind: "listing",
      productId: p.id,
      payload: data,
      status: "PENDING",
      requestedBy: req.user.email,
    });
    await this.store.audit(req.user.email, "DRAFT_SAVED", proposal.id);
    return proposal;
  }
}
@Module({ controllers: [ListingsController] })
export class ListingsModule {}
