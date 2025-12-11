import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ChainService } from './chain.service';
import { CreateChainDto } from './dto/create-chain.dto';

@Controller('api/chains')
export class ChainController {
  constructor(private readonly chainService: ChainService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateChainDto) {
    const chain = await this.chainService.create(dto);
    return { success: true, message: '체인이 추가되었습니다.', chain };
  }

  @Get()
  async findAll() {
    return await this.chainService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: number) {
    const chain = await this.chainService.findOne(id);
    if (!chain) {
      return { error: '체인을 찾을 수 없습니다.' };
    }
    return chain;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: number) {
    const removed = await this.chainService.remove(id);
    return {
      success: removed,
      message: removed ? '체인이 제거되었습니다.' : '체인을 찾을 수 없습니다.',
    };
  }
}
