import { useState, useEffect, useCallback, FormEvent } from 'react';
import {
  Gamepad2,
  Tv,
  Headphones,
  Radio,
  Trophy,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Copy,
  ExternalLink,
  Code2,
  Sliders,
  Play
} from 'lucide-react';
import { BotRpcConfig } from '../types';

interface RpcManagerProps {
  botName: string | null;
  botOnline: boolean;
}

const DEFAULT_CONFIG: BotRpcConfig = {
  activityType: 'Watching',
  activityName: '🛡️ Bảo vệ máy chủ | .help',
  status: 'online',
  streamUrl: 'https://www.twitch.tv/sentinelbot_defense',
  state: 'Lá chắn Anti-Raid & Gemini AI',
  autoRotate: true,
  intervalSeconds: 30,
};

const PRESET_ACTIVITIES = [
  {
    type: 'Watching' as const,
    name: '🛡️ Bảo vệ máy chủ | .help',
    state: 'Chống Nuke & Raid 24/7',
    status: 'online' as const,
  },
  {
    type: 'Playing' as const,
    name: '🤖 Gemini 3.8 Flash | .chat',
    state: 'AI Cọc Tính & Siêu Cà Khịa 🤣💀',
    status: 'online' as const,
  },
  {
    type: 'Listening' as const,
    name: '🎵 Nhạc lossless 320kbps | .play',
    state: 'DJ Voice Channel',
    status: 'idle' as const,
  },
  {
    type: 'Streaming' as const,
    name: '🔴 Trực tiếp Dev Discord Bot',
    state: 'twitch.tv/sentinelbot_defense',
    status: 'dnd' as const,
    url: 'https://www.twitch.tv/sentinelbot_defense',
  },
  {
    type: 'Competing' as const,
    name: '🏆 Top 1 Bot Bảo Mật VN',
    state: 'Sentinel Security System',
    status: 'online' as const,
  },
];

