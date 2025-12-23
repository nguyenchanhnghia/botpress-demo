import { useEffect, useState } from "react"

const THINKING_TEXTS = [
  "Understanding your question",
  "Searching knowledge base",
  "Analyzing relevant information",
  "Reasoning and validating",
  "Preparing the best answer",
]

export default function AIThinkingBubble() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) =>
        prev < THINKING_TEXTS.length - 1 ? prev + 1 : prev
      )
    }, 2200)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex justify-start">
      <div className="
    px-6 py-4 rounded-2xl
    bg-white/1 backdrop-blur-xl
    border border-white/30
    shadow-[0_8px_30px_rgba(0,0,0,0.06)]
    max-w-md
  ">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-gray-800">
                {THINKING_TEXTS[step]}
              </span>
              <div className="flex space-x-1">
                <span className="w-1.5 h-1.5 bg-pink-300/80 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-yellow-300/80 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-purple-400/80 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-red-500/80 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
            <p className="text-xs text-gray-500 italic">
              Banh Mi is reasoning…
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}