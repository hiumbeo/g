import {
  Message,
  Client,
  GuildMember,
  User,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  UserFlagsBitField,
} from 'discord.js';

export interface ResolvedUserTarget {
  user: User;
  member: GuildMember | null;
}

/**
 * Tìm kiếm User / Member từ tin nhắn theo tag mention, ID hoặc tìm theo tên
 */
export async function resolveTargetUserAndMember(
  message: Message,
  args: string[],
  client: Client
): Promise<ResolvedUserTarget> {
  // 1. Kiểm tra tag mention
  const mentionedMember = message.mentions.members?.first();
  const mentionedUser = message.mentions.users?.first();
  if (mentionedMember) {
    const fullUser = await client.users.fetch(mentionedMember.id, { force: true }).catch(() => mentionedMember.user);
    return { user: fullUser, member: mentionedMember };
  }
  if (mentionedUser) {
    const fullUser = await client.users.fetch(mentionedUser.id, { force: true }).catch(() => mentionedUser);
    const member = message.guild?.members.cache.get(mentionedUser.id) || null;
    return { user: fullUser, member };
  }

  // 2. Kiểm tra nếu có truyền tham số ID hoặc Username
  const rawArg = args[0]?.trim();
  if (rawArg) {
    const cleanedId = rawArg.replace(/[^0-9]/g, '');

    // Tìm theo ID (snowflake 17-20 chữ số)
    if (cleanedId.length >= 17 && cleanedId.length <= 21) {
      try {
        const fetchedUser = await client.users.fetch(cleanedId, { force: true });
        let member: GuildMember | null = null;
        if (message.guild) {
          member = await message.guild.members.fetch(cleanedId).catch(() => null);
        }
        return { user: fetchedUser, member };
      } catch {
        // Tiếp tục thử tìm theo tên
      }
    }

    // Tìm theo tên trong server
    if (message.guild) {
      const searchName = rawArg.toLowerCase();
      const matchedMember = message.guild.members.cache.find(
        (m) =>
          m.user.username.toLowerCase() === searchName ||
          m.displayName.toLowerCase() === searchName ||
          m.user.tag.toLowerCase() === searchName
      );
      if (matchedMember) {
        const fullUser = await client.users.fetch(matchedMember.id, { force: true }).catch(() => matchedMember.user);
        return { user: fullUser, member: matchedMember };
      }
    }
  }

  // 3. Mặc định lấy chính người gọi lệnh
  const fullAuthor = await client.users.fetch(message.author.id, { force: true }).catch(() => message.author);
  return { user: fullAuthor, member: message.member };
}

/**
 * Lấy danh sách huy hiệu (Badges) của người dùng
 */
export function getUserBadges(user: User): string[] {
  const flags = user.flags?.toArray() || [];
  const badges: string[] = [];

  if (flags.includes('Staff' as any)) badges.push('🛡️ Discord Staff');
  if (flags.includes('Partner' as any)) badges.push('🤝 Đối tác Discord');
  if (flags.includes('Hypesquad' as any)) badges.push('🎉 HypeSquad Events');
  if (flags.includes('BugHunterLevel1' as any)) badges.push('🐛 Bug Hunter Level 1');
  if (flags.includes('BugHunterLevel2' as any)) badges.push('🐛 Bug Hunter Level 2');
  if (flags.includes('HypeSquadOnlineHouse1' as any)) badges.push('⚔️ HypeSquad Bravery');
  if (flags.includes('HypeSquadOnlineHouse2' as any)) badges.push('✨ HypeSquad Brilliance');
  if (flags.includes('HypeSquadOnlineHouse3' as any)) badges.push('⚖️ HypeSquad Balance');
  if (flags.includes('PremiumEarlySupporter' as any)) badges.push('👑 Early Supporter');
  if (flags.includes('VerifiedBot' as any)) badges.push('🤖 Bot đã xác minh');
  if (flags.includes('VerifiedDeveloper' as any)) badges.push('👨‍💻 Early Verified Developer');
  if (flags.includes('ActiveDeveloper' as any)) badges.push('🛠️ Active Developer');

  if (user.bot) {
    badges.push('🤖 Bot');
  }

  return badges;
}

/**
 * Tạo Embed hiển thị thông tin người dùng (.w / .whois / .userinfo)
 */
