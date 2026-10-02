import fs from 'fs';
import path from 'path';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  AudioPlayer,
  VoiceConnection,
  entersState,
  getVoiceConnection,
  StreamType,
} from '@discordjs/voice';
import {
  Message,
  EmbedBuilder,
  PermissionsBitField,
  TextBasedChannel,
  ChatInputCommandInteraction,
  VoiceBasedChannel,
} from 'discord.js';
import play from 'play-dl';
import ffmpegPath from 'ffmpeg-static';

// Configure FFMPEG path
if (ffmpegPath) {
  process.env.FFMPEG_PATH = ffmpegPath;
}

const MUSIC_CONFIG_FILE = path.join(process.cwd(), 'music_config.json');

interface MusicConfig {
  soundcloudClientId?: string;
  fruitStock?: string;
}

function loadMusicConfig(): MusicConfig {
  try {
    if (fs.existsSync(MUSIC_CONFIG_FILE)) {
      const raw = fs.readFileSync(MUSIC_CONFIG_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error loading music config:', e);
  }
  return {};
}

function saveMusicConfig(cfg: MusicConfig) {
  try {
    fs.writeFileSync(MUSIC_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving music config:', e);
  }
}

/**
 * Gets the current active SoundCloud Client ID
 */
export function getSoundCloudClientId(): string {
  const cfg = loadMusicConfig();
  if (cfg.soundcloudClientId && cfg.soundcloudClientId.trim()) {
    return cfg.soundcloudClientId.trim();
  }
  if (process.env.SOUNDCLOUD_CLIENT_ID && process.env.SOUNDCLOUD_CLIENT_ID.trim()) {
    return process.env.SOUNDCLOUD_CLIENT_ID.trim();
  }
  return 'dkevB9EsY4jIoSm8RfddPNUKyn6hurXF';
}

/**
 * Validates a SoundCloud Client ID by querying the api-v2 endpoint
 */
export async function validateSoundCloudId(id: string): Promise<{ valid: boolean; status: number; latencyMs: number }> {
  const startTime = Date.now();
  try {
    const res = await fetch(`https://api-v2.soundcloud.com/search?client_id=${encodeURIComponent(id.trim())}&q=test&limit=1`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });
    const latencyMs = Date.now() - startTime;
    return {
      valid: res.status === 200,
      status: res.status,
      latencyMs,
    };
  } catch {
    return {
      valid: false,
      status: 0,
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * Sets and persists a new SoundCloud Client ID
 */
export async function setSoundCloudClientId(newId: string): Promise<{ success: boolean; status: number; latencyMs: number }> {
  const cleanId = newId.trim();
  const testRes = await validateSoundCloudId(cleanId);
  const cfg = loadMusicConfig();
  cfg.soundcloudClientId = cleanId;
  saveMusicConfig(cfg);

  try {
    await play.setToken({ soundcloud: { client_id: cleanId } });
  } catch {}

  return {
    success: testRes.valid,
    status: testRes.status,
    latencyMs: testRes.latencyMs,
  };
}

/**
 * Automatically fetches and sets a fresh SoundCloud client ID
 */
export async function refreshSoundCloudIdAuto(): Promise<{ success: boolean; clientId: string; latencyMs: number }> {
  try {
    const freeId = await play.getFreeClientID();
    if (freeId && freeId.trim()) {
      const res = await setSoundCloudClientId(freeId.trim());
      return { success: res.success, clientId: freeId.trim(), latencyMs: res.latencyMs };
    }
  } catch (err) {
    console.warn('Could not auto-fetch free SoundCloud Client ID:', err);
  }
  const curr = getSoundCloudClientId();
  const res = await validateSoundCloudId(curr);
  return { success: res.valid, clientId: curr, latencyMs: res.latencyMs };
}

/**
 * Initializes SoundCloud token for play-dl
 */
export async function initSoundCloud() {
  const activeId = getSoundCloudClientId();
  try {
    await play.setToken({ soundcloud: { client_id: activeId } });
  } catch {}
}
initSoundCloud();

/**
 * Fetches current Blox Fruits stock from Parse.bot
 */
async function fetchBloxFruitsStock(): Promise<string> {
  const apiKey = process.env.PARSE_BOT_API_KEY;
  if (!apiKey) {
    return 'Chưa cấu hình API Key cho Parse.bot.';
  }

  try {
    const res = await fetch(`https://api.parse.bot/v1/blox-fruits/stock?key=${apiKey}`);
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const data: any = await res.json();
    
    if (data.stock && data.stock.length > 0) {
      return data.stock.map((item: any) => `${item.name} (${item.price_beli} Beli)`).join(', ');
    }
    return 'Không có thông tin stock.';
  } catch (err: any) {
    console.error('Error fetching stock:', err);
    return 'Lỗi khi lấy dữ liệu từ API.';
  }
}

export type MusicPlatform = 'youtube' | 'spotify' | 'soundcloud' | 'direct' | 'search';

export interface Song {
  id: string;
  title: string;
  artist?: string;
  url: string;
  duration: string;
  thumbnail?: string;
  requestedBy: string;
  platform: MusicPlatform;
  directUrl?: string;
  scTrack?: any;
}

export interface GuildQueue {
  guildId: string;
  guildName: string;
  voiceChannelId: string;
  voiceChannelName: string;
  textChannelId: string;
  connection: VoiceConnection;
  player: AudioPlayer;
  songs: Song[];
  isPlaying: boolean;
  isPaused: boolean;
  volume: number; // 0.01 to 1.5 (default: 1.0)
  loopMode: 'off' | 'track' | 'queue';
}

export const musicQueues = new Map<string, GuildQueue>();

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function normalizeText(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Detect the platform from a string or URL
 */
export function detectPlatform(input: string): MusicPlatform {
  const clean = input.trim();
  if (
    clean.includes('spotify.com/track') ||
    clean.includes('spotify.com/album') ||
    clean.includes('spotify.com/playlist')
  ) {
    return 'spotify';
  }
  if (
    clean.includes('youtube.com/watch') ||
    clean.includes('youtu.be/') ||
    clean.includes('youtube.com/shorts') ||
    clean.includes('music.youtube.com')
  ) {
    return 'youtube';
  }
  if (clean.includes('soundcloud.com/')) {
    return 'soundcloud';
  }
  if (
    clean.match(/^https?:\/\/.*\.(mp3|ogg|wav|aac|m4a|flac)(\?.*)?$/i) ||
    clean.match(/^https?:\/\/.*\/stream/i)
  ) {
    return 'direct';
  }
  return 'search';
}

export interface ResolveResult {
  songs: Song[];
  platform: MusicPlatform;
  sourceTitle?: string;
  error?: string;
}

/**
 * Resolves metadata from Spotify URLs
 */
async function resolveSpotifyTrack(url: string): Promise<{ title: string; artist: string; thumbnail?: string } | null> {
  try {
    let title = '';
    let thumbnail = '';
    const oembedRes = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
    if (oembedRes.ok) {
      const data: any = await oembedRes.json();
      title = data.title || '';
      thumbnail = data.thumbnail_url || '';
    }

    let artist = '';
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });
    if (pageRes.ok) {
      const html = await pageRes.text();
      const metaDesc = html.match(/<meta property="og:description" content="([^"]+)"/);
      if (metaDesc?.[1]) {
        artist = metaDesc[1].split('·')[0]?.trim() || '';
      }
      if (!title) {
        const metaTitle = html.match(/<meta property="og:title" content="([^"]+)"/);
        title = metaTitle?.[1] || '';
      }
    }

    if (title) {
      return { title, artist, thumbnail };
    }
  } catch (err) {
    console.error('Spotify resolver error:', err);
  }
  return null;
}

/**
 * Resolves metadata from YouTube URLs
 */
async function resolveYouTubeVideo(url: string): Promise<{ title: string; author: string; thumbnail?: string } | null> {
  try {
    const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (oembedRes.ok) {
      const data: any = await oembedRes.json();
      return {
        title: data.title || '',
        author: data.author_name || '',
        thumbnail: data.thumbnail_url || '',
      };
    }
  } catch (err) {
    console.error('YouTube oembed error:', err);
  }
  return null;
}

/**
 * Finds high-quality playable audio stream for a track query or SoundCloud track
 */
async function searchPlayableTrack(query: string): Promise<{ scTrack: any; title: string; url: string; duration: string; thumbnail?: string } | null> {
  await initSoundCloud();

  let scResults: any[] = [];
  try {
    scResults = await play.search(query, {
      source: { soundcloud: 'tracks' },
      limit: 8,
    });
  } catch (err: any) {
    console.warn('SoundCloud search initial error, attempting token refresh:', err?.message);
    const refreshed = await refreshSoundCloudIdAuto();
    if (refreshed.success) {
      scResults = await play.search(query, {
        source: { soundcloud: 'tracks' },
        limit: 8,
      }).catch(() => []);
    }
  }

  if (scResults && scResults.length > 0) {
    const normQuery = normalizeText(query);
    const queryWords = normQuery.split(/\s+/).filter(Boolean);

    const scored = scResults.map((track) => {
      const normTitle = normalizeText(track.name);
      let score = 0;
      if (normTitle === normQuery) score += 50;
      else if (normTitle.includes(normQuery)) score += 20;

      queryWords.forEach((word) => {
        if (normTitle.includes(word)) score += 4;
      });

      if (normTitle.includes('remix') && !normQuery.includes('remix')) score -= 2;
      if (normTitle.includes('karaoke') && !normQuery.includes('karaoke')) score -= 5;

      return { track, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0].track;

    return {
      scTrack: best,
      title: best.name || query,
      url: best.url,
      duration: formatDuration(best.durationInSec || 0),
      thumbnail: best.thumbnail,
    };
  }

  return null;
}

/**
 * Universal Song Resolver:
 * Accepts YouTube, Spotify, SoundCloud, Direct MP3, or Search Query
 */
export async function resolveSongs(query: string, requestedBy: string): Promise<ResolveResult> {
  const platform = detectPlatform(query);

  // 1. Direct Audio Link (.mp3, .ogg, .wav, audio stream)
  if (platform === 'direct') {
    const cleanUrl = query.trim();
    const fileName = cleanUrl.split('/').pop()?.split('?')[0] || 'Direct Audio Stream';
    return {
      platform: 'direct',
      songs: [
        {
          id: Math.random().toString(36).substring(2, 9),
          title: decodeURIComponent(fileName),
          url: cleanUrl,
          directUrl: cleanUrl,
          duration: 'Live / Audio',
          thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
          requestedBy,
          platform: 'direct',
        },
      ],
    };
  }

  // 2. Spotify Track or Album / Playlist
  if (platform === 'spotify') {
    const cleanUrl = query.trim();
    const spInfo = await resolveSpotifyTrack(cleanUrl);
    if (!spInfo) {
      return { platform: 'spotify', songs: [], error: 'Không thể đọc thông tin từ liên kết Spotify này.' };
    }

    const searchTerm = spInfo.artist ? `${spInfo.artist} - ${spInfo.title}` : spInfo.title;
    const playable = await searchPlayableTrack(searchTerm);

    if (!playable) {
      return { platform: 'spotify', songs: [], error: `Không tìm thấy bản phát âm thanh cho bài Spotify: "${spInfo.title}"` };
    }

    return {
      platform: 'spotify',
      sourceTitle: spInfo.title,
      songs: [
        {
          id: Math.random().toString(36).substring(2, 9),
          title: spInfo.title,
          artist: spInfo.artist,
          url: cleanUrl,
          duration: playable.duration,
          thumbnail: spInfo.thumbnail || playable.thumbnail,
          requestedBy,
          platform: 'spotify',
          scTrack: playable.scTrack,
        },
      ],
    };
  }

  // 3. YouTube (Video URL, Shorts, YouTube Music)
  if (platform === 'youtube') {
    const cleanUrl = query.trim();
    const ytInfo = await resolveYouTubeVideo(cleanUrl);
    const searchKeyword = ytInfo ? `${ytInfo.title} ${ytInfo.author}` : cleanUrl;
    const playable = await searchPlayableTrack(searchKeyword);

    const songTitle = ytInfo?.title || playable?.title || 'YouTube Audio';
    const thumbnail = ytInfo?.thumbnail || playable?.thumbnail;
    const duration = playable?.duration || 'YouTube';

    if (!playable) {
      return { platform: 'youtube', songs: [], error: `Không thể tạo luồng phát cho bài hát YouTube: "${songTitle}"` };
    }

    return {
      platform: 'youtube',
      sourceTitle: songTitle,
      songs: [
        {
          id: Math.random().toString(36).substring(2, 9),
          title: songTitle,
          artist: ytInfo?.author,
          url: cleanUrl,
          duration,
          thumbnail,
          requestedBy,
          platform: 'youtube',
          scTrack: playable.scTrack,
        },
      ],
    };
  }

  // 4. SoundCloud Direct Link or Search Query
  const cleanSearch = query.trim();
  const playable = await searchPlayableTrack(cleanSearch);

  if (!playable) {
    return { platform: 'soundcloud', songs: [], error: `Không tìm thấy bài hát nào cho từ khóa: "${cleanSearch}"` };
  }

  return {
    platform: platform === 'soundcloud' ? 'soundcloud' : 'search',
    songs: [
      {
        id: Math.random().toString(36).substring(2, 9),
        title: playable.title,
        url: playable.url,
        duration: playable.duration,
        thumbnail: playable.thumbnail,
        requestedBy,
        platform: platform === 'soundcloud' ? 'soundcloud' : 'search',
        scTrack: playable.scTrack,
      },
    ],
  };
}

/**
 * Creates an audio stream resource from Song
 */
async function createSongResource(song: Song, volume: number): Promise<any> {
  // Direct Audio URL
  if (song.directUrl) {
    return createAudioResource(song.directUrl, {
      inputType: StreamType.Arbitrary,
      inlineVolume: true,
    });
  }

  // SoundCloud track stream
  await initSoundCloud();
  let streamObj: any;

  try {
    if (song.scTrack) {
      streamObj = await play.stream_from_info(song.scTrack);
    } else {
      streamObj = await play.stream(song.url);
    }
  } catch (streamErr: any) {
    console.warn('Initial stream error, refreshing client ID:', streamErr?.message);
    await refreshSoundCloudIdAuto();
    if (song.scTrack) {
      streamObj = await play.stream_from_info(song.scTrack);
    } else {
      const fallbackSearch = await searchPlayableTrack(song.title);
      if (fallbackSearch) {
        streamObj = await play.stream_from_info(fallbackSearch.scTrack);
      }
    }
  }

  if (!streamObj || !streamObj.stream) {
    throw new Error('Không thể khởi tạo luồng âm thanh.');
  }

  streamObj.stream.on('error', (err: any) => {
    console.error('Audio stream pipe error:', err);
  });

  const resource = createAudioResource(streamObj.stream, {
    inputType: streamObj.type,
    inlineVolume: true,
  });

  if (resource.volume) {
    resource.volume.setVolume(volume);
  }

  return resource;
}

/**
 * Plays the next song in the guild queue
 */
export async function playNextSong(guildId: string, client: any) {
  const queue = musicQueues.get(guildId);
  if (!queue) return;

  if (queue.songs.length === 0) {
    queue.isPlaying = false;
    queue.isPaused = false;
    const textChannel = client.channels.cache.get(queue.textChannelId) as TextBasedChannel | undefined;
    if (textChannel && 'send' in textChannel) {
      textChannel.send('⏹️ Đã phát hết danh sách bài hát trong hàng đợi. Gõ `.play <tên bài>` để phát tiếp!').catch(() => {});
    }
    return;
  }

  const song = queue.songs[0];

  try {
    const resource = await createSongResource(song, queue.volume);
    queue.player.play(resource);
    queue.isPlaying = true;
    queue.isPaused = false;

    const textChannel = client.channels.cache.get(queue.textChannelId) as TextBasedChannel | undefined;
    if (textChannel && 'send' in textChannel) {
      const platformIcon =
        song.platform === 'spotify'
          ? '🟢 Spotify'
          : song.platform === 'youtube'
          ? '🔴 YouTube'
          : song.platform === 'direct'
          ? '🌐 Direct Audio'
          : '🟠 SoundCloud';

      const embed = new EmbedBuilder()
        .setTitle('🎶 Đang Phát Nhạc')
        .setDescription(`[**${song.title}**](${song.url})`)
        .setColor(song.platform === 'spotify' ? '#1DB954' : song.platform === 'youtube' ? '#FF0000' : '#23A559')
        .addFields(
          { name: '📡 Nguồn phát', value: platformIcon, inline: true },
          { name: '⏱️ Thời lượng', value: song.duration || 'N/A', inline: true },
          { name: '👤 Yêu cầu bởi', value: song.requestedBy, inline: true },
          { name: '🔊 Âm lượng', value: `${Math.round(queue.volume * 100)}%`, inline: true },
          { name: '🔁 Chế độ lặp', value: queue.loopMode === 'track' ? '🔂 Lặp 1 bài' : queue.loopMode === 'queue' ? '🔁 Lặp danh sách' : 'Tắt', inline: true }
        )
        .setFooter({ text: 'SentinelBot Music • .skip đổi bài | .loop bật lặp | .stop dừng' });

      if (song.thumbnail) {
        embed.setThumbnail(song.thumbnail);
      }

      textChannel.send({ embeds: [embed] }).catch(() => {});
    }
  } catch (error: any) {
    console.error('Error playing track:', error);
    const textChannel = client.channels.cache.get(queue.textChannelId) as TextBasedChannel | undefined;
    if (textChannel && 'send' in textChannel) {
      textChannel.send(`⚠️ Không thể phát: **${song.title}** (${error.message || 'Lỗi stream'}). Đang chuyển bài tiếp...`).catch(() => {});
    }
    queue.songs.shift();
    playNextSong(guildId, client);
  }
}

/**
 * Connects to voice and starts playing or adds to queue
 */
export async function executePlay(
  guild: any,
  voiceChannel: VoiceBasedChannel,
  textChannelId: string,
  query: string,
  requestedBy: string,
  client: any
): Promise<{ success: boolean; message: string; song?: Song; queueLength?: number }> {
  const permissions = voiceChannel.permissionsFor(guild.members.me!);
  if (!permissions?.has(PermissionsBitField.Flags.Connect) || !permissions.has(PermissionsBitField.Flags.Speak)) {
    return {
      success: false,
      message: 'Bot không có quyền Kết nối (Connect) hoặc Nói (Speak) trong kênh thoại này!',
    };
  }

  const resolveRes = await resolveSongs(query, requestedBy);
  if (resolveRes.error || resolveRes.songs.length === 0) {
    return {
      success: false,
      message: resolveRes.error || `Không tìm thấy bài hát nào cho từ khóa: \`${query}\``,
    };
  }

  const newSong = resolveRes.songs[0];

  let queue = musicQueues.get(guild.id);
  let connection = getVoiceConnection(guild.id);

  if (!connection || connection.state.status === VoiceConnectionStatus.Destroyed) {
    connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator as any,
    });
  }

  if (!queue) {
    const player = createAudioPlayer();
    connection.subscribe(player);

    queue = {
      guildId: guild.id,
      guildName: guild.name,
      voiceChannelId: voiceChannel.id,
      voiceChannelName: voiceChannel.name,
      textChannelId,
      connection,
      player,
      songs: [],
      isPlaying: false,
      isPaused: false,
      volume: 1,
      loopMode: 'off',
    };

    musicQueues.set(guild.id, queue);

    player.on(AudioPlayerStatus.Idle, () => {
      const q = musicQueues.get(guild.id);
      if (!q || q.songs.length === 0) return;

      if (q.loopMode === 'track') {
        playNextSong(guild.id, client);
      } else if (q.loopMode === 'queue') {
        const finished = q.songs.shift();
        if (finished) q.songs.push(finished);
        playNextSong(guild.id, client);
      } else {
        q.songs.shift();
        if (q.songs.length > 0) {
          playNextSong(guild.id, client);
        } else {
          q.isPlaying = false;
        }
      }
    });

    player.on('error', (err) => {
      console.error('Music Player Error:', err);
      const q = musicQueues.get(guild.id);
      if (q && q.songs.length > 0) {
        q.songs.shift();
        playNextSong(guild.id, client);
      }
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection!, VoiceConnectionStatus.Signalling, 4_000),
          entersState(connection!, VoiceConnectionStatus.Connecting, 4_000),
        ]);
      } catch {
        try {
          connection!.destroy();
        } catch {}
        musicQueues.delete(guild.id);
      }
    });
  } else {
    queue.connection = connection;
    queue.connection.subscribe(queue.player);
    queue.voiceChannelId = voiceChannel.id;
    queue.voiceChannelName = voiceChannel.name;
    queue.textChannelId = textChannelId;
  }

  queue.songs.push(newSong);

  if (!queue.isPlaying) {
    playNextSong(guild.id, client);
    return {
      success: true,
      message: `🎶 Đang bắt đầu phát: **${newSong.title}**`,
      song: newSong,
      queueLength: queue.songs.length,
    };
  } else {
    return {
      success: true,
      message: `➕ Đã thêm vào hàng đợi: **${newSong.title}** (#${queue.songs.length})`,
      song: newSong,
      queueLength: queue.songs.length,
    };
  }
}

