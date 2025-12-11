import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JsonWebTokenError, JwtService } from '@nestjs/jwt';
import { ethers } from 'ethers';
import { ENV_JWT_SECRET_KEY } from 'src/common/const/env-keys.const';
import { ConfigService } from '@nestjs/config';
import { WalletLoginDto } from './dto/wallet-login.dto';
import { WalletService } from '../wallet/wallet.service';
import { WalletEntity } from '../wallet/entities/wallet.entity';

interface JwtPayload {
  address: string;
  sub: string;
  type: 'access' | 'refresh';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly walletService: WalletService,
  ) {}

  async walletLogin(loginDto: WalletLoginDto) {
    // 서명 검증
    const recoveredAddress = this.verifySignature(
      loginDto.message,
      loginDto.signature,
    );

    // 복구된 주소와 제공된 주소가 일치하는지 확인
    if (recoveredAddress.toLowerCase() !== loginDto.address.toLowerCase()) {
      throw new UnauthorizedException(
        '서명 검증 실패: 주소가 일치하지 않습니다.',
      );
    }

    // 지갑 찾기 또는 생성
    const wallet = await this.walletService.findOrCreate(loginDto.address);

    // JWT 토큰 발급
    return this.loginWallet(wallet);
  }

  loginWallet(wallet: WalletEntity) {
    return {
      accessToken: this.signToken(wallet, false),
      refreshToken: this.signToken(wallet, true),
    };
  }

  signToken(
    wallet: Pick<WalletEntity, 'address'>,
    isRefreshToken: boolean,
  ): string {
    const payload: JwtPayload = {
      address: wallet.address,
      sub: wallet.address,
      type: isRefreshToken ? 'refresh' : 'access',
    };

    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>(ENV_JWT_SECRET_KEY),
      expiresIn: isRefreshToken ? '7d' : '15m',
    });
  }

  verifySignature(message: string, signature: string): string {
    try {
      // ethers.js를 사용하여 서명에서 주소 복구
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress;
    } catch {
      throw new UnauthorizedException(
        '서명 검증 실패: 유효하지 않은 서명입니다.',
      );
    }
  }

  extractTokenFromHeader(header: string, isBearer: boolean) {
    const [type, token] = header.split(' ');
    const prefix = isBearer ? 'Bearer' : 'Basic';

    if (type !== prefix || !token) {
      throw new UnauthorizedException('invalid token');
    }

    return token;
  }

  verifyToken(token: string): JwtPayload {
    try {
      return this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>(ENV_JWT_SECRET_KEY),
      });
    } catch (error) {
      if (error instanceof JsonWebTokenError) {
        throw new UnauthorizedException('invalid token');
      }
      throw new UnauthorizedException('token verification error');
    }
  }

  rotateToken(token: string, isRefreshToken: boolean) {
    const payload = this.verifyToken(token);

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('refresh token required');
    }

    return this.signToken(
      {
        address: payload.address,
      },
      isRefreshToken,
    );
  }
}
