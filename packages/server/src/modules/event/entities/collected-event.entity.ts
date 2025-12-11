import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseTimeEntity } from '../../../common/entities/base-time.entity';
import { SubscriptionEntity } from '../../subscription/entities/subscription.entity';

@Entity('collected_events')
@Index(['subscriptionId', 'blockNumber'])
@Index(['chainId', 'blockNumber'])
@Index(['transactionHash'])
export class CollectedEventEntity extends BaseTimeEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'bigint' })
  subscriptionId: number;

  @ManyToOne(() => SubscriptionEntity)
  @JoinColumn({ name: 'subscriptionId', referencedColumnName: 'id' })
  subscription: SubscriptionEntity;

  @Column({ type: 'bigint' })
  chainId: number;

  @Column({ type: 'varchar', length: 100 })
  contractAddress: string;

  @Column({ type: 'varchar', length: 100 })
  eventName: string;

  @Column({ type: 'bigint', unsigned: true })
  blockNumber: number;

  @Column({ type: 'varchar', length: 100 })
  transactionHash: string;

  @Column({ type: 'json' })
  data: Record<string, string>;
}
