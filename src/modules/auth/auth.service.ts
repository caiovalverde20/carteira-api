import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/user.entity';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    @InjectMetric('login_success_total')
    private readonly loginSuccessCounter: Counter<string>,
    @InjectMetric('login_failure_total')
    private readonly loginFailureCounter: Counter<string>,
  ) {}

  async validateUser(loginDto: LoginDto): Promise<string | null> {
    const user = await this.userRepository.findOne({ where: { email: loginDto.email } });
    if (!user) {
      this.loginFailureCounter.inc();
      return null;
    }

    const isPasswordValid = await bcrypt.compare(loginDto.senha, user.senha);
    if (!isPasswordValid) {
      this.loginFailureCounter.inc();
      return null;
    }

    this.loginSuccessCounter.inc();
    return this.jwtService.sign({ id: user.id, email: user.email });
  }
}
