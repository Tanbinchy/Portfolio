import axios from "axios";

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "/api",
  timeout: 10000,
});

const PUBLIC_CACHE_PREFIX = "portfolio-public-cache:";
const inFlightPublicRequests = new Map();

const canUseLocalStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export const getCachedPublicData = (path) => {
  if (!canUseLocalStorage()) return null;

  try {
    const cached = window.localStorage.getItem(`${PUBLIC_CACHE_PREFIX}${path}`);
    return cached ? JSON.parse(cached).data : null;
  } catch {
    return null;
  }
};

const setCachedPublicData = (path, data) => {
  if (!canUseLocalStorage()) return;

  try {
    window.localStorage.setItem(
      `${PUBLIC_CACHE_PREFIX}${path}`,
      JSON.stringify({ data, savedAt: Date.now() }),
    );
  } catch {
    // Cache is a UX optimization only; ignore quota/private-mode failures.
  }
};

export const getPublicData = async (path, { onCached, onFresh } = {}) => {
  const cached = getCachedPublicData(path);
  if (cached !== null) onCached?.(cached);

  if (!inFlightPublicRequests.has(path)) {
    inFlightPublicRequests.set(
      path,
      API.get(path)
        .then(({ data }) => {
          setCachedPublicData(path, data);
          return data;
        })
        .finally(() => {
          inFlightPublicRequests.delete(path);
        }),
    );
  }

  const fresh = await inFlightPublicRequests.get(path);
  onFresh?.(fresh);
  return fresh;
};

// Attach JWT token to every request
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("adminToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Handle 401 globally
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("adminToken");
      if (
        window.location.pathname.startsWith("/admin") &&
        window.location.pathname !== "/admin/login"
      ) {
        window.location.href = "/admin/login";
      }
    }
    return Promise.reject(error);
  },
);

export default API;
