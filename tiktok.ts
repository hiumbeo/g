import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  Message,
  ChatInputCommandInteraction,
  PermissionsBitField,
} from 'discord.js';
import fs from 'fs';
import path from 'path';

export interface TikTokData {
  id: string;
  title: string;
  cover: string;
  videoUrl: string;
  hdVideoUrl?: string;
  musicUrl?: string;
  musicTitle?: string;
  musicAuthor?: string;
  author: {
    id?: string;
    uniqueId: string;
    nickname: string;
    avatar: string;
  };
  stats: {
    diggCount: number;
    commentCount: number;
    shareCount: number;
    playCount: number;
  };
  duration: number;
  images?: string[];
  originalUrl: string;
}

// Lưu trữ cấu hình auto-embed cho từng guild (Mặc định: BẬT tự động nhận diện)
const SETTINGS_FILE = path.join(process.cwd(), 'tiktok_settings.json');
let autoEmbedSettings: Record<string, boolean> = {};

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      autoEmbedSettings = JSON.parse(data);
    }
  } catch (err) {
    console.error('[TikTok] Lỗi tải cài đặt:', err);
    autoEmbedSettings = {};
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(autoEmbedSettings, null, 2), 'utf-8');
  } catch (err) {
    console.error('[TikTok] Lỗi lưu cài đặt:', err);
  }
}

loadSettings();

/**
 * Kiểm tra xem guild có bật tính năng tự động nhận diện link TikTok không (mặc định: TRUE)
 */
export function isTikTokAutoEmbedEnabled(guildId?: string): boolean {
  if (!guildId) return true;
  return autoEmbedSettings[guildId] !== false; // Mặc định là true nếu chưa tắt
}

/**
 * Bật/tắt tính năng tự động nhận diện link TikTok cho server
 */
export function setTikTokAutoEmbed(guildId: string, enabled: boolean): void {
  autoEmbedSettings[guildId] = enabled;
  saveSettings();
}

/**
 * Regex bắt mọi định dạng link TikTok (full, rút gọn vt.tiktok.com, vm.tiktok.com, m.tiktok.com)
 */
export const TIKTOK_URL_REGEX = /https?:\/\/(?:www\.|vt\.|vm\.|m\.|t\.)?tiktok\.com\/(?:@[a-zA-Z0-9_.-]+\/(?:video|photo)\/\d+|[a-zA-Z0-9_.-]+\/?(?:\?[^\s]*)?)/gi;

/**
 * Tìm link TikTok đầu tiên trong chuỗi văn bản
 */
export function extractFirstTikTokUrl(text: string): string | null {
  const matches = text.match(TIKTOK_URL_REGEX);
  return matches && matches.length > 0 ? matches[0] : null;
}

/**
 * Chuyển đổi link TikTok sang vxTikTok để Discord tự động preview trực tiếp video
 */
export function convertToVxTikTok(url: string): string {
  try {
    const cleanUrl = url.split('?')[0]; // Bỏ query tracking
    return cleanUrl
      .replace('https://www.tiktok.com', 'https://www.vxtiktok.com')
      .replace('https://tiktok.com', 'https://vxtiktok.com')
      .replace('https://vt.tiktok.com', 'https://vt.vxtiktok.com')
      .replace('https://vm.tiktok.com', 'https://vm.vxtiktok.com');
  } catch {
    return url;
  }
}

/**
 * Format số lượng hiển thị (VD: 1.2M, 45.6K)
 */
export function formatCount(count: number): string {
  if (!count || isNaN(count)) return '0';
  if (count >= 1_000_000) {
    return (count / 1_000_000).toFixed(1) + 'M';
  }
  if (count >= 1_000) {
    return (count / 1_000).toFixed(1) + 'K';
  }
  return count.toLocaleString('vi-VN');
}

/**
 * Gọi API TikWM để lấy thông tin video TikTok không logo (No Watermark)
 */
export async function fetchTikTokData(url: string): Promise<TikTokData | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 giây timeout

  try {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`;
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[TikTok] TikWM HTTP ${response.status}`);
      return null;
    }

    const resJson = await response.json();
    if (!resJson || resJson.code !== 0 || !resJson.data) {
      console.warn('[TikTok] TikWM trả về mã lỗi:', resJson?.msg || 'Dữ liệu trống');
      return null;
    }

    const d = resJson.data;

    return {
      id: d.id || '',
      title: d.title || 'Video TikTok không có tiêu đề',
      cover: d.cover || d.origin_cover || '',
      videoUrl: d.play || '',
      hdVideoUrl: d.hdplay || d.play || '',
      musicUrl: d.music || '',
      musicTitle: d.music_info?.title || '',
      musicAuthor: d.music_info?.author || '',
      author: {
        id: d.author?.id,
        uniqueId: d.author?.unique_id || 'unknown',
        nickname: d.author?.nickname || 'TikToker',
        avatar: d.author?.avatar || '',
      },
      stats: {
        diggCount: Number(d.digg_count) || 0,
        commentCount: Number(d.comment_count) || 0,
        shareCount: Number(d.share_count) || 0,
        playCount: Number(d.play_count) || 0,
      },
      duration: Number(d.duration) || 0,
      images: Array.isArray(d.images) && d.images.length > 0 ? d.images : undefined,
      originalUrl: url,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error('[TikTok] Lỗi khi gọi API TikTok:', err?.message || err);
    return null;
  }
}

