import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChainService } from './chain.service';
import { ChainController } from './chain.controller';
import { ChainEntity } from './entities/chain.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ChainEntity])],
  controllers: [ChainController],
  providers: [ChainService],
  exports: [ChainService],
})
export class ChainModule {}
