import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class RefundDto {
  @ApiProperty({ example: 'destinatario@gmail.com' })
  @IsUUID('4', { message: 'O ID da transação deve ser um UUID válido.' })
  transactionId: string;
}
