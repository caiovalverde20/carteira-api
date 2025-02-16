import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Wallet } from './wallet.entity';
import { Repository } from 'typeorm';
import { DEFAULT_WALLETS } from './default-wallets.config';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
  ) {}

  async createDefaultWallets(user: any): Promise<Wallet[]> {
    const wallets = DEFAULT_WALLETS.map(walletData => {
      return this.walletRepository.create({
        currency: walletData.currency,
        balance: walletData.initialBalance,
        user,
      });
    });
    return this.walletRepository.save(wallets);
  }

  async getWalletsByUser(userId: string): Promise<Wallet[]> {
    return this.walletRepository.find({
      where: { user: { id: userId } },
    });
  }

  async getWalletByUserAndCurrency(userId: string, currency: string): Promise<Wallet> {
    const wallet = await this.walletRepository.findOne({
      where: { user: { id: userId }, currency },
    });
    if (!wallet) {
      throw new NotFoundException(`Carteira para a moeda ${currency} não encontrada.`);
    }
    return wallet;
  }
}
