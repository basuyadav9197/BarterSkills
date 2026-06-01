import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });


import connectDB from "./db/index.js";
import { app } from "./app.js";

import { createServer } from "http";
import { Server as IOServer } from "socket.io";
import jwt from "jsonwebtoken";
import { User } from "./models/user.model.js";
import { Conversation } from "./models/conversation.model.js";
import { ChatMessage } from "./models/chatMessage.model.js";

const httpServer = createServer(app);

const io = new IOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true,
  },
});


io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) throw new Error("No auth token");

    const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(payload._id).select("-password -refreshToken");
    if (!user) throw new Error("Invalid token");
    socket.user = user;
    next();
  } catch (err) {
    console.error("Socket auth error:", err.message);
    next(new Error("Authentication error"));
  }
});

io.on("connection", (socket) => {
  console.log(`🔗 User connected: ${socket.user.username}`);

  socket.join(`user:${socket.user._id}`);
  socket.join("global");

  const canAccessConversation = async (conversationId) => {
    const convo = await Conversation.findOne({
      _id: conversationId,
      participants: socket.user._id,
    });

    if (!convo) {
      throw new Error("Conversation not found or access denied");
    }

    return convo;
  };

  socket.on("dm:join", async ({ conversationId }) => {
    try {
      await canAccessConversation(conversationId);
      socket.join(`conversation:${conversationId}`);
      socket.emit("dm:joined", { conversationId });
    } catch (err) {
      socket.emit("dm:error", { message: err.message });
    }
  });

  socket.on("dm:leave", ({ conversationId }) => {
    socket.leave(`conversation:${conversationId}`);
  });

  socket.on("dm:message", async ({ conversationId, text }) => {
    try {
      if (!text?.trim()) {
        throw new Error("Message text is required");
      }

      await canAccessConversation(conversationId);

      const convo = await Conversation.findByIdAndUpdate(
        conversationId,
        { $push: { messages: { sender: socket.user._id, text: text.trim() } } },
        { new: true }
      )
        .populate("messages.sender", "fullName avatar username")
        .lean();

      if (!convo) {
        throw new Error("Conversation not found");
      }

      const message = convo.messages[convo.messages.length - 1];
      const payload = {
        conversationId,
        message,
      };

      io.to(`conversation:${conversationId}`).emit("dm:message", payload);
      convo.participants.forEach((participantId) => {
        io.to(`user:${participantId}`).emit("dm:conversation-updated", {
          conversationId,
        });
      });
    } catch (err) {
      socket.emit("dm:error", { message: err.message });
    }
  });

  socket.on("message", async(text) => {
    const msg = {
      user: {
        _id: socket.user._id,
        username: socket.user.username,
        fullName: socket.user.fullName,
        avatar: socket.user.avatar,
      },
      text,
      createdAt: new Date(),
    };
    io.to("global").emit("message", msg);
    try {
      await ChatMessage.create({
        sender: socket.user._id,
        text,
      });
    } catch (err) {
      console.error("Failed to save chat message:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.user.username}`);
  });
});

connectDB()
  .then(() => {
    const port = process.env.PORT || 8000;
    httpServer.listen(port, () => {
      console.log(`⚙️ Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("MONGO db connection failed:", err);
  });


import fs from "fs";
import { exec } from "child_process";

// Whisper model auto-downloader
const modelDir = path.resolve(__dirname, "../models");
const modelPath = path.join(modelDir, "ggml-small.en.bin");
const modelURL = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin";

function downloadWhisperModel() {
  if (!fs.existsSync(modelPath)) {
    console.log("🎯 Whisper model not found. Downloading...");
    fs.mkdirSync(modelDir, { recursive: true });

    exec(`curl -L -o "${modelPath}" "${modelURL}"`, (err, stdout, stderr) => {
      if (err) {
        console.error("❌ Whisper model download failed:", err.message);
      } else {
        console.log("✅ Whisper model downloaded successfully!");
      }
    });
  } else {
    console.log("📦 Whisper model already present. Skipping download.");
  }
}

downloadWhisperModel();
