import { IsEmail, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TransferDto {
  @ApiProperty({ example: 'destinatario@gmail.com' })
  @IsEmail({}, { message: 'O email deve ser válido' })
  toEmail: string;

  @ApiProperty({ example: 'BRL' })
  @IsNotEmpty({ message: 'A moeda não pode ser vazia' })
  currency: string;

  @ApiProperty({ example: 150 })
  @IsNumber()
  @Min(0.01, { message: 'O valor da transferência deve ser maior que zero' })
  amount: number;
}
