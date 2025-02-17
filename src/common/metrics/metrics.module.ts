import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';
import { 
  HTTP_REQUESTS_TOTAL, 
  HTTP_REQUEST_DURATION,
  LOGIN_SUCCESS_COUNTER,
  LOGIN_FAILURE_COUNTER,
  TRANSACTION_SUCCESS_COUNTER,
  TRANSACTION_FAILURE_COUNTER,
} from './metrics.providers';

@Module({
  imports: [PrometheusModule.register()],
  controllers: [MetricsController],
  providers: [
    HTTP_REQUESTS_TOTAL,
    HTTP_REQUEST_DURATION,
    LOGIN_SUCCESS_COUNTER,
    LOGIN_FAILURE_COUNTER,
    TRANSACTION_SUCCESS_COUNTER,
    TRANSACTION_FAILURE_COUNTER,
    MetricsInterceptor,
  ],
  exports: [
    PrometheusModule,
    MetricsInterceptor,
    LOGIN_SUCCESS_COUNTER,
    LOGIN_FAILURE_COUNTER,
    TRANSACTION_SUCCESS_COUNTER,
    TRANSACTION_FAILURE_COUNTER,
  ],
})
export class MetricsModule {}
