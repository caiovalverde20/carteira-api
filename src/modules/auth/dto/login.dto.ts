import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'joao.teste@mail.com' })
  @IsEmail({}, { message: 'O email deve ser válido' })
  email: string;

  @ApiProperty({ example: 'senha123' })
  @IsNotEmpty({ message: 'A senha não deve ser vazia' })
  senha: string;
}
