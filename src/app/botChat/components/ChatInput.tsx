"use client";

import { useState } from "react";
import Image from "next/image";
import Typewriter from "@/components/common/TypeWriter";

interface ChatInputProps {
  /** Callback when user submits a message */
  onSend: (message: string) => Promise<void> | void;

  /** True while backend is processing a message */
  loading?: boolean;

  /** True when conversation is not initialized yet */
  disabled?: boolean;

  /** Optional custom hints rotating above input */
  hints?: string[];
}

/** Default rotating hints for the typewriter effect */
const DEFAULT_HINTS = [
  "Ask me anything about VietJet policies ✈️",
  "Need help with leave requests? 🌴",
  "How can I assist you today, my colleague?",
  "Ask HR, IT, COM or SOP-related questions",
];

export function ChatInput({
  onSend,
  loading = false,
  disabled = false,
  hints = DEFAULT_HINTS,
}: ChatInputProps) {
  const [value, setValue] = useState("");

  /** Handle form submit */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = value.trim();
    if (!trimmed || loading || disabled) return;

    await onSend(trimmed);
    setValue(""); // Clear input after sending
  };

  return (
    <div className="relative bg-white/70 backdrop-blur-xl border-t border-white/20 p-4">
      <form
        onSubmit={handleSubmit}
        className="max-w-4xl mx-auto flex flex-col gap-2"
      >
        {/* === Rotating hint using Typewriter component === */}
        <div className="h-4 text-[11px] text-gray-500 flex items-center gap-1 font-mono">
          {/* Small glowing dot */}
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />

          {/* Typewriter animated text */}
          <Typewriter
            texts={hints}
            typingSpeed={70}
            deletingSpeed={35}
            pauseTime={1000}
          >
            {(text: string) => <span>{text}</span>}
          </Typewriter>
        </div>

        {/* === Main input + send button === */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            className="flex-1 px-4 py-3 bg-white/50 backdrop-blur-sm border border-gray-200/50
              rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 
              focus:border-transparent transition-all duration-500 text-gray-900 
              placeholder-gray-400 italic text-base tracking-wide"
            placeholder="Type your question for JettyKa..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={loading || disabled}
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={loading || !value.trim() || disabled}
            className="px-6 py-3 bg-gradient-to-r from-red-400 to-yellow-400 text-white rounded-xl
              hover:from-red-600 hover:to-yellow-400 transition-all duration-200 transform
              hover:scale-105 font-semibold shadow-lg flex items-center justify-center
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              /* Loading spinner */
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
            ) : (
              /* Telegram-style send icon */
              <Image
                src="/send-icon.svg"
                alt="Send"
                width={20}
                height={20}
                className="dark:invert"
              />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}