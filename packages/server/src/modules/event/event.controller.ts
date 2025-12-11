import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EventService } from './event.service';

@Controller('api/events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Post('subscriptions/:subscriptionId/start')
  @HttpCode(HttpStatus.OK)
  async startSubscription(@Param('subscriptionId') subscriptionId: number) {
    await this.eventService.startSubscription(subscriptionId);
    return { success: true, message: '구독이 시작되었습니다.' };
  }

  @Post('subscriptions/:subscriptionId/stop')
  @HttpCode(HttpStatus.OK)
  stopSubscription(@Param('subscriptionId') subscriptionId: number) {
    const stopped = this.eventService.stopSubscription(subscriptionId);
    return {
      success: stopped,
      message: stopped ? '구독이 중지되었습니다.' : '구독을 찾을 수 없습니다.',
    };
  }

  @Get()
  async findAll(
    @Query('subscriptionId') subscriptionId?: number,
    @Query('chainId') chainId?: number,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    return await this.eventService.findAll(subscriptionId, chainId, limitNum);
  }

  @Get('stats')
  async getStats() {
    return await this.eventService.getStats();
  }
}
