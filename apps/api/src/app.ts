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
import { Throttle, ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ApiTags, ApiBearerAuth, ApiBody } from "@nestjs/swagger";
import { z, ZodError } from "zod";
import { price } from "@seller/domain";
import { Store, mockMode } from "./store";
import { PlatformService } from "./platform";
import { AuthGuard, issueToken, passwordMatches } from "./security";
import { AiService } from "./ai";
import { MercadoLivreAdapter, ShopeeAdapter } from "./integrations";
import { CoreModule } from "./core.module";
import { DashboardModule } from "./dashboard.module";
import { CatalogModule } from "./catalog.module";
import { ResearchModule } from "./research.module";
import { ListingsModule } from "./listings.module";
import { PricingModule } from "./pricing.module";
import { PerformanceModule } from "./performance.module";
import { ApprovalsModule } from "./approvals.module";
import { AgentsModule } from "./agents.module";
import { IntegrationsModule } from "./integrations.module";
@Catch()
class Errors implements ExceptionFilter {
  catch(e: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const status =
      e instanceof ZodError
        ? 400
        : e instanceof HttpException
          ? e.getStatus()
          : 500;
    response.status(status).json({
      statusCode: status,
      message:
        e instanceof ZodError
          ? e.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")
          : e instanceof HttpException
            ? e.message
            : "Erro interno; consulte o log de auditoria",
    });
  }
}
@ApiTags("Health e autenticação")
@Controller()
class PublicController {
  constructor(@Inject(MercadoLivreAdapter) private ml: MercadoLivreAdapter) {}
  @Get("health") health() {
    return { status: "ok", mode: mockMode() ? "MOCK" : "REAL" };
  }
  @Post("auth/login")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiBody({
    schema: {
      type: "object",
      required: ["email", "password"],
      properties: { email: { type: "string" }, password: { type: "string" } },
    },
  })
  login(@Body() body: unknown) {
    const input = z
      .object({
        email: z.string().email(),
        password: z.string().min(1).max(200),
      })
      .parse(body);
    const email =
      process.env.ADMIN_EMAIL || (mockMode() ? "admin@example.local" : "");
    const password =
      process.env.ADMIN_PASSWORD || (mockMode() ? "demo-seller-2026" : "");
    if (
      !email ||
      !password ||
      input.email !== email ||
      !passwordMatches(input.password, password)
    )
      throw new UnauthorizedException("Credenciais inválidas");
    return {
      token: issueToken(email),
      expiresIn: 3600,
      mode: mockMode() ? "MOCK" : "REAL",
    };
  }
  @Get("integrations/ml/callback") callback(
    @Query("code") code: string,
    @Query("state") state: string,
  ) {
    return this.ml.callback(
      z.string().min(1).parse(code),
      z.string().length(64).parse(state),
    );
  }
}

@Module({
  imports: [
    CoreModule,
    DashboardModule,
    CatalogModule,
    ResearchModule,
    ListingsModule,
    PricingModule,
    PerformanceModule,
    ApprovalsModule,
    AgentsModule,
    IntegrationsModule,
    ThrottlerModule.forRoot([
      { ttl: 60000, limit: 120 },
      { name: "burst", ttl: 1000, limit: 40 },
    ]),
  ],
  controllers: [PublicController],
  providers: [
    { provide: APP_FILTER, useClass: Errors },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
