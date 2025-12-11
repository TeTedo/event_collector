import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionEntity } from './entities/subscription.entity';
import { ChainModule } from '../chain/chain.module';

@Module({
  imports: [TypeOrmModule.forFeature([SubscriptionEntity]), ChainModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
