import { useEffect, useRef, useState } from "react";
import { Avatar, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import useAuth from "../auth/useAuth.js";
import { useConversation } from "../hooks/message";
import { useSocket } from "../context/SocketContext.jsx";

export default function ChatBox({ conversationId }) {
  const { user } = useAuth();
  const socket = useSocket();
  const { data, isLoading } = useConversation(conversationId);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const scrollRef = useRef();

  useEffect(() => {
    setMessages(data ?? []);
  }, [data, conversationId]);

  useEffect(() => {
    if (!socket || !conversationId) return;

    socket.emit("dm:join", { conversationId });

    const handleMessage = ({ conversationId: roomId, message }) => {
      if (String(roomId) !== String(conversationId)) return;
      setMessages((prev) => [...prev, message]);
    };

    socket.on("dm:message", handleMessage);

    return () => {
      socket.off("dm:message", handleMessage);
      socket.emit("dm:leave", { conversationId });
    };
  }, [socket, conversationId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (isLoading) return <Typography>Loading chat…</Typography>;

  const sendMessage = () => {
    if (!text.trim() || !socket || !conversationId) return;
    socket.emit("dm:message", {
      conversationId,
      text: text.trim(),
    });
    setText("");
  };

  return (
    <Box>
      <Stack spacing={1.5} sx={{ mb: 2, maxHeight: 480, overflowY: "auto", pr: 1 }}>
        {messages.map((msg) => {
          const mine = String(msg.sender?._id || msg.sender) === String(user?._id);
          return (
            <Stack key={msg._id || msg.createdAt} direction="row" spacing={1} justifyContent={mine ? "flex-end" : "flex-start"}>
              {!mine && <Avatar src={msg.sender?.avatar} sx={{ width: 32, height: 32 }} />}
              <Paper sx={{ p: 1.25, maxWidth: "75%" }}>
                <Typography variant="subtitle2">{mine ? "You" : msg.sender?.fullName || "Member"}</Typography>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{msg.text}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Typography>
              </Paper>
              {mine && <Avatar src={user?.avatar} sx={{ width: 32, height: 32 }} />}
            </Stack>
          );
        })}
        <div ref={scrollRef} />
      </Stack>

      <Stack component="form" direction="row" spacing={2} onSubmit={(e) => { e.preventDefault(); sendMessage(); }}>
        <TextField fullWidth value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" />
        <Button type="submit" variant="contained" disabled={!socket || !text.trim()}>Send</Button>
      </Stack>
    </Box>
  );
}
