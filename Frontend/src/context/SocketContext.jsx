import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import useAuth from "../auth/useAuth.js";

const SocketContext = createContext(null);
export const useSocket = () => useContext(SocketContext);

const defaultSocketUrl = (() => {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) {
    return apiUrl.replace(/\/api\/v1\/?$/, "");
  }

  return "http://localhost:5000";
})();

export function SocketProvider({ children }) {
  const { accessToken } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!accessToken) return; 
    const s = io(import.meta.env.VITE_SOCKET_URL || defaultSocketUrl, {
      auth: { token: accessToken },
    });
    s.on("connect", () => console.log("🔗 Socket connected", s.id));
    s.on("connect_error", (err) =>
      console.error("Socket failed:", err.message)
    );
    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [accessToken]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}
