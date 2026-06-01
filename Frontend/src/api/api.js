import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
};

export const clearAuthToken = () => {
  delete api.defaults.headers.common["Authorization"];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const storedRT = localStorage.getItem("refreshToken");
        if (!storedRT) {
          throw new Error("No refresh token available");
        }

        const { data } = await axios.post(
          `${import.meta.env.VITE_API_URL}/users/refresh-token`,
          { refreshToken: storedRT },
          { withCredentials: true }
        );

        const newAccess = data.data.accessToken;
        setAuthToken(newAccess);
        originalRequest.headers["Authorization"] = `Bearer ${newAccess}`;
        return api(originalRequest);
      } catch (refreshErr) {
        localStorage.removeItem("refreshToken");
        clearAuthToken();
        window.location.href = "/login";
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

export const toggleSubscribe = (channelId) =>
  api.post(`/subscriptions/c/${channelId}`);

export const getChannelProfile = (username) =>
  api.get(`/users/c/${username}`);

