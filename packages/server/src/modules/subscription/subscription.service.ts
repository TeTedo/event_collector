import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionEntity } from './entities/subscription.entity';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionRepository: Repository<SubscriptionEntity>,
  ) {}

  async create(dto: CreateSubscriptionDto): Promise<SubscriptionEntity> {
    const subscription = this.subscriptionRepository.create({
      ...dto,
      fromBlock: dto.fromBlock ?? null,
      isActive: true,
    });

    const saved = await this.subscriptionRepository.save(subscription);
    this.logger.log(`구독 생성됨: ${saved.eventName} (${saved.id})`);

    return saved;
  }

  async findAll(chainId?: number): Promise<SubscriptionEntity[]> {
    if (chainId) {
      return await this.subscriptionRepository.find({
        where: { chainId, isActive: true },
        relations: ['chain'],
      });
    }
    return await this.subscriptionRepository.find({
      where: { isActive: true },
      relations: ['chain'],
    });
  }

  async findOne(id: number): Promise<SubscriptionEntity | null> {
    return await this.subscriptionRepository.findOne({
      where: { id },
      relations: ['chain'],
    });
  }

  async remove(id: number): Promise<boolean> {
    const result = await this.subscriptionRepository.update(id, {
      isActive: false,
    });
    return (result.affected ?? 0) > 0;
  }

  async activate(id: number): Promise<boolean> {
    const result = await this.subscriptionRepository.update(id, {
      isActive: true,
    });
    return (result.affected ?? 0) > 0;
  }
}
