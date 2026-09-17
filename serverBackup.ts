import {
  Guild,
  Role,
  ChannelType,
  GuildChannel,
  PermissionsBitField,
  CategoryChannel,
  TextChannel,
  VoiceChannel,
  JSONEncodable,
} from 'discord.js';
import fs from 'fs';
import path from 'path';

const BACKUP_DIR = path.join(process.cwd(), 'server_backups');

export async function captureServerBackup(guild: Guild): Promise<string> {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
  }

  const backup = {
    guildName: guild.name,
    timestamp: new Date().toISOString(),
    roles: guild.roles.cache
      .filter(r => !r.managed && r.name !== '@everyone')
      .map(r => ({
        name: r.name,
        color: r.color,
        permissions: r.permissions.bitfield.toString(),
        position: r.position,
      })),
    channels: guild.channels.cache
      .filter(c => c.type !== ChannelType.GuildCategory)
      .map(c => ({
        name: c.name,
        type: c.type,
        parentId: c.parentId,
        position: c.position,
        permissions: c.permissionOverwrites.cache.map(po => ({
            id: po.id,
            allow: po.allow.bitfield.toString(),
            deny: po.deny.bitfield.toString(),
        })),
      })),
  };

  const filename = `backup-${guild.id}-${Date.now()}.json`;
  fs.writeFileSync(path.join(BACKUP_DIR, filename), JSON.stringify(backup, null, 2));

  return `✅ Đã sao lưu cấu trúc server thành công! File: \`${filename}\``;
}
