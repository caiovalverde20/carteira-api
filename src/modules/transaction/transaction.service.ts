import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { Wallet } from '../wallet/wallet.entity';
import { Transaction } from './transaction.entity';
import { User } from '../user/user.entity';

@Injectable()
export class TransactionService {
  constructor(private dataSource: DataSource) {}

  async transferByEmail(senderId: string, toEmail: string, currency: string, amount: number): Promise<Transaction> {
    if (amount <= 0) throw new BadRequestException('O valor da transferência deve ser maior que zero');
    currency = currency.toUpperCase();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const fromWallet = await this.getWalletForUser(queryRunner, senderId, currency, 'Carteira de origem não encontrada.');
      if (Number(fromWallet.balance) < amount) throw new BadRequestException('Saldo insuficiente.');

      const recipientUser = await this.getUserByEmail(queryRunner, toEmail);

      if (recipientUser.id === senderId) {
        throw new BadRequestException('Não é possível transferir para si mesmo.');
      }

      const toWallet = await this.getWalletForUser(queryRunner, recipientUser.id, currency, 'Carteira de destino não encontrada.');

      await this.updateWalletBalances(queryRunner, fromWallet, toWallet, amount);
      const transaction = await this.recordTransaction(queryRunner, fromWallet, toWallet, amount, 'SUCCESS');

      await queryRunner.commitTransaction();
      return transaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async refundTransaction(userId: string, transactionId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
  
    try {
      const transaction = await queryRunner.manager.findOne(Transaction, {
        where: { id: transactionId },
        relations: ['fromWallet', 'fromWallet.user', 'toWallet', 'toWallet.user'],
      });
      if (!transaction) throw new BadRequestException('Transação não encontrada.');
      if (!transaction.fromWallet?.user) throw new BadRequestException('Carteira de origem inválida.');
      if (transaction.fromWallet.user.id !== userId) {
        throw new BadRequestException('Você só pode estornar suas próprias transações.');
      }
      if (transaction.status === 'REVERSED') {
        throw new BadRequestException('Esta transação já foi estornada e não pode ser alterada.');
      }
  
      const diffDays = (Date.now() - transaction.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (transaction.status === 'SUCCESS' && diffDays > 7) {
        throw new BadRequestException('O prazo para estorno desta transação expirou.');
      }
  
      const refundAmount = Number(transaction.amount);
      const toWalletBalance = Number(transaction.toWallet.balance);
  
      if (toWalletBalance < refundAmount) {
        transaction.status = 'REVERSED_FAILED';
        await queryRunner.manager.save(Transaction, transaction);
        await queryRunner.commitTransaction();
        await queryRunner.release();
        throw new BadRequestException('O destinatário não tem saldo suficiente para o estorno.');
      }
  
      await this.updateWalletBalances(queryRunner, transaction.toWallet, transaction.fromWallet, refundAmount);
      transaction.status = 'REVERSED';
      await queryRunner.manager.save(Transaction, transaction);
  
      await queryRunner.commitTransaction();
      await queryRunner.release();
  
      return this.buildRefundResponse(transaction);
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      await queryRunner.release();
      throw error;
    }
  }

  async getTransactionHistory(userId: string) {
    const transactionRepo = this.dataSource.getRepository(Transaction);
  
    const transactions = await transactionRepo.find({
      where: [
        { fromWallet: { user: { id: userId } } },
        { toWallet: { user: { id: userId } } },
      ],
      relations: ['fromWallet', 'fromWallet.user', 'toWallet', 'toWallet.user'],
      order: { createdAt: 'DESC' },
    });
  
    return transactions.map((t) => this.buildTransactionHistory(t));
  }

  private async getWalletForUser(
    queryRunner: QueryRunner,
    userId: string,
    currency: string,
    errorMsg: string
  ) {
    const isSQLite = queryRunner.connection.options.type === 'sqlite';

    const wallet = await queryRunner.manager.findOne(Wallet, {
      where: { user: { id: userId }, currency },
      ...(isSQLite ? {} : { lock: { mode: 'pessimistic_write' } }),
    });

    if (!wallet) throw new BadRequestException(errorMsg);
    return wallet;
  }

  private async getUserByEmail(queryRunner: QueryRunner, email: string) {
    const user = await queryRunner.manager.findOne(User, { where: { email } });
    if (!user) throw new BadRequestException('Usuário destinatário não encontrado.');
    return user;
  }

  private async updateWalletBalances(
    queryRunner: QueryRunner,
    fromWallet: Wallet,
    toWallet: Wallet,
    amount: number,
  ) {
    fromWallet.balance = Number(fromWallet.balance) - amount;
    toWallet.balance = Number(toWallet.balance) + amount;
    await queryRunner.manager.save([fromWallet, toWallet]);
  }  

  private async recordTransaction(
    queryRunner: QueryRunner,
    fromWallet: Wallet,
    toWallet: Wallet,
    amount: number,
    status: string
  ) {
    const transaction = queryRunner.manager.create(Transaction, { fromWallet, toWallet, amount, status });
    return queryRunner.manager.save(Transaction, transaction);
  }

  private buildRefundResponse(transaction: Transaction) {
    const { id, amount, createdAt, status, fromWallet, toWallet } = transaction;
    return {
      id,
      amount: Number(amount),
      createdAt,
      status,
      fromWallet: {
        id: fromWallet.id,
        currency: fromWallet.currency,
        balance: Number(fromWallet.balance),
      },
      toWallet: {
        id: toWallet.id,
        currency: toWallet.currency,
      },
    };
  }

  private buildTransactionHistory(transaction: Transaction) {
    return {
      id: transaction.id,
      amount: Number(transaction.amount),
      createdAt: transaction.createdAt,
      status: transaction.status,
      fromWallet: {
        id: transaction.fromWallet.id,
        currency: transaction.fromWallet.currency,
        userId: transaction.fromWallet.user.id,
      },
      toWallet: {
        id: transaction.toWallet.id,
        currency: transaction.toWallet.currency,
        userId: transaction.toWallet.user.id,
      },
    };
  }
  
}
