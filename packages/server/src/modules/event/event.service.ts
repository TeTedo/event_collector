import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';
import { ChainService } from '../chain/chain.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { SubscriptionEntity } from '../subscription/entities/subscription.entity';
import { CollectedEventEntity } from './entities/collected-event.entity';
import { Subject } from 'rxjs';

@Injectable()
export class EventService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventService.name);
  private contracts: Map<string, ethers.Contract> = new Map();
  private listeners: Map<number, () => void> = new Map();
  private pollingIntervals: Map<number, NodeJS.Timeout> = new Map();
  private lastBlockNumbers: Map<number, number> = new Map();
  public eventStream = new Subject<CollectedEventEntity>();

  constructor(
    @InjectRepository(CollectedEventEntity)
    private readonly eventRepository: Repository<CollectedEventEntity>,
    private readonly chainService: ChainService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async onModuleInit() {
    // 활성화된 구독들을 복원
    const subscriptions = await this.subscriptionService.findAll();
    for (const subscription of subscriptions) {
      await this.subscribeToEvent(subscription);
    }
  }

  onModuleDestroy() {
    // 모든 리스너 정리
    for (const [subscriptionId, removeListener] of this.listeners.entries()) {
      removeListener();
      this.logger.log(`구독 해제됨: ${subscriptionId}`);
    }
    // 모든 폴링 인터벌 정리
    for (const [subscriptionId, interval] of this.pollingIntervals.entries()) {
      clearInterval(interval);
      this.logger.log(`폴링 중지됨: ${subscriptionId}`);
    }
    this.listeners.clear();
    this.pollingIntervals.clear();
    this.lastBlockNumbers.clear();
    this.contracts.clear();
  }

  async startSubscription(subscriptionId: number): Promise<void> {
    const subscription = await this.subscriptionService.findOne(subscriptionId);
    if (!subscription) {
      throw new Error(`구독을 찾을 수 없습니다: ${subscriptionId}`);
    }

    if (!subscription.isActive) {
      throw new Error(`구독이 비활성화되어 있습니다: ${subscriptionId}`);
    }

    await this.subscribeToEvent(subscription);
    this.logger.log(
      `구독 시작됨: ${subscription.eventName} (${subscription.id})`,
    );
  }

  private async subscribeToEvent(
    subscription: SubscriptionEntity,
  ): Promise<void> {
    const provider = this.chainService.getProvider(subscription.chainId);
    if (!provider) {
      const chain = await this.chainService.findOne(subscription.chainId);
      if (!chain) {
        throw new Error(`체인을 찾을 수 없습니다: ${subscription.chainId}`);
      }
    }

    const finalProvider = this.chainService.getProvider(subscription.chainId);
    if (!finalProvider) {
      throw new Error(`프로바이더를 찾을 수 없습니다: ${subscription.chainId}`);
    }

    // 컨트랙트 인스턴스 생성 또는 재사용
    const contractKey = `${subscription.chainId}:${subscription.contractAddress}`;
    let contract = this.contracts.get(contractKey);

    if (!contract) {
      try {
        const iface = new ethers.Interface(
          subscription.abi as ethers.InterfaceAbi,
        );
        // 이벤트가 ABI에 있는지 확인
        const eventFragment = iface.getEvent(subscription.eventName);
        if (!eventFragment) {
          throw new Error(
            `이벤트 '${subscription.eventName}'이(가) ABI에 없습니다.`,
          );
        }

        contract = new ethers.Contract(
          subscription.contractAddress,
          subscription.abi as ethers.InterfaceAbi,
          finalProvider,
        );
        this.contracts.set(contractKey, contract);
      } catch (error) {
        this.logger.error(
          `컨트랙트 생성 실패: ${subscription.contractAddress} - ${subscription.eventName}`,
          error,
        );
        throw error;
      }
    }

    // 이벤트 필터 생성
    const filterFn = contract.filters[subscription.eventName];
    if (!filterFn || typeof filterFn !== 'function') {
      const error = new Error(
        `이벤트 필터를 생성할 수 없습니다: ${subscription.eventName}. ABI에 이벤트가 정의되어 있는지 확인하세요.`,
      );
      this.logger.error(error.message);
      throw error;
    }

    const filter = filterFn();

    // 이벤트 구독 시도 (eth_newFilter 지원하는 경우)
    try {
      const listener = (...args: unknown[]) => {
        const event = args[args.length - 1] as
          | ethers.Log
          | ethers.EventLog
          | ethers.ContractEventPayload;

        this.handleEvent(event, subscription).catch((error) => {
          this.logger.error(
            `이벤트 처리 오류: ${subscription.eventName}`,
            error,
          );
        });
      };

      void contract.on(filter, listener);

      // 리스너 제거 함수 저장
      const removeListener = () => {
        try {
          void contract.off(filter, listener);
        } catch (error) {
          this.logger.warn(`리스너 제거 실패: ${subscription.id}`, error);
        }
      };

      this.listeners.set(subscription.id, removeListener);
      this.logger.log(
        `이벤트 리스너 등록됨: ${subscription.eventName} (${subscription.id})`,
      );
    } catch (error) {
      // eth_newFilter 미지원 시 폴링 방식으로 폴백
      this.logger.warn(
        `이벤트 리스너 등록 실패, 폴링 방식으로 전환: ${subscription.eventName}`,
        error,
      );
      await this.startPolling(
        subscription,
        contract,
        subscription.eventName,
        finalProvider,
      );
    }

    // 과거 이벤트도 가져오기 (fromBlock이 지정된 경우)
    if (subscription.fromBlock) {
      try {
        const currentBlock = await finalProvider.getBlockNumber();
        const fromBlock = Math.max(
          subscription.fromBlock ?? 0,
          currentBlock - 1000,
        ); // 최근 1000블록까지만

        const pastEvents = await contract.queryFilter(
          filter,
          fromBlock,
          currentBlock,
        );

        for (const event of pastEvents) {
          await this.saveEvent(event, subscription);
        }

        if (pastEvents.length > 0) {
          this.logger.log(
            `과거 이벤트 ${pastEvents.length}개 수집됨: ${subscription.eventName}`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `과거 이벤트 조회 실패: ${subscription.eventName}`,
          error,
        );
      }
    }
  }

  private async handleEvent(
    event: ethers.Log | ethers.EventLog | ethers.ContractEventPayload,
    subscription: SubscriptionEntity,
  ): Promise<void> {
    const collectedEvent = await this.saveEvent(event, subscription);
    this.eventStream.next(collectedEvent);

    const blockNumber = this.extractBlockNumber(event);
    this.logger.debug(
      `이벤트 수집됨: ${subscription.eventName} (블록: ${blockNumber})`,
    );
  }

  private extractBlockNumber(
    event: ethers.Log | ethers.EventLog | ethers.ContractEventPayload,
  ): number {
    // ContractEventPayload 타입인 경우
    if ('log' in event && event.log) {
      const log = event.log;
      if (log.blockNumber !== null && log.blockNumber !== undefined) {
        return Number(log.blockNumber);
      }
    }

    // EventLog 타입인 경우
    if (
      'blockNumber' in event &&
      event.blockNumber !== null &&
      event.blockNumber !== undefined
    ) {
      return Number(event.blockNumber);
    }

    return 0;
  }

  private async saveEvent(
    event: ethers.Log | ethers.EventLog | ethers.ContractEventPayload,
    subscription: SubscriptionEntity,
  ): Promise<CollectedEventEntity> {
    const eventData = this.parseEventData(
      event,
      subscription.abi,
      subscription.eventName,
    );

    // blockNumber와 transactionHash 안전하게 추출
    let blockNumber: number = 0;
    let transactionHash: string = '';

    // ContractEventPayload 타입인 경우 (contract.on()으로 받은 이벤트)
    if ('log' in event && event.log) {
      const log: ethers.Log | ethers.EventLog = event.log;
      if (log.blockNumber !== null && log.blockNumber !== undefined) {
        blockNumber = Number(log.blockNumber);
      }
      if (log.transactionHash) {
        transactionHash = String(log.transactionHash);
      }
    }
    // EventLog 타입인 경우 (queryFilter로 받은 이벤트)
    else if (
      'blockNumber' in event &&
      event.blockNumber !== null &&
      event.blockNumber !== undefined
    ) {
      blockNumber = Number(event.blockNumber);
      if ('transactionHash' in event && event.transactionHash) {
        transactionHash = String(event.transactionHash);
      }
    }
    // Log 타입인 경우 blockHash로부터 조회
    else if ('blockHash' in event && event.blockHash) {
      try {
        const provider = this.chainService.getProvider(subscription.chainId);
        if (provider) {
          const block = await provider.getBlock(event.blockHash);
          blockNumber = block?.number ?? 0;
        }
      } catch (error) {
        this.logger.warn(`블록 번호 조회 실패: ${event.blockHash}`, error);
      }

      if ('transactionHash' in event && event.transactionHash) {
        transactionHash = String(event.transactionHash);
      } else if ('hash' in event && event.hash) {
        const hash = event.hash;
        transactionHash = typeof hash === 'string' ? hash : '';
      }
    }

    if (!blockNumber || !transactionHash) {
      this.logger.error(
        `이벤트에 필수 정보가 없습니다. event keys: ${Object.keys(event).join(', ')}, blockNumber: ${blockNumber}, transactionHash: ${transactionHash}`,
      );
      throw new Error(
        `이벤트에 필수 정보가 없습니다: blockNumber=${blockNumber}, transactionHash=${transactionHash}`,
      );
    }

    const collectedEvent = this.eventRepository.create({
      subscriptionId: subscription.id,
      chainId: subscription.chainId,
      contractAddress: subscription.contractAddress,
      eventName: subscription.eventName,
      blockNumber,
      transactionHash,
      data: eventData,
    });

    const saved = await this.eventRepository.save(collectedEvent);
    return saved;
  }

  private parseEventData(
    event: ethers.Log | ethers.EventLog | ethers.ContractEventPayload,
    abi: unknown[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _eventName: string,
  ): Record<string, string> {
    try {
      // ContractEventPayload인 경우 log에서 데이터 추출
      const log: ethers.Log | ethers.EventLog =
        'log' in event && event.log
          ? event.log
          : (event as ethers.Log | ethers.EventLog);

      const iface = new ethers.Interface(abi as ethers.InterfaceAbi);
      const parsed = iface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });

      if (!parsed) {
        return { raw: log.data };
      }

      const result: Record<string, string> = {};
      parsed.args.forEach((value: unknown, index: number) => {
        const input = parsed.fragment.inputs[index];
        if (input) {
          const key = input.name || `arg${index}`;
          result[key] = String(value);
        }
      });

      return result;
    } catch (error) {
      this.logger.warn('이벤트 파싱 실패', error);
      const log: ethers.Log | ethers.EventLog =
        'log' in event && event.log
          ? event.log
          : (event as ethers.Log | ethers.EventLog);
      return { raw: log.data };
    }
  }

  stopSubscription(subscriptionId: number): boolean {
    const removeListener = this.listeners.get(subscriptionId);
    if (removeListener) {
      removeListener();
      this.listeners.delete(subscriptionId);
      this.logger.log(`구독 중지됨: ${subscriptionId}`);
    }

    const interval = this.pollingIntervals.get(subscriptionId);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(subscriptionId);
      this.lastBlockNumbers.delete(subscriptionId);
      this.logger.log(`폴링 중지됨: ${subscriptionId}`);
    }

    return removeListener !== undefined || interval !== undefined;
  }

  private async startPolling(
    subscription: SubscriptionEntity,
    contract: ethers.Contract,
    eventName: string,
    provider: ethers.JsonRpcProvider,
  ): Promise<void> {
    // 초기 블록 번호 설정
    const currentBlock = await provider.getBlockNumber();
    const startBlock = subscription.fromBlock
      ? Math.max(subscription.fromBlock, currentBlock - 100)
      : currentBlock - 100;
    this.lastBlockNumbers.set(subscription.id, startBlock);

    // 폴링 시작 (5초마다)
    const interval = setInterval(() => {
      void (async () => {
        try {
          const lastBlock =
            this.lastBlockNumbers.get(subscription.id) ?? startBlock;
          const currentBlock = await provider.getBlockNumber();

          if (currentBlock > lastBlock) {
            const filterFn = contract.filters[eventName];
            if (filterFn && typeof filterFn === 'function') {
              const filter = filterFn();
              const events = await contract.queryFilter(
                filter,
                lastBlock + 1,
                currentBlock,
              );

              for (const event of events) {
                await this.handleEvent(event, subscription);
              }

              if (events.length > 0) {
                this.logger.debug(
                  `폴링으로 ${events.length}개 이벤트 수집: ${eventName}`,
                );
              }
            }

            this.lastBlockNumbers.set(subscription.id, currentBlock);
          }
        } catch (error) {
          this.logger.error(`폴링 중 오류 발생: ${eventName}`, error);
        }
      })();
    }, 5000); // 5초마다 체크

    this.pollingIntervals.set(subscription.id, interval);
    this.logger.log(
      `폴링 시작됨: ${subscription.eventName} (${subscription.id})`,
    );
  }

  async findAll(
    subscriptionId?: number,
    chainId?: number,
    limit: number = 100,
  ): Promise<CollectedEventEntity[]> {
    const queryBuilder = this.eventRepository
      .createQueryBuilder('event')
      .orderBy('event.blockNumber', 'DESC')
      .addOrderBy('event.createdAt', 'DESC')
      .limit(limit);

    if (subscriptionId) {
      queryBuilder.where('event.subscriptionId = :subscriptionId', {
        subscriptionId,
      });
    }

    if (chainId) {
      queryBuilder.andWhere('event.chainId = :chainId', { chainId });
    }

    return await queryBuilder.getMany();
  }

  async getStats() {
    const [totalEvents, totalSubscriptions, totalChains] = await Promise.all([
      this.eventRepository.count(),
      this.subscriptionService.findAll().then((s) => s.length),
      this.chainService.findAll().then((c) => c.length),
    ]);

    return {
      totalEvents,
      totalSubscriptions,
      totalChains,
    };
  }
}