/**
 * Tải file video thành Buffer nếu dung lượng nhỏ hơn 24MB (Discord upload limit)
 */
async function downloadVideoBuffer(videoUrl: string): Promise<Buffer | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s cho tải video

  try {
    const res = await fetch(videoUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) return null;

    // Kiểm tra kích thước Content-Length nếu có
    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 24 * 1024 * 1024) {
      console.log('[TikTok] File video vượt quá 24MB, chuyển sang chế độ vxTikTok stream link');
      return null;
    }

    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    if (buffer.length > 24 * 1024 * 1024) {
      return null;
    }

    return buffer;
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn('[TikTok] Không thể tải buffer video:', err?.message);
    return null;
  }
}

/**
 * Xử lý link TikTok từ tin nhắn hoặc lệnh
 */
export async function processTikTokLink(
  target: Message | ChatInputCommandInteraction,
  tiktokUrl: string,
  options: { isAutoDetect?: boolean } = {}
) {
  const isInteraction = 'editReply' in target;
  const originalUser = isInteraction ? target.user : target.author;

  // Gửi thông báo đang xử lý nếu là tương tác
  if (isInteraction) {
    await target.deferReply();
  }

  // Hàm gửi kết quả: Gửi tin nhắn mới trước, sau đó mới xóa tin nhắn gốc
  const sendResponse = async (payload: {
    content?: string;
    embeds?: EmbedBuilder[];
    files?: AttachmentBuilder[];
    components?: ActionRowBuilder<ButtonBuilder>[];
  }) => {
    if (isInteraction) {
      await target.editReply(payload);
      return;
    }

    const message = target as Message;
    
    // Gửi tin nhắn mới trước
    let sentMessage: Message | null = null;
    try {
      if ('send' in message.channel) {
        const credit = `🎬 **TikTok gửi bởi <@${originalUser.id}>:**`;
        const updatedContent = payload.content ? `${credit}\n${payload.content}` : credit;
        sentMessage = await (message.channel as any).send({
          ...payload,
          content: updatedContent,
        });
      }
    } catch (sendErr: any) {
      console.error('[TikTok] Lỗi khi gửi kết quả video:', sendErr);
      return; // Nếu không gửi được tin mới, không xóa tin cũ
    }

    // Nếu đã gửi thành công, mới xóa tin nhắn gốc
    if (sentMessage) {
        try {
          if (message.deletable) {
            await message.delete();
          }
        } catch (delErr: any) {
          console.warn('[TikTok] Không thể xóa tin nhắn gốc:', delErr?.message);
        }
    }
  };

  // Lấy dữ liệu video từ TikWM
  const data = await fetchTikTokData(tiktokUrl);

  // Fallback nếu không cào được qua TikWM (vd API tạm bảo trì)
  if (!data) {
    const vxUrl = convertToVxTikTok(tiktokUrl);
    const fallbackEmbed = new EmbedBuilder()
      .setColor('#EE1D52')
      .setAuthor({
        name: 'TikTok Video Viewer',
        iconURL: 'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=128&auto=format&fit=crop&q=80',
      })
      .setTitle('🎬 Trình Xem Video TikTok')
      .setDescription(`Không thể cào dữ liệu trực tiếp, nhưng bạn có thể xem video ngay tại liên kết hỗ trợ Discord bên dưới:\n\n🔗 **[Xem video trực tiếp với VxTikTok](${vxUrl})**`)
      .setFooter({ text: `Yêu cầu bởi ${originalUser.username} • SentinelBot` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Mở TikTok Gốc')
        .setStyle(ButtonStyle.Link)
        .setURL(tiktokUrl)
        .setEmoji('🌐'),
      new ButtonBuilder()
        .setLabel('Xem Player Nhanh')
        .setStyle(ButtonStyle.Link)
        .setURL(vxUrl)
        .setEmoji('▶️')
    );

    await sendResponse({ embeds: [fallbackEmbed], components: [row] });
    return;
  }

  // --- Trường hợp 1: TikTok Photo Slide (Bộ ảnh) ---
  if (data.images && data.images.length > 0) {
    const photoEmbed = new EmbedBuilder()
      .setColor('#00F2FE')
      .setAuthor({
        name: `${data.author.nickname} (@${data.author.uniqueId})`,
        iconURL: data.author.avatar || undefined,
        url: `https://www.tiktok.com/@${data.author.uniqueId}`,
      })
      .setTitle(`📸 Bộ ảnh TikTok (${data.images.length} hình)`)
      .setDescription(data.title.slice(0, 500) || 'Không có mô tả')
      .setImage(data.images[0])
      .addFields(
        { name: '❤️ Lượt thích', value: formatCount(data.stats.diggCount), inline: true },
        { name: '💬 Bình luận', value: formatCount(data.stats.commentCount), inline: true },
        { name: '🔁 Chia sẻ', value: formatCount(data.stats.shareCount), inline: true }
      )
      .setFooter({ text: `TikTok Photo • Yêu cầu bởi ${originalUser.username}` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Mở Trên TikTok')
        .setStyle(ButtonStyle.Link)
        .setURL(tiktokUrl)
        .setEmoji('📱')
    );

    if (data.musicUrl) {
      row.addComponents(
        new ButtonBuilder()
          .setLabel('Tải Nhạc Nền (MP3)')
          .setStyle(ButtonStyle.Link)
          .setURL(data.musicUrl)
          .setEmoji('🎵')
      );
    }

    await sendResponse({ embeds: [photoEmbed], components: [row] });
    return;
  }

  // --- Trường hợp 2: Video TikTok ---
  // Tạo Embed mô tả thông tin video
  const videoEmbed = new EmbedBuilder()
    .setColor('#010101')
    .setAuthor({
      name: `${data.author.nickname} (@${data.author.uniqueId})`,
      iconURL: data.author.avatar || undefined,
      url: `https://www.tiktok.com/@${data.author.uniqueId}`,
    })
    .setTitle(data.title.length > 250 ? data.title.slice(0, 247) + '...' : data.title || 'Video TikTok')
    .setURL(tiktokUrl)
    .setThumbnail(data.cover || null)
    .addFields(
      { name: '❤️ Lượt thích', value: `\`${formatCount(data.stats.diggCount)}\``, inline: true },
      { name: '💬 Bình luận', value: `\`${formatCount(data.stats.commentCount)}\``, inline: true },
      { name: '👁️ Lượt xem', value: `\`${formatCount(data.stats.playCount)}\``, inline: true }
    )
    .setFooter({ text: `⏱️ ${data.duration}s • Yêu cầu bởi ${originalUser.username} • SentinelBot` })
    .setTimestamp();

  if (data.musicTitle) {
    videoEmbed.addFields({
      name: '🎵 Âm thanh',
      value: `${data.musicTitle} ${data.musicAuthor ? `- *${data.musicAuthor}*` : ''}`.slice(0, 100),
      inline: false,
    });
  }

  // Nút bấm tiện ích
  const buttonsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('Mở TikTok')
      .setStyle(ButtonStyle.Link)
      .setURL(tiktokUrl)
      .setEmoji('📱')
  );

  if (data.hdVideoUrl || data.videoUrl) {
    buttonsRow.addComponents(
      new ButtonBuilder()
        .setLabel('Tải Không Logo (HD)')
        .setStyle(ButtonStyle.Link)
        .setURL(data.hdVideoUrl || data.videoUrl)
        .setEmoji('📥')
    );
  }

  if (data.musicUrl) {
    buttonsRow.addComponents(
      new ButtonBuilder()
        .setLabel('Tải Nhạc (MP3)')
        .setStyle(ButtonStyle.Link)
        .setURL(data.musicUrl)
        .setEmoji('🎵')
    );
  }

  // Thử tải video buffer để đính kèm file .mp4 vào chat trực tiếp
  const videoBuffer = await downloadVideoBuffer(data.videoUrl);

  if (videoBuffer) {
    const videoAttachment = new AttachmentBuilder(videoBuffer, {
      name: `tiktok_${data.author.uniqueId}_${data.id || 'video'}.mp4`,
    });

    await sendResponse({
      embeds: [videoEmbed],
      files: [videoAttachment],
      components: [buttonsRow],
    });
  } else {
    // Nếu video > 24MB hoặc không tải được file trực tiếp, dùng vxTikTok link để Discord tự stream video
    const vxUrl = convertToVxTikTok(tiktokUrl);
    const textContent = `🎬 **Video từ @${data.author.uniqueId}:**\n${vxUrl}`;

    await sendResponse({
      content: textContent,
      embeds: [videoEmbed],
      components: [buttonsRow],
    });
  }
}
