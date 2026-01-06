"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useRouter } from "next/navigation";
import { auth, botpressAPI } from "@/lib/auth";
import UserMenu from "@/components/common/UserMenu";
import { LoadingOverlay } from "./components/LoadingOverlay";
import { MessageList, type Message } from "./components/MessageList";

interface Conversation {
  id: string;
  userId: string;
}

export default function BotChatPage() {
  const router = useRouter();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [isAuth, setIsAuth] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingOptions, setPendingOptions] = useState<{
    messageId: string;
    options: any[] | undefined;
  } | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const [initStep, setInitStep] = useState<1 | 2 | 3>(1);
  const [minInitTimeDone, setMinInitTimeDone] = useState(false);

  const isMountedRef = useRef(true);

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
    } catch (err) {
      console.error("Initialization error:", err);
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
    };
  }, [isAuth]);

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

  // Handle message sent callback
  const handleMessageSent = useCallback(() => {
    // Message was sent successfully - any cleanup if needed
  }, []);

  // Handle error callback
  const handleInputError = useCallback((errorMsg: string) => {
    // Error is handled by MessageList internally
    console.error("Chat error:", errorMsg);
  }, []);

  const handleLogout = () => {
    fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      auth.logout();
      router.push("/login");
    });
  };

  // Handle option selection
  const handleOptionSelect = useCallback((value: string) => {
    setSelectedOption(value);
    setPendingOptions(null);
  }, []);

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
        <LoadingOverlay visible={loaderVisible} initStep={initStep} />

        {/* ==== Main chat UI with fade-in ==== */}
        <div
          className={`relative z-10 h-full flex flex-col transition-opacity duration-500 ${loaderVisible ? "opacity-0" : "opacity-100"
            }`}
        >
          {/* Header */}
          <div className="flex-shrink-0 sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-white/20 p-3 sm:p-4">
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

          {/* Messages and ChatInput - all handled by MessageList */}
          <MessageList
            conversationId={conversation?.id || null}
            conversationUserId={conversation?.userId || null}
            initializing={initializing}
            onOptionSelect={handleOptionSelect}
            selectedOption={selectedOption}
            onMessagesChange={setMessages}
            onMessageSent={handleMessageSent}
            onError={handleInputError}
          />
        </div>
      </div>
    </ProtectedRoute>
  );
}