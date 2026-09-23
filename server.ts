import express from 'express';
import path from 'path';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionsBitField,
  Collection,
  Message,
  SlashCommandBuilder,
  WebhookClient,
  TextChannel
} from 'discord.js';
import { askGeminiChat } from './gemini';
import {
  handleMusicCommand,
  setSoundCloudClientId,
  getSoundCloudClientId,
  validateSoundCloudId
} from './music';
import { performWebScan, performFileScan, getScanHistory, clearScanHistory } from './scanner';
import { calculateShip, calculateGayRate } from './fun';
import { backupData } from './backup';
import { captureServerBackup } from './serverBackup';
import { setWelcome, setGoodbye, setBoost, getSettings } from './src/welcome';
import { setAfk, getAfk, removeAfk } from './src/afk';
import { fetchRobloxUser, buildRobloxDiscordEmbed } from './roblox';
import {
  buildTicketPanel,
  handleCreateTicketButton,
  handleCloseTicketButton,
  handleConfirmClose,
  handlePingAdmin,
  getTicketConfig,
  updateTicketConfig,
  setTicketImage,
  buildCustomEmbed,
  defaultTicketConfig,
} from './ticket';
import {
  setupAntiRaidListeners,
  getAntiRaidConfig,
  updateAntiRaidConfig,
  getRaidIncidents,
  clearRaidIncidents,
  addWhitelistUser,
  removeWhitelistUser,
  toggleServerLockdown,
  resetUserCounters
} from './antiraid';
import {
  getRpcConfig,
  applyRpcToBot,
  startRpcRotation,
  setRpcAutoRotate,
  BotRpcConfig
} from './rpc';
import {
  extractFirstTikTokUrl,
  processTikTokLink,
  isTikTokAutoEmbedEnabled,
  setTikTokAutoEmbed,
  fetchTikTokData
} from './tiktok';
import {
  resolveTargetUserAndMember,
  buildWhoisEmbed,
  buildAvatarEmbed,
  buildBannerEmbed
} from './userInfo';

// Process error handling guards to ensure dev server and preview stability
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection caught (safely bypassed):', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception caught (safely bypassed):', err);
});

// --- Discord Bot Setup ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

// Kích hoạt toàn diện hệ thống Anti-Raid Engine (Microngamer/anti-raid-1 port)
setupAntiRaidListeners(client);

// --- Welcome & Goodbye ---
client.on('guildMemberAdd', async (member) => {
    const settings = getSettings(member.guild.id);
    if (!settings || !settings.welcomeChannelId) return;
    
    // Check if it's a bot
    if (member.user.bot) {
        const channel = member.guild.channels.cache.get(settings.welcomeChannelId) as TextChannel;
        if (channel) channel.send(`Cảm ơn Bot ${member.user.tag} đã tham gia!`);
        return;
    }

    const channel = member.guild.channels.cache.get(settings.welcomeChannelId) as TextChannel;
    if (channel && settings.welcomeMessage) {
        channel.send(`${settings.welcomeMessage.replace('{user}', `<@${member.id}>`)} \n ${settings.welcomeGif}`);
    }
});

client.on('guildMemberRemove', async (member) => {
    const settings = getSettings(member.guild.id);
    if (!settings || !settings.goodbyeChannelId) return;
    
    const channel = member.guild.channels.cache.get(settings.goodbyeChannelId) as TextChannel;
    if (channel && settings.goodbyeMessage) {
        channel.send(`${settings.goodbyeMessage.replace('{user}', member.user.tag)} \n ${settings.goodbyeGif}`);
    }
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (!oldMember.premiumSince && newMember.premiumSince) {
        const settings = getSettings(newMember.guild.id);
        if (!settings || !settings.boostChannelId) return;

        const channel = newMember.guild.channels.cache.get(settings.boostChannelId) as TextChannel;
        if (channel && settings.boostMessage) {
            channel.send(`${settings.boostMessage.replace('{user}', `<@${newMember.id}>`)} \n ${settings.boostGif}`);
        }
    }
});

// Cache for !snipe (Store one deleted message per channel)
const snipes = new Collection<string, { content: string; author: string; timestamp: number }>();

// Simple anti-spam tracking
const antiSpamEnabled = new Set<string>(); // Guild IDs where antispam is on
const userMessageCount = new Map<string, { count: number; timer: NodeJS.Timeout }>();

// Anti-nuke flag
const antiNukeEnabled = new Set<string>(); // Guild IDs where antinuke is on

// Custom Prefix per guild
const guildPrefixes = new Map<string, string>();

// Webhook mimicry (channelId -> Webhook URL)
const activeWebhooks = new Map<string, string>();

// Auto-delete users (guildId -> Set<userId>)
const autoDeleteMap = new Map<string, Set<string>>();

// Authorized guilds (Set<guildId>)
const authorizedGuilds = new Set<string>();

