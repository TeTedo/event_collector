import {
  CallHandler,
  ExecutionContext,
  InternalServerErrorException,
  NestInterceptor,
  Injectable,
} from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { Observable, catchError, tap } from 'rxjs';
import { Request } from 'express';
import { InjectDataSource } from '@nestjs/typeorm';
export interface RequestWithQueryRunner extends Request {
  queryRunner: QueryRunner;
}

@Injectable()
export class TransactionInterceptor implements NestInterceptor {
  constructor(
    @InjectDataSource()
    private readonly datasource: DataSource,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest<RequestWithQueryRunner>();
    const qr = this.datasource.createQueryRunner();

    try {
      await qr.connect();
      await qr.startTransaction();
      req.queryRunner = qr;

      return next.handle().pipe(
        tap(() => {
          qr.commitTransaction()
            .then(() => {
              qr.release().catch((e) => {
                console.error(e);
                throw new InternalServerErrorException(
                  'An error occurred while releasing the QueryRunner',
                );
              });
            })
            .catch((e) => {
              console.error(e);
              throw new InternalServerErrorException(
                'An error occurred while committing the transaction',
              );
            });
        }),
        catchError((error) => {
          qr.rollbackTransaction()
            .then(() => {
              qr.release().catch((e) => {
                console.error(e);
                throw new InternalServerErrorException(
                  'An error occurred while releasing the QueryRunner',
                );
              });
            })
            .catch((e) => {
              console.error(e);
              throw new InternalServerErrorException(
                'An error occurred while rolling back the transaction',
              );
            });
          throw error;
        }),
      );
    } catch {
      await qr.release();
      throw new InternalServerErrorException(
        'An error occurred while initializing the transaction',
      );
    }
  }
}
