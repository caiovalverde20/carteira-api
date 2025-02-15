import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TestAppModule } from './test-app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../src/modules/user/user.entity';
import * as bcrypt from 'bcrypt';

describe('Auth - e2e', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
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
  });

  it('Deve realizar login com sucesso e retornar token', async () => {
    const senhaCriptografada = await bcrypt.hash('senha123', 10);

    const user = await userRepository.save({
      nome: 'Teste Login',
      email: 'teste@login.com',
      senha: senhaCriptografada,
    });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, senha: 'senha123' });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('access_token');
  });

  it('Deve retornar erro 400 ao tentar logar com email inexistente', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'email@inexistente.com', senha: 'senha123' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Email ou senha inválidos.');
  });

  it('Deve retornar erro 400 ao tentar logar com senha incorreta', async () => {
    const senhaCriptografada = await bcrypt.hash('senha123', 10);

    const user = await userRepository.save({
      nome: 'Teste Login',
      email: 'teste@login.com',
      senha: senhaCriptografada,
    });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, senha: 'senhaerrada' });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Email ou senha inválidos.');
  });

  it('Deve retornar erro 400 ao tentar logar sem email', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ senha: 'senha123' });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('O email deve ser válido');
  });

  it('Deve retornar erro 400 ao tentar logar sem senha', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'teste@login.com' });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('A senha não deve ser vazia');
  });
});
