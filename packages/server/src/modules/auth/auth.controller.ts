import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { WalletLoginDto } from './dto/wallet-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

// api/v1/auth/
@Controller({ path: 'api/v1/auth' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('wallet/login')
  @HttpCode(HttpStatus.OK)
  async walletLogin(@Body() loginDto: WalletLoginDto) {
    return this.authService.walletLogin(loginDto);
  }

  @Post('token/refresh')
  @HttpCode(HttpStatus.OK)
  refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    const newAccessToken = this.authService.rotateToken(
      refreshTokenDto.refreshToken,
      false,
    );
    const newRefreshToken = this.authService.rotateToken(
      refreshTokenDto.refreshToken,
      true,
    );
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }
}
