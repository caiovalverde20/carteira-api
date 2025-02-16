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
  let otherUser: User;
  let otherToken: string;

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

    otherUser = await userRepository.save({
      nome: 'Outsider',
      email: 'outsider@mail.com',
      senha: hashedPassword,
    });

    await walletRepository.save([
      { currency: 'BRL', balance: 1000, user: sender },
      { currency: 'BRL', balance: 0, user: recipient },
      { currency: 'BRL', balance: 500, user: otherUser },
    ]);

    sender = await userRepository.findOne({ where: { email: 'sender@mail.com' }, relations: ['wallets'] });
    recipient = await userRepository.findOne({ where: { email: 'recipient@mail.com' }, relations: ['wallets'] });
    otherUser = await userRepository.findOne({ where: { email: 'outsider@mail.com' }, relations: ['wallets'] });

    senderToken = jwt.sign({ id: sender.id, email: sender.email }, process.env.JWT_SECRET || 'secret');
    otherToken = jwt.sign({ id: otherUser.id, email: otherUser.email }, process.env.JWT_SECRET || 'secret');
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

  it('Deve estornar uma transação com sucesso', async () => {
    const transferRes = await request(app.getHttpServer())
      .post('/transactions/transfer')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ toEmail: 'recipient@mail.com', currency: 'BRL', amount: 200 });
    expect(transferRes.status).toBe(201);
    const transactionId = transferRes.body.id;
  
    const refundRes = await request(app.getHttpServer())
      .post('/transactions/refund')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ transactionId });
    expect(refundRes.status).toBe(201);
    expect(refundRes.body.status).toBe('REVERSED');
    expect(refundRes.body.id).toBe(transactionId);
  });

  it('Deve falhar ao tentar estornar uma transação inexistente', async () => {
    const refundRes = await request(app.getHttpServer())
      .post('/transactions/refund')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ transactionId: '11111111-1111-4111-8111-111111111111' });
    expect(refundRes.status).toBe(400);
    expect(refundRes.body.message).toContain('Transação não encontrada.'); 
  });

  it('Deve falhar se outro usuário tentar estornar a transação', async () => {
    const transferRes = await request(app.getHttpServer())
      .post('/transactions/transfer')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ toEmail: 'recipient@mail.com', currency: 'BRL', amount: 200 });
    expect(transferRes.status).toBe(201);
    const transactionId = transferRes.body.id;

    const refundRes = await request(app.getHttpServer())
      .post('/transactions/refund')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ transactionId });
    expect(refundRes.status).toBe(400);
    expect(refundRes.body.message).toContain('Você só pode estornar suas próprias transações.');
  });

  it('Deve falhar se a transação já foi estornada', async () => {
    const transferRes = await request(app.getHttpServer())
      .post('/transactions/transfer')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ toEmail: 'recipient@mail.com', currency: 'BRL', amount: 100 });
    expect(transferRes.status).toBe(201);
    const transactionId = transferRes.body.id;
  
    const firstRefund = await request(app.getHttpServer())
      .post('/transactions/refund')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ transactionId });
    expect(firstRefund.status).toBe(201);
    expect(firstRefund.body.status).toBe('REVERSED');
  
    const secondRefund = await request(app.getHttpServer())
      .post('/transactions/refund')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ transactionId });
    expect(secondRefund.status).toBe(400);
    expect(secondRefund.body.message).toContain('Esta transação já foi estornada e não pode ser alterada.');
  });

  it('Deve falhar se passaram mais de 7 dias', async () => {
    const transferRes = await request(app.getHttpServer())
      .post('/transactions/transfer')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ toEmail: 'recipient@mail.com', currency: 'BRL', amount: 200 });
    expect(transferRes.status).toBe(201);

    const transactionId = transferRes.body.id;

    const transactionEntity = await transactionRepository.findOne({ where: { id: transactionId } });
    const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    transactionEntity.createdAt = oldDate;
    await transactionRepository.save(transactionEntity);

    const refundRes = await request(app.getHttpServer())
      .post('/transactions/refund')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ transactionId });
    expect(refundRes.status).toBe(400);
    expect(refundRes.body.message).toContain('O prazo para estorno desta transação expirou.');
  });

  it('Deve falhar se o destinatário estiver sem saldo (REVERSED_FAILED)', async () => {
    const transferRes = await request(app.getHttpServer())
      .post('/transactions/transfer')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ toEmail: 'recipient@mail.com', currency: 'BRL', amount: 200 });
    expect(transferRes.status).toBe(201);

    const transactionId = transferRes.body.id;

    const recipientWallet = await walletRepository.findOne({
      where: { user: { id: recipient.id }, currency: 'BRL' },
    });
    recipientWallet.balance = 0;
    await walletRepository.save(recipientWallet);

    const refundRes = await request(app.getHttpServer())
      .post('/transactions/refund')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({ transactionId });
    expect(refundRes.status).toBe(400);
    expect(refundRes.body.message).toContain('O destinatário não tem saldo suficiente para o estorno.');
    });

});
