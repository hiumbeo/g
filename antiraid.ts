import fs from 'fs';
import path from 'path';
import {
  Client,
  Guild,
  EmbedBuilder,
  AuditLogEvent,
  PermissionsBitField,
  TextChannel,
  GuildMember
} from 'discord.js';

export interface WhitelistEntry {
  id: string;
  name: string;
  addedAt: number;
  addedBy: string;
}

export interface AntiRaidConfig {
  enabled: boolean;
  lockdownMode: boolean;
  channelCreateLimit: number;
  channelDeleteLimit: number;
  roleCreateLimit: number;
  roleDeleteLimit: number;
  banLimit: number;
  kickLimit: number;
  massJoinLimit: number; // số thành viên join trong 10 giây
  punishment: 'ban' | 'kick' | 'timeout';
  whitelist: WhitelistEntry[];
  logsChannelId: string | null;
}

export interface RaidIncident {
  id: string;
  timestamp: number;
  guildId: string;
  executorId: string;
  executorTag: string;
  actionType:
    | 'channel_create'
    | 'channel_delete'
    | 'role_create'
    | 'role_delete'
    | 'ban_limit'
    | 'kick_limit'
    | 'mass_join'
    | 'manual_lockdown';
  details: string;
  punishmentTaken: string;
  severity: 'critical' | 'high' | 'medium';
}

const DATA_FILE = path.join(process.cwd(), 'antiraid_data.json');

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

interface AntiRaidStorage {
  config: AntiRaidConfig;
  incidents: RaidIncident[];
}

function loadStorage(): AntiRaidStorage {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        config: { ...DEFAULT_CONFIG, ...(parsed.config || {}) },
        incidents: Array.isArray(parsed.incidents) ? parsed.incidents : []
      };
    }
  } catch (err) {
    console.error('Error loading antiraid_data.json:', err);
  }
  return {
    config: { ...DEFAULT_CONFIG },
    incidents: [
      {
        id: 'inc-init-1',
        timestamp: Date.now() - 1000 * 60 * 15,
        guildId: 'server-demo',
        executorId: 'bot-rogue-992',
        executorTag: 'RogueNuker#1337',
        actionType: 'channel_delete',
        details: 'Phát hiện cố tình xóa 3 kênh liên tiếp trong 5 giây',
        punishmentTaken: 'Banned vĩnh viễn & Khôi phục phân quyền',
        severity: 'critical'
      }
    ]
  };
}

let storage: AntiRaidStorage = loadStorage();

function saveStorage() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(storage, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving antiraid_data.json:', err);
  }
}

export function getAntiRaidConfig(): AntiRaidConfig {
  return storage.config;
}

export function updateAntiRaidConfig(patch: Partial<AntiRaidConfig>): AntiRaidConfig {
  storage.config = { ...storage.config, ...patch };
  saveStorage();
  return storage.config;
}

export function getRaidIncidents(): RaidIncident[] {
  return storage.incidents;
}

export function clearRaidIncidents() {
  storage.incidents = [];
  saveStorage();
}

export function addWhitelistUser(id: string, name: string, addedBy: string): boolean {
  if (storage.config.whitelist.some((w) => w.id === id)) {
    return false;
  }
  storage.config.whitelist.push({
    id,
    name,
    addedAt: Date.now(),
    addedBy
  });
  saveStorage();
  return true;
}

export function removeWhitelistUser(id: string): boolean {
  const initialLen = storage.config.whitelist.length;
  storage.config.whitelist = storage.config.whitelist.filter((w) => w.id !== id);
  if (storage.config.whitelist.length !== initialLen) {
    saveStorage();
    return true;
  }
  return false;
}

export function isUserWhitelisted(guild: Guild | null, userId: string): boolean {
  if (!guild) return false;
  // Chủ server luôn được miễn trừ
  if (guild.ownerId === userId) return true;
  // Bot client của chính mình luôn được miễn trừ
  if (guild.client.user?.id === userId) return true;
  // Danh sách whitelist đã thiết lập
  return storage.config.whitelist.some((w) => w.id === userId);
}

