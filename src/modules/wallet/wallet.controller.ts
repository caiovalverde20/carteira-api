import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('wallets')
@ApiBearerAuth()
@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'Retorna todas as carteiras do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Carteiras retornadas com sucesso.' })
  async getWallets(@Request() req) {
    const user = req.user;
    return this.walletService.getWalletsByUser(user.id);
  }

  @Get(':currency')
  @ApiOperation({ summary: 'Retorna a carteira específica do usuário para a moeda informada' })
  @ApiResponse({ status: 200, description: 'Carteira retornada com sucesso.' })
  async getWalletByCurrency(@Request() req, @Param('currency') currency: string) {
    const user = req.user;
    return this.walletService.getWalletByUserAndCurrency(user.id, currency.toUpperCase());
  }
}
