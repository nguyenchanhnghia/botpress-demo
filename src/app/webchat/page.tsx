"use client";

import { useState } from "react";

const CLIENT_ID = '629e90eb-4b6f-4767-977a-686a81eeb449';

export default function WebchatDemo() {
    const [userId, setUserId] = useState<string | null>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<"init" | "user" | "conversation" | "chat">("init");
    const [error, setError] = useState<string | null>(null);

    // Step 1: Create user (handled by backend on first message send)
    const handleCreateUser = async () => {
        setLoading(true);
        setError(null);
        // Backend will create user on first message send, so just simulate
        setUserId(CLIENT_ID);
        console.log('[webchat] Created user, userId=', CLIENT_ID);
        setStep("user");
        setLoading(false);
    };

    // Step 2: Create conversation (handled by backend on first message send)
    const handleCreateConversation = async () => {
        setLoading(true);
        setError(null);
        // Backend will create conversation on first message send, so just simulate
        console.log('[webchat] Creating conversation for userId=', userId || CLIENT_ID);
        setStep("conversation");
        setLoading(false);
    };

    // Step 3: Send message and get bot response
    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;
        setLoading(true);
        setError(null);
        setMessages((prev) => [...prev, { sender: "user", text: message }]);
        try {
            const res = await fetch("/api/botpress", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message,
                    clientId: CLIENT_ID,
                    conversationId,
                }),
            });
            const data = await res.json();
            console.log('[webchat] /api/botpress response:', data);
            if (data.conversationId && !conversationId) setConversationId(data.conversationId);
            if (data.conversationId) console.log('[webchat] Set conversationId=', data.conversationId);
            if (data.response) setMessages((prev) => [...prev, { sender: "bot", text: data.response }]);
            setMessage("");
            setStep("chat");
        } catch {
            setError("Failed to send message");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-xl mx-auto mt-10 p-6 bg-white/80 rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-center">Botpress Cloud Demo</h2>
            <ol className="mb-6 list-decimal list-inside text-gray-700">
                <li className={step !== "init" ? "line-through" : ""}>Create User</li>
                <li className={step === "chat" || step === "conversation" ? "line-through" : ""}>Create Conversation</li>
                <li className={step === "chat" ? "line-through" : ""}>Send Message</li>
            </ol>
            {error && <div className="mb-4 text-red-600">{error}</div>}
            {step === "init" && (
                <button
                    className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700"
                    onClick={handleCreateUser}
                    disabled={loading}
                >
                    {loading ? "Creating user..." : "Create User"}
                </button>
            )}
            {step === "user" && (
                <button
                    className="w-full py-2 px-4 bg-purple-600 text-white rounded hover:bg-purple-700"
                    onClick={handleCreateConversation}
                    disabled={loading}
                >
                    {loading ? "Creating conversation..." : "Create Conversation"}
                </button>
            )}
            {(step === "conversation" || step === "chat") && (
                <form onSubmit={handleSend} className="space-y-4">
                    <div className="mb-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Your Message</label>
                        <input
                            type="text"
                            className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full py-2 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded hover:from-blue-700 hover:to-purple-700 disabled:opacity-50"
                        disabled={loading || !message.trim()}
                    >
                        {loading ? "Sending..." : "Send Message"}
                    </button>
                </form>
            )}
            <div className="mt-6 space-y-2">
                {messages.map((msg, idx) => (
                    <div key={idx} className={msg.sender === "user" ? "text-right" : "text-left"}>
                        <span
                            className={
                                msg.sender === "user"
                                    ? "inline-block bg-blue-600 text-white px-4 py-2 rounded-xl"
                                    : "inline-block bg-gray-200 text-gray-900 px-4 py-2 rounded-xl"
                            }
                        >
                            {msg.text}
                        </span>
                    </div>
                ))}
            </div>
            <div className="mt-8 text-xs text-gray-500 text-center">
                <div>User ID: {userId || CLIENT_ID}</div>
                <div>Conversation ID: {conversationId || "(will be created on first message)"}</div>
            </div>
        </div>
    );
}