/**
 * Handles prefix music commands
 */
export async function handleMusicCommand(
  command: string,
  args: string[],
  message: Message,
  client: any
) {
  if (!message.guild) return;
  const memberVoiceChannel = message.member?.voice.channel;

  switch (command) {
    case 'setscid':
    case 'scid': {
      if (
        message.author.id !== '1542028462154317907' &&
        !message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild) &&
        !message.member?.permissions.has(PermissionsBitField.Flags.Administrator)
      ) {
        await message.reply('❌ Bạn cần quyền **Quản lý Server** hoặc **Quản trị viên** để cập nhật Client ID!');
        return;
      }
      const newId = args[0]?.trim();
      if (!newId) {
        await message.reply('❌ Vui lòng nhập Client ID mới. Cú pháp: `.setscid <client_id>`');
        return;
      }
      const checkingMsg = await message.reply('🔄 Đang kiểm tra Client ID với SoundCloud API...');
      const res = await setSoundCloudClientId(newId);
      if (res.success) {
        await checkingMsg.edit(`✅ **Đã cập nhật SoundCloud Client ID thành công!**\n• Trạng thái API: \`200 OK\` (${res.latencyMs}ms)\n• Giờ bạn có thể dùng lệnh \`.play\` để nghe nhạc bình thường.`);
      } else {
        await checkingMsg.edit(`⚠️ **Client ID đã được lưu nhưng SoundCloud phản hồi HTTP ${res.status || 'Error'}:**\n• ID này có thể đã hết hạn.`);
      }
      break;
    }

    case 'scstatus': {
      const currentId = getSoundCloudClientId();
      const checkingMsg = await message.reply('🔄 Đang kiểm tra kết nối tới SoundCloud API...');
      const res = await validateSoundCloudId(currentId);
      const maskedId = currentId.length > 8 ? `${currentId.slice(0, 4)}••••••••${currentId.slice(-4)}` : currentId;

      const embed = new EmbedBuilder()
        .setTitle('📻 Trạng Thái Kết Nối SoundCloud API')
        .setColor(res.valid ? '#23A559' : '#ED4245')
        .addFields(
          { name: '🔑 Client ID Hiện Tại', value: `\`${maskedId}\``, inline: true },
          { name: '📡 Trạng thái HTTP', value: res.valid ? `\`200 OK\` ✅` : `\`${res.status || '401 Unauthorized'}\` ❌`, inline: true },
          { name: '⏱️ Độ trễ (Ping)', value: `\`${res.latencyMs}ms\``, inline: true },
          { name: '💡 Tình trạng', value: res.valid ? 'Hoạt động bình thường. Đã sẵn sàng phát nhạc!' : 'Client ID hết hạn hoặc bị chặn. Bot sẽ tự động làm mới hoặc bạn dùng `.setscid`.' }
        )
        .setFooter({ text: 'Dùng /setscid hoặc .setscid <id> để thay đổi' });

      await checkingMsg.edit({ content: '', embeds: [embed] });
      break;
    }

    case 'play':
    case 'p': {
      if (!memberVoiceChannel) {
        await message.reply('❌ Bạn cần phải tham gia vào một kênh thoại (Voice Channel) trước!');
        return;
      }

      const query = args.join(' ').trim();
      if (!query) {
        await message.reply('❌ Vui lòng nhập tên bài hát hoặc link YouTube / Spotify / SoundCloud. Ví dụ: `.play novocaine`');
        return;
      }

      const searchingMsg = await message.reply(`🔍 Đang xử lý bài hát: \`${query}\`...`);
      const res = await executePlay(
        message.guild,
        memberVoiceChannel,
        message.channel.id,
        query,
        message.author.tag,
        client
      );

      if (!res.success) {
        await searchingMsg.edit(`❌ ${res.message}`);
        return;
      }

      if (res.song) {
        const platformBadge =
          res.song.platform === 'spotify'
            ? '🟢 Spotify'
            : res.song.platform === 'youtube'
            ? '🔴 YouTube'
            : res.song.platform === 'direct'
            ? '🌐 Direct Audio'
            : '🟠 SoundCloud';

        const embed = new EmbedBuilder()
          .setTitle(res.queueLength === 1 ? '🎶 Bắt Đầu Phát Nhạc' : '➕ Đã Thêm Vào Hàng Đợi')
          .setDescription(`[**${res.song.title}**](${res.song.url})`)
          .setColor(res.song.platform === 'spotify' ? '#1DB954' : res.song.platform === 'youtube' ? '#FF0000' : '#23A559')
          .addFields(
            { name: '📡 Nguồn phát', value: platformBadge, inline: true },
            { name: '⏱️ Thời lượng', value: res.song.duration, inline: true },
            { name: '🔢 Vị trí', value: `#${res.queueLength}`, inline: true },
            { name: '👤 Yêu cầu bởi', value: res.song.requestedBy, inline: true }
          );

        if (res.song.thumbnail) {
          embed.setThumbnail(res.song.thumbnail);
        }

        await searchingMsg.edit({ content: '', embeds: [embed] });
      }
      break;
    }

    case 'pause': {
      const queue = musicQueues.get(message.guild.id);
      if (!queue || !queue.isPlaying) {
        await message.reply('❌ Không có bài hát nào đang phát để tạm dừng!');
        return;
      }
      queue.player.pause();
      queue.isPaused = true;
      await message.reply('⏸️ Đã tạm dừng phát nhạc. Dùng `.resume` để tiếp tục.');
      break;
    }

    case 'resume': {
      const queue = musicQueues.get(message.guild.id);
      if (!queue) {
        await message.reply('❌ Không có bài hát nào đang bị tạm dừng!');
        return;
      }
      queue.player.unpause();
      queue.isPaused = false;
      await message.reply('▶️ Đã tiếp tục phát nhạc.');
      break;
    }

    case 'skip':
    case 's': {
      const queue = musicQueues.get(message.guild.id);
      if (!queue || !queue.isPlaying) {
        await message.reply('❌ Không có bài hát nào đang phát để chuyển bài!');
        return;
      }
      const skippedSong = queue.songs[0]?.title || 'bài hiện tại';
      queue.player.stop();
      await message.reply(`⏭️ Đã bỏ qua: **${skippedSong}**`);
      break;
    }

    case 'stop':
    case 'leave': {
      const queue = musicQueues.get(message.guild.id);
      const connection = getVoiceConnection(message.guild.id);

      if (!queue && !connection) {
        await message.reply('❌ Bot hiện không có trong phòng thoại nào!');
        return;
      }

      if (queue) {
        queue.songs = [];
        try {
          queue.player.stop(true);
        } catch {}
      }

      if (connection) {
        try {
          connection.destroy();
        } catch {}
      }

      musicQueues.delete(message.guild.id);
      await message.reply('👋 Đã dừng nhạc, xóa toàn bộ hàng đợi và rời khỏi phòng thoại.');
      break;
    }

    case 'volume':
    case 'vol': {
      const queue = musicQueues.get(message.guild.id);
      if (!queue) {
        await message.reply('❌ Bot hiện không phát nhạc trong phòng thoại!');
        return;
      }
      const volArg = parseInt(args[0]);
      if (isNaN(volArg) || volArg < 1 || volArg > 150) {
        await message.reply(`🔊 Âm lượng hiện tại: **${Math.round(queue.volume * 100)}%**. Để chỉnh: \`.volume 1-150\``);
        return;
      }
      queue.volume = volArg / 100;
      await message.reply(`🔊 Đã chỉnh âm lượng thành **${volArg}%**.`);
      break;
    }

    case 'loop': {
      const queue = musicQueues.get(message.guild.id);
      if (!queue) {
        await message.reply('❌ Hiện không có phòng thoại đang phát nhạc!');
        return;
      }

      const mode = args[0]?.toLowerCase();
      if (mode === 'track' || mode === 'song' || mode === '1') {
        queue.loopMode = 'track';
        await message.reply('🔂 Đã bật lặp: **1 bài hát hiện tại**.');
      } else if (mode === 'queue' || mode === 'all') {
        queue.loopMode = 'queue';
        await message.reply('🔁 Đã bật lặp: **Toàn bộ hàng đợi**.');
      } else if (mode === 'off' || mode === 'stop') {
        queue.loopMode = 'off';
        await message.reply('➡️ Đã tắt chế độ lặp.');
      } else {
        // Toggle loop mode
        if (queue.loopMode === 'off') {
          queue.loopMode = 'track';
          await message.reply('🔂 Đã chuyển chế độ lặp: **Lặp 1 bài** (Gõ `.loop queue` để lặp cả danh sách, `.loop off` để tắt).');
        } else if (queue.loopMode === 'track') {
          queue.loopMode = 'queue';
          await message.reply('🔁 Đã chuyển chế độ lặp: **Lặp toàn bộ hàng đợi**.');
        } else {
          queue.loopMode = 'off';
          await message.reply('➡️ Đã tắt chế độ lặp.');
        }
      }
      break;
    }

    case 'shuffle': {
      const queue = musicQueues.get(message.guild.id);
      if (!queue || queue.songs.length <= 1) {
        await message.reply('❌ Không có đủ bài hát trong hàng đợi để xáo trộn!');
        return;
      }

      const current = queue.songs[0];
      const upcoming = queue.songs.slice(1);
      for (let i = upcoming.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [upcoming[i], upcoming[j]] = [upcoming[j], upcoming[i]];
      }
      queue.songs = [current, ...upcoming];
      await message.reply(`🔀 Đã xáo trộn ngẫu nhiên **${upcoming.length}** bài hát tiếp theo trong hàng đợi!`);
      break;
    }

    case 'queue':
    case 'q': {
      const queue = musicQueues.get(message.guild.id);
      if (!queue || queue.songs.length === 0) {
        await message.reply('📭 Hàng đợi hiện đang trống! Dùng `.play <tên bài>` để thêm bài hát.');
        return;
      }

      const current = queue.songs[0];
      const upcoming = queue.songs.slice(1, 11);

      const listText =
        upcoming.length > 0
          ? upcoming
              .map((s, idx) => `\`${idx + 1}.\` [${s.title}](${s.url}) | \`${s.duration}\` (bởi ${s.requestedBy})`)
              .join('\n')
          : '_Không có bài hát tiếp theo trong hàng đợi._';

      const embed = new EmbedBuilder()
        .setTitle(`📜 Hàng Đợi Nhạc - ${message.guild.name}`)
        .setColor('#5865F2')
        .addFields(
          { name: '🎶 Đang phát', value: `[**${current.title}**](${current.url}) | \`${current.duration}\` (${current.requestedBy})` },
          { name: `📑 Tiếp theo (${queue.songs.length - 1} bài)`, value: listText },
          { name: '⚙️ Cài đặt', value: `🔊 Âm lượng: ${Math.round(queue.volume * 100)}% | 🔁 Lặp: ${queue.loopMode}` }
        )
        .setFooter({ text: `Tổng cộng ${queue.songs.length} bài hát | SentinelBot Multi-Music` });

      await message.reply({ embeds: [embed] });
      break;
    }

    case 'nowplaying':
    case 'np': {
      const queue = musicQueues.get(message.guild.id);
      if (!queue || !queue.isPlaying || queue.songs.length === 0) {
        await message.reply('❌ Hiện tại không có bài hát nào đang phát!');
        return;
      }

      const current = queue.songs[0];
      const platformIcon =
        current.platform === 'spotify'
          ? '🟢 Spotify'
          : current.platform === 'youtube'
          ? '🔴 YouTube'
          : current.platform === 'direct'
          ? '🌐 Direct Audio'
          : '🟠 SoundCloud';

      const embed = new EmbedBuilder()
        .setTitle('🎶 Bài Hát Đang Phát')
        .setDescription(`[**${current.title}**](${current.url})`)
        .setColor(current.platform === 'spotify' ? '#1DB954' : current.platform === 'youtube' ? '#FF0000' : '#23A559')
        .addFields(
          { name: '📡 Nguồn phát', value: platformIcon, inline: true },
          { name: '⏱️ Thời lượng', value: current.duration, inline: true },
          { name: '👤 Yêu cầu bởi', value: current.requestedBy, inline: true },
          { name: '📑 Còn lại trong hàng đợi', value: `${queue.songs.length - 1} bài`, inline: true },
          { name: '🔊 Âm lượng', value: `${Math.round(queue.volume * 100)}%`, inline: true },
          { name: '🔁 Chế độ lặp', value: queue.loopMode, inline: true }
        );

      if (current.thumbnail) {
        embed.setThumbnail(current.thumbnail);
      }

      await message.reply({ embeds: [embed] });
      break;
    }

    case 'setstock': {
      if (
        message.author.id !== '1542028462154317907' &&
        !message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild) &&
        !message.member?.permissions.has(PermissionsBitField.Flags.Administrator)
      ) {
        await message.reply('❌ Bạn cần quyền **Quản lý Server** hoặc **Quản trị viên** để cập nhật Stock!');
        return;
      }
      const stockData = args.join(' ');
      if (!stockData) {
        await message.reply('❌ Vui lòng nhập thông tin stock. Cú pháp: `.setstock <tên_trái> - <giá>`');
        return;
      }
      const cfg = loadMusicConfig();
      cfg.fruitStock = stockData;
      saveMusicConfig(cfg);
      await message.reply(`✅ Đã cập nhật Stock Fruit thành: \`${stockData}\``);
      break;
    }

    case 'stock':
    case 'bllx':
    case 'fruit': {
      const stock = await fetchBloxFruitsStock();
      await message.reply(`🍎 **Blox Fruits Stock hiện tại:**\n${stock}`);
      break;
    }

    default:
      break;
  }
}

