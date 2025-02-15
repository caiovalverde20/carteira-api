import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../src/modules/user/user.entity';

describe('Users - e2e', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
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
  });

  afterEach(async () => {
    await userRepository.clear();
  });

  afterAll(async () => {
    await app.close();
    await moduleFixture.close();
  });

  it('Deve registrar um usuário com sucesso', async () => {
    const response = await request(app.getHttpServer())
      .post('/users/register')
      .send({ nome: 'Teste', email: 'teste@mail.com', senha: 'senha123' });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.email).toBe('teste@mail.com');
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
