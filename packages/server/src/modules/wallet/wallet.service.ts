import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletEntity } from './entities/wallet.entity';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(WalletEntity)
    private readonly walletRepository: Repository<WalletEntity>,
  ) {}

  async findOrCreate(address: string): Promise<WalletEntity> {
    let wallet = await this.walletRepository.findOne({
      where: { address: address.toLowerCase() },
    });

    if (!wallet) {
      wallet = this.walletRepository.create({
        address: address.toLowerCase(),
      });
      wallet = await this.walletRepository.save(wallet);
    }

    // 마지막 로그인 시간 업데이트
    wallet.lastLoginAt = new Date();
    await this.walletRepository.save(wallet);

    return wallet;
  }

  async findOne(address: string): Promise<WalletEntity | null> {
    return await this.walletRepository.findOne({
      where: { address: address.toLowerCase() },
    });
  }

  async updateNickname(
    address: string,
    nickname: string,
  ): Promise<WalletEntity> {
    const wallet = await this.findOne(address);
    if (!wallet) {
      throw new Error('지갑을 찾을 수 없습니다.');
    }

    wallet.nickname = nickname;
    return await this.walletRepository.save(wallet);
  }
}