/**
 * Handles Slash Commands for music (/play, /skip, /pause, /resume, /stop, /queue, /volume, /loop, /shuffle, /nowplaying)
 */
export async function handleMusicSlashCommand(interaction: ChatInputCommandInteraction, client: any): Promise<boolean> {
  const { commandName } = interaction;
  const musicCommands = ['play', 'skip', 'pause', 'resume', 'stop', 'queue', 'volume', 'loop', 'shuffle', 'nowplaying'];
  if (!musicCommands.includes(commandName)) return false;

  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Lệnh này chỉ dùng được trong máy chủ Discord!', ephemeral: true });
    return true;
  }

  const member = interaction.member as any;
  const memberVoiceChannel = member?.voice?.channel;

  switch (commandName) {
    case 'play': {
      if (!memberVoiceChannel) {
        await interaction.reply({ content: '❌ Bạn cần tham gia vào một kênh thoại (Voice Channel) trước!', ephemeral: true });
        return true;
      }
      const query = interaction.options.getString('query', true);
      await interaction.deferReply();

      const res = await executePlay(
        interaction.guild,
        memberVoiceChannel,
        interaction.channelId,
        query,
        interaction.user.tag,
        client
      );

      if (!res.success) {
        await interaction.editReply(`❌ ${res.message}`);
        return true;
      }

      if (res.song) {
        const platformBadge =
          res.song.platform === 'spotify'
            ? '🟢 Spotify'
            : res.song.platform === 'youtube'
            ? '🔴 YouTube'
            : res.song.platform === 'direct'
            ? '🌐 Direct Audio'
            : '🟠 SoundCloud';

        const embed = new EmbedBuilder()
          .setTitle(res.queueLength === 1 ? '🎶 Bắt Đầu Phát Nhạc' : '➕ Đã Thêm Vào Hàng Đợi')
          .setDescription(`[**${res.song.title}**](${res.song.url})`)
          .setColor(res.song.platform === 'spotify' ? '#1DB954' : res.song.platform === 'youtube' ? '#FF0000' : '#23A559')
          .addFields(
            { name: '📡 Nguồn phát', value: platformBadge, inline: true },
            { name: '⏱️ Thời lượng', value: res.song.duration, inline: true },
            { name: '🔢 Vị trí', value: `#${res.queueLength}`, inline: true },
            { name: '👤 Yêu cầu bởi', value: res.song.requestedBy, inline: true }
          );

        if (res.song.thumbnail) {
          embed.setThumbnail(res.song.thumbnail);
        }

        await interaction.editReply({ embeds: [embed] });
      }
      return true;
    }

    case 'skip': {
      const queue = musicQueues.get(interaction.guildId!);
      if (!queue || !queue.isPlaying) {
        await interaction.reply({ content: '❌ Không có bài hát nào đang phát để chuyển!', ephemeral: true });
        return true;
      }
      const title = queue.songs[0]?.title || 'bài hiện tại';
      queue.player.stop();
      await interaction.reply(`⏭️ Đã bỏ qua: **${title}**`);
      return true;
    }

    case 'pause': {
      const queue = musicQueues.get(interaction.guildId!);
      if (!queue || !queue.isPlaying) {
        await interaction.reply({ content: '❌ Không có bài hát nào đang phát để tạm dừng!', ephemeral: true });
        return true;
      }
      queue.player.pause();
      queue.isPaused = true;
      await interaction.reply('⏸️ Đã tạm dừng phát nhạc.');
      return true;
    }

    case 'resume': {
      const queue = musicQueues.get(interaction.guildId!);
      if (!queue) {
        await interaction.reply({ content: '❌ Không có bài hát nào bị tạm dừng!', ephemeral: true });
        return true;
      }
      queue.player.unpause();
      queue.isPaused = false;
      await interaction.reply('▶️ Đã tiếp tục phát nhạc.');
      return true;
    }

    case 'stop': {
      const queue = musicQueues.get(interaction.guildId!);
      const connection = getVoiceConnection(interaction.guildId!);
      if (!queue && !connection) {
        await interaction.reply({ content: '❌ Bot không có trong phòng thoại nào!', ephemeral: true });
        return true;
      }
      if (queue) {
        queue.songs = [];
        try {
          queue.player.stop(true);
        } catch {}
      }
      if (connection) {
        try {
          connection.destroy();
        } catch {}
      }
      musicQueues.delete(interaction.guildId!);
      await interaction.reply('👋 Đã dừng nhạc và rời khỏi phòng thoại.');
      return true;
    }

    case 'queue': {
      const queue = musicQueues.get(interaction.guildId!);
      if (!queue || queue.songs.length === 0) {
        await interaction.reply({ content: '📭 Hàng đợi hiện đang trống!', ephemeral: true });
        return true;
      }
      const current = queue.songs[0];
      const upcoming = queue.songs.slice(1, 11);
      const listText =
        upcoming.length > 0
          ? upcoming.map((s, idx) => `\`${idx + 1}.\` [${s.title}](${s.url}) | \`${s.duration}\``).join('\n')
          : '_Không có bài hát tiếp theo trong hàng đợi._';

      const embed = new EmbedBuilder()
        .setTitle(`📜 Hàng Đợi Nhạc - ${interaction.guild.name}`)
        .setColor('#5865F2')
        .addFields(
          { name: '🎶 Đang phát', value: `[**${current.title}**](${current.url})` },
          { name: `📑 Tiếp theo (${queue.songs.length - 1} bài)`, value: listText }
        );

      await interaction.reply({ embeds: [embed] });
      return true;
    }

    case 'nowplaying': {
      const queue = musicQueues.get(interaction.guildId!);
      if (!queue || !queue.isPlaying || queue.songs.length === 0) {
        await interaction.reply({ content: '❌ Hiện không có bài hát nào đang phát!', ephemeral: true });
        return true;
      }
      const current = queue.songs[0];
      const embed = new EmbedBuilder()
        .setTitle('🎶 Bài Hát Đang Phát')
        .setDescription(`[**${current.title}**](${current.url})`)
        .setColor('#23A559')
        .addFields(
          { name: '⏱️ Thời lượng', value: current.duration, inline: true },
          { name: '👤 Yêu cầu bởi', value: current.requestedBy, inline: true }
        );
      if (current.thumbnail) embed.setThumbnail(current.thumbnail);
      await interaction.reply({ embeds: [embed] });
      return true;
    }

    case 'volume': {
      const queue = musicQueues.get(interaction.guildId!);
      if (!queue) {
        await interaction.reply({ content: '❌ Bot hiện không phát nhạc!', ephemeral: true });
        return true;
      }
      const vol = interaction.options.getInteger('percent', true);
      queue.volume = Math.max(1, Math.min(150, vol)) / 100;
      await interaction.reply(`🔊 Đã điều chỉnh âm lượng thành **${vol}%**.`);
      return true;
    }

    case 'loop': {
      const queue = musicQueues.get(interaction.guildId!);
      if (!queue) {
        await interaction.reply({ content: '❌ Bot hiện không phát nhạc!', ephemeral: true });
        return true;
      }
      const mode = (interaction.options.getString('mode', true) as 'off' | 'track' | 'queue');
      queue.loopMode = mode;
      await interaction.reply(`🔁 Chế độ lặp: **${mode === 'track' ? 'Lặp 1 bài' : mode === 'queue' ? 'Lặp toàn bộ hàng đợi' : 'Tắt'}**.`);
      return true;
    }

    case 'shuffle': {
      const queue = musicQueues.get(interaction.guildId!);
      if (!queue || queue.songs.length <= 1) {
        await interaction.reply({ content: '❌ Không đủ bài hát trong hàng đợi để xáo trộn!', ephemeral: true });
        return true;
      }
      const current = queue.songs[0];
      const upcoming = queue.songs.slice(1);
      for (let i = upcoming.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [upcoming[i], upcoming[j]] = [upcoming[j], upcoming[i]];
      }
      queue.songs = [current, ...upcoming];
      await interaction.reply(`🔀 Đã xáo trộn ngẫu nhiên **${upcoming.length}** bài hát trong hàng đợi!`);
      return true;
    }

    default:
      return false;
  }
}

