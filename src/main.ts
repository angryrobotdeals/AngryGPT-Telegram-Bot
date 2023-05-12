import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as process from 'process';

require('dotenv').config();

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  // await app.listen(3000);
}

bootstrap().then();
