import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseTimeEntity } from '../../../common/entities/base-time.entity';
import { ChainEntity } from '../../chain/entities/chain.entity';

@Entity('subscriptions')
export class SubscriptionEntity extends BaseTimeEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'bigint' })
  chainId: number;

  @ManyToOne(() => ChainEntity)
  @JoinColumn({ name: 'chainId', referencedColumnName: 'id' })
  chain: ChainEntity;

  @Column({ type: 'varchar', length: 100 })
  contractAddress: string;

  @Column({ type: 'varchar', length: 100 })
  eventName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'json' })
  abi: unknown[];

  @Column({ type: 'bigint', nullable: true })
  fromBlock: number | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;
}
