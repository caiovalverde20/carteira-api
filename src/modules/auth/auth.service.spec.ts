import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

const mockUserRepository = {
  findOne: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('fake-jwt-token'),
};

const mockLoginSuccessCounter = { inc: jest.fn() };
const mockLoginFailureCounter = { inc: jest.fn() };

describe('AuthService', () => {
  let authService: AuthService;
  let userRepository: Repository<User>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: 'PROM_METRIC_LOGIN_SUCCESS_TOTAL', useValue: mockLoginSuccessCounter },
        { provide: 'PROM_METRIC_LOGIN_FAILURE_TOTAL', useValue: mockLoginFailureCounter },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('Deve retornar um token ao logar com credenciais válidas', async () => {
    const loginDto = { email: 'teste@mail.com', senha: 'senha123' };
    const user = { id: 'uuid', email: loginDto.email, senha: await bcrypt.hash(loginDto.senha, 10) };

    mockUserRepository.findOne.mockResolvedValue(user);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

    const token = await authService.validateUser(loginDto);

    expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { email: loginDto.email } });
    expect(token).toBe('fake-jwt-token');
    expect(mockLoginSuccessCounter.inc).toHaveBeenCalled();
  });

  it('Deve retornar null se o email não existir', async () => {
    const loginDto = { email: 'teste@mail.com', senha: 'senha123' };

    mockUserRepository.findOne.mockResolvedValue(null);

    const token = await authService.validateUser(loginDto);

    expect(token).toBeNull();
    expect(mockLoginFailureCounter.inc).toHaveBeenCalled(); 
  });

  it('Deve retornar null se a senha estiver errada', async () => {
    const loginDto = { email: 'teste@mail.com', senha: 'senha123' };
    const user = { id: 'uuid', email: loginDto.email, senha: await bcrypt.hash('outraSenha', 10) };

    mockUserRepository.findOne.mockResolvedValue(user);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

    const token = await authService.validateUser(loginDto);

    expect(token).toBeNull();
    expect(mockLoginFailureCounter.inc).toHaveBeenCalled();
  });
});