// Bộ nhớ đếm hành động trượt (sliding window 60s)
// key: `${guildId}_${userId}_${action}` -> array of timestamps
const actionCounters = new Map<string, number[]>();
// Bộ nhớ đếm member join trượt (10s)
const joinSurgeTimestamps: number[] = [];

function recordAndCheckLimit(
  guildId: string,
  userId: string,
  action: string,
  limit: number,
  windowMs: number = 60000
): { exceeded: boolean; count: number } {
  const key = `${guildId}_${userId}_${action}`;
  const now = Date.now();
  const times = (actionCounters.get(key) || []).filter((t) => now - t < windowMs);
  times.push(now);
  actionCounters.set(key, times);
  return {
    exceeded: times.length >= limit,
    count: times.length
  };
}

export function resetUserCounters(guildId: string, userId: string) {
  for (const key of actionCounters.keys()) {
    if (key.startsWith(`${guildId}_${userId}_`)) {
      actionCounters.delete(key);
    }
  }
}

// Thực thi xử phạt đối tượng phá hoại (Raid Executor)
export async function punishRaidExecutor(
  guild: Guild,
  executorId: string,
  executorTag: string,
  actionType: RaidIncident['actionType'],
  reason: string,
  severity: 'critical' | 'high' | 'medium' = 'critical'
) {
  let punishmentTaken = 'Cảnh cáo (Warning)';
  const punishType = storage.config.punishment;

  try {
    const member = await guild.members.fetch(executorId).catch(() => null);

    if (punishType === 'ban') {
      await guild.members.ban(executorId, {
        reason: `[SentinelBot Anti-Raid] ${reason}`
      });
      punishmentTaken = `Đã CẤM (Ban) vĩnh viễn khỏi Server`;
    } else if (punishType === 'kick' && member && member.kickable) {
      await member.kick(`[SentinelBot Anti-Raid] ${reason}`);
      punishmentTaken = `Đã ĐUỔI (Kick) khỏi Server`;
    } else if (punishType === 'timeout' && member && member.moderatable) {
      // Timeout 28 ngày
      await member.timeout(28 * 24 * 60 * 60 * 1000, `[SentinelBot Anti-Raid] ${reason}`);
      punishmentTaken = `Đã Cấm Chat (Timeout 28 ngày)`;
    } else {
      // Fallback ban
      await guild.members.ban(executorId, {
        reason: `[SentinelBot Anti-Raid] ${reason}`
      }).catch(() => {});
      punishmentTaken = `Đã Ban khẩn cấp`;
    }
  } catch (err: any) {
    console.error('Failed to apply punishment:', err);
    punishmentTaken = `Lỗi thực thi quyền (${err.message || 'Thiếu quyền Administrator'})`;
  }

  // Ghi nhật ký sự cố
  const incident: RaidIncident = {
    id: `inc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now(),
    guildId: guild.id,
    executorId,
    executorTag,
    actionType,
    details: reason,
    punishmentTaken,
    severity
  };

  storage.incidents.unshift(incident);
  if (storage.incidents.length > 50) {
    storage.incidents = storage.incidents.slice(0, 50);
  }
  saveStorage();

  // Gửi thông báo khẩn cấp đến kênh log hoặc hệ thống
  await broadcastRaidAlert(guild, incident);
}

// Bật/Tắt chế độ Lockdown khẩn cấp cho server
export async function toggleServerLockdown(guild: Guild, enable: boolean, reason: string = 'Kích hoạt lá chắn Anti-Raid') {
  storage.config.lockdownMode = enable;
  saveStorage();

  try {
    const everyoneRole = guild.roles.everyone;
    // Khóa/mở quyền gửi tin nhắn của @everyone trên các kênh văn bản
    const channels = await guild.channels.fetch();
    for (const [, channel] of channels) {
      if (channel && channel.isTextBased() && !channel.isDMBased()) {
        await (channel as any).permissionOverwrites.edit(everyoneRole, {
          SendMessages: enable ? false : null,
          AddReactions: enable ? false : null,
          CreatePublicThreads: enable ? false : null,
        }).catch(() => {});
      }
    }

    const incident: RaidIncident = {
      id: `lockdown-${Date.now()}`,
      timestamp: Date.now(),
      guildId: guild.id,
      executorId: 'SYSTEM',
      executorTag: 'SentinelBot Core',
      actionType: 'manual_lockdown',
      details: enable ? `Bật chế độ Khóa khẩn cấp (Panic Lockdown): ${reason}` : 'Mở khóa server sau sự cố raid',
      punishmentTaken: enable ? 'Đã khóa toàn bộ quyền chat của @everyone' : 'Đã khôi phục quyền chat',
      severity: enable ? 'critical' : 'medium'
    };
    storage.incidents.unshift(incident);
    saveStorage();
  } catch (err) {
    console.error('Error toggling server lockdown:', err);
  }
}

// Gửi cảnh báo Embed đẹp mắt
async function broadcastRaidAlert(guild: Guild, incident: RaidIncident) {
  let targetChannel: TextChannel | null = null;

  if (storage.config.logsChannelId) {
    targetChannel = (guild.channels.cache.get(storage.config.logsChannelId) as TextChannel) || null;
  }
  if (!targetChannel) {
    targetChannel = guild.systemChannel as TextChannel;
  }
  if (!targetChannel) {
    // Tìm kênh text đầu tiên có quyền gửi
    targetChannel = (guild.channels.cache.find(
      (c) => c.isTextBased() && !c.isDMBased() && (c as any).permissionsFor(guild.members.me!)?.has(PermissionsBitField.Flags.SendMessages)
    ) as TextChannel) || null;
  }

  if (!targetChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('🚨 CẢNH BÁO PHÁT HIỆN HÀNH VI TẤN CÔNG (ANTI-RAID TRIGGERED)')
    .setColor('#ED4245')
    .setThumbnail(guild.iconURL() || 'https://cdn.discordapp.com/embed/avatars/0.png')
    .setDescription(`Hệ thống Anti-Raid vừa ngăn chặn một vụ phá hoại máy chủ **${guild.name}**!`)
    .addFields(
      { name: '👤 Đối tượng vi phạm', value: `\`${incident.executorTag}\` (\`${incident.executorId}\`)`, inline: true },
      { name: '⚡ Hành vi vi phạm', value: `\`${incident.actionType}\``, inline: true },
      { name: '🛡️ Biện pháp xử phạt', value: `**${incident.punishmentTaken}**`, inline: false },
      { name: '📋 Chi tiết sự cố', value: incident.details, inline: false },
      { name: '⏱️ Thời điểm', value: `<t:${Math.floor(incident.timestamp / 1000)}:R>`, inline: true },
      { name: '🔒 Trạng thái Server', value: storage.config.lockdownMode ? '🔴 ĐANG KHÓA KHẨN CẤP' : '🟢 An toàn', inline: true }
    )
    .setFooter({ text: 'SentinelBot Anti-Raid Protection System' })
    .setTimestamp();

  await targetChannel.send({
    content: '@everyone 🚨 **CẢNH BÁO BẢO MẬT KHẨN CẤP:**',
    embeds: [embed]
  }).catch(() => {});
}

