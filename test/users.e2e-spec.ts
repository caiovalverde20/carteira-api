import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../src/modules/user/user.entity';
import { Wallet } from '../src/modules/wallet/wallet.entity';
import * as jwt from 'jsonwebtoken';

describe('Users - e2e', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let walletRepository: Repository<Wallet>;
  let moduleFixture: TestingModule;

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
  });

  afterEach(async () => {
    await walletRepository.clear();
    await userRepository.clear();
  });

  afterAll(async () => {
    await app.close();
    await moduleFixture.close();
  });

  it('Deve registrar um usuário com sucesso e criar as carteiras padrão', async () => {
    const response = await request(app.getHttpServer())
      .post('/users/register')
      .send({ nome: 'Teste', email: 'teste@mail.com', senha: 'senha123' });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.email).toBe('teste@mail.com');

    const token = jwt.sign({ id: response.body.id, email: response.body.email }, process.env.JWT_SECRET || 'secret');

    const walletResponse = await request(app.getHttpServer())
      .get('/wallets')
      .set('Authorization', `Bearer ${token}`);

    expect(walletResponse.status).toBe(200);
    expect(walletResponse.body.length).toBe(2);
  });

  it('Deve rejeitar email duplicado', async () => {
    await userRepository.save({ nome: 'Teste', email: 'teste@mail.com', senha: 'hash123' });

    const response = await request(app.getHttpServer())
      .post('/users/register')
      .send({ nome: 'Teste', email: 'teste@mail.com', senha: 'senha123' });

    expect(response.status).toBe(409);
  });

  it('Deve rejeitar senhas curtas', async () => {
    const response = await request(app.getHttpServer())
      .post('/users/register')
      .send({ nome: 'Teste', email: 'teste@mail.com', senha: '123' });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('A senha deve ter pelo menos 6 caracteres');
  });
});
