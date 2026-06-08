import axios from "axios";

function resolveApiBaseUrl() {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  return "/backend";
}

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  headers: { "Content-Type": "application/json" },
  // Prevent slow backend responses from blocking the UI indefinitely
  timeout: 15000,
});

// Track active requests to manage loading state
let activeRequests = 0;
let loadingCallbacks: { start: () => void; stop: () => void } | null = null;

// Function to register loading callbacks (called from LoadingContext)
export function registerLoadingCallbacks(start: () => void, stop: () => void) {
  loadingCallbacks = { start, stop };
}

api.interceptors.request.use((config) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Show loading indicator when request starts
  if (loadingCallbacks && typeof window !== "undefined") {
    activeRequests++;
    if (activeRequests === 1) {
      loadingCallbacks.start();
    }
  }
  
  return config;
});

// Add response interceptor to hide loading
api.interceptors.response.use(
  (response) => {
    // Hide loading indicator when request completes successfully
    if (loadingCallbacks && typeof window !== "undefined") {
      activeRequests = Math.max(0, activeRequests - 1);
      if (activeRequests === 0) {
        loadingCallbacks.stop();
      }
    }
    return response;
  },
  (error) => {
    // Hide loading indicator when request fails
    if (loadingCallbacks && typeof window !== "undefined") {
      activeRequests = Math.max(0, activeRequests - 1);
      if (activeRequests === 0) {
        loadingCallbacks.stop();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