// Cài đặt toàn bộ Event Listeners cho Anti-Raid
export function setupAntiRaidListeners(client: Client) {
  // 1. Channel Create Rate Limit
  client.on('channelCreate', async (channel) => {
    if (!storage.config.enabled || !channel.guild) return;
    try {
      const logs = await channel.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.ChannelCreate
      }).catch(() => null);

      const entry = logs?.entries.first();
      if (!entry || !entry.executor || entry.executor.id === client.user?.id) return;

      const executor = entry.executor;
      if (isUserWhitelisted(channel.guild, executor.id)) return;

      const { exceeded, count } = recordAndCheckLimit(
        channel.guild.id,
        executor.id,
        'channel_create',
        storage.config.channelCreateLimit,
        60000
      );

      if (exceeded) {
        // Xóa ngay kênh rác vừa tạo
        await channel.delete('Anti-Raid: Kênh tạo bởi đối tượng spam channel').catch(() => {});
        await punishRaidExecutor(
          channel.guild,
          executor.id,
          executor.tag,
          'channel_create',
          `Tạo liên tiếp ${count} kênh vượt quá giới hạn cho phép (${storage.config.channelCreateLimit}/phút)`,
          'critical'
        );
      }
    } catch (err) {
      console.error('Error in anti-raid channelCreate:', err);
    }
  });

  // 2. Channel Delete Rate Limit
  client.on('channelDelete', async (channel) => {
    if (!storage.config.enabled || !('guild' in channel) || !channel.guild) return;
    try {
      const logs = await channel.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.ChannelDelete
      }).catch(() => null);

      const entry = logs?.entries.first();
      if (!entry || !entry.executor || entry.executor.id === client.user?.id) return;

      const executor = entry.executor;
      if (isUserWhitelisted(channel.guild, executor.id)) return;

      const { exceeded, count } = recordAndCheckLimit(
        channel.guild.id,
        executor.id,
        'channel_delete',
        storage.config.channelDeleteLimit,
        60000
      );

      if (exceeded) {
        await punishRaidExecutor(
          channel.guild,
          executor.id,
          executor.tag,
          'channel_delete',
          `Cố tình xóa liên tiếp ${count} kênh (Giới hạn: ${storage.config.channelDeleteLimit}/phút)`,
          'critical'
        );
      }
    } catch (err) {
      console.error('Error in anti-raid channelDelete:', err);
    }
  });

  // 3. Role Create Rate Limit
  client.on('roleCreate', async (role) => {
    if (!storage.config.enabled || !role.guild) return;
    try {
      const logs = await role.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.RoleCreate
      }).catch(() => null);

      const entry = logs?.entries.first();
      if (!entry || !entry.executor || entry.executor.id === client.user?.id) return;

      const executor = entry.executor;
      if (isUserWhitelisted(role.guild, executor.id)) return;

      const { exceeded, count } = recordAndCheckLimit(
        role.guild.id,
        executor.id,
        'role_create',
        storage.config.roleCreateLimit,
        60000
      );

      if (exceeded) {
        await role.delete('Anti-Raid: Role tạo bởi đối tượng spam vai trò').catch(() => {});
        await punishRaidExecutor(
          role.guild,
          executor.id,
          executor.tag,
          'role_create',
          `Tạo liên tiếp ${count} vai trò (role) vượt ngưỡng an toàn (${storage.config.roleCreateLimit}/phút)`,
          'high'
        );
      }
    } catch (err) {
      console.error('Error in anti-raid roleCreate:', err);
    }
  });

  // 4. Role Delete Rate Limit
  client.on('roleDelete', async (role) => {
    if (!storage.config.enabled || !role.guild) return;
    try {
      const logs = await role.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.RoleDelete
      }).catch(() => null);

      const entry = logs?.entries.first();
      if (!entry || !entry.executor || entry.executor.id === client.user?.id) return;

      const executor = entry.executor;
      if (isUserWhitelisted(role.guild, executor.id)) return;

      const { exceeded, count } = recordAndCheckLimit(
        role.guild.id,
        executor.id,
        'role_delete',
        storage.config.roleDeleteLimit,
        60000
      );

      if (exceeded) {
        await punishRaidExecutor(
          role.guild,
          executor.id,
          executor.tag,
          'role_delete',
          `Xóa hàng loạt ${count} vai trò máy chủ (Giới hạn: ${storage.config.roleDeleteLimit}/phút)`,
          'critical'
        );
      }
    } catch (err) {
      console.error('Error in anti-raid roleDelete:', err);
    }
  });

  // 5. Member Ban Limit (Mass Ban Detection)
  client.on('guildBanAdd', async (ban) => {
    if (!storage.config.enabled || !ban.guild) return;
    try {
      const logs = await ban.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MemberBanAdd
      }).catch(() => null);

      const entry = logs?.entries.first();
      if (!entry || !entry.executor || entry.executor.id === client.user?.id) return;

      const executor = entry.executor;
      if (isUserWhitelisted(ban.guild, executor.id)) return;

      const { exceeded, count } = recordAndCheckLimit(
        ban.guild.id,
        executor.id,
        'ban_limit',
        storage.config.banLimit,
        60000
      );

      if (exceeded) {
        await punishRaidExecutor(
          ban.guild,
          executor.id,
          executor.tag,
          'ban_limit',
          `Thực hiện Ban hàng loạt (${count} thành viên/phút). Nghi vấn bot rogue hoặc tài khoản admin bị hack!`,
          'critical'
        );
      }
    } catch (err) {
      console.error('Error in anti-raid guildBanAdd:', err);
    }
  });

  // 6. Member Kick Limit (Mass Kick Detection)
  client.on('guildMemberRemove', async (member) => {
    if (!storage.config.enabled || !member.guild) return;
    try {
      const logs = await member.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MemberKick
      }).catch(() => null);

      const entry = logs?.entries.first();
      if (!entry || !entry.executor || entry.executor.id === client.user?.id) return;

      // Đảm bảo thời gian log diễn ra gần đây (< 5s)
      if (Date.now() - entry.createdTimestamp > 5000) return;

      const executor = entry.executor;
      if (isUserWhitelisted(member.guild, executor.id)) return;

      const { exceeded, count } = recordAndCheckLimit(
        member.guild.id,
        executor.id,
        'kick_limit',
        storage.config.kickLimit,
        60000
      );

      if (exceeded) {
        await punishRaidExecutor(
          member.guild,
          executor.id,
          executor.tag,
          'kick_limit',
          `Kick hàng loạt (${count} thành viên/phút). Hành vi phá hoại cộng đồng!`,
          'critical'
        );
      }
    } catch (err) {
      console.error('Error in anti-raid guildMemberRemove:', err);
    }
  });

  // 7. Mass Join Detection (Bot Raid / Token Attack)
  client.on('guildMemberAdd', async (member: GuildMember) => {
    if (!storage.config.enabled || !member.guild) return;
    try {
      const now = Date.now();
      // Lọc các lượt join trong 10 giây gần nhất
      joinSurgeTimestamps.push(now);
      const recentJoins = joinSurgeTimestamps.filter((t) => now - t < 10000);

      // Nếu số lượng join vượt quá massJoinLimit
      if (recentJoins.length >= storage.config.massJoinLimit) {
        // Tự động kích hoạt Lockdown Mode khẩn cấp
        if (!storage.config.lockdownMode) {
          await toggleServerLockdown(
            member.guild,
            true,
            `Phát hiện đợt tham gia ồ ạt (${recentJoins.length} tài khoản trong 10 giây). Nghi vấn BOT RAID / TOKEN RAID!`
          );
        }

        // Nếu thành viên mới là BOT và không có trong whitelist -> Kick/Ban ngay
        if (member.user.bot && !isUserWhitelisted(member.guild, member.id)) {
          await member.kick('Anti-Raid: Ngăn chặn Bot lạ tham gia trong đợt Raid').catch(() => {});
        }
      }
    } catch (err) {
      console.error('Error in anti-raid guildMemberAdd:', err);
    }
  });
}
