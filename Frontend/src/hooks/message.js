import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchConversation,
  fetchConversations,
  postMessage,
  createConversation,
} from "../api/message.js";

export function useConversation(conversationId) {
  return useQuery({
    queryKey: ["conversation", conversationId],
    enabled: !!conversationId,
    queryFn: () => fetchConversation(conversationId),
  });
}

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: fetchConversations,
  });
}

export function useSendMessage(conversationId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text) => postMessage(conversationId, text),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversation", conversationId] }),
  });
}

export function useCreateConversation() {
  return useMutation({
    mutationFn: (otherUserId) => createConversation(otherUserId),
  });
}
