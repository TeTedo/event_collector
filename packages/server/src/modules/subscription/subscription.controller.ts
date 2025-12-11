import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Controller('api/subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateSubscriptionDto) {
    const subscription = await this.subscriptionService.create(dto);
    return { success: true, subscription };
  }

  @Get()
  async findAll(@Query('chainId') chainId?: number) {
    return await this.subscriptionService.findAll(chainId);
  }

  @Get(':id')
  async findOne(@Param('id') id: number) {
    const subscription = await this.subscriptionService.findOne(id);
    if (!subscription) {
      return { error: '구독을 찾을 수 없습니다.' };
    }
    return subscription;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: number) {
    const removed = await this.subscriptionService.remove(id);
    return {
      success: removed,
      message: removed ? '구독이 제거되었습니다.' : '구독을 찾을 수 없습니다.',
    };
  }
}
