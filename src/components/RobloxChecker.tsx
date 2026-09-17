import { useState, FormEvent } from 'react';
import {
  Search,
  ExternalLink,
  Calendar,
  Users,
  ShieldCheck,
  ShieldAlert,
  Copy,
  CheckCircle2,
  Sparkles,
  Terminal,
  User,
  Hash,
  AlertCircle
} from 'lucide-react';
import { RobloxUserProfile } from '../types';

const POPULAR_PRESETS = ['Roblox', 'Builderman', 'KreekCraft', 'Flamingo'];

export default function RobloxChecker() {
  const [query, setQuery] = useState('');
  const [profile, setProfile] = useState<RobloxUserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'avatar' | 'headshot'>('avatar');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const handleSearch = async (searchTarget?: string) => {
    const target = (searchTarget !== undefined ? searchTarget : query).trim();
    if (!target) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/roblox/check?query=${encodeURIComponent(target)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không tìm thấy tài khoản Roblox này');
      }
      setProfile(data.profile);
      if (searchTarget !== undefined) {
        setQuery(searchTarget);
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tra cứu tài khoản Roblox');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSearch();
  };

  const copyToClipboard = (text: string, type: 'link' | 'id') => {
    navigator.clipboard.writeText(text);
    if (type === 'link') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  return (
    <div className="bg-[#1E1F22] rounded-xl border border-[#2B2D31] overflow-hidden mb-8 shadow-2xl">
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-[#2B2D31] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#2B2D31]/40">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-[#00A2FF] to-[#0066CC] flex items-center justify-center text-white shadow-md">
            <span className="font-black text-lg tracking-tighter">R$</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              TRA CỨU TÀI KHOẢN ROBLOX (ROBLOX LOOKUP)
              <span className="text-[10px] bg-[#00A2FF]/20 text-[#00A2FF] border border-[#00A2FF]/30 px-2 py-0.5 rounded-full font-mono uppercase">
                Slash Command /roblox
              </span>
            </h2>
            <p className="text-xs text-[#949BA4]">
              Kiểm tra Avatar, ngày tham gia Roblox (Join Date), link profile và thông tin chi tiết qua Slash Command hoặc Web.
            </p>
          </div>
        </div>

        {/* Discord Slash Command Badge */}
        <div className="flex items-center gap-1.5 bg-[#111214] px-3 py-1.5 rounded-lg border border-[#35373C] text-xs text-[#949BA4]">
          <Terminal className="w-3.5 h-3.5 text-[#00A2FF]" />
          <span>Lệnh Discord:</span>
          <code className="text-[#00A2FF] font-mono font-bold">/roblox</code>
          <span>hoặc</span>
          <code className="text-[#00A2FF] font-mono font-bold">.roblox</code>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* Search Bar */}
        <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-[#949BA4]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nhập tên tài khoản (Username) hoặc ID người dùng Roblox (VD: Roblox, Builderman)..."
              className="w-full bg-[#111214] border border-[#2B2D31] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#949BA4] focus:outline-none focus:border-[#00A2FF] transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="bg-[#00A2FF] hover:bg-[#008CE0] active:scale-[0.98] disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-lg text-sm transition-all flex items-center justify-center gap-2 shadow-lg shrink-0"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Đang tra cứu...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Kiểm Tra Ngay
              </>
            )}
          </button>
        </form>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#949BA4] font-medium flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Tài khoản mẫu:
          </span>
          {POPULAR_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => handleSearch(preset)}
              className="text-xs bg-[#2B2D31] hover:bg-[#35373C] text-gray-300 hover:text-white px-2.5 py-1 rounded-md border border-[#35373C] transition-colors font-mono"
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Profile Result Display */}
        {profile && (
          <div className="bg-[#111214] rounded-xl border border-[#2B2D31] p-5 sm:p-6 shadow-xl relative overflow-hidden">
            {/* Top Accent Strip */}
            <div
              className={`absolute top-0 left-0 right-0 h-1.5 ${
                profile.isBanned ? 'bg-rose-500' : 'bg-gradient-to-r from-[#00A2FF] via-indigo-500 to-purple-500'
              }`}
            />

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start mt-2">
              {/* Cột Trái: Avatar & Preview Mode Switcher */}
              <div className="md:col-span-4 flex flex-col items-center text-center bg-[#1E1F22] p-4 rounded-xl border border-[#2B2D31]">
                <div className="relative mb-3 group">
                  <div className="w-44 h-44 sm:w-52 sm:h-52 rounded-xl bg-[#111214] border border-[#2B2D31] flex items-center justify-center overflow-hidden p-2 shadow-inner">
                    <img
                      src={viewMode === 'avatar' ? profile.avatarUrl : profile.headshotUrl}
                      alt={profile.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>

                  {/* Verified Badge */}
                  {profile.hasVerifiedBadge && (
                    <div
                      className="absolute top-2 right-2 bg-[#00A2FF] text-white p-1 rounded-full shadow-lg"
                      title="Tài khoản đã xác minh chính chủ"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}

                  {/* Status Badge (Active vs Banned) */}
                  <div className="absolute bottom-2 left-2">
                    {profile.isBanned ? (
                      <span className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                        BANNED
                      </span>
                    ) : (
                      <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        ACTIVE
                      </span>
                    )}
                  </div>
                </div>

                {/* View Switcher: Avatar Body vs Headshot */}
                <div className="flex bg-[#111214] p-1 rounded-lg border border-[#35373C] mb-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setViewMode('avatar')}
                    className={`px-3 py-1 rounded font-medium transition-colors ${
                      viewMode === 'avatar' ? 'bg-[#00A2FF] text-white' : 'text-[#949BA4] hover:text-white'
                    }`}
                  >
                    Toàn thân 3D
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('headshot')}
                    className={`px-3 py-1 rounded font-medium transition-colors ${
                      viewMode === 'headshot' ? 'bg-[#00A2FF] text-white' : 'text-[#949BA4] hover:text-white'
                    }`}
                  >
                    Chân dung (Headshot)
                  </button>
                </div>

                {/* Direct Action: Open Profile */}
                <a
                  href={profile.profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full bg-[#00A2FF] hover:bg-[#008CE0] text-white font-bold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 shadow transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Mở Profile Roblox Trực Tiếp
                </a>
              </div>

              {/* Cột Phải: Thông tin chi tiết */}
              <div className="md:col-span-8 space-y-4">
                {/* Name & Username */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2B2D31] pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-white">{profile.displayName}</h3>
                      {profile.hasVerifiedBadge && (
                        <span className="bg-[#00A2FF]/20 text-[#00A2FF] border border-[#00A2FF]/40 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> VERIFIED
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-[#949BA4] font-mono">@{profile.name}</div>
                  </div>

                  {/* ID Copy Button */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[#949BA4] font-mono bg-[#1E1F22] px-2.5 py-1 rounded border border-[#2B2D31] flex items-center gap-1">
                      <Hash className="w-3.5 h-3.5 text-[#00A2FF]" />
                      ID: {profile.id}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(profile.id.toString(), 'id')}
                      className="text-xs bg-[#2B2D31] hover:bg-[#35373C] text-gray-300 hover:text-white px-2 py-1 rounded border border-[#35373C] transition-colors"
                      title="Sao chép ID"
                    >
                      {copiedId ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Key Cards: Join Date & Social Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Card: Ngày tham gia (Join Roblox) */}
                  <div className="p-3.5 rounded-lg bg-[#1E1F22] border border-[#2B2D31]">
                    <div className="text-xs font-bold text-[#949BA4] uppercase mb-1 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#00A2FF]" />
                      Ngày Tham Gia (Join Date)
                    </div>
                    <div className="text-base font-bold text-white">{profile.formattedJoinDate}</div>
                    <div className="text-xs text-[#00A2FF] font-medium mt-0.5">
                      ⏳ {profile.accountAgeText}
                    </div>
                  </div>

                  {/* Card: Bạn bè & Follower */}
                  <div className="p-3.5 rounded-lg bg-[#1E1F22] border border-[#2B2D31]">
                    <div className="text-xs font-bold text-[#949BA4] uppercase mb-1 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-purple-400" />
                      Tương Tác Xã Hội
                    </div>
                    <div className="text-sm font-semibold text-white flex items-center justify-between">
                      <span>Bạn bè (Friends):</span>
                      <span className="font-bold text-[#00A2FF]">{profile.friendsCount.toLocaleString('vi-VN')}</span>
                    </div>
                    <div className="text-sm font-semibold text-white flex items-center justify-between mt-1">
                      <span>Người theo dõi:</span>
                      <span className="font-bold text-purple-400">{profile.followersCount.toLocaleString('vi-VN')}</span>
                    </div>
                  </div>
                </div>

                {/* About / Description */}
                <div className="p-3.5 rounded-lg bg-[#1E1F22] border border-[#2B2D31]">
                  <div className="text-xs font-bold text-[#949BA4] uppercase mb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                    Tiểu Sử (About Me / Bio)
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed break-words whitespace-pre-wrap">
                    {profile.description || 'Người dùng này chưa viết tiểu sử.'}
                  </p>
                </div>

                {/* Profile URL & Copy Button */}
                <div className="p-3 rounded-lg bg-[#1E1F22] border border-[#2B2D31] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="truncate text-[#949BA4]">
                    <span className="text-white font-semibold mr-1">Link Profile:</span>
                    <a
                      href={profile.profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#00A2FF] hover:underline font-mono"
                    >
                      {profile.profileUrl}
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(profile.profileUrl, 'link')}
                    className="shrink-0 bg-[#2B2D31] hover:bg-[#35373C] text-gray-300 hover:text-white px-2.5 py-1 rounded border border-[#35373C] flex items-center gap-1.5 transition-colors font-medium"
                  >
                    {copiedLink ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Đã sao chép!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Sao chép Link
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Discord Slash Command Guide Box */}
        <div className="p-4 rounded-xl bg-[#111214] border border-[#2B2D31] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <div className="font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#00A2FF]" />
              Hướng Dẫn Dùng Lệnh Trong Discord Server:
            </div>
            <div className="text-[#949BA4]">
              • Dùng lệnh Slash: <code className="bg-[#1E1F22] text-[#00A2FF] px-1.5 py-0.5 rounded font-mono">/roblox username: Roblox</code> (Tự động gợi ý và hiển thị Embed tương tác)
              <br />
              • Hoặc dùng prefix: <code className="bg-[#1E1F22] text-[#00A2FF] px-1.5 py-0.5 rounded font-mono">.roblox &lt;username/ID&gt;</code>
            </div>
          </div>
          <div className="bg-[#00A2FF]/10 text-[#00A2FF] border border-[#00A2FF]/30 px-3 py-1.5 rounded-lg font-mono font-bold shrink-0">
            Slash Command Active
          </div>
        </div>
      </div>
    </div>
  );
}
