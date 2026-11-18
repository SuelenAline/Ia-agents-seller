import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { NestApplicationOptions } from "@nestjs/common";
import { AppModule } from "./app";
export function createApplication(options: NestApplicationOptions = {}) {
  return NestFactory.create(AppModule, new ExpressAdapter(), options);
}
