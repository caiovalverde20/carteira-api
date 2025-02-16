import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { User } from './user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ConflictException } from '@nestjs/common';
import { WalletService } from '../wallet/wallet.service';

const mockUserRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockWalletService = {
  createDefaultWallets: jest.fn().mockResolvedValue(true),
};

describe('UserService', () => {
  let userService: UserService;
  let userRepository: Repository<User>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: WalletService, useValue: mockWalletService },
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('Deve criar um usuário com sucesso e criar as carteiras padrão', async () => {
    const createUserDto = {
      nome: 'Teste',
      email: 'teste@mail.com',
      senha: 'senha123',
    };

    mockUserRepository.findOne.mockResolvedValue(null);
    mockUserRepository.create.mockReturnValue(createUserDto);
    const savedUser = { id: 'uuid', ...createUserDto };
    mockUserRepository.save.mockResolvedValue(savedUser);

    const result = await userService.create(createUserDto);

    expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { email: createUserDto.email } });
    expect(mockUserRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: createUserDto.nome,
        email: createUserDto.email,
      }),
    );
    expect(result).toEqual(expect.objectContaining({ id: 'uuid', email: createUserDto.email }));
    expect(mockWalletService.createDefaultWallets).toHaveBeenCalledWith(savedUser);
  });

  it('Deve lançar um erro se o email já estiver cadastrado', async () => {
    const createUserDto = {
      nome: 'Teste',
      email: 'teste@mail.com',
      senha: 'senha123',
    };

    mockUserRepository.findOne.mockResolvedValue(createUserDto);

    await expect(userService.create(createUserDto)).rejects.toThrow(ConflictException);
  });

  it('Deve hashear a senha corretamente', async () => {
    const senha = 'senha123';
    const hash = await bcrypt.hash(senha, 10);
    expect(await bcrypt.compare(senha, hash)).toBe(true);
  });
});
