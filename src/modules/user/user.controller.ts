import { 
  Controller, Post, Body, UseInterceptors, ClassSerializerInterceptor
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
@UseInterceptors(ClassSerializerInterceptor)
export class UserController {
  constructor(private userService: UserService) {}

  @Post('register')
  @ApiOperation({ 
    summary: 'Registra um novo usuário',
    description: 'Cria um usuário no sistema. Requer nome, email e senha com pelo menos 6 caracteres. Retorna erro caso o email já esteja cadastrado.'
  })
  @ApiResponse({ status: 201, description: 'Usuário criado com sucesso.' })
  async register(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }
}