export function buildWhoisEmbed(member: GuildMember | null, user: User) {
  const avatarUrl = user.displayAvatarURL({ size: 1024, forceStatic: false });
  const bannerUrl = user.bannerURL({ size: 1024, forceStatic: false });
  const badges = getUserBadges(user);

  const embed = new EmbedBuilder()
    .setTitle(`👤 THÔNG TIN NGƯỜI DÙNG: ${user.tag}`)
    .setColor(member?.displayHexColor && member.displayHexColor !== '#000000' ? member.displayHexColor : (user.hexAccentColor || '#5865F2'))
    .setThumbnail(avatarUrl)
    .addFields(
      {
        name: '🪪 Danh Tính & ID',
        value: `• **Tên hiển thị:** ${member?.displayName || user.globalName || user.username}\n• **Username:** \`@${user.username}\`\n• **User ID:** \`${user.id}\`\n• **Loại tài khoản:** ${user.bot ? '🤖 Bot' : '👤 Người dùng'}`,
        inline: false,
      },
      {
        name: '📅 Thời Gian',
        value: `• **Tạo tài khoản:** <t:${Math.floor(user.createdTimestamp / 1000)}:F>\n  └ (<t:${Math.floor(user.createdTimestamp / 1000)}:R>)\n` +
               (member?.joinedTimestamp ? `• **Tham gia server:** <t:${Math.floor(member.joinedTimestamp / 1000)}:F>\n  └ (<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)` : '• **Tham gia server:** *Không ở trong server*'),
        inline: false,
      }
    );

  if (badges.length > 0) {
    embed.addFields({
      name: '🎖️ Huy Hiệu & Danh Hiệu',
      value: badges.join(' • '),
      inline: false,
    });
  }

  if (member) {
    // Lấy danh sách Roles (bỏ @everyone)
    const roles = member.roles.cache
      .filter((r) => r.id !== member.guild.id)
      .sort((a, b) => b.position - a.position);

    const rolesCount = roles.size;
    let rolesDisplay = '*Không có role nào*';
    if (rolesCount > 0) {
      const topRoles = roles.map((r) => `<@&${r.id}>`).slice(0, 15);
      rolesDisplay = topRoles.join(' ');
      if (rolesCount > 15) {
        rolesDisplay += ` *+${rolesCount - 15} role khác*`;
      }
    }

    embed.addFields(
      {
        name: `🎭 Vai Trò Trong Server [${rolesCount}]`,
        value: `• **Vai trò cao nhất:** ${member.roles.highest.id !== member.guild.id ? `<@&${member.roles.highest.id}>` : '*Mặc định*'}\n• **Danh sách:** ${rolesDisplay}`,
        inline: false,
      }
    );

    // Quyền hạn quan trọng
    const keyPerms: string[] = [];
    if (member.permissions.has(PermissionsBitField.Flags.Administrator)) keyPerms.push('Quản Trị Viên (Administrator)');
    else {
      if (member.permissions.has(PermissionsBitField.Flags.ManageGuild)) keyPerms.push('Quản lý Server');
      if (member.permissions.has(PermissionsBitField.Flags.ManageChannels)) keyPerms.push('Quản lý Kênh');
      if (member.permissions.has(PermissionsBitField.Flags.ManageRoles)) keyPerms.push('Quản lý Role');
      if (member.permissions.has(PermissionsBitField.Flags.BanMembers)) keyPerms.push('Ban Thành Viên');
      if (member.permissions.has(PermissionsBitField.Flags.KickMembers)) keyPerms.push('Kick Thành Viên');
      if (member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) keyPerms.push('Timeout Thành Viên');
    }

    if (keyPerms.length > 0) {
      embed.addFields({
        name: '🛡️ Quyền Hạn Nổi Bật',
        value: `\`${keyPerms.join(' • ')}\``,
        inline: false,
      });
    }
  }

  if (bannerUrl) {
    embed.setImage(bannerUrl);
  }

  embed.setFooter({ text: `Yêu cầu thông tin • SentinelBot • ID: ${user.id}` });
  embed.setTimestamp();

  // Tạo các nút tương tác
  const buttons: ButtonBuilder[] = [
    new ButtonBuilder()
      .setLabel('🖼️ Xem Avatar')
      .setStyle(ButtonStyle.Link)
      .setURL(avatarUrl),
  ];

  if (bannerUrl) {
    buttons.push(
      new ButtonBuilder()
        .setLabel('🎨 Xem Banner')
        .setStyle(ButtonStyle.Link)
        .setURL(bannerUrl)
    );
  }

  buttons.push(
    new ButtonBuilder()
      .setLabel('🔗 Profile Link')
      .setStyle(ButtonStyle.Link)
      .setURL(`https://discord.com/users/${user.id}`)
  );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

  return { embed, row };
}

/**
 * Tạo Embed hiển thị Avatar (.avt / .avatar / .pfp)
 */
