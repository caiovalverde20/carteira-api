import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { ExecutionContext } from '@nestjs/common';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: JwtService;

  beforeEach(() => {
    jwtService = new JwtService({ secret: 'test-secret' });
    guard = new JwtAuthGuard(jwtService);
  });

  it('Deve permitir acesso se o token for válido', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: 'Bearer valid-token' },
          user: {},
        }),
      }),
    } as unknown as ExecutionContext;

    jest.spyOn(jwtService, 'verify').mockReturnValue({ id: 'user-id' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('Deve negar acesso se o token for inválido', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: 'Bearer invalid-token' },
        }),
      }),
    } as unknown as ExecutionContext;

    jest.spyOn(jwtService, 'verify').mockImplementation(() => {
      throw new Error('Token inválido');
    });

    expect(() => guard.canActivate(context)).toThrow('Token inválido');
  });

  it('Deve negar acesso se não houver token', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
        }),
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow('Token ausente ou inválido');
  });
});
