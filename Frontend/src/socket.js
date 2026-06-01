import { io } from "socket.io-client";

const defaultSocketUrl = (() => {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    return apiUrl.replace(/\/api\/v1\/?$/, "");
  }

  return "http://localhost:5000";
})();

const socket = io(import.meta.env.VITE_SOCKET_URL || defaultSocketUrl, {
  withCredentials: true,
  autoConnect: false,
});

export default socket;
