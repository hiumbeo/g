import { useState, useEffect, useCallback, FormEvent } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  AlertTriangle,
  UserCheck,
  UserX,
  Sliders,
  Radio,
  Trash2,
  RefreshCw,
  Zap,
  Activity,
  CheckCircle2,
  AlertOctagon
} from 'lucide-react';

interface WhitelistEntry {
  id: string;
  name: string;
  addedAt: number;
  addedBy: string;
}

interface AntiRaidConfig {
  enabled: boolean;
  lockdownMode: boolean;
  channelCreateLimit: number;
  channelDeleteLimit: number;
  roleCreateLimit: number;
  roleDeleteLimit: number;
  banLimit: number;
  kickLimit: number;
  massJoinLimit: number;
  punishment: 'ban' | 'kick' | 'timeout';
  whitelist: WhitelistEntry[];
  logsChannelId: string | null;
}

interface RaidIncident {
  id: string;
  timestamp: number;
  guildId: string;
  executorId: string;
  executorTag: string;
  actionType: string;
  details: string;
  punishmentTaken: string;
  severity: 'critical' | 'high' | 'medium';
}

const DEFAULT_CONFIG: AntiRaidConfig = {
  enabled: true,
  lockdownMode: false,
  channelCreateLimit: 3,
  channelDeleteLimit: 2,
  roleCreateLimit: 3,
  roleDeleteLimit: 2,
  banLimit: 3,
  kickLimit: 3,
  massJoinLimit: 5,
  punishment: 'ban',
  whitelist: [],
  logsChannelId: null,
};

