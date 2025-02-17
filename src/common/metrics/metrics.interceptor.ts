import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric('http_requests_total')
    private readonly requestCounter: Counter<string>,
    @InjectMetric('http_request_duration_seconds')
    private readonly requestDuration: Histogram<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const method = request.method;
    const route = request.route ? request.route.path : 'unknown';

    const endTimer = this.requestDuration.startTimer({ method, route });

    return next.handle().pipe(
      tap(() => {
        const statusCode = response.statusCode;
        this.requestCounter.inc({ method, route, status_code: statusCode });
        endTimer({ method, route, status_code: statusCode });
      }),
    );
  }
}
