import fs from 'fs';
import path from 'path';
import { Client, Message, ChatInputCommandInteraction, EmbedBuilder, User } from 'discord.js';

const WHITELIST_FILE = path.join(process.cwd(), 'bot_whitelist.json');

export interface WhitelistEntry {
  id: string;
  tag: string;
  addedAt: number;
  addedBy: string;
}

export interface BotWhitelistConfig {
  enabled: boolean; // Mặc định true: Chỉ chủ bot và những người trong Whitelist mới được dùng bot
  ownerIds: string[]; // Danh sách ID của chủ sở hữu bot
  whitelist: WhitelistEntry[]; // Danh sách thành viên được cấp quyền dùng bot
}

let configCache: BotWhitelistConfig = {
  enabled: true,
  ownerIds: [],
  whitelist: [],
};

export function loadBotWhitelist(): BotWhitelistConfig {
  try {
    if (fs.existsSync(WHITELIST_FILE)) {
      const raw = fs.readFileSync(WHITELIST_FILE, 'utf-8');
      configCache = JSON.parse(raw);
      if (!Array.isArray(configCache.ownerIds)) configCache.ownerIds = [];
      if (!Array.isArray(configCache.whitelist)) configCache.whitelist = [];
      if (typeof configCache.enabled !== 'boolean') configCache.enabled = true;
    } else {
      saveBotWhitelist();
    }
  } catch (err) {
    console.error('Lỗi khi đọc file bot_whitelist.json:', err);
  }
  return configCache;
}

export function saveBotWhitelist() {
  try {
    fs.writeFileSync(WHITELIST_FILE, JSON.stringify(configCache, null, 2), 'utf-8');
  } catch (err) {
    console.error('Lỗi khi lưu file bot_whitelist.json:', err);
  }
}

// Khởi tạo ngay khi import
loadBotWhitelist();

/**
 * Tự động đồng bộ Chủ Bot từ Discord Application info
 */
export async function syncBotOwnerFromClient(client: Client) {
  try {
    const app = await client.application?.fetch();
    if (!app) return;

    if (app.owner) {
      // Nếu là User đơn
      if ('id' in app.owner) {
        if (!configCache.ownerIds.includes(app.owner.id)) {
          configCache.ownerIds.push(app.owner.id);
          saveBotWhitelist();
          console.log(`[Whitelist] Đã nhận diện Chủ Bot: ${app.owner.id} (${(app.owner as any).tag || 'Owner'})`);
        }
      }
      // Nếu là Team
      if ('members' in app.owner && app.owner.members) {
        for (const [memberId] of app.owner.members) {
          if (!configCache.ownerIds.includes(memberId)) {
            configCache.ownerIds.push(memberId);
          }
        }
        saveBotWhitelist();
        console.log(`[Whitelist] Đã nhận diện các thành viên Team Owner:`, configCache.ownerIds);
      }
    }
  } catch (err) {
    console.warn('[Whitelist] Không thể tự động lấy Chủ Bot từ Application API:', err);
  }
}

export function isOwner(userId: string): boolean {
  if (configCache.ownerIds.includes(userId)) return true;
  // Hỗ trợ thêm OWNER_ID qua process.env nếu có
  if (process.env.OWNER_ID && process.env.OWNER_ID.trim() === userId) return true;
  return false;
}

export function isUserInWhitelist(userId: string): boolean {
  return configCache.whitelist.some(item => item.id === userId);
}

/**
 * Kiểm tra xem người dùng có quyền sử dụng bot không
 */
export function checkBotAccess(userId: string): { allowed: boolean; isOwner: boolean } {
  const userIsOwner = isOwner(userId);
  if (userIsOwner) {
    return { allowed: true, isOwner: true };
  }

  // Nếu chế độ Whitelist tắt: mọi người đều được dùng
  if (!configCache.enabled) {
    return { allowed: true, isOwner: false };
  }

  // Nếu chế độ Whitelist bật: chỉ ai trong Whitelist mới được dùng
  const inWhitelist = isUserInWhitelist(userId);
  return { allowed: inWhitelist, isOwner: false };
}

export function addOwnerId(userId: string): boolean {
  if (!configCache.ownerIds.includes(userId)) {
    configCache.ownerIds.push(userId);
    saveBotWhitelist();
    return true;
  }
  return false;
}

