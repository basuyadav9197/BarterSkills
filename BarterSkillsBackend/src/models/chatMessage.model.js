import mongoose, { Schema } from "mongoose";

const chatMessageSchema = new Schema(
    {
        sender: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        text: {
            type: String,
            required: true,
            trim: true
        }
    },
    {
        timestamps: true
    }
);

export const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);
