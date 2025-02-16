import { Test, TestingModule } from '@nestjs/testing';
import { TransactionService } from './transaction.service';
import { WalletService } from '../wallet/wallet.service';
import { Transaction } from './transaction.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner, EntityManager } from 'typeorm';
import { Wallet } from '../wallet/wallet.entity';
import { User } from '../user/user.entity';
import { BadRequestException } from '@nestjs/common';

const mockTransactionRepository = {
  create: jest.fn(),
  save: jest.fn(),
};

const mockWalletService = {
  getWalletByUserAndCurrency: jest.fn(),
};

const mockEntityManager: Partial<EntityManager> = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
};

const mockQueryRunner: Partial<QueryRunner> = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: mockEntityManager as EntityManager,
    connection: { options: { type: 'sqlite' } } as any,
  };

const mockDataSource = {
  createQueryRunner: jest.fn(() => mockQueryRunner),
};

describe('TransactionService', () => {
  let transactionService: TransactionService;
  let transactionRepository: Repository<Transaction>;
  let walletService: WalletService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        { provide: getRepositoryToken(Transaction), useValue: mockTransactionRepository },
        { provide: WalletService, useValue: mockWalletService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    transactionService = module.get<TransactionService>(TransactionService);
    transactionRepository = module.get<Repository<Transaction>>(getRepositoryToken(Transaction));
    walletService = module.get<WalletService>(WalletService);
  });

  it('deve realizar uma transferência com sucesso', async () => {
    const senderWallet = { id: 'wallet-1', balance: 1000 } as Wallet;
    const receiverUser = { id: 'user-2', email: 'destino@mail.com' } as User;
    const receiverWallet = { id: 'wallet-2', balance: 500, user: receiverUser } as Wallet;
  
    (mockEntityManager.findOne as jest.Mock)
      .mockResolvedValueOnce(senderWallet)
      .mockResolvedValueOnce(receiverUser) 
      .mockResolvedValueOnce(receiverWallet);
  
    (mockEntityManager.save as jest.Mock).mockResolvedValue(true);
    (mockEntityManager.create as jest.Mock).mockReturnValue({ id: 'transaction-uuid' } as Transaction);
    (mockEntityManager.save as jest.Mock).mockResolvedValue({ id: 'transaction-uuid' } as Transaction);
  
    const result = await transactionService.transferByEmail('user-1', 'destino@mail.com', 'BRL', 200);
  
    expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
    expect(mockEntityManager.save).toHaveBeenCalledTimes(3);
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    expect(result.id).toBe('transaction-uuid');
  });
  

  it('deve lançar erro se saldo for insuficiente', async () => {
    const senderWallet = { id: 'wallet-1', balance: 100 } as Wallet;
    (mockEntityManager.findOne as jest.Mock).mockResolvedValue(senderWallet);

    await expect(transactionService.transferByEmail('user-1', 'destino@mail.com', 'BRL', 500)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('deve fazer rollback se ocorrer erro', async () => {
    const senderWallet = { id: 'wallet-1', balance: 1000 } as Wallet;
    const receiverWallet = { id: 'wallet-2', balance: 500 } as Wallet;

    (mockEntityManager.findOne as jest.Mock)
      .mockResolvedValueOnce(senderWallet)
      .mockResolvedValueOnce(receiverWallet);

    (mockEntityManager.save as jest.Mock).mockRejectedValue(new Error('Erro no banco'));

    await expect(transactionService.transferByEmail('user-1', 'destino@mail.com', 'BRL', 200)).rejects.toThrow(Error);

    expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('deve lançar erro se o valor da transferência for zero ou negativo', async () => {
    await expect(transactionService.transferByEmail('user-1', 'destino@mail.com', 'BRL', 0)).rejects.toThrow(
      BadRequestException,
    );
    await expect(transactionService.transferByEmail('user-1', 'destino@mail.com', 'BRL', -50)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('deve lançar erro se a moeda não existir', async () => {
    (mockEntityManager.findOne as jest.Mock).mockResolvedValue(null);

    await expect(transactionService.transferByEmail('user-1', 'destino@mail.com', 'XYZ', 100)).rejects.toThrow(
      BadRequestException,
    );
  });
});
