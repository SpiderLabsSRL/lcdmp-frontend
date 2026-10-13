import { io, Socket } from "socket.io-client";
import { refreshAccessToken } from "@/api/api";

const WS_URL =
  import.meta.env.VITE_WS_URL ||
  (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace("/api", "");

let socket: Socket | null = null;
let lastTokenRefreshAt = 0;

/**
 * Devuelve la instancia singleton del socket.
 * Se conecta la primera vez que se llama, reutilizando la conexión en adelante.
 */
export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(WS_URL, {
      // Función (no objeto): se evalúa en CADA conexión/reconexión, así siempre usa el token vigente
      auth: (cb) => cb({ token: sessionStorage.getItem("token") || "" }),
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

      // El servidor rechaza el handshake si el access token (15 min) venció; en ese caso
      // socket.io no reintenta solo: se renueva el token y se reconecta a mano.
      // Máx. un intento cada 30 s: si el servidor sigue rechazando un token recién renovado
      // (p. ej. JWT_SECRET distinto) no se entra en un bucle de refresh.
      if (socket && !socket.active && /Token/i.test(err.message) && Date.now() - lastTokenRefreshAt > 30_000) {
        lastTokenRefreshAt = Date.now();
        refreshAccessToken()
          .then(() => socket?.connect())
          .catch((refreshError) => console.warn("[Socket.IO] No se pudo renovar el token:", refreshError.message));
      }
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
