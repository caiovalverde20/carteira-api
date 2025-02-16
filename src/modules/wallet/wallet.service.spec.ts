import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Wallet } from './wallet.entity';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { DEFAULT_WALLETS } from './default-wallets.config';

const mockWalletRepository = {
  create: jest.fn(dto => dto),
  save: jest.fn(wallets => Promise.resolve(wallets)),
  find: jest.fn(),
  findOne: jest.fn(),
};

describe('WalletService', () => {
  let walletService: WalletService;
  let walletRepository: Repository<Wallet>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: getRepositoryToken(Wallet),
          useValue: mockWalletRepository,
        },
      ],
    }).compile();

    walletService = module.get<WalletService>(WalletService);
    walletRepository = module.get<Repository<Wallet>>(getRepositoryToken(Wallet));
  });

  describe('createDefaultWallets', () => {
    it('deve criar as carteiras padrão para um usuário', async () => {
      const user = { id: 'user-uuid' };
      const expectedWallets = DEFAULT_WALLETS.map(walletData => ({
        currency: walletData.currency,
        balance: walletData.initialBalance,
        user,
      }));
      mockWalletRepository.create.mockImplementation(dto => dto);
      mockWalletRepository.save.mockResolvedValue(expectedWallets);

      const result = await walletService.createDefaultWallets(user);
      expect(result).toEqual(expectedWallets);
      expect(mockWalletRepository.create).toHaveBeenCalledTimes(DEFAULT_WALLETS.length);
      expect(mockWalletRepository.save).toHaveBeenCalledWith(expectedWallets);
    });
  });

  describe('getWalletsByUser', () => {
    it('deve retornar as carteiras do usuário', async () => {
      const userId = 'user-uuid';
      const wallets = DEFAULT_WALLETS.map((walletData, index) => ({
        id: `wallet-${index}`,
        currency: walletData.currency,
        balance: walletData.initialBalance,
        user: { id: userId },
      }));
      mockWalletRepository.find.mockResolvedValue(wallets);

      const result = await walletService.getWalletsByUser(userId);
      expect(result).toEqual(wallets);
      expect(mockWalletRepository.find).toHaveBeenCalledWith({ where: { user: { id: userId } } });
    });
  });

  describe('getWalletByUserAndCurrency', () => {
    it('deve retornar a carteira para a moeda especificada', async () => {
      const userId = 'user-uuid';
      const currency = 'BRL';
      const wallet = { id: 'wallet-1', currency, balance: 1000, user: { id: userId } };
      mockWalletRepository.findOne.mockResolvedValue(wallet);

      const result = await walletService.getWalletByUserAndCurrency(userId, currency);
      expect(result).toEqual(wallet);
      expect(mockWalletRepository.findOne).toHaveBeenCalledWith({
        where: { user: { id: userId }, currency },
      });
    });

    it('deve lançar NotFoundException se a carteira não for encontrada', async () => {
      const userId = 'user-uuid';
      const currency = 'EUR';
      mockWalletRepository.findOne.mockResolvedValue(null);

      await expect(
        walletService.getWalletByUserAndCurrency(userId, currency)
      ).rejects.toThrow(NotFoundException);
    });
  });
});