/**
 * Returns current status of all music queues & available voice channels for Web Dashboard
 */
export function getMusicDashboardState(client: any) {
  // Collect first active queue
  let activeQueue: GuildQueue | null = null;
  for (const [, q] of musicQueues) {
    if (q.isPlaying || q.songs.length > 0) {
      activeQueue = q;
      break;
    }
  }

  // Find all available voice channels across connected guilds
  const voiceChannels: Array<{ id: string; name: string; guildId: string; guildName: string }> = [];
  if (client?.guilds?.cache) {
    for (const [, guild] of client.guilds.cache) {
      for (const [, channel] of guild.channels.cache) {
        if (channel.isVoiceBased?.() || channel.type === 2) {
          voiceChannels.push({
            id: channel.id,
            name: channel.name,
            guildId: guild.id,
            guildName: guild.name,
          });
        }
      }
    }
  }

  const soundcloudId = getSoundCloudClientId();

  if (!activeQueue) {
    return {
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
      voiceChannels,
      soundcloudId,
    };
  }

  return {
    active: true,
    guildId: activeQueue.guildId,
    guildName: activeQueue.guildName,
    voiceChannelId: activeQueue.voiceChannelId,
    voiceChannelName: activeQueue.voiceChannelName,
    isPlaying: activeQueue.isPlaying,
    isPaused: activeQueue.isPaused,
    volume: Math.round(activeQueue.volume * 100),
    loopMode: activeQueue.loopMode,
    currentSong: activeQueue.songs[0] || null,
    queue: activeQueue.songs.slice(1),
    voiceChannels,
    soundcloudId,
  };
}

