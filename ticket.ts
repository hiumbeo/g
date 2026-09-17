import {
  Client,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  GuildTextBasedChannel,
  Guild,
  User,
  TextChannel,
  CategoryChannel,
  CommandInteraction,
} from 'discord.js';

export interface TicketConfig {
  panelTitle: string;
  panelDescription: string;
  panelColor: string;
  panelImageUrl?: string;
  panelButtonLabel: string;
  supportRoleId?: string;
  categoryName?: string;
}

// Lưu trữ ticket đang hoạt động trong bộ nhớ (kênh ID -> thông tin ticket)
export interface ActiveTicket {
  channelId: string;
  guildId: string;
  userId: string;
  username: string;
  createdAt: number;
  type: string;
}

const activeTickets = new Map<string, ActiveTicket>();
// Giới hạn 1 ticket mở đồng thời cho mỗi user trên mỗi server để chống spam
const userOpenTickets = new Map<string, string>(); // key: `${guildId}-${userId}`, value: channelId

export const defaultTicketConfig: TicketConfig = {
  panelTitle: '📩 HỆ THỐNG HỖ TRỢ TICKET',
  panelDescription: `Vui lòng nhấn nút bên dưới để tạo ticket khi bạn cần trung gian mua bán, trao đổi tài sản để tránh lừa đảo.

Khi vào ticket, vui lòng cung cấp đầy đủ thông tin:
• **Bên mua:** @tag
• **Bên bán:** @tag
• **Nội dung giao dịch:**
• **Số tiền / Giá trị:**
• **Ai chịu phí trung gian:**

⚠️ **Lưu ý:** Tuyệt đối không giao dịch ngoài ticket hoặc chuyển tiền khi chưa có xác nhận từ Trung Gian chính thức!

👉 **Bấm vào nút bên dưới để tạo phiên làm việc với Trung Gian.**`,
  panelColor: '#5865F2',
  panelImageUrl: 'https://i.pinimg.com/1200x/61/05/82/610582ed1ad99e5e455fe16a4b3a9ab1.jpg',
  panelButtonLabel: '🎟️ Tạo Ticket',
  supportRoleId: '1548274995325706361',
  categoryName: 'TICKETS',
};

let currentTicketConfig: TicketConfig = { ...defaultTicketConfig };

export function getTicketConfig(): TicketConfig {
  return currentTicketConfig;
}

export function updateTicketConfig(newConfig: Partial<TicketConfig>): TicketConfig {
  currentTicketConfig = { ...currentTicketConfig, ...newConfig };
  return currentTicketConfig;
}

export function setTicketImage(imageUrl: string): TicketConfig {
  currentTicketConfig.panelImageUrl = imageUrl.trim();
  return currentTicketConfig;
}

/**
 * Xây dựng Embed và Nút bấm mở Ticket chuẩn như mẫu ảnh
 */
export function buildTicketPanel(config: TicketConfig = currentTicketConfig) {
  const embed = new EmbedBuilder()
    .setTitle(config.panelTitle)
    .setDescription(config.panelDescription)
    .setColor((config.panelColor as any) || '#5865F2')
    .setTimestamp();

  if (config.panelImageUrl && (config.panelImageUrl.startsWith('http://') || config.panelImageUrl.startsWith('https://'))) {
    embed.setImage(config.panelImageUrl);
  }

  embed.setFooter({
    text: `SentinelBot Ticket System • Uy Tín & An Toàn`,
    iconURL: 'https://cdn.discordapp.com/emojis/1042732917789458463.webp?size=96&quality=lossless',
  });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_create_ticket')
      .setLabel(config.panelButtonLabel || '🎟️ Tạo Ticket')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🎟️')
  );

  return { embed, row };
}

/**
 * Xử lý khi người dùng bấm nút "Tạo Ticket"
 */
