import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ioMock = vi.fn();

vi.mock('socket.io-client', () => ({
  io: (...args: unknown[]) => ioMock(...args),
}));

function createFakeIoSocket() {
  return {
    id: 'mock-socket-id',
    connected: false,
    on: vi.fn(),
    off: vi.fn(),
    disconnect: vi.fn(),
  };
}

describe('getSocket', () => {
  beforeEach(() => {
    vi.resetModules();
    ioMock.mockReset();
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
    expect(options.auth).toEqual({ token: 'abc123' });
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
    expect(options.auth).toEqual({ token: '' });
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