/**
 * Handles Web Dashboard action controls
 */
export async function executeDashboardControl(action: string, value: any, client: any) {
  let activeQueue: GuildQueue | null = null;
  for (const [, q] of musicQueues) {
    activeQueue = q;
    break;
  }

  if (!activeQueue) {
    throw new Error('Bot hiện không kết nối vào phòng thoại nào.');
  }

  switch (action) {
    case 'pause':
      activeQueue.player.pause();
      activeQueue.isPaused = true;
      break;
    case 'resume':
      activeQueue.player.unpause();
      activeQueue.isPaused = false;
      break;
    case 'skip':
      activeQueue.player.stop();
      break;
    case 'stop': {
      activeQueue.songs = [];
      try {
        activeQueue.player.stop(true);
      } catch {}
      const conn = getVoiceConnection(activeQueue.guildId);
      if (conn) {
        try {
          conn.destroy();
        } catch {}
      }
      musicQueues.delete(activeQueue.guildId);
      break;
    }
    case 'volume': {
      const v = Number(value);
      if (!isNaN(v) && v >= 1 && v <= 150) {
        activeQueue.volume = v / 100;
      }
      break;
    }
    case 'loop': {
      if (value === 'off' || value === 'track' || value === 'queue') {
        activeQueue.loopMode = value;
      }
      break;
    }
    case 'shuffle': {
      if (activeQueue.songs.length > 1) {
        const current = activeQueue.songs[0];
        const upcoming = activeQueue.songs.slice(1);
        for (let i = upcoming.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [upcoming[i], upcoming[j]] = [upcoming[j], upcoming[i]];
        }
        activeQueue.songs = [current, ...upcoming];
      }
      break;
    }
    case 'remove': {
      const index = Number(value);
      if (!isNaN(index) && index >= 0 && index < activeQueue.songs.length - 1) {
        // Queue slice(1) index -> actual index is + 1
        activeQueue.songs.splice(index + 1, 1);
      }
      break;
    }
    default:
      throw new Error(`Thao tác không hỗ trợ: ${action}`);
  }

  return getMusicDashboardState(client);
}

