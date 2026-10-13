import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json"
  },
});

const clearSession = () => {
  localStorage.removeItem('bakery_user');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('refreshToken');
};

let refreshPromise: Promise<string> | null = null;

export const refreshAccessToken = (): Promise<string> => {
  const refreshToken = sessionStorage.getItem('refreshToken');
  if (!refreshToken) {
    return Promise.reject(new Error('No hay refresh token'));
  }

  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_URL}/auth/refresh`, { refreshToken }, { withCredentials: true })
      .then((response) => {
        const token = response.data.data.token as string;
        sessionStorage.setItem('token', token);
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

api.interceptors.request.use((config) => {
  const requiresAuth = config.headers?.requiresAuth !== false;

  if (requiresAuth) {
    const token = sessionStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } else {
    (config as any).skipAuthRefresh = true;
  }

  delete config.headers.requiresAuth;

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.skipAuthRefresh &&
      sessionStorage.getItem('refreshToken')
    ) {
      original._retry = true;

      try {
        const token = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch (refreshError: any) {
        const status = refreshError.response?.status;
        if (status === 400 || status === 401) {
          clearSession();
          window.location.href = "/login";
          return Promise.reject(error);
        }
        return Promise.reject(refreshError);
      }
    }

    if (error.response?.status === 401) {
      if(error.response?.data?.message !== "Usuario no encontrado o inactivo"){
        clearSession();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
