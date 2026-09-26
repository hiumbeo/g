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
} from '@discordjs/voice';
import {
  Message,
  EmbedBuilder,
  PermissionsBitField,
  TextBasedChannel,
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
  return 'Pb72ranhoyt6gw7hM7TkzUItXlMWSNSo';
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
      }
    });
    const latencyMs = Date.now() - startTime;
    return {
      valid: res.status === 200,
      status: res.status,
      latencyMs,
    };
  } catch (err: any) {
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
 * Initializes SoundCloud token for play-dl
 */
export async function initSoundCloud() {
  const activeId = getSoundCloudClientId();
  try {
    await play.setToken({ soundcloud: { client_id: activeId } });
  } catch {
    // Safe token set
  }
}
initSoundCloud();

/**
 * Fetches current Blox Fruits stock from Parse.bot
 */
async function fetchBloxFruitsStock(): Promise<string> {
  const apiKey = process.env.PARSE_BOT_API_KEY; // Assumes this is set in the environment
  if (!apiKey) {
    return 'Chưa cấu hình API Key cho Parse.bot.';
  }

  try {
    // Note: Assuming endpoint structure based on common Parse.bot usage
    const res = await fetch(`https://api.parse.bot/v1/blox-fruits/stock?key=${apiKey}`);
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const data: any = await res.json();
    
    // Process response data into a human-readable string
    if (data.stock && data.stock.length > 0) {
      return data.stock.map((item: any) => `${item.name} (${item.price_beli} Beli)`).join(', ');
    }
    return 'Không có thông tin stock.';
  } catch (err: any) {
    console.error('Error fetching stock:', err);
    return 'Lỗi khi lấy dữ liệu từ API.';
  }
}

export interface Song {
  title: string;
  url: string;
  duration: string;
  thumbnail?: string;
  requestedBy: string;
  scTrack: any;
}

export interface GuildQueue {
  voiceChannelId: string;
  textChannelId: string;
  connection: VoiceConnection;
  player: AudioPlayer;
  songs: Song[];
  isPlaying: boolean;
  volume: number;
}

export const musicQueues = new Map<string, GuildQueue>();

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return 'N/A';
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
 * Plays the next song in the guild queue
 */
export async function playNextSong(guildId: string, client: any) {
  const queue = musicQueues.get(guildId);
  if (!queue) return;

  if (queue.songs.length === 0) {
    queue.isPlaying = false;
    const textChannel = client.channels.cache.get(queue.textChannelId) as TextBasedChannel | undefined;
    if (textChannel && 'send' in textChannel) {
      textChannel.send('⏹️ Đã phát hết danh sách bài hát trong hàng đợi. Gõ `.play <tên bài>` để phát tiếp!').catch(() => {});
    }
    return;
  }

  const song = queue.songs[0];

  try {
    await initSoundCloud();

    let stream: any;
    if (song.scTrack) {
      stream = await play.stream_from_info(song.scTrack);
    } else {
      // Direct stream fallback
      const searchRes = await play.search(song.title, { source: { soundcloud: 'tracks' }, limit: 1 });
      if (searchRes && searchRes.length > 0) {
        stream = await play.stream_from_info(searchRes[0]);
      } else {
        throw new Error('Không thể khởi tạo luồng âm thanh cho bài hát này.');
      }
    }

    if (!stream || !stream.stream) {
      throw new Error('Luồng âm thanh trống.');
    }

    // Attach stream error listener so stream pipeline issues don't crash process
    stream.stream.on('error', (streamErr: any) => {
      console.error('Audio stream pipe error:', streamErr);
    });

    const resource = createAudioResource(stream.stream, {
      inputType: stream.type,
      inlineVolume: true,
    });

    if (resource.volume) {
      resource.volume.setVolume(queue.volume);
    }

    queue.player.play(resource);
    queue.isPlaying = true;

    const textChannel = client.channels.cache.get(queue.textChannelId) as TextBasedChannel | undefined;
    if (textChannel && 'send' in textChannel) {
      const embed = new EmbedBuilder()
        .setTitle('🎶 Đang Phát Nhạc')
        .setDescription(`[**${song.title}**](${song.url})`)
        .setColor('#23A559')
        .addFields(
          { name: '⏱️ Thời lượng', value: song.duration || 'N/A', inline: true },
          { name: '👤 Yêu cầu bởi', value: song.requestedBy, inline: true },
          { name: '🔊 Âm lượng', value: `${Math.round(queue.volume * 100)}%`, inline: true }
        )
        .setFooter({ text: 'SentinelBot Music • Gõ .skip để đổi bài | .leave để rời phòng' });

      if (song.thumbnail) {
        embed.setThumbnail(song.thumbnail);
      }

      textChannel.send({ embeds: [embed] }).catch(() => {});
    }
  } catch (error: any) {
    console.error('Error playing track:', error);
    const textChannel = client.channels.cache.get(queue.textChannelId) as TextBasedChannel | undefined;
    if (textChannel && 'send' in textChannel) {
      textChannel.send(`⚠️ Không thể phát bài: **${song.title}** (${error.message || 'Lỗi stream'}). Đang chuyển bài kế tiếp...`).catch(() => {});
    }
    queue.songs.shift();
    playNextSong(guildId, client);
  }
}

export interface SearchSongResult {
  song: Song | null;
  error?: 'SC_401' | 'NOT_FOUND' | 'UNKNOWN';
  rawError?: string;
}

/**
 * Resolves a song query into a playable track via SoundCloud
 */
async function searchSong(rawQuery: string): Promise<SearchSongResult> {
  await initSoundCloud();

  let searchTerm = rawQuery.trim();

  // If query is a YouTube URL, resolve title via public oEmbed API
  if (searchTerm.includes('youtube.com/') || searchTerm.includes('youtu.be/')) {
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(searchTerm)}&format=json`;
      const res = await fetch(oembedUrl);
      if (res.ok) {
        const data: any = await res.json();
        if (data.title) {
          searchTerm = data.title;
        }
      }
    } catch {
      // Keep original searchTerm
    }
  }

  // 1. Search on SoundCloud with Smart Relevance Scoring
  try {
    const scResults = await play.search(searchTerm, {
      source: { soundcloud: 'tracks' },
      limit: 10,
    });

    if (scResults && scResults.length > 0) {
      const normQuery = normalizeText(searchTerm);
      const queryWords = normQuery.split(/\s+/).filter(Boolean);

      // Rank by title closeness to avoid wrong song selections
      const scored = scResults.map((track) => {
        const normTitle = normalizeText(track.name);
        let score = 0;

        // Exact phrase match
        if (normTitle === normQuery) {
          score += 50;
        } else if (normTitle.includes(normQuery)) {
          score += 20;
        }

        // Matching individual words
        queryWords.forEach((word) => {
          if (normTitle.includes(word)) {
            score += 4;
          }
        });

        // Penalize remix/mashup if query didn't ask for them
        if (normTitle.includes('remix') && !normQuery.includes('remix')) score -= 2;
        if (normTitle.includes('mashup') && !normQuery.includes('mashup')) score -= 2;
        if (normTitle.includes('karaoke') && !normQuery.includes('karaoke')) score -= 5;

        return { track, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const best = scored[0].track;

      return {
        song: {
          title: best.name || searchTerm,
          url: best.url,
          duration: formatDuration(best.durationInSec || 0),
          thumbnail: best.thumbnail,
          requestedBy: '',
          scTrack: best,
        },
      };
    }
  } catch (err: any) {
    console.error('SoundCloud search error:', err);
    const errMsg = err?.message || String(err);
    if (errMsg.includes('401') || errMsg.includes('Unauthorized')) {
      return {
        song: null,
        error: 'SC_401',
        rawError: errMsg,
      };
    }
  }

  return { song: null, error: 'NOT_FOUND' };
}

/**
 * Handles all music-related commands (.play, .skip, .stop, .leave, .setscid, .scstatus, etc.)
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
      if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild) && !message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
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
        await checkingMsg.edit(`✅ **Đã cập nhật SoundCloud Client ID thành công!**\n• Trạng thái API: \`200 OK\` (${res.latencyMs}ms)\n• Giờ bạn có thể dùng lệnh \`.play <tên bài>\` bình thường.`);
      } else {
        await checkingMsg.edit(`⚠️ **Client ID đã được lưu nhưng SoundCloud phản hồi HTTP ${res.status || 'Error'}:**\n• Có thể ID này không hợp lệ hoặc đã hết hạn.\n• Bạn có thể lấy lại ID mới từ tab Network (F12) trên trang [SoundCloud](https://soundcloud.com).`);
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
          { name: '💡 Tình trạng', value: res.valid ? 'Hoạt động bình thường. Có thể tìm kiếm và phát nhạc.' : 'Client ID đã hết hạn hoặc bị SoundCloud chặn (401 Unauthorized). Vui lòng dùng lệnh `/setscid` hoặc `.setscid` để đổi ID mới.' }
        )
        .setFooter({ text: 'Dùng /setscid hoặc .setscid <id> để thay đổi' });

      await checkingMsg.edit({ content: '', embeds: [embed] });
      break;
    }

    case 'play': {
      if (!memberVoiceChannel) {
        await message.reply('❌ Bạn cần phải tham gia vào một kênh thoại (Voice Channel) trước!');
        return;
      }

      const permissions = memberVoiceChannel.permissionsFor(message.guild.members.me!);
      if (!permissions?.has(PermissionsBitField.Flags.Connect) || !permissions.has(PermissionsBitField.Flags.Speak)) {
        await message.reply('❌ Bot không có quyền Kết nối (Connect) hoặc Nói (Speak) trong kênh thoại của bạn!');
        return;
      }

      const query = args.join(' ').trim();
      if (!query) {
        await message.reply('❌ Vui lòng nhập tên bài hát hoặc link nhạc. Ví dụ: `.play novocaine` hoặc `.play shape of you`');
        return;
      }

      const searchingMsg = await message.reply(`🔍 Đang tìm kiếm bài hát: \`${query}\`...`);

      try {
        const searchResult = await searchSong(query);

        if (searchResult.error === 'SC_401') {
          const scEmbed = new EmbedBuilder()
            .setTitle('⚠️ Lỗi SoundCloud API: 401 Unauthorized')
            .setColor('#ED4245')
            .setDescription(
              `SoundCloud gần đây đã cập nhật hệ thống API khiến các \`client_id\` cũ bị vô hiệu hóa (lỗi 401 Unauthorized khi tìm kiếm \`scsearch\`).\n\n` +
              `### 🛠️ Cách khắc phục nhanh (Chỉ 30 giây):\n` +
              `1️⃣ Mở trình duyệt máy tính, vào [SoundCloud](https://soundcloud.com)\n` +
              `2️⃣ Bấm phím **F12** (DevTools) ➔ chuyển sang tab **Network** (Mạng)\n` +
              `3️⃣ Nhấn phát bất kỳ 1 bài hát nào trên SoundCloud\n` +
              `4️⃣ Trong ô Filter của tab Network, gõ \`client_id\` và sao chép chuỗi 32 ký tự\n` +
              `5️⃣ Dùng lệnh sau để kích hoạt lại Bot ngay lập tức:\n` +
              `   • Slash: \`/setscid <client_id_vua_copy>\`\n` +
              `   • Hoặc Prefix: \`.setscid <client_id_vua_copy>\`\n` +
              `   • Kiểm tra lại: \`/scstatus\` hoặc \`.scstatus\`\n\n` +
              `_Bot sẽ tự động ghi nhớ ID này vào cấu hình hệ thống._`
            )
            .setFooter({ text: 'SentinelBot Music System • SoundCloud API 401 Fix' });

          await searchingMsg.edit({ content: '', embeds: [scEmbed] });
          return;
        }

        if (!searchResult.song) {
          await searchingMsg.edit(`❌ Không tìm thấy bài hát nào cho từ khóa: \`${query}\`. Hãy thử từ khóa khác!`);
          return;
        }

        const songInfo = searchResult.song;
        songInfo.requestedBy = message.author.tag;

        let queue = musicQueues.get(message.guild.id);
        let existingConnection = getVoiceConnection(message.guild.id);

        // Ensure voice connection is active and healthy
        if (!existingConnection || existingConnection.state.status === VoiceConnectionStatus.Destroyed) {
          existingConnection = joinVoiceChannel({
            channelId: memberVoiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator as any,
          });
        }

        if (!queue) {
          const player = createAudioPlayer();
          existingConnection.subscribe(player);

          queue = {
            voiceChannelId: memberVoiceChannel.id,
            textChannelId: message.channel.id,
            connection: existingConnection,
            player,
            songs: [],
            isPlaying: false,
            volume: 1,
          };

          musicQueues.set(message.guild.id, queue);

          // Handle player status changes
          player.on(AudioPlayerStatus.Idle, () => {
            const currentQueue = musicQueues.get(message.guild!.id);
            if (currentQueue && currentQueue.songs.length > 0) {
              currentQueue.songs.shift(); // Remove finished song
              if (currentQueue.songs.length > 0) {
                playNextSong(message.guild!.id, client);
              } else {
                currentQueue.isPlaying = false;
              }
            }
          });

          player.on('error', (err) => {
            console.error('Player runtime error:', err);
            const currentQueue = musicQueues.get(message.guild!.id);
            if (currentQueue) {
              const textChannel = client.channels.cache.get(currentQueue.textChannelId) as TextBasedChannel | undefined;
              if (textChannel && 'send' in textChannel) {
                textChannel.send(`⚠️ Lỗi player: **${err.message || 'Lỗi không xác định'}**. Đang chuyển bài tiếp...`).catch(() => {});
              }
              if (currentQueue.songs.length > 0) {
                currentQueue.songs.shift();
                playNextSong(message.guild!.id, client);
              } else {
                currentQueue.isPlaying = false;
              }
            }
          });

          existingConnection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
              await Promise.race([
                entersState(existingConnection!, VoiceConnectionStatus.Signalling, 4_000),
                entersState(existingConnection!, VoiceConnectionStatus.Connecting, 4_000),
              ]);
            } catch {
              try {
                existingConnection!.destroy();
              } catch {}
              musicQueues.delete(message.guild!.id);
            }
          });
        } else {
          // If queue exists, ensure connection and channel are in sync
          queue.connection = existingConnection;
          queue.connection.subscribe(queue.player);
          queue.voiceChannelId = memberVoiceChannel.id;
          queue.textChannelId = message.channel.id;
        }

        queue.songs.push(songInfo);

        if (!queue.isPlaying) {
          await searchingMsg.delete().catch(() => {});
          playNextSong(message.guild.id, client);
        } else {
          const queueEmbed = new EmbedBuilder()
            .setTitle('➕ Đã Thêm Vào Hàng Đợi')
            .setDescription(`[**${songInfo.title}**](${songInfo.url})`)
            .setColor('#5865F2')
            .addFields(
              { name: '⏱️ Thời lượng', value: songInfo.duration, inline: true },
              { name: '🔢 Vị trí hàng đợi', value: `#${queue.songs.length}`, inline: true },
              { name: '👤 Yêu cầu bởi', value: songInfo.requestedBy, inline: true }
            );
          if (songInfo.thumbnail) {
            queueEmbed.setThumbnail(songInfo.thumbnail);
          }
          await searchingMsg.edit({ content: '', embeds: [queueEmbed] });
        }
      } catch (err: any) {
        console.error('Error in .play command:', err);
        await searchingMsg.edit(`❌ Đã xảy ra lỗi khi tìm kiếm bài hát: ${err.message || 'Lỗi không xác định'}`);
      }
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
        await message.reply(`🔊 Âm lượng hiện tại: **${Math.round(queue.volume * 100)}%**. Để thay đổi, gõ: \`.volume 1-150\``);
        return;
      }
      queue.volume = volArg / 100;
      await message.reply(`🔊 Đã điều chỉnh âm lượng thành **${volArg}%**.`);
      break;
    }

    case 'skip':
    case 's': {
      const queue = musicQueues.get(message.guild.id);
      if (!queue || !queue.isPlaying) {
        await message.reply('❌ Hiện tại không có bài hát nào đang phát để chuyển bài!');
        return;
      }

      const skippedSong = queue.songs[0]?.title || 'bài hiện tại';
      queue.player.stop();
      await message.reply(`⏭️ Đã bỏ qua: **${skippedSong}**`);
      break;
    }

    case 'stop':
    case 'leave': {
      const connection = getVoiceConnection(message.guild.id);
      const queue = musicQueues.get(message.guild.id);

      if (!queue && !connection) {
        await message.reply('❌ Bot hiện không có trong bất kỳ kênh thoại nào!');
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
      await message.reply('👋 Đã dừng phát nhạc, xóa toàn bộ hàng đợi và rời khỏi kênh thoại.');
      break;
    }

    case 'pause': {
      const queue = musicQueues.get(message.guild.id);
      if (!queue || !queue.isPlaying) {
        await message.reply('❌ Không có bài hát nào đang phát để tạm dừng!');
        return;
      }
      queue.player.pause();
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
      await message.reply('▶️ Đã tiếp tục phát nhạc.');
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

      const listText = upcoming.length > 0
        ? upcoming.map((s, idx) => `\`${idx + 1}.\` [${s.title}](${s.url}) | \`${s.duration}\` (bởi ${s.requestedBy})`).join('\n')
        : '_Không có bài hát tiếp theo trong hàng đợi._';

      const embed = new EmbedBuilder()
        .setTitle(`📜 Hàng Đợi Nhạc - ${message.guild.name}`)
        .setColor('#5865F2')
        .addFields(
          { name: '🎶 Đang phát', value: `[**${current.title}**](${current.url}) | \`${current.duration}\` (bởi ${current.requestedBy})` },
          { name: `📑 Tiếp theo (${queue.songs.length - 1} bài)`, value: listText }
        )
        .setFooter({ text: `Tổng cộng ${queue.songs.length} bài hát trong hàng đợi` });

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
      const embed = new EmbedBuilder()
        .setTitle('🎶 Bài Hát Đang Phát')
        .setDescription(`[**${current.title}**](${current.url})`)
        .setColor('#23A559')
        .addFields(
          { name: '⏱️ Thời lượng', value: current.duration, inline: true },
          { name: '👤 Yêu cầu bởi', value: current.requestedBy, inline: true },
          { name: '📑 Còn lại trong hàng đợi', value: `${queue.songs.length - 1} bài`, inline: true }
        );

      if (current.thumbnail) {
        embed.setThumbnail(current.thumbnail);
      }

      await message.reply({ embeds: [embed] });
      break;
    }

    case 'setstock': {
      if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild) && !message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
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
