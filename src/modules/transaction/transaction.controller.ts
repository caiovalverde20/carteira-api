import { Controller, Post, Body, UseGuards, Request, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TransactionService } from './transaction.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TransferDto } from './dto/transfer.dto';
import { RefundDto } from './dto/RefundDto';

@ApiTags('transactions')
@ApiBearerAuth()
@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionController {
  constructor(private transactionService: TransactionService) {}

  @Post('transfer')
  @ApiOperation({ summary: 'Realiza uma transferência' })
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
  
  @Post('refund')
  @ApiOperation({ summary: 'Solicita estorno de uma transação' ,
    description: 'Permite reverter uma transação realizada em até 7 dias. Se o destinatário não tiver saldo suficiente, o estorno falha, mas pode ser tentado novamente a qualquer momento.'})
  @ApiResponse({ status: 200, description: 'Estorno realizado com sucesso.' })
  async refund(@Body() refundDto: RefundDto, @Request() req) {
    const userId = req.user.id;
    return await this.transactionService.refundTransaction(userId, refundDto.transactionId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Retorna o histórico de transações do usuário' })
  @ApiResponse({ status: 200, description: 'Lista de transações envolvendo o usuário.' })
  async getHistory(@Request() req) {
    const userId = req.user.id;
    return this.transactionService.getTransactionHistory(userId);
  }
}