export function addToWhitelist(user: { id: string; tag: string }, addedBy: string): boolean {
  const existingIndex = configCache.whitelist.findIndex(w => w.id === user.id);
  if (existingIndex >= 0) {
    configCache.whitelist[existingIndex].tag = user.tag;
    configCache.whitelist[existingIndex].addedAt = Date.now();
    configCache.whitelist[existingIndex].addedBy = addedBy;
    saveBotWhitelist();
    return true;
  }

  configCache.whitelist.push({
    id: user.id,
    tag: user.tag,
    addedAt: Date.now(),
    addedBy,
  });
  saveBotWhitelist();
  return true;
}

export function removeFromWhitelist(userId: string): boolean {
  const beforeLen = configCache.whitelist.length;
  configCache.whitelist = configCache.whitelist.filter(w => w.id !== userId);
  if (configCache.whitelist.length !== beforeLen) {
    saveBotWhitelist();
    return true;
  }
  return false;
}

export function setWhitelistEnabled(enabled: boolean) {
  configCache.enabled = enabled;
  saveBotWhitelist();
}

export function getWhitelistConfig(): BotWhitelistConfig {
  return configCache;
}

/**
 * Xử lý lệnh Prefix liên quan đến Whitelist bot: ?wl / ?whitelist
 */