// Slash Commands Registry
const registeredSlashCommands = [
  new SlashCommandBuilder()
    .setName('roblox')
    .setDescription('Tra cứu thông tin tài khoản Roblox (Avatar, ngày join, link profile)')
    .addStringOption((option) =>
      option
        .setName('username')
        .setDescription('Tên tài khoản (Username) hoặc ID Roblox cần kiểm tra')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Cấm (Ban) một thành viên khỏi máy chủ')
    .addUserOption((opt) => opt.setName('user').setDescription('Thành viên cần ban').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Lý do ban').setRequired(false))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.BanMembers),
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Đuổi (Kick) một thành viên khỏi máy chủ')
    .addUserOption((opt) => opt.setName('user').setDescription('Thành viên cần kick').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Lý do kick').setRequired(false))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.KickMembers),
  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Cách ly / Chặn chat (Timeout) một thành viên')
    .addUserOption((opt) => opt.setName('user').setDescription('Thành viên cần timeout').setRequired(true))
    .addIntegerOption((opt) => opt.setName('minutes').setDescription('Số phút timeout (ví dụ: 5, 10, 60)').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Lý do timeout').setRequired(false))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers),
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Hệ thống Ticket & Trung Gian Mua Bán')
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Gửi Bảng Tạo Ticket (Ticket Panel) vào kênh')
        .addChannelOption((opt) => opt.setName('channel').setDescription('Kênh cần gửi Bảng Ticket (Mặc định: kênh hiện tại)').setRequired(false))
        .addStringOption((opt) => opt.setName('image').setDescription('Link URL ảnh banner cho Embed (VD: https://... hoặc link ảnh discord)').setRequired(false))
        .addAttachmentOption((opt) => opt.setName('attachment').setDescription('Tải ảnh trực tiếp từ máy/điện thoại để gắn vào Embed').setRequired(false))
        .addStringOption((opt) => opt.setName('title').setDescription('Tiêu đề Bảng Ticket').setRequired(false))
        .addStringOption((opt) => opt.setName('description').setDescription('Nội dung mô tả Bảng Ticket').setRequired(false))
        .addStringOption((opt) => opt.setName('color').setDescription('Mã màu Hex viền Embed (VD: #5865F2)').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('setimage')
        .setDescription('Cài đặt hoặc thay đổi ảnh banner cho Bảng Ticket')
        .addStringOption((opt) => opt.setName('url').setDescription('Link URL ảnh mới (https://...)').setRequired(false))
        .addAttachmentOption((opt) => opt.setName('file').setDescription('Tải ảnh từ máy tính/điện thoại để làm banner').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('close')
        .setDescription('Đóng kênh Ticket hiện tại')
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),
  new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Tạo và gửi Tin nhắn Embed tùy chỉnh kèm ảnh')
    .addStringOption((opt) => opt.setName('description').setDescription('Nội dung chính của Embed').setRequired(true))
    .addStringOption((opt) => opt.setName('title').setDescription('Tiêu đề Embed').setRequired(false))
    .addStringOption((opt) => opt.setName('image').setDescription('Link ảnh lớn bên dưới Embed (URL)').setRequired(false))
    .addAttachmentOption((opt) => opt.setName('attachment').setDescription('Tải file ảnh trực tiếp để gắn vào Embed').setRequired(false))
    .addStringOption((opt) => opt.setName('color').setDescription('Mã màu Hex (VD: #5865F2, #22C55E, #ED4245)').setRequired(false))
    .addStringOption((opt) => opt.setName('thumbnail').setDescription('Link ảnh nhỏ góc phải (Thumbnail URL)').setRequired(false))
    .addAttachmentOption((opt) => opt.setName('thumbnail_file').setDescription('Tải file ảnh nhỏ góc phải').setRequired(false))
    .addChannelOption((opt) => opt.setName('channel').setDescription('Kênh gửi Embed (Mặc định: kênh hiện tại)').setRequired(false))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages),
  new SlashCommandBuilder()
    .setName('tiktok')
    .setDescription('Tải và xem video TikTok không logo trực tiếp trên Discord')
    .addStringOption((opt) => opt.setName('url').setDescription('Link video TikTok (vt.tiktok.com hoặc www.tiktok.com/...)').setRequired(true)),
  new SlashCommandBuilder()
    .setName('whois')
    .setDescription('Xem thông tin chi tiết tài khoản của bạn hoặc người khác')
    .addUserOption((opt) => opt.setName('user').setDescription('Người dùng cần tra cứu (Mặc định: chính bạn)').setRequired(false)),
  new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Xem và tải ảnh đại diện (Avatar) chất lượng cao')
    .addUserOption((opt) => opt.setName('user').setDescription('Người dùng cần xem avatar (Mặc định: chính bạn)').setRequired(false)),
  new SlashCommandBuilder()
    .setName('banner')
    .setDescription('Xem và tải ảnh bìa (Banner Profile) của bạn hoặc người khác')
    .addUserOption((opt) => opt.setName('user').setDescription('Người dùng cần xem banner (Mặc định: chính bạn)').setRequired(false)),
  new SlashCommandBuilder()
    .setName('setwelcome')
    .setDescription('Thiết lập welcome')
    .addChannelOption(option => option.setName('channel').setDescription('Kênh chào mừng').setRequired(true))
    .addStringOption(option => option.setName('message').setDescription('Nội dung chào mừng').setRequired(true))
    .addStringOption(option => option.setName('gif').setDescription('Link GIF').setRequired(true)),
  new SlashCommandBuilder()
    .setName('setgoodbye')
    .setDescription('Thiết lập goodbye')
    .addChannelOption(option => option.setName('channel').setDescription('Kênh tạm biệt').setRequired(true))
    .addStringOption(option => option.setName('message').setDescription('Nội dung tạm biệt').setRequired(true))
    .addStringOption(option => option.setName('gif').setDescription('Link GIF').setRequired(true)),
  new SlashCommandBuilder()
    .setName('setboost')
    .setDescription('Thiết lập thông báo boost server')
    .addChannelOption(option => option.setName('channel').setDescription('Kênh thông báo boost').setRequired(true))
    .addStringOption(option => option.setName('message').setDescription('Nội dung thông báo').setRequired(true))
    .addStringOption(option => option.setName('gif').setDescription('Link GIF').setRequired(true)),
  new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Đặt trạng thái AFK')
    .addStringOption(option => option.setName('reason').setDescription('Lý do AFK').setRequired(true)),
  new SlashCommandBuilder()
    .setName('license')
    .setDescription('khoa')
    .addStringOption(option => option.setName('key').setDescription('Key bản quyền').setRequired(true)),
  new SlashCommandBuilder()
    .setName('setscid')
    .setDescription('Cập nhật SoundCloud Client ID mới để sửa lỗi 401 Unauthorized khi nghe nhạc')
    .addStringOption(option => option.setName('client_id').setDescription('Client ID lấy từ F12 Network trên soundcloud.com').setRequired(true)),
  new SlashCommandBuilder()
    .setName('scstatus')
    .setDescription('Kiểm tra trạng thái kết nối tới SoundCloud API (Kiểm tra lỗi 401)'),
];

client.on('ready', async () => {
  isBotRunning = true;
  loginError = '';
  console.log(`Bot logged in as ${client.user?.tag}!`);
  applyRpcToBot(client);
  startRpcRotation(client);

  // Đăng ký Slash Commands toàn cầu và theo từng Guild
  try {
    const commandsJson = registeredSlashCommands.map((c) => c.toJSON());
    if (client.application) {
      await client.application.commands.set(commandsJson);
      console.log('✅ Đã đăng ký Slash Commands (/roblox, /ban, /kick, /timeout) toàn cầu!');
    }
    for (const [, guild] of client.guilds.cache) {
      await guild.commands.set(commandsJson).catch(() => {});
    }
  } catch (err) {
    console.warn('Lỗi khi đăng ký Slash Commands:', err);
  }
});

// Đăng ký Slash Command ngay khi bot được mời vào server mới
client.on('guildCreate', async (guild) => {
  try {
    const commandsJson = registeredSlashCommands.map((c) => c.toJSON());
    await guild.commands.set(commandsJson);
  } catch (err) {
    console.warn(`Không thể đăng ký Slash Command cho guild ${guild.id}:`, err);
  }
});

// Xử lý Slash Command & Button Interactions
client.on('interactionCreate', async (interaction) => {
  // 1. Xử lý các nút bấm (Button Interactions) cho hệ thống Ticket
  if (interaction.isButton()) {
    try {
      if (interaction.customId === 'btn_create_ticket') {
        await handleCreateTicketButton(interaction);
        return;
      }
      if (interaction.customId === 'btn_close_ticket') {
        await handleCloseTicketButton(interaction);
        return;
      }
      if (interaction.customId === 'btn_confirm_close') {
        await handleConfirmClose(interaction);
        return;
      }
      if (interaction.customId === 'btn_cancel_close') {
        await (interaction as any).message?.delete().catch(() => {});
        await interaction.reply({ content: 'Đã hủy thao tác đóng ticket.', ephemeral: true }).catch(() => {});
        return;
      }
      if (interaction.customId === 'btn_ping_admin') {
        await handlePingAdmin(interaction);
        return;
      }
    } catch (btnErr) {
      console.error('Lỗi khi xử lý nút bấm tương tác:', btnErr);
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'setwelcome') {
      const channel = interaction.options.getChannel('channel', true) as TextChannel;
      const message = interaction.options.getString('message', true);
      const gif = interaction.options.getString('gif', true);
      setWelcome(interaction.guildId!, channel.id, message, gif);
      await interaction.reply({ content: '✅ Đã thiết lập Welcome!', ephemeral: true });
      return;
  }
  if (commandName === 'setgoodbye') {
      const channel = interaction.options.getChannel('channel', true) as TextChannel;
      const message = interaction.options.getString('message', true);
      const gif = interaction.options.getString('gif', true);
      setGoodbye(interaction.guildId!, channel.id, message, gif);
      await interaction.reply({ content: '✅ Đã thiết lập Goodbye!', ephemeral: true });
      return;
  }
  if (commandName === 'setboost') {
      const channel = interaction.options.getChannel('channel', true) as TextChannel;
      const message = interaction.options.getString('message', true);
      const gif = interaction.options.getString('gif', true);
      setBoost(interaction.guildId!, channel.id, message, gif);
      await interaction.reply({ content: '✅ Đã thiết lập Boost!', ephemeral: true });
      return;
  }
  if (commandName === 'afk') {
      const reason = interaction.options.getString('reason', true);
      setAfk(interaction.user.id, reason);
      await interaction.reply({ content: `✅ Bạn đã được đặt trạng thái AFK với lý do: ${reason}`, ephemeral: true });
      return;
  }
  if (commandName === 'license') {
      const key = interaction.options.getString('key', true);
      if (key === '1234567a') {
          authorizedGuilds.add(interaction.guildId!);
          await interaction.reply({ content: '✅ Đã kích hoạt bản quyền cho server này!', ephemeral: true });
      } else {
          await interaction.reply({ content: '❌ Key không hợp lệ!', ephemeral: true });
      }
      return;
  }

  if (commandName === 'setscid') {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild) && !interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
      await interaction.reply({ content: '❌ Bạn cần quyền **Quản lý Server** hoặc **Quản trị viên** để cập nhật Client ID!', ephemeral: true });
      return;
    }
    const newId = interaction.options.getString('client_id', true);
    await interaction.deferReply({ ephemeral: true });
    const res = await setSoundCloudClientId(newId);
    if (res.success) {
      await interaction.editReply(`✅ **Đã cập nhật SoundCloud Client ID thành công!**\n• Trạng thái API: \`200 OK\` (${res.latencyMs}ms)\n• Giờ bạn có thể dùng lệnh \`.play\` để nghe nhạc bình thường.`);
    } else {
      await interaction.editReply(`⚠️ **Client ID đã được lưu nhưng SoundCloud phản hồi HTTP ${res.status || 'Error'}:**\n• Có thể ID này không hợp lệ hoặc đã hết hạn.\n• Bạn có thể lấy lại ID mới từ tab Network (F12) trên trang [SoundCloud](https://soundcloud.com).`);
    }
    return;
  }

  if (commandName === 'scstatus') {
    await interaction.deferReply();
    const currentId = getSoundCloudClientId();
    const res = await validateSoundCloudId(currentId);
    const maskedId = currentId.length > 8 ? `${currentId.slice(0, 4)}••••••••${currentId.slice(-4)}` : currentId;

    const embed = new EmbedBuilder()
      .setTitle('📻 Trạng Thái Kết Nối SoundCloud API')
      .setColor(res.valid ? '#23A559' : '#ED4245')
      .addFields(
        { name: '🔑 Client ID Hiện Tại', value: `\`${maskedId}\``, inline: true },
        { name: '📡 Trạng thái HTTP', value: res.valid ? `\`200 OK\` ✅` : `\`${res.status || '401 Unauthorized'}\` ❌`, inline: true },
        { name: '⏱️ Độ trễ (Ping)', value: `\`${res.latencyMs}ms\``, inline: true },
        { name: '💡 Tình trạng', value: res.valid ? 'Hoạt động bình thường. Đã sẵn sàng phát nhạc!' : 'Client ID hiện tại đã hết hạn hoặc bị SoundCloud chặn (401 Unauthorized). Dùng lệnh `/setscid` để cập nhật ID mới.' }
      )
      .setFooter({ text: 'Dùng /setscid <id> để cập nhật key mới' });

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (commandName === 'roblox') {
    const username = interaction.options.getString('username', true);
    await interaction.deferReply();
    try {
      const profile = await fetchRobloxUser(username);
      const { embed, row } = buildRobloxDiscordEmbed(profile);
      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (err: any) {
      await interaction.editReply({
        content: `❌ **Không thể tra cứu tài khoản Roblox:** ${err.message || 'Lỗi không xác định'}`,
      });
    }
    return;
  }

  // --- Slash Command: /ban ---
  if (commandName === 'ban') {
    await interaction.deferReply();
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'Không có lý do cụ thể';
    const botMember = interaction.guild?.members.me;

    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.BanMembers)) {
      await interaction.editReply('❌ Bạn không có quyền **Ban Members (Cấm Thành Viên)** để thực hiện thao tác này!');
      return;
    }

    if (!botMember?.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      await interaction.editReply(
        '❌ **Bot thiếu quyền:** Bot chưa được cấp quyền **Ban Members (Cấm Thành Viên)**!\n👉 **Cách sửa:** Vào **Server Settings > Roles**, cấp quyền "Ban Members" hoặc "Administrator" cho vai trò của Bot.'
      );
      return;
    }

    if (user.id === interaction.user.id) {
      await interaction.editReply('❌ Bạn không thể tự ban chính mình!');
      return;
    }
    if (user.id === client.user?.id) {
      await interaction.editReply('❌ Không thể dùng Bot để tự ban Bot!');
      return;
    }
    if (user.id === interaction.guild?.ownerId) {
      await interaction.editReply('❌ Không thể ban **Chủ Server (Server Owner)**!');
      return;
    }

    const member = interaction.guild?.members.cache.get(user.id) || await interaction.guild?.members.fetch(user.id).catch(() => null);

    if (member) {
      const callerMember = interaction.member as any;
      if (interaction.guild?.ownerId !== interaction.user.id && callerMember?.roles?.highest?.position <= member.roles.highest.position) {
        await interaction.editReply(`❌ Bạn không thể ban **${user.tag}** vì vai trò của họ cao hơn hoặc ngang bằng vai trò của bạn!`);
        return;
      }

      if (!member.bannable || botMember.roles.highest.position <= member.roles.highest.position) {
        await interaction.editReply(
          `❌ **Lỗi thứ bậc vai trò (Role Hierarchy):** Bot không thể ban **${user.tag}** vì vai trò của họ cao hơn hoặc ngang bằng vai trò cao nhất của Bot!\n👉 **Cách sửa:** Vào **Server Settings > Roles**, kéo vai trò của **${client.user?.username || 'Bot'}** lên cao hơn vai trò của người cần ban.`
        );
        return;
      }

      try {
        await member.ban({ reason: `${reason} (Ban bởi ${interaction.user.tag})` });
        await interaction.editReply(`🔨 Đã cấm (ban) thành viên **${user.tag}** khỏi máy chủ thành công!\n📝 Lý do: *${reason}*`);
      } catch (err: any) {
        await interaction.editReply(`❌ Không thể ban: ${err.message || 'Lỗi phân quyền Discord'}`);
      }
    } else {
      try {
        await interaction.guild?.bans.create(user.id, { reason: `${reason} (Ban bởi ${interaction.user.tag})` });
        await interaction.editReply(`🔨 Đã cấm (ban) người dùng có ID \`${user.id}\` khỏi máy chủ thành công!\n📝 Lý do: *${reason}*`);
      } catch (err: any) {
        await interaction.editReply(`❌ Không thể ban: ${err.message || 'Lỗi phân quyền Discord'}`);
      }
    }
    return;
  }

  // --- Slash Command: /kick ---
  if (commandName === 'kick') {
    await interaction.deferReply();
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'Không có lý do cụ thể';
    const botMember = interaction.guild?.members.me;

    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.KickMembers)) {
      await interaction.editReply('❌ Bạn không có quyền **Kick Members (Đuổi Thành Viên)**!');
      return;
    }

    if (!botMember?.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      await interaction.editReply('❌ **Bot thiếu quyền:** Bot chưa được cấp quyền **Kick Members (Đuổi Thành Viên)**!');
      return;
    }

    if (user.id === interaction.user.id) {
      await interaction.editReply('❌ Bạn không thể tự kick chính mình!');
      return;
    }
    if (user.id === interaction.guild?.ownerId) {
      await interaction.editReply('❌ Không thể kick **Chủ Server (Server Owner)**!');
      return;
    }

    const member = interaction.guild?.members.cache.get(user.id) || await interaction.guild?.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.editReply('❌ Không tìm thấy thành viên này trong server!');
      return;
    }

    const callerMember = interaction.member as any;
    if (interaction.guild?.ownerId !== interaction.user.id && callerMember?.roles?.highest?.position <= member.roles.highest.position) {
      await interaction.editReply(`❌ Bạn không thể kick **${user.tag}** vì vai trò của họ cao hơn hoặc ngang bằng bạn!`);
      return;
    }

    if (!member.kickable || botMember.roles.highest.position <= member.roles.highest.position) {
      await interaction.editReply(
        `❌ **Lỗi thứ bậc vai trò (Role Hierarchy):** Bot không thể kick **${user.tag}** vì vai trò của họ cao hơn hoặc ngang bằng Bot!\n👉 **Cách sửa:** Vào **Server Settings > Roles**, kéo vai trò của **${client.user?.username || 'Bot'}** lên cao hơn người đó.`
      );
      return;
    }

    try {
      await member.kick(`${reason} (Kick bởi ${interaction.user.tag})`);
      await interaction.editReply(`👢 Đã kick thành viên **${user.tag}** khỏi máy chủ!\n📝 Lý do: *${reason}*`);
    } catch (err: any) {
      await interaction.editReply(`❌ Không thể kick: ${err.message || 'Lỗi phân quyền'}`);
    }
    return;
  }

  // --- Slash Command: /timeout ---
  if (commandName === 'timeout') {
    await interaction.deferReply();
    const user = interaction.options.getUser('user', true);
    const minutes = interaction.options.getInteger('minutes', true);
    const reason = interaction.options.getString('reason') || 'Không có lý do cụ thể';
    const botMember = interaction.guild?.members.me;

    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ModerateMembers)) {
      await interaction.editReply('❌ Bạn không có quyền **Timeout / Moderate Members**!');
      return;
    }

    if (!botMember?.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      await interaction.editReply('❌ **Bot thiếu quyền:** Bot chưa được cấp quyền **Timeout / Quản lý Thành Viên**!');
      return;
    }

    if (user.id === interaction.user.id) {
      await interaction.editReply('❌ Bạn không thể tự timeout chính mình!');
      return;
    }
    if (user.id === interaction.guild?.ownerId) {
      await interaction.editReply('❌ Không thể timeout **Chủ Server**!');
      return;
    }

    const member = interaction.guild?.members.cache.get(user.id) || await interaction.guild?.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.editReply('❌ Không tìm thấy thành viên này trong server!');
      return;
    }

    if (!member.moderatable || botMember.roles.highest.position <= member.roles.highest.position) {
      await interaction.editReply(
        `❌ **Lỗi thứ bậc vai trò (Role Hierarchy):** Bot không thể timeout **${user.tag}** vì vai trò của họ cao hơn hoặc ngang bằng Bot!\n👉 **Cách sửa:** Kéo vai trò của Bot lên cao hơn người đó trong **Server Settings > Roles**.`
      );
      return;
    }

    try {
      const ms = minutes * 60 * 1000;
      await member.timeout(ms, `${reason} (Timeout bởi ${interaction.user.tag})`);
      await interaction.editReply(`🔇 Đã timeout **${user.tag}** trong **${minutes} phút**!\n📝 Lý do: *${reason}*`);
    } catch (err: any) {
      await interaction.editReply(`❌ Không thể timeout: ${err.message || 'Lỗi phân quyền'}`);
    }
    return;
  }

  // --- Slash Command: /ticket ---
  if (commandName === 'ticket') {
    const subCommand = interaction.options.getSubcommand();

    if (subCommand === 'setimage') {
      if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
        await interaction.reply({ content: '❌ Bạn cần quyền **Manage Server (Quản lý Máy chủ)** để cài đặt ảnh Bảng Ticket!', ephemeral: true });
        return;
      }

      const fileAttachment = interaction.options.getAttachment('file');
      const urlParam = interaction.options.getString('url');
      const finalUrl = fileAttachment?.url || urlParam;

      if (!finalUrl) {
        await interaction.reply({
          content: '⚠️ Vui lòng cung cấp link URL ảnh (`url`) hoặc đính kèm file ảnh (`file`)!',
          ephemeral: true,
        });
        return;
      }

      setTicketImage(finalUrl);
      const previewEmbed = new EmbedBuilder()
        .setTitle('✅ Đã Cập Nhật Ảnh Banner Cho Ticket')
        .setDescription(`Ảnh banner mới đã được lưu thành công!\nMọi Bảng Ticket gửi sau này sẽ tự động gắn ảnh này.\n\n🔗 Link ảnh: [Xem ảnh gốc](${finalUrl})\n💡 Gõ \`/ticket setup\` hoặc \`.ticket setup\` để đăng Bảng Ticket mới.`)
        .setColor('#5865F2')
        .setImage(finalUrl)
        .setTimestamp();

      await interaction.reply({ embeds: [previewEmbed], ephemeral: true });
      return;
    }

    if (subCommand === 'setup') {
      if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
        await interaction.reply({ content: '❌ Bạn cần quyền **Manage Server (Quản lý Máy chủ)** để thiết lập Bảng Ticket!', ephemeral: true });
        return;
      }

      const targetChannel = (interaction.options.getChannel('channel') as any) || interaction.channel;
      if (!targetChannel || !targetChannel.isTextBased()) {
        await interaction.reply({ content: '❌ Kênh được chọn không hợp lệ hoặc không phải kênh chat văn bản!', ephemeral: true });
        return;
      }

      const fileAttachment = interaction.options.getAttachment('attachment');
      const imageParam = fileAttachment?.url || interaction.options.getString('image');
      const titleParam = interaction.options.getString('title');
      const descParam = interaction.options.getString('description');
      const colorParam = interaction.options.getString('color');

      if (imageParam || titleParam || descParam || colorParam) {
        updateTicketConfig({
          ...(imageParam ? { panelImageUrl: imageParam } : {}),
          ...(titleParam ? { panelTitle: titleParam } : {}),
          ...(descParam ? { panelDescription: descParam } : {}),
          ...(colorParam ? { panelColor: colorParam } : {}),
        });
      }

      const { embed, row } = buildTicketPanel();
      try {
        await targetChannel.send({ embeds: [embed], components: [row] });
        await interaction.reply({
          content: `✅ Đã gửi Bảng Tạo Ticket thành công vào kênh <#${targetChannel.id}>!${imageParam ? '\n🖼️ Đã gắn ảnh banner vào Embed.' : ''}`,
          ephemeral: true,
        });
      } catch (err: any) {
        await interaction.reply({ content: `❌ Không thể gửi panel vào kênh: ${err.message}`, ephemeral: true });
      }
      return;
    }

    if (subCommand === 'close') {
      if (!interaction.channel?.name?.startsWith('ticket-')) {
        await interaction.reply({ content: '⚠️ Lệnh này chỉ hoạt động bên trong kênh Ticket!', ephemeral: true });
        return;
      }
      await handleCloseTicketButton(interaction as any);
      return;
    }
  }

  // --- Slash Command: /embed ---
  if (commandName === 'embed') {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageMessages)) {
      await interaction.reply({ content: '❌ Bạn cần quyền **Manage Messages** để gửi tin nhắn Embed!', ephemeral: true });
      return;
    }
    const description = interaction.options.getString('description', true);
    const title = interaction.options.getString('title') || undefined;
    const color = interaction.options.getString('color') || '#5865F2';
    
    // Hỗ trợ cả file ảnh upload đính kèm lẫn link ảnh URL
    const fileAttachment = interaction.options.getAttachment('attachment');
    const imageUrl = fileAttachment?.url || interaction.options.getString('image') || undefined;

    const thumbFile = interaction.options.getAttachment('thumbnail_file');
    const thumbnailUrl = thumbFile?.url || interaction.options.getString('thumbnail') || undefined;

    const targetChannel = (interaction.options.getChannel('channel') as any) || interaction.channel;

    if (!targetChannel || !targetChannel.isTextBased()) {
      await interaction.reply({ content: '❌ Kênh không hợp lệ hoặc không thể gửi tin nhắn!', ephemeral: true });
      return;
    }

    try {
      const customEmbed = buildCustomEmbed({
        title,
        description,
        color,
        imageUrl,
        thumbnailUrl,
        footerText: `Gửi bởi ${interaction.user.tag} • SentinelBot Embed`,
      });
      await targetChannel.send({ embeds: [customEmbed] });
      await interaction.reply({
        content: `✅ Đã tạo và gửi Embed thành công vào kênh <#${targetChannel.id}>!${imageUrl ? '\n🖼️ Đã gắn kèm ảnh vào Embed.' : ''}`,
        ephemeral: true,
      });
    } catch (err: any) {
      await interaction.reply({ content: `❌ Lỗi khi gửi Embed: ${err.message}`, ephemeral: true });
    }
    return;
  }

  // --- Slash Command: /tiktok ---
  if (commandName === 'tiktok') {
    const url = interaction.options.getString('url', true);
    const validUrl = extractFirstTikTokUrl(url);
    if (!validUrl) {
      await interaction.reply({
        content: '❌ Liên kết không đúng định dạng TikTok! Vui lòng dùng link dạng `https://vt.tiktok.com/...` hoặc `https://www.tiktok.com/...`',
        ephemeral: true,
      });
      return;
    }

    try {
      await processTikTokLink(interaction, validUrl);
    } catch (err: any) {
      console.error('[TikTok Slash Error]:', err);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(`❌ Lỗi xử lý video TikTok: ${err.message || 'Không thể tải video'}`);
      } else {
        await interaction.reply({ content: `❌ Lỗi: ${err.message}`, ephemeral: true });
      }
    }
    return;
  }

  // --- Slash Command: /whois & /userinfo ---
  if (commandName === 'whois' || commandName === 'userinfo') {
    await interaction.deferReply();
    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const fullUser = await client.users.fetch(targetUser.id, { force: true });
      const targetMember = interaction.guild ? await interaction.guild.members.fetch(targetUser.id).catch(() => null) : null;
      const { embed, row } = buildWhoisEmbed(targetMember, fullUser);
      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (err: any) {
      await interaction.editReply(`❌ Không thể tra cứu thông tin người dùng: ${err.message || 'Lỗi không xác định'}`);
    }
    return;
  }

  // --- Slash Command: /avatar ---
  if (commandName === 'avatar') {
    await interaction.deferReply();
    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const fullUser = await client.users.fetch(targetUser.id, { force: true });
      const targetMember = interaction.guild ? await interaction.guild.members.fetch(targetUser.id).catch(() => null) : null;
      const { embed, row } = buildAvatarEmbed(targetMember, fullUser);
      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (err: any) {
      await interaction.editReply(`❌ Không thể tải avatar: ${err.message || 'Lỗi không xác định'}`);
    }
    return;
  }

  // --- Slash Command: /banner ---
  if (commandName === 'banner') {
    await interaction.deferReply();
    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const fullUser = await client.users.fetch(targetUser.id, { force: true });
      const targetMember = interaction.guild ? await interaction.guild.members.fetch(targetUser.id).catch(() => null) : null;
      const { embed, row } = buildBannerEmbed(fullUser, targetMember);
      await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (err: any) {
      await interaction.editReply(`❌ Không thể tải banner: ${err.message || 'Lỗi không xác định'}`);
    }
    return;
  }
});

