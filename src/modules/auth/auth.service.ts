import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/user.entity';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService
  ) {}

  async validateUser(loginDto: LoginDto): Promise<string | null> {
    const user = await this.userRepository.findOne({ where: { email: loginDto.email } });
    if (!user) return null;

    const isPasswordValid = await bcrypt.compare(loginDto.senha, user.senha);
    if (!isPasswordValid) return null;

    return this.jwtService.sign({ id: user.id, email: user.email });
  }
}