/**
 * Handles Web Dashboard song request
 */
export async function playFromDashboard(query: string, voiceChannelId: string | undefined, client: any) {
  let targetVoiceChannel: any = null;
  let targetGuild: any = null;

  if (voiceChannelId) {
    for (const [, guild] of client.guilds.cache) {
      const ch = guild.channels.cache.get(voiceChannelId);
      if (ch && (ch.isVoiceBased?.() || ch.type === 2)) {
        targetVoiceChannel = ch;
        targetGuild = guild;
        break;
      }
    }
  }

  if (!targetVoiceChannel) {
    // Check if there is an existing queue
    for (const [, q] of musicQueues) {
      targetGuild = client.guilds.cache.get(q.guildId);
      targetVoiceChannel = targetGuild?.channels.cache.get(q.voiceChannelId);
      if (targetVoiceChannel) break;
    }
  }

  if (!targetVoiceChannel) {
    // Pick the first available voice channel
    for (const [, guild] of client.guilds.cache) {
      for (const [, channel] of guild.channels.cache) {
        if (channel.isVoiceBased?.() || channel.type === 2) {
          targetVoiceChannel = channel;
          targetGuild = guild;
          break;
        }
      }
      if (targetVoiceChannel) break;
    }
  }

  if (!targetVoiceChannel || !targetGuild) {
    throw new Error('Không tìm thấy kênh thoại (Voice Channel) nào trong các máy chủ bot tham gia.');
  }

  // Pick default text channel for announcements
  const textChannel =
    targetGuild.channels.cache.find((c: any) => c.isTextBased?.() && !c.isDMBased?.()) ||
    targetVoiceChannel;

  const result = await executePlay(
    targetGuild,
    targetVoiceChannel,
    textChannel.id,
    query,
    'Web Dashboard',
    client
  );

  if (!result.success) {
    throw new Error(result.message);
  }

  return getMusicDashboardState(client);
}
