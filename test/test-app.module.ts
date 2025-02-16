import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { UserModule } from '../src/modules/user/user.module';
import { AuthModule } from '../src/modules/auth/auth.module';
import { WalletModule } from '../src/modules/wallet/wallet.module';
import { User } from '../src/modules/user/user.entity';
import { Wallet } from '../src/modules/wallet/wallet.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: ':memory:',
      entities: [User, Wallet],
      synchronize: true,
      dropSchema: true,
    }),
    UserModule,
    AuthModule,
    WalletModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class TestAppModule {}
