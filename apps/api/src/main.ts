import "dotenv/config";
import { startTelemetry } from "./telemetry";
startTelemetry();
import { createApplication } from "./factory";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import helmet from "helmet";
import { json } from "express";
import { AppModule } from "./app";
async function bootstrap() {
  if (
    process.env.MOCK_MODE === "false" &&
    (!process.env.AUTH_SECRET ||
      process.env.AUTH_SECRET.length < 32 ||
      !process.env.ADMIN_PASSWORD ||
      process.env.ADMIN_PASSWORD.length < 16 ||
      !process.env.ADMIN_EMAIL)
  )
    throw new Error("Configuração de autenticação real incompleta");
  const app = await createApplication({ bodyParser: false });
  app.use(helmet());
  app.use(json({ limit: "2mb" }));
  app.enableCors({
    origin: process.env.WEB_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"],
    allowedHeaders: ["Authorization", "Content-Type"],
  });
  app.enableShutdownHooks();
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("Seller Agents AI")
      .setDescription(
        "MVP comercial: mock explícito, propostas sem publicação automática",
      )
      .setVersion("0.1.0")
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup("docs", app, doc);
  await app.listen(Number(process.env.PORT) || 4000, "0.0.0.0");
}
void bootstrap();
