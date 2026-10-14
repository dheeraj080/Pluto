import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { buildSwaggerDocumentConfig } from './config/swagger.config';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  const corsOrigin = configService.get<string>('CORS_ORIGIN', '*');
  const trustProxy = configService.get<boolean>('TRUST_PROXY', true);

  // Trusted proxy configuration for reverse proxies (NGINX, Cloudflare, AWS ALB)
  const expressApp = app.getHttpAdapter().getInstance();
  if (expressApp && typeof expressApp.set === 'function') {
    expressApp.set('trust proxy', trustProxy ? 1 : false);
  }

  // Standard security headers middleware
  app.use((_req: unknown, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Global prefix
  app.setGlobalPrefix(apiPrefix);

  // Safe CORS configuration
  if (corsOrigin === '*') {
    app.enableCors({ origin: '*' });
  } else {
    const origins = corsOrigin
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
    if (origins.some((o) => o === '*' || o.includes('*'))) {
      throw new Error(
        'Wildcard CORS origin is not allowed when CORS_ORIGIN contains wildcard patterns',
      );
    }
    app.enableCors({
      origin: origins,
      credentials: true,
    });
  }

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global filters & interceptors
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  // Enable graceful shutdown hooks
  app.enableShutdownHooks();

  // Swagger / OpenAPI documentation setup
  const swaggerConfig = buildSwaggerDocumentConfig();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 Application is running on: http://localhost:${port}/${apiPrefix}`);
  logger.log(`📚 Swagger documentation available at: http://localhost:${port}/docs`);
}

bootstrap().catch((err) => {
  const logger = new Logger('BootstrapError');
  logger.error('Failed to bootstrap application', err);
  process.exit(1);
});
