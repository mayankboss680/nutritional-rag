"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Moon, Sun, ChevronRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Citation {
    id: number;
    page: string;
    similarity: string;
    content: string;
    fullContent: string;
}

interface Message {
    role: "user" | "assistant";
    content: string;
    citations?: Citation[];
}

export default function Home() {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [busy, setBusy] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [isDark, setIsDark] = useState(false);
    const [selectedCitation, setSelectedCitation] = useState<Citation | null>(
        null
    );
    const [showSidebar, setShowSidebar] = useState(false);
    const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Sound effects
    const playSound = (type: "thinking" | "response") => {
        try {
            const audioContext = new (window.AudioContext ||
                (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            if (type === "thinking") {
                oscillator.frequency.value = 440;
                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(
                    0.01,
                    audioContext.currentTime + 0.1
                );
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.1);
            } else {
                oscillator.frequency.value = 600;
                gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(
                    0.01,
                    audioContext.currentTime + 0.2
                );
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.2);
            }
        } catch (e) {
            console.log("Audio context not available");
        }
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = "auto";
            inputRef.current.style.height =
                Math.min(inputRef.current.scrollHeight, 200) + "px";
        }
    }, [input]);

    const renderContentWithCitations = (
        content: string,
        citations: Citation[]
    ) => {
        // Split content into main text and references section
        const parts = content.split(/\n\nReferences:\n\n/);
        const mainContent = parts[0] || content;
        const referencesContent = parts[1] || "";

        // Pre-process main content:
        // 1. Protect inline citations like (1, pg. 90) by converting to special markers
        // 2. Convert [1] or [1, 2] into clickable links
        let processedContent = mainContent;

        // First, protect inline citations like (1, pg. 90) or (1, Page 90)
        processedContent = processedContent.replace(
            /\((\d+),?\s*(?:pg\.?|page)\s*(\d+)\)/gi,
            (match, citationNum, pageNum) => {
                return `<span class="inline-citation" data-citation="${citationNum}" data-page="${pageNum}">${match}</span>`;
            }
        );

        // Then convert [1] or [1, 2] into clickable citation links
        processedContent = processedContent.replace(
            /\[([\d,\s]+)\]/g,
            (match, group) => {
                const ids = group.split(",").map((id: string) => id.trim());
                return ids
                    .map((id: string) => `[${id}](citation:${id})`)
                    .join("");
            }
        );

        return (
            <div className="prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800/60">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        a: ({ node, href, children, ...props }: any) => {
                            if (href?.startsWith("citation:")) {
                                const id = parseInt(href.split(":")[1]);
                                const citation = citations.find((c) => c.id === id);
                                return (
                                    <button
                                        className="inline-flex items-center justify-center w-6 h-6 mx-0.5 text-xs font-bold text-white bg-green-600 rounded shadow-sm hover:bg-green-700 transition-colors align-middle"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setSelectedCitation(citation || null);
                                        }}
                                    >
                                        {id}
                                    </button>
                                );
                            }
                            return (
                                <a
                                    href={href}
                                    {...props}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`underline decoration-emerald-500/30 hover:decoration-emerald-500 transition-all ${isDark ? "text-emerald-400" : "text-emerald-600"
                                        }`}
                                >
                                    {children}
                                </a>
                            );
                        },
                        ul: ({ children }: any) => (
                            <ul className="list-disc pl-4 mb-4 space-y-1">{children}</ul>
                        ),
                        ol: ({ children }: any) => (
                            <ol className="list-decimal pl-4 mb-4 space-y-1">{children}</ol>
                        ),
                        li: ({ children }: any) => <li className="mb-1">{children}</li>,
                        h1: ({ children }: any) => (
                            <h1 className="text-2xl font-bold mb-4 mt-6">{children}</h1>
                        ),
                        h2: ({ children }: any) => (
                            <h2 className="text-xl font-bold mb-3 mt-5">{children}</h2>
                        ),
                        h3: ({ children }: any) => (
                            <h3 className="text-lg font-bold mb-2 mt-4">{children}</h3>
                        ),
                        blockquote: ({ children }: any) => (
                            <blockquote
                                className={`border-l-4 pl-4 italic my-4 ${isDark ? "border-emerald-500/50" : "border-emerald-500"
                                    }`}
                            >
                                {children}
                            </blockquote>
                        ),
                        code: ({ className, children, ...props }: any) => {
                            const match = /language-(\w+)/.exec(className || "");
                            const isInline = !match && !className?.includes("language-");
                            return isInline ? (
                                <code
                                    className={`px-1.5 py-0.5 rounded font-mono text-sm ${isDark
                                        ? "bg-gray-800 text-emerald-300"
                                        : "bg-gray-100 text-emerald-700"
                                        }`}
                                    {...props}
                                >
                                    {children}
                                </code>
                            ) : (
                                <code
                                    className={`block p-4 rounded-lg overflow-x-auto font-mono text-sm my-4 ${isDark
                                        ? "bg-gray-800 text-gray-100"
                                        : "bg-gray-100 text-gray-800"
                                        }`}
                                    {...props}
                                >
                                    {children}
                                </code>
                            );
                        },
                        table: ({ children }: any) => (
                            <div className="overflow-x-auto my-4">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    {children}
                                </table>
                            </div>
                        ),
                        th: ({ children }: any) => (
                            <th
                                className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wider ${isDark ? "bg-gray-800 text-gray-300" : "bg-gray-50 text-gray-500"
                                    }`}
                            >
                                {children}
                            </th>
                        ),
                        td: ({ children }: any) => (
                            <td
                                className={`px-3 py-2 whitespace-nowrap text-sm ${isDark ? "border-gray-700" : "border-gray-200"
                                    }`}
                            >
                                {children}
                            </td>
                        ),
                        p: ({ children }: any) => {
                            // Handle inline citations within paragraphs
                            const processChildren = (child: any): any => {
                                if (typeof child === 'string') {
                                    // Check if this string contains our inline citation markers
                                    const parts = child.split(/(<span class="inline-citation".*?<\/span>)/);
                                    return parts.map((part, idx) => {
                                        const match = part.match(/<span class="inline-citation" data-citation="(\d+)" data-page="(\d+)">\((\d+),?\s*(?:pg\.?|page)\s*(\d+)\)<\/span>/i);
                                        if (match) {
                                            return (
                                                <span
                                                    key={idx}
                                                    className={isDark ? "text-blue-400" : "text-blue-600"}
                                                    style={{ cursor: 'default' }}
                                                >
                                                    ({match[3]}, pg. {match[4]})
                                                </span>
                                            );
                                        }
                                        return part;
                                    });
                                }
                                return child;
                            };

                            return (
                                <p className="mb-4">
                                    {Array.isArray(children)
                                        ? children.map(processChildren)
                                        : processChildren(children)}
                                </p>
                            );
                        },
                    }}
                >
                    {processedContent}
                </ReactMarkdown>

                {/* Render References Section with Custom Styling */}
                {referencesContent && (
                    <div className="mt-6 pt-4 border-t border-gray-300 dark:border-gray-700">
                        <h3 className={`text-lg font-bold mb-3 ${isDark ? "text-white" : "text-gray-900"}`}>
                            References:
                        </h3>
                        <div className="space-y-2">
                            {referencesContent.split(/\n\n/).map((ref, idx) => {
                                // Parse reference format: "1 (Page 90, Similarity: 51.1%) - text"
                                const refMatch = ref.match(/(\d+)\s*\(Page\s*(\d+),\s*Similarity:\s*([\d.]+)%\)\s*-\s*(.+)/i);
                                if (refMatch) {
                                    const [, refNum, page, similarity, text] = refMatch;
                                    return (
                                        <div key={idx} className="flex gap-2 text-sm">
                                            <span className={isDark ? "text-emerald-400 font-bold" : "text-emerald-600 font-bold"}>
                                                {refNum}
                                            </span>
                                            <span className={isDark ? "text-blue-400" : "text-blue-600"}>
                                                (Page {page}, Similarity: {similarity}%)
                                            </span>
                                            <span className={isDark ? "text-gray-300" : "text-gray-700"}>
                                                - {text}
                                            </span>
                                        </div>
                                    );
                                }
                                return (
                                    <div key={idx} className={`text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                                        {ref}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    async function send() {
        if (!input.trim() || busy) return;
        const userMessage: Message = { role: "user", content: input };
        setMessages((m) => [...m, userMessage]);
        setBusy(true);
        setIsTyping(true);
        playSound("thinking");
        const userInput = input;
        setInput("");
        setSelectedCitation(null);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userInput }),
            });

            if (!res.ok) {
                const errorText = await res.text();
                console.error("API ERROR:", errorText);
                throw new Error(`API ${res.status}: ${errorText}`);
            }

            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = "";
            let citationData: Citation[] = [];

            if (!reader) throw new Error("No response body");

            setIsTyping(false);
            setMessages((m) => [
                ...m,
                { role: "assistant", content: "", citations: [] },
            ]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                accumulatedText += chunk;

                if (accumulatedText.includes("---CITATIONS---")) {
                    const parts = accumulatedText.split("---CITATIONS---");
                    const mainContent = parts[0].trim();
                    const citationJson = parts[1]?.trim();

                    try {
                        if (citationJson) {
                            citationData = JSON.parse(citationJson);
                        }
                    } catch (e) {
                        console.error("Failed to parse citations:", e);
                    }

                    setMessages((m) => {
                        const newMessages = [...m];
                        newMessages[newMessages.length - 1] = {
                            role: "assistant",
                            content: mainContent,
                            citations: citationData,
                        };
                        return newMessages;
                    });
                    playSound("response");
                    if (citationData.length > 0) {
                        setShowSidebar(true);
                    }
                    break;
                }

                setMessages((m) => {
                    const newMessages = [...m];
                    newMessages[newMessages.length - 1] = {
                        role: "assistant",
                        content: accumulatedText,
                        citations: [],
                    };
                    return newMessages;
                });
            }
        } catch (err) {
            console.error("Error:", err);
            setIsTyping(false);
            setMessages((m) => {
                const filtered = m.filter((msg) => msg.content !== "");
                return [
                    ...filtered,
                    {
                        role: "assistant",
                        content: "I apologize, but something went wrong. Please try again.",
                        citations: [],
                    },
                ];
            });
        } finally {
            setBusy(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }

    const currentMessageCitations =
        messages.length > 0 && messages[messages.length - 1]?.role === "assistant"
            ? messages[messages.length - 1]?.citations || []
            : [];

    return (
        <div
            className={`min-h-screen flex transition-all duration-300 ${isDark
                ? "bg-gradient-to-br from-gray-900 via-emerald-950 to-gray-900"
                : "bg-gradient-to-br from-white via-emerald-50 to-white"
                }`}
        >
            {/* Main Chat Area */}
            <div
                className={`flex-1 flex flex-col transition-all duration-300 ${showSidebar
                    ? isSidebarMinimized
                        ? "mr-[60px]"
                        : "mr-80"
                    : ""
                    }`}
            >
                {/* Header */}
                <header
                    className={`border-b backdrop-blur-xl sticky top-0 z-40 ${isDark
                        ? "bg-gray-900/80 border-emerald-900/20"
                        : "bg-white/80 border-emerald-200/30"
                        }`}
                >
                    <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
                        <div>
                            <h1
                                className={`text-xl font-black tracking-tight uppercase ${isDark
                                    ? "text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300"
                                    : "text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500"
                                    }`}
                            >
                                RAG Nutritional Chatbot
                            </h1>
                            <p
                                className={`text-xs font-mono mt-0.5 ${isDark ? "text-emerald-400/60" : "text-emerald-600/60"
                                    }`}
                            >
                                Built from Scratch • Presented by{" "}
                                <span className="font-bold">MAYANK</span>
                            </p>
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.08, rotate: 180 }}
                            whileTap={{ scale: 0.92 }}
                            transition={{ type: "spring", stiffness: 400, damping: 17 }}
                            onClick={() => setIsDark(!isDark)}
                            className={`p-2.5 rounded-lg transition-all ${isDark
                                ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20"
                                : "bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border border-emerald-200"
                                }`}
                        >
                            {isDark ? (
                                <Sun className="w-5 h-5" />
                            ) : (
                                <Moon className="w-5 h-5" />
                            )}
                        </motion.button>
                    </div>
                </header>

                {/* Messages */}
                <main className="flex-1 overflow-y-auto pb-32">
                    <div className="max-w-4xl mx-auto px-6 py-12">
                        {messages.length === 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-center py-20"
                            >
                                <motion.div
                                    animate={{
                                        scale: [1, 1.05, 1],
                                        rotate: [0, 5, -5, 0],
                                    }}
                                    transition={{
                                        duration: 4,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                    }}
                                    className="text-7xl mb-6"
                                >
                                    🥗
                                </motion.div>
                                <h2
                                    className={`text-3xl font-bold mb-3 ${isDark ? "text-white" : "text-gray-900"
                                        }`}
                                >
                                    How can I help you today?
                                </h2>

                                <h3
                                    className={`text-3xl font-black mb-3 uppercase tracking-tight ${isDark ? "text-white" : "text-gray-900"
                                        }`}
                                >
                                    Ask me anything about!
                                </h3>
                                <p
                                    className={`text-base font-mono ${isDark ? "text-emerald-400/70" : "text-emerald-600/70"
                                        }`}
                                >
                                    Nutrition • Dietary Guidelines • Health Topics
                                </p>
                            </motion.div>
                        )}

                        <div className="space-y-8">
                            {messages.map((m, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className={`flex gap-4 ${m.role === "user" ? "justify-end" : "justify-start"
                                        }`}
                                >
                                    <div
                                        className={`max-w-[85%] ${m.role === "user" ? "order-2" : ""
                                            }`}
                                    >
                                        <div
                                            className={`px-6 py-4 rounded-2xl font-mono text-[15px] leading-[1.8] ${m.role === "user"
                                                ? isDark
                                                    ? "bg-emerald-600 text-white"
                                                    : "bg-emerald-500 text-white"
                                                : isDark
                                                    ? "bg-gray-800/60 text-gray-100 border border-emerald-900/30"
                                                    : "bg-white text-gray-900 border border-emerald-200/50 shadow-sm"
                                                }`}
                                        >
                                            {m.role === "assistant" && m.citations
                                                ? renderContentWithCitations(m.content, m.citations)
                                                : m.content}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}

                            {isTyping && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex justify-start"
                                >
                                    <div
                                        className={`px-6 py-4 rounded-2xl ${isDark
                                            ? "bg-gray-800/60 border border-emerald-900/30"
                                            : "bg-white border border-emerald-200/50 shadow-sm"
                                            }`}
                                    >
                                        <div className="flex gap-1.5">
                                            {[0, 1, 2].map((i) => (
                                                <motion.div
                                                    key={i}
                                                    className={`w-2 h-2 rounded-full ${isDark ? "bg-emerald-500" : "bg-emerald-600"
                                                        }`}
                                                    animate={{
                                                        y: [0, -10, 0],
                                                        opacity: [0.3, 1, 0.3],
                                                    }}
                                                    transition={{
                                                        duration: 0.8,
                                                        repeat: Infinity,
                                                        delay: i * 0.15,
                                                        ease: "easeInOut",
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                        <div ref={messagesEndRef} />
                    </div>
                </main>

                {/* Input */}
                <div
                    className={`fixed bottom-0 left-0 border-t backdrop-blur-xl transition-all duration-300 ${showSidebar
                        ? isSidebarMinimized
                            ? "right-[60px]"
                            : "right-80"
                        : "right-0"
                        } ${isDark
                            ? "bg-gray-900/90 border-emerald-900/20"
                            : "bg-white/90 border-emerald-200/30"
                        }`}
                >
                    <div className="max-w-4xl mx-auto px-6 py-5">
                        <div
                            className={`flex gap-3 items-end rounded-2xl p-1.5 transition-all ${isDark
                                ? "bg-gray-800/60 border-2 border-emerald-900/30 focus-within:border-emerald-600/50"
                                : "bg-white border-2 border-emerald-200 focus-within:border-emerald-500 shadow-lg"
                                }`}
                        >
                            <textarea
                                ref={inputRef}
                                rows={1}
                                className={`flex-1 px-4 py-3 bg-transparent resize-none focus:outline-none font-mono text-[15px] ${isDark
                                    ? "text-white placeholder-gray-500"
                                    : "text-gray-900 placeholder-gray-400"
                                    }`}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        send();
                                    }
                                }}
                                placeholder="Ask about nutrition..."
                                disabled={busy}
                                style={{ maxHeight: "200px" }}
                            />
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={send}
                                disabled={busy || !input.trim()}
                                className={`p-3 rounded-xl transition-all ${busy || !input.trim()
                                    ? isDark
                                        ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                    : isDark
                                        ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500"
                                        : "bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600"
                                    }`}
                            >
                                <Send className="w-5 h-5" />
                            </motion.button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Citations Sidebar */}
            <AnimatePresence>
                {showSidebar && currentMessageCitations.length > 0 && (
                    <motion.div
                        initial={{ x: isSidebarMinimized ? 280 : 320 }}
                        animate={{
                            x: 0,
                            width: isSidebarMinimized ? "60px" : "320px"
                        }}
                        exit={{ x: isSidebarMinimized ? 60 : 320 }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        className={`fixed right-0 top-0 bottom-0 border-l backdrop-blur-xl z-50 flex flex-col ${isDark
                            ? "bg-gray-900/95 border-emerald-900/20"
                            : "bg-white/95 border-emerald-200/30"
                            }`}
                    >
                        {/* Sidebar Header */}
                        <div
                            className={`px-6 py-5 border-b ${isDark ? "border-emerald-900/20" : "border-emerald-200/30"
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                {!isSidebarMinimized && (
                                    <h3
                                        className={`font-black text-lg uppercase tracking-tight ${isDark ? "text-white" : "text-gray-900"
                                            }`}
                                    >
                                        Sources
                                    </h3>
                                )}
                                <div className="flex gap-2">
                                    <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => setIsSidebarMinimized(!isSidebarMinimized)}
                                        className={`p-2 rounded-lg transition-colors ${isDark
                                            ? "hover:bg-white/5 text-gray-400"
                                            : "hover:bg-gray-100 text-gray-600"
                                            }`}
                                        title={isSidebarMinimized ? "Expand" : "Minimize"}
                                    >
                                        <svg
                                            className="w-5 h-5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            {isSidebarMinimized ? (
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                                                />
                                            ) : (
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M13 5l7 7-7 7M5 5l7 7-7 7"
                                                />
                                            )}
                                        </svg>
                                    </motion.button>
                                    {!isSidebarMinimized && (
                                        <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={() => setShowSidebar(false)}
                                            className={`p-2 rounded-lg transition-colors ${isDark
                                                ? "hover:bg-white/5 text-gray-400"
                                                : "hover:bg-gray-100 text-gray-600"
                                                }`}
                                        >
                                            <ChevronRight className="w-5 h-5" />
                                        </motion.button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Citations List */}
                        {!isSidebarMinimized ? (
                            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                                {currentMessageCitations.map((citation, i) => (
                                    <motion.button
                                        key={citation.id}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        whileHover={{ scale: 1.02 }}
                                        onClick={() => setSelectedCitation(citation)}
                                        className={`w-full text-left p-4 rounded-xl border transition-all ${selectedCitation?.id === citation.id
                                            ? isDark
                                                ? "bg-emerald-500/10 border-emerald-500/30"
                                                : "bg-emerald-50 border-emerald-300"
                                            : isDark
                                                ? "bg-gray-800/40 border-emerald-900/20 hover:bg-gray-800/60"
                                                : "bg-white border-emerald-200/50 hover:bg-emerald-50/50"
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div
                                                className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${isDark
                                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                                    : "bg-emerald-100 text-emerald-700 border border-emerald-300"
                                                    }`}
                                            >
                                                {citation.id}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div
                                                    className={`text-xs font-mono font-semibold mb-1 ${isDark ? "text-emerald-400/70" : "text-emerald-600/70"
                                                        }`}
                                                >
                                                    Page {citation.page} • {citation.similarity}%
                                                </div>
                                                <p
                                                    className={`text-sm font-mono leading-relaxed line-clamp-3 ${isDark ? "text-gray-300" : "text-gray-700"
                                                        }`}
                                                >
                                                    {citation.content}
                                                </p>
                                            </div>
                                        </div>
                                    </motion.button>
                                ))}
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
                                {currentMessageCitations.map((citation, i) => (
                                    <motion.button
                                        key={citation.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: i * 0.05 }}
                                        whileHover={{ scale: 1.1 }}
                                        onClick={() => {
                                            setSelectedCitation(citation);
                                            setIsSidebarMinimized(false);
                                        }}
                                        className={`w-full p-2 rounded-lg border transition-all ${selectedCitation?.id === citation.id
                                            ? isDark
                                                ? "bg-emerald-500/10 border-emerald-500/30"
                                                : "bg-emerald-50 border-emerald-300"
                                            : isDark
                                                ? "bg-gray-800/40 border-emerald-900/20 hover:bg-gray-800/60"
                                                : "bg-white border-emerald-200/50 hover:bg-emerald-50/50"
                                            }`}
                                        title={`Citation ${citation.id} - Page ${citation.page}`}
                                    >
                                        <div
                                            className={`text-sm font-bold ${isDark ? "text-emerald-400" : "text-emerald-600"
                                                }`}
                                        >
                                            {citation.id}
                                        </div>
                                    </motion.button>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Citation Detail Modal */}
            <AnimatePresence>
                {selectedCitation && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60]"
                            onClick={() => setSelectedCitation(null)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-full max-w-2xl mx-4 rounded-2xl overflow-hidden shadow-2xl ${isDark
                                ? "bg-gray-800 border-2 border-emerald-900/40"
                                : "bg-white border-2 border-emerald-200"
                                }`}
                            onClick={(e: any) => e.stopPropagation()}
                        >
                            <div
                                className={`px-6 py-4 border-b ${isDark
                                    ? "border-emerald-900/30 bg-gray-900/50"
                                    : "border-emerald-200 bg-emerald-50/50"
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${isDark
                                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                                : "bg-emerald-100 text-emerald-700 border border-emerald-300"
                                                }`}
                                        >
                                            {selectedCitation.id}
                                        </div>
                                        <div>
                                            <div
                                                className={`text-sm font-bold uppercase font-mono ${isDark ? "text-white" : "text-gray-900"
                                                    }`}
                                            >
                                                Source Reference
                                            </div>
                                            <div
                                                className={`text-xs font-mono ${isDark ? "text-emerald-400/70" : "text-emerald-600/70"
                                                    }`}
                                            >
                                                Page {selectedCitation.page} •{" "}
                                                {selectedCitation.similarity}% Match
                                            </div>
                                        </div>
                                    </div>
                                    <motion.button
                                        whileHover={{ scale: 1.1, rotate: 90 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => setSelectedCitation(null)}
                                        className={`p-2 rounded-lg transition-colors ${isDark
                                            ? "hover:bg-gray-700 text-gray-400"
                                            : "hover:bg-gray-100 text-gray-600"
                                            }`}
                                    >
                                        <svg
                                            className="w-5 h-5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M6 18L18 6M6 6l12 12"
                                            />
                                        </svg>
                                    </motion.button>
                                </div>
                            </div>
                            <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
                                <div
                                    className={`p-4 rounded-xl font-mono text-sm leading-[1.8] ${isDark
                                        ? "bg-emerald-950/30 text-emerald-100"
                                        : "bg-emerald-50 text-gray-800"
                                        }`}
                                >
                                    <span
                                        className={`inline-block px-2 py-1 rounded text-xs font-bold mb-3 ${isDark
                                            ? "bg-emerald-600/30 text-emerald-300"
                                            : "bg-emerald-200 text-emerald-800"
                                            }`}
                                    >
                                        CITED EXCERPT
                                    </span>
                                    <p className="whitespace-pre-wrap">
                                        {selectedCitation.fullContent}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}