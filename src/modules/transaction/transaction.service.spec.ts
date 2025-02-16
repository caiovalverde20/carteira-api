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
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('transferByEmail', () => {
    it('deve realizar uma transferência com sucesso', async () => {
      const senderWallet = { id: 'wallet-1', balance: 1000 } as Wallet;
      const receiverUser = { id: 'user-2', email: 'destino@mail.com' } as User;
      const receiverWallet = { id: 'wallet-2', balance: 500 } as Wallet;

      (mockEntityManager.findOne as jest.Mock)
        .mockResolvedValueOnce(senderWallet)
        .mockResolvedValueOnce(receiverUser)
        .mockResolvedValueOnce(receiverWallet);

      (mockEntityManager.create as jest.Mock).mockReturnValue({ id: 'transaction-uuid' } as Transaction);

      (mockEntityManager.save as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce({ id: 'transaction-uuid' } as Transaction);

      const result = await transactionService.transferByEmail('user-1', 'destino@mail.com', 'BRL', 200);

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockEntityManager.save).toHaveBeenCalledTimes(2);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.id).toBe('transaction-uuid');
    });

    it('deve lançar erro se saldo for insuficiente', async () => {
      const senderWallet = { id: 'wallet-1', balance: 100 } as Wallet;
      const receiverUser = { id: 'user-2', email: 'destino@mail.com' } as User;
      const receiverWallet = { id: 'wallet-2', balance: 500 } as Wallet;

      (mockEntityManager.findOne as jest.Mock)
        .mockResolvedValueOnce(senderWallet) 
        .mockResolvedValueOnce(receiverUser) 
        .mockResolvedValueOnce(receiverWallet); 

      await expect(
        transactionService.transferByEmail('user-1', 'destino@mail.com', 'BRL', 500),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lançar erro se tentar transferir para si mesmo', async () => {
        (mockEntityManager.findOne as jest.Mock).mockReset();
      
        (mockEntityManager.findOne as jest.Mock).mockImplementation(async (entity, options) => {
          if (entity === Wallet) {
            return {
              id: 'wallet-1',
              balance: 1000,
              currency: 'BRL',
              user: { id: 'user-1' },
            } as Wallet;
          }
          if (entity === User) {
            return {
              id: 'user-1',
              email: 'sameuser@mail.com',
            } as User;
          }
          return null;
        });
      
        await expect(
          transactionService.transferByEmail('user-1', 'sameuser@mail.com', 'BRL', 100),
        ).rejects.toThrowError('Não é possível transferir para si mesmo.');
      });

    it('deve fazer rollback se ocorrer erro inesperado', async () => {
      const senderWallet = { id: 'wallet-1', balance: 1000 } as Wallet;
      const receiverUser = { id: 'user-2', email: 'destino@mail.com' } as User;
      const receiverWallet = { id: 'wallet-2', balance: 500 } as Wallet;

      (mockEntityManager.findOne as jest.Mock)
        .mockResolvedValueOnce(senderWallet)
        .mockResolvedValueOnce(receiverUser)
        .mockResolvedValueOnce(receiverWallet);

      (mockEntityManager.save as jest.Mock).mockRejectedValueOnce(new Error('Erro no banco'));

      await expect(
        transactionService.transferByEmail('user-1', 'destino@mail.com', 'BRL', 200),
      ).rejects.toThrow('Erro no banco');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('deve lançar erro se o valor da transferência for zero ou negativo', async () => {
      await expect(
        transactionService.transferByEmail('user-1', 'destino@mail.com', 'BRL', 0),
      ).rejects.toThrow(BadRequestException);

      await expect(
        transactionService.transferByEmail('user-1', 'destino@mail.com', 'BRL', -50),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lançar erro se a carteira de origem não existir (moeda inexistente)', async () => {
      (mockEntityManager.findOne as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        transactionService.transferByEmail('user-1', 'destino@mail.com', 'XYZ', 100),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('refundTransaction', () => {
    it('deve estornar com sucesso se for a transação do user e dentro do prazo, com saldo no toWallet', async () => {
      const mockTransaction = {
        id: 'trans-1',
        status: 'SUCCESS',
        createdAt: new Date(),
        amount: 100,
        fromWallet: {
          id: 'wallet-from',
          balance: 900,
          user: { id: 'user-1' },
        },
        toWallet: {
          id: 'wallet-to',
          balance: 500,
          user: { id: 'user-2' },
        },
      } as any as Transaction;

      (mockEntityManager.findOne as jest.Mock).mockResolvedValueOnce(mockTransaction);

      (mockEntityManager.save as jest.Mock).mockResolvedValueOnce(true);
      (mockEntityManager.save as jest.Mock).mockResolvedValueOnce(true); 

      const result = await transactionService.refundTransaction('user-1', 'trans-1');

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockEntityManager.save).toHaveBeenCalledTimes(2);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.status).toBe('REVERSED');
      expect(result.fromWallet.balance).toBe(1000);
    });

    it('deve lançar erro se transação não encontrada', async () => {
      (mockEntityManager.findOne as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        transactionService.refundTransaction('user-1', 'trans-xx'),
      ).rejects.toThrowError('Transação não encontrada.');
    });

    it('deve lançar erro se a carteira de origem for inválida', async () => {
      const mockTransaction = {
        fromWallet: null,
      } as any as Transaction;

      (mockEntityManager.findOne as jest.Mock).mockResolvedValueOnce(mockTransaction);

      await expect(
        transactionService.refundTransaction('user-1', 'trans-1'),
      ).rejects.toThrowError('Carteira de origem inválida.');
    });

    it('deve lançar erro se o user não for dono da transação', async () => {
      const mockTransaction = {
        fromWallet: {
          user: { id: 'outro-user' },
        },
      } as any as Transaction;

      (mockEntityManager.findOne as jest.Mock).mockResolvedValueOnce(mockTransaction);

      await expect(
        transactionService.refundTransaction('user-1', 'trans-1'),
      ).rejects.toThrowError('Você só pode estornar suas próprias transações.');
    });

    it('deve lançar erro se a transação já foi estornada', async () => {
      const mockTransaction = {
        status: 'REVERSED',
        fromWallet: { user: { id: 'user-1' } },
      } as any as Transaction;

      (mockEntityManager.findOne as jest.Mock).mockResolvedValueOnce(mockTransaction);

      await expect(
        transactionService.refundTransaction('user-1', 'trans-1'),
      ).rejects.toThrowError('Esta transação já foi estornada e não pode ser alterada.');
    });

    it('deve lançar erro se passou dos 7 dias', async () => {
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const mockTransaction = {
        status: 'SUCCESS',
        createdAt: oldDate,
        fromWallet: { user: { id: 'user-1' } },
      } as any as Transaction;

      (mockEntityManager.findOne as jest.Mock).mockResolvedValueOnce(mockTransaction);

      await expect(
        transactionService.refundTransaction('user-1', 'trans-1'),
      ).rejects.toThrowError('O prazo para estorno desta transação expirou.');
    });

    it('deve marcar REVERSED_FAILED e lançar exceção se saldo do toWallet for insuficiente', async () => {
      const mockTransaction = {
        id: 'trans-1',
        status: 'SUCCESS',
        createdAt: new Date(),
        amount: 500,
        fromWallet: {
          id: 'wallet-from',
          balance: 1000,
          user: { id: 'user-1' },
        },
        toWallet: {
          id: 'wallet-to',
          balance: 100,
          user: { id: 'user-2' },
        },
      } as any as Transaction;

      (mockEntityManager.findOne as jest.Mock).mockResolvedValueOnce(mockTransaction);

      (mockEntityManager.save as jest.Mock).mockResolvedValueOnce(true);

      await expect(
        transactionService.refundTransaction('user-1', 'trans-1'),
      ).rejects.toThrowError('O destinatário não tem saldo suficiente para o estorno.');

      expect(mockEntityManager.save).toHaveBeenCalledWith(
        Transaction,
        expect.objectContaining({
          status: 'REVERSED_FAILED',
        }),
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });
});
