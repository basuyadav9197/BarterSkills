import React from "react";
import useAuth from "../auth/useAuth.js";
import { useNavigate } from "react-router-dom";
import {
  Typography,
  Container,
  Paper,
  Button,
  Stack,
} from "@mui/material";
import ConversationList from "../components/ConversationList.jsx";

export default function ConversationListPage() {
  const auth = useAuth();
  const navigate = useNavigate();
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
    <Container sx={{ mt: 10 }}>
      <Typography variant="h4" gutterBottom>
        Direct Messages
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={1.5}>
          <ConversationList onSelect={(id) => navigate(`/conversations/${id}`)} />
        </Stack>
      </Paper>
    </Container>
  );
}
