import { GlobalErrorHandler } from './global-error-handler';

describe('GlobalErrorHandler', () => {
  let handler: GlobalErrorHandler;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    handler = new GlobalErrorHandler();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('loggt Error-Objekte auf der Konsole', () => {
    const error = new Error('Boom');
    handler.handleError(error);
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    expect(consoleErrorSpy.mock.calls[0]).toContain('Boom');
  });

  it('verpackt Nicht-Error-Werte in ein Error-Objekt', () => {
    handler.handleError('nur ein String');
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    expect(consoleErrorSpy.mock.calls[0]).toContain('nur ein String');
  });
});
