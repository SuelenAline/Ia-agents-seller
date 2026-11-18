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

@ApiTags("agents")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller()
class AgentsController {
  constructor(
    @Inject(PlatformService) private platform: PlatformService,
    @Inject(Store) private store: Store,
    @Inject(MercadoLivreAdapter) private ml: MercadoLivreAdapter,
    @Inject(ShopeeAdapter) private shopee: ShopeeAdapter,
  ) {}
  @Get("agents/runs") runs() {
    return this.store.all("agentRun");
  }
  @Contract("run")
  @Post("agents/runs")
  enqueue(@Body() body: unknown, @Req() req: any) {
    return this.platform.enqueue(body, req.user.email);
  }
  @Get("audit") audit() {
    return this.store.all("auditLog");
  }
  @Contract("kill")
  @Post("agents/kill-switch")
  async kill(@Body() body: unknown, @Req() req: any) {
    const { enabled } = z.object({ enabled: z.boolean() }).parse(body);
    if (await this.store.find("setting", "killSwitch"))
      await this.store.update("setting", "killSwitch", { value: enabled });
    else
      await this.store.create("setting", { key: "killSwitch", value: enabled });
    await this.store.audit(req.user.email, "KILL_SWITCH", "agents", {
      enabled,
    });
    return { enabled };
  }
}
@Module({ controllers: [AgentsController] })
export class AgentsModule {}
