import { IsNotEmpty, IsEmail, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'João teste' })
  @IsNotEmpty( { message: 'O nome não deve ser vazio' }) 
  nome: string;

  @ApiProperty({ example: 'joao.teste@mail.com' })
  @IsEmail( {}, { message: 'O email deve ser válido' })
  email: string;

  @ApiProperty({ example: 'senha123' })
  @IsNotEmpty({ message: 'A senha não deve ser vazia' })
  @MinLength(6, { message: 'A senha deve ter pelo menos 6 caracteres' })
  senha: string;
}
