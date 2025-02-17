import { makeCounterProvider, makeHistogramProvider } from '@willsoto/nestjs-prometheus';

export const HTTP_REQUESTS_TOTAL = makeCounterProvider({
  name: 'http_requests_total',
  help: 'Número total de requisições',
  labelNames: ['method', 'route', 'status_code'],
});

export const HTTP_REQUEST_DURATION = makeHistogramProvider({
  name: 'http_request_duration_seconds',
  help: 'Duração das requisições HTTP em segundos',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 1.5, 2, 5],
});

export const TRANSACTION_SUCCESS_COUNTER = makeCounterProvider({
  name: 'transaction_success_total',
  help: 'Número total de transações bem-sucedidas',
  labelNames: ['type'],
});

export const TRANSACTION_FAILURE_COUNTER = makeCounterProvider({
  name: 'transaction_failure_total',
  help: 'Número total de transações com falha',
  labelNames: ['type'],
});

export const LOGIN_SUCCESS_COUNTER = makeCounterProvider({
  name: 'login_success_total',
  help: 'Número total de logins bem-sucedidos',
});

export const LOGIN_FAILURE_COUNTER = makeCounterProvider({
  name: 'login_failure_total',
  help: 'Número total de tentativas de login falhas',
});
