import { useState, useRef, useEffect, FormEvent } from 'react';
import { Bot, Sparkles, Send, Trash2, Copy, Check, ShieldCheck, CornerDownLeft, Loader2 } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome-1',
    role: 'model',
    text: `Chào các thí chủ! Tao là **SentinelBot AI** (Gemini 3.8 Flash) — chúa tể bảo mật kiêm thần khẩu nghiệp cọc tính nhất cái Discord này! 😈💀

⚡ **Nội quy trò chuyện:**
• 🛡️ **Hỏi kiến thức, code, bảo mật Discord:** Trả lời tận tình, chuẩn chỉ nhưng cấm lèo nhèo!
• 🤡 **Hỏi ngu, hỏi ngớ ngẩn, troll xàm xí:** Chuẩn bị tinh thần ăn mắng xối xả, khịa không trượt phát nào kèm combo emoji 🤣😂🤬😈💀💩🤡🖕!

Trên Discord gõ: \`.chat <câu hỏi>\`, \`.ai <nội dung>\` hoặc **tag thẳng mặt @SentinelBot** để thử độ cọc nha má!`,
    timestamp: 'Vừa xong'
  }
];

const SUGGESTIONS = [
  '🤡 Bấm vào link nhận Discord Nitro free có bị mất acc không bot?',
  '💩 1 + 1 bằng mấy hả bot?',
  '🛡️ Cách thiết lập Anti-Raid chống nuke server an toàn nhất?',
  '😈 Mày là ai mà cọc thế?',
  '⚠️ Làm sao để nhận biết mã độc token stealer?'
];

export default function AiChatBox() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend !== undefined ? textToSend : input).trim();
    if (!query || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (textToSend === undefined) {
      setInput('');
    }
    setIsLoading(true);

    try {
      // Chuẩn bị lịch sử trò chuyện gửi lên server
      const historyPayload = messages
        .filter((m) => m.id !== 'welcome-1')
        .slice(-6)
        .map((m) => ({ role: m.role, text: m.text }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: historyPayload
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'model',
        text: data.reply || 'Không nhận được câu trả lời.',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'model',
        text: `⚠️ Không thể nhận phản hồi từ AI: ${err.message || 'Lỗi mạng'}. Vui lòng thử lại!`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  const handleClear = () => {
    setMessages(INITIAL_MESSAGES);
  };

  return (
    <div className="bg-[#1E1F22] rounded-xl border border-[#2B2D31] overflow-hidden mb-8 shadow-xl flex flex-col">
      {/* Header */}
      <div className="bg-[#2B2D31]/80 p-4 border-b border-[#2B2D31] flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-[#5865F2] to-cyan-400 p-0.5 shadow-md">
              <div className="w-full h-full bg-[#1E1F22] rounded-[10px] flex items-center justify-center text-cyan-400">
                <Bot className="w-5 h-5" />
              </div>
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#1E1F22]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-white text-base">SentinelBot AI Assistant</h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                Gemini 3.8 Flash
              </span>
            </div>
            <p className="text-xs text-[#949BA4]">
              Trợ lý đàm thoại thông minh, chuyên gia bảo mật và quản trị Discord
            </p>
          </div>
        </div>

        <button
          onClick={handleClear}
          title="Xóa lịch sử trò chuyện"
          className="p-2 text-[#949BA4] hover:text-white hover:bg-[#313338] rounded-lg transition cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="p-4 sm:p-5 h-96 overflow-y-auto space-y-4 scroll-smooth bg-[#18191C]/70">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${
              msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            {/* Avatar */}
            {msg.role === 'user' ? (
              <div className="w-8 h-8 rounded-full bg-[#5865F2] text-white font-bold flex items-center justify-center text-xs shrink-0 shadow">
                U
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#5865F2] to-cyan-400 text-white flex items-center justify-center shrink-0 shadow">
                <ShieldCheck className="w-4 h-4" />
              </div>
            )}

            {/* Bubble */}
            <div
              className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-3.5 text-sm leading-relaxed shadow-sm relative group ${
                msg.role === 'user'
                  ? 'bg-[#5865F2] text-white rounded-tr-none'
                  : 'bg-[#2B2D31] text-gray-200 rounded-tl-none border border-[#35373C]'
              }`}
            >
              <div className="whitespace-pre-wrap font-sans break-words selection:bg-indigo-600/50">
                {msg.text}
              </div>

              <div className="mt-2 pt-1 flex items-center justify-between border-t border-white/10 text-[11px] text-[#949BA4]">
                <span>{msg.timestamp}</span>
                {msg.role === 'model' && (
                  <button
                    onClick={() => handleCopy(msg.text, msg.id)}
                    className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1 text-xs text-gray-400 hover:text-white cursor-pointer ml-2"
                  >
                    {copiedId === msg.id ? (
                      <>
                        <Check className="w-3 h-3 text-green-400" />
                        <span className="text-green-400">Đã chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Sao chép</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#5865F2] to-cyan-400 text-white flex items-center justify-center shrink-0 shadow">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="bg-[#2B2D31] rounded-2xl rounded-tl-none p-3.5 border border-[#35373C] flex items-center space-x-2 text-sm text-gray-300">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              <span>SentinelBot AI đang suy nghĩ...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Questions */}
      <div className="px-4 py-2.5 bg-[#1E1F22] border-t border-[#2B2D31] overflow-x-auto scrollbar-none flex items-center gap-2">
        <span className="text-[11px] text-[#949BA4] font-medium shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          Gợi ý nhanh:
        </span>
        {SUGGESTIONS.map((s, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(s)}
            disabled={isLoading}
            className="text-xs px-2.5 py-1 bg-[#2B2D31] hover:bg-[#35373C] disabled:opacity-50 text-gray-300 hover:text-white rounded-full transition whitespace-nowrap cursor-pointer border border-transparent hover:border-gray-600"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <div className="p-3.5 bg-[#2B2D31]/50 border-t border-[#2B2D31]">
        <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Hỏi SentinelBot AI bất cứ điều gì (Bảo mật Discord, luật server, mẹo game...)..."
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 bg-[#111214] border border-[#35373C] focus:border-[#5865F2] rounded-xl text-sm text-white placeholder-[#949BA4] outline-none transition disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex items-center justify-center gap-1 px-5 py-2.5 bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-50 disabled:hover:bg-[#5865F2] text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-md"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Gửi</span>
            <CornerDownLeft className="w-3 h-3 sm:hidden" />
          </button>
        </form>
        <div className="flex items-center justify-between text-[11px] text-[#949BA4] mt-2 px-1">
          <span>💡 Trên Discord gõ: <code className="text-cyan-300">.chat &lt;câu hỏi&gt;</code> hoặc tag <code className="text-cyan-300">@SentinelBot</code></span>
          <span>Shift + Enter để xuống dòng</span>
        </div>
      </div>
    </div>
  );
}
