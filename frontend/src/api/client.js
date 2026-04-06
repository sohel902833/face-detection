import axios from "axios";

// In production Docker: nginx proxies /api/* → backend:3000/*
// In dev (vite proxy): same /api path
const API_BASE = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// Attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("fa_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const requestUrl = err.config.url;
    const isLoginUrl = requestUrl.includes("/auth/login");
    const isAttendanceMarkUrl = requestUrl.includes("/attendance/mark");
    if (!isLoginUrl && !isAttendanceMarkUrl && err.response?.status === 401) {
      localStorage.removeItem("fa_token");
      localStorage.removeItem("fa_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);

export const authApi = {
  register: (formData) => api.post("/auth/register", formData),
  login: (formData) => api.post("/auth/login", formData),
  profile: () => api.get("/auth/profile"),
};

export const attendanceApi = {
  mark: (formData) => api.post("/attendance/mark", formData),
  getMy: (page = 1, limit = 20) =>
    api.get(`/attendance/my?page=${page}&limit=${limit}`),
  getAll: (page = 1, limit = 30, date) =>
    api.get(
      `/attendance/all?page=${page}&limit=${limit}${date ? `&date=${date}` : ""}`,
    ),
  getStats: () => api.get("/attendance/stats"),
};

export default api;
