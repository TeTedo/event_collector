import { Request, Response, NextFunction } from 'express';
import { Logger, NestMiddleware } from '@nestjs/common';

export class LogMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LogMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    const start = performance.now();
    this.logger.log(`${req.method} ${req.url}`);
    res.on('finish', () => {
      const end = performance.now();
      this.logger.log(
        `${req.method} ${req.url} ${res.statusCode} ${Math.round(end - start)}ms`,
      );
    });
    next();
  }
}
