import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventService } from './event.service';
import { EventController } from './event.controller';
import { EventGateway } from './event.gateway';
import { CollectedEventEntity } from './entities/collected-event.entity';
import { ChainModule } from '../chain/chain.module';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CollectedEventEntity]),
    ChainModule,
    SubscriptionModule,
  ],
  controllers: [EventController],
  providers: [EventService, EventGateway],
  exports: [EventService],
})
export class EventModule {}
