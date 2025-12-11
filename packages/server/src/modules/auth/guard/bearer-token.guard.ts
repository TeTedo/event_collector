import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';
import { Request } from 'express';
import { WalletEntity } from 'src/modules/wallet/entities/wallet.entity';
import { WalletService } from 'src/modules/wallet/wallet.service';

export interface RequestWithWallet extends Request {
  wallet: WalletEntity;
  token: string;
  tokenType: 'access' | 'refresh';
}

@Injectable()
export class BearerTokenGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly walletService: WalletService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithWallet>();
    const rawToken = request.headers.authorization;

    if (!rawToken) {
      throw new UnauthorizedException('token not found');
    }

    const token = this.authService.extractTokenFromHeader(rawToken, true);
    const payload = this.authService.verifyToken(token);
    const wallet = await this.walletService.findOne(payload.address);

    if (!wallet) {
      throw new UnauthorizedException('wallet not found');
    }

    request.wallet = wallet;
    request.token = token;
    request.tokenType = payload.type;

    return true;
  }
}

@Injectable()
export class AccessTokenGuard extends BearerTokenGuard {
  constructor(authService: AuthService, walletService: WalletService) {
    super(authService, walletService);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);

    const req = context.switchToHttp().getRequest<RequestWithWallet>();

    if (req.tokenType !== 'access') {
      throw new UnauthorizedException('request with access token');
    }

    return true;
  }
}

@Injectable()
export class RefreshTokenGuard extends BearerTokenGuard {
  constructor(authService: AuthService, walletService: WalletService) {
    super(authService, walletService);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);

    const req = context.switchToHttp().getRequest<RequestWithWallet>();

    if (req.tokenType !== 'refresh') {
      throw new UnauthorizedException('request with refresh token');
    }

    return true;
  }
}
