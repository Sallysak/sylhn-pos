"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, X, Send, Bot, User, Loader2, TrendingUp,
  Package, AlertTriangle, DollarSign, Users, Truck, RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/client-auth";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface AiAssistantProps {
  open: boolean;
  onClose: () => void;
}

const SUGGESTED_QUESTIONS = [
  { icon: TrendingUp, text: "How is my business doing today?", color: "text-emerald-600" },
  { icon: Package, text: "Which products should I reorder?", color: "text-amber-600" },
  { icon: DollarSign, text: "What's my profit this month vs last month?", color: "text-blue-600" },
  { icon: Users, text: "Who are my top customers?", color: "text-purple-600" },
  { icon: Truck, text: "Which suppliers do I owe money to?", color: "text-rose-600" },
  { icon: AlertTriangle, text: "What products are expiring soon?", color: "text-orange-600" },
  { icon: TrendingUp, text: "What are my best-selling products this week?", color: "text-teal-600" },
  { icon: DollarSign, text: "How much cash should be in the drawer?", color: "text-indigo-600" },
];

export function AiAssistant({ open, onClose }: AiAssistantProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await authedFetch("/api/ai-assistant", {
        method: "POST",
        body: JSON.stringify({
          question: text,
          conversationHistory: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        // Session expired — redirect to login
        toast({ title: "Session expired", description: "Please log in again to use AI Assistant", variant: "destructive" });
        setTimeout(() => window.location.href = "/", 1500);
        return;
      }
      if (res.ok && data.success) {
        const aiMessage: ChatMessage = {
          role: "assistant",
          content: data.response,
          timestamp: data.timestamp,
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        toast({ title: "AI Error", description: data.error || "Failed to get response", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Network Error", description: e?.message || "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [loading, messages, toast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearConversation = () => {
    setMessages([]);
    toast({ title: "Conversation cleared" });
  };

  // Simple markdown-ish renderer (bold + bullet points + line breaks)
  const renderContent = (content: string) => {
    const lines = content.split("\n");
    return lines.map((line, i) => {
      // Bullet point
      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        return (
          <div key={i} className="flex gap-2 ml-2">
            <span className="text-emerald-500 flex-shrink-0">•</span>
            <span dangerouslySetInnerHTML={{ __html: line.trim().slice(2).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }} />
          </div>
        );
      }
      // Numbered list
      if (/^\d+\.\s/.test(line.trim())) {
        return (
          <div key={i} className="ml-2" dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }} />
        );
      }
      // Empty line
      if (!line.trim()) return <div key={i} className="h-2" />;
      // Regular paragraph
      return (
        <div key={i} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }} />
      );
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[80]"
          />

          {/* Panel — slides in from right */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-[81] flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex-shrink-0 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white px-5 py-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center ring-1 ring-white/30">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-bold text-base leading-tight">SYLHN AI</div>
                    <div className="text-[10px] text-violet-100/80 leading-tight">Business Intelligence Assistant</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {messages.length > 0 && (
                    <button
                      onClick={clearConversation}
                      className="h-8 w-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition"
                      title="Clear conversation"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="h-8 w-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-violet-100/80">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                Connected to your store data
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {messages.length === 0 ? (
                // Welcome screen with suggested questions
                <div className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl p-4 ring-1 ring-slate-200 shadow-sm"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-slate-800 mb-1">👋 Hello! I'm your AI assistant.</div>
                        <div className="text-xs text-slate-600">
                          I can analyze your sales, inventory, customers, and suppliers to help you make better business decisions.
                          Ask me anything, or tap a suggestion below.
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-1">💡 Suggested Questions</div>
                    {SUGGESTED_QUESTIONS.map((q, i) => {
                      const Icon = q.icon;
                      return (
                        <motion.button
                          key={i}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 * i }}
                          onClick={() => sendMessage(q.text)}
                          className="w-full flex items-center gap-2.5 bg-white rounded-xl p-3 ring-1 ring-slate-200 hover:ring-violet-300 hover:bg-violet-50 transition text-left group"
                        >
                          <div className={`h-7 w-7 rounded-lg bg-slate-100 group-hover:bg-violet-100 flex items-center justify-center transition ${q.color}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-xs font-medium text-slate-700 flex-1">{q.text}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // Conversation
                messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                        : "bg-gradient-to-br from-violet-500 to-indigo-600"
                    }`}>
                      {msg.role === "user" ? (
                        <User className="h-4 w-4 text-white" />
                      ) : (
                        <Bot className="h-4 w-4 text-white" />
                      )}
                    </div>
                    <div className={`flex-1 max-w-[85%] rounded-2xl p-3 text-sm ${
                      msg.role === "user"
                        ? "bg-emerald-600 text-white rounded-tr-sm"
                        : "bg-white text-slate-800 ring-1 ring-slate-200 rounded-tl-sm"
                    }`}>
                      {msg.role === "user" ? (
                        <div>{msg.content}</div>
                      ) : (
                        <div className="space-y-1 text-xs leading-relaxed">
                          {renderContent(msg.content)}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}

              {/* Loading indicator */}
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-2.5"
                >
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-white rounded-2xl rounded-tl-sm p-4 ring-1 ring-slate-200">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Analyzing your store data...
                    </div>
                    <div className="flex gap-1 mt-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input */}
            <div className="flex-shrink-0 p-3 bg-white border-t border-slate-200">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your business..."
                  disabled={loading}
                  className="flex-1 h-11 px-4 rounded-xl bg-slate-50 border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-violet-400 focus:bg-white transition disabled:opacity-50"
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={loading || !input.trim()}
                  className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 text-white flex items-center justify-center transition flex-shrink-0"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
              <div className="text-[9px] text-slate-400 text-center mt-1.5">
                AI analyzes your live store data · GHS amounts · Ghana context
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