export default function AntiRaidDashboard() {
  const [config, setConfig] = useState<AntiRaidConfig>(DEFAULT_CONFIG);
  const [incidents, setIncidents] = useState<RaidIncident[]>([]);
  const [loading, setLoading] = useState(false);
  const [lockdownLoading, setLockdownLoading] = useState(false);
  const [newWhitelistId, setNewWhitelistId] = useState('');
  const [newWhitelistName, setNewWhitelistName] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'whitelist' | 'logs'>('overview');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/antiraid/status');
      if (res.ok) {
        const data = await res.json();
        if (data && data.config) {
          setConfig(data.config);
          setIncidents(data.incidents || []);
        }
      }
    } catch {
      // Gracefully handle transient network delay or reload
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const showNotification = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  const handleToggleEnabled = async () => {
    if (!config) return;
    const nextState = !config.enabled;
    try {
      const res = await fetch('/api/antiraid/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextState })
      });
      if (res.ok) {
        setConfig((prev) => ({ ...prev, enabled: nextState }));
        showNotification(nextState ? 'Đã KÍCH HOẠT lá chắn Anti-Raid!' : 'Đã TẮT Anti-Raid');
      }
    } catch {
      showNotification('Không thể kết nối tới server để cập nhật');
    }
  };

  const handleToggleLockdown = async () => {
    if (!config || lockdownLoading) return;
    setLockdownLoading(true);
    const nextLockdown = !config.lockdownMode;
    try {
      const res = await fetch('/api/antiraid/lockdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enable: nextLockdown,
          reason: nextLockdown ? 'Kích hoạt thủ công từ Web Dashboard (Phòng ngừa Raid)' : 'Dỡ bỏ khóa khẩn cấp'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setConfig((prev) => ({ ...prev, lockdownMode: nextLockdown }));
        if (data.incidents) setIncidents(data.incidents);
        showNotification(
          nextLockdown
            ? '🚨 ĐÃ KHÓA TOÀN BỘ SERVER (PANIC LOCKDOWN) THÀNH CÔNG!'
            : '🔓 Đã mở khóa server trở lại bình thường.'
        );
      }
    } catch {
      showNotification('Không thể kết nối tới server để đổi trạng thái khóa');
    } finally {
      setLockdownLoading(false);
    }
  };

  const handleUpdateLimit = async (key: keyof AntiRaidConfig, value: number | string) => {
    try {
      const res = await fetch('/api/antiraid/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value })
      });
      if (res.ok) {
        setConfig((prev) => ({ ...prev, [key]: value }));
        showNotification('Đã lưu thiết lập Anti-Raid!');
      }
    } catch {
      showNotification('Không thể lưu thiết lập');
    }
  };

  const handleAddWhitelist = async (e: FormEvent) => {
    e.preventDefault();
    if (!newWhitelistId.trim()) return;
    try {
      const res = await fetch('/api/antiraid/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newWhitelistId.trim(),
          name: newWhitelistName.trim() || newWhitelistId.trim()
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.config) {
          setConfig(data.config);
        }
        setNewWhitelistId('');
        setNewWhitelistName('');
        showNotification('Đã thêm đối tượng vào Whitelist!');
      }
    } catch {
      showNotification('Không thể thêm vào Whitelist');
    }
  };

  const handleRemoveWhitelist = async (id: string) => {
    try {
      const res = await fetch(`/api/antiraid/whitelist/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.config) {
          setConfig(data.config);
        }
        showNotification('Đã xóa khỏi Whitelist');
      }
    } catch {
      showNotification('Không thể xóa khỏi Whitelist');
    }
  };

  const handleClearLogs = async () => {
    try {
      const res = await fetch('/api/antiraid/logs', { method: 'DELETE' });
      if (res.ok) {
        setIncidents([]);
        showNotification('Đã xóa toàn bộ nhật ký sự cố');
      }
    } catch {
      showNotification('Không thể xóa nhật ký');
    }
  };

  if (loading && !config) {
    return (
      <div className="bg-[#1E1F22] rounded-xl border border-[#2B2D31] p-8 text-center text-[#949BA4] mb-8">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#5865F2]" />
        Đang khởi động hệ thống phòng thủ Anti-Raid...
      </div>
    );
  }

  return (
    <div className="bg-[#1E1F22] rounded-xl border border-red-500/30 overflow-hidden mb-8 shadow-2xl relative">
      {/* Top Banner Alert */}
      <div
        className={`px-4 sm:px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b ${
          config.lockdownMode
            ? 'bg-red-950/80 border-red-600 animate-pulse'
            : config.enabled
            ? 'bg-[#2B2D31]/90 border-[#35373C]'
            : 'bg-[#1E1F22] border-[#2B2D31]'
        }`}
      >
        <div className="flex items-center space-x-3.5">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${
              config.lockdownMode
                ? 'bg-red-600 text-white'
                : config.enabled
                ? 'bg-gradient-to-tr from-red-600 to-amber-500 text-white'
                : 'bg-gray-800 text-gray-500'
            }`}
          >
            {config.lockdownMode ? (
              <AlertOctagon className="w-7 h-7" />
            ) : config.enabled ? (
              <ShieldAlert className="w-7 h-7" />
            ) : (
              <ShieldCheck className="w-7 h-7 text-gray-500" />
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h2 className="text-white font-black text-lg sm:text-xl tracking-tight">
                HỆ THỐNG PHÒNG THỦ ANTI-RAID & ANTI-NUKE
              </h2>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  config.lockdownMode
                    ? 'bg-red-600 text-white shadow-red-500/50 shadow-md'
                    : config.enabled
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-gray-700 text-gray-400'
                }`}
              >
                {config.lockdownMode ? '🚨 KHẨN CẤP (LOCKDOWN)' : config.enabled ? '🟢 ĐANG BẢO VỆ' : '⚪ ĐÃ TẮT'}
              </span>
            </div>
            <p className="text-xs text-[#949BA4] mt-0.5">
              Dựa trên kiến trúc mã nguồn Microngamer/anti-raid-1: Tự động phát hiện và trảm đối tượng phá hoại kênh, role, mass ban & bot raid!
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2.5 w-full md:w-auto">
          {/* Panic Button */}
          <button
            onClick={handleToggleLockdown}
            disabled={lockdownLoading}
            className={`flex-1 md:flex-none flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer shadow-lg ${
              config.lockdownMode
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
            }`}
          >
            {config.lockdownMode ? (
              <>
                <Unlock className="w-4 h-4" />
                <span>Mở Khóa Server</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Khóa Khẩn Cấp (Lockdown)</span>
              </>
            )}
          </button>

          {/* Master Switch */}
          <button
            onClick={handleToggleEnabled}
            className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition cursor-pointer border ${
              config.enabled
                ? 'bg-[#2B2D31] hover:bg-[#35373C] text-gray-300 border-gray-600'
                : 'bg-green-600 hover:bg-green-500 text-white border-green-500'
            }`}
          >
            {config.enabled ? 'Tạm Dừng Bảo Vệ' : 'Bật Anti-Raid'}
          </button>
        </div>
      </div>

      {/* Floating Notification */}
      {successMsg && (
        <div className="bg-emerald-600/90 text-white text-xs font-semibold px-4 py-2 text-center animate-fade-in flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {successMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center border-b border-[#2B2D31] bg-[#18191C]/80 px-4 sm:px-6 overflow-x-auto">
        {[
          { id: 'overview', label: 'Tổng Quan & Giám Sát', icon: Activity },
          { id: 'config', label: 'Cấu Hình Giới Hạn (Limits)', icon: Sliders },
          { id: 'whitelist', label: `Whitelist (${config.whitelist.length})`, icon: UserCheck },
          { id: 'logs', label: `Nhật Ký Sự Cố (${incidents.length})`, icon: AlertTriangle }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 py-3.5 px-4 text-xs font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-red-500 text-white bg-[#2B2D31]/40'
                  : 'border-transparent text-[#949BA4] hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-red-400' : ''}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="p-4 sm:p-6">
        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Status Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="bg-[#2B2D31]/60 p-3.5 rounded-xl border border-[#35373C]">
                <span className="text-[11px] text-[#949BA4] block mb-1 font-medium">Trạng thái lá chắn</span>
                <div className="flex items-center space-x-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${config.enabled ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="font-bold text-white text-sm">
                    {config.enabled ? 'Hoạt động' : 'Đã dừng'}
                  </span>
                </div>
              </div>

              <div className="bg-[#2B2D31]/60 p-3.5 rounded-xl border border-[#35373C]">
                <span className="text-[11px] text-[#949BA4] block mb-1 font-medium">Hình thức xử phạt</span>
                <div className="font-bold text-red-400 text-sm uppercase">
                  {config.punishment === 'ban' ? '🔨 Ban Vĩnh Viễn' : config.punishment === 'kick' ? '👢 Kick Khỏi Server' : '⏳ Timeout 28 ngày'}
                </div>
              </div>

              <div className="bg-[#2B2D31]/60 p-3.5 rounded-xl border border-[#35373C]">
                <span className="text-[11px] text-[#949BA4] block mb-1 font-medium">Chế độ Lockdown</span>
                <div className={`font-bold text-sm ${config.lockdownMode ? 'text-red-400' : 'text-emerald-400'}`}>
                  {config.lockdownMode ? '🔒 Đang khóa chat' : '🔓 Bình thường'}
                </div>
              </div>

              <div className="bg-[#2B2D31]/60 p-3.5 rounded-xl border border-[#35373C]">
                <span className="text-[11px] text-[#949BA4] block mb-1 font-medium">Vụ đột nhập bị chặn</span>
                <div className="font-bold text-white text-sm">
                  {incidents.length} sự cố
                </div>
              </div>
            </div>

            {/* Quick Defensive Guidelines for Raid Preparedness */}
            <div className="bg-red-950/20 border border-red-500/30 rounded-xl p-4">
              <div className="flex items-center space-x-2 text-red-400 font-bold text-sm mb-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>HÀNH ĐỘNG KHẨN CẤP KHI CÓ CUỘC TẤN CÔNG (RAID) SẮP DIỄN RA:</span>
              </div>
              <ul className="text-xs text-gray-300 space-y-1.5 list-disc pl-5">
                <li>
                  Nhấn ngay nút <strong className="text-red-300">[Khóa Khẩn Cấp (Lockdown)]</strong> phía trên để khóa toàn bộ quyền chat của <code className="bg-black/40 px-1 rounded text-red-400">@everyone</code>, ngăn chặn spam tin nhắn rác hoặc link lừa đảo.
                </li>
                <li>
                  Thêm tất cả các bot uy tín hoặc phó chủ server vào <strong className="text-white">Whitelist</strong> để không bị hệ thống tự động ban nhầm.
                </li>
                <li>
                  Hệ thống tự động theo dõi Audit Log: Nếu bất kỳ kẻ gian nào xóa hơn {config.channelDeleteLimit} kênh hoặc ban hơn {config.banLimit} thành viên trong 1 phút, SentinelBot sẽ lập tức trục xuất kẻ đó ngay!
                </li>
              </ul>
            </div>

            {/* Recent Threats Preview */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <Radio className="w-4 h-4 text-red-400 animate-pulse" />
                  Cảnh Báo & Xâm Nhập Gần Nhất
                </h3>
                <button
                  onClick={() => setActiveTab('logs')}
                  className="text-xs text-[#5865F2] hover:underline cursor-pointer"
                >
                  Xem toàn bộ nhật ký &rarr;
                </button>
              </div>

              {incidents.length === 0 ? (
                <div className="bg-[#2B2D31]/40 border border-[#35373C] rounded-xl p-6 text-center text-xs text-[#949BA4]">
                  🛡️ Chưa ghi nhận vụ xâm nhập nào. Máy chủ đang được bảo vệ an toàn.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {incidents.slice(0, 3).map((inc) => (
                    <div
                      key={inc.id}
                      className="bg-[#2B2D31] border border-red-500/30 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-bold text-red-400 uppercase">[{inc.actionType}]</span>
                          <span className="text-white font-semibold">{inc.executorTag}</span>
                          <span className="text-[#949BA4]">({inc.executorId})</span>
                        </div>
                        <p className="text-gray-300">{inc.details}</p>
                      </div>
                      <div className="sm:text-right shrink-0">
                        <span className="inline-block bg-red-500/20 text-red-300 font-bold px-2 py-0.5 rounded border border-red-500/40 text-[11px] mb-1">
                          {inc.punishmentTaken}
                        </span>
                        <div className="text-[11px] text-[#949BA4]">
                          {new Date(inc.timestamp).toLocaleTimeString('vi-VN')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. CONFIG LIMITS TAB */}
        {activeTab === 'config' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-white text-base mb-1">Ngưỡng Giới Hạn Tấn Công (Anti-Raid Limits)</h3>
              <p className="text-xs text-[#949BA4]">
                Nếu một tài khoản thực hiện hành vi vượt quá ngưỡng quy định trong vòng 1 phút, hệ thống sẽ tự động thực thi hình phạt ngay lập tức.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#2B2D31]/60 p-4 rounded-xl border border-[#35373C] space-y-2">
                <label className="text-xs font-bold text-white block">
                  Giới hạn Tạo Kênh (Channel Create Limit)
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={config.channelCreateLimit}
                    onChange={(e) => handleUpdateLimit('channelCreateLimit', parseInt(e.target.value) || 1)}
                    className="w-24 px-3 py-1.5 bg-[#111214] border border-[#35373C] rounded-lg text-white text-sm text-center"
                  />
                  <span className="text-xs text-[#949BA4]">kênh / phút</span>
                </div>
              </div>

              <div className="bg-[#2B2D31]/60 p-4 rounded-xl border border-[#35373C] space-y-2">
                <label className="text-xs font-bold text-white block">
                  Giới hạn Xóa Kênh (Channel Delete Limit)
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={config.channelDeleteLimit}
                    onChange={(e) => handleUpdateLimit('channelDeleteLimit', parseInt(e.target.value) || 1)}
                    className="w-24 px-3 py-1.5 bg-[#111214] border border-[#35373C] rounded-lg text-white text-sm text-center"
                  />
                  <span className="text-xs text-[#949BA4]">kênh / phút</span>
                </div>
              </div>

              <div className="bg-[#2B2D31]/60 p-4 rounded-xl border border-[#35373C] space-y-2">
                <label className="text-xs font-bold text-white block">
                  Giới hạn Tạo Role (Role Create Limit)
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={config.roleCreateLimit}
                    onChange={(e) => handleUpdateLimit('roleCreateLimit', parseInt(e.target.value) || 1)}
                    className="w-24 px-3 py-1.5 bg-[#111214] border border-[#35373C] rounded-lg text-white text-sm text-center"
                  />
                  <span className="text-xs text-[#949BA4]">role / phút</span>
                </div>
              </div>

              <div className="bg-[#2B2D31]/60 p-4 rounded-xl border border-[#35373C] space-y-2">
                <label className="text-xs font-bold text-white block">
                  Giới hạn Xóa Role (Role Delete Limit)
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={config.roleDeleteLimit}
                    onChange={(e) => handleUpdateLimit('roleDeleteLimit', parseInt(e.target.value) || 1)}
                    className="w-24 px-3 py-1.5 bg-[#111214] border border-[#35373C] rounded-lg text-white text-sm text-center"
                  />
                  <span className="text-xs text-[#949BA4]">role / phút</span>
                </div>
              </div>

              <div className="bg-[#2B2D31]/60 p-4 rounded-xl border border-[#35373C] space-y-2">
                <label className="text-xs font-bold text-white block">
                  Giới hạn Ban Hàng Loạt (Mass Ban Limit)
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={config.banLimit}
                    onChange={(e) => handleUpdateLimit('banLimit', parseInt(e.target.value) || 1)}
                    className="w-24 px-3 py-1.5 bg-[#111214] border border-[#35373C] rounded-lg text-white text-sm text-center"
                  />
                  <span className="text-xs text-[#949BA4]">lệnh ban / phút</span>
                </div>
              </div>

              <div className="bg-[#2B2D31]/60 p-4 rounded-xl border border-[#35373C] space-y-2">
                <label className="text-xs font-bold text-white block">
                  Giới hạn Kick Hàng Loạt (Mass Kick Limit)
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={config.kickLimit}
                    onChange={(e) => handleUpdateLimit('kickLimit', parseInt(e.target.value) || 1)}
                    className="w-24 px-3 py-1.5 bg-[#111214] border border-[#35373C] rounded-lg text-white text-sm text-center"
                  />
                  <span className="text-xs text-[#949BA4]">lệnh kick / phút</span>
                </div>
              </div>

              <div className="bg-[#2B2D31]/60 p-4 rounded-xl border border-[#35373C] space-y-2">
                <label className="text-xs font-bold text-white block">
                  Ngưỡng Bot Raid / Mass Join
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    min="2"
                    max="100"
                    value={config.massJoinLimit}
                    onChange={(e) => handleUpdateLimit('massJoinLimit', parseInt(e.target.value) || 2)}
                    className="w-24 px-3 py-1.5 bg-[#111214] border border-[#35373C] rounded-lg text-white text-sm text-center"
                  />
                  <span className="text-xs text-[#949BA4]">thành viên join / 10 giây</span>
                </div>
              </div>

              <div className="bg-[#2B2D31]/60 p-4 rounded-xl border border-[#35373C] space-y-2">
                <label className="text-xs font-bold text-white block">
                  Hình Thức Xử Phạt Đối Tượng Phá Hoại
                </label>
                <select
                  value={config.punishment}
                  onChange={(e) => handleUpdateLimit('punishment', e.target.value)}
                  className="w-full px-3 py-2 bg-[#111214] border border-[#35373C] rounded-lg text-white text-xs font-bold"
                >
                  <option value="ban">🔨 BAN VĨNH VIỄN (Khuyên dùng)</option>
                  <option value="kick">👢 KICK KHỎI SERVER</option>
                  <option value="timeout">⏳ TIMEOUT 28 NGÀY</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 3. WHITELIST TAB */}
        {activeTab === 'whitelist' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-white text-base mb-1">Danh Sách Whitelist An Toàn</h3>
              <p className="text-xs text-[#949BA4]">
                Những tài khoản và bot trong Whitelist sẽ được miễn trừ kiểm duyệt phá hoại. Lưu ý: Chủ sở hữu Server (Server Owner) luôn được miễn trừ mặc định.
              </p>
            </div>

            {/* Add Whitelist Form */}
            <form onSubmit={handleAddWhitelist} className="bg-[#2B2D31]/60 p-4 rounded-xl border border-[#35373C]">
              <h4 className="text-xs font-bold text-white mb-2">Thêm tài khoản / Bot vào Whitelist</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Discord User/Bot ID (VD: 123456789012345678)"
                  value={newWhitelistId}
                  onChange={(e) => setNewWhitelistId(e.target.value)}
                  className="px-3 py-2 bg-[#111214] border border-[#35373C] rounded-lg text-xs text-white placeholder-gray-500"
                  required
                />
                <input
                  type="text"
                  placeholder="Tên gợi nhớ (VD: Bot Quản Lý Phụ, Admin Tuấn...)"
                  value={newWhitelistName}
                  onChange={(e) => setNewWhitelistName(e.target.value)}
                  className="px-3 py-2 bg-[#111214] border border-[#35373C] rounded-lg text-xs text-white placeholder-gray-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center space-x-1"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Thêm Vào Whitelist</span>
                </button>
              </div>
            </form>

            {/* Whitelist Table */}
            <div className="bg-[#2B2D31]/40 rounded-xl border border-[#35373C] overflow-hidden">
              {config.whitelist.length === 0 ? (
                <div className="p-8 text-center text-[#949BA4] text-xs">
                  Danh sách Whitelist đang trống.
                </div>
              ) : (
                <div className="divide-y divide-[#35373C]">
                  {config.whitelist.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 flex items-center justify-between hover:bg-[#2B2D31]/80 transition text-xs"
                    >
                      <div>
                        <span className="font-bold text-white block">{item.name}</span>
                        <span className="text-[#949BA4] text-[11px]">ID: <code className="text-gray-300">{item.id}</code> • Thêm bởi: {item.addedBy}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveWhitelist(item.id)}
                        title="Xóa khỏi Whitelist"
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. LOGS TAB */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base">Nhật Ký Ngăn Chặn Xâm Nhập (Raid Logs)</h3>
                <p className="text-xs text-[#949BA4]">Ghi lại toàn bộ hành vi vi phạm và hình thức trừng phạt đã áp dụng.</p>
              </div>
              {incidents.length > 0 && (
                <button
                  onClick={handleClearLogs}
                  className="px-3 py-1.5 text-xs text-red-400 hover:text-white hover:bg-red-500/20 border border-red-500/30 rounded-lg transition cursor-pointer"
                >
                  Xóa lịch sử log
                </button>
              )}
            </div>

            {incidents.length === 0 ? (
              <div className="bg-[#2B2D31]/40 border border-[#35373C] rounded-xl p-8 text-center text-xs text-[#949BA4]">
                🛡️ Không có sự cố nào được ghi nhận.
              </div>
            ) : (
              <div className="space-y-3">
                {incidents.map((inc) => (
                  <div
                    key={inc.id}
                    className="bg-[#2B2D31] border border-red-500/30 rounded-xl p-4 text-xs space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#35373C] pb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-red-400 uppercase bg-red-500/10 px-2 py-0.5 rounded">
                          {inc.actionType}
                        </span>
                        <span className="font-semibold text-white">{inc.executorTag}</span>
                        <code className="text-[#949BA4] text-[11px] bg-black/40 px-1 py-0.5 rounded">{inc.executorId}</code>
                      </div>
                      <span className="text-[#949BA4] text-[11px]">
                        {new Date(inc.timestamp).toLocaleString('vi-VN')}
                      </span>
                    </div>
                    <p className="text-gray-200">{inc.details}</p>
                    <div className="flex items-center justify-between pt-1 text-[11px]">
                      <span className="text-[#949BA4]">Biện pháp xử lý:</span>
                      <span className="font-bold text-red-300 bg-red-950/60 px-2 py-0.5 rounded border border-red-800">
                        {inc.punishmentTaken}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
