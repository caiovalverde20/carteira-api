import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Wallet } from '../wallet/wallet.entity';
import { Transaction } from './transaction.entity';
import { User } from '../user/user.entity';

@Injectable()
export class TransactionService {
  constructor(private dataSource: DataSource) {}

  async transferByEmail(senderId: string, toEmail: string, currency: string, amount: number): Promise<Transaction> {
    if (amount <= 0) {
      throw new BadRequestException('O valor da transferência deve ser maior que zero.');
    }
    currency = currency.toUpperCase();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const fromWallet = await this.getWalletForUser(queryRunner, senderId, currency, 'Carteira de origem não encontrada.');
      if (Number(fromWallet.balance) < amount) {
        throw new BadRequestException('Saldo insuficiente.');
      }

      const recipientUser = await this.getUserByEmail(queryRunner, toEmail);

      const toWallet = await this.getWalletForUser(queryRunner, recipientUser.id, currency, 'Carteira de destino não encontrada.');

      await this.updateWalletBalances(queryRunner, fromWallet, toWallet, amount);

      const transaction = await this.recordTransaction(queryRunner, fromWallet, toWallet, amount);

      await queryRunner.commitTransaction();
      return transaction;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async getWalletForUser(queryRunner: any, userId: string, currency: string, errorMsg: string): Promise<Wallet> {
    const isSQLite = queryRunner.connection.options.type === 'sqlite';
    
    const wallet = await queryRunner.manager.findOne(Wallet, {
      where: { user: { id: userId }, currency },
      ...(isSQLite ? {} : { lock: { mode: 'pessimistic_write' } }),
    });
  
    if (!wallet) {
      throw new BadRequestException(errorMsg);
    }
    
    return wallet;
  }

  private async getUserByEmail(queryRunner: any, email: string): Promise<User> {
    const user = await queryRunner.manager.findOne(User, { where: { email } });
    if (!user) {
      throw new BadRequestException('Usuário destinatário não encontrado.');
    }
    return user;
  }

  private async updateWalletBalances(queryRunner: any, fromWallet: Wallet, toWallet: Wallet, amount: number): Promise<void> {
    fromWallet.balance = Number(fromWallet.balance) - amount;
    toWallet.balance = Number(toWallet.balance) + amount;
    await queryRunner.manager.save(Wallet, fromWallet);
    await queryRunner.manager.save(Wallet, toWallet);
  }

  private async recordTransaction(queryRunner: any, fromWallet: Wallet, toWallet: Wallet, amount: number): Promise<Transaction> {
    const transaction = queryRunner.manager.create(Transaction, {
      fromWallet,
      toWallet,
      amount,
    });
    return await queryRunner.manager.save(Transaction, transaction);
  }
}
