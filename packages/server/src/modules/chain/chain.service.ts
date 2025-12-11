import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';
import { ChainEntity } from './entities/chain.entity';
import { CreateChainDto } from './dto/create-chain.dto';

@Injectable()
export class ChainService {
  private readonly logger = new Logger(ChainService.name);
  private providers: Map<number, ethers.JsonRpcProvider> = new Map();

  constructor(
    @InjectRepository(ChainEntity)
    private readonly chainRepository: Repository<ChainEntity>,
  ) {}

  async create(dto: CreateChainDto): Promise<ChainEntity> {
    try {
      // RPC 연결 테스트
      const provider = new ethers.JsonRpcProvider(dto.rpcUrl);
      await provider.getBlockNumber();

      const chain = this.chainRepository.create(dto);
      const savedChain = await this.chainRepository.save(chain);

      this.providers.set(savedChain.chainId, provider);
      this.logger.log(
        `체인 추가됨: ${savedChain.name} (${savedChain.chainId})`,
      );

      return savedChain;
    } catch (error) {
      this.logger.error(`체인 추가 실패: ${dto.name}`, error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`체인 연결 실패: ${errorMessage}`);
    }
  }

  async findAll(): Promise<ChainEntity[]> {
    const chains = await this.chainRepository.find();
    // 프로바이더 초기화
    for (const chain of chains) {
      if (!this.providers.has(chain.id)) {
        this.providers.set(chain.id, new ethers.JsonRpcProvider(chain.rpcUrl));
      }
    }
    return chains;
  }

  async findOne(id: number): Promise<ChainEntity | null> {
    const chain = await this.chainRepository.findOne({ where: { id } });
    if (chain && !this.providers.has(chain.id)) {
      this.providers.set(chain.id, new ethers.JsonRpcProvider(chain.rpcUrl));
    }
    return chain;
  }

  async remove(id: number): Promise<boolean> {
    const result = await this.chainRepository.delete(id);
    this.providers.delete(id);
    return (result.affected ?? 0) > 0;
  }

  getProvider(chainId: number): ethers.JsonRpcProvider | undefined {
    return this.providers.get(chainId);
  }

  async getBlockNumber(chainId: number): Promise<number> {
    let provider = this.getProvider(chainId);
    if (!provider) {
      const chain = await this.findOne(chainId);
      if (!chain) {
        throw new Error(`체인을 찾을 수 없습니다: ${chainId}`);
      }
      provider = this.getProvider(chainId);
      if (!provider) {
        throw new Error(`프로바이더를 초기화할 수 없습니다: ${chainId}`);
      }
    }
    return await provider.getBlockNumber();
  }
}