export async function handleCreateTicketButton(interaction: ButtonInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: 'Lệnh này chỉ dùng trong Server!', ephemeral: true });
    return;
  }

  const { guild, user } = interaction;
  const userTicketKey = `${guild.id}-${user.id}`;

  // Kiểm tra xem người dùng đã có ticket chưa
  const existingChannelId = userOpenTickets.get(userTicketKey);
  if (existingChannelId) {
    const existingChannel = guild.channels.cache.get(existingChannelId);
    if (existingChannel) {
      await interaction.reply({
        content: `⚠️ Bạn đã có một ticket đang mở tại kênh <#${existingChannelId}>! Vui lòng hoàn tất hoặc đóng ticket cũ trước khi tạo thêm.`,
        ephemeral: true,
      });
      return;
    } else {
      userOpenTickets.delete(userTicketKey);
    }
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // Tìm hoặc tạo category cho Tickets
    let category = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name.toUpperCase() === (currentTicketConfig.categoryName || 'TICKETS').toUpperCase()
    ) as CategoryChannel | undefined;

    if (!category) {
      try {
        category = await guild.channels.create({
          name: currentTicketConfig.categoryName || 'TICKETS',
          type: ChannelType.GuildCategory,
        });
      } catch (catErr) {
        console.warn('Không thể tạo Category riêng cho ticket, sẽ tạo kênh ở root:', catErr);
      }
    }

    // Tên kênh: ticket-username
    const sanitizedName = user.username.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 15) || 'user';
    const channelName = `ticket-${sanitizedName}`;

    // Thiết lập phân quyền bảo mật cao:
    // 1. @everyone: Không xem được
    // 2. User tạo ticket: Xem, gửi tin, đính kèm file, đọc lịch sử
    // 3. Bot: Toàn quyền
    const permissionOverwrites: any[] = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      },
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
    ];

    if (guild.members.me) {
      permissionOverwrites.push({
        id: guild.members.me.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
        ],
      });
    }

    // Phân quyền cho Role Trung Gian xem và nhắn tin trong ticket
    const middlemanRoleId = currentTicketConfig.supportRoleId || '1548274995325706361';
    permissionOverwrites.push({
      id: middlemanRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    });

    // Tạo kênh Ticket
    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category ? category.id : undefined,
      topic: `Ticket giao dịch của @${user.tag} (ID: ${user.id}) • SentinelBot Ticket System`,
      permissionOverwrites,
    });

    // Lưu trạng thái
    activeTickets.set(ticketChannel.id, {
      channelId: ticketChannel.id,
      guildId: guild.id,
      userId: user.id,
      username: user.tag,
      createdAt: Date.now(),
      type: 'general',
    });
    userOpenTickets.set(userTicketKey, ticketChannel.id);

    // Gửi tin nhắn chào mừng và hướng dẫn bên trong kênh ticket vừa tạo
    const welcomeEmbed = new EmbedBuilder()
      .setTitle(`🎫 PHIÊN TRUNG GIAN GIAO DỊCH #${ticketChannel.name.toUpperCase()}`)
      .setColor('#22C55E')
      .setDescription(
        `Xin chào <@${user.id}>! Phiên ticket của bạn đã được khởi tạo thành công.\n\n` +
        `📝 **Vui lòng cung cấp đầy đủ thông tin giao dịch:**\n` +
        `• **Bên mua:** \n` +
        `• **Bên bán:** \n` +
        `• **Nội dung & Số tiền / Giá trị:** \n` +
        `• **Ai chịu phí trung gian:** \n\n` +
        `💡 *Sau khi hai bên đã vào kênh và điền xong thông tin, vui lòng bấm nút **🔔 Gọi Trung Gian** bên dưới để Trung Gian vào làm việc!*`
      )
      .addFields(
        { name: '👤 Người tạo', value: `<@${user.id}>`, inline: true },
        { name: '⏰ Thời gian mở', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
      )
      .setFooter({ text: 'Nhấn nút bên dưới để đóng ticket hoặc gọi trung gian' })
      .setTimestamp();

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_close_ticket')
        .setLabel('🔒 Đóng Ticket')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒'),
      new ButtonBuilder()
        .setCustomId('btn_ping_admin')
        .setLabel('🔔 Gọi Trung Gian')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔔')
    );

    await ticketChannel.send({
      content: `<@${user.id}> Đã mở ticket giao dịch mới!`,
      embeds: [welcomeEmbed],
      components: [actionRow],
    });

    await interaction.editReply({
      content: `✅ Ticket của bạn đã được tạo thành công tại kênh: <#${ticketChannel.id}>`,
    });
  } catch (err: any) {
    console.error('Lỗi khi tạo ticket channel:', err);
    await interaction.editReply({
      content: `❌ Không thể tạo kênh Ticket: ${err.message || 'Lỗi quyền hạn Discord (Vui lòng kiểm tra quyền Manage Channels của Bot).'}`
    });
  }
}

