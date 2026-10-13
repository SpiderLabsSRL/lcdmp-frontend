import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ioMock = vi.fn();
const refreshAccessTokenMock = vi.fn();

vi.mock('@/api/api', () => ({
  refreshAccessToken: () => refreshAccessTokenMock(),
}));

// Lo que socket.io-client le pasaría a auth: una función que entrega el handshake
const readAuth = (options: { auth: (cb: (data: unknown) => void) => void }) => {
  let data: unknown;
  options.auth((d) => { data = d; });
  return data;
};

vi.mock('socket.io-client', () => ({
  io: (...args: unknown[]) => ioMock(...args),
}));

function createFakeIoSocket() {
  return {
    id: 'mock-socket-id',
    connected: false,
    active: false,
    connect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    disconnect: vi.fn(),
  };
}

describe('getSocket', () => {
  beforeEach(() => {
    vi.resetModules();
    ioMock.mockReset();
    refreshAccessTokenMock.mockReset();
    ioMock.mockImplementation(() => createFakeIoSocket());
    sessionStorage.clear();
    vi.stubEnv('VITE_API_URL', 'http://localhost:5000/api');
    vi.stubEnv('VITE_WS_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates the socket.io client once, deriving the base URL from the API URL', async () => {
    sessionStorage.setItem('token', 'abc123');
    const { getSocket } = await import('../socket');

    const socket = getSocket();

    expect(ioMock).toHaveBeenCalledTimes(1);
    const [url, options] = ioMock.mock.calls[0];
    expect(url).toBe('http://localhost:5000');
    expect(readAuth(options)).toEqual({ token: 'abc123' });
    expect(options.transports).toEqual(['websocket', 'polling']);
    expect(options.autoConnect).toBe(true);
    expect(options.reconnection).toBe(true);
    expect(socket).toBeDefined();
  });

  it('prefers VITE_WS_URL over the derived API URL when set', async () => {
    vi.stubEnv('VITE_WS_URL', 'http://ws.example.com');
    const { getSocket } = await import('../socket');

    getSocket();

    const [url] = ioMock.mock.calls[0];
    expect(url).toBe('http://ws.example.com');
  });

  it('uses an empty token when none is stored in sessionStorage', async () => {
    const { getSocket } = await import('../socket');

    getSocket();

    const [, options] = ioMock.mock.calls[0];
    expect(readAuth(options)).toEqual({ token: '' });
  });

  it('reads the token again on every (re)connection, so it always sends the renewed one', async () => {
    sessionStorage.setItem('token', 'old-token');
    const { getSocket } = await import('../socket');

    getSocket();
    const [, options] = ioMock.mock.calls[0];
    expect(readAuth(options)).toEqual({ token: 'old-token' });

    sessionStorage.setItem('token', 'renewed-token');
    expect(readAuth(options)).toEqual({ token: 'renewed-token' });
  });

  describe('expired token on reconnect', () => {
    const connectErrorHandler = (socket: ReturnType<typeof createFakeIoSocket>) =>
      socket.on.mock.calls.find(([event]) => event === 'connect_error')![1] as (err: Error) => void;

    beforeEach(() => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('renews the access token and reconnects manually when the server rejects the handshake', async () => {
      refreshAccessTokenMock.mockResolvedValue('new-token');
      const { getSocket } = await import('../socket');
      const socket = getSocket() as unknown as ReturnType<typeof createFakeIoSocket>;

      connectErrorHandler(socket)(new Error('Token inválido o expirado'));

      await vi.waitFor(() => expect(socket.connect).toHaveBeenCalledTimes(1));
      expect(refreshAccessTokenMock).toHaveBeenCalledTimes(1);
    });

    it('does not retry more than once in 30 s (no refresh loop when the server keeps rejecting)', async () => {
      refreshAccessTokenMock.mockResolvedValue('new-token');
      const { getSocket } = await import('../socket');
      const socket = getSocket() as unknown as ReturnType<typeof createFakeIoSocket>;
      const onError = connectErrorHandler(socket);

      onError(new Error('Token inválido o expirado'));
      await vi.waitFor(() => expect(socket.connect).toHaveBeenCalledTimes(1));
      onError(new Error('Token inválido o expirado'));
      await Promise.resolve();

      expect(refreshAccessTokenMock).toHaveBeenCalledTimes(1);
    });

    it('ignores connection errors unrelated to the token', async () => {
      const { getSocket } = await import('../socket');
      const socket = getSocket() as unknown as ReturnType<typeof createFakeIoSocket>;

      connectErrorHandler(socket)(new Error('xhr poll error'));

      expect(refreshAccessTokenMock).not.toHaveBeenCalled();
    });

    it('lets socket.io retry by itself while it is still reconnecting (socket.active)', async () => {
      const { getSocket } = await import('../socket');
      const socket = getSocket() as unknown as ReturnType<typeof createFakeIoSocket>;
      socket.active = true;

      connectErrorHandler(socket)(new Error('Token inválido o expirado'));

      expect(refreshAccessTokenMock).not.toHaveBeenCalled();
    });

    it('does not reconnect when the token could not be renewed', async () => {
      refreshAccessTokenMock.mockRejectedValue(new Error('No hay refresh token'));
      const { getSocket } = await import('../socket');
      const socket = getSocket() as unknown as ReturnType<typeof createFakeIoSocket>;

      connectErrorHandler(socket)(new Error('Token inválido o expirado'));
      await vi.waitFor(() => expect(refreshAccessTokenMock).toHaveBeenCalled());
      await Promise.resolve();

      expect(socket.connect).not.toHaveBeenCalled();
    });
  });

  it('reuses the same socket instance on subsequent calls (singleton)', async () => {
    const { getSocket } = await import('../socket');

    const first = getSocket();
    const second = getSocket();

    expect(ioMock).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  it('disconnectSocket disconnects and clears the singleton so the next getSocket call creates a new client', async () => {
    const { getSocket, disconnectSocket } = await import('../socket');

    const first = getSocket();
    disconnectSocket();
    const second = getSocket();

    expect(first.disconnect).toHaveBeenCalledTimes(1);
    expect(ioMock).toHaveBeenCalledTimes(2);
    expect(second).not.toBe(first);
  });
});
