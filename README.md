# Carteira API

A **Carteira API** é uma aplicação que simula transferências seguras entre usuários. Com ela, é possível realizar transferências, estornos e visualizar o histórico de transações.

## Tecnologias Utilizadas

- **NestJS** – Framework backend
- **PostgreSQL** – Banco de dados relacional (utilizando TypeORM)
- **TypeORM** – ORM para manipulação do banco de dados
- **Docker** – Facilita o deploy e o desenvolvimento local

## Deploy

A API está disponível no Render:  
[https://carteira-api.onrender.com](https://carteira-api.onrender.com)

A documentação Swagger da API pode ser acessada em:  
[https://carteira-api.onrender.com/api](https://carteira-api.onrender.com/api)

## Diagrama ER

![Diagrama ER](./docs/ER-diagram.png)

Como o foco são as transferências, os usuários criados automaticamente ganham 1000 reais e 1000 dólares em suas respectivas wallets para testar. O usuário não pode criar wallets diretamente através de alguma rota.

## Como Executar o Projeto

### Com Docker

1. Clone este repositório:
   ```bash
   git clone https://github.com/caiovalverde20/carteira-api.git
   cd carteira-api
   ```

2. (Opcional) Crie um arquivo `.env` na raiz do projeto com as variáveis de ambiente necessárias:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=seu_usuario
   DB_PASS=sua_senha
   DB_NAME=carteiradb
   JWT_SECRET=secret
   NODE_ENV=development
   PORT=3000
   ```

3. Construa e inicie os containers:
   ```bash
   docker-compose up --build
   ```

4. As tabelas serão criadas automaticamente (utilizando `synchronize: true` em ambiente de desenvolvimento).  
   Acesse a API em: [http://localhost:3000](http://localhost:3000) ou [http://localhost:3000/api](http://localhost:3000/api) para ir direto para a documentação do swagger.

### Sem Docker

1. Clone este repositório:
   ```bash
   git clone https://github.com/caiovalverde20/carteira-api.git
   cd carteira-api
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Crie um arquivo `.env` na raiz do projeto com as variáveis de ambiente:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=seu_usuario
   DB_PASS=sua_senha
   DB_NAME=carteiradb
   JWT_SECRET=secret
   NODE_ENV=development
   PORT=3000
   ```

4. Compile o projeto:
   ```bash
   npm run build
   ```

5. Inicie a aplicação:
   ```bash
   npm run start:prod
   ```

6. Acesse a API em: [http://localhost:3000](http://localhost:3000) ou [http://localhost:3000/api](http://localhost:3000/api) para ir direto para a documentação do swagger.

## Endpoints Principais

- **Transferência**: `POST /transactions/transfer`  
  Realiza uma transferência entre carteiras.

- **Estorno**: `POST /transactions/refund`  
  Solicita o estorno de uma transação realizada em até 7 dias. Se o destinatário não tiver saldo suficiente, o estorno falha, mas pode ser tentado novamente a qualquer momento.

- **Histórico**: `GET /transactions/history`  
  Retorna o histórico de transações do usuário.

## Segurança e Confiabilidade das Transações

As operações de transferência e estorno são atômicas, garantindo que cada transação ocorra completamente ou seja completamente revertida em caso de falha.

- Foi utilizado o **TypeORM** com **QueryRunner** para fazer as transações de forma atômica.  
- **Locks pessimistas** foram aplicadas nas carteiras durante as operações para evitar condições de corrida.  
- Em caso de falha, a transação é **desfeita automaticamente** (`rollback`).  

Isso assegura que **nenhuma transferência seja parcial ou inconsistente**, mesmo com múltiplas transações concorrentes.

As transferências possuem 3 estados:

- **SUCCESS** - A transação foi realizada com sucesso e pode ser estornada dentro do prazo de 7 dias.
- **REVERSED** - A transação foi estornada com sucesso e não pode ser alterada novamente.
- **REVERSED_FAILED** - A tentativa de estorno falhou porque o destinatário não possui saldo suficiente. O usuário pode tentar novamente a qualquer momento, sem a restrição de 7 dias.

## Testes Automatizados

Todas as rotas estão testadas. Para rodar os testes:

- Testes unitários:
  ```bash
  npm run test
  ```
- Testes de integração (E2E):
  ```bash
  npm run test:e2e
  ```

## Monitoramente com Prometheus/grafana

O sistema coleta métricas (logins, transações, latência, etc.) por meio do Prometheus e as exibe em dashboards no Grafana.
Em ambiente local, acesse o Grafana em: [http://localhost:3001](http://localhost:3001)