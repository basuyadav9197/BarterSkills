import mongoose, { Schema } from "mongoose";

const conversationSchema = new Schema(
    {
        participants: [
            {
                type: Schema.Types.ObjectId,
                ref: "User",
                required: true
            }
        ],
        messages: [
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
                },
                read: {
                    type: Boolean,
                    default: false
                },
                createdAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ]
    },
    {
        timestamps: true
    }
);

export const Conversation = mongoose.model("Conversation", conversationSchema);
