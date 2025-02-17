import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { TransactionModule } from './modules/transaction/transaction.module';
import { MetricsModule } from './common/metrics/metrics.module';

console.log('Conectando ao banco:', process.env.DB_NAME);

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      username: process.env.DB_USER || 'user',
      password: process.env.DB_PASS || 'pass',
      database: process.env.DB_NAME || 'carteiradb',
      entities: [__dirname + '/**/*.entity.js'],
      synchronize: process.env.NODE_ENV !== 'production',
      ...(process.env.DB_SSL === 'true' && {
        ssl: {
          rejectUnauthorized: false,
        },
      }),
    }),
    MetricsModule,
    UserModule,
    AuthModule,
    WalletModule,
    TransactionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
