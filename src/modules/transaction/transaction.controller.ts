import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TransactionService } from './transaction.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TransferDto } from './dto/transfer.dto';

@ApiTags('transactions')
@ApiBearerAuth()
@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionController {
  constructor(private transactionService: TransactionService) {}

  @Post('transfer')
  @ApiOperation({ summary: 'Realiza uma transferência...' })
  @ApiResponse({ status: 200, description: 'Transferência realizada com sucesso.' })
  @ApiResponse({ status: 400, description: 'Erro na transferência.' })
  async transfer(@Body() transferDto: TransferDto, @Request() req) {
    const senderId = req.user.id;
    const transaction = await this.transactionService.transferByEmail(
      senderId,
      transferDto.toEmail,
      transferDto.currency,
      transferDto.amount,
    );
    if (transaction.toWallet) {
      delete transaction.toWallet.balance;
    }
  
    return transaction;
  }
}