export function buildAvatarEmbed(member: GuildMember | null, user: User) {
  const globalAvatar = user.displayAvatarURL({ size: 1024, forceStatic: false });
  const serverAvatar = member?.avatar ? member.avatarURL({ size: 1024, forceStatic: false }) : null;
  const isAnimated = user.avatar?.startsWith('a_') || member?.avatar?.startsWith('a_');

  // Ưu tiên hiển thị server avatar nếu có, hoặc global avatar
  const primaryAvatar = serverAvatar || globalAvatar;

  const embed = new EmbedBuilder()
    .setTitle(`🖼️ Avatar của ${user.tag}`)
    .setColor(member?.displayHexColor && member.displayHexColor !== '#000000' ? member.displayHexColor : (user.hexAccentColor || '#5865F2'))
    .setDescription(
      `👤 **Người dùng:** <@${user.id}> (\`${user.id}\`)\n` +
      (serverAvatar ? `✨ *Thành viên này có ảnh đại diện riêng trong server!*` : '')
    )
    .setImage(primaryAvatar)
    .setFooter({ text: `SentinelBot Avatar Viewer • Định dạng: ${isAnimated ? 'GIF / PNG' : 'PNG / WEBP'}` })
    .setTimestamp();

  const buttons: ButtonBuilder[] = [
    new ButtonBuilder()
      .setLabel('🌐 Global Avatar (Full HD)')
      .setStyle(ButtonStyle.Link)
      .setURL(globalAvatar),
  ];

  if (serverAvatar) {
    buttons.push(
      new ButtonBuilder()
        .setLabel('🏠 Server Avatar')
        .setStyle(ButtonStyle.Link)
        .setURL(serverAvatar)
    );
  }

  // Nút tải định dạng PNG chuẩn
  const pngUrl = user.displayAvatarURL({ size: 2048, extension: 'png' });
  buttons.push(
    new ButtonBuilder()
      .setLabel('💾 Tải PNG 2048px')
      .setStyle(ButtonStyle.Link)
      .setURL(pngUrl)
  );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
  return { embed, row };
}

/**
 * Tạo Embed hiển thị Banner (.banner)
 */
export function buildBannerEmbed(user: User, member: GuildMember | null) {
  const bannerUrl = user.bannerURL({ size: 2048, forceStatic: false });
  const accentColor = user.hexAccentColor;
  const isAnimated = user.banner?.startsWith('a_');

  const embed = new EmbedBuilder()
    .setTitle(`🎨 Banner của ${user.tag}`)
    .setColor(accentColor || (member?.displayHexColor && member.displayHexColor !== '#000000' ? member.displayHexColor : '#5865F2'))
    .setTimestamp();

  if (bannerUrl) {
    embed.setDescription(
      `👤 **Người dùng:** <@${user.id}> (\`${user.id}\`)\n` +
      `🎨 **Mã màu Accent:** \`${accentColor || 'Mặc định'}\`\n` +
      `📁 **Định dạng:** ${isAnimated ? 'Ảnh động (GIF)' : 'Ảnh tĩnh (PNG)'}`
    );
    embed.setImage(bannerUrl);
    embed.setFooter({ text: 'SentinelBot Banner Viewer' });

    const buttons: ButtonBuilder[] = [
      new ButtonBuilder()
        .setLabel('🎨 Xem / Tải Banner Full Size')
        .setStyle(ButtonStyle.Link)
        .setURL(bannerUrl),
      new ButtonBuilder()
        .setLabel('🖼️ Xem Avatar')
        .setStyle(ButtonStyle.Link)
        .setURL(user.displayAvatarURL({ size: 1024, forceStatic: false })),
    ];

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
    return { embed, row, hasBanner: true };
  } else {
    embed.setDescription(
      `👤 **Người dùng:** <@${user.id}> (\`${user.id}\`)\n\n` +
      `⚠️ **Người dùng này chưa thiết lập Ảnh bìa (Banner) cá nhân!**\n` +
      (accentColor
        ? `🎨 **Màu nền đại diện (Accent Color):** \`${accentColor}\``
        : `🎨 *Không có màu nền đại diện tùy chỉnh.*`)
    );
    if (accentColor) {
      embed.setFooter({ text: `Màu nền profile: ${accentColor}` });
    }
    embed.setThumbnail(user.displayAvatarURL({ size: 512, forceStatic: false }));

    const buttons: ButtonBuilder[] = [
      new ButtonBuilder()
        .setLabel('🖼️ Xem Avatar của họ')
        .setStyle(ButtonStyle.Link)
        .setURL(user.displayAvatarURL({ size: 1024, forceStatic: false })),
    ];
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
    return { embed, row, hasBanner: false };
  }
}