export default function RpcManager({ botName, botOnline }: RpcManagerProps) {
  const [activeTab, setActiveTab] = useState<'bot' | 'custom'>('bot');
  const [config, setConfig] = useState<BotRpcConfig>(DEFAULT_CONFIG);
  const [isApplying, setIsApplying] = useState(false);
  const [notification, setNotification] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  // Custom User RPC Generator State
  const [customAppId, setCustomAppId] = useState('123456789012345678');
  const [customDetails, setCustomDetails] = useState('Đang code dự án Fullstack');
  const [customState, setCustomState] = useState('Phòng thủ server SentinelBot');
  const [customLargeImage, setCustomLargeImage] = useState('logo_shield');
  const [customLargeText, setCustomLargeText] = useState('SentinelBot Security');
  const [customButtonText, setCustomButtonText] = useState('Ghé Thăm Dashboard');
  const [customButtonUrl, setCustomButtonUrl] = useState('https://ai.studio');

  const fetchRpc = useCallback(async () => {
    try {
      const res = await fetch('/api/rpc');
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setConfig(data.config);
        }
      }
    } catch {
      // Graceful fallback
    }
  }, []);

  useEffect(() => {
    fetchRpc();
  }, [fetchRpc]);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3500);
  };

  const handleApplyRpc = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setIsApplying(true);
    try {
      const res = await fetch('/api/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        showToast('✅ Đã áp dụng Rich Presence mới cho Bot thành công!');
      } else {
        showToast('⚠️ Không thể áp dụng, kiểm tra lại kết nối bot');
      }
    } catch {
      showToast('❌ Lỗi kết nối khi áp dụng RPC');
    } finally {
      setIsApplying(false);
    }
  };

  const handleApplyPreset = (preset: typeof PRESET_ACTIVITIES[0]) => {
    const updated: BotRpcConfig = {
      ...config,
      activityType: preset.type,
      activityName: preset.name,
      state: preset.state,
      status: preset.status,
      streamUrl: preset.url || config.streamUrl,
      autoRotate: false, // Tắt xoay tự động khi chọn thủ công
    };
    setConfig(updated);

    fetch('/api/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
      .then(() => showToast(`🎮 Đã áp dụng preset: ${preset.name}`))
      .catch(() => showToast('Lỗi khi áp dụng'));
  };

  const getActivityIcon = (type: BotRpcConfig['activityType']) => {
    switch (type) {
      case 'Playing':
        return <Gamepad2 className="w-5 h-5 text-indigo-400" />;
      case 'Watching':
        return <Tv className="w-5 h-5 text-blue-400" />;
      case 'Listening':
        return <Headphones className="w-5 h-5 text-emerald-400" />;
      case 'Streaming':
        return <Radio className="w-5 h-5 text-purple-400" />;
      case 'Competing':
        return <Trophy className="w-5 h-5 text-amber-400" />;
      default:
        return <Sparkles className="w-5 h-5 text-pink-400" />;
    }
  };

  const getActivityLabel = (type: BotRpcConfig['activityType']) => {
    switch (type) {
      case 'Playing':
        return 'ĐANG CHƠI TRÒ CHƠI';
      case 'Watching':
        return 'ĐANG XEM';
      case 'Listening':
        return 'ĐANG NGHE SPOTIFY / ÂM NHẠC';
      case 'Streaming':
        return 'ĐANG PHÁT TRỰC TIẾP TRÊN TWITCH';
      case 'Competing':
        return 'ĐANG THI ĐẤU GIẢI';
      default:
        return 'TRẠNG THÁI TÙY CHỈNH';
    }
  };

  const getStatusColor = (status: BotRpcConfig['status']) => {
    switch (status) {
      case 'online':
        return 'bg-[#23a55a]';
      case 'idle':
        return 'bg-[#f0b232]';
      case 'dnd':
        return 'bg-[#f23f43]';
      default:
        return 'bg-[#80848e]';
    }
  };

  const generatedPythonRpcCode = `# Cài đặt thư viện: pip install pypresence
from pypresence import Presence
import time

client_id = "${customAppId.trim() || '1234567890'}"
RPC = Presence(client_id)
RPC.connect()

start_time = int(time.time())

RPC.update(
    details="${customDetails.replace(/"/g, '\\"')}",
    state="${customState.replace(/"/g, '\\"')}",
    large_image="${customLargeImage}",
    large_text="${customLargeText}",
    start=start_time,
    buttons=[
        {"label": "${customButtonText}", "url": "${customButtonUrl}"}
    ]
)

print("Rich Presence đang hoạt động trên Discord của bạn!")
while True:
    time.sleep(15)
`;

  return (
    <div className="bg-[#1E1F22] rounded-xl border border-[#2B2D31] overflow-hidden mb-8 shadow-2xl">
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-[#2B2D31] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#2B2D31]/40">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-md">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              DISCORD RICH PRESENCE (RPC)
              <span className="text-[10px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full font-mono uppercase">
                Real-Time Presence
              </span>
            </h2>
            <p className="text-xs text-[#949BA4]">
              Tùy chỉnh trạng thái hoạt động (Activity & Status) của Bot hoặc tạo Rich Presence cá nhân.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-[#111214] p-1 rounded-lg border border-[#35373C] self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('bot')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'bot' ? 'bg-[#5865F2] text-white' : 'text-[#949BA4] hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Bot Rich Presence
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'custom' ? 'bg-[#5865F2] text-white' : 'text-[#949BA4] hover:text-white'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            Custom RPC Cho Cá Nhân
          </button>
        </div>
      </div>

      {notification && (
        <div className="bg-emerald-950/80 border-b border-emerald-500/40 text-emerald-300 text-xs px-6 py-2.5 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{notification}</span>
          </div>
        </div>
      )}

      {activeTab === 'bot' ? (
        <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* CỘT TRÁI: LIVE DISCORD PROFILE PREVIEW */}
          <div className="lg:col-span-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#949BA4] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Mô Phỏng Hiển Thị Trên Discord (Live Preview)
            </h3>

            {/* Discord Profile Card */}
            <div className="bg-[#111214] rounded-xl border border-[#2B2D31] p-4 text-white shadow-xl relative overflow-hidden">
              {/* Banner Top */}
              <div
                className={`h-16 rounded-lg mb-3 ${
                  config.activityType === 'Streaming'
                    ? 'bg-gradient-to-r from-purple-900 via-indigo-800 to-purple-950 border border-purple-500/40'
                    : 'bg-gradient-to-r from-indigo-950 via-[#1E1F22] to-slate-900 border border-[#35373C]'
                }`}
              />

              {/* Avatar & User Details */}
              <div className="relative px-2 -mt-10 mb-3 flex items-end justify-between">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-[#5865F2] border-4 border-[#111214] flex items-center justify-center text-white text-xl font-bold shadow-lg overflow-hidden">
                    🛡️
                  </div>
                  {/* Status Indicator Dot */}
                  <div
                    className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-3 border-[#111214] ${getStatusColor(
                      config.status
                    )}`}
                    title={`Trạng thái: ${config.status}`}
                  />
                </div>
                <div className="bg-[#2B2D31] px-2.5 py-1 rounded-full text-[10px] font-bold text-[#949BA4] border border-[#35373C]">
                  {botOnline ? '🟢 BOT ONLINE' : '⚪ ĐANG CHỜ TOKEN'}
                </div>
              </div>

              <div className="px-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base text-white">{botName || 'SentinelBot'}</span>
                  <span className="bg-[#5865F2] text-[10px] font-black text-white px-1.5 py-0.5 rounded leading-none uppercase">
                    APP
                  </span>
                </div>
                <div className="text-xs text-[#949BA4]">@{botName ? botName.toLowerCase().replace(/\s+/g, '_') : 'sentinel_bot'}</div>
              </div>

              {/* Discord Rich Presence Box */}
              <div
                className={`rounded-lg p-3 border ${
                  config.activityType === 'Streaming'
                    ? 'bg-purple-950/30 border-purple-500/50'
                    : 'bg-[#1E1F22] border-[#2B2D31]'
                }`}
              >
                <div className="text-[10px] font-black uppercase tracking-wider text-[#B5BAC1] mb-2.5 flex items-center gap-1.5">
                  {getActivityIcon(config.activityType)}
                  <span>{getActivityLabel(config.activityType)}</span>
                </div>

                <div className="flex items-start gap-3">
                  {/* Large Image Box */}
                  <div className="w-12 h-12 rounded-lg bg-[#2B2D31] border border-[#35373C] flex items-center justify-center shrink-0 text-xl shadow-inner">
                    {config.activityType === 'Playing'
                      ? '🎮'
                      : config.activityType === 'Watching'
                      ? '🛡️'
                      : config.activityType === 'Listening'
                      ? '🎧'
                      : config.activityType === 'Streaming'
                      ? '📡'
                      : '🏆'}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-white truncate">
                      {config.activityName || 'Không có tên hoạt động'}
                    </div>
                    {config.state && (
                      <div className="text-xs text-[#B5BAC1] truncate mt-0.5">
                        {config.state}
                      </div>
                    )}
                    {config.activityType === 'Streaming' && config.streamUrl && (
                      <a
                        href={config.streamUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-purple-400 hover:underline truncate block mt-0.5 flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {config.streamUrl}
                      </a>
                    )}
                    <div className="text-[10px] text-[#949BA4] mt-1 flex items-center gap-1 font-mono">
                      <span>Đã trôi qua 00:42:15</span>
                    </div>
                  </div>
                </div>

                {/* Simulated Buttons */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="bg-[#2B2D31] hover:bg-[#35373C] text-center text-xs py-1.5 px-2 rounded font-medium text-white transition-colors cursor-pointer border border-[#35373C]">
                    🛡️ Mời Bot
                  </div>
                  <div className="bg-[#2B2D31] hover:bg-[#35373C] text-center text-xs py-1.5 px-2 rounded font-medium text-white transition-colors cursor-pointer border border-[#35373C]">
                    🌐 Dashboard
                  </div>
                </div>
              </div>

              {/* Lệnh Discord mẫu */}
              <div className="mt-4 p-2.5 rounded bg-[#1E1F22]/70 border border-[#2B2D31] text-[11px] text-[#949BA4]">
                💡 <span className="text-gray-300 font-semibold">Lệnh Discord:</span> Gõ{' '}
                <code className="bg-[#111214] text-indigo-400 px-1.5 py-0.5 rounded font-mono">.rpc watching Anti-Raid</code>{' '}
                hoặc <code className="bg-[#111214] text-indigo-400 px-1.5 py-0.5 rounded font-mono">.rpc status dnd</code>
              </div>
            </div>

            {/* Quick Presets */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#949BA4] mb-2">
                ⚡ Chọn nhanh trạng thái mẫu (Presets):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_ACTIVITIES.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="text-xs bg-[#2B2D31] hover:bg-[#35373C] text-gray-300 hover:text-white px-2.5 py-1.5 rounded-lg border border-[#35373C] transition-all flex items-center gap-1.5"
                  >
                    <Play className="w-3 h-3 text-indigo-400" />
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* CỘT PHẢI: FORM ĐIỀU KHIỂN CHI TIẾT */}
          <div className="lg:col-span-7 bg-[#111214] p-5 rounded-xl border border-[#2B2D31] space-y-5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-[#2B2D31] pb-3">
              <Sliders className="w-4 h-4 text-[#5865F2]" />
              Bảng Điều Khiển Bot Rich Presence
            </h3>

            <form onSubmit={handleApplyRpc} className="space-y-4">
              {/* 1. Chọn Loại Hoạt Động (Activity Type) */}
              <div>
                <label className="block text-xs font-semibold text-[#B5BAC1] uppercase mb-2">
                  Loại Hoạt Động (Activity Type)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'Playing', label: 'Chơi Game', icon: Gamepad2 },
                      { id: 'Watching', label: 'Đang Xem', icon: Tv },
                      { id: 'Listening', label: 'Đang Nghe', icon: Headphones },
                      { id: 'Streaming', label: 'Phát Stream', icon: Radio },
                      { id: 'Competing', label: 'Thi Đấu', icon: Trophy },
                      { id: 'Custom', label: 'Tùy Chỉnh', icon: Sparkles },
                    ] as const
                  ).map((item) => {
                    const Icon = item.icon;
                    const isSelected = config.activityType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setConfig({ ...config, activityType: item.id })}
                        className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-all ${
                          isSelected
                            ? 'bg-[#5865F2] border-[#5865F2] text-white shadow-md'
                            : 'bg-[#1E1F22] border-[#2B2D31] text-gray-400 hover:text-white hover:bg-[#2B2D31]'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Tên Hoạt Động (Name) */}
              <div>
                <label className="block text-xs font-semibold text-[#B5BAC1] uppercase mb-1.5">
                  Tên Hoạt Động (Activity Name / Title)
                </label>
                <input
                  type="text"
                  value={config.activityName}
                  onChange={(e) => setConfig({ ...config, activityName: e.target.value })}
                  placeholder="VD: 🛡️ Bảo vệ máy chủ | .help"
                  className="w-full bg-[#1E1F22] border border-[#2B2D31] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#5865F2]"
                  required
                />
              </div>

              {/* 3. Chi Tiết / Dòng Phụ (State / Details) */}
              <div>
                <label className="block text-xs font-semibold text-[#B5BAC1] uppercase mb-1.5">
                  Chi Tiết Trạng Thái (State / Details)
                </label>
                <input
                  type="text"
                  value={config.state || ''}
                  onChange={(e) => setConfig({ ...config, state: e.target.value })}
                  placeholder="VD: Hệ thống Anti-Raid & Gemini AI hoạt động 24/7"
                  className="w-full bg-[#1E1F22] border border-[#2B2D31] rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#5865F2]"
                />
              </div>

              {/* 4. Link Twitch (nếu chọn Streaming) */}
              {config.activityType === 'Streaming' && (
                <div className="p-3 bg-purple-950/30 border border-purple-500/40 rounded-lg">
                  <label className="block text-xs font-semibold text-purple-300 uppercase mb-1.5">
                    Twitch Stream URL (Bắt buộc với Streaming)
                  </label>
                  <input
                    type="url"
                    value={config.streamUrl || ''}
                    onChange={(e) => setConfig({ ...config, streamUrl: e.target.value })}
                    placeholder="https://www.twitch.tv/sentinelbot_defense"
                    className="w-full bg-[#1E1F22] border border-purple-500/50 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-400"
                  />
                  <span className="text-[11px] text-purple-300/80 mt-1 block">
                    Khi bật chế độ Streaming, Bot sẽ có chấm màu Tím và viền phát trực tiếp siêu nổi bật trên Discord!
                  </span>
                </div>
              )}

              {/* 5. Trạng Thái Hiện Diện (Online / Idle / DND / Invisible) */}
              <div>
                <label className="block text-xs font-semibold text-[#B5BAC1] uppercase mb-2">
                  Trạng Thái Hiện Diện (Status)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'online', label: 'Trực tuyến 🟢', color: 'border-emerald-500/50' },
                    { id: 'idle', label: 'Chờ (Idle) 🟡', color: 'border-amber-500/50' },
                    { id: 'dnd', label: 'Đừng làm phiền 🔴', color: 'border-rose-500/50' },
                    { id: 'invisible', label: 'Ẩn danh ⚪', color: 'border-gray-500/50' },
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setConfig({ ...config, status: st.id as any })}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                        config.status === st.id
                          ? `bg-[#2B2D31] text-white border-[#5865F2] ring-1 ring-[#5865F2]`
                          : 'bg-[#1E1F22] border-[#2B2D31] text-gray-400 hover:text-white'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 6. Tự Động Xoay (Auto-Rotate) */}
              <div className="p-3 rounded-lg bg-[#1E1F22] border border-[#2B2D31] flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                    Tự Động Luân Phiên Đổi Status (Auto-Rotate)
                  </div>
                  <div className="text-[11px] text-[#949BA4]">
                    Tự động đổi qua lại các trạng thái: Xem server, Chat Gemini AI, Nghe nhạc...
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.autoRotate}
                    onChange={(e) => setConfig({ ...config, autoRotate: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5865F2]"></div>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isApplying}
                className="w-full bg-[#5865F2] hover:bg-[#4752C4] active:scale-[0.99] text-white font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
              >
                {isApplying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Đang gửi cập nhật lên Discord Gateway...
                  </>
                ) : (
                  <>
                    <Gamepad2 className="w-4 h-4" />
                    Áp Dụng Rich Presence Lên Bot Ngay
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* TAB 2: CUSTOM DISCORD RPC GENERATOR CHO TÀI KHOẢN CÁ NHÂN */
        <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Code2 className="w-4 h-4 text-[#5865F2]" />
              Bộ Cấu Hình Discord Rich Presence (RPC) Cá Nhân
            </h3>
            <p className="text-xs text-[#949BA4]">
              Dành cho bạn muốn hiển thị trạng thái Rich Presence cực ngầu trên tài khoản cá nhân Discord của mình
              thông qua ứng dụng chạy ngầm (hỗ trợ Python `pypresence`, Node.js `discord-rpc`, hoặc Discord Developer Portal).
            </p>

            <div className="space-y-3 bg-[#111214] p-4 rounded-xl border border-[#2B2D31]">
              <div>
                <label className="block text-[11px] font-bold text-[#B5BAC1] uppercase mb-1">
                  Application Client ID
                </label>
                <input
                  type="text"
                  value={customAppId}
                  onChange={(e) => setCustomAppId(e.target.value)}
                  placeholder="Lấy tại Discord Developer Portal"
                  className="w-full bg-[#1E1F22] border border-[#2B2D31] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#5865F2]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#B5BAC1] uppercase mb-1">Details (Dòng 1)</label>
                  <input
                    type="text"
                    value={customDetails}
                    onChange={(e) => setCustomDetails(e.target.value)}
                    className="w-full bg-[#1E1F22] border border-[#2B2D31] rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#B5BAC1] uppercase mb-1">State (Dòng 2)</label>
                  <input
                    type="text"
                    value={customState}
                    onChange={(e) => setCustomState(e.target.value)}
                    className="w-full bg-[#1E1F22] border border-[#2B2D31] rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#B5BAC1] uppercase mb-1">Large Image Key</label>
                  <input
                    type="text"
                    value={customLargeImage}
                    onChange={(e) => setCustomLargeImage(e.target.value)}
                    className="w-full bg-[#1E1F22] border border-[#2B2D31] rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#B5BAC1] uppercase mb-1">Large Image Text</label>
                  <input
                    type="text"
                    value={customLargeText}
                    onChange={(e) => setCustomLargeText(e.target.value)}
                    className="w-full bg-[#1E1F22] border border-[#2B2D31] rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-[#B5BAC1] uppercase mb-1">Nút Bấm (Button Label)</label>
                  <input
                    type="text"
                    value={customButtonText}
                    onChange={(e) => setCustomButtonText(e.target.value)}
                    className="w-full bg-[#1E1F22] border border-[#2B2D31] rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#B5BAC1] uppercase mb-1">Link Nút Bấm (Button URL)</label>
                  <input
                    type="url"
                    value={customButtonUrl}
                    onChange={(e) => setCustomButtonUrl(e.target.value)}
                    className="w-full bg-[#1E1F22] border border-[#2B2D31] rounded px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* CỘT PHẢI: MÃ NGUỒN TỰ ĐỘNG SINH */}
          <div className="lg:col-span-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#949BA4]">
                Mã Python Tự Động Sinh (Chạy Ngay):
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(generatedPythonRpcCode);
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2500);
                }}
                className="text-xs bg-[#2B2D31] hover:bg-[#35373C] text-gray-300 hover:text-white px-2.5 py-1 rounded border border-[#35373C] flex items-center gap-1 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedCode ? 'Đã Sao Chép! ✅' : 'Sao chép mã code'}
              </button>
            </div>

            <div className="relative">
              <pre className="bg-[#111214] text-gray-300 p-4 rounded-xl border border-[#2B2D31] font-mono text-xs overflow-x-auto max-h-[380px] leading-relaxed">
                {generatedPythonRpcCode}
              </pre>
            </div>

            <div className="p-3 bg-indigo-950/30 border border-indigo-500/30 rounded-lg text-xs text-indigo-200">
              📌 <strong>Hướng dẫn:</strong> Cài đặt Python rồi gõ <code>pip install pypresence</code>, sau đó lưu đoạn
              code trên thành file <code>rpc.py</code> và chạy <code>python rpc.py</code> là tài khoản Discord của bạn sẽ
              có Rich Presence y như trên!
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
