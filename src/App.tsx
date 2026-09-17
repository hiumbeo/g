import { useEffect, useState, useCallback } from 'react';
import { Shield, Server, Activity, Bot, Zap, Play, Settings, Sparkles, MessageSquare, ShieldAlert, Gamepad2, Blocks, Ticket, LayoutTemplate, Video } from 'lucide-react';
import AntiRaidDashboard from './components/AntiRaidDashboard';
import RpcManager from './components/RpcManager';
import RobloxChecker from './components/RobloxChecker';
import TicketEmbedManager from './components/TicketEmbedManager';
import TikTokTester from './components/TikTokTester';
import ScanHistory from './components/ScanHistory';
import FunTester from './components/FunTester';
import AiChatBox from './components/AiChatBox';
import { ScanRecord, BotStatus } from './types';

export default function App() {
  const [status, setStatus] = useState<BotStatus>({
    online: false,
    manuallyStopped: true,
    botName: null,
    error: '',
    guildCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [scansLoading, setScansLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (!res.ok) return;
      const data = await res.json();
      if (data) {
        setStatus({
          online: Boolean(data.online),
          manuallyStopped: Boolean(data.manuallyStopped),
          botName: data.botName || null,
          error: data.error || '',
          guildCount: Number(data.guildCount) || 0,
        });
      }
    } catch {
      // Transient network delay or server reload
    } finally {
      setLoading(false);
    }
  }, []);

  const handleToggleBot = async (action: 'stop' | 'start') => {
    setToggleLoading(true);
    try {
      const res = await fetch(`/api/bot/${action}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Có lỗi xảy ra');
      } else {
        await fetchStatus();
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi kết nối');
    } finally {
      setToggleLoading(false);
    }
  };

  const fetchScans = useCallback(async () => {
    try {
      const res = await fetch('/api/scans');
      if (!res.ok) return;
      const data = await res.json();
      if (data && Array.isArray(data.scans)) {
        setScans(data.scans);
      }
    } catch {
      // Transient network error
    } finally {
      setScansLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchScans();

    const interval = setInterval(() => {
      fetchStatus();
      fetchScans();
    }, 4000);

    return () => {
      clearInterval(interval);
    };
  }, [fetchStatus, fetchScans]);

  const handleClearScans = async () => {
    try {
      const res = await fetch('/api/scans', { method: 'DELETE' });
      if (res.ok) {
        setScans([]);
      }
    } catch (err) {
      console.error('Error clearing scans:', err);
    }
  };

  const handleScanUrl = async (url: string) => {
    const res = await fetch('/api/scans/web', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Lỗi khi quét liên kết');
    }
    const data = await res.json();
    if (data.record) {
      setScans((prev) => [data.record, ...prev]);
    } else {
      await fetchScans();
    }
  };

  return (
    <div className="min-h-screen bg-[#111214] text-gray-200 font-sans">
      <div className="max-w-5xl mx-auto px-4 py-12">
        
        {/* Header */}
        <header className="flex items-center space-x-4 mb-12">
          <div className="w-16 h-16 bg-[#5865F2] rounded-2xl flex items-center justify-center shadow-lg shadow-[#5865F2]/20">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white tracking-tight">SentinelBot</h1>
            <p className="text-[#949BA4] mt-1 text-lg">Hệ thống Quản trị & Bảo mật Discord</p>
          </div>
        </header>

        {/* Status Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-[#1E1F22] rounded-xl p-6 border border-[#2B2D31]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <Bot className="w-5 h-5 text-[#949BA4]" />
                <h2 className="text-[#949BA4] font-semibold">Trạng thái Bot</h2>
              </div>
              {status.online ? (
                <button
                  type="button"
                  disabled={toggleLoading}
                  onClick={() => handleToggleBot('stop')}
                  className="text-xs bg-[#DA373C]/20 hover:bg-[#DA373C]/30 text-[#DA373C] border border-[#DA373C]/30 px-2.5 py-1 rounded-md font-medium transition"
                >
                  {toggleLoading ? '...' : 'Ngắt kết nối'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={toggleLoading}
                  onClick={() => handleToggleBot('start')}
                  className="text-xs bg-[#23A559]/20 hover:bg-[#23A559]/30 text-[#23A559] border border-[#23A559]/30 px-2.5 py-1 rounded-md font-medium transition"
                >
                  {toggleLoading ? '...' : 'Khởi động'}
                </button>
              )}
            </div>
            {loading ? (
              <div className="text-2xl font-bold text-white animate-pulse">Đang tải...</div>
            ) : (
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${status.online ? 'bg-[#23A559]' : status.manuallyStopped ? 'bg-amber-400' : 'bg-[#DA373C]'}`}></div>
                <span className="text-2xl font-bold text-white">
                  {status.online ? 'Online' : status.manuallyStopped ? 'Đã Tạm Dừng' : 'Offline'}
                </span>
              </div>
            )}
            {status.manuallyStopped && (
              <p className="text-xs text-amber-400/90 mt-2 font-medium">Đã ngắt trong này để bạn tự host bên ngoài</p>
            )}
            {status.botName && <p className="text-sm text-[#949BA4] mt-1">Tag: {status.botName}</p>}
          </div>

          <div className="bg-[#1E1F22] rounded-xl p-6 border border-[#2B2D31]">
            <div className="flex items-center space-x-3 mb-2">
              <Server className="w-5 h-5 text-[#949BA4]" />
              <h2 className="text-[#949BA4] font-semibold">Máy chủ</h2>
            </div>
            <div className="text-2xl font-bold text-white">
              {loading ? '-' : status.guildCount}
            </div>
            <p className="text-sm text-[#949BA4] mt-2">Đang hoạt động</p>
          </div>

          <div className="bg-[#1E1F22] rounded-xl p-6 border border-[#2B2D31]">
            <div className="flex items-center space-x-3 mb-2">
              <Activity className="w-5 h-5 text-[#949BA4]" />
              <h2 className="text-[#949BA4] font-semibold">Ping</h2>
            </div>
            <div className="text-2xl font-bold text-[#23A559]">
              {status.online ? '~25ms' : '-'}
            </div>
            <p className="text-sm text-[#949BA4] mt-2">Độ trễ Gateway</p>
          </div>
        </div>

        {/* Configuration Notice or Manually Stopped Notice */}
        {status.manuallyStopped ? (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 mb-12 flex items-start space-x-4">
            <Shield className="w-6 h-6 text-amber-400 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-amber-400 font-bold text-lg mb-1">Đã Dừng Bot Trong Môi Trường Này</h3>
              <p className="text-[#949BA4] text-sm">
                Bot đã được ngắt kết nối khỏi Discord trong container này theo yêu cầu của bạn. Điều này đảm bảo khi bạn chạy bot trên nền tảng bên ngoài (như Render, Discloud, VPS), bot sẽ <strong>không bị đăng nhập 2 nơi cùng lúc</strong> và không bị trùng lặp tin nhắn.
              </p>
              <div className="mt-3 flex items-center space-x-3">
                <button
                  type="button"
                  disabled={toggleLoading}
                  onClick={() => handleToggleBot('start')}
                  className="text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-lg font-medium transition"
                >
                  {toggleLoading ? 'Đang xử lý...' : 'Bật lại Bot trong này'}
                </button>
                <span className="text-xs text-[#949BA4]">Web Dashboard vẫn có thể dùng để cấu hình và chỉnh sửa bình thường.</span>
              </div>
            </div>
          </div>
        ) : !status.online && !loading ? (
          <div className="bg-[#DA373C]/10 border border-[#DA373C]/20 rounded-xl p-6 mb-12 flex items-start space-x-4">
            <Settings className="w-6 h-6 text-[#DA373C] flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-[#DA373C] font-bold text-lg mb-1">Cần Cấu Hình Token</h3>
              <p className="text-[#949BA4]">Bot chưa được khởi động. Vui lòng thiết lập biến môi trường <code className="bg-[#111214] px-1.5 py-0.5 rounded text-white">DISCORD_TOKEN</code> trong phần cấu hình dự án để kết nối với Discord.</p>
              {status.error && <p className="text-red-400 mt-2 text-sm">Lỗi: {status.error}</p>}
            </div>
          </div>
        ) : null}

        {/* Discord Bot Rich Presence (RPC) Manager */}
        <RpcManager botName={status.botName} botOnline={status.online} />

        {/* Tự Động Nhận Diện & Tải Link TikTok Không Logo */}
        <TikTokTester />

        {/* Tra cứu tài khoản Roblox (Avatar, Join Date, Link Profile & Lệnh Slash) */}
        <RobloxChecker />

        {/* Hệ thống Ticket & Embed Builder */}
        <TicketEmbedManager />

        {/* Anti-Raid & Anti-Nuke Shield Center (Microngamer/anti-raid-1 Port) */}
        <AntiRaidDashboard />

        {/* SentinelBot AI Chat Assistant */}
        <AiChatBox />

        {/* CyberSec Scan History Section */}
        <ScanHistory
          scans={scans}
          isLoading={scansLoading}
          onRefresh={fetchScans}
          onClear={handleClearScans}
          onScanUrl={handleScanUrl}
        />

        {/* Fun & Mini-games Section */}
        <FunTester />

        {/* Commands List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          
          {/* Anti-Raid Shield section */}
          <div className="bg-[#1E1F22] rounded-xl border border-red-500/30 overflow-hidden h-fit">
            <div className="bg-red-500/10 p-4 border-b border-red-500/20 flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 text-red-400" />
              <h3 className="font-bold text-white text-sm">Anti-Raid & Phòng Chống</h3>
            </div>
            <div className="p-4 space-y-3">
              {[
                { cmd: '.antiraid <on/off/config>', desc: 'Bật/tắt/xem cấu hình lá chắn' },
                { cmd: '.lockdown <on/off>', desc: 'Khóa khẩn cấp toàn server' },
                { cmd: '.whitelist @user', desc: 'Thêm người tin cậy vào whitelist' },
                { cmd: '.delwhitelist @user', desc: 'Xóa khỏi danh sách whitelist' },
                { cmd: '.whitelisted', desc: 'Xem danh sách được miễn trừ' },
                { cmd: '.raidlogs', desc: 'Xem nhật ký ngăn chặn xâm nhập' },
              ].map((item) => (
                <div key={item.cmd} className="flex flex-col border-b border-[#2B2D31] last:border-0 pb-3 last:pb-0">
                  <code className="text-red-400 bg-red-500/10 px-2 py-1 rounded text-xs mb-1 w-fit">{item.cmd}</code>
                  <span className="text-[#949BA4] text-xs">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Chat section */}
          <div className="bg-[#1E1F22] rounded-xl border border-[#2B2D31] overflow-hidden h-fit">
            <div className="bg-[#2B2D31]/50 p-4 border-b border-[#2B2D31] flex items-center space-x-2">
              <Bot className="w-5 h-5 text-cyan-400" />
              <h3 className="font-bold text-white text-sm">Trí Tuệ Nhân Tạo AI</h3>
            </div>
            <div className="p-4 space-y-3">
              {[
                { cmd: '.chat <câu hỏi>', desc: 'Hỏi đáp AI thông minh' },
                { cmd: '.ai <nội dung>', desc: 'Nhờ AI viết văn bản/mẹo' },
                { cmd: '@SentinelBot', desc: 'Tag bot trò chuyện trực tiếp' },
                { cmd: '.ask <vấn đề>', desc: 'Tư vấn giải pháp bảo mật' },
              ].map((item) => (
                <div key={item.cmd} className="flex flex-col border-b border-[#2B2D31] last:border-0 pb-3 last:pb-0">
                  <code className="text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded text-xs mb-1 w-fit">{item.cmd}</code>
                  <span className="text-[#949BA4] text-xs">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Moderation section */}
          <div className="bg-[#1E1F22] rounded-xl border border-[#2B2D31] overflow-hidden h-fit">
            <div className="bg-[#2B2D31]/50 p-4 border-b border-[#2B2D31] flex items-center space-x-2">
              <Zap className="w-5 h-5 text-[#5865F2]" />
              <h3 className="font-bold text-white text-sm">Bảo Mật & Quản Trị</h3>
            </div>
            <div className="p-4 space-y-3">
              {[
                { cmd: '.clean <số|bot|@user|links>', desc: 'Dọn dẹp lọc tin nhắn thông minh' },
                { cmd: '.snipe', desc: 'Xem tin nhắn vừa bị xóa' },
                { cmd: '.lock / .unlock', desc: 'Khóa / Mở khóa kênh chat' },
                { cmd: '.antinuke <on/off>', desc: 'Chống phá hoại server' },
                { cmd: '.scanweb <url>', desc: 'Quét link lừa đảo/malware' },
                { cmd: '.scanfile', desc: 'Quét tệp mã độc nguy hiểm' },
              ].map((item) => (
                <div key={item.cmd} className="flex flex-col border-b border-[#2B2D31] last:border-0 pb-3 last:pb-0">
                  <code className="text-[#5865F2] bg-[#5865F2]/10 px-2 py-1 rounded text-xs mb-1 w-fit">{item.cmd}</code>
                  <span className="text-[#949BA4] text-xs">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Music section */}
          <div className="bg-[#1E1F22] rounded-xl border border-[#2B2D31] overflow-hidden h-fit">
            <div className="bg-[#2B2D31]/50 p-4 border-b border-[#2B2D31] flex items-center space-x-2">
              <Play className="w-5 h-5 text-[#23A559]" />
              <h3 className="font-bold text-white text-sm">Phát Nhạc</h3>
            </div>
            <div className="p-4 space-y-3">
              {[
                { cmd: '.play <tên/link>', desc: 'Phát nhạc trong Voice' },
                { cmd: '.skip (hoặc .s)', desc: 'Bỏ qua bài hát hiện tại' },
                { cmd: '.stop (hoặc .leave)', desc: 'Dừng nhạc và rời phòng' },
                { cmd: '.queue (hoặc .q)', desc: 'Xem danh sách bài hát' },
                { cmd: '.volume <1-150>', desc: 'Điều chỉnh âm lượng' },
              ].map((item) => (
                <div key={item.cmd} className="flex flex-col border-b border-[#2B2D31] last:border-0 pb-3 last:pb-0">
                  <code className="text-[#23A559] bg-[#23A559]/10 px-2 py-1 rounded text-xs mb-1 w-fit">{item.cmd}</code>
                  <span className="text-[#949BA4] text-xs">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Fun & Games section */}
          <div className="bg-[#1E1F22] rounded-xl border border-[#2B2D31] overflow-hidden h-fit">
            <div className="bg-[#2B2D31]/50 p-4 border-b border-[#2B2D31] flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-pink-400" />
              <h3 className="font-bold text-white text-sm">Giải Trí & Ghép Đôi</h3>
            </div>
            <div className="p-4 space-y-3">
              {[
                { cmd: '.ghepdoi @crush', desc: 'Xem duyên số với crush' },
                { cmd: '.ghepdoi @u1 @u2', desc: 'Đẩy thuyền 2 thành viên' },
                { cmd: '.gay', desc: 'Đo độ gay của bản thân' },
                { cmd: '.gay @user', desc: 'Đo độ gay thành viên khác' },
              ].map((item) => (
                <div key={item.cmd} className="flex flex-col border-b border-[#2B2D31] last:border-0 pb-3 last:pb-0">
                  <code className="text-pink-400 bg-pink-500/10 px-2 py-1 rounded text-xs mb-1 w-fit">{item.cmd}</code>
                  <span className="text-[#949BA4] text-xs">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Rich Presence (RPC) section */}
          <div className="bg-[#1E1F22] rounded-xl border border-indigo-500/30 overflow-hidden h-fit">
            <div className="bg-indigo-500/10 p-4 border-b border-indigo-500/20 flex items-center space-x-2">
              <Gamepad2 className="w-5 h-5 text-indigo-400" />
              <h3 className="font-bold text-white text-sm">Rich Presence (RPC)</h3>
            </div>
            <div className="p-4 space-y-3">
              {[
                { cmd: '.rpc playing <tên game>', desc: 'Đổi trạng thái Đang chơi game' },
                { cmd: '.rpc watching <nội dung>', desc: 'Đổi trạng thái Đang xem' },
                { cmd: '.rpc listening <bài hát>', desc: 'Đổi trạng thái Đang nghe' },
                { cmd: '.rpc streaming <url> <tên>', desc: 'Đổi sang Livestream (Viền tím)' },
                { cmd: '.rpc status <online|idle|dnd>', desc: 'Đổi màu chấm hiện diện' },
                { cmd: '.rpc rotate <on|off>', desc: 'Bật/tắt tự động đổi status liên tục' },
                { cmd: '.rpc info', desc: 'Xem cấu hình Presence hiện thời' },
              ].map((item) => (
                <div key={item.cmd} className="flex flex-col border-b border-[#2B2D31] last:border-0 pb-3 last:pb-0">
                  <code className="text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded text-xs mb-1 w-fit">{item.cmd}</code>
                  <span className="text-[#949BA4] text-xs">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Roblox User Lookup section */}
          <div className="bg-[#1E1F22] rounded-xl border border-[#00A2FF]/30 overflow-hidden h-fit">
            <div className="bg-[#00A2FF]/10 p-4 border-b border-[#00A2FF]/20 flex items-center space-x-2">
              <Blocks className="w-5 h-5 text-[#00A2FF]" />
              <h3 className="font-bold text-white text-sm">Tra Cứu Tài Khoản Roblox</h3>
            </div>
            <div className="p-4 space-y-3">
              {[
                { cmd: '/roblox username: <tên>', desc: 'Lệnh Slash kiểm tra Avatar, ngày Join Roblox, link Profile' },
                { cmd: '.roblox <username/ID>', desc: 'Lệnh Prefix tra cứu tài khoản Roblox nhanh' },
                { cmd: '.rbx <username/ID>', desc: 'Lệnh rút gọn (bí danh) cho .roblox' },
              ].map((item) => (
                <div key={item.cmd} className="flex flex-col border-b border-[#2B2D31] last:border-0 pb-3 last:pb-0">
                  <code className="text-[#00A2FF] bg-[#00A2FF]/10 px-2 py-1 rounded text-xs mb-1 w-fit">{item.cmd}</code>
                  <span className="text-[#949BA4] text-xs">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Ticket System & Embed Generator Section */}
          <div className="bg-[#1E1F22] rounded-xl border border-emerald-500/30 overflow-hidden h-fit">
            <div className="bg-emerald-500/10 p-4 border-b border-emerald-500/20 flex items-center space-x-2">
              <Ticket className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-white text-sm">Hệ Thống Ticket & Embed</h3>
            </div>
            <div className="p-4 space-y-3">
              {[
                { cmd: '/ticket setup [channel]', desc: 'Gửi Bảng Tạo Ticket có Embed và Nút bấm' },
                { cmd: '/ticket close', desc: 'Đóng và xóa kênh ticket hiện tại sau 5 giây' },
                { cmd: '/embed description: <nội dung>', desc: 'Tạo tin nhắn Embed nhanh bằng lệnh Slash' },
                { cmd: '.ticket setup', desc: 'Lệnh Prefix gửi Bảng Tạo Ticket vào kênh' },
                { cmd: '.close', desc: 'Lệnh Prefix đóng kênh ticket ngay lập tức' },
                { cmd: '.embed [Tiêu đề] | [Nội dung] | [Màu]', desc: 'Lệnh Prefix tạo Embed với định dạng tùy chỉnh' },
              ].map((item) => (
                <div key={item.cmd} className="flex flex-col border-b border-[#2B2D31] last:border-0 pb-3 last:pb-0">
                  <code className="text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded text-xs mb-1 w-fit">{item.cmd}</code>
                  <span className="text-[#949BA4] text-xs">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* TikTok Downloader & Auto-Embed section */}
          <div className="bg-[#1E1F22] rounded-xl border border-[#EE1D52]/30 overflow-hidden h-fit">
            <div className="bg-[#EE1D52]/10 p-4 border-b border-[#EE1D52]/20 flex items-center space-x-2">
              <Video className="w-5 h-5 text-[#EE1D52]" />
              <h3 className="font-bold text-white text-sm">Tải & Tự Động Nhận Link TikTok</h3>
            </div>
            <div className="p-4 space-y-3">
              {[
                { cmd: 'Dán link TikTok vào chat', desc: 'Tự động nhận diện & gửi video không logo' },
                { cmd: '.tiktok <link>', desc: 'Tải video TikTok không watermark (Full HD)' },
                { cmd: '.tt <link>', desc: 'Lệnh viết tắt cho .tiktok' },
                { cmd: '/tiktok url: <link>', desc: 'Lệnh Slash tải video trực tiếp' },
                { cmd: '.tiktok auto on/off', desc: 'Bật/tắt tự động bắt link trong server' },
              ].map((item) => (
                <div key={item.cmd} className="flex flex-col border-b border-[#2B2D31] last:border-0 pb-3 last:pb-0">
                  <code className="text-[#EE1D52] bg-[#EE1D52]/10 px-2 py-1 rounded text-xs mb-1 w-fit">{item.cmd}</code>
                  <span className="text-[#949BA4] text-xs">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