// Store deleted messages for !snipe
client.on('messageDelete', (message) => {
  if (message.partial || message.author?.bot) return;
  snipes.set(message.channel.id, {
    content: message.content || '[Không có nội dung văn bản (có thể là ảnh/file)]',
    author: message.author.tag,
    timestamp: Date.now(),
  });
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // --- AFK System ---
  if (getAfk(message.author.id)) {
      removeAfk(message.author.id);
      await message.reply('👋 Chào mừng bạn đã trở lại! Trạng thái AFK đã được xóa.');
  }

  message.mentions.users.forEach(async (user) => {
      const afkData = getAfk(user.id);
      if (afkData && user.id !== message.author.id) {
          const embed = new EmbedBuilder()
              .setTitle('💤 Người dùng đang AFK')
              .setDescription(`**${user.tag}** hiện đang treo máy.\n\n**Lý do:** ${afkData.reason}`)
              .setColor(0x2f3136)
              .setFooter({ text: `AFK từ: ${new Date(afkData.timestamp).toLocaleString()}` });
          
          await message.reply({ embeds: [embed] });
      }
  });

  // --- Auto-Delete Users Logic ---
  if (message.guild && autoDeleteMap.has(message.guild.id)) {
    const guildWatchList = autoDeleteMap.get(message.guild.id)!;
    if (guildWatchList.has(message.author.id)) {
      await message.delete().catch(() => {});
      return; // Already deleted, no further processing needed
    }
  }

  // --- Anti-Spam Logic ---
  if (message.guild && antiSpamEnabled.has(message.guild.id)) {
    const userId = message.author.id;
    if (!userMessageCount.has(userId)) {
      userMessageCount.set(userId, {
        count: 1,
        timer: setTimeout(() => userMessageCount.delete(userId), 5000), // Reset sau 5s
      });
    } else {
      const userData = userMessageCount.get(userId)!;
      userData.count++;
      if (userData.count > 5) {
        // Spam detected
        await message.delete().catch(() => {});
        const warnMsg = await message.channel.send(`${message.author}, vui lòng không spam!`).catch(() => null);
        if (warnMsg) setTimeout(() => warnMsg.delete().catch(() => {}), 3000);
        return;
      }
    }

    // Anti-link simple (block http/https if not admin)
    if (message.content.match(/(https?:\/\/[^\s]+)/g)) {
      if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
         await message.delete().catch(() => {});
         const warnMsg = await message.channel.send(`${message.author}, bạn không được gửi link ở đây!`).catch(() => null);
         if (warnMsg) setTimeout(() => warnMsg.delete().catch(() => {}), 3000);
         return;
      }
    }
  }

  // --- Webhook Mimicry Logic ---
  if (activeWebhooks.has(message.channel.id)) {
    const webhookUrl = activeWebhooks.get(message.channel.id)!;
    const webhookClient = new WebhookClient({ url: webhookUrl });
    try {
      await webhookClient.send({
        content: message.content || '*(tin nhắn không có nội dung văn bản)*',
        username: message.member?.displayName || message.author.username,
        avatarURL: message.author.displayAvatarURL(),
        files: Array.from(message.attachments.values()).map(a => a.url),
      });
    } catch (err) {
      console.error('[Webhook Mimicry Error]:', err);
    }
  }

  // --- Command & Mention Handling ---
  const prefix = message.guild ? (guildPrefixes.get(message.guild.id) || '.') : '.';

  // --- Tự động nhận diện link TikTok (Auto-detect TikTok Links) ---
  if (!message.content.startsWith(prefix) && isTikTokAutoEmbedEnabled(message.guild?.id)) {
    const tiktokUrl = extractFirstTikTokUrl(message.content);
    if (tiktokUrl) {
      try {
        await processTikTokLink(message, tiktokUrl, { isAutoDetect: true });
      } catch (err: any) {
        console.error('[TikTok Auto-Embed Error]:', err);
      }
      return;
    }
  }

  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  if (!command) return;

  try {
    // Kiểm tra bản quyền
    if (command !== 'license' && !authorizedGuilds.has(message.guild!.id)) {
        return;
    }
    
    switch (command) {
      case 'help': {
        const embed = new EmbedBuilder()
          .setTitle('🛡️ SentinelBot - Danh Sách Lệnh')
          .setColor('#2b2d31')
          .setDescription(`Prefix hiện tại của server này là: \`${prefix}\``)
          .addFields(
            { name: '🚨 HỆ THỐNG ANTI-RAID & PHÒNG CHỐNG NUKE', value: `\`${prefix}antiraid <on/off/config>\`, \`${prefix}antiraid limit <loại> <số>\`, \`${prefix}whitelist @user\`, \`${prefix}delwhitelist @user\`, \`${prefix}whitelisted\`, \`${prefix}lockdown <on/off>\`, \`${prefix}clearuser @user\`, \`${prefix}raidlogs\`` },
            { name: '🤖 CHAT AI CỌC TÍNH (GEMINI 3.8)', value: `\`${prefix}chat <câu hỏi>\`, \`${prefix}ai <nội dung>\`, hoặc tag trực tiếp \`@SentinelBot\` (Cà khịa cực gắt nếu hỏi ngu 🤣💀🤡🖕)` },
            { name: '📱 TẢI & NHẬN DIỆN TIKTOK (NO WATERMARK)', value: `\`${prefix}tiktok <link>\`, \`${prefix}tt <link>\`, \`${prefix}tiktok auto <on/off>\`, hoặc Lệnh Slash: \`/tiktok url: <link>\` (Tự động xóa tin nhắn link gốc & gửi video không logo, nhạc nền MP3 kèm tag người gửi)` },
            { name: '🎯 BẢO MẬT & QUẢN TRỊ', value: `\`${prefix}clean <số|bot|@user|links>\`, \`${prefix}snipe\`, \`${prefix}lock\`, \`${prefix}unlock\`, \`${prefix}slowmode <giây>\`, \`${prefix}kick @user\`, \`${prefix}ban @user\`, \`${prefix}timeout @user <phút>\`, \`${prefix}antinuke <on/off>\`, \`${prefix}antispam <on/off>\`, \`${prefix}scanweb <url>\`, \`${prefix}scanfile\`, \`${prefix}prefix <ký tự mới>\`` },
            { name: '🎮 RICH PRESENCE (RPC)', value: `\`${prefix}rpc <playing/watching/listening/streaming/competing> <tên>\`, \`${prefix}rpc status <online/idle/dnd>\`, \`${prefix}rpc rotate <on/off>\`, \`${prefix}rpc info\`` },
            { name: '👤 THÔNG TIN & HỒ SƠ NGƯỜI DÙNG', value: `\`${prefix}w [@user|ID]\`, \`${prefix}whois\`, \`${prefix}avt [@user|ID]\`, \`${prefix}banner [@user|ID]\` (Xem hồ sơ tài khoản, ngày tạo acc, ngày join server, badges, vai trò, quyền hạn, avatar full HD & banner)` },
            { name: '🔗 AUTO CHAT (WEBHOOK)', value: `\`${prefix}autochat on [link_webhook]\` (Bật, nếu ko nhập link bot sẽ tự tạo), \`${prefix}autochat off\` (Tắt nội bộ), \`${prefix}autochat clear\` (Xóa toàn bộ webhook trong kênh)` },
            { name: '🧱 TRA CỨU TÀI KHOẢN ROBLOX', value: `\`${prefix}roblox <username/ID>\`, \`${prefix}rbx <tên>\`, hoặc Lệnh Slash: \`/roblox username: <tên>\` (Xem avatar, ngày join, tuổi acc, link profile)` },
            { name: '🎉 GIẢI TRÍ & THẦN SỐ HỌC', value: `\`${prefix}ghepdoi @crush\`, \`${prefix}ghepdoi @user1 @user2\`, \`${prefix}gay [@user]\`` },
            { name: '🎵 ÂM NHẠC & VOICE', value: `\`${prefix}play <tên/link>\`, \`${prefix}skip\`, \`${prefix}stop\`, \`${prefix}pause\`, \`${prefix}resume\`, \`${prefix}volume <1-150>\`, \`${prefix}queue\`, \`${prefix}nowplaying\`` }
          )
          .setFooter({ text: 'SentinelBot • Powered by Gemini 3.8 Flash' });
        await message.reply({ embeds: [embed] });
        break;
      }

      case 'prefix': {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
           await message.reply('Bạn cần quyền Quản trị viên (Administrator) để đổi prefix!');
           return;
        }
        const newPrefix = args[0];
        if (!newPrefix || newPrefix.length > 3) {
           await message.reply(`Vui lòng nhập prefix mới (tối đa 3 ký tự). Ví dụ: \`${prefix}prefix ?\``);
           return;
        }
        guildPrefixes.set(message.guild!.id, newPrefix);
        await message.reply(`✅ Đã đổi prefix của server này thành \`${newPrefix}\``);
        break;
      }

      case 'ping': {
        await message.reply(`🏓 Pong! \`${client.ws.ping}ms\``);
        break;
      }

      case 'backup': {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
            await message.reply('❌ Chỉ Admin mới có quyền backup dữ liệu!');
            return;
        }
        const result = backupData();
        await message.reply(result);
        break;
      }

      case 'backup_sv': {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
            await message.reply('❌ Chỉ Admin mới có quyền backup server!');
            return;
        }
        await message.reply('⏳ Đang sao lưu cấu trúc server...');
        const result = await captureServerBackup(message.guild!);
        await message.reply(result);
        break;
      }

      case 'snipe': {
        const snipedMessage = snipes.get(message.channel.id);
        if (!snipedMessage) {
          await message.reply('Không có tin nhắn nào vừa bị xóa trong kênh này!');
          return;
        }
        
        try {
          await message.author.send(`🕵️ **Tin nhắn bị xóa bởi ${snipedMessage.author}** trong <#${message.channel.id}>:\n\`\`\`${snipedMessage.content}\`\`\``);
          const reply = await message.reply('Đã gửi tin nhắn bị xóa vào DM của bạn!');
          setTimeout(() => reply.delete().catch(() => {}), 5000);
        } catch (e) {
          await message.reply('Không thể gửi DM cho bạn. Hãy mở khóa tin nhắn riêng tư!');
        }
        break;
      }

      case 'clearusers':
      case 'clearuser':
      case 'cleanusers': {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
          await message.reply('❌ Bạn không có quyền quản lý tin nhắn (Manage Messages)!');
          return;
        }

        const mentionedUsers = message.mentions.users;
        if (mentionedUsers.size === 0) {
            await message.reply(`Cách dùng: \`${prefix}clearusers @user1 @user2 ...\``);
            return;
        }

        await message.delete().catch(() => {});
        
        const limit = 100; // Fetch limit
        const fetched = await message.channel.messages.fetch({ limit });
        const targetIds = new Set(mentionedUsers.map(u => u.id));
        const messagesToDelete = fetched.filter(m => targetIds.has(m.author.id));
        
        if (messagesToDelete.size === 0) {
            const reply = await message.channel.send('🧹 Không tìm thấy tin nhắn nào của những người dùng đã chọn trong 100 tin nhắn gần đây.');
            setTimeout(() => reply.delete().catch(() => {}), 3500);
            return;
        }

        const deleted = await (message.channel as any).bulkDelete(messagesToDelete, true);
        const reply = await message.channel.send(`🧹 Đã dọn dẹp **${deleted.size}** tin nhắn từ các người dùng đã chọn.`);
        setTimeout(() => reply.delete().catch(() => {}), 4000);
        return;
      }

      case 'watch':
      case 'watchuser': {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
          await message.reply('❌ Bạn không có quyền quản lý tin nhắn!');
          return;
        }
        const user = message.mentions.users.first();
        if (!user) {
          await message.reply(`Cách dùng: \`${prefix}watch @user\``);
          return;
        }
        if (!autoDeleteMap.has(message.guild!.id)) {
          autoDeleteMap.set(message.guild!.id, new Set());
        }
        autoDeleteMap.get(message.guild!.id)!.add(user.id);
        await message.reply(`✅ Đã thêm **${user.tag}** vào danh sách auto-delete. Tin nhắn của họ sẽ bị xóa ngay lập tức!`);
        break;
      }

      case 'unwatch':
      case 'unwatchuser': {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
          await message.reply('❌ Bạn không có quyền quản lý tin nhắn!');
          return;
        }
        const user = message.mentions.users.first();
        if (!user || !autoDeleteMap.has(message.guild!.id) || !autoDeleteMap.get(message.guild!.id)!.has(user.id)) {
          await message.reply(`Cách dùng: \`${prefix}unwatch @user\` (phải là người đang bị watch)`);
          return;
        }
        autoDeleteMap.get(message.guild!.id)!.delete(user.id);
        await message.reply(`✅ Đã gỡ **${user.tag}** khỏi danh sách auto-delete.`);
        break;
      }

      case 'watchlist':
      case 'watchers': {
        if (!autoDeleteMap.has(message.guild!.id) || autoDeleteMap.get(message.guild!.id)!.size === 0) {
            await message.reply('Danh sách watch đang trống.');
            return;
        }
        const ids = Array.from(autoDeleteMap.get(message.guild!.id)!);
        await message.reply(`📋 Danh sách đang bị watch: ${ids.map(id => `<@${id}>`).join(', ')}`);
        break;
      }

      case 'purge':
      case 'clear':
      case 'clean': {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
          await message.reply('❌ Bạn không có quyền quản lý tin nhắn (Manage Messages)!');
          return;
        }

        if (!message.channel.isTextBased() || message.channel.isDMBased() || !('bulkDelete' in message.channel)) {
          await message.reply('❌ Lệnh dọn dẹp chỉ có thể sử dụng trong kênh văn bản server.');
          return;
        }

        // Tự động xóa tin nhắn lệnh nếu có thể để giữ kênh sạch sẽ
        await message.delete().catch(() => {});

        const sub = args[0]?.toLowerCase();

        // 1. .clean bot [số lượng] (Mặc định 50)
        if (sub === 'bot' || sub === 'bots') {
          const limit = Math.min(100, Math.max(1, parseInt(args[1]) || 50));
          const fetched = await message.channel.messages.fetch({ limit });
          const botMessages = fetched.filter(
            (m) => m.author.bot || m.content.startsWith(prefix) || m.content.startsWith('!') || m.content.startsWith('.')
          );
          if (botMessages.size === 0) {
            const reply = await message.channel.send('🧹 Không tìm thấy tin nhắn bot hoặc tin nhắn lệnh nào gần đây.');
            setTimeout(() => reply.delete().catch(() => {}), 3500);
            return;
          }
          const deleted = await (message.channel as any).bulkDelete(botMessages, true);
          const reply = await message.channel.send(`🧹 Đã dọn dẹp **${deleted.size}** tin nhắn từ Bot và Lệnh.`);
          setTimeout(() => reply.delete().catch(() => {}), 4000);
          return;
        }

        // 2. .clean links [số lượng] (Mặc định 50)
        if (sub === 'links' || sub === 'link') {
          const limit = Math.min(100, Math.max(1, parseInt(args[1]) || 50));
          const fetched = await message.channel.messages.fetch({ limit });
          const urlRegex = /(https?:\/\/[^\s]+)|(discord\.(gg|io|me|li)\/[^\s]+)|(discord\.com\/invite\/[^\s]+)/gi;
          const linkMessages = fetched.filter((m) => urlRegex.test(m.content));
          if (linkMessages.size === 0) {
            const reply = await message.channel.send('🧹 Không tìm thấy tin nhắn chứa đường dẫn (link/URL) nào gần đây.');
            setTimeout(() => reply.delete().catch(() => {}), 3500);
            return;
          }
          const deleted = await (message.channel as any).bulkDelete(linkMessages, true);
          const reply = await message.channel.send(`🧹 Đã dọn dẹp **${deleted.size}** tin nhắn chứa liên kết (links).`);
          setTimeout(() => reply.delete().catch(() => {}), 4000);
          return;
        }

        // 3. .clean user @user [số] hoặc .clean @user [số]
        const mentionedUser = message.mentions.users.first();
        if (sub === 'user' || mentionedUser) {
          const target = mentionedUser || (args[1] ? await client.users.fetch(args[1]).catch(() => null) : null);
          if (!target) {
            const reply = await message.channel.send(`Cách dùng: \`${prefix}clean @user [số lượng 1-100]\``);
            setTimeout(() => reply.delete().catch(() => {}), 4000);
            return;
          }
          const amountArg = sub === 'user' ? args[2] : args[1];
          const limit = Math.min(100, Math.max(1, parseInt(amountArg) || 50));
          const fetched = await message.channel.messages.fetch({ limit });
          const userMessages = fetched.filter((m) => m.author.id === target.id);
          if (userMessages.size === 0) {
            const reply = await message.channel.send(`🧹 Không tìm thấy tin nhắn gần đây của **${target.tag}**.`);
            setTimeout(() => reply.delete().catch(() => {}), 3500);
            return;
          }
          const deleted = await (message.channel as any).bulkDelete(userMessages, true);
          const reply = await message.channel.send(`🧹 Đã xóa **${deleted.size}** tin nhắn của **${target.tag}**.`);
          setTimeout(() => reply.delete().catch(() => {}), 4000);
          return;
        }

        // 4. .clean <số lượng 1-100>
        const amount = parseInt(args[0]);
        if (!isNaN(amount) && amount >= 1 && amount <= 100) {
          const deleted = await (message.channel as any).bulkDelete(amount, true);
          const reply = await message.channel.send(`🧹 Đã dọn dẹp nhanh **${deleted.size || amount}** tin nhắn trong kênh.`);
          setTimeout(() => reply.delete().catch(() => {}), 3500);
          return;
        }

        // 5. Hiển thị hướng dẫn khi không có tham số hợp lệ
        const guideEmbed = new EmbedBuilder()
          .setTitle('🧹 Hướng Dẫn Lệnh Dọn Dẹp (Clean)')
          .setColor('#5865F2')
          .setDescription('Công cụ dọn dẹp tin nhắn mạnh mẽ và lọc tin nhắn rác/spam:')
          .addFields(
            { name: `\`${prefix}clean <1-100>\``, value: 'Xóa nhanh số lượng tin nhắn chỉ định trong kênh.' },
            { name: `\`${prefix}clean bot [1-100]\``, value: 'Chỉ xóa tin nhắn do Bot gửi hoặc các tin nhắn gõ lệnh prefix.' },
            { name: `\`${prefix}clean @user [1-100]\``, value: 'Chỉ xóa tin nhắn của một thành viên cụ thể (xử lý spammer/raider).' },
            { name: `\`${prefix}clean links [1-100]\``, value: 'Chỉ xóa các tin nhắn chứa đường dẫn web hoặc Discord Invite.' }
          )
          .setFooter({ text: `Các lệnh tương đương: ${prefix}clean | ${prefix}clear | ${prefix}purge` });

        const reply = await message.channel.send({ embeds: [guideEmbed] });
        setTimeout(() => reply.delete().catch(() => {}), 8000);
        break;
      }

      case 'lock': {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageChannels)) return;
        if (message.channel.isTextBased() && !message.channel.isDMBased()) {
          // @ts-ignore
          await message.channel.permissionOverwrites.edit(message.guild!.roles.everyone, {
            SendMessages: false
          });
          await message.reply('🔒 Kênh đã bị khóa!');
        }
        break;
      }

      case 'unlock': {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageChannels)) return;
        if (message.channel.isTextBased() && !message.channel.isDMBased()) {
          // @ts-ignore
          await message.channel.permissionOverwrites.edit(message.guild!.roles.everyone, {
            SendMessages: null // Reset to default
          });
          await message.reply('🔓 Kênh đã được mở khóa!');
        }
        break;
      }

      case 'slowmode': {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageChannels)) return;
        const seconds = parseInt(args[0]);
        if (isNaN(seconds)) return;
        if (message.channel.isTextBased() && 'setRateLimitPerUser' in message.channel) {
          await message.channel.setRateLimitPerUser(seconds);
          await message.reply(`Đã đặt slowmode thành ${seconds} giây.`);
        }
        break;
      }

      case 'kick': {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.KickMembers)) {
          await message.reply('❌ Bạn không có quyền **Kick Members (Đuổi Thành Viên)** để dùng lệnh này!');
          return;
        }

        const botMember = message.guild?.members.me;
        if (!botMember?.permissions.has(PermissionsBitField.Flags.KickMembers)) {
          await message.reply('❌ **Bot thiếu quyền:** Bot chưa được cấp quyền **Kick Members (Đuổi Thành Viên)**!\n👉 Vào **Cài đặt Server > Roles**, cấp quyền cho vai trò của Bot.');
          return;
        }

        const targetId = message.mentions.members?.first()?.id || (args[0]?.replace(/[<@!>]/g, ''));
        if (!targetId) {
          await message.reply(`⚠️ **Cách dùng:** \`${prefix}kick @user [lý do]\` hoặc \`${prefix}kick <ID_User> [lý do]\``);
          return;
        }

        const target = message.mentions.members?.first() || (await message.guild?.members.fetch(targetId).catch(() => null));
        if (!target) {
          await message.reply('❌ Không tìm thấy thành viên này trong server.');
          return;
        }

        if (target.id === message.author.id) {
          await message.reply('❌ Bạn không thể tự kick chính mình!');
          return;
        }
        if (target.id === message.guild?.ownerId) {
          await message.reply('❌ Không thể kick **Chủ Server (Server Owner)**!');
          return;
        }

        if (message.guild?.ownerId !== message.author.id && message.member.roles.highest.position <= target.roles.highest.position) {
          await message.reply(`❌ Bạn không thể kick **${target.user.tag}** vì vai trò (Role) của họ cao hơn hoặc ngang bằng vai trò của bạn!`);
          return;
        }

        if (!target.kickable || botMember.roles.highest.position <= target.roles.highest.position) {
          await message.reply(
            `❌ **Lỗi thứ bậc vai trò (Role Hierarchy):** Bot không thể kick **${target.user.tag}** vì vai trò của họ cao hơn hoặc ngang bằng Bot!\n👉 **Cách sửa:** Vào **Server Settings > Roles**, kéo vai trò của **${client.user?.username || 'Bot'}** lên cao hơn vai trò của người cần kick.`
          );
          return;
        }

        const reason = args.slice(1).join(' ') || 'Không có lý do cụ thể';
        try {
          await target.kick(`${reason} (Kick bởi ${message.author.tag})`);
          await message.reply(`👢 Đã kick thành viên **${target.user.tag}** khỏi máy chủ!\n📝 Lý do: *${reason}*`);
        } catch (kickErr: any) {
          await message.reply(`❌ Lỗi khi kick: ${kickErr.message || 'Lỗi quyền hạn Discord'}`);
        }
        break;
      }

      case 'ban': {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.BanMembers)) {
          await message.reply('❌ Bạn không có quyền **Ban Members (Cấm Thành Viên)** để dùng lệnh này!');
          return;
        }

        const botMember = message.guild?.members.me;
        if (!botMember?.permissions.has(PermissionsBitField.Flags.BanMembers)) {
          await message.reply(
            '❌ **Bot thiếu quyền:** Bot chưa được cấp quyền **Ban Members (Cấm Thành Viên)**!\n👉 **Cách sửa:** Vào **Server Settings (Cài đặt Máy chủ) > Roles (Vai trò)**, bật quyền **Ban Members** hoặc **Administrator** cho vai trò của Bot.'
          );
          return;
        }

        const targetId = message.mentions.members?.first()?.id || (args[0]?.replace(/[<@!>]/g, ''));
        if (!targetId) {
          await message.reply(`⚠️ **Cách dùng:** \`${prefix}ban @user [lý do]\` hoặc \`${prefix}ban <ID_User> [lý do]\`\n💡 Bạn cũng có thể dùng Slash Command: \`/ban user: @user reason: [lý do]\``);
          return;
        }

        const reason = args.slice(1).join(' ') || 'Không có lý do cụ thể';
        const target = message.mentions.members?.first() || (await message.guild?.members.fetch(targetId).catch(() => null));

        if (target) {
          if (target.id === message.author.id) {
            await message.reply('❌ Bạn không thể tự ban chính mình!');
            return;
          }
          if (target.id === client.user?.id) {
            await message.reply('❌ Không thể dùng Bot để tự ban Bot!');
            return;
          }
          if (target.id === message.guild?.ownerId) {
            await message.reply('❌ Không thể ban **Chủ Server (Server Owner)**!');
            return;
          }

          if (message.guild?.ownerId !== message.author.id && message.member.roles.highest.position <= target.roles.highest.position) {
            await message.reply(`❌ Bạn không thể ban **${target.user.tag}** vì vai trò của họ cao hơn hoặc ngang bằng bạn!`);
            return;
          }

          if (!target.bannable || botMember.roles.highest.position <= target.roles.highest.position) {
            await message.reply(
              `❌ **Lỗi thứ bậc vai trò (Role Hierarchy):** Bot không thể ban **${target.user.tag}** vì vai trò của họ cao hơn hoặc ngang bằng vai trò của Bot!\n👉 **Cách khắc phục:** Vào **Server Settings > Roles**, kéo vai trò của **${client.user?.username || 'Bot'}** lên vị trí cao hơn vai trò của người cần ban.`
            );
            return;
          }

          try {
            await target.ban({ reason: `${reason} (Ban bởi ${message.author.tag})` });
            await message.reply(`🔨 Đã cấm (ban) thành viên **${target.user.tag}** khỏi máy chủ thành công!\n📝 Lý do: *${reason}*`);
          } catch (banErr: any) {
            await message.reply(`❌ Lỗi khi ban: ${banErr.message || 'Lỗi quyền hạn Discord'}`);
          }
        } else {
          // Ban theo User ID (kể cả khi thành viên không có trong server - Hackban)
          try {
            await message.guild?.bans.create(targetId, { reason: `${reason} (Ban bởi ${message.author.tag})` });
            await message.reply(`🔨 Đã cấm (ban) người dùng ID \`${targetId}\` khỏi máy chủ!\n📝 Lý do: *${reason}*`);
          } catch (banErr: any) {
            await message.reply(`❌ Không thể ban ID \`${targetId}\`: ${banErr.message || 'ID không tồn tại hoặc lỗi quyền hạn'}`);
          }
        }
        break;
      }

      case 'timeout':
      case 'mute': {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
          await message.reply('❌ Bạn không có quyền **Timeout / Quản lý Thành Viên (Moderate Members)**!');
          return;
        }

        const botMember = message.guild?.members.me;
        if (!botMember?.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
          await message.reply('❌ **Bot thiếu quyền:** Bot chưa được cấp quyền **Timeout / Moderate Members**!\n👉 Vào **Server Settings > Roles**, cấp quyền cho vai trò của Bot.');
          return;
        }

        const targetId = message.mentions.members?.first()?.id || (args[0]?.replace(/[<@!>]/g, ''));
        const minutes = parseInt(args[1]);
        if (!targetId || isNaN(minutes) || minutes <= 0) {
          await message.reply(`⚠️ **Cách dùng:** \`${prefix}timeout @user <số_phút> [lý do]\` (Ví dụ: \`${prefix}timeout @user 10 Spam chat\`)`);
          return;
        }

        const target = message.mentions.members?.first() || (await message.guild?.members.fetch(targetId).catch(() => null));
        if (!target) {
          await message.reply('❌ Không tìm thấy thành viên này trong server.');
          return;
        }

        if (target.id === message.author.id) {
          await message.reply('❌ Bạn không thể tự timeout chính mình!');
          return;
        }
        if (target.id === message.guild?.ownerId) {
          await message.reply('❌ Không thể timeout **Chủ Server**!');
          return;
        }

        if (!target.moderatable || botMember.roles.highest.position <= target.roles.highest.position) {
          await message.reply(
            `❌ **Lỗi thứ bậc vai trò (Role Hierarchy):** Bot không thể timeout **${target.user.tag}** vì vai trò của họ cao hơn hoặc ngang bằng Bot!\n👉 **Cách khắc phục:** Vào **Server Settings > Roles**, kéo vai trò của **${client.user?.username || 'Bot'}** lên cao hơn người đó.`
          );
          return;
        }

        const reason = args.slice(2).join(' ') || 'Không có lý do cụ thể';
        const ms = minutes * 60 * 1000;
        try {
          await target.timeout(ms, `${reason} (Timeout bởi ${message.author.tag})`);
          await message.reply(`🔇 Đã timeout **${target.user.tag}** trong **${minutes} phút**!\n📝 Lý do: *${reason}*`);
        } catch (toErr: any) {
          await message.reply(`❌ Lỗi khi timeout: ${toErr.message || 'Lỗi quyền hạn Discord'}`);
        }
        break;
      }

      case 'antinuke': {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) return;
        if (args[0] === 'on') {
          antiNukeEnabled.add(message.guild!.id);
          updateAntiRaidConfig({ enabled: true });
          await message.reply('🛡️ Đã BẬT hệ thống Anti-Nuke & Anti-Raid.');
        } else if (args[0] === 'off') {
          antiNukeEnabled.delete(message.guild!.id);
          updateAntiRaidConfig({ enabled: false });
          await message.reply('⚠️ Đã TẮT hệ thống Anti-Nuke & Anti-Raid.');
        } else {
          await message.reply('Dùng lệnh: !antinuke <on/off>');
        }
        break;
      }

      // --- Anti-Raid Commands (Microngamer/anti-raid-1 Port) ---
      case 'antiraid': {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
          await message.reply('❌ Bạn cần quyền Administrator để cấu hình Anti-Raid!');
          return;
        }

        const sub = args[0]?.toLowerCase();
        if (sub === 'on') {
          updateAntiRaidConfig({ enabled: true });
          await message.reply('🚨 **[ANTI-RAID ENGINE]** Đã KÍCH HOẠT hệ thống giám sát và bảo vệ máy chủ thời gian thực! Mọi hành vi tạo/xóa kênh, xóa role, mass ban hoặc bot raid trái phép sẽ bị trừng phạt ngay lập tức.');
          return;
        }

        if (sub === 'off') {
          updateAntiRaidConfig({ enabled: false });
          await message.reply('⚠️ **[ANTI-RAID ENGINE]** Đã TẠM DỪNG bảo vệ Anti-Raid.');
          return;
        }

        if (sub === 'punish') {
          const pun = args[1]?.toLowerCase();
          if (!['ban', 'kick', 'timeout'].includes(pun)) {
            await message.reply(`Dùng: \`${prefix}antiraid punish <ban | kick | timeout>\``);
            return;
          }
          updateAntiRaidConfig({ punishment: pun as any });
          await message.reply(`✅ Đã đổi hình thức xử phạt khi phát hiện Raid sang: **${pun.toUpperCase()}**`);
          return;
        }

        if (sub === 'limit') {
          const opt = args[1]?.toLowerCase();
          const val = parseInt(args[2]);
          if (!opt || isNaN(val) || val < 1) {
            await message.reply(`Cách dùng: \`${prefix}antiraid limit <channelcreate|channeldelete|rolecreate|roledelete|ban|kick|massjoin> <số>\``);
            return;
          }

          const patch: any = {};
          if (opt === 'channelcreate') patch.channelCreateLimit = val;
          else if (opt === 'channeldelete') patch.channelDeleteLimit = val;
          else if (opt === 'rolecreate') patch.roleCreateLimit = val;
          else if (opt === 'roledelete') patch.roleDeleteLimit = val;
          else if (opt === 'ban') patch.banLimit = val;
          else if (opt === 'kick') patch.kickLimit = val;
          else if (opt === 'massjoin') patch.massJoinLimit = val;
          else {
            await message.reply('Tùy chọn không hợp lệ! Chọn: `channelcreate`, `channeldelete`, `rolecreate`, `roledelete`, `ban`, `kick`, `massjoin`');
            return;
          }

          updateAntiRaidConfig(patch);
          await message.reply(`✅ Đã cập nhật giới hạn \`${opt}\` thành: **${val}**`);
          return;
        }

        // Mặc định hoặc 'config': hiển thị bảng trạng thái cấu hình
        const conf = getAntiRaidConfig();
        const embed = new EmbedBuilder()
          .setTitle('🛡️ Cấu Hình Hệ Thống Anti-Raid (Microngamer Port)')
          .setColor(conf.enabled ? '#23A559' : '#ED4245')
          .setDescription(`Trạng thái hiện tại: ${conf.enabled ? '🟢 **ĐANG BẬT BẢO VỆ**' : '🔴 **ĐANG TẮT**'} | Chế độ Lockdown: ${conf.lockdownMode ? '🔒 **KHẨN CẤP**' : '🔓 Bình thường'}`)
          .addFields(
            { name: 'Channel Create Limit', value: `\`${conf.channelCreateLimit}/phút\``, inline: true },
            { name: 'Channel Delete Limit', value: `\`${conf.channelDeleteLimit}/phút\``, inline: true },
            { name: 'Role Create Limit', value: `\`${conf.roleCreateLimit}/phút\``, inline: true },
            { name: 'Role Delete Limit', value: `\`${conf.roleDeleteLimit}/phút\``, inline: true },
            { name: 'Ban Limit (Mass Ban)', value: `\`${conf.banLimit}/phút\``, inline: true },
            { name: 'Kick Limit (Mass Kick)', value: `\`${conf.kickLimit}/phút\``, inline: true },
            { name: 'Mass Join Threshold', value: `\`${conf.massJoinLimit} thành viên / 10s\``, inline: true },
            { name: 'Hình thức xử phạt', value: `\`${conf.punishment.toUpperCase()}\``, inline: true },
            { name: 'Số lượng Whitelist', value: `\`${conf.whitelist.length} người/bot\``, inline: true }
          )
          .setFooter({ text: `Lệnh: ${prefix}antiraid on/off | ${prefix}whitelist @user | ${prefix}lockdown on/off` })
          .setTimestamp();

        await message.reply({ embeds: [embed] });
        break;
      }

      case 'whitelist':
      case 'wl': {
        if (message.author.id !== message.guild?.ownerId && !message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
          await message.reply('❌ Chỉ Chủ Server (Owner) hoặc Admin mới có quyền thêm thành viên vào Whitelist!');
          return;
        }
        const target = message.mentions.members?.first() || message.mentions.users?.first();
        if (!target) {
          await message.reply(`Vui lòng tag người cần whitelist: \`${prefix}whitelist @user\``);
          return;
        }

        const success = addWhitelistUser(
          target.id,
          'user' in target ? (target as any).user.tag : target.tag,
          message.author.tag
        );

        if (success) {
          await message.reply(`✅ Đã thêm **${'user' in target ? (target as any).user.tag : target.tag}** vào Whitelist Anti-Raid (Được miễn trừ kiểm duyệt phá hoại).`);
        } else {
          await message.reply(`⚠️ Đối tượng này đã có trong danh sách Whitelist rồi!`);
        }
        break;
      }

      case 'delwhitelist':
      case 'unwl': {
        if (message.author.id !== message.guild?.ownerId && !message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
          await message.reply('❌ Chỉ Chủ Server (Owner) hoặc Admin mới có quyền xóa khỏi Whitelist!');
          return;
        }
        const target = message.mentions.members?.first() || message.mentions.users?.first();
        const targetId = target ? target.id : args[0];
        if (!targetId) {
          await message.reply(`Vui lòng tag người cần xóa: \`${prefix}delwhitelist @user\``);
          return;
        }

        const removed = removeWhitelistUser(targetId);
        if (removed) {
          await message.reply(`🗑️ Đã xóa ID \`${targetId}\` khỏi danh sách Whitelist.`);
        } else {
          await message.reply(`❌ Không tìm thấy đối tượng này trong Whitelist.`);
        }
        break;
      }

      case 'whitelisted': {
        const conf = getAntiRaidConfig();
        if (conf.whitelist.length === 0) {
          await message.reply('📋 Danh sách Whitelist hiện đang trống. (Chủ server & Bot được mặc định miễn trừ).');
          return;
        }
        const listText = conf.whitelist
          .map((w, idx) => `${idx + 1}. **${w.name}** (\`${w.id}\`) - Thêm bởi: \`${w.addedBy}\``)
          .join('\n');

        const embed = new EmbedBuilder()
          .setTitle('🛡️ Danh Sách Whitelist Anti-Raid')
          .setColor('#5865F2')
          .setDescription(listText)
          .setFooter({ text: `Dùng ${prefix}delwhitelist @user để xóa` });

        await message.reply({ embeds: [embed] });
        break;
      }

      case 'lockdown': {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
          await message.reply('❌ Bạn cần quyền Administrator để kích hoạt chế độ Khóa khẩn cấp!');
          return;
        }

        const mode = args[0]?.toLowerCase();
        if (mode === 'on') {
          if (!message.guild) return;
          await toggleServerLockdown(message.guild, true, `Thực hiện thủ công bởi ${message.author.tag}`);
          await message.reply('🔒 **[PANIC LOCKDOWN ACTIVATED]** ĐÃ KHÓA KHẨN CẤP TOÀN BỘ KÊNH! Mọi thành viên thường (@everyone) tạm thời bị vô hiệu hóa quyền chat và gửi reaction để ngăn chặn raid.');
        } else if (mode === 'off') {
          if (!message.guild) return;
          await toggleServerLockdown(message.guild, false, `Mở khóa thủ công bởi ${message.author.tag}`);
          await message.reply('🔓 **[PANIC LOCKDOWN DEACTIVATED]** Đã dỡ bỏ khóa khẩn cấp! Quyền nhắn tin của @everyone đã được khôi phục.');
        } else {
          await message.reply(`Cách dùng: \`${prefix}lockdown on\` (Khóa khẩn cấp) hoặc \`${prefix}lockdown off\` (Mở khóa)`);
        }
        break;
      }

      case 'clearuser': {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) return;
        const target = message.mentions.users.first();
        if (!target) {
          await message.reply(`Vui lòng tag người cần reset đếm: \`${prefix}clearuser @user\``);
          return;
        }
        if (message.guild) {
          resetUserCounters(message.guild.id, target.id);
        }
        await message.reply(`🔄 Đã đặt lại toàn bộ bộ đếm vi phạm của **${target.tag}**.`);
        break;
      }

      case 'raidlogs': {
        const incidents = getRaidIncidents();
        if (incidents.length === 0) {
          await message.reply('🛡️ Chưa ghi nhận vụ xâm nhập hoặc raid nào! Máy chủ đang trong trạng thái an toàn.');
          return;
        }

        const recent = incidents.slice(0, 5);
        const embed = new EmbedBuilder()
          .setTitle('🚨 Nhật Ký Ngăn Chặn Raid Gần Nhất (Audit Logs)')
          .setColor('#ED4245')
          .setDescription(
            recent
              .map(
                (inc, i) =>
                  `**${i + 1}. [${inc.actionType.toUpperCase()}]** <t:${Math.floor(inc.timestamp / 1000)}:R>\n• Thủ phạm: \`${inc.executorTag}\` (\`${inc.executorId}\`)\n• Chi tiết: ${inc.details}\n• Xử lý: **${inc.punishmentTaken}**`
              )
              .join('\n\n')
          )
          .setFooter({ text: 'SentinelBot Anti-Raid Protection' });

        await message.reply({ embeds: [embed] });
        break;
      }

      case 'antispam': {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) return;
        if (args[0] === 'on') {
          antiSpamEnabled.add(message.guild!.id);
          await message.reply('🛡️ Đã BẬT hệ thống Anti-Spam & Anti-Link.');
        } else if (args[0] === 'off') {
          antiSpamEnabled.delete(message.guild!.id);
          await message.reply('⚠️ Đã TẮT hệ thống Anti-Spam & Anti-Link.');
        } else {
          await message.reply('Dùng lệnh: !antispam <on/off>');
        }
        break;
      }

      case 'reportdead': {
        await message.reply('✅ Đã tiếp nhận báo cáo proxy chết. Đang kiểm tra...');
        break;
      }

      case 'scanweb': {
        const url = args[0];
        if (!url) {
          await message.reply('Vui lòng cung cấp liên kết cần quét. Ví dụ: `.scanweb https://google.com` hoặc `.scanweb discord-nitro.click`');
          return;
        }

        const scanningMsg = await message.reply(`🔍 **Sentinel CyberSec** đang phân tích tên miền, DNS, chứng chỉ SSL và phát hiện mã độc cho: \`${url}\`...`);
        try {
          const reportEmbed = await performWebScan(url, message.author.tag, message.guild?.name);
          await scanningMsg.edit({ content: '', embeds: [reportEmbed] });
        } catch (err: any) {
          console.error('Error in scanweb:', err);
          await scanningMsg.edit(`❌ Lỗi khi phân tích liên kết: ${err.message || 'Lỗi không xác định'}`);
        }
        break;
      }

      case 'scanfile': {
        if (message.attachments.size === 0) {
          await message.reply('Vui lòng đính kèm một tệp tin (file) vào tin nhắn và kèm theo lệnh `.scanfile`.');
          return;
        }

        const attachment = message.attachments.first();
        if (!attachment) return;

        const scanningMsg = await message.reply(`🛡️ **Sentinel CyberSec** đang tải tệp, tính toán mã băm SHA-256, độ hỗn loạn Entropy và phân tích chữ ký nhị phân cho: \`${attachment.name}\`...`);
        try {
          const reportEmbed = await performFileScan(
            attachment.url,
            attachment.name,
            attachment.size,
            message.author.tag,
            message.guild?.name
          );
          await scanningMsg.edit({ content: '', embeds: [reportEmbed] });
        } catch (err: any) {
          console.error('Error in scanfile:', err);
          await scanningMsg.edit(`❌ Lỗi khi phân tích tệp tin: ${err.message || 'Lỗi không xác định'}`);
        }
        break;
      }

      // --- Fun & Mini-games Commands ---
      case 'ghepdoi':
      case 'ship': {
        // Hỗ trợ tag 2 người (.ghepdoi @user1 @user2) hoặc tag 1 người để ghép với người gọi lệnh (.ghepdoi @crush)
        const mentions = message.mentions.members;
        let user1 = message.member;
        let user2 = mentions?.first();

        if (mentions && mentions.size >= 2) {
          const membersArray = Array.from(mentions.values());
          user1 = membersArray[0];
          user2 = membersArray[1];
        }

        if (!user2) {
          await message.reply('💘 **Cách dùng lệnh Ghép Đôi:**\n• `.ghepdoi @crush` (ghép bạn với crush)\n• `.ghepdoi @user1 @user2` (đẩy thuyền 2 thành viên trong server)');
          return;
        }

        if (user1?.id === user2.id) {
          await message.reply('😂 Bạn không thể tự ghép đôi với chính mình đâu, yêu bản thân quá rồi đấy!');
          return;
        }

        const name1 = user1?.displayName || user1?.user.username || 'Thành viên 1';
        const name2 = user2.displayName || user2.user.username || 'Thành viên 2';

        const { score, progressBar, comment, shipName } = calculateShip(
          user1?.id || '1',
          user2.id,
          name1,
          name2
        );

        let color = '#FF69B4'; // Hồng ngọt ngào
        if (score >= 75) color = '#ED4245'; // Đỏ mãnh liệt
        else if (score < 40) color = '#747F8D'; // Xám bạn bè

        const embed = new EmbedBuilder()
          .setTitle('💘 TƠ DUYÊN TIỀN ĐỊNH • GHÉP ĐÔI TÌNH YÊU 💘')
          .setColor(color as any)
          .setDescription(`Hệ thống thần số học đã tính toán độ tương thích giữa **${name1}** và **${name2}**!`)
          .addFields(
            { name: '💑 Biệt danh cặp đôi', value: `\`${shipName}\``, inline: true },
            { name: '💖 Tỷ lệ hợp nhau', value: `**${score}%**`, inline: true },
            { name: '📊 Thước đo tình cảm', value: `${progressBar}`, inline: false },
            { name: '🔮 Lời sấm truyền', value: `*"${comment}"*`, inline: false }
          )
          .setFooter({ text: 'SentinelBot Tình Duyên • Kết quả đổi mới mỗi ngày!' })
          .setTimestamp();

        await message.reply({ embeds: [embed] });
        break;
      }

      case 'gay':
      case 'gayrate': {
        const target = message.mentions.members?.first() || message.member;
        if (!target) return;

        const targetName = target.displayName || target.user.username;
        const { rate, progressBar, title, desc } = calculateGayRate(target.id, targetName);

        const embed = new EmbedBuilder()
          .setTitle('🌈 MÁY ĐO ĐỘ GAY LỌ • RAINBOW SCANNER 🌈')
          .setColor('#EB459E')
          .setDescription(`Máy quét quang phổ đang rà soát năng lượng cầu vồng của **${targetName}**...`)
          .addFields(
            { name: '✨ Chỉ số Gay lọ', value: `**${rate}%**`, inline: true },
            { name: '🎖️ Danh hiệu', value: `\`${title}\``, inline: true },
            { name: '🌈 Thang đo cầu vồng', value: `${progressBar}`, inline: false },
            { name: '💬 Đánh giá chuyên gia', value: `*"${desc}"*`, inline: false }
          )
          .setFooter({ text: 'SentinelBot Fun • Mang tính chất giải trí mua vui!' })
          .setTimestamp();

        await message.reply({ embeds: [embed] });
        break;
      }

      // --- AI Chat Commands ---
      case 'chat':
      case 'ai':
      case 'ask':
      case 'gemini': {
        const query = args.join(' ').trim();
        if (!query) {
          await message.reply(`🤖 **SentinelBot AI (Gemini 3.8 Flash)**\nHãy nhập câu hỏi hoặc nội dung bạn muốn trò chuyện sau lệnh, ví dụ:\n• \`${prefix}chat Làm sao để phòng chống bot raid server?\`\n• \`${prefix}ai Viết giúp mình một thông báo chào mừng thành viên mới\``);
          return;
        }

        if ('sendTyping' in message.channel) {
          // @ts-ignore
          message.channel.sendTyping().catch(() => {});
        }

        const reply = await askGeminiChat(
          query,
          message.author.id,
          message.member?.displayName || message.author.username
        );

        if (reply.length <= 1950) {
          await message.reply(reply);
        } else {
          // Gửi tin nhắn đầu tiên kèm tag
          await message.reply(reply.slice(0, 1950));
          if (reply.length > 1950) {
            await (message.channel as any).send(reply.slice(1950, 3900)).catch(() => {});
          }
        }
        break;
      }

      // --- User Profile, Avatar & Banner Commands ---
      case 'w':
      case 'whois':
      case 'userinfo':
      case 'user': {
        const loadingMsg = await message.reply('🔍 Đang tra cứu thông tin người dùng...');
        try {
          const { user: targetUser, member: targetMember } = await resolveTargetUserAndMember(message, args, client);
          const { embed, row } = buildWhoisEmbed(targetMember, targetUser);
          await loadingMsg.edit({ content: '', embeds: [embed], components: [row] });
        } catch (err: any) {
          await loadingMsg.edit(`❌ Không thể tra cứu thông tin: ${err.message || 'Lỗi không xác định'}`);
        }
        break;
      }

      case 'avt':
      case 'avatar':
      case 'pfp': {
        const loadingMsg = await message.reply('🔍 Đang tải avatar...');
        try {
          const { user: targetUser, member: targetMember } = await resolveTargetUserAndMember(message, args, client);
          const { embed, row } = buildAvatarEmbed(targetMember, targetUser);
          await loadingMsg.edit({ content: '', embeds: [embed], components: [row] });
        } catch (err: any) {
          await loadingMsg.edit(`❌ Không thể tải avatar: ${err.message || 'Lỗi không xác định'}`);
        }
        break;
      }

      case 'banner': {
        const loadingMsg = await message.reply('🔍 Đang tải banner profile...');
        try {
          const { user: targetUser, member: targetMember } = await resolveTargetUserAndMember(message, args, client);
          const { embed, row } = buildBannerEmbed(targetUser, targetMember);
          await loadingMsg.edit({ content: '', embeds: [embed], components: [row] });
        } catch (err: any) {
          await loadingMsg.edit(`❌ Không thể tải banner: ${err.message || 'Lỗi không xác định'}`);
        }
        break;
      }

      // --- TikTok Video Downloader & Embed Commands ---
      case 'tiktok':
      case 'tt': {
        const sub = args[0]?.toLowerCase();

        // Cài đặt bật/tắt tự động bắt link TikTok
        if (sub === 'auto') {
          if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            await message.reply('❌ Bạn cần quyền **Quản lý máy chủ (Manage Server)** để cấu hình tính năng này.');
            return;
          }

          const action = args[1]?.toLowerCase();
          if (action === 'on' || action === 'enable' || action === 'bat' || action === '1') {
            setTikTokAutoEmbed(message.guild!.id, true);
            await message.reply('✅ Đã **BẬT** chế độ tự động nhận diện và nhúng video khi có thành viên gửi link TikTok trong server!');
            return;
          } else if (action === 'off' || action === 'disable' || action === 'tat' || action === '0') {
            setTikTokAutoEmbed(message.guild!.id, false);
            await message.reply('⛔ Đã **TẮT** chế độ tự động nhận diện link TikTok trong server (thành viên vẫn có thể dùng lệnh `.tiktok <link>`).');
            return;
          } else {
            const current = isTikTokAutoEmbedEnabled(message.guild?.id);
            await message.reply(`⚙️ Trạng thái tự động nhận diện link TikTok hiện tại: **${current ? '🟢 ĐANG BẬT' : '🔴 ĐANG TẮT'}**\n• Bật: \`${prefix}tiktok auto on\`\n• Tắt: \`${prefix}tiktok auto off\``);
            return;
          }
        }

        const url = args[0];
        if (!url) {
          const embed = new EmbedBuilder()
            .setTitle('📱 SentinelBot - Nhận & Tải Link TikTok Không Logo')
            .setColor('#EE1D52')
            .setDescription(`Hệ thống hỗ trợ tự động tải video TikTok Full HD không watermark (logo mờ), tách nhạc MP3 và xem trực tiếp trên Discord!`)
            .addFields(
              { name: '📥 Cách dùng lệnh', value: `\`${prefix}tiktok <link>\` hoặc \`${prefix}tt <link>\`\n*Ví dụ:* \`${prefix}tiktok https://vt.tiktok.com/ZS.../\`` },
              { name: '⚡ Tự động nhận diện', value: `Chỉ cần dán link TikTok vào bất kỳ kênh nào, bot sẽ tự động nhận diện và gửi video xem trực tiếp!` },
              { name: '⚙️ Bật / Tắt tự động', value: `\`${prefix}tiktok auto <on/off>\` (Dành cho Quản trị viên)` }
            )
            .setFooter({ text: 'Hỗ trợ link vt.tiktok.com, vm.tiktok.com & tiktok.com' });
          await message.reply({ embeds: [embed] });
          return;
        }

        const validUrl = extractFirstTikTokUrl(url);
        if (!validUrl) {
          await message.reply('❌ Đường dẫn không đúng định dạng TikTok! Vui lòng cung cấp link `vt.tiktok.com` hoặc `tiktok.com`.');
          return;
        }

        await processTikTokLink(message, validUrl);
        break;
      }

      // Music Commands
      case 'play':
      case 'skip':
      case 's':
      case 'stop':
      case 'leave':
      case 'pause':
      case 'resume':
      case 'volume':
      case 'vol':
      case 'queue':
      case 'q':
      case 'nowplaying':
      case 'np':
      case 'setscid':
      case 'scid':
      case 'scstatus': {
        await handleMusicCommand(command, args, message, client);
        break;
      }

      // --- Discord Bot Rich Presence (RPC) Commands ---
      case 'rpc':
      case 'presence':
      case 'activity': {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
          await message.reply('❌ Bạn cần quyền **Quản lý Server (Manage Server)** để tùy chỉnh Rich Presence của Bot!');
          return;
        }

        const sub = args[0]?.toLowerCase();
        if (!sub || sub === 'info' || sub === 'help') {
          const cfg = getRpcConfig();
          const embed = new EmbedBuilder()
            .setTitle('🎮 SentinelBot • Rich Presence (RPC) Manager')
            .setColor('#5865F2')
            .setDescription('Tùy chỉnh hoạt động và trạng thái hiển thị của bot:')
            .addFields(
              { name: 'Loại hoạt động (Type)', value: `\`${cfg.activityType}\``, inline: true },
              { name: 'Trạng thái (Status)', value: `\`${cfg.status.toUpperCase()}\``, inline: true },
              { name: 'Tự động luân phiên (Auto-Rotate)', value: cfg.autoRotate ? '🟢 BẬT' : '⚪ TẮT', inline: true },
              { name: 'Nội dung hiển thị', value: `**${cfg.activityName}**\n*${cfg.state || 'Không có chi tiết'}*` },
              {
                name: '📖 Cách sử dụng',
                value: `• \`${prefix}rpc playing <tên game>\`\n• \`${prefix}rpc watching <nội dung>\`\n• \`${prefix}rpc listening <tên bài hát>\`\n• \`${prefix}rpc streaming <url_twitch> <nội dung>\`\n• \`${prefix}rpc status <online|idle|dnd>\`\n• \`${prefix}rpc rotate <on|off>\``
              }
            )
            .setFooter({ text: 'Có thể quản lý trực quan trên Web Dashboard' });
          await message.reply({ embeds: [embed] });
          return;
        }

        if (sub === 'status') {
          const newStatus = args[1]?.toLowerCase();
          if (!newStatus || !['online', 'idle', 'dnd', 'invisible'].includes(newStatus)) {
            await message.reply(`Trạng thái hợp lệ: \`online\`, \`idle\`, \`dnd\`, \`invisible\`. Ví dụ: \`${prefix}rpc status dnd\``);
            return;
          }
          applyRpcToBot(client, { status: newStatus as any });
          await message.reply(`✅ Đã cập nhật trạng thái hiển thị của bot thành **${newStatus.toUpperCase()}**!`);
          return;
        }

        if (sub === 'rotate') {
          const mode = args[1]?.toLowerCase();
          const enable = mode === 'on' || mode === 'true' || mode === 'bat' || mode === '1';
          setRpcAutoRotate(client, enable);
          await message.reply(`🔄 Đã ${enable ? 'BẬT 🟢' : 'TẮT ⚪'} chế độ tự động luân phiên đổi Rich Presence!`);
          return;
        }

        const validTypes: Record<string, BotRpcConfig['activityType']> = {
          playing: 'Playing',
          play: 'Playing',
          watching: 'Watching',
          watch: 'Watching',
          listening: 'Listening',
          listen: 'Listening',
          streaming: 'Streaming',
          stream: 'Streaming',
          competing: 'Competing',
          compete: 'Competing',
          custom: 'Custom',
        };

        const targetType = validTypes[sub];
        if (targetType) {
          let streamUrl = 'https://www.twitch.tv/sentinelbot_defense';
          let textArgs = args.slice(1);
          if (targetType === 'Streaming' && args[1]?.startsWith('http')) {
            streamUrl = args[1];
            textArgs = args.slice(2);
          }
          const text = textArgs.join(' ').trim();
          if (!text) {
            await message.reply(`Vui lòng nhập nội dung sau loại hoạt động. Ví dụ: \`${prefix}rpc ${sub} Bảo vệ Discord\``);
            return;
          }

          setRpcAutoRotate(client, false);
          applyRpcToBot(client, {
            activityType: targetType,
            activityName: text,
            streamUrl: targetType === 'Streaming' ? streamUrl : undefined,
            state: 'Thiết lập thủ công qua Discord command',
            autoRotate: false
          });

          await message.reply(`🎮 Đã đổi Rich Presence thành: **[${targetType}] ${text}** (Trạng thái: ${getRpcConfig().status.toUpperCase()})`);
          return;
        }

        await message.reply(`Không rõ loại hoạt động. Sử dụng: \`${prefix}rpc <playing|watching|listening|streaming|competing|status|rotate>\``);
        break;
      }

      // --- Auto Chat Commands ---
      case 'autochat': {
        const sub = args[0]?.toLowerCase();
        if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageWebhooks)) {
          await message.reply('❌ Bạn cần quyền **Quản lý Webhook** để dùng lệnh này!');
          return;
        }

        if (sub === 'on') {
          const url = args[1];
          if (url && url.startsWith('https://discord.com/api/webhooks/')) {
            activeWebhooks.set(message.channel.id, url);
            await message.reply('✅ Đã kích hoạt chế độ tự động chat (copy/nhái) bằng Webhook tại kênh này!');
          } else {
            // Tự tạo Webhook
            if (!message.guild?.members.me?.permissions.has(PermissionsBitField.Flags.ManageWebhooks)) {
              await message.reply('❌ Bot không có quyền **Quản lý Webhook** để tự tạo!');
              return;
            }
            try {
              const webhook = await (message.channel as any).createWebhook({
                name: 'Sentinel AutoChat',
                avatar: client.user?.displayAvatarURL(),
                reason: 'Auto-created by SentinelBot'
              });
              activeWebhooks.set(message.channel.id, webhook.url);
              await message.reply(`✅ Đã tự tạo Webhook mới và kích hoạt chế độ tự động chat tại kênh này!`);
            } catch (err: any) {
              await message.reply(`❌ Không thể tự tạo Webhook: ${err.message}`);
            }
          }
        } else if (sub === 'off') {
          activeWebhooks.delete(message.channel.id);
          await message.reply('🗑️ Đã xóa liên kết Webhook (nội bộ) và tắt chế độ tự động chat tại kênh này.');
        } else if (sub === 'clear') {
          if (!message.guild?.members.me?.permissions.has(PermissionsBitField.Flags.ManageWebhooks)) {
            await message.reply('❌ Bot không có quyền **Quản lý Webhook** để xóa!');
            return;
          }
          try {
            const webhooks = await (message.channel as any).fetchWebhooks();
            for (const webhook of webhooks.values()) {
              await webhook.delete('Deleted by SentinelBot autochat clear command');
            }
            activeWebhooks.delete(message.channel.id);
            await message.reply(`🗑️ Đã xóa thành công ${webhooks.size} Webhook trong kênh này và tắt chế độ tự động chat.`);
          } catch (err: any) {
            await message.reply(`❌ Lỗi khi xóa Webhook: ${err.message}`);
          }
        } else {
          await message.reply(`Cách dùng:\n• \`.autochat on [link_webhook]\` (Bật, nếu ko nhập link bot sẽ tự tạo)\n• \`.autochat off\` (Tắt nội bộ)\n• \`.autochat clear\` (Xóa tất cả webhook trong kênh & Tắt)`);
        }
        break;
      }

      // --- Roblox Account Checker Commands ---
      case 'roblox':
      case 'rbx': {
        const query = args.join(' ').trim();
        if (!query) {
          await message.reply(`Vui lòng nhập tên tài khoản hoặc ID Roblox! Ví dụ: \`${prefix}roblox Roblox\` hoặc sử dụng Slash Command: \`/roblox username: Roblox\``);
          return;
        }

        const loadingMsg = await message.reply('🔍 Đang tra cứu dữ liệu tài khoản từ Roblox API...');
        try {
          const profile = await fetchRobloxUser(query);
          const { embed, row } = buildRobloxDiscordEmbed(profile);
          await loadingMsg.edit({ content: '', embeds: [embed], components: [row] });
        } catch (err: any) {
          await loadingMsg.edit(`❌ **Không thể tra cứu tài khoản Roblox:** ${err.message || 'Lỗi không xác định'}`);
        }
        break;
      }

      // --- Ticket System Commands ---
      case 'ticket': {
        const sub = args[0]?.toLowerCase();

        // 1. .ticket close
        if (sub === 'close') {
          if (!message.channel.isTextBased() || !(message.channel as any).name?.startsWith('ticket-')) {
            await message.reply('⚠️ Lệnh này chỉ dùng được bên trong kênh Ticket!');
            return;
          }
          await handleCloseTicketButton({
            guild: message.guild,
            channel: message.channel,
            reply: (data: any) => message.reply(data),
          } as any);
          return;
        }

        // 2. .ticket image / .ticket setimage / .ticket banner
        if (sub === 'image' || sub === 'setimage' || sub === 'banner') {
          if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            await message.reply('❌ Bạn cần quyền **Manage Server (Quản lý Máy chủ)** để đổi ảnh Bảng Ticket!');
            return;
          }

          const attachedImg = message.attachments.first()?.url;
          const urlFromArgs = args.slice(1).find((a) => a.startsWith('http://') || a.startsWith('https://'));
          const finalImage = attachedImg || urlFromArgs;

          if (!finalImage) {
            await message.reply(
              `⚠️ **Cách gắn ảnh banner cho Bảng Ticket:**\n` +
              `• **Cách 1 (Tải ảnh lên):** Gõ \`${prefix}ticket image\` và đính kèm file ảnh từ máy/điện thoại!\n` +
              `• **Cách 2 (Dùng link):** \`${prefix}ticket image https://link_anh.png\`\n` +
              `• **Cách 3:** Dùng lệnh Slash \`/ticket setimage\` hoặc cấu hình trên **Web Dashboard**.`
            );
            return;
          }

          setTicketImage(finalImage);
          const previewEmbed = new EmbedBuilder()
            .setTitle('✅ Đã Cập Nhật Ảnh Banner Cho Ticket')
            .setDescription(`Ảnh banner mới đã được lưu thành công!\nMọi Bảng Ticket gửi sau này sẽ tự động gắn ảnh này.\n\n🔗 Link ảnh: [Xem ảnh gốc](${finalImage})\n💡 Gõ \`${prefix}ticket setup\` để đăng Bảng Ticket mới.`)
            .setColor('#5865F2')
            .setImage(finalImage)
            .setTimestamp();

          await message.reply({ embeds: [previewEmbed] });
          return;
        }

        // .ticket role / .ticket setrole
        if (sub === 'role' || sub === 'setrole') {
          if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            await message.reply('❌ Bạn cần quyền **Manage Server (Quản lý Máy chủ)** để cấu hình Role Trung Gian!');
            return;
          }

          const targetRole = message.mentions.roles.first() || (args[1] ? message.guild.roles.cache.get(args[1].replace(/[^0-9]/g, '')) : null);
          if (targetRole) {
            updateTicketConfig({ supportRoleId: targetRole.id });
            await message.reply(`✅ Đã cập nhật Role Trung Gian cho Ticket là: <@&${targetRole.id}> (\`${targetRole.id}\`). Mọi ticket mới sẽ chỉ ping role này!`);
            return;
          }

          const current = getTicketConfig();
          await message.reply(
            `🛡️ **Role Trung Gian hiện tại:** <@&${current.supportRoleId || '1548274995325706361'}>\n` +
            `💡 Để đổi role, gõ: \`${prefix}ticket role @Tên_Role\` hoặc \`${prefix}ticket role <ID_Role>\``
          );
          return;
        }

        // 3. .ticket setup / .ticket fix / .ticket gop / .ticket [link_ảnh]
        if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
          await message.reply('❌ Bạn cần quyền **Manage Server (Quản lý Máy chủ)** để cài đặt Bảng Ticket!');
          return;
        }

        // Tự động bắt ảnh đính kèm hoặc link ảnh trong tin nhắn setup
        const attachedImg = message.attachments.first()?.url;
        const linkImg = args.find((a) => a.startsWith('http://') || a.startsWith('https://'));
        if (attachedImg || linkImg) {
          setTicketImage(attachedImg || linkImg!);
        }

        const targetChannel = message.mentions.channels.first() || message.channel;
        if (!targetChannel.isTextBased()) {
          await message.reply('❌ Kênh không hợp lệ!');
          return;
        }

        const { embed, row } = buildTicketPanel();

        // Kiểm tra xem có yêu cầu sửa/gộp tin nhắn ticket cũ hay không (hoặc sub === 'fix' / 'gop' / 'edit')
        let editedExisting = false;
        try {
          const recentMessages = await (targetChannel as any).messages.fetch({ limit: 10 });
          const oldTicketMsg = recentMessages.find(
            (m: any) =>
              m.author.id === client.user?.id &&
              m.components?.some((c: any) => c.components?.some((b: any) => b.customId === 'btn_create_ticket'))
          );

          if (oldTicketMsg && (sub === 'fix' || sub === 'gop' || sub === 'edit' || sub === 'update')) {
            await oldTicketMsg.edit({ embeds: [embed], components: [row] });
            editedExisting = true;

            // Tự động tìm và xóa tin nhắn embed ảnh lẻ bên dưới do lệnh .embed tạo ra để không còn bị chia cắt
            const orphanEmbedMsg = recentMessages.find(
              (m: any) =>
                m.author.id === client.user?.id &&
                m.id !== oldTicketMsg.id &&
                m.embeds?.length > 0 &&
                !m.components?.some((c: any) => c.components?.some((b: any) => b.customId === 'btn_create_ticket'))
            );
            if (orphanEmbedMsg && orphanEmbedMsg.deletable) {
              await orphanEmbedMsg.delete().catch(() => {});
            }

            await message.reply('✅ Đã gộp ảnh banner vào cùng một Embed Ticket và dọn dẹp tin nhắn lẻ thành công! Khung Ticket giờ đã liền mạch 1 Embed hoàn chỉnh.');
            return;
          }
        } catch {
          // Bỏ qua lỗi fetch message
        }

        // Gửi Bảng Ticket hoàn chỉnh (1 Embed duy nhất chứa text + ảnh banner bên trong + nút tạo ticket)
        const sentMsg = await (targetChannel as any).send({ embeds: [embed], components: [row] });

        // Nếu người dùng gõ lệnh setup ở cùng kênh, có thể xóa bớt tin nhắn lẻ trước đó nếu người dùng muốn
        if (targetChannel.id === message.channel.id && (sub === 'setup' || sub === 'fix')) {
          try {
            const recent = await message.channel.messages.fetch({ limit: 6 });
            const separatedEmbed = recent.find(
              (m: any) =>
                m.author.id === client.user?.id &&
                m.id !== sentMsg.id &&
                m.embeds?.length > 0 &&
                !m.components?.some((c: any) => c.components?.some((b: any) => b.customId === 'btn_create_ticket'))
            );
            if (separatedEmbed && separatedEmbed.deletable) {
              await separatedEmbed.delete().catch(() => {});
            }
          } catch {}
        }

        if (targetChannel.id !== message.channel.id) {
          await message.reply(`✅ Đã gửi Bảng Tạo Ticket thành công vào kênh <#${targetChannel.id}>!`);
        }
        break;
      }

      case 'close': {
        if (!message.channel.isTextBased() || !(message.channel as any).name?.startsWith('ticket-')) {
          await message.reply('⚠️ Lệnh này chỉ dùng được bên trong kênh Ticket!');
          return;
        }
        await handleCloseTicketButton({
          guild: message.guild,
          channel: message.channel,
          reply: (data: any) => message.reply(data),
        } as any);
        break;
      }

      // --- Custom Embed Command ---
      case 'embed': {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
          await message.reply('❌ Bạn cần quyền **Manage Messages** để tạo Embed!');
          return;
        }

        const raw = args.join(' ').trim();
        const attachedUrl = message.attachments.first()?.url;

        if (!raw && !attachedUrl) {
          await message.reply(
            `🎨 **Cách tạo Embed bằng tin nhắn:**\n` +
            `• **Cú pháp:** \`${prefix}embed [Tiêu đề] | [Nội dung] | [Màu Hex] | [Link ảnh]\`\n` +
            `• **Gắn ảnh tải lên:** Gõ \`${prefix}embed [Tiêu đề] | [Nội dung]\` rồi **đính kèm ảnh** từ máy/điện thoại!\n` +
            `• *Ví dụ:*\n` +
            `\`${prefix}embed Thông Báo Bảo Trì | Máy chủ sẽ bảo trì lúc 12:00 trưa nay | #5865F2 | https://images2.alphacoders.com/131/1314480.jpeg\`\n\n` +
            `💡 Hoặc dùng lệnh Slash: \`/embed description: <nội dung>\` hoặc tạo trực quan trên **Web Dashboard**!`
          );
          return;
        }

        const parts = raw.split('|').map((s) => s.trim());
        let title = '';
        let description = '';
        let color = '#5865F2';
        let imageUrl = '';

        if (parts.length === 1) {
          description = parts[0];
        } else {
          title = parts[0];
          description = parts[1] || '';
          color = parts[2] || '#5865F2';
          imageUrl = parts[3] || '';
        }

        // Nếu người dùng tải đính kèm file ảnh và chưa có link ảnh trong text, tự động lấy ảnh đính kèm
        if (!imageUrl && attachedUrl) {
          imageUrl = attachedUrl;
        }

        const customEmbed = buildCustomEmbed({
          title: title || undefined,
          description: description || (imageUrl ? '​' : 'Tin nhắn Embed'),
          color,
          imageUrl: imageUrl || undefined,
          footerText: `Gửi bởi ${message.author.tag} • SentinelBot Embed`,
        });

        await (message.channel as any).send({ embeds: [customEmbed] });
        if (message.deletable) {
          await message.delete().catch(() => {});
        }
        break;
      }
    }
  } catch (error: any) {
    console.error('Lỗi khi thực thi lệnh:', error);
    if (error?.code === 50013) {
      await message.reply(
        '❌ **Lỗi quyền hạn (Missing Permissions / 50013):**\n1. Bot chưa được cấp quyền quản trị (như Ban Members, Kick Members, Administrator).\n2. Hoặc vị trí Role của Bot trong danh sách Roles đang thấp hơn Role của người cần xử lý!\n👉 Hãy vào **Server Settings > Roles**, kéo vai trò của Bot lên vị trí cao nhất có thể và kiểm tra quyền của Bot.'
      ).catch(() => {});
    } else {
      await message.reply(`❌ **Có lỗi xảy ra khi thực hiện lệnh:** ${error?.message || 'Lỗi không xác định'}`).catch(() => {});
    }
  }
});

