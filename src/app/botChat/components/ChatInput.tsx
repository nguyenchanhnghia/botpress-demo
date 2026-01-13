"use client";

import { useState, useCallback, memo, useEffect, useRef } from "react";
import Image from "next/image";
import { auth, botpressAPI } from "@/lib/auth";

interface ChatInputProps {
  /** Conversation ID for sending messages */
  conversationId: string | null;

  /** Callback when message is sent successfully */
  onMessageSent?: () => void;

  /** Callback when error occurs */
  onError?: (error: string) => void;

  /** Callback to set bot typing state */
  onBotTypingChange?: (typing: boolean) => void;

  /** True when conversation is not initialized yet */
  disabled?: boolean;

  /** Optional custom placeholder text */
  placeholder?: string;
}

/** Default rotating placeholder phrases */
const DEFAULT_PLACEHOLDERS = [
  "Ask Banh Mi about VietJet policies ✈️",
  "Need help with leave requests? 🌴",
  "How can Banh Mi assist you today, my colleague?",
  "Ask HR, IT, COM or SOP-related questions",
];

export const ChatInput = memo(function ChatInput({
  conversationId,
  onMessageSent,
  onError,
  onBotTypingChange,
  disabled = false,
  placeholder,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholderText, setPlaceholderText] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Typing effect for placeholder
  useEffect(() => {
    let charIndex = 0;
    let timeout: NodeJS.Timeout | null = null;
    let isDeleting = false;

    const type = () => {
      const currentPhrase = placeholder || DEFAULT_PLACEHOLDERS[placeholderIndex];
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
            (prev) => (prev + 1) % DEFAULT_PLACEHOLDERS.length
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
  }, [placeholderIndex, placeholder]);

  // Blink cursor for placeholder
  useEffect(() => {
    const id = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 500);
    return () => clearInterval(id);
  }, []);

  /** Handle form submit */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const trimmed = value.trim();
      if (!trimmed || loading || disabled || !conversationId) return;

      // Check authentication
      if (!auth.isAuthenticated()) {
        const errorMsg = "User key not found. Please login again.";
        onError?.(errorMsg);
        return;
      }

      const userKey = auth.getUserKey();
      if (!userKey) {
        const errorMsg = "User key not found. Please login again.";
        onError?.(errorMsg);
        return;
      }

      setLoading(true);
      const messageToSend = trimmed;
      setValue(""); // Clear input immediately

      try {
        // Send message
        await botpressAPI.sendMessage(userKey, conversationId, messageToSend);
        // Set bot typing state
        onBotTypingChange?.(true);
        // Notify parent that message was sent
        onMessageSent?.();
        // Keep focus on input after sending
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to send message";
        onError?.(errorMsg);
        // Restore input value on error
        setValue(messageToSend);
        onBotTypingChange?.(false);
      } finally {
        setLoading(false);
      }
    },
    [
      value,
      loading,
      disabled,
      conversationId,
      onMessageSent,
      onError,
      onBotTypingChange,
    ]
  );

  return (
    <div className="relative bg-white/70 backdrop-blur-xl border-t border-white/20 p-4">
      <form
        onSubmit={handleSubmit}
        className="max-w-4xl mx-auto flex items-center space-x-3"
      >
        <input
          ref={inputRef}
          type="text"
          className="flex-1 px-4 py-3 bg-white/50 backdrop-blur-sm border border-gray-200/50 
            rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 
            focus:border-transparent transition-all duration-500 text-gray-900 
            placeholder-gray-400 placeholder:italic text-base tracking-wide not-italic"
          placeholder={`${placeholderText}${showCursor ? " |" : " "}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={loading || disabled || !conversationId}
        />
        <button
          type="submit"
          disabled={loading || !value.trim() || disabled || !conversationId}
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
  );
});