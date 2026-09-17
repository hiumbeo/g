import { useState, FormEvent } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Globe,
  FileCode,
  AlertTriangle,
  Search,
  RefreshCw,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Cpu,
  Info,
  Send,
  Loader2
} from 'lucide-react';
import { ScanRecord, ScanType } from '../types';

interface ScanHistoryProps {
  scans: ScanRecord[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onClear: () => Promise<void>;
  onScanUrl: (url: string) => Promise<void>;
}

export default function ScanHistory({
  scans,
  isLoading,
  onRefresh,
  onClear,
  onScanUrl
}: ScanHistoryProps) {
  const [filterType, setFilterType] = useState<'all' | ScanType | 'threats'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [quickUrl, setQuickUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [quickError, setQuickError] = useState('');

  // Counters
  const totalCount = scans.length;
  const safeCount = scans.filter((s) => s.threatLevel === 'safe').length;
  const warningCount = scans.filter((s) => s.threatLevel === 'warning').length;
  const dangerCount = scans.filter((s) => s.threatLevel === 'danger').length;

  // Filter & search logic
  const filteredScans = scans.filter((scan) => {
    if (filterType === 'web' && scan.type !== 'web') return false;
    if (filterType === 'file' && scan.type !== 'file') return false;
    if (filterType === 'threats' && scan.threatLevel === 'safe') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTarget = scan.target.toLowerCase().includes(q);
      const matchAuthor = scan.author.toLowerCase().includes(q);
      const matchFindings = scan.findings.some((f) => f.toLowerCase().includes(q));
      const matchIp = scan.ipAddress ? scan.ipAddress.includes(q) : false;
      return matchTarget || matchAuthor || matchFindings || matchIp;
    }

    return true;
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleQuickScanSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!quickUrl.trim()) return;
    setIsScanning(true);
    setQuickError('');
    try {
      await onScanUrl(quickUrl.trim());
      setQuickUrl('');
    } catch (err: any) {
      setQuickError(err.message || 'Lỗi khi quét liên kết');
    } finally {
      setIsScanning(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    return new Date(timestamp).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <section id="scan-history-section" className="bg-[#1E1F22] rounded-2xl border border-[#2B2D31] overflow-hidden mb-12 shadow-xl">
      {/* Section Header */}
      <div className="p-6 border-b border-[#2B2D31] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#5865F2]/20 flex items-center justify-center text-[#5865F2]">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Lịch Sử Quét An Ninh CyberSec
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#23A559]/10 text-[#23A559] border border-[#23A559]/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#23A559] mr-1.5 animate-pulse"></span>
                  Local State Live
                </span>
              </h2>
              <p className="text-[#949BA4] text-sm mt-0.5">
                Nhật ký các kết quả phân tích từ lệnh <code className="text-gray-300">.scanweb</code> và <code className="text-gray-300">.scanfile</code>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-start md:self-auto">
          <button
            id="refresh-scans-btn"
            onClick={() => onRefresh()}
            disabled={isLoading}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#2B2D31] hover:bg-[#35373C] text-gray-200 text-sm font-medium transition disabled:opacity-50 cursor-pointer"
            title="Tải lại lịch sử quét"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
          {scans.length > 0 && (
            <button
              id="clear-scans-btn"
              onClick={() => {
                if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử quét không?')) {
                  onClear();
                }
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition cursor-pointer"
              title="Xóa toàn bộ lịch sử quét"
            >
              <Trash2 className="w-4 h-4" />
              <span>Xóa lịch sử</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#2B2D31] border-b border-[#2B2D31]">
        <div className="bg-[#1E1F22] p-4 text-center">
          <span className="text-xs font-medium text-[#949BA4] uppercase tracking-wider block mb-1">
            Tổng Lượt Quét
          </span>
          <span className="text-2xl font-bold text-white">{totalCount}</span>
        </div>
        <div className="bg-[#1E1F22] p-4 text-center">
          <span className="text-xs font-medium text-[#23A559] uppercase tracking-wider block mb-1">
            An Toàn
          </span>
          <span className="text-2xl font-bold text-[#23A559]">{safeCount}</span>
        </div>
        <div className="bg-[#1E1F22] p-4 text-center">
          <span className="text-xs font-medium text-[#FEE75C] uppercase tracking-wider block mb-1">
            Đáng Nghi Vấn
          </span>
          <span className="text-2xl font-bold text-[#FEE75C]">{warningCount}</span>
        </div>
        <div className="bg-[#1E1F22] p-4 text-center">
          <span className="text-xs font-medium text-[#ED4245] uppercase tracking-wider block mb-1">
            Mã Độc / Rủi Ro
          </span>
          <span className="text-2xl font-bold text-[#ED4245]">{dangerCount}</span>
        </div>
      </div>

      {/* Quick Web Scan Bar */}
      <div className="p-4 sm:p-6 bg-[#2B2D31]/30 border-b border-[#2B2D31]">
        <form onSubmit={handleQuickScanSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Globe className="w-5 h-5 text-[#949BA4] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={quickUrl}
              onChange={(e) => setQuickUrl(e.target.value)}
              placeholder="Thử nghiệm quét nhanh URL trực tiếp từ Dashboard (ví dụ: https://discord.com)..."
              disabled={isScanning}
              className="w-full pl-11 pr-4 py-2.5 bg-[#111214] border border-[#2B2D31] focus:border-[#5865F2] focus:ring-1 focus:ring-[#5865F2] rounded-xl text-sm text-white placeholder-[#949BA4] outline-none transition"
            />
          </div>
          <button
            type="submit"
            disabled={isScanning || !quickUrl.trim()}
            className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md cursor-pointer shrink-0"
          >
            {isScanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang phân tích...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Quét Ngay</span>
              </>
            )}
          </button>
        </form>

        {quickError && (
          <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            {quickError}
          </p>
        )}

        {/* Quick sample chips */}
        <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-[#949BA4]">
          <span>Gợi ý test nhanh:</span>
          <button
            type="button"
            onClick={() => setQuickUrl('https://discord.com')}
            className="px-2 py-1 rounded-md bg-[#111214] hover:bg-[#2B2D31] text-gray-300 transition"
          >
            discord.com (An toàn)
          </button>
          <button
            type="button"
            onClick={() => setQuickUrl('https://discord-nitro-gift.xyz')}
            className="px-2 py-1 rounded-md bg-[#111214] hover:bg-[#2B2D31] text-red-400 transition"
          >
            discord-nitro-gift.xyz (Lừa đảo)
          </button>
          <button
            type="button"
            onClick={() => setQuickUrl('https://github.com')}
            className="px-2 py-1 rounded-md bg-[#111214] hover:bg-[#2B2D31] text-gray-300 transition"
          >
            github.com (An toàn)
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 border-b border-[#2B2D31] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-1 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { id: 'all', label: `Tất cả (${totalCount})` },
              { id: 'web', label: 'Web (.scanweb)' },
              { id: 'file', label: 'Tệp (.scanfile)' },
              { id: 'threats', label: `Độc hại (${warningCount + dangerCount})` }
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                filterType === tab.id
                  ? 'bg-[#5865F2] text-white shadow-sm'
                  : 'bg-transparent hover:bg-[#2B2D31] text-[#949BA4]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[#949BA4] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo URL, file, user..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#111214] border border-[#2B2D31] rounded-lg text-xs text-white placeholder-[#949BA4] outline-none focus:border-[#5865F2]"
          />
        </div>
      </div>

      {/* Scan Records List */}
      <div className="divide-y divide-[#2B2D31]">
        {filteredScans.length === 0 ? (
          <div className="p-12 text-center">
            <Info className="w-10 h-10 text-[#949BA4] mx-auto mb-3 opacity-40" />
            <h4 className="text-white font-semibold text-base mb-1">Không tìm thấy kết quả quét</h4>
            <p className="text-sm text-[#949BA4] max-w-md mx-auto">
              {searchQuery
                ? `Không có bản ghi nào khớp với từ khóa "${searchQuery}". Hãy thử tìm kiếm khác.`
                : 'Chưa có dữ liệu phân tích nào. Hãy sử dụng lệnh .scanweb hoặc .scanfile trong Discord, hoặc nhập URL ở trên để bắt đầu!'}
            </p>
          </div>
        ) : (
          filteredScans.map((scan) => {
            const isExpanded = expandedId === scan.id;

            return (
              <div
                key={scan.id}
                id={`scan-record-${scan.id}`}
                className="transition hover:bg-[#232428]"
              >
                {/* Main Card Row */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start space-x-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        scan.threatLevel === 'danger'
                          ? 'bg-[#ED4245]/20 text-[#ED4245]'
                          : scan.threatLevel === 'warning'
                          ? 'bg-[#FEE75C]/20 text-[#FEE75C]'
                          : 'bg-[#23A559]/20 text-[#23A559]'
                      }`}
                    >
                      {scan.type === 'web' ? (
                        <Globe className="w-5 h-5" />
                      ) : (
                        <FileCode className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-[#2B2D31] text-[#949BA4]">
                          {scan.type === 'web' ? 'Quét URL' : 'Quét Tệp'}
                        </span>
                        {scan.guildName && (
                          <span className="text-xs text-[#949BA4]">
                            server: <span className="text-gray-300 font-medium">{scan.guildName}</span>
                          </span>
                        )}
                        <span className="text-xs text-[#949BA4]">
                          bởi <span className="text-gray-300 font-medium">@{scan.author}</span>
                        </span>
                        <span className="text-xs text-[#949BA4]">• {formatTime(scan.timestamp)}</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {scan.type === 'web' ? (
                          <a
                            href={scan.target}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white font-semibold text-base hover:text-[#5865F2] hover:underline flex items-center gap-1.5 truncate max-w-full"
                          >
                            <span className="truncate">{scan.target}</span>
                            <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-60" />
                          </a>
                        ) : (
                          <div className="text-white font-semibold text-base flex items-center gap-2 truncate">
                            <span className="truncate">{scan.target}</span>
                            {scan.fileSize && (
                              <span className="text-xs font-normal text-[#949BA4] bg-[#2B2D31] px-1.5 py-0.5 rounded shrink-0">
                                {(scan.fileSize / 1024).toFixed(1)} KB
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Badges & Action Toggle */}
                  <div className="flex items-center justify-between sm:justify-end space-x-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#2B2D31]/60">
                    <div className="flex flex-col items-end">
                      <div
                        className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          scan.threatLevel === 'danger'
                            ? 'bg-[#ED4245]/20 text-[#ED4245] border border-[#ED4245]/30'
                            : scan.threatLevel === 'warning'
                            ? 'bg-[#FEE75C]/20 text-[#FEE75C] border border-[#FEE75C]/30'
                            : 'bg-[#23A559]/20 text-[#23A559] border border-[#23A559]/30'
                        }`}
                      >
                        {scan.threatLevel === 'danger' ? (
                          <ShieldAlert className="w-3.5 h-3.5" />
                        ) : scan.threatLevel === 'warning' ? (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        )}
                        <span>{scan.statusBadge.split(' ')[1] || 'KẾT QUẢ'}</span>
                        <span className="text-[11px] opacity-80">({scan.threatScore}/100)</span>
                      </div>
                      <span className="text-[11px] text-[#949BA4] mt-0.5">
                        Xử lý trong {scan.durationMs}ms
                      </span>
                    </div>

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : scan.id)}
                      className={`p-2 rounded-lg text-[#949BA4] hover:text-white transition cursor-pointer ${
                        isExpanded ? 'bg-[#2B2D31] text-white' : 'hover:bg-[#2B2D31]'
                      }`}
                      title={isExpanded ? 'Thu gọn chi tiết' : 'Xem báo cáo chi tiết'}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Details Panel */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-1 bg-[#18191C]/80 border-t border-[#2B2D31]">
                    {/* Score Bar */}
                    <div className="mt-3 mb-4">
                      <div className="flex justify-between items-center text-xs mb-1.5">
                        <span className="text-[#949BA4] font-medium">Chỉ số rủi ro an ninh mạng (Threat Score):</span>
                        <span
                          className={`font-bold ${
                            scan.threatLevel === 'danger'
                              ? 'text-[#ED4245]'
                              : scan.threatLevel === 'warning'
                              ? 'text-[#FEE75C]'
                              : 'text-[#23A559]'
                          }`}
                        >
                          {scan.threatScore} / 100 ({scan.threatScore > 50 ? 'Rủi ro cao' : scan.threatScore > 20 ? 'Cảnh giác' : 'An toàn tuyệt đối'})
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#2B2D31] overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            scan.threatLevel === 'danger'
                              ? 'bg-[#ED4245]'
                              : scan.threatLevel === 'warning'
                              ? 'bg-[#FEE75C]'
                              : 'bg-[#23A559]'
                          }`}
                          style={{ width: `${Math.max(scan.threatScore, 4)}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      {scan.type === 'web' ? (
                        <>
                          <div className="bg-[#1E1F22] p-2.5 rounded-lg border border-[#2B2D31]">
                            <span className="text-[11px] text-[#949BA4] block">Địa chỉ IP máy chủ</span>
                            <span className="text-xs font-mono font-bold text-white">{scan.ipAddress || 'N/A'}</span>
                          </div>
                          <div className="bg-[#1E1F22] p-2.5 rounded-lg border border-[#2B2D31]">
                            <span className="text-[11px] text-[#949BA4] block">Chứng chỉ SSL</span>
                            <span className="text-xs font-semibold text-white">
                              {scan.isHttps ? '🔒 HTTPS Mã hóa' : '⚠️ HTTP Không an toàn'}
                            </span>
                          </div>
                          <div className="bg-[#1E1F22] p-2.5 rounded-lg border border-[#2B2D31]">
                            <span className="text-[11px] text-[#949BA4] block">Mã phản hồi HTTP</span>
                            <span className="text-xs font-mono font-bold text-white">
                              {scan.statusCode ? `${scan.statusCode} OK` : 'Chặn / Timeout'}
                            </span>
                          </div>
                          <div className="bg-[#1E1F22] p-2.5 rounded-lg border border-[#2B2D31]">
                            <span className="text-[11px] text-[#949BA4] block">Máy chủ phục vụ</span>
                            <span className="text-xs font-semibold text-white truncate block">
                              {scan.serverBanner || 'Cloudflare'}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="bg-[#1E1F22] p-2.5 rounded-lg border border-[#2B2D31]">
                            <span className="text-[11px] text-[#949BA4] block">Định dạng nhị phân</span>
                            <span className="text-xs font-mono font-bold text-white truncate block">
                              {scan.detectedType || 'N/A'}
                            </span>
                          </div>
                          <div className="bg-[#1E1F22] p-2.5 rounded-lg border border-[#2B2D31]">
                            <span className="text-[11px] text-[#949BA4] block">Độ hỗn loạn Entropy</span>
                            <span className="text-xs font-semibold text-white">
                              {scan.entropy !== undefined ? `${scan.entropy}/8.0` : 'N/A'}
                            </span>
                          </div>
                          <div className="bg-[#1E1F22] p-2.5 rounded-lg border border-[#2B2D31]">
                            <span className="text-[11px] text-[#949BA4] block">Kích thước file</span>
                            <span className="text-xs font-mono font-bold text-white">
                              {scan.fileSize ? `${(scan.fileSize / 1024).toFixed(2)} KB` : 'N/A'}
                            </span>
                          </div>
                          <div className="bg-[#1E1F22] p-2.5 rounded-lg border border-[#2B2D31]">
                            <span className="text-[11px] text-[#949BA4] block">Thời gian rà soát</span>
                            <span className="text-xs font-semibold text-white">
                              {scan.durationMs}ms
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* File Hashes (If File) */}
                    {scan.type === 'file' && (scan.sha256 || scan.md5) && (
                      <div className="space-y-2 mb-4">
                        {scan.sha256 && (
                          <div className="bg-[#1E1F22] px-3 py-2 rounded-lg border border-[#2B2D31] flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-[10px] uppercase font-bold text-[#949BA4] block">SHA-256 Hash</span>
                              <code className="text-xs font-mono text-gray-300 truncate block">{scan.sha256}</code>
                            </div>
                            <button
                              onClick={() => handleCopy(scan.sha256!, `sha-${scan.id}`)}
                              className="p-1.5 rounded hover:bg-[#2B2D31] text-[#949BA4] hover:text-white shrink-0 cursor-pointer"
                              title="Sao chép SHA-256"
                            >
                              {copiedHash === `sha-${scan.id}` ? (
                                <Check className="w-4 h-4 text-[#23A559]" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        )}
                        {scan.md5 && (
                          <div className="bg-[#1E1F22] px-3 py-2 rounded-lg border border-[#2B2D31] flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-[10px] uppercase font-bold text-[#949BA4] block">MD5 Hash</span>
                              <code className="text-xs font-mono text-gray-300 truncate block">{scan.md5}</code>
                            </div>
                            <button
                              onClick={() => handleCopy(scan.md5!, `md5-${scan.id}`)}
                              className="p-1.5 rounded hover:bg-[#2B2D31] text-[#949BA4] hover:text-white shrink-0 cursor-pointer"
                              title="Sao chép MD5"
                            >
                              {copiedHash === `md5-${scan.id}` ? (
                                <Check className="w-4 h-4 text-[#23A559]" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Findings & Warnings */}
                    {scan.findings && scan.findings.length > 0 && (
                      <div className="mb-3">
                        <span className="text-xs font-bold text-white mb-1.5 block">
                          Phát hiện Kỹ thuật & Cảnh báo An ninh:
                        </span>
                        <ul className="space-y-1.5">
                          {scan.findings.map((item, idx) => (
                            <li
                              key={idx}
                              className="text-xs text-gray-300 bg-[#1E1F22] p-2 rounded border border-[#2B2D31]/80 leading-relaxed"
                            >
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Gemini AI CyberSec Verdict */}
                    {scan.aiVerdict && (
                      <div className="mt-3 p-3 rounded-xl bg-[#5865F2]/10 border border-[#5865F2]/20">
                        <div className="flex items-center space-x-2 text-[#5865F2] text-xs font-bold mb-1">
                          <Cpu className="w-4 h-4" />
                          <span>Nhận định Trí Tuệ Nhân Tạo (Gemini AI CyberSec)</span>
                        </div>
                        <p className="text-xs text-gray-200 leading-relaxed italic">
                          "{scan.aiVerdict}"
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