let isBotRunning = false;
let isBotManuallyStopped = false; // Đã mở bot lại hoạt động bình thường
let loginError = '';

// Đăng nhập bot Discord
if (process.env.DISCORD_TOKEN && process.env.DISCORD_TOKEN !== 'YOUR_DISCORD_BOT_TOKEN') {
  client.login(process.env.DISCORD_TOKEN)
    .then(() => {
      isBotRunning = true;
      loginError = '';
      console.log('✅ Đã kết nối Discord Bot thành công!');
    })
    .catch((err) => {
      loginError = err.message;
      isBotRunning = false;
      console.error("Discord login failed:", err.message);
    });
}

// --- Express App Setup ---
async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes for Dashboard
  app.get('/api/status', (req, res) => {
    res.json({
      online: isBotRunning,
      manuallyStopped: isBotManuallyStopped,
      botName: client.user?.tag || null,
      error: loginError,
      guildCount: client.guilds.cache?.size || 0,
    });
  });

  // Dừng bot trong môi trường này (ngắt kết nối Discord Gateway)
  app.post('/api/bot/stop', async (req, res) => {
    try {
      isBotManuallyStopped = true;
      isBotRunning = false;
      await client.destroy();
      console.log('🛑 Đã ngắt kết nối Discord Bot trong môi trường AI Studio container.');
      res.json({ success: true, online: false, manuallyStopped: true });
    } catch (err: any) {
      console.error('Lỗi khi dừng bot:', err);
      res.status(500).json({ error: err.message || 'Lỗi khi ngắt kết nối bot' });
    }
  });

  // Khởi động lại bot nếu muốn
  app.post('/api/bot/start', async (req, res) => {
    try {
      const token = process.env.DISCORD_TOKEN;
      if (!token || token === 'YOUR_DISCORD_BOT_TOKEN') {
        res.status(400).json({ error: 'Chưa cấu hình biến DISCORD_TOKEN trong môi trường!' });
        return;
      }
      isBotManuallyStopped = false;
      await client.login(token);
      isBotRunning = true;
      loginError = '';
      console.log('✅ Đã kết nối lại Discord Bot thành công.');
      res.json({ success: true, online: true, manuallyStopped: false, botName: client.user?.tag });
    } catch (err: any) {
      console.error('Lỗi khi bật bot:', err);
      loginError = err.message;
      res.status(500).json({ error: err.message || 'Không thể đăng nhập Discord' });
    }
  });

  // Scan History API routes
  app.get('/api/scans', (req, res) => {
    res.json({
      scans: getScanHistory(),
    });
  });

  app.post('/api/scans/web', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== 'string') {
        res.status(400).json({ error: 'URL không hợp lệ' });
        return;
      }
      await performWebScan(url, 'Dashboard Web', 'Web Interface');
      const latest = getScanHistory();
      res.json({ success: true, record: latest[0] });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Lỗi khi quét URL' });
    }
  });

  app.delete('/api/scans', (req, res) => {
    clearScanHistory();
    res.json({ success: true, scans: [] });
  });

  // Fun & Mini-games test endpoints
  app.post('/api/fun/ship', (req, res) => {
    const { name1, name2 } = req.body;
    if (!name1 || !name2) {
      res.status(400).json({ error: 'Cần nhập tên 2 người' });
      return;
    }
    const result = calculateShip(name1.toLowerCase(), name2.toLowerCase(), name1, name2);
    res.json(result);
  });

  app.post('/api/fun/gay', (req, res) => {
    const { name } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Cần nhập tên người cần đo' });
      return;
    }
    const result = calculateGayRate(name.toLowerCase(), name);
    res.json(result);
  });

  // --- TikTok API Endpoints ---
  app.post('/api/tiktok/info', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== 'string') {
        res.status(400).json({ error: 'Vui lòng cung cấp URL TikTok' });
        return;
      }
      const validUrl = extractFirstTikTokUrl(url);
      if (!validUrl) {
        res.status(400).json({ error: 'URL không đúng định dạng TikTok (cần dạng vt.tiktok.com hoặc tiktok.com)' });
        return;
      }
      const data = await fetchTikTokData(validUrl);
      if (!data) {
        res.status(404).json({ error: 'Không thể phân tích video này (có thể là video riêng tư hoặc lỗi mạng)' });
        return;
      }
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Lỗi hệ thống khi xử lý TikTok' });
    }
  });

  // --- AI Chat Endpoints ---
  app.get('/api/ai/status', (req, res) => {
    res.json({
      model: 'gemini-3.8-flash',
      hasApiKey: !!process.env.GEMINI_API_KEY,
      capabilities: ['security_advisory', 'community_moderation', 'general_qa', 'code_helper']
    });
  });

  app.post('/api/ai/chat', async (req, res) => {
    const { message: prompt, history } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: 'Nội dung tin nhắn không được để trống' });
      return;
    }
    try {
      const reply = await askGeminiChat(
        prompt.trim(),
        'web-dashboard',
        'Quản trị viên Web',
        Array.isArray(history) ? history : undefined
      );
      res.json({ reply, timestamp: Date.now() });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Lỗi khi kết nối tới AI' });
    }
  });

  // --- Anti-Raid API Endpoints ---
  app.get('/api/antiraid/status', (req, res) => {
    try {
      res.json({
        config: getAntiRaidConfig(),
        incidents: getRaidIncidents()
      });
    } catch (err: any) {
      console.error('Error in /api/antiraid/status:', err);
      res.status(500).json({ error: err.message || 'Lỗi khi lấy thông tin anti-raid' });
    }
  });

  app.post('/api/antiraid/config', (req, res) => {
    try {
      const patch = req.body;
      if (!patch || typeof patch !== 'object') {
        res.status(400).json({ error: 'Dữ liệu cấu hình không hợp lệ' });
        return;
      }
      const updated = updateAntiRaidConfig(patch);
      res.json({ success: true, config: updated });
    } catch (err: any) {
      console.error('Error in /api/antiraid/config:', err);
      res.status(500).json({ error: err.message || 'Lỗi khi cập nhật cấu hình' });
    }
  });

  app.post('/api/antiraid/whitelist', (req, res) => {
    try {
      const { id, name } = req.body;
      if (!id) {
        res.status(400).json({ error: 'Cần cung cấp ID người dùng/bot' });
        return;
      }
      const success = addWhitelistUser(id, name || id, 'Web Dashboard Admin');
      res.json({ success, config: getAntiRaidConfig() });
    } catch (err: any) {
      console.error('Error in /api/antiraid/whitelist:', err);
      res.status(500).json({ error: err.message || 'Lỗi khi thêm whitelist' });
    }
  });

  app.delete('/api/antiraid/whitelist/:id', (req, res) => {
    try {
      const { id } = req.params;
      const success = removeWhitelistUser(id);
      res.json({ success, config: getAntiRaidConfig() });
    } catch (err: any) {
      console.error('Error in delete /api/antiraid/whitelist:', err);
      res.status(500).json({ error: err.message || 'Lỗi khi xóa whitelist' });
    }
  });

  app.post('/api/antiraid/lockdown', async (req, res) => {
    try {
      const { enable, reason } = req.body;
      const shouldEnable = Boolean(enable);
      
      // Áp dụng lockdown trên tất cả guild mà bot đang tham gia
      for (const [, guild] of client.guilds.cache) {
        await toggleServerLockdown(guild, shouldEnable, reason || 'Kích hoạt từ Web Dashboard');
      }
      updateAntiRaidConfig({ lockdownMode: shouldEnable });
      res.json({
        success: true,
        lockdownMode: shouldEnable,
        incidents: getRaidIncidents()
      });
    } catch (err: any) {
      console.error('Error in /api/antiraid/lockdown:', err);
      res.status(500).json({ error: err.message || 'Lỗi khi kích hoạt lockdown' });
    }
  });

  app.delete('/api/antiraid/logs', (req, res) => {
    try {
      clearRaidIncidents();
      res.json({ success: true, incidents: [] });
    } catch (err: any) {
      console.error('Error in /api/antiraid/logs:', err);
      res.status(500).json({ error: err.message || 'Lỗi khi xóa logs' });
    }
  });

  // --- Discord Bot Rich Presence (RPC) Endpoints ---
  app.get('/api/rpc', (req, res) => {
    try {
      res.json({
        config: getRpcConfig(),
        botOnline: isBotRunning,
        botTag: client.user?.tag || null,
        botAvatar: client.user?.displayAvatarURL() || null
      });
    } catch (err: any) {
      console.error('Error in /api/rpc get:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/rpc', (req, res) => {
    try {
      const update = req.body;
      if (!update || typeof update !== 'object') {
        res.status(400).json({ error: 'Dữ liệu cấu hình RPC không hợp lệ' });
        return;
      }

      if (typeof update.autoRotate === 'boolean') {
        setRpcAutoRotate(client, update.autoRotate, update.intervalSeconds);
      }

      const applied = applyRpcToBot(client, update);
      res.json({
        success: true,
        applied,
        config: getRpcConfig()
      });
    } catch (err: any) {
      console.error('Error in /api/rpc post:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- Roblox Account Lookup API ---
  app.get('/api/roblox/check', async (req, res) => {
    try {
      const query = req.query.query as string;
      if (!query || !query.trim()) {
        res.status(400).json({ error: 'Vui lòng cung cấp tên tài khoản (Username) hoặc ID Roblox.' });
        return;
      }
      const profile = await fetchRobloxUser(query.trim());
      res.json({ success: true, profile });
    } catch (err: any) {
      console.error('Error in /api/roblox/check:', err);
      res.status(400).json({ error: err.message || 'Không thể tra cứu thông tin tài khoản Roblox' });
    }
  });

  // --- Discord Channels List API ---
  app.get('/api/discord/channels', (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      const guildsData: Array<{
        id: string;
        name: string;
        icon: string | null;
        channels: Array<{ id: string; name: string; type: number }>;
      }> = [];

      if (client.isReady() && client.guilds?.cache) {
        for (const [, guild] of client.guilds.cache) {
          const textChannels: Array<{ id: string; name: string; type: number }> = [];
          for (const [, ch] of guild.channels.cache) {
            if (ch.isTextBased() && !ch.isThread()) {
              textChannels.push({
                id: ch.id,
                name: ch.name,
                type: ch.type,
              });
            }
          }
          guildsData.push({
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL(),
            channels: textChannels,
          });
        }
      }

      res.json({ success: true, guilds: guildsData });
    } catch {
      res.json({ success: true, guilds: [] });
    }
  });

  // --- Ticket Management Endpoints ---
  app.get('/api/ticket/config', (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.json({ success: true, config: getTicketConfig() });
    } catch {
      res.json({ success: true, config: defaultTicketConfig });
    }
  });

  app.post('/api/ticket/config', (req, res) => {
    try {
      const patch = req.body;
      const updated = updateTicketConfig(patch);
      res.json({ success: true, config: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Không thể cập nhật cấu hình ticket' });
    }
  });

  app.post('/api/ticket/send-panel', async (req, res) => {
    try {
      const { channelId, customConfig } = req.body;
      if (!channelId) {
        res.status(400).json({ error: 'Vui lòng chọn kênh Discord để gửi Bảng Ticket!' });
        return;
      }

      const channel = client.channels.cache.get(channelId) || (await client.channels.fetch(channelId).catch(() => null));
      if (!channel || !channel.isTextBased()) {
        res.status(400).json({ error: 'Kênh Discord không tồn tại hoặc Bot không có quyền truy cập!' });
        return;
      }

      if (customConfig && typeof customConfig === 'object') {
        updateTicketConfig(customConfig);
      }

      const { embed, row } = buildTicketPanel();
      const sentMsg = await (channel as any).send({ embeds: [embed], components: [row] });

      res.json({
        success: true,
        messageId: sentMsg.id,
        channelName: (channel as any).name,
      });
    } catch (err: any) {
      console.error('Lỗi khi gửi Ticket Panel từ Dashboard:', err);
      res.status(500).json({ error: err.message || 'Lỗi khi gửi tin nhắn Embed vào Discord' });
    }
  });

  // --- Custom Discord Embed API ---
  app.post('/api/embed/send', async (req, res) => {
    try {
      const { channelId, title, description, color, imageUrl, thumbnailUrl, footerText, authorName } = req.body;
      if (!channelId) {
        res.status(400).json({ error: 'Vui lòng chọn kênh Discord cần gửi Embed!' });
        return;
      }
      if (!description && !title) {
        res.status(400).json({ error: 'Embed cần có ít nhất Tiêu đề hoặc Nội dung!' });
        return;
      }

      const channel = client.channels.cache.get(channelId) || (await client.channels.fetch(channelId).catch(() => null));
      if (!channel || !channel.isTextBased()) {
        res.status(400).json({ error: 'Kênh Discord không tồn tại hoặc Bot không có quyền truy cập!' });
        return;
      }

      const embed = buildCustomEmbed({
        title,
        description,
        color: color || '#5865F2',
        imageUrl,
        thumbnailUrl,
        footerText: footerText || 'Gửi từ SentinelBot Web Dashboard',
        authorName,
      });

      const sentMsg = await (channel as any).send({ embeds: [embed] });
      res.json({
        success: true,
        messageId: sentMsg.id,
        channelName: (channel as any).name,
      });
    } catch (err: any) {
      console.error('Lỗi khi gửi Custom Embed:', err);
      res.status(500).json({ error: err.message || 'Không thể gửi Embed vào Discord' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
