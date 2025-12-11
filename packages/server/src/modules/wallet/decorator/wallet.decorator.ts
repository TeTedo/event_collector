import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { RequestWithWallet } from 'src/modules/auth/guard/bearer-token.guard';
import { WalletEntity } from 'src/modules/wallet/entities/wallet.entity';
export const TokenWallet = createParamDecorator(
  (_data: keyof WalletEntity, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithWallet>();

    if (!request.wallet) {
      throw new InternalServerErrorException('wallet not found');
    }

    if (_data) {
      return request.wallet[_data];
    }

    return request.wallet;
  },
);
