import React, { useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  Square,
  Volume2,
  VolumeX,
  Volume1,
  Repeat,
  Repeat1,
  Shuffle,
  Music2,
  Radio,
  ExternalLink,
  Trash2,
  RefreshCw,
  Search,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Headphones,
} from 'lucide-react';

interface MusicSong {
  id: string;
  title: string;
  artist?: string;
  url: string;
  duration: string;
  thumbnail?: string;
  requestedBy: string;
  platform: 'youtube' | 'spotify' | 'soundcloud' | 'direct' | 'search';
}

interface VoiceChannelOption {
  id: string;
  name: string;
  guildId: string;
  guildName: string;
}

interface MusicState {
  active: boolean;
  guildId: string | null;
  guildName: string | null;
  voiceChannelId: string | null;
  voiceChannelName: string | null;
  isPlaying: boolean;
  isPaused: boolean;
  volume: number;
  loopMode: 'off' | 'track' | 'queue';
  currentSong: MusicSong | null;
  queue: MusicSong[];
  voiceChannels: VoiceChannelOption[];
  soundcloudId: string;
}

export const MusicDashboard: React.FC = () => {
  const [state, setState] = useState<MusicState>({
    active: false,
    guildId: null,
    guildName: null,
    voiceChannelId: null,
    voiceChannelName: null,
    isPlaying: false,
    isPaused: false,
    volume: 100,
    loopMode: 'off',
    currentSong: null,
    queue: [],
    voiceChannels: [],
    soundcloudId: '',
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [refreshingScId, setRefreshingScId] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/music/status');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setState((prev) => ({
            ...prev,
            ...data,
          }));
          if (!selectedChannel && data.voiceChannels?.length > 0) {
            setSelectedChannel(data.voiceChannelId || data.voiceChannels[0].id);
          }
        }
      }
    } catch {
      // Background poll transient failure
    }
  }, [selectedChannel]);

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 3000);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handlePlaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      showFeedback('Vui lòng nhập tên bài hát hoặc liên kết (YouTube / Spotify / SoundCloud / Direct)!', 'error');
      return;
    }

    setLoadingAction('play');
    try {
      const res = await fetch('/api/music/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery.trim(),
          channelId: selectedChannel || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Không thể phát bài hát này.');
      }
      setSearchQuery('');
      setState((prev) => ({ ...prev, ...data }));
      showFeedback('🎶 Đã thêm bài hát vào hàng đợi phát thành công!');
    } catch (err: any) {
      showFeedback(err.message || 'Lỗi khi gửi yêu cầu phát nhạc', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const sendControl = async (action: string, value?: any) => {
    setLoadingAction(action);
    try {
      const res = await fetch('/api/music/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, value }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Thao tác thất bại.');
      }
      setState((prev) => ({ ...prev, ...data }));
    } catch (err: any) {
      showFeedback(err.message || 'Không thể thực hiện thao tác', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRefreshSoundCloud = async () => {
    setRefreshingScId(true);
    try {
      const res = await fetch('/api/music/refresh-scid', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showFeedback(`✅ Đã làm mới Client ID SoundCloud thành công! (${data.latencyMs}ms)`);
        await fetchStatus();
      } else {
        showFeedback('Không thể tự động làm mới SoundCloud ID', 'error');
      }
    } catch {
      showFeedback('Lỗi kết nối khi làm mới ID', 'error');
    } finally {
      setRefreshingScId(false);
    }
  };

  const getPlatformBadge = (platform?: string) => {
    switch (platform) {
      case 'spotify':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954]" />
            Spotify
          </span>
        );
      case 'youtube':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            YouTube
          </span>
        );
      case 'direct':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <Radio className="w-3 h-3 text-blue-400" />
            Direct Audio
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            SoundCloud
          </span>
        );
    }
  };

  return (
    <div className="bg-[#1E1F22] rounded-2xl border border-emerald-500/30 p-6 mb-12 shadow-xl shadow-black/20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#2B2D31]">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Music2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-wide">Trung Tâm Phát Nhạc Đa Nền Tảng</h2>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] px-2 py-0.5 rounded-full font-medium">
                V3 Multi-Engine
              </span>
            </div>
            <p className="text-xs text-[#949BA4] mt-0.5">
              Hỗ trợ tự động nhận diện YouTube, Spotify, SoundCloud & Direct MP3 / Radio Stream
            </p>
          </div>
        </div>

        {/* Live Status indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#2B2D31]/60 border border-[#35373C] text-xs">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                state.isPlaying && !state.isPaused
                  ? 'bg-emerald-400 animate-pulse'
                  : state.isPaused
                  ? 'bg-amber-400'
                  : 'bg-zinc-500'
              }`}
            />
            <span className="text-zinc-200 font-medium">
              {state.isPlaying && !state.isPaused
                ? 'Đang phát'
                : state.isPaused
                ? 'Đang tạm dừng'
                : state.active
                ? 'Sẵn sàng'
                : 'Chưa vào Voice'}
            </span>
            {state.voiceChannelName && (
              <span className="text-zinc-400 border-l border-zinc-700 pl-2 flex items-center gap-1">
                <Headphones className="w-3 h-3 text-emerald-400" />
                {state.voiceChannelName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div
          className={`mt-4 p-3 rounded-xl flex items-center gap-2.5 text-sm ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border border-red-500/30 text-red-300'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span className="flex-1 font-medium">{feedbackMsg.text}</span>
        </div>
      )}

      {/* Search / Play Input Section */}
      <form onSubmit={handlePlaySubmit} className="mt-6 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Dán link YouTube, Spotify, SoundCloud hoặc gõ tên bài hát..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#111214] border border-[#2B2D31] focus:border-emerald-500/50 rounded-xl text-sm text-white placeholder-zinc-500 outline-none transition"
            />
          </div>

          {state.voiceChannels.length > 0 && (
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="bg-[#111214] border border-[#2B2D31] text-xs text-zinc-300 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500/50 max-w-xs"
            >
              {state.voiceChannels.map((vc) => (
                <option key={vc.id} value={vc.id}>
                  🔊 {vc.guildName} › {vc.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="submit"
            disabled={loadingAction === 'play'}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition shadow-lg shadow-emerald-600/20 whitespace-nowrap"
          >
            {loadingAction === 'play' ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-white" />
            )}
            <span>Phát Ngay</span>
          </button>
        </div>

        {/* Quick Platform tags */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-zinc-400">
          <span className="font-medium">Nguồn hỗ trợ:</span>
          <span className="px-2 py-0.5 rounded-md bg-[#2B2D31] text-red-300">🔴 YouTube (Video/Shorts/Music)</span>
          <span className="px-2 py-0.5 rounded-md bg-[#2B2D31] text-emerald-300">🟢 Spotify (Track/Album/Playlist)</span>
          <span className="px-2 py-0.5 rounded-md bg-[#2B2D31] text-amber-300">🟠 SoundCloud (Hifi 320k)</span>
          <span className="px-2 py-0.5 rounded-md bg-[#2B2D31] text-blue-300">🌐 Direct Audio (.mp3/.wav/.ogg)</span>
        </div>
      </form>

      {/* Main Player & Queue Grid */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Now Playing Card (7 cols) */}
        <div className="lg:col-span-7 bg-[#111214] rounded-xl border border-[#2B2D31] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Đang Phát
              </span>
              {state.currentSong && getPlatformBadge(state.currentSong.platform)}
            </div>

            {state.currentSong ? (
              <div className="flex items-start gap-4">
                <div className="relative w-24 h-24 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0 border border-[#2B2D31] shadow-md">
                  {state.currentSong.thumbnail ? (
                    <img
                      src={state.currentSong.thumbnail}
                      alt={state.currentSong.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music2 className="w-10 h-10 text-zinc-600" />
                    </div>
                  )}
                  {state.isPlaying && !state.isPaused && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-bold text-base line-clamp-2 leading-snug">
                    {state.currentSong.title}
                  </h3>
                  {state.currentSong.artist && (
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-1">
                      Nghệ sĩ: <span className="text-zinc-300 font-medium">{state.currentSong.artist}</span>
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-zinc-400">
                    <span>⏱️ {state.currentSong.duration}</span>
                    <span>👤 {state.currentSong.requestedBy}</span>
                    {state.currentSong.url && (
                      <a
                        href={state.currentSong.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-400 hover:underline flex items-center gap-0.5 font-medium"
                      >
                        Mở link <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-10 flex flex-col items-center justify-center text-center">
                <Music2 className="w-12 h-12 text-zinc-700 mb-2" />
                <p className="text-sm font-semibold text-zinc-300">Không có bài hát nào đang phát</p>
                <p className="text-xs text-zinc-500 mt-1">Dán link nhạc vào ô tìm kiếm ở trên để bắt đầu nghe</p>
              </div>
            )}
          </div>

          {/* Player Controls Bar */}
          <div className="mt-6 pt-5 border-t border-[#2B2D31] space-y-4">
            <div className="flex items-center justify-center gap-3">
              {/* Shuffle button */}
              <button
                type="button"
                onClick={() => sendControl('shuffle')}
                disabled={!state.active || state.queue.length <= 1}
                title="Xáo trộn hàng đợi"
                className="p-2.5 rounded-xl bg-[#1E1F22] hover:bg-[#2B2D31] text-zinc-300 disabled:opacity-40 transition border border-[#2B2D31]"
              >
                <Shuffle className="w-4 h-4" />
              </button>

              {/* Play / Pause toggle */}
              <button
                type="button"
                onClick={() => sendControl(state.isPaused ? 'resume' : 'pause')}
                disabled={!state.active || !state.currentSong}
                className="w-12 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-40 text-white flex items-center justify-center transition shadow-lg shadow-emerald-600/30"
              >
                {state.isPaused ? (
                  <Play className="w-5 h-5 fill-white ml-0.5" />
                ) : (
                  <Pause className="w-5 h-5 fill-white" />
                )}
              </button>

              {/* Skip button */}
              <button
                type="button"
                onClick={() => sendControl('skip')}
                disabled={!state.active || !state.currentSong}
                title="Bỏ qua bài hiện tại"
                className="p-2.5 rounded-xl bg-[#1E1F22] hover:bg-[#2B2D31] text-zinc-300 disabled:opacity-40 transition border border-[#2B2D31]"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              {/* Loop Mode toggle */}
              <button
                type="button"
                onClick={() => {
                  const nextMode =
                    state.loopMode === 'off' ? 'track' : state.loopMode === 'track' ? 'queue' : 'off';
                  sendControl('loop', nextMode);
                }}
                disabled={!state.active}
                title={`Chế độ lặp: ${state.loopMode}`}
                className={`p-2.5 rounded-xl transition border border-[#2B2D31] ${
                  state.loopMode !== 'off'
                    ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40'
                    : 'bg-[#1E1F22] hover:bg-[#2B2D31] text-zinc-400'
                }`}
              >
                {state.loopMode === 'track' ? (
                  <Repeat1 className="w-4 h-4" />
                ) : (
                  <Repeat className="w-4 h-4" />
                )}
              </button>

              {/* Stop & Leave */}
              <button
                type="button"
                onClick={() => sendControl('stop')}
                disabled={!state.active}
                title="Dừng nhạc và rời phòng"
                className="p-2.5 rounded-xl bg-[#DA373C]/10 hover:bg-[#DA373C]/20 text-[#DA373C] border border-[#DA373C]/30 disabled:opacity-40 transition"
              >
                <Square className="w-4 h-4" />
              </button>
            </div>

            {/* Volume Slider */}
            <div className="flex items-center gap-3 px-2">
              <button
                type="button"
                onClick={() => sendControl('volume', state.volume === 0 ? 100 : 0)}
                className="text-zinc-400 hover:text-white"
              >
                {state.volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : state.volume < 50 ? (
                  <Volume1 className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min="1"
                max="150"
                value={state.volume}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setState((prev) => ({ ...prev, volume: v }));
                }}
                onMouseUp={(e) => sendControl('volume', (e.target as HTMLInputElement).value)}
                onTouchEnd={(e) => sendControl('volume', (e.target as HTMLInputElement).value)}
                className="flex-1 accent-emerald-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
              />
              <span className="text-xs font-mono text-zinc-400 w-12 text-right">
                {state.volume}%
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Live Queue (5 cols) */}
        <div className="lg:col-span-5 bg-[#111214] rounded-xl border border-[#2B2D31] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Hàng Đợi ({state.queue.length} bài)
              </h3>
              {state.loopMode !== 'off' && (
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  {state.loopMode === 'track' ? '🔂 Lặp bài' : '🔁 Lặp hàng đợi'}
                </span>
              )}
            </div>

            {state.queue.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs">
                <p>Hàng đợi đang trống.</p>
                <p className="mt-1 text-zinc-600">Bài hát tiếp theo sẽ xuất hiện ở đây khi bạn thêm vào.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {state.queue.map((song, idx) => (
                  <div
                    key={`${song.id}-${idx}`}
                    className="p-2.5 rounded-lg bg-[#1E1F22] border border-[#2B2D31] flex items-center justify-between gap-3 group hover:border-zinc-700 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs font-mono font-bold text-zinc-500 w-4 text-center">
                        {idx + 1}
                      </span>
                      {song.thumbnail && (
                        <img
                          src={song.thumbnail}
                          alt=""
                          className="w-8 h-8 rounded object-cover flex-shrink-0 bg-zinc-800"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs text-zinc-200 font-semibold truncate leading-tight">
                          {song.title}
                        </p>
                        <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                          {song.duration} • {song.requestedBy}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => sendControl('remove', idx)}
                      title="Xóa bài này khỏi hàng đợi"
                      className="opacity-60 group-hover:opacity-100 hover:text-red-400 p-1 text-zinc-500 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick SoundCloud Token Recovery */}
          <div className="mt-4 pt-3 border-t border-[#2B2D31] flex items-center justify-between text-xs text-zinc-400">
            <span className="truncate max-w-[170px]" title={state.soundcloudId}>
              🔑 SoundCloud Key: <span className="font-mono text-zinc-300">{state.soundcloudId?.slice(0, 6)}•••</span>
            </span>
            <button
              type="button"
              onClick={handleRefreshSoundCloud}
              disabled={refreshingScId}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium transition"
            >
              <RefreshCw className={`w-3 h-3 ${refreshingScId ? 'animate-spin' : ''}`} />
              <span>Tự đổi key mới</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default MusicDashboard;
