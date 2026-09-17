import React, { useState, FormEvent } from 'react';
import {
  Video,
  Download,
  Music,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  ExternalLink,
  Sparkles,
  Terminal,
  AlertCircle,
  CheckCircle2,
  Copy,
  Clock,
  Play
} from 'lucide-react';
import { TikTokData } from '../types';

export default function TikTokTester() {
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<TikTokData | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleFetch = async (targetUrl?: string) => {
    const url = (targetUrl !== undefined ? targetUrl : urlInput).trim();
    if (!url) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/tiktok/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || 'Không thể phân tích video TikTok');
      }

      setData(resData.data);
      if (targetUrl !== undefined) {
        setUrlInput(targetUrl);
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi lấy thông tin TikTok');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleFetch();
  };

  const copyDiscordCommand = () => {
    const cmd = urlInput ? `.tiktok ${urlInput}` : '.tiktok <link_tiktok>';
    navigator.clipboard.writeText(cmd);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const formatNumber = (num?: number) => {
    if (!num) return '0';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return num.toLocaleString('vi-VN');
  };

  return (
    <div className="bg-[#1E1F22] rounded-xl border border-[#2B2D31] p-6 mb-12 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#2B2D31]">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00F2FE] via-[#000000] to-[#EE1D52] p-0.5 shadow-md flex items-center justify-center">
            <div className="w-full h-full bg-[#111214] rounded-[10px] flex items-center justify-center">
              <Video className="w-5 h-5 text-[#EE1D52]" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-white tracking-tight">Tải & Tự Động Nhận Diện Link TikTok</h2>
              <span className="text-[10px] bg-[#EE1D52]/20 text-[#EE1D52] border border-[#EE1D52]/30 px-2 py-0.5 rounded-full font-bold">
                NO WATERMARK
              </span>
            </div>
            <p className="text-xs text-[#949BA4]">
              Tự động nhận diện khi chat hoặc dùng lệnh <code className="text-white font-mono bg-[#111214] px-1 rounded">.tiktok</code> / <code className="text-white font-mono bg-[#111214] px-1 rounded">/tiktok</code>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={copyDiscordCommand}
            className="flex items-center space-x-1.5 bg-[#2B2D31] hover:bg-[#35373C] text-gray-300 text-xs px-3 py-1.5 rounded-lg border border-[#35373C] transition"
          >
            {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-[#23A559]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Đã copy lệnh' : 'Copy lệnh Discord'}</span>
          </button>
        </div>
      </div>

      {/* Description & Discord Info Banner */}
      <div className="mt-4 bg-[#111214] p-3.5 rounded-xl border border-[#2B2D31] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2 text-[#949BA4]">
          <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>
            <strong className="text-white">Tự động nhận diện & Xóa link (Auto-Clean):</strong> Bất kỳ ai gửi link TikTok vào chat, bot sẽ tự động xóa tin nhắn link đó và gửi lại video không logo, MP3 kèm tag người gửi!
          </span>
        </div>
        <div className="text-gray-400 flex items-center space-x-2 flex-shrink-0 font-mono text-[11px]">
          <span className="bg-[#1E1F22] px-2 py-1 rounded border border-[#2B2D31]">.tiktok auto on/off</span>
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={onSubmit} className="mt-5">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Dán link TikTok vào đây (ví dụ: https://vt.tiktok.com/ZS... hoặc https://www.tiktok.com/@...)"
              className="w-full bg-[#111214] border border-[#2B2D31] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#949BA4] focus:outline-none focus:border-[#EE1D52] transition font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !urlInput.trim()}
            className="flex items-center justify-center space-x-2 bg-gradient-to-r from-[#EE1D52] to-[#ff2d55] hover:opacity-90 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition shadow-md shadow-[#EE1D52]/20"
          >
            {loading ? (
              <span className="animate-spin text-lg">⏳</span>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Phân tích & Tải</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Error display */}
      {error && (
        <div className="mt-4 p-3.5 rounded-xl bg-[#DA373C]/10 border border-[#DA373C]/20 flex items-center space-x-2 text-xs text-red-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* TikTok Result Card */}
      {data && (
        <div className="mt-6 bg-[#111214] border border-[#2B2D31] rounded-xl p-5">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Video Preview or Cover */}
            <div className="w-full md:w-64 flex-shrink-0">
              <div className="relative aspect-[9/16] bg-black rounded-lg overflow-hidden border border-[#2B2D31] shadow-inner group">
                {data.videoUrl ? (
                  <video
                    src={data.videoUrl}
                    poster={data.cover}
                    controls
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img
                    src={data.cover}
                    alt={data.title}
                    className="w-full h-full object-cover"
                  />
                )}
                {data.duration > 0 && (
                  <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-white flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{data.duration}s</span>
                  </div>
                )}
              </div>
            </div>

            {/* Video Details */}
            <div className="flex-1 flex flex-col justify-between">
              <div>
                {/* Author row */}
                <div className="flex items-center space-x-3 mb-3">
                  {data.author.avatar ? (
                    <img
                      src={data.author.avatar}
                      alt={data.author.uniqueId}
                      className="w-10 h-10 rounded-full border border-[#2B2D31] object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#2B2D31] flex items-center justify-center text-white font-bold">
                      {data.author.uniqueId[0]?.toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-white text-sm">{data.author.nickname}</h3>
                    <p className="text-xs text-[#949BA4]">@{data.author.uniqueId}</p>
                  </div>
                </div>

                {/* Title / Caption */}
                <p className="text-sm text-gray-200 line-clamp-3 mb-4 leading-relaxed font-normal">
                  {data.title || 'Video TikTok không có phụ đề'}
                </p>

                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
                  <div className="bg-[#1E1F22] p-2.5 rounded-lg border border-[#2B2D31] flex items-center space-x-2">
                    <Heart className="w-4 h-4 text-red-400" />
                    <div>
                      <div className="text-[10px] text-[#949BA4]">Lượt thích</div>
                      <div className="text-xs font-bold text-white">{formatNumber(data.stats.diggCount)}</div>
                    </div>
                  </div>

                  <div className="bg-[#1E1F22] p-2.5 rounded-lg border border-[#2B2D31] flex items-center space-x-2">
                    <MessageCircle className="w-4 h-4 text-sky-400" />
                    <div>
                      <div className="text-[10px] text-[#949BA4]">Bình luận</div>
                      <div className="text-xs font-bold text-white">{formatNumber(data.stats.commentCount)}</div>
                    </div>
                  </div>

                  <div className="bg-[#1E1F22] p-2.5 rounded-lg border border-[#2B2D31] flex items-center space-x-2">
                    <Share2 className="w-4 h-4 text-green-400" />
                    <div>
                      <div className="text-[10px] text-[#949BA4]">Chia sẻ</div>
                      <div className="text-xs font-bold text-white">{formatNumber(data.stats.shareCount)}</div>
                    </div>
                  </div>

                  <div className="bg-[#1E1F22] p-2.5 rounded-lg border border-[#2B2D31] flex items-center space-x-2">
                    <Eye className="w-4 h-4 text-amber-400" />
                    <div>
                      <div className="text-[10px] text-[#949BA4]">Lượt xem</div>
                      <div className="text-xs font-bold text-white">{formatNumber(data.stats.playCount)}</div>
                    </div>
                  </div>
                </div>

                {/* Music info */}
                {data.musicTitle && (
                  <div className="bg-[#1E1F22] p-3 rounded-lg border border-[#2B2D31] flex items-center space-x-3 mb-5">
                    <Music className="w-4 h-4 text-purple-400 flex-shrink-0 animate-pulse" />
                    <div className="text-xs truncate">
                      <span className="text-white font-medium">{data.musicTitle}</span>
                      {data.musicAuthor && <span className="text-[#949BA4]"> - {data.musicAuthor}</span>}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2.5 pt-4 border-t border-[#2B2D31]">
                {(data.hdVideoUrl || data.videoUrl) && (
                  <a
                    href={data.hdVideoUrl || data.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    download="tiktok_no_watermark.mp4"
                    className="flex items-center space-x-2 bg-[#23A559] hover:bg-[#1f934f] text-white text-xs px-4 py-2 rounded-lg font-medium transition shadow"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải Video Không Logo (HD)</span>
                  </a>
                )}

                {data.musicUrl && (
                  <a
                    href={data.musicUrl}
                    target="_blank"
                    rel="noreferrer"
                    download="tiktok_audio.mp3"
                    className="flex items-center space-x-2 bg-[#2B2D31] hover:bg-[#35373C] text-purple-300 border border-purple-500/30 text-xs px-4 py-2 rounded-lg font-medium transition"
                  >
                    <Music className="w-3.5 h-3.5" />
                    <span>Tải Nhạc (MP3)</span>
                  </a>
                )}

                <a
                  href={data.originalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center space-x-1.5 bg-[#2B2D31] hover:bg-[#35373C] text-gray-300 border border-[#35373C] text-xs px-3 py-2 rounded-lg transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Mở TikTok</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
