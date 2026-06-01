import React from "react";
import { useParams } from "react-router-dom";
import useAuth from "../auth/useAuth.js";
import ChatBox from "../components/ChatBox.jsx";
import {
  Container,
  Typography,
} from "@mui/material";

export default function ConversationPage() {
  const { convId } = useParams();
  const auth = useAuth();
  const user = auth?.user;
  if (auth?.loadingAuth) return <Typography>Loading…</Typography>;
  const now = Date.now();
  const isUserPremium = user?.isPremium && new Date(user?.premiumExpiresAt) > now;
  if (!isUserPremium) {
    return (
      <Container sx={{ mt: 10 }}>
        <Typography variant="h6">Direct messages are available for premium users only.</Typography>
        <Typography sx={{ mt: 2 }}>Use <a href="/messages">Global Chat</a> to communicate.</Typography>
      </Container>
    );
  }
  return (
    <Container sx={{ mt: 8 }}>
      <Typography variant="h4" gutterBottom>
        Direct Messages
      </Typography>
      <ChatBox conversationId={convId} />
    </Container>
  );
}
