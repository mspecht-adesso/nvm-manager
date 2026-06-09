import { GlobalErrorHandler } from './global-error-handler';

/**
 * Unit tests for {@link GlobalErrorHandler}.
 *
 * Verifies that errors are logged to the console and that non-`Error` thrown
 * values are wrapped so a usable message is always logged. `console.error` is
 * spied on (and silenced) to keep the test output clean and to assert the call.
 */
describe('GlobalErrorHandler', () => {
  let handler: GlobalErrorHandler;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    handler = new GlobalErrorHandler();
    // Silence and capture console.error so we can assert on it without noise.
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    // Restore the real console.error to avoid leaking the spy into other suites.
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
