import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchConversations } from "../api/message.js";
import useAuth from "../auth/useAuth.js";
import { useSocket } from "../context/SocketContext.jsx";
import { useEffect } from "react";
import {
  List,
  ListItemButton,
  ListItemAvatar,
  Avatar,
  ListItemText,
  Badge,
  Typography,
} from "@mui/material";

export default function ConversationList({ onSelect }) {
  const { user } = useAuth();
  const socket = useSocket();
  const queryClient = useQueryClient();
  const { data: convos = [], isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: fetchConversations,
  });

  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    };

    socket.on("dm:conversation-updated", handleUpdate);
    return () => {
      socket.off("dm:conversation-updated", handleUpdate);
    };
  }, [socket, queryClient]);

  if (isLoading) return <Typography>Loading conversations…</Typography>;
  if (!convos.length) {
    return <Typography sx={{ mt: 2 }}>You have no direct messages yet.</Typography>;
  }

  return (
    <List>
      {convos.map((c) => (
        <ListItemButton key={c._id} onClick={() => onSelect?.(c._id)}>
          <ListItemAvatar>
            <Badge badgeContent={c.unreadCount} color="primary">
              <Avatar src={c.participants.find((p) => String(p._id) !== String(user?._id))?.avatar} />
            </Badge>
          </ListItemAvatar>
          <ListItemText
            primary={c.participants.find((p) => String(p._id) !== String(user?._id))?.fullName || "Unknown user"}
            secondary={c.lastMessage?.text || "No messages yet"}
          />
        </ListItemButton>
      ))}
    </List>
  );
}
