import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { BaseTimeEntity } from '../../../common/entities/base-time.entity';

@Entity('wallets')
export class WalletEntity extends BaseTimeEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 100 })
  address: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  nickname: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date | null;
}
