import {
  createParamDecorator,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { RequestWithQueryRunner } from 'src/common/interceptor/transaction.interceptor';

export const QueryRunnerDecorator = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithQueryRunner>();

    if (!request.queryRunner) {
      throw new InternalServerErrorException(
        'There is no queryRunner in the request',
      );
    }

    return request.queryRunner;
  },
);