/**
 * Xử lý khi nhấn nút Đóng Ticket (hoặc xác nhận đóng)
 */
export async function handleCloseTicketButton(interaction: ButtonInteraction) {
  if (!interaction.guild || !interaction.channel) return;

  const channel = interaction.channel as TextChannel;
  const ticketData = activeTickets.get(channel.id);

  const confirmEmbed = new EmbedBuilder()
    .setTitle('⚠️ XÁC NHẬN ĐÓNG TICKET')
    .setColor('#ED4245')
    .setDescription(
      `Bạn có chắc chắn muốn đóng và xóa kênh ticket này không?\nKênh sẽ tự động lưu thông tin và xóa sau **5 giây**.`
    );

  const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_confirm_close')
      .setLabel('✅ Xác nhận xóa kênh')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('btn_cancel_close')
      .setLabel('❌ Hủy bỏ')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({ embeds: [confirmEmbed], components: [confirmRow] });
}

/**
 * Xác nhận xóa kênh Ticket
 */
export async function handleConfirmClose(interaction: ButtonInteraction) {
  if (!interaction.guild || !interaction.channel) return;

  const channel = interaction.channel as TextChannel;
  const ticketData = activeTickets.get(channel.id);

  if (ticketData) {
    userOpenTickets.delete(`${ticketData.guildId}-${ticketData.userId}`);
    activeTickets.delete(channel.id);
  }

  await interaction.reply({
    content: '🗑️ Kênh ticket sẽ được xóa trong 5 giây...',
  });

  setTimeout(async () => {
    try {
      await channel.delete('Ticket đã hoàn tất và đóng bởi người dùng.');
    } catch (err) {
      console.warn('Không thể xóa kênh ticket:', err);
    }
  }, 5000);
}

/**
 * Xử lý nút Gọi Trung Gian
 */
export async function handlePingAdmin(interaction: ButtonInteraction) {
  if (!interaction.guild) return;
  const middlemanRoleId = currentTicketConfig.supportRoleId || '1548274995325706361';

  await interaction.reply({
    content: `🔔 <@&${middlemanRoleId}>! Người tạo ticket <@${interaction.user.id}> đang gọi Trung Gian vào hỗ trợ phiên giao dịch này!`,
  });
}

/**
 * Tạo Embed tự do theo yêu cầu người dùng
 */
export function buildCustomEmbed(options: {
  title?: string;
  description?: string;
  color?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  footerText?: string;
  authorName?: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
}) {
  const embed = new EmbedBuilder();

  if (options.title) embed.setTitle(options.title);
  if (options.description) embed.setDescription(options.description);
  if (options.color) embed.setColor((options.color as any) || '#5865F2');
  if (options.imageUrl && options.imageUrl.startsWith('http')) embed.setImage(options.imageUrl);
  if (options.thumbnailUrl && options.thumbnailUrl.startsWith('http')) embed.setThumbnail(options.thumbnailUrl);
  if (options.footerText) embed.setFooter({ text: options.footerText });
  if (options.authorName) embed.setAuthor({ name: options.authorName });
  if (options.fields && options.fields.length > 0) embed.addFields(options.fields);

  embed.setTimestamp();
  return embed;
}
