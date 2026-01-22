"use client";

import { memo, useRef, useEffect, useCallback, useState } from "react";
import Image from "next/image";
import { auth, botpressAPI } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { getPublicRuntimeConfig } from "@/lib/runtime-config/public";
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

// Extract markdown image patterns: ![alt text](botpress/path.jpg)
interface ImageReference {
  fullMatch: string;
  altText: string;
  imageKey: string;
  startIndex: number;
  endIndex: number;
}

function extractImageReferences(text: string): ImageReference[] {
  const pattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const matches: ImageReference[] = [];
  let match;

  while ((match = pattern.exec(text)) !== null) {
    matches.push({
      fullMatch: match[0],
      altText: match[1] || "",
      imageKey: match[2],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return matches;
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
  const [showRefreshPopup, setShowRefreshPopup] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({}); // Cache presigned URLs by key
  const [previewImage, setPreviewImage] = useState<{ url: string; alt: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
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

  // Get presigned URL for an image key
  const getPresignedUrl = useCallback(async (key: string): Promise<string | null> => {
    // Check cache first
    if (imageUrls[key]) {
      return imageUrls[key];
    }

    try {
      const response = await apiRequest<{
        success: boolean;
        url: string;
        key: string;
      }>('/api/admin/images/presigned-url', {
        method: 'POST',
        body: { key },
        withAuth: true,
      });

      // Cache the presigned URL
      if (response.url) {
        setImageUrls((prev) => ({ ...prev, [key]: response.url }));
        return response.url;
      }
      return null;
    } catch (err: any) {
      console.error('Failed to get presigned URL:', err);
      return null;
    }
  }, [imageUrls]);


  // Handle image preview
  const handleImagePreview = useCallback(async (imageKey: string, altText: string) => {
    setPreviewLoading(true);
    const url = await getPresignedUrl(imageKey);
    if (url) {
      setPreviewImage({ url, alt: altText || imageKey });
    } else {
      setError('Failed to load image preview');
    }
    setPreviewLoading(false);
  }, [getPresignedUrl]);

  // Render message text with image thumbnails
  const renderMessageWithImages = useCallback((text: string) => {
    const imageRefs = extractImageReferences(text);

    if (imageRefs.length === 0) {
      // No images, render normally
      if (containsHTML(text)) {
        return (
          <div
            className="text-sm"
            dangerouslySetInnerHTML={{
              __html: sanitizeHTML(text),
            }}
          />
        );
      }
      return <p className="text-sm whitespace-pre-line">{text}</p>;
    }

    // Split text into parts (text segments and image references)
    const parts: Array<{ type: 'text' | 'image'; content: string; imageRef?: ImageReference }> = [];
    let lastIndex = 0;

    imageRefs.forEach((ref) => {
      // Add text before image
      if (ref.startIndex > lastIndex) {
        parts.push({
          type: 'text',
          content: text.substring(lastIndex, ref.startIndex),
        });
      }
      // Add image reference
      parts.push({
        type: 'image',
        content: ref.imageKey,
        imageRef: ref,
      });
      lastIndex = ref.endIndex;
    });

    // Add remaining text after last image
    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex),
      });
    }

    return (
      <div className="text-sm">
        {parts.map((part, idx) => {
          if (part.type === 'text') {
            if (containsHTML(part.content)) {
              return (
                <div
                  key={idx}
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHTML(part.content),
                  }}
                />
              );
            }
            return (
              <span key={idx} className="whitespace-pre-line">
                {part.content}
              </span>
            );
          } else {
            // Render image thumbnail
            const imageKey = part.content;
            const imageUrl = imageUrls[imageKey];
            const altText = part.imageRef?.altText || imageKey;

            return (
              <div key={idx} className="my-2 inline-block">
                <div className="relative group">
                  {imageUrl ? (
                    <>
                      <Image
                        src={imageUrl}
                        alt={altText}
                        width={200}
                        height={150}
                        className="rounded-lg border border-gray-200 max-w-[200px] h-auto cursor-pointer hover:opacity-80 transition-opacity"
                        unoptimized={true}
                        onClick={() => handleImagePreview(imageKey, altText)}
                      />
                      <button
                        type="button"
                        onClick={() => handleImagePreview(imageKey, altText)}
                        className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors rounded-lg"
                      >
                        <span className="opacity-0 group-hover:opacity-100 text-white text-xs bg-black/50 px-2 py-1 rounded">
                          Preview
                        </span>
                      </button>
                    </>
                  ) : (
                    <div className="w-[200px] h-[150px] bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                        <p className="text-xs text-gray-500">Loading...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          }
        })}
      </div>
    );
  }, [imageUrls, handleImagePreview]);

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
            env: (await getPublicRuntimeConfig()).appEnv || 'production',
          });

          console.log("welcomePayload", welcomePayload);

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

  // Fetch presigned URLs for all images in messages
  useEffect(() => {
    if (messages.length === 0) return;

    const fetchImageUrls = async () => {
      const allImageKeys = new Set<string>();

      // Extract all image keys from messages
      messages.forEach((msg) => {
        const imageRefs = extractImageReferences(msg.text);
        imageRefs.forEach((ref) => {
          allImageKeys.add(ref.imageKey);
        });
      });

      // Fetch URLs for images that aren't cached
      const keysToFetch = Array.from(allImageKeys).filter((key) => !imageUrls[key]);

      if (keysToFetch.length > 0) {
        const urlPromises = keysToFetch.map((key) => getPresignedUrl(key));
        await Promise.all(urlPromises);
      }
    };

    fetchImageUrls();
  }, [messages, imageUrls, getPresignedUrl]);

  // Set up SSE listener when conversationId changes
  useEffect(() => {
    if (!conversationId || initializing) {
      setShowRefreshPopup(false);
      return;
    }

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
          },
          (error) => {
            // Handle disconnection error - show popup immediately
            console.error('SSE connection error:', error);

            // Close current connection
            if (eventSourceRef.current) {
              try {
                eventSourceRef.current.close();
              } catch {
                // Ignore close errors
              }
              eventSourceRef.current = null;
            }

            // Show popup immediately
            setShowRefreshPopup(true);
          }
        );

        eventSourceRef.current = eventSource;
        isSettingUpSSERef.current = false;

        // Monitor for disconnection - check if connection is still alive
        const checkConnection = setInterval(() => {
          // If we haven't received messages in a while and connection seems dead, retry
          // This is a simple check - in production you might want more sophisticated monitoring
        }, 30000); // Check every 30 seconds

        // Store interval for cleanup
        (eventSource as any).healthCheckInterval = checkConnection;

      } catch (err) {
        console.error('Failed to setup SSE:', err);
        isSettingUpSSERef.current = false;

        // Show popup immediately on connection failure
        setShowRefreshPopup(true);
      }
    };

    setupSSE();

    return () => {
      isSettingUpSSERef.current = false;
      if (eventSourceRef.current && !isClosingSSERef.current) {
        isClosingSSERef.current = true;
        const eventSource = eventSourceRef.current;
        eventSourceRef.current = null;

        // Clear health check interval if exists
        if ((eventSource as any).healthCheckInterval) {
          clearInterval((eventSource as any).healthCheckInterval);
        }

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
            const isChoiceType = msg?.options && (msg?.type === "choice" || msg?.type === "dropdown");
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
                      <div className="text-sm mb-2">
                        {renderMessageWithImages(msg.text)}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 items-stretch">
                        {(msg?.options ?? []).map((opt: any, i: number) => (
                          <button
                            key={opt.value || i}
                            type="button"
                            className="w-full px-4 py-1.5 backdrop-blur-xl border border-white/20 text-gray-700 rounded-full shadow-lg shadow-black/5 hover:bg-gradient-to-r hover:from-blue-400/90 hover:to-purple-400/90 hover:text-white hover:border-white/50 hover:cursor-pointer transition-all duration-300 ease-in-out transform hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-lg disabled:hover:shadow-black/5 text-sm font-medium text-center"
                            onMouseEnter={(e) => {
                              if (!e.currentTarget.disabled) {
                                e.currentTarget.style.backgroundColor = '';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!e.currentTarget.disabled) {
                                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                              }
                            }}
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
                      <div className="text-sm mb-2">
                        {renderMessageWithImages(msg.text)}
                      </div>
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
                  ) : (
                    renderMessageWithImages(msg.text)
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

      {/* Connection Error Popup */}
      {showRefreshPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md mx-4 border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Connection Lost
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              Unable to connect to the chat service.
              Please refresh the page to reconnect.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  window.location.reload();
                }}
                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 font-medium"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => {
            setPreviewImage(null);
            setPreviewLoading(false);
          }}
        >
          <div
            className="max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold">
                {previewImage.alt}
              </h3>
              <button
                onClick={() => {
                  setPreviewImage(null);
                  setPreviewLoading(false);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
              {previewLoading ? (
                <div className="flex flex-col items-center justify-center space-y-4 min-h-[400px]">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  <p className="text-gray-600">Loading image...</p>
                </div>
              ) : previewImage.url ? (
                <div className="w-full">
                  <Image
                    src={previewImage.url}
                    alt={previewImage.alt}
                    width={800}
                    height={600}
                    className="w-full h-auto max-w-full"
                    style={{ objectFit: 'contain', display: 'block' }}
                    unoptimized={true}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-4 min-h-[400px]">
                  <p className="text-gray-600">No image to display</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

