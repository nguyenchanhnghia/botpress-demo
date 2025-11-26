"use client";

import { useEffect, useRef, useState } from "react";
import { auth, botpressAPI } from "@/lib/auth";

export interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "bot";
  createdAt: string;
  userId: string;
  options?: any[];
  payload?: any;
  type?: string;
}

export interface ChatConversation {
  id: string;
  userId: string;
}

export function useChat() {
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [botTyping, setBotTyping] = useState(false);

  const eventSourceRef = useRef<{ close: () => void } | null>(null);
  const botTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (botTypingTimeoutRef.current) clearTimeout(botTypingTimeoutRef.current);
    };
  }, []);

  const initializeChat = async (clearCache?: boolean) => {
    try {
      setInitializing(true);
      setError(null);

      if (clearCache) auth.clearConversation();

      const userKey = auth.getUserKey();
      if (!userKey) throw new Error("User key not found. Please login again.");

      // 1) user
      const userResponse = await botpressAPI.getOrCreateUser(userKey);

      // 2) conversation
      let conversationData: any = null;
      const cached = auth.getCachedConversation();
      if (cached) {
        try {
          await botpressAPI.validateConversation(userKey, cached.id);
          conversationData = cached;
        } catch {
          auth.clearConversation();
        }
      }

      if (!conversationData) {
        const conversationResponse = await botpressAPI.getOrCreateConversation(userKey);
        conversationData = conversationResponse.conversation || conversationResponse;
        auth.saveConversation({
          id: conversationData.id,
          userId: conversationData.userId || userResponse.user?.id,
        });
      }

      if (!isMountedRef.current) return;

      setConversation({
        id: conversationData.id,
        userId: conversationData.userId || userResponse.user?.id,
      });

      // 3) messages
      const messagesResponse = await botpressAPI.listMessages(userKey, conversationData.id);

      if (!isMountedRef.current) return;

      const formatted: ChatMessage[] = (messagesResponse.messages || messagesResponse).map(
        (msg: any) => ({
          id: msg.id,
          text: msg.payload?.text || msg.text || "Unknown message",
          sender: msg.isBot ? "bot" : "user",
          createdAt: msg.createdAt || msg.createdOn || msg.timestamp,
          userId: msg.isBot ? msg.botId : msg.userId,
          ...(msg.options ? { options: msg.options } : {}),
          type: msg.payload?.type,
        })
      );

      const unique = formatted.filter(
        (m, idx, arr) => idx === arr.findIndex((x) => x.id === m.id)
      );
      unique.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      // 4) nếu chưa có message -> gửi start_conversation
      if (unique.length === 0) {
        setBotTyping(true);
        const currentUser = auth.getCurrentUser();
        let nameOrEmail = "colleague";

        if (currentUser) {
          if (currentUser.displayName) {
            nameOrEmail = currentUser.displayName;
          } else if (currentUser.email) {
            const local = currentUser.email.split("@")[0] || currentUser.email;
            nameOrEmail = local
              .replace(/[._]+/g, " ")
              .split(" ")
              .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
              .join(" ");
          }
        }

        const payload = JSON.stringify({
          msg: `My name is ${nameOrEmail}`,
          type: "start_conversation",
        });

        if (conversationData?.id) {
          botpressAPI.sendMessage(userKey, conversationData.id, payload);
        }
      }

      setMessages(unique);

      // 5) SSE listen
      if (eventSourceRef.current) {
        try { eventSourceRef.current.close(); } catch { }
        eventSourceRef.current = null;
      }

      const es = await botpressAPI.listenMessages(
        userKey,
        conversationData.id,
        (data) => {
          if (!data || !data.id || !data.payload?.text) return;

          const incoming: ChatMessage = {
            id: data.id,
            text: data.payload?.text || "Unknown message",
            sender: data.isBot ? "bot" : "user",
            createdAt: data.createdAt || new Date().toISOString(),
            userId: data.isBot ? data.botId : data.userId,
            type: data.payload?.type,
            ...(data?.payload.options ? { options: data?.payload.options } : {}),
          };

          setMessages((prev) => {
            let filtered = prev;
            if (incoming.sender === "bot") {
              filtered = prev.filter((m) => !m.id.startsWith("temp-"));
            }
            if (filtered.some((m) => m.id === incoming.id)) return filtered;
            return [...filtered, incoming];
          });

          if (data.isBot) {
            const upper = data.payload?.text?.toUpperCase() || "";
            const isChecking =
              upper.includes("LET ME CHECK") || upper.includes("LET ME PROVIDE");
            if (!isChecking) {
              if (botTypingTimeoutRef.current) {
                clearTimeout(botTypingTimeoutRef.current);
                botTypingTimeoutRef.current = null;
              }
              setBotTyping(false);
            }
          }
        }
      );

      if (!isMountedRef.current) {
        es.close();
        return;
      }

      eventSourceRef.current = es;
    } catch (err: any) {
      console.error("Initialization error:", err);
      if (isMountedRef.current) {
        setError(err?.message || "Failed to initialize chat");
      }
    } finally {
      if (isMountedRef.current) setInitializing(false);
    }
  };

  const sendMessage = async (text: string) => {
    if (!conversation) return;
    const userKey = auth.getUserKey();
    if (!userKey) throw new Error("User key not found. Please login again.");

    setBotTyping(true);
    await botpressAPI.sendMessage(userKey, conversation.id, text);
  };

  const handleLogout = async () => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    await fetch("/api/auth/logout", { method: "POST" });
    auth.logout();
  };

  return {
    conversation,
    messages,
    initializing,
    botTyping,
    error,
    initializeChat,
    sendMessage,
    handleLogout,
    setError,
    setMessages,
    setBotTyping,
  };
}