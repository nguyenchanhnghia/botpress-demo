"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useRouter } from "next/navigation";
import { auth, botpressAPI } from "@/lib/auth";
import UserMenu from "@/components/common/UserMenu";
import AIThinking from "./components/AIThinking";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  createdAt: string;
  userId: string;
  options?: any[];
  payload?: any;
  type?: string;
}

interface Conversation {
  id: string;
  userId: string;
}

export default function BotChatPage() {
  const router = useRouter();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<{ close: () => void } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [botTyping, setBotTyping] = useState(false);
  const [isAuth, setIsAuth] = useState(false);
  const [pendingOptions, setPendingOptions] = useState<{
    messageId: string;
    options: any[] | undefined;
  } | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const botTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [initStep, setInitStep] = useState<1 | 2 | 3>(1);
  const [minInitTimeDone, setMinInitTimeDone] = useState(false);

  const isMountedRef = useRef(true);

  // ===== Placeholder typing animation (input) =====
  const placeholderPhrases = [
    "Ask Banh Mi about VietJet policies ✈️",
    "Need help with leave requests? 🌴",
    "How can Banh Mi assist you today, my colleague?",
    "Ask HR, IT, COM or SOP-related questions",
  ];
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholderText, setPlaceholderText] = useState("");
  const [showCursor, setShowCursor] = useState(true);

  // Drive 3-step initializing timeline
  useEffect(() => {
    if (!initializing) {
      // When initialization completes, ensure minInitTimeDone is set
      setMinInitTimeDone(true);
      return;
    }

    setInitStep(1);
    setMinInitTimeDone(false);

    const t1 = setTimeout(() => setInitStep(2), 800);
    const t2 = setTimeout(() => setInitStep(3), 1600);
    const t3 = setTimeout(() => setMinInitTimeDone(true), 2400);

    // Safety timeout: if initialization takes too long, force completion after 10 seconds
    const safetyTimeout = setTimeout(() => {
      if (isMountedRef.current) {
        console.warn("Initialization timeout - forcing completion");
        setInitializing(false);
        setMinInitTimeDone(true);
      }
    }, 10000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(safetyTimeout);
    };
  }, [initializing]);

  // Typing effect for placeholder
  useEffect(() => {
    let charIndex = 0;
    let timeout: NodeJS.Timeout | null = null;
    let isDeleting = false;

    const type = () => {
      const currentPhrase = placeholderPhrases[placeholderIndex];
      const fullText = currentPhrase;

      if (!isDeleting) {
        setPlaceholderText(fullText.substring(0, charIndex + 1));
        charIndex++;

        if (charIndex === fullText.length) {
          isDeleting = true;
          timeout = setTimeout(type, 2500);
          return;
        }
      } else {
        setPlaceholderText(fullText.substring(0, charIndex - 1));
        charIndex--;

        if (charIndex === 0) {
          isDeleting = false;
          setPlaceholderIndex(
            (prev) => (prev + 1) % placeholderPhrases.length
          );
          timeout = setTimeout(type, 800);
          return;
        }
      }

      const speed = isDeleting ? 50 : 90;
      timeout = setTimeout(type, speed);
    };

    timeout = setTimeout(type, 500);

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [placeholderIndex]);

  // Blink cursor for placeholder
  useEffect(() => {
    const id = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 500);
    return () => clearInterval(id);
  }, []);

  // Check authentication before initializing chat
  useEffect(() => {
    if (!auth.isAuthenticated()) {
      auth.logout();
      router.push("/login");
    } else {
      setIsAuth(true);
    }
  }, [router]);

  const initializeChat = async (isClearCache?: boolean) => {
    try {
      setInitializing(true);
      setError(null);

      if (isClearCache) {
        auth.clearConversation();
      }

      const userKey = auth.getUserKey();
      if (!userKey) {
        throw new Error("User key not found. Please login again.");
      }

      // 1) Get or create user
      const userResponse = await botpressAPI.getOrCreateUser(userKey);

      // 2) Resolve conversation (cached or new)
      let conversationData: any = null;
      const cachedConversation = auth.getCachedConversation();

      if (cachedConversation) {
        try {
          await botpressAPI.validateConversation(userKey, cachedConversation.id);
          conversationData = cachedConversation;
        } catch {
          auth.clearConversation();
        }
      }

      if (!conversationData) {
        const conversationResponse = await botpressAPI.getOrCreateConversation(
          userKey
        );
        conversationData =
          conversationResponse.conversation || conversationResponse;

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

      // 3) Load messages
      setLoadingMessages(true);
      try {
        const messagesResponse = await botpressAPI.listMessages(
          userKey,
          conversationData.id
        );
        if (!isMountedRef.current) {
          setLoadingMessages(false);
          return;
        }

        const formattedMessages = (messagesResponse.messages || messagesResponse)
          .map((msg: any) => ({
            id: msg.id,
            text: msg.payload?.text || msg.text || "Unknown message",
            sender: msg.isBot ? "bot" : "user",
            createdAt: msg.createdAt || msg.createdOn || msg.timestamp,
            userId: msg.isBot ? msg.botId : msg.userId,
            ...(msg.options ? { options: msg.options } : {}),
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

          if (conversationData?.id) {
            botpressAPI.sendMessage(userKey, conversationData.id, welcomePayload);
          }
        }

        setMessages(uniqueMessages);
      } finally {
        if (isMountedRef.current) {
          setLoadingMessages(false);
        }
      }

      // 4) SSE listener
      if (eventSourceRef.current) {
        try {
          eventSourceRef.current.close();
        } catch { }
        eventSourceRef.current = null;
      }

      const eventSource = await botpressAPI.listenMessages(
        userKey,
        conversationData.id,
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

      if (!isMountedRef.current) {
        eventSource.close();
        return;
      }
      eventSourceRef.current = eventSource;
    } catch (err) {
      console.error("Initialization error:", err);
      if (isMountedRef.current) {
        setError(
          err instanceof Error ? err.message : "Failed to initialize chat"
        );
      }
    } finally {
      if (isMountedRef.current) {
        setInitializing(false);
      }
    }
  };

  // Initial load
  useEffect(() => {
    if (!isAuth) return;

    initializeChat();

    return () => {
      isMountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (botTypingTimeoutRef.current) {
        clearTimeout(botTypingTimeoutRef.current);
      }
    };
  }, [isAuth]);

  // Auto scroll
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
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [initializing, messages]);

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

  // Pending options
  useEffect(() => {
    const lastBotWithOptions = [...messages]
      .reverse()
      .find(
        (m) =>
          m.sender === "bot" &&
          m.options &&
          Array.isArray(m.options) &&
          m.options.length > 0
      );
    if (
      lastBotWithOptions &&
      (!pendingOptions || pendingOptions.messageId !== lastBotWithOptions.id)
    ) {
      setPendingOptions({
        messageId: lastBotWithOptions.id,
        options: lastBotWithOptions.options,
      });
      setSelectedOption(null);
    }
    if (!lastBotWithOptions) {
      setPendingOptions(null);
      setSelectedOption(null);
    }
  }, [messages, pendingOptions]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !conversation || loading) return;

    const userKey = auth.getUserKey();
    if (!userKey) {
      setError("User key not found. Please login again.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setInput("");
      setBotTyping(true);
      await botpressAPI.sendMessage(userKey, conversation.id, input);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      setMessages((prev) => prev.filter((msg) => !msg.id.startsWith("temp-")));
      setBotTyping(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      auth.logout();
      router.push("/login");
    });
  };

  function containsHTML(str: string) {
    return /<[^>]+>/.test(str);
  }

  function sanitizeHTML(html: string) {
    return html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  }

  // Loader visible while either: still initializing OR minimum animation time not done
  const loaderVisible = initializing || !minInitTimeDone;

  return (
    <ProtectedRoute>
      <div className="relative h-[calc(100vh)] bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 overflow-hidden">
        {/* Shared background blobs */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob" />
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000" />
          <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000" />
        </div>

        {/* ==== Loader overlay with fade ==== */}
        <div
          className={`absolute inset-0 z-40 flex items-center justify-center transition-opacity duration-500 ${loaderVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}
        >
          <div className="relative z-10 w-full max-w-md px-8 py-6 bg-white/10 border border-white/20 rounded-3xl backdrop-blur-2xl shadow-2xl">
            {/* Top: avatar + status chip */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-red-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-red-500/30">
                  <span className="text-white text-lg">AI</span>
                </div>
                <div className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                  Banh Mi · Employee Support AI
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-emerald-600 bg-emerald-50/80 border border-emerald-100 px-2 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="hidden sm:inline">Booting AI workspace</span>
                <span className="sm:hidden">Starting…</span>
              </div>
            </div>

            {/* Title + subtitle */}
            <div className="space-y-1 mb-5">
              <h2 className="text-xl font-semibold text-gray-900">
                Preparing Banh Mi workspace
              </h2>
              <p className="text-xs text-gray-500">
                Securely connecting to VietJet Thailand systems and loading your
                context.
              </p>
            </div>

            {/* 3-step timeline */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-3">
                <StepBullet
                  state={
                    initStep > 1 ? "done" : initStep === 1 ? "active" : "pending"
                  }
                />
                <span
                  className={
                    initStep === 1
                      ? "text-gray-900"
                      : initStep > 1
                        ? "text-gray-700"
                        : "text-gray-400"
                  }
                >
                  Initializing AI engine
                </span>
              </div>

              <div className="flex items-center gap-3">
                <StepBullet
                  state={
                    initStep > 2 ? "done" : initStep === 2 ? "active" : "pending"
                  }
                />
                <span
                  className={
                    initStep === 2
                      ? "text-gray-900"
                      : initStep > 2
                        ? "text-gray-700"
                        : "text-gray-400"
                  }
                >
                  Syncing VietJet Thailand knowledge base
                </span>
              </div>

              <div className="flex items-center gap-3">
                <StepBullet
                  state={initStep === 3 ? "active" : "pending"}
                  last
                />
                <span
                  className={
                    initStep === 3 ? "text-gray-900" : "text-gray-400"
                  }
                >
                  Preparing your conversation workspace
                </span>
              </div>
            </div>

            {/* Footer hint */}
            <div className="mt-5 flex items-center justify-between text-[11px] text-gray-400">
              <span>All actions are logged securely.</span>
              <span className="font-mono">TVJ · AI · Secure</span>
            </div>
          </div>
        </div>

        {/* ==== Main chat UI with fade-in ==== */}
        <div
          className={`relative z-10 h-full flex flex-col transition-opacity duration-500 ${loaderVisible ? "opacity-0" : "opacity-100"
            }`}
        >
          {/* Header */}
          <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-white/20 p-3 sm:p-4">
            <div className="max-w-4xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Left: Avatar + title */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex items-center justify-center shrink-0">
                  <Image
                    src="https://chatbotcdn.socialenable.co/vietjet-air/assets/images/amy-full-body.png"
                    alt="Banh Mi"
                    width={40}
                    height={40}
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-red-600 to-yellow-600 bg-clip-text text-transparent truncate">
                    Banh Mi · Employee Support AI
                  </h1>
                  <p className="text-[11px] sm:text-xs text-gray-500">
                    VietJet Thailand internal assistant for policies &amp; SOPs
                  </p>
                </div>
              </div>

              {/* Right: Actions – Clear Chat + user dropdown (Logout) */}
              <div className="flex w-full sm:w-auto items-center justify-stretch sm:justify-end gap-2">
                <button
                  onClick={() => initializeChat(true)}
                  className="flex-1 sm:flex-none px-3 py-2 text-xs bg-yellow-300 text-black rounded-md hover:brightness-95 transition"
                >
                  Clear Chat
                </button>
                <UserMenu
                  items={[
                    { label: "Users", href: "/admin-cms/users", adminOnly: true },
                    { label: "Knowledge Base", href: "/admin-cms/knowleage-base", adminOnly: true },
                    { label: "Images", href: "/admin-cms/images", adminOnly: true },
                    {
                      label: "Logout",
                      onClick: handleLogout,
                    },
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={messagesContainerRef}
            className="flex-1 p-4 overflow-y-auto relative"
          >
            <div className="max-w-4xl mx-auto space-y-4">
              {messages.map((msg, index) => {
                const isCurrentUser =
                  msg.sender === "user" && msg.userId === conversation?.userId;
                const isChoiceType =
                  msg?.options && msg?.type === "choice";
                const showOptions =
                  msg?.options &&
                  Array.isArray(msg?.options) &&
                  msg?.options.length > 0;

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

                if (
                  parsedMsg &&
                  typeof parsedMsg === "object" &&
                  parsedMsg?.type === "start_conversation"
                ) {
                  return null;
                }

                return (
                  <div
                    key={`${msg.id}-${index}`}
                    className={`flex ${isCurrentUser ? "justify-end" : "justify-start"
                      }`}
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
                                onClick={async () => {
                                  setSelectedOption(opt.value);
                                  setPendingOptions(null);
                                  setInput("");
                                  setBotTyping(true);
                                  const userKey = auth.getUserKey();
                                  if (!userKey || !conversation) return;
                                  await botpressAPI.sendMessage(
                                    userKey,
                                    conversation.id,
                                    opt.value
                                  );
                                }}
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
                                  onChange={async () => {
                                    setSelectedOption(opt.value);
                                    setPendingOptions(null);
                                    setInput("");
                                    setBotTyping(true);
                                    const userKey = auth.getUserKey();
                                    if (!userKey || !conversation) return;
                                    await botpressAPI.sendMessage(
                                      userKey,
                                      conversation.id,
                                      opt.value
                                    );
                                  }}
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
                        <p className="text-sm whitespace-pre-line">
                          {msg.text}
                        </p>
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

          {/* Input */}
          <div className="relative bg-white/70 backdrop-blur-xl border-t border-white/20 p-4">
            <form
              onSubmit={handleSend}
              className="max-w-4xl mx-auto flex items-center space-x-3"
            >
              <input
                type="text"
                className="flex-1 px-4 py-3 bg-white/50 backdrop-blur-sm border border-gray-200/50 
                  rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 
                  focus:border-transparent transition-all duration-500 text-gray-900 
                  placeholder-gray-400 italic text-base tracking-wide"
                placeholder={`${placeholderText}${showCursor ? " |" : " "
                  }`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading || !conversation}
              />
              <button
                type="submit"
                disabled={loading || !input.trim() || !conversation}
                className="px-6 py-3 bg-gradient-to-r from-red-400 to-yellow-400 text-white rounded-xl 
                  hover:from-red-600 hover:to-yellow-400 transition-all duration-200 transform 
                  hover:scale-105 font-semibold shadow-lg flex items-center justify-center 
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                ) : (
                  <Image
                    src="./send-icon.svg"
                    alt="Send"
                    width={20}
                    height={20}
                    className="dark:invert"
                  />
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

function StepBullet({
  state,
  last,
}: {
  state: "pending" | "active" | "done";
  last?: boolean;
}) {
  if (state === "done") {
    return (
      <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-[10px] text-white">
        ✓
      </div>
    );
  }

  if (state === "active") {
    return (
      <div className="relative w-4 h-4 flex items-center justify-center">
        <div className="absolute inline-flex w-4 h-4 rounded-full bg-blue-400 opacity-40 animate-ping" />
        <div className="relative w-2.5 h-2.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />
      </div>
    );
  }

  return (
    <div
      className={`w-3 h-3 rounded-full border border-gray-300 ${last ? "opacity-70" : "opacity-40"
        }`}
    />
  );
}