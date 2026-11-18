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

@ApiTags("approvals")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
class ApprovalsController {
  constructor(
    @Inject(PlatformService) private platform: PlatformService,
    @Inject(Store) private store: Store,
    @Inject(MercadoLivreAdapter) private ml: MercadoLivreAdapter,
    @Inject(ShopeeAdapter) private shopee: ShopeeAdapter,
  ) {}
  @Get("approvals") approvals() {
    return this.store.all("approval");
  }
  @Contract("review")
  @Post("approvals/:id/review")
  review(@Param("id") id: string, @Body() body: unknown, @Req() req: any) {
    return this.platform.review(
      id,
      z.object({ decision: z.enum(["APPROVED", "REJECTED"]) }).parse(body)
        .decision,
      req.user.email,
    );
  }
  @Post("approvals/:id/execute") async execute(@Param("id") id: string) {
    const a = await this.store.find("approval", id);
    if (!a || a.status !== "APPROVED")
      throw new ConflictException("Exige aprovação");
    if (await this.store.killSwitch())
      throw new ConflictException("Kill switch ativo");
    throw new ConflictException(
      "Execução externa bloqueada no MVP; aprovação registra somente a decisão humana",
    );
  }
}
@Module({ controllers: [ApprovalsController] })
export class ApprovalsModule {}
