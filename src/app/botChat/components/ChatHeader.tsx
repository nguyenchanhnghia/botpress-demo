"use client";

import Image from "next/image";

export function ChatHeader({
  onClear,
  onLogout,
}: {
  onClear: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-white/20 p-4">
      <div className="max-w-4xl mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
            <Image
              src="https://chatbotcdn.socialenable.co/vietjet-air/assets/images/amy-full-body.png"
              alt="Amy"
              width={40}
              height={40}
              className="object-cover"
            />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-red-600 to-yellow-600 bg-clip-text text-transparent">
              TVJ Internal Assistant
            </h1>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={onClear}
            className="px-3 py-1 text-xs bg-yellow-300 text-black rounded-md hover:brightness-95"
          >
            Clear Chat
          </button>
          <button
            onClick={onLogout}
            className="px-4 py-2 text-sm bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl hover:from-red-600 hover:to-pink-600 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}