export async function handleWhitelistPrefixCommand(
  message: Message,
  args: string[],
  prefix: string
) {
  const authorId = message.author.id;
  const sub = args[0]?.toLowerCase();

  // 1. Xem danh sách Whitelist (Bất kỳ ai cũng có thể xem để biết ai có quyền)
  if (sub === 'list' || sub === 'danhsach' || sub === 'ds') {
    const embed = new EmbedBuilder()
      .setTitle('📋 DANH SÁCH WHITELIST SỬ DỤNG BOT')
      .setColor('#5865f2')
      .setDescription(
        `🛡️ **Chế độ bảo vệ:** ${configCache.enabled ? '🟢 **ĐANG BẬT (Chỉ Owner & Whitelist được dùng)**' : '🔴 **ĐANG TẮT (Mọi người đều dùng được)**'}\n\n` +
        `👑 **Chủ sở hữu Bot (${configCache.ownerIds.length}):**\n` +
        (configCache.ownerIds.length > 0
          ? configCache.ownerIds.map(id => `• <@${id}> (\`${id}\`)`).join('\n')
          : '*(Chưa ghi nhận ID chủ bot - Bot sẽ tự cập nhật khi khởi động hoặc dùng ?wl claim)*') +
        `\n\n📜 **Thành viên Whitelist (${configCache.whitelist.length}):**\n` +
        (configCache.whitelist.length > 0
          ? configCache.whitelist.map((item, idx) => `${idx + 1}. <@${item.id}> (\`${item.tag || item.id}\`)\n   └ Thêm bởi: **${item.addedBy}** • <t:${Math.floor(item.addedAt / 1000)}:R>`).join('\n\n')
          : '*Hiện tại chưa có ai được thêm vào Whitelist.*')
      )
      .setFooter({ text: `Dùng ${prefix}wl help để xem các lệnh quản lý Whitelist` })
      .setTimestamp();

    await message.reply({ embeds: [embed] });
    return;
  }

  // Nếu chưa có chủ bot nào được lưu và người gửi là Server Owner, cho phép họ nhận quyền chủ bot (?wl claim)
  if (sub === 'claim') {
    if (configCache.ownerIds.length === 0 || (message.guild && message.guild.ownerId === authorId)) {
      addOwnerId(authorId);
      await message.reply(`👑 Chúc mừng! Bạn (<@${authorId}>) đã được ghi nhận là **Chủ Sở Hữu Bot**.`);
      return;
    }
  }

  // TẤT CẢ CÁC HÀNH ĐỘNG DƯỚI ĐÂY BẮT BUỘC PHẢI LÀ CHỦ BOT (OWNER)
  if (!isOwner(authorId)) {
    await message.reply('⛔ **Chỉ Chủ Sở Hữu Bot (Bot Owner)** mới có quyền quản lý danh sách Whitelist!');
    return;
  }

  // 2. Thêm người dùng vào Whitelist: ?wl add @user
  if (sub === 'add' || sub === 'them') {
    const targetUser = message.mentions.users.first();
    const targetId = targetUser?.id || args[1];

    if (!targetId) {
      await message.reply(`💡 Cú pháp: \`${prefix}wl add @user\` hoặc \`${prefix}wl add <User_ID>\``);
      return;
    }

    let targetTag = targetUser?.tag || targetId;
    if (!targetUser) {
      try {
        const fetched = await message.client.users.fetch(targetId);
        if (fetched) targetTag = fetched.tag;
      } catch {}
    }

    addToWhitelist({ id: targetId, tag: targetTag }, message.author.tag);
    await message.reply(`✅ Đã thêm <@${targetId}> (\`${targetTag}\`) vào danh sách **Whitelist** thành công! Thành viên này đã có thể sử dụng tất cả các lệnh của bot.`);
    return;
  }

  // 3. Xóa người dùng khỏi Whitelist: ?wl remove @user
  if (sub === 'remove' || sub === 'del' || sub === 'xoa') {
    const targetUser = message.mentions.users.first();
    const targetId = targetUser?.id || args[1];

    if (!targetId) {
      await message.reply(`💡 Cú pháp: \`${prefix}wl remove @user\` hoặc \`${prefix}wl remove <User_ID>\``);
      return;
    }

    const removed = removeFromWhitelist(targetId);
    if (removed) {
      await message.reply(`🗑️ Đã xóa <@${targetId}> khỏi danh sách **Whitelist**!`);
    } else {
      await message.reply(`⚠️ Người dùng <@${targetId}> không nằm trong danh sách Whitelist.`);
    }
    return;
  }

  // 4. Bật/Tắt chế độ Whitelist: ?wl on / ?wl off
  if (sub === 'on' || sub === 'bat') {
    setWhitelistEnabled(true);
    await message.reply('🔒 Đã **BẬT** chế độ Whitelist! Kể từ bây giờ, **chỉ có Chủ Bot và các thành viên trong Whitelist** mới được phép sử dụng bot.');
    return;
  }

  if (sub === 'off' || sub === 'tat') {
    setWhitelistEnabled(false);
    await message.reply('🔓 Đã **TẮT** chế độ Whitelist! Bây giờ tất cả các thành viên trong máy chủ đều có thể sử dụng bot.');
    return;
  }

  // 5. Thêm chủ sở hữu mới: ?wl addowner @user
  if (sub === 'addowner') {
    const targetUser = message.mentions.users.first();
    const targetId = targetUser?.id || args[1];
    if (!targetId) {
      await message.reply(`💡 Cú pháp: \`${prefix}wl addowner @user\``);
      return;
    }
    addOwnerId(targetId);
    await message.reply(`👑 Đã thêm <@${targetId}> vào danh sách **Chủ Sở Hữu Bot (Owner)**.`);
    return;
  }

  // Menu hướng dẫn mặc định
  const helpEmbed = new EmbedBuilder()
    .setTitle('🔐 QUẢN LÝ WHITELIST & QUYỀN SỬ DỤNG BOT')
    .setColor('#5865f2')
    .setDescription(
      `Hệ thống phân quyền truy cập: Chỉ Chủ Bot và những người được cấp quyền mới có thể dùng bot.\n\n` +
      `**📌 Danh sách lệnh:**\n` +
      `• \`${prefix}wl list\`: Xem danh sách thành viên trong Whitelist.\n` +
      `• \`${prefix}wl add @user\`: Cấp quyền dùng bot cho một thành viên.\n` +
      `• \`${prefix}wl remove @user\`: Thu hồi quyền dùng bot.\n` +
      `• \`${prefix}wl on\`: Bật khóa bảo vệ (Chỉ Owner & Whitelist được dùng).\n` +
      `• \`${prefix}wl off\`: Mở khóa tự do (Ai cũng dùng được).\n` +
      `• \`${prefix}wl addowner @user\`: Thêm Chủ Bot mới.\n` +
      `• \`${prefix}wl claim\`: Nhận quyền Chủ Bot (nếu chưa ai nhận).`
    )
    .setFooter({ text: 'SentinelBot Whitelist Security' });

  await message.reply({ embeds: [helpEmbed] });
}
