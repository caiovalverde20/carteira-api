import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Wallet } from '../src/modules/wallet/wallet.entity';
import { User } from '../src/modules/user/user.entity';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { DEFAULT_WALLETS } from '../src/modules/wallet/default-wallets.config';

describe('Wallets - e2e', () => {
  let app: INestApplication;
  let walletRepository: any;
  let userRepository: any;
  let moduleFixture: TestingModule;
  let user: User;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    walletRepository = moduleFixture.get(getRepositoryToken(Wallet));
    userRepository = moduleFixture.get(getRepositoryToken(User));
  });

  beforeEach(async () => {
    const hashedPassword = await bcrypt.hash('senha123', 10);
    user = await userRepository.save({
      nome: 'Teste Wallet',
      email: 'teste@wallet.com',
      senha: hashedPassword,
    });

    const wallets = DEFAULT_WALLETS.map(walletData => ({
      currency: walletData.currency,
      balance: walletData.initialBalance,
      user,
    }));
    await walletRepository.save(wallets);
  });

  afterEach(async () => {
    await walletRepository.clear();
    await userRepository.clear();
  });

  afterAll(async () => {
    await app.close();
    await moduleFixture.close();
  });

  it('Deve retornar todas as carteiras do usuário autenticado', async () => {
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || 'secret');

    const response = await request(app.getHttpServer())
      .get('/wallets')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(DEFAULT_WALLETS.length);
  });

  it('Deve retornar a carteira específica para a moeda', async () => {
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || 'secret');

    const response = await request(app.getHttpServer())
      .get('/wallets/BRL')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.currency).toBe('BRL');
    expect(response.body.balance).toBe(1000);
  });

  it('Deve retornar 404 se a carteira não existir', async () => {
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || 'secret');

    const response = await request(app.getHttpServer())
      .get('/wallets/EUR')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toContain('Carteira para a moeda EUR não encontrada.');
  });

  it('Deve retornar 401 para token inválido', async () => {
    const invalidToken = 'invalid-token';
    const response = await request(app.getHttpServer())
      .get('/wallets')
      .set('Authorization', `Bearer ${invalidToken}`);

    expect(response.status).toBe(401);
    expect(response.body.message).toContain('Token inválido');
  });
});
