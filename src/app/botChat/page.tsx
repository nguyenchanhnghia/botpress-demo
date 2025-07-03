"use client";

import { useEffect, useRef, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useRouter } from "next/navigation";
import { auth, botpressAPI } from "@/lib/auth";

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'bot';
    createdAt: string;
    userId: string;
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
    const [initializing, setInitializing] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const eventSourceRef = useRef<{ close: () => void } | null>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const [botTyping, setBotTyping] = useState(false);
    const [isAuth, setIsAuth] = useState(false);

    // Check authentication before initializing chat
    useEffect(() => {
        if (!auth.isAuthenticated()) {
            router.replace("/login");
        } else {
            setIsAuth(true);
        }
    }, [router]);

    // Initialize Botpress user and conversation
    useEffect(() => {
        if (!isAuth) return;
        let isMounted = true;

        const initializeChat = async () => {
            try {
                setInitializing(true);
                setError(null);

                const userKey = auth.getUserKey();
                if (!userKey) {
                    throw new Error('User key not found. Please login again.');
                }

                // Step 1: Get or create user
                console.log('Getting or creating user...');
                const userResponse = await botpressAPI.getOrCreateUser(userKey);
                console.log('User response:', userResponse);

                // Step 2: Try to use cached conversation first, then create new one if needed
                let conversationData: any = null;
                const cachedConversation = auth.getCachedConversation();

                if (cachedConversation) {
                    console.log('Found cached conversation, validating...');
                    try {
                        await botpressAPI.validateConversation(userKey, cachedConversation.id);
                        console.log('Cached conversation is valid, using it');
                        conversationData = cachedConversation;
                    } catch {
                        console.log('Cached conversation is invalid, creating new one');
                        auth.clearConversation();
                    }
                }

                if (!conversationData) {
                    console.log('Creating new conversation...');
                    const conversationResponse = await botpressAPI.getOrCreateConversation(userKey);
                    console.log('Conversation response:', conversationResponse);
                    conversationData = conversationResponse.conversation || conversationResponse;

                    // Cache the new conversation
                    auth.saveConversation({
                        id: conversationData.id,
                        userId: conversationData.userId || userResponse.user?.id
                    });
                }

                if (!isMounted) return;

                setConversation({
                    id: conversationData.id,
                    userId: conversationData.userId || userResponse.user?.id
                });

                // Step 3: List existing messages (show both user and bot)
                console.log('Loading messages...');
                const messagesResponse = await botpressAPI.listMessages(userKey, conversationData.id);
                console.log('Messages response:', messagesResponse);

                if (!isMounted) return;

                const formattedMessages = (messagesResponse.messages || messagesResponse)
                    .map((msg: any) => ({
                        id: msg.id,
                        text: msg.payload?.text || msg.text || 'Unknown message',
                        sender: msg.isBot ? 'bot' : 'user',
                        createdAt: msg.createdAt || msg.createdOn || msg.timestamp,
                        userId: msg.isBot ? msg.botId : msg.userId
                    }));

                // Remove duplicates based on message ID
                const uniqueMessages = formattedMessages.filter((msg: Message, index: number, self: Message[]) =>
                    index === self.findIndex((m: Message) => m.id === msg.id)
                );
                // Sort messages by createdAt ascending (oldest first)
                uniqueMessages.sort((a: Message, b: Message) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                setMessages(uniqueMessages);


                // Step 4: Start listening for new messages
                console.log('Starting message listener...');
                const eventSource = await botpressAPI.listenMessages(
                    userKey,
                    conversationData.id,
                    (data) => {
                        console.log('Received SSE message:', data);
                        // Only handle messages with id and text
                        if (data && data.id && data.payload?.text) {
                            const newMessage: Message = {
                                id: data.id,
                                text: data.payload?.text || 'Unknown message',
                                sender: data.isBot ? 'bot' : 'user',
                                createdAt: data.createdAt || new Date().toISOString(),
                                userId: data.isBot ? data.botId : data.userId
                            };
                            setMessages(prev => {
                                // Remove any temp user message if bot is replying
                                let filtered = prev;
                                if (newMessage.sender === 'bot') {
                                    filtered = prev.filter(msg => !msg.id.startsWith('temp-'));
                                }
                                if (filtered.some(msg => msg.id === newMessage.id)) return filtered;
                                return [...filtered, newMessage];
                            });
                            if (data.isBot) setBotTyping(false); // Hide bot typing when bot replies
                        }
                    }
                );

                if (!isMounted) {
                    eventSource.close();
                    return;
                }

                eventSourceRef.current = eventSource;

            } catch (err) {
                console.error('Initialization error:', err);
                if (isMounted) {
                    setError(err instanceof Error ? err.message : 'Failed to initialize chat');
                }
            } finally {
                if (isMounted) {
                    setInitializing(false);
                }
            }
        };

        initializeChat();

        return () => {
            isMounted = false;
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, [isAuth]);

    // Scroll to bottom after initial message load and on new messages
    useEffect(() => {
        if (!initializing && messages.length > 0) {
            if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
            }
        }
    }, [initializing, messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !conversation || loading) return;
        const userKey = auth.getUserKey();
        if (!userKey) {
            setError('User key not found. Please login again.');
            return;
        }
        setLoading(true);
        setError(null);
        try {

            setInput("");
            setBotTyping(true); // Show bot typing indicator
            const response = await botpressAPI.sendMessage(userKey, conversation.id, input);
            // setMessages(prev => {
            //     // Remove the temp message only if a real user message comes back with a different id
            //     const filtered = prev.filter(msg => msg.id !== tempId);
            //     if (response.message && response.message.isBot !== true) {
            //         // Add the real user message if returned (rare, usually only bot replies)
            //         filtered.push({
            //             id: response.message.id,
            //             text: response.message.payload?.text || response.message.text || input,
            //             sender: 'user',
            //             createdAt: response.message.createdOn || response.message.createdAt,
            //             userId: response.message.isBot ? response.message.botId : response.message.userId
            //         });
            //     }
            //     return filtered;
            // });
            console.log('response', response);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send message');
            setMessages(prev => prev.filter(msg => !msg.id.startsWith('temp-')));
            setBotTyping(false);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }
        auth.logout();
        router.push("/login");
    };

    // Helper to check if a string contains HTML tags
    function containsHTML(str: string) {
        return /<[^>]+>/.test(str);
    }
    // Basic sanitizer: remove <script> tags (for safety)
    function sanitizeHTML(html: string) {
        return html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
    }

    if (initializing) {
        return (
            <ProtectedRoute>
                <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                        </div>
                        <p className="text-gray-600">Initializing chat...</p>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    // Debug log before render
    console.log('messages to render:', messages);

    return (
        <ProtectedRoute>
            <div className="h-[calc(100vh)] flex flex-col bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 relative overflow-hidden">
                {/* Background blur elements */}
                <div className="absolute inset-0">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
                    <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
                    <div className="absolute -bottom-8 left-1/3 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
                </div>

                {/* Header */}
                <div className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-white/20 p-4">
                    <div className="max-w-4xl mx-auto flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                                <span className="text-white font-bold text-lg">🤖</span>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Botpress Chat</h1>
                                <p className="text-sm text-gray-600">Direct API Integration</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            {conversation && (
                                <div className="text-xs text-gray-500 bg-white/50 px-2 py-1 rounded">
                                    Conv: {conversation.id.slice(0, 8)}...
                                </div>
                            )}
                            <button
                                onClick={handleLogout}
                                className="px-4 py-2 text-sm bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl hover:from-red-600 hover:to-pink-600 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 p-4 overflow-y-auto relative">
                    <div className="max-w-4xl mx-auto space-y-4">
                        {messages.length === 0 && (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-white text-2xl">🤖</span>
                                </div>
                                <p className="text-gray-600">Start chatting with the AI bot!</p>
                            </div>
                        )}
                        {messages.map((msg, index) => {
                            const isCurrentUser = msg.sender === "user" && msg.userId === conversation?.userId;
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
                                        {containsHTML(msg.text) ? (
                                            <div className="text-sm" dangerouslySetInnerHTML={{ __html: sanitizeHTML(msg.text) }} />
                                        ) : (
                                            <p className="text-sm whitespace-pre-line">{msg.text}</p>
                                        )}
                                        <p className={`text-xs mt-1 ${isCurrentUser ? "text-blue-100" : "text-gray-500"}`}>
                                            {new Date(msg.createdAt).toLocaleTimeString()}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                        {botTyping && (
                            <div className="flex justify-start">
                                <div className="px-6 py-3 rounded-2xl bg-white/70 backdrop-blur-sm text-gray-800 border border-white/20">
                                    <div className="flex space-x-1">
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
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
                    <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-center space-x-3">
                        <input
                            type="text"
                            className="flex-1 px-4 py-3 bg-white/50 backdrop-blur-sm border border-gray-200/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500"
                            placeholder="Type your message..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={loading || !conversation}
                        />
                        <button
                            type="submit"
                            disabled={loading || !input.trim() || !conversation}
                            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Send
                        </button>
                    </form>
                </div>
            </div>
        </ProtectedRoute>
    );
}