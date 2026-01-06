"use client";

import { memo, useRef, useEffect, useCallback, useState } from "react";
import { auth, botpressAPI } from "@/lib/auth";
import AIThinking from "./AIThinking";
import { ChatInput } from "./ChatInput";

export interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  createdAt: string;
  userId: string;
  options?: any[];
  payload?: any;
  type?: string;
}

interface MessageListProps {
  /** Conversation ID to load messages for */
  conversationId: string | null;

  /** Conversation user ID */
  conversationUserId: string | null;

  /** Whether initialization is complete */
  initializing: boolean;

  /** Callback when option is selected */
  onOptionSelect?: (value: string) => void;

  /** Selected option value */
  selectedOption: string | null;

  /** Callback when messages are loaded/updated */
  onMessagesChange?: (messages: Message[]) => void;

  /** Callback when message is sent successfully */
  onMessageSent?: () => void;

  /** Callback when error occurs */
  onError?: (error: string) => void;
}

function containsHTML(str: string) {
  return /<[^>]+>/.test(str);
}

function sanitizeHTML(html: string) {
  return html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
}

export const MessageList = memo(function MessageList({
  conversationId,
  conversationUserId,
  initializing,
  onOptionSelect,
  selectedOption,
  onMessagesChange,
  onMessageSent,
  onError,
}: MessageListProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [botTyping, setBotTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const eventSourceRef = useRef<{ close: () => void } | null>(null);
  const botTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSettingUpSSERef = useRef(false);
  const isClosingSSERef = useRef(false);
  const onMessagesChangeRef = useRef(onMessagesChange);

  // Keep refs updated
  useEffect(() => {
    onMessagesChangeRef.current = onMessagesChange;
  }, [onMessagesChange]);

  // Sync messages to parent component (deferred to avoid render-time updates)
  useEffect(() => {
    if (messages.length > 0 || onMessagesChangeRef.current) {
      onMessagesChangeRef.current?.(messages);
    }
  }, [messages]);

  // Load messages when conversationId changes
  useEffect(() => {
    if (!conversationId || initializing) return;

    const loadMessages = async () => {
      const userKey = auth.getUserKey();
      if (!userKey) {
        setError("User key not found. Please login again.");
        return;
      }

      setLoadingMessages(true);
      setError(null);

      try {
        const messagesResponse = await botpressAPI.listMessages(
          userKey,
          conversationId
        );

        const formattedMessages = (messagesResponse.messages || messagesResponse)
          .map((msg: any) => ({
            id: msg.id,
            text: msg.payload?.text || msg.text || "Unknown message",
            sender: msg.isBot ? "bot" : "user",
            createdAt: msg.createdAt || msg.createdOn || msg.timestamp,
            userId: msg.isBot ? msg.botId : msg.userId,
            ...(msg.options ? { options: msg.options } : {}),
            type: msg.payload?.type,
          }));

        const uniqueMessages = formattedMessages.filter(
          (msg: Message, index: number, self: Message[]) =>
            index === self.findIndex((m: Message) => m.id === msg.id)
        );
        uniqueMessages.sort(
          (a: Message, b: Message) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        // If no messages, send start_conversation event
        if (uniqueMessages.length === 0) {
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
                .map(
                  (part) => part.charAt(0).toUpperCase() + part.slice(1)
                )
                .join(" ");
            }
          }

          const welcomePayload = JSON.stringify({
            msg: `My name is ${nameOrEmail}`,
            type: "start_conversation",
          });

          if (conversationId) {
            botpressAPI.sendMessage(userKey, conversationId, welcomePayload);
          }
        }

        setMessages(uniqueMessages);
      } catch (err) {
        console.error("Failed to load messages:", err);
        setError(err instanceof Error ? err.message : "Failed to load messages");
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();
  }, [conversationId, initializing]);

  // Set up SSE listener when conversationId changes
  useEffect(() => {
    if (!conversationId || initializing) return;

    // Prevent multiple simultaneous setups
    if (isSettingUpSSERef.current) return;
    isSettingUpSSERef.current = true;

    const setupSSE = async () => {
      const userKey = auth.getUserKey();
      if (!userKey) {
        isSettingUpSSERef.current = false;
        return;
      }

      // Close existing listener safely
      if (eventSourceRef.current && !isClosingSSERef.current) {
        isClosingSSERef.current = true;
        const oldEventSource = eventSourceRef.current;
        eventSourceRef.current = null;

        // Use setTimeout to defer the close call and prevent synchronous errors
        setTimeout(() => {
          try {
            if (oldEventSource) {
              oldEventSource.close();
            }
          } catch {
            // Silently ignore all errors - AbortError is expected behavior
            // The error is handled internally by the close() method
          } finally {
            isClosingSSERef.current = false;
          }
        }, 0);
      } else {
        isClosingSSERef.current = false;
      }

      try {
        const eventSource = await botpressAPI.listenMessages(
          userKey,
          conversationId,
          (data) => {
            if (data && data.id && data.payload?.text) {
              const newMessage: Message = {
                id: data.id,
                text: data.payload?.text || "Unknown message",
                sender: data.isBot ? "bot" : "user",
                createdAt: data.createdAt || new Date().toISOString(),
                userId: data.isBot ? data.botId : data.userId,
                type: data.payload?.type,
                ...(data?.payload.options ? { options: data?.payload?.options } : {}),
              };

              setMessages((prev) => {
                let filtered = prev;
                if (newMessage.sender === "bot") {
                  filtered = prev.filter((msg) => !msg.id.startsWith("temp-"));
                }
                if (filtered.some((msg) => msg.id === newMessage.id)) return filtered;
                return [...filtered, newMessage];
              });

              if (data.isBot) {
                const upperText = data.payload?.text?.toUpperCase() || "";
                const isBotCheckingData =
                  upperText.includes("LET ME CHECK") ||
                  upperText.includes("LET ME PROVIDE");
                if (!isBotCheckingData) {
                  if (botTypingTimeoutRef.current) {
                    clearTimeout(botTypingTimeoutRef.current);
                    botTypingTimeoutRef.current = null;
                  }
                  setBotTyping(false);
                }
              }
            }
          }
        );

        eventSourceRef.current = eventSource;
        isSettingUpSSERef.current = false;
      } catch (err) {
        console.error('Failed to setup SSE:', err);
        isSettingUpSSERef.current = false;
      }
    };

    setupSSE();

    return () => {
      isSettingUpSSERef.current = false;
      if (eventSourceRef.current && !isClosingSSERef.current) {
        isClosingSSERef.current = true;
        const eventSource = eventSourceRef.current;
        eventSourceRef.current = null;

        // Use setTimeout to defer close and prevent synchronous errors
        setTimeout(() => {
          try {
            eventSource.close();
          } catch {
            // Silently ignore - AbortError is expected behavior
          } finally {
            isClosingSSERef.current = false;
          }
        }, 0);
      }
    };
  }, [conversationId, initializing]);

  // Bot typing timeout
  useEffect(() => {
    if (botTyping) {
      if (botTypingTimeoutRef.current) {
        clearTimeout(botTypingTimeoutRef.current);
      }
      botTypingTimeoutRef.current = setTimeout(() => {
        setBotTyping(false);
      }, 30000);
    } else {
      if (botTypingTimeoutRef.current) {
        clearTimeout(botTypingTimeoutRef.current);
        botTypingTimeoutRef.current = null;
      }
    }

    return () => {
      if (botTypingTimeoutRef.current) {
        clearTimeout(botTypingTimeoutRef.current);
      }
    };
  }, [botTyping]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        try {
          eventSourceRef.current.close();
        } catch { }
      }
      if (botTypingTimeoutRef.current) {
        clearTimeout(botTypingTimeoutRef.current);
      }
    };
  }, []);

  // Handle option selection
  const handleOptionSelect = useCallback(
    async (value: string) => {
      if (!conversationId) return;

      const userKey = auth.getUserKey();
      if (!userKey) return;

      onOptionSelect?.(value);
      setBotTyping(true);

      try {
        await botpressAPI.sendMessage(userKey, conversationId, value);
      } catch (err) {
        console.error("Failed to send option:", err);
        setBotTyping(false);
      }
    },
    [conversationId, onOptionSelect]
  );

  // Handle message sent - trigger scroll
  const handleMessageSent = useCallback(() => {
    // Force scroll to bottom when message is sent
    setTimeout(() => {
      if (messagesContainerRef.current && messagesEndRef.current) {
        const container = messagesContainerRef.current;
        container.scrollTop = container.scrollHeight;
        requestAnimationFrame(() => {
          if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
          }
        });
      }
    }, 100);
    onMessageSent?.();
  }, [onMessageSent]);

  // Handle input error
  const handleInputError = useCallback((errorMsg: string) => {
    setError(errorMsg);
    onError?.(errorMsg);
  }, [onError]);

  // Auto scroll to bottom
  useEffect(() => {
    if (
      !initializing &&
      messages.length > 0 &&
      messagesEndRef.current &&
      messagesContainerRef.current
    ) {
      const container = messagesContainerRef.current;
      const endEl = messagesEndRef.current;

      try {
        const containerRect = container.getBoundingClientRect();
        const endRect = endEl.getBoundingClientRect();
        const isOverflowing = container.scrollHeight > container.clientHeight + 8;
        const endOutOfView = endRect.bottom > containerRect.bottom - 8;

        if (isOverflowing || endOutOfView) {
          endEl.scrollIntoView({ behavior: "smooth", block: "end" });
        }
      } catch {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [initializing, messages]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages container - scrollable */}
      <div
        ref={messagesContainerRef}
        className="flex-1 p-4 overflow-y-auto relative min-h-0"
      >
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((msg, index) => {
            const isCurrentUser =
              msg.sender === "user" && msg.userId === conversationUserId;
            const isChoiceType = msg?.options && msg?.type === "choice";
            const showOptions =
              msg?.options && Array.isArray(msg?.options) && msg?.options.length > 0;

            let parsedMsg: any = null;
            if (typeof msg.text === "string") {
              const t = msg.text.trim();
              const looksLikeJson =
                (t.startsWith("{") && t.endsWith("}")) ||
                (t.startsWith("[") && t.endsWith("]"));
              if (looksLikeJson) {
                try {
                  parsedMsg = JSON.parse(t);
                } catch {
                  parsedMsg = null;
                }
              }
            }

            // Skip start_conversation trigger messages (only user-sent ones, not bot responses)
            if (
              isCurrentUser &&
              parsedMsg &&
              typeof parsedMsg === "object" &&
              parsedMsg?.type === "start_conversation"
            ) {
              return null;
            }

            return (
              <div
                key={`${msg.id}-${index}`}
                className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`px-6 py-3 rounded-2xl max-w-md shadow-lg ${isCurrentUser
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                    : "bg-white/70 backdrop-blur-sm text-gray-800 border border-white/20"
                    }`}
                >
                  {isChoiceType && showOptions ? (
                    <>
                      {containsHTML(msg.text) ? (
                        <div
                          className="text-sm mb-2"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeHTML(msg.text),
                          }}
                        />
                      ) : (
                        <span className="text-sm mb-2 whitespace-pre-line block">
                          {msg.text}
                        </span>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {(msg?.options ?? []).map((opt: any, i: number) => (
                          <button
                            key={opt.value || i}
                            type="button"
                            className="px-4 py-1 bg-gradient-to-r from-blue-400 to-purple-400 text-white rounded-md hover:from-blue-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                            onClick={() => handleOptionSelect(opt.value)}
                            disabled={!!selectedOption}
                          >
                            {opt.label || opt.value}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : showOptions ? (
                    <>
                      {containsHTML(msg.text) ? (
                        <div
                          className="text-sm mb-2"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeHTML(msg.text),
                          }}
                        />
                      ) : (
                        <span className="text-sm mb-2 whitespace-pre-line block">
                          {msg.text}
                        </span>
                      )}
                      <form
                        className="mt-2 space-y-2"
                        onSubmit={(e) => e.preventDefault()}
                      >
                        {(msg?.options ?? []).map((opt: any, i: number) => (
                          <label
                            key={opt.value || i}
                            className="flex items-center space-x-2 cursor-pointer"
                          >
                            <input
                              type="radio"
                              name={`options-${msg.id}`}
                              value={opt.value}
                              checked={selectedOption === opt.value}
                              disabled={!!selectedOption}
                              onChange={() => handleOptionSelect(opt.value)}
                              className="form-radio text-blue-600 focus:ring-blue-500"
                            />
                            <span>{opt.label || opt.value}</span>
                          </label>
                        ))}
                      </form>
                    </>
                  ) : containsHTML(msg.text) ? (
                    <div
                      className="text-sm"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHTML(msg.text),
                      }}
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-line">{msg.text}</p>
                  )}
                  <p
                    className={`text-xs mt-1 ${isCurrentUser ? "text-blue-100" : "text-gray-500"
                      }`}
                  >
                    {new Date(msg.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Show loading indicator when fetching messages */}
          {loadingMessages && (
            <div className="flex justify-center py-4">
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400" />
                Loading messages...
              </div>
            </div>
          )}

          {/* Only show AIThinking when bot is actually typing (not loading messages) */}
          {botTyping && !loadingMessages && <AIThinking />}

          {error && (
            <div className="text-center p-4 bg-red-100/80 backdrop-blur-sm rounded-xl border border-red-200/50">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ChatInput - fixed at bottom */}
      <ChatInput
        conversationId={conversationId}
        onMessageSent={handleMessageSent}
        onError={handleInputError}
        onBotTypingChange={setBotTyping}
        disabled={!conversationId || initializing}
      />
    </div>
  );
});

