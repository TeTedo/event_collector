import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENV_DB_HOST_KEY } from './common/const/env-keys.const';
import { ENV_DB_PORT_KEY } from './common/const/env-keys.const';
import { ENV_DB_USERNAME_KEY } from './common/const/env-keys.const';
import { ENV_DB_PASSWORD_KEY } from './common/const/env-keys.const';
import { ENV_DB_DATABASE_KEY } from './common/const/env-keys.const';
import { ChainModule } from './modules/chain/chain.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { EventModule } from './modules/event/event.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { AuthModule } from './modules/auth/auth.module';
import { LogMiddleware } from './common/middleware/log.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env[ENV_DB_HOST_KEY] ?? 'localhost',
      port: parseInt(process.env[ENV_DB_PORT_KEY] ?? '3306'),
      username: process.env[ENV_DB_USERNAME_KEY] ?? 'root',
      password: process.env[ENV_DB_PASSWORD_KEY] ?? '',
      database: process.env[ENV_DB_DATABASE_KEY] ?? 'event_collector',
      entities: ['dist/**/*.entity{.ts,.js}'],
      synchronize: true,
    }),
    ChainModule,
    SubscriptionModule,
    EventModule,
    WalletModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LogMiddleware).forRoutes({
      path: '*',
      method: RequestMethod.ALL,
    });
  }
}
