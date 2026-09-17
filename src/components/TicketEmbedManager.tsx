import { useState, useEffect } from 'react';
import {
  Ticket,
  LayoutTemplate,
  Send,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Hash,
  Palette,
  Image as ImageIcon,
  HelpCircle,
  ShieldCheck,
  Lock,
  ExternalLink,
  MessageSquarePlus,
  Terminal,
  Layers,
  Sparkles,
  Bot
} from 'lucide-react';

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  channels: Array<{ id: string; name: string; type: number }>;
}

interface TicketConfigData {
  panelTitle: string;
  panelDescription: string;
  panelColor: string;
  panelImageUrl?: string;
  panelButtonLabel: string;
  supportRoleId?: string;
  categoryName?: string;
}

export default function TicketEmbedManager() {
  const [activeTab, setActiveTab] = useState<'ticket' | 'embed' | 'commands'>('ticket');

  // Discord Guilds & Channels
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [loadingChannels, setLoadingChannels] = useState(false);

  // Ticket Panel Config
  const [ticketConfig, setTicketConfig] = useState<TicketConfigData>({
    panelTitle: '📩 HỆ THỐNG HỖ TRỢ TICKET',
    panelDescription: `Vui lòng nhấn nút bên dưới để tạo ticket khi bạn cần trung gian mua bán, trao đổi tài sản để tránh lừa đảo.

Khi vào ticket, vui lòng cung cấp đầy đủ thông tin:
• **Bên mua:** @tag
• **Bên bán:** @tag
• **Nội dung giao dịch:**
• **Số tiền / Giá trị:**
• **Ai chịu phí trung gian:**

⚠️ **Lưu ý:** Tuyệt đối không giao dịch ngoài ticket hoặc chuyển tiền khi chưa có xác nhận từ Admin chính thức!

👉 **Bấm vào nút bên dưới để tạo phiên làm việc với support team.**`,
    panelColor: '#5865F2',
    panelImageUrl: 'https://i.pinimg.com/1200x/61/05/82/610582ed1ad99e5e455fe16a4b3a9ab1.jpg',
    panelButtonLabel: '🎟️ Tạo Ticket',
    categoryName: 'TICKETS',
  });

  // Custom Embed Builder State
  const [embedData, setEmbedData] = useState({
    title: '📢 THÔNG BÁO MÁY CHỦ',
    description: 'Nội dung thông báo mới từ ban quản trị máy chủ. Hãy đọc kỹ quy định để tránh vi phạm!',
    color: '#5865F2',
    imageUrl: 'https://i.pinimg.com/1200x/61/05/82/610582ed1ad99e5e455fe16a4b3a9ab1.jpg',
    thumbnailUrl: '',
    footerText: 'SentinelBot • Thông Báo Chính Thức',
    authorName: 'Ban Quản Trị Server',
  });

  const [isSending, setIsSending] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch discord channels with safe retry
  const fetchChannels = async (retries = 2) => {
    setLoadingChannels(true);
    try {
      const res = await fetch('/api/discord/channels');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.guilds)) {
          setGuilds(data.guilds);
          // Chọn channel đầu tiên nếu chưa chọn
          if (data.guilds[0]?.channels[0]) {
            setSelectedChannelId((prev) => prev || data.guilds[0].channels[0].id);
          }
          return;
        }
      }
      if (retries > 0) {
        setTimeout(() => fetchChannels(retries - 1), 1500);
      }
    } catch {
      if (retries > 0) {
        setTimeout(() => fetchChannels(retries - 1), 1500);
      }
    } finally {
      setLoadingChannels(false);
    }
  };

  // Fetch ticket config with safe retry
  const fetchTicketConfig = async (retries = 2) => {
    try {
      const res = await fetch('/api/ticket/config');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.config) {
          setTicketConfig(data.config);
          return;
        }
      }
      if (retries > 0) {
        setTimeout(() => fetchTicketConfig(retries - 1), 1500);
      }
    } catch {
      if (retries > 0) {
        setTimeout(() => fetchTicketConfig(retries - 1), 1500);
      }
    }
  };

  useEffect(() => {
    fetchChannels();
    fetchTicketConfig();
  }, []);

  const handleSaveTicketConfig = async () => {
    setIsSavingConfig(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/ticket/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketConfig),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({ type: 'success', text: 'Đã lưu cấu hình Ticket mặc định thành công!' });
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Lỗi khi lưu cấu hình' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Lỗi kết nối' });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSendTicketPanel = async () => {
    if (!selectedChannelId) {
      setStatusMessage({ type: 'error', text: 'Vui lòng chọn một kênh Discord để gửi Bảng Ticket!' });
      return;
    }

    setIsSending(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/ticket/send-panel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: selectedChannelId,
          customConfig: ticketConfig,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: `🎉 Đã gửi Bảng Tạo Ticket thành công vào kênh #${data.channelName}!`,
        });
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Không thể gửi bảng ticket' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Lỗi kết nối khi gửi' });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendCustomEmbed = async () => {
    if (!selectedChannelId) {
      setStatusMessage({ type: 'error', text: 'Vui lòng chọn một kênh Discord để gửi Embed!' });
      return;
    }

    setIsSending(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/embed/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: selectedChannelId,
          ...embedData,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage({
          type: 'success',
          text: `🎉 Đã gửi tin nhắn Embed thành công vào kênh #${data.channelName}!`,
        });
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Không thể gửi Embed' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Lỗi kết nối khi gửi' });
    } finally {
      setIsSending(false);
    }
  };

  // Tìm tên channel được chọn
  let currentChannelName = 'chưa chọn';
  for (const g of guilds) {
    const ch = g.channels.find((c) => c.id === selectedChannelId);
    if (ch) {
      currentChannelName = `${g.name} > #${ch.name}`;
      break;
    }
  }

  return (
    <div id="ticket-embed-section" className="bg-[#1E1F22] border border-[#2B2D31] rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2B2D31] pb-5">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-[#5865F2]/20 border border-[#5865F2]/40 rounded-xl text-[#5865F2]">
            <Ticket className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-black text-white tracking-wide">Hệ Thống Ticket & Embed Builder</h2>
              <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-medium">
                Discord Ready
              </span>
            </div>
            <p className="text-sm text-[#949BA4] mt-0.5">
              Tạo bảng hỗ trợ trung gian, giao dịch an toàn với nút bấm tự động tạo kênh riêng tư & trình tạo Embed chuyên nghiệp
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-[#2B2D31] p-1 rounded-xl border border-[#35373C]">
          <button
            onClick={() => setActiveTab('ticket')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'ticket'
                ? 'bg-[#5865F2] text-white shadow-md'
                : 'text-[#949BA4] hover:text-white hover:bg-[#35373C]'
            }`}
          >
            <Ticket className="w-4 h-4" />
            <span>Bảng Ticket</span>
          </button>
          <button
            onClick={() => setActiveTab('embed')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'embed'
                ? 'bg-[#5865F2] text-white shadow-md'
                : 'text-[#949BA4] hover:text-white hover:bg-[#35373C]'
            }`}
          >
            <LayoutTemplate className="w-4 h-4" />
            <span>Embed Builder</span>
          </button>
          <button
            onClick={() => setActiveTab('commands')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'commands'
                ? 'bg-[#5865F2] text-white shadow-md'
                : 'text-[#949BA4] hover:text-white hover:bg-[#35373C]'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Lệnh Discord</span>
          </button>
        </div>
      </div>

      {/* Global Channel Selector bar */}
      <div className="bg-[#2B2D31]/70 border border-[#35373C] p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5 text-sm text-[#DBDEE1]">
          <Hash className="w-4 h-4 text-[#5865F2]" />
          <span className="font-medium text-xs text-[#949BA4]">Kênh Discord mục tiêu:</span>
          <span className="text-white font-semibold text-xs bg-[#1E1F22] px-2.5 py-1 rounded border border-[#35373C]">
            {currentChannelName}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={selectedChannelId}
            onChange={(e) => setSelectedChannelId(e.target.value)}
            disabled={loadingChannels || guilds.length === 0}
            className="bg-[#1E1F22] border border-[#35373C] text-xs text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#5865F2] transition max-w-xs"
          >
            {guilds.length === 0 ? (
              <option value="">(Không có máy chủ nào hoặc Bot đang offline)</option>
            ) : (
              guilds.map((g) => (
                <optgroup key={g.id} label={g.name}>
                  {g.channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      #{c.name}
                    </option>
                  ))}
                </optgroup>
              ))
            )}
          </select>
          <button
            onClick={fetchChannels}
            disabled={loadingChannels}
            title="Làm mới danh sách kênh"
            className="p-1.5 bg-[#35373C] hover:bg-[#404249] text-[#DBDEE1] rounded-lg transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingChannels ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status Alert */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center space-x-2 text-sm ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* TAB 1: TICKET PANEL CREATOR & LIVE DISCORD PREVIEW */}
      {activeTab === 'ticket' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Cột trái: Thiết lập Bảng Ticket */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-[#2B2D31]/40 border border-[#35373C] p-4 rounded-xl space-y-3.5">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Layers className="w-4 h-4 text-[#5865F2]" />
                <span>Nội Dung Bảng Tạo Ticket</span>
              </h3>

              {/* Panel Title */}
              <div>
                <label className="block text-xs font-semibold text-[#B5BAC1] mb-1">Tiêu Đề Embed</label>
                <input
                  type="text"
                  value={ticketConfig.panelTitle}
                  onChange={(e) => setTicketConfig({ ...ticketConfig, panelTitle: e.target.value })}
                  placeholder="Ví dụ: 📩 HỆ THỐNG HỖ TRỢ TICKET"
                  className="w-full bg-[#1E1F22] border border-[#35373C] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5865F2]"
                />
              </div>

              {/* Panel Description */}
              <div>
                <label className="block text-xs font-semibold text-[#B5BAC1] mb-1">
                  Nội Dung Hướng Dẫn (Hỗ trợ Markdown)
                </label>
                <textarea
                  rows={8}
                  value={ticketConfig.panelDescription}
                  onChange={(e) => setTicketConfig({ ...ticketConfig, panelDescription: e.target.value })}
                  placeholder="Nhập nội dung quy định, mẫu điền giao dịch trung gian..."
                  className="w-full bg-[#1E1F22] border border-[#35373C] rounded-lg p-3 text-xs text-white focus:outline-none focus:border-[#5865F2] font-mono leading-relaxed"
                />
              </div>

              {/* Image URL & Color */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-[#B5BAC1]">Link Ảnh Banner (Image URL)</label>
                    {ticketConfig.panelImageUrl && (
                      <button
                        type="button"
                        onClick={() => setTicketConfig({ ...ticketConfig, panelImageUrl: '' })}
                        className="text-[11px] text-rose-400 hover:underline"
                      >
                        Xóa ảnh
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={ticketConfig.panelImageUrl || ''}
                    onChange={(e) => setTicketConfig({ ...ticketConfig, panelImageUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-[#1E1F22] border border-[#35373C] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5865F2]"
                  />

                  {/* Preset Banner Images */}
                  <div className="mt-2">
                    <span className="text-[11px] text-[#949BA4] block mb-1.5 font-medium">✨ Chọn nhanh ảnh banner mẫu:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {[
                        { label: '🖤 Anime Boy (Đang chọn)', url: 'https://i.pinimg.com/1200x/61/05/82/610582ed1ad99e5e455fe16a4b3a9ab1.jpg' },
                        { label: '🌸 Anime Support', url: 'https://images2.alphacoders.com/131/1314480.jpeg' },
                        { label: '⚡ Cyber Neon', url: 'https://images8.alphacoders.com/134/1342674.png' },
                        { label: '🛡️ Bảo Mật Pro', url: 'https://wallpapers.com/images/hd/discord-banner-background-7935v61y2y0o59l9.jpg' },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setTicketConfig({ ...ticketConfig, panelImageUrl: preset.url })}
                          className={`px-2 py-1 rounded text-[10px] font-medium border truncate transition text-left ${
                            ticketConfig.panelImageUrl === preset.url
                              ? 'bg-[#5865F2]/20 border-[#5865F2] text-white'
                              : 'bg-[#1E1F22] border-[#35373C] text-[#949BA4] hover:text-white hover:border-[#4E5058]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-[#949BA4] mt-1.5">
                    💡 <em>Mẹo:</em> Bạn cũng có thể tải ảnh trực tiếp trên Discord bằng lệnh <code className="text-[#5865F2] bg-[#1E1F22] px-1 rounded">.ticket image</code> kèm file ảnh hoặc <code className="text-[#5865F2] bg-[#1E1F22] px-1 rounded">/ticket setup image: ...</code>
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#B5BAC1] mb-1">Màu Viền Embed (HEX)</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={ticketConfig.panelColor}
                      onChange={(e) => setTicketConfig({ ...ticketConfig, panelColor: e.target.value })}
                      className="w-8 h-8 rounded border border-[#35373C] bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={ticketConfig.panelColor}
                      onChange={(e) => setTicketConfig({ ...ticketConfig, panelColor: e.target.value })}
                      className="flex-1 bg-[#1E1F22] border border-[#35373C] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5865F2] font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Button Label & Category Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#B5BAC1] mb-1">Nhãn Nút Bấm</label>
                  <input
                    type="text"
                    value={ticketConfig.panelButtonLabel}
                    onChange={(e) => setTicketConfig({ ...ticketConfig, panelButtonLabel: e.target.value })}
                    placeholder="🎟️ Tạo Ticket"
                    className="w-full bg-[#1E1F22] border border-[#35373C] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5865F2]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#B5BAC1] mb-1">Tên Danh Mục (Category Discord)</label>
                  <input
                    type="text"
                    value={ticketConfig.categoryName || 'TICKETS'}
                    onChange={(e) => setTicketConfig({ ...ticketConfig, categoryName: e.target.value })}
                    placeholder="TICKETS"
                    className="w-full bg-[#1E1F22] border border-[#35373C] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5865F2]"
                  />
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleSendTicketPanel}
                disabled={isSending || !selectedChannelId}
                className="flex-1 bg-[#23A55A] hover:bg-[#1E8A4B] text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition shadow-lg shadow-emerald-950/40 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{isSending ? 'Đang gửi...' : '🚀 Gửi Bảng Ticket Vào Discord'}</span>
              </button>
              <button
                onClick={handleSaveTicketConfig}
                disabled={isSavingConfig}
                className="bg-[#35373C] hover:bg-[#404249] text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingConfig ? 'Đang lưu...' : 'Lưu Mẫu'}</span>
              </button>
            </div>
          </div>

          {/* Cột phải: Live Discord Embed Preview (Y hệt giao diện trong ảnh của người dùng) */}
          <div className="lg:col-span-6 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-[#B5BAC1] uppercase tracking-wider flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#5865F2]" />
                <span>Xem Trước Trực Quan (Discord Live Preview)</span>
              </span>
              <span className="text-[11px] text-[#949BA4]">Hiển thị giống 100% khi gửi vào Discord</span>
            </div>

            {/* Discord Message Container Mockup */}
            <div className="bg-[#313338] border border-[#2B2D31] rounded-xl p-4 shadow-2xl space-y-3 font-sans">
              {/* Bot Author Header */}
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#5865F2] to-indigo-800 flex items-center justify-center text-white font-bold text-sm shadow-md overflow-hidden flex-shrink-0">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-white text-sm hover:underline cursor-pointer">
                    SentinelBot
                  </span>
                  <span className="bg-[#5865F2] text-white text-[10px] font-bold px-1.5 py-0.5 rounded leading-none uppercase">
                    APP
                  </span>
                  <span className="text-[#949BA4] text-xs">Hôm nay lúc 18:22</span>
                </div>
              </div>

              {/* Discord Embed Box */}
              <div
                className="bg-[#2B2D31] rounded-lg border-l-4 p-4 space-y-3 max-w-xl shadow-inner transition-colors"
                style={{ borderLeftColor: ticketConfig.panelColor || '#5865F2' }}
              >
                {/* Embed Title */}
                <h4 className="text-white font-bold text-sm tracking-wide flex items-center space-x-1.5">
                  <span>{ticketConfig.panelTitle || 'HỆ THỐNG TICKET'}</span>
                </h4>

                {/* Embed Description (Markdown parsed look) */}
                <div className="text-[#DBDEE1] text-xs leading-relaxed whitespace-pre-line">
                  {ticketConfig.panelDescription}
                </div>

                {/* Embed Banner Image */}
                {ticketConfig.panelImageUrl && (
                  <div className="rounded-lg overflow-hidden border border-[#1E1F22] mt-3">
                    <img
                      src={ticketConfig.panelImageUrl}
                      alt="Ticket Banner"
                      className="w-full max-h-64 object-cover"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* Embed Footer */}
                <div className="pt-2 border-t border-[#35373C] text-[11px] text-[#949BA4] flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#5865F2]" />
                  <span>SentinelBot Ticket System • Uy Tín & An Toàn</span>
                </div>
              </div>

              {/* Action Button Row */}
              <div className="pt-1">
                <div className="inline-flex items-center space-x-2 bg-[#23A55A] hover:bg-[#1E8A4B] text-white px-3.5 py-1.5 rounded text-xs font-semibold shadow transition cursor-pointer select-none">
                  <span>{ticketConfig.panelButtonLabel || '🎟️ Tạo Ticket'}</span>
                </div>
              </div>

              {/* How it works note */}
              <div className="bg-[#1E1F22]/80 border border-[#35373C] rounded-lg p-3 text-[11px] text-[#949BA4] space-y-1.5">
                <p className="font-semibold text-[#DBDEE1] flex items-center space-x-1">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Cơ chế tạo kênh tự động an toàn:</span>
                </p>
                <p>
                  1. Khi người dùng bấm nút <strong className="text-white">"{ticketConfig.panelButtonLabel}"</strong>, Bot sẽ tạo một phòng chat riêng tư có tên <code className="text-emerald-400 bg-[#2B2D31] px-1 rounded">ticket-username</code>.
                </p>
                <p>
                  2. Kênh chỉ hiển thị cho <strong className="text-white">người tạo ticket</strong> và <strong className="text-white">Ban Quản Trị / Support</strong>. Mọi người khác trong server hoàn toàn bị ẩn để bảo mật thông tin tài sản, hóa đơn.
                </p>
                <p>
                  3. Trong kênh có sẵn nút <strong className="text-rose-400">🔒 Đóng Ticket</strong> và <strong className="text-[#5865F2]">🔔 Gọi Admin</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CUSTOM EMBED BUILDER */}
      {activeTab === 'embed' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Cột trái: Soạn thảo Embed */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-[#2B2D31]/40 border border-[#35373C] p-4 rounded-xl space-y-3.5">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Palette className="w-4 h-4 text-[#5865F2]" />
                <span>Thiết Kế Embed Tùy Chỉnh</span>
              </h3>

              {/* Author & Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#B5BAC1] mb-1">Tên Tác Giả (Author)</label>
                  <input
                    type="text"
                    value={embedData.authorName}
                    onChange={(e) => setEmbedData({ ...embedData, authorName: e.target.value })}
                    placeholder="Ban Quản Trị Server"
                    className="w-full bg-[#1E1F22] border border-[#35373C] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5865F2]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#B5BAC1] mb-1">Tiêu Đề (Title)</label>
                  <input
                    type="text"
                    value={embedData.title}
                    onChange={(e) => setEmbedData({ ...embedData, title: e.target.value })}
                    placeholder="📢 THÔNG BÁO MỚI"
                    className="w-full bg-[#1E1F22] border border-[#35373C] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5865F2]"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-[#B5BAC1] mb-1">
                  Nội Dung (Description - Hỗ trợ Markdown, bold, link, code)
                </label>
                <textarea
                  rows={6}
                  value={embedData.description}
                  onChange={(e) => setEmbedData({ ...embedData, description: e.target.value })}
                  placeholder="Nội dung chính..."
                  className="w-full bg-[#1E1F22] border border-[#35373C] rounded-lg p-3 text-xs text-white focus:outline-none focus:border-[#5865F2] font-mono leading-relaxed"
                />
              </div>

              {/* Color Presets */}
              <div>
                <label className="block text-xs font-semibold text-[#B5BAC1] mb-1">Màu Sắc Viền Embed</label>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {[
                    { name: 'Discord Blue', hex: '#5865F2' },
                    { name: 'Emerald', hex: '#22C55E' },
                    { name: 'Danger Red', hex: '#ED4245' },
                    { name: 'Amber Gold', hex: '#F59E0B' },
                    { name: 'Fuchsia VIP', hex: '#D946EF' },
                    { name: 'Cyan Neon', hex: '#06B6D4' },
                  ].map((preset) => (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setEmbedData({ ...embedData, color: preset.hex })}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-medium border border-[#35373C] hover:scale-105 transition"
                      style={{ backgroundColor: `${preset.hex}20`, color: preset.hex }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: preset.hex }}></span>
                      <span>{preset.name}</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="color"
                    value={embedData.color}
                    onChange={(e) => setEmbedData({ ...embedData, color: e.target.value })}
                    className="w-8 h-8 rounded border border-[#35373C] bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={embedData.color}
                    onChange={(e) => setEmbedData({ ...embedData, color: e.target.value })}
                    className="w-32 bg-[#1E1F22] border border-[#35373C] rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Image & Thumbnail URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#B5BAC1] mb-1">Ảnh Lớn (Image URL)</label>
                  <input
                    type="text"
                    value={embedData.imageUrl}
                    onChange={(e) => setEmbedData({ ...embedData, imageUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-[#1E1F22] border border-[#35373C] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5865F2]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#B5BAC1] mb-1">Ảnh Nhỏ Góc Phải (Thumbnail)</label>
                  <input
                    type="text"
                    value={embedData.thumbnailUrl}
                    onChange={(e) => setEmbedData({ ...embedData, thumbnailUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-[#1E1F22] border border-[#35373C] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5865F2]"
                  />
                </div>
              </div>

              {/* Footer */}
              <div>
                <label className="block text-xs font-semibold text-[#B5BAC1] mb-1">Chân Trang (Footer Text)</label>
                <input
                  type="text"
                  value={embedData.footerText}
                  onChange={(e) => setEmbedData({ ...embedData, footerText: e.target.value })}
                  placeholder="SentinelBot • Thông Báo"
                  className="w-full bg-[#1E1F22] border border-[#35373C] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5865F2]"
                />
              </div>
            </div>

            <button
              onClick={handleSendCustomEmbed}
              disabled={isSending || !selectedChannelId}
              className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white px-4 py-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition shadow-lg shadow-indigo-950/40 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSending ? 'Đang gửi vào Discord...' : `🚀 Gửi Embed Vào ${currentChannelName}`}</span>
            </button>
          </div>

          {/* Cột phải: Live Preview */}
          <div className="lg:col-span-6 space-y-2">
            <span className="text-xs font-bold text-[#B5BAC1] uppercase tracking-wider flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#5865F2]" />
              <span>Xem Trước Embed (Realtime Preview)</span>
            </span>

            <div className="bg-[#313338] border border-[#2B2D31] rounded-xl p-4 shadow-2xl space-y-3 font-sans">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center text-white font-bold text-sm shadow">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-white text-sm">SentinelBot</span>
                  <span className="bg-[#5865F2] text-white text-[10px] font-bold px-1.5 py-0.5 rounded leading-none uppercase">
                    APP
                  </span>
                  <span className="text-[#949BA4] text-xs">Vừa xong</span>
                </div>
              </div>

              {/* The Embed Box */}
              <div
                className="bg-[#2B2D31] rounded-lg border-l-4 p-4 space-y-3 shadow-inner"
                style={{ borderLeftColor: embedData.color || '#5865F2' }}
              >
                {/* Author */}
                {embedData.authorName && (
                  <div className="text-xs font-semibold text-[#DBDEE1] flex items-center space-x-1.5">
                    <span>{embedData.authorName}</span>
                  </div>
                )}

                {/* Title & Thumbnail */}
                <div className="flex justify-between items-start gap-3">
                  {embedData.title && (
                    <h4 className="text-white font-bold text-sm tracking-wide">{embedData.title}</h4>
                  )}
                  {embedData.thumbnailUrl && (
                    <img
                      src={embedData.thumbnailUrl}
                      alt="Thumbnail"
                      className="w-16 h-16 rounded object-cover flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}
                </div>

                {/* Description */}
                <div className="text-[#DBDEE1] text-xs leading-relaxed whitespace-pre-line">
                  {embedData.description}
                </div>

                {/* Main Image */}
                {embedData.imageUrl && (
                  <div className="rounded-lg overflow-hidden border border-[#1E1F22] mt-2">
                    <img
                      src={embedData.imageUrl}
                      alt="Embed Banner"
                      className="w-full max-h-64 object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* Footer & Timestamp */}
                {embedData.footerText && (
                  <div className="pt-2 border-t border-[#35373C] text-[11px] text-[#949BA4] flex items-center justify-between">
                    <span>{embedData.footerText}</span>
                    <span>Hôm nay lúc {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: COMMAND CHEATSHEET */}
      {activeTab === 'commands' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#2B2D31]/40 border border-[#35373C] p-4 rounded-xl space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Ticket className="w-4 h-4 text-emerald-400" />
              <span>Lệnh Ticket (Slash & Prefix)</span>
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="bg-[#1E1F22] p-2.5 rounded-lg border border-[#35373C]">
                <code className="text-emerald-400 font-bold block mb-1">/ticket setup [channel] [image] [attachment]</code>
                <span className="text-[#949BA4]">
                  Gửi Bảng Tạo Ticket vào kênh, hỗ trợ đính kèm file ảnh trực tiếp hoặc dán link ảnh banner.
                </span>
              </div>
              <div className="bg-[#1E1F22] p-2.5 rounded-lg border border-[#35373C]">
                <code className="text-emerald-400 font-bold block mb-1">/ticket setimage [url] [file]</code>
                <span className="text-[#949BA4]">
                  Cài đặt hoặc thay đổi ảnh banner mới cho Bảng Ticket bằng link URL hoặc file tải lên.
                </span>
              </div>
              <div className="bg-[#1E1F22] p-2.5 rounded-lg border border-[#35373C]">
                <code className="text-emerald-400 font-bold block mb-1">.ticket image (đính kèm ảnh từ máy)</code>
                <span className="text-[#949BA4]">
                  Gõ lệnh và upload ảnh từ điện thoại/máy tính để đổi ảnh banner Ticket ngay lập tức!
                </span>
              </div>
              <div className="bg-[#1E1F22] p-2.5 rounded-lg border border-[#35373C]">
                <code className="text-emerald-400 font-bold block mb-1">.ticket setup [kênh] [link_ảnh]</code>
                <span className="text-[#949BA4]">
                  Lệnh prefix nhanh gửi bảng tạo ticket, tự nhận diện link ảnh hoặc file ảnh đính kèm.
                </span>
              </div>
              <div className="bg-[#1E1F22] p-2.5 rounded-lg border border-[#35373C]">
                <code className="text-rose-400 font-bold block mb-1">/ticket close hoặc .close</code>
                <span className="text-[#949BA4]">
                  Đóng và xóa kênh ticket hiện tại sau 5 giây.
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#2B2D31]/40 border border-[#35373C] p-4 rounded-xl space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <LayoutTemplate className="w-4 h-4 text-[#5865F2]" />
              <span>Lệnh Embed (Slash & Prefix)</span>
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="bg-[#1E1F22] p-2.5 rounded-lg border border-[#35373C]">
                <code className="text-[#5865F2] font-bold block mb-1">/embed description: ... [image] [attachment]</code>
                <span className="text-[#949BA4]">
                  Tạo Embed bằng Slash Command, hỗ trợ tải file ảnh trực tiếp hoặc dán URL ảnh lớn / thumbnail.
                </span>
              </div>
              <div className="bg-[#1E1F22] p-2.5 rounded-lg border border-[#35373C]">
                <code className="text-[#5865F2] font-bold block mb-1">
                  .embed [Tiêu đề] | [Nội dung] (Đính kèm ảnh từ máy)
                </code>
                <span className="text-[#949BA4]">
                  Chỉ cần gõ lệnh và upload ảnh trực tiếp trên Discord, bot tự động đưa ảnh vào khung Embed!
                </span>
              </div>
              <div className="bg-[#1E1F22] p-2.5 rounded-lg border border-[#35373C]">
                <code className="text-[#5865F2] font-bold block mb-1">
                  .embed [Tiêu đề] | [Nội dung] | [Màu Hex] | [Link ảnh]
                </code>
                <span className="text-[#949BA4]">
                  Cú pháp tạo Embed truyền thống bằng đường link URL ảnh trực tiếp.
                </span>
              </div>
              <div className="bg-[#1E1F22] p-2.5 rounded-lg border border-[#35373C]">
                <code className="text-amber-400 font-bold block mb-1">Web Dashboard 1-Click</code>
                <span className="text-[#949BA4]">
                  Sử dụng công cụ trực quan tại tab <strong className="text-white">"Embed Builder"</strong> bên trên để xem trước realtime và gửi ngay vào kênh!
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
