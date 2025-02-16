import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../src/modules/user/user.entity';
import { Wallet } from '../src/modules/wallet/wallet.entity';
import { Transaction } from '../src/modules/transaction/transaction.entity';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

describe('Transactions - e2e', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let walletRepository: Repository<Wallet>;
  let transactionRepository: Repository<Transaction>;
  let moduleFixture: TestingModule;
  let sender: User;
  let recipient: User;
  let senderToken: string;

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

    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    walletRepository = moduleFixture.get<Repository<Wallet>>(getRepositoryToken(Wallet));
    transactionRepository = moduleFixture.get<Repository<Transaction>>(getRepositoryToken(Transaction));
  });

  beforeEach(async () => {
    await transactionRepository.clear();
    await walletRepository.clear(); 
    await userRepository.clear();

    const hashedPassword = await bcrypt.hash('senha123', 10);

    sender = await userRepository.save({
      nome: 'Sender',
      email: 'sender@mail.com',
      senha: hashedPassword,
    });

    recipient = await userRepository.save({
      nome: 'Recipient',
      email: 'recipient@mail.com',
      senha: hashedPassword,
    });

    await walletRepository.save({
      currency: 'BRL',
      balance: 1000,
      user: sender,
    });

    await walletRepository.save({
      currency: 'BRL',
      balance: 0,
      user: recipient,
    });

    sender = await userRepository.findOne({
      where: { email: 'sender@mail.com' },
      relations: ['wallets'],
    });

    recipient = await userRepository.findOne({
      where: { email: 'recipient@mail.com' },
      relations: ['wallets'],
    });

    senderToken = jwt.sign({ id: sender.id, email: sender.email }, process.env.JWT_SECRET || 'secret');
  });

  afterEach(async () => {
    await transactionRepository.clear();
    await walletRepository.clear();
    await userRepository.clear();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (moduleFixture) await moduleFixture.close();
  });

  it('Deve realizar uma transferência com sucesso', async () => {
    const response = await request(app.getHttpServer())
      .post('/transactions/transfer')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        toEmail: 'recipient@mail.com',
        currency: 'BRL',
        amount: 200,
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.amount).toBe(200);
  });

  it('Deve falhar ao tentar transferir mais do que o saldo disponível', async () => {
    const response = await request(app.getHttpServer())
      .post('/transactions/transfer')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        toEmail: 'recipient@mail.com',
        currency: 'BRL',
        amount: 100000,
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Saldo insuficiente.');
  });

  it('Deve falhar ao tentar transferir um valor negativo', async () => {
    const response = await request(app.getHttpServer())
      .post('/transactions/transfer')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        toEmail: 'recipient@mail.com',
        currency: 'BRL',
        amount: -50,
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('O valor da transferência deve ser maior que zero');
  });

  it('Deve falhar ao tentar transferir para um usuário inexistente', async () => {
    const response = await request(app.getHttpServer())
      .post('/transactions/transfer')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        toEmail: 'naoexiste@mail.com',
        currency: 'BRL',
        amount: 200,
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Usuário destinatário não encontrado.');
  });

  it('Deve falhar ao tentar transferir uma moeda desconhecida', async () => {
    const response = await request(app.getHttpServer())
      .post('/transactions/transfer')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        toEmail: 'recipient@mail.com',
        currency: 'XYZ',
        amount: 200,
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Carteira de origem não encontrada.');
  });
});
