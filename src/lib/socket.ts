import { io, Socket } from "socket.io-client";

const WS_URL =
  import.meta.env.VITE_WS_URL ||
  (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace("/api", "");

let socket: Socket | null = null;

/**
 * Devuelve la instancia singleton del socket.
 * Se conecta la primera vez que se llama, reutilizando la conexión en adelante.
 */
export const getSocket = (): Socket => {
  if (!socket) {
    const token = sessionStorage.getItem("token") || "";

    socket = io(WS_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on("connect", () => {
      console.log("[Socket.IO] Conectado:", socket?.id);
    });

    socket.on("connect_error", (err) => {
      console.warn("[Socket.IO] Error de conexión:", err.message);
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket.IO] Desconectado:", reason);
    });
  }

  return socket;
};

/**
 * Desconecta el socket y limpia la instancia (útil en logout).
 */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export default getSocket;
