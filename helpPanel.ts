import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  StringSelectMenuInteraction,
  ButtonInteraction,
} from 'discord.js';

export function buildHelpPanel(prefix: string, category: string = 'home', requestedUserId?: string) {
  const embed = new EmbedBuilder();
  const footerText = requestedUserId
    ? `Yêu cầu bởi ID: ${requestedUserId} • SentinelBot Multi-System`
    : 'SentinelBot Multi-System • Bấm nút hoặc chọn menu để đổi danh mục';

  switch (category) {
    case 'security':
      embed
        .setTitle('🚨 BẢO MẬT, ANTI-RAID & QUẢN TRỊ SERVER')
        .setColor('#ef233c')
        .setDescription(
          `Hệ thống an ninh đa tầng bảo vệ máy chủ khỏi nuke bot, spammer và các cuộc tấn công raid phá hoại.\n` +
          `*Prefix máy chủ hiện tại:* \`${prefix}\`\n`
        )
        .addFields(
          {
            name: '🛡️ Lá Chắn Anti-Raid & Phòng Chống Nuke',
            value:
              `• \`${prefix}antiraid <on/off/config>\`: Bật, tắt hoặc kiểm tra cấu hình lá chắn.\n` +
              `• \`${prefix}antiraid limit <loại> <số>\`: Đặt giới hạn hành vi tối đa trong 10s.\n` +
              `• \`${prefix}lockdown <on/off>\`: Khóa khẩn cấp toàn bộ kênh chat trong server.\n` +
              `• \`${prefix}whitelist @user\`: Thêm thành viên tin cậy được miễn trừ kiểm duyệt.\n` +
              `• \`${prefix}delwhitelist @user\`: Xóa thành viên khỏi danh sách tin cậy.\n` +
              `• \`${prefix}whitelisted\`: Xem danh sách thành viên trong Whitelist.\n` +
              `• \`${prefix}raidlogs\`: Xem nhật ký 20 hành vi xâm phạm gần nhất.`
          },
          {
            name: '⚔️ Quản Trị & Trừng Phạt (Moderation)',
            value:
              `• \`${prefix}clean <số|bot|@user|links>\`: Quét dọn tin nhắn hàng loạt siêu nhanh.\n` +
              `• \`${prefix}snipe\`: Xem tin nhắn vừa bị xóa gần nhất trong kênh.\n` +
              `• \`${prefix}lock\` / \`${prefix}unlock\`: Khóa hoặc mở khóa kênh chat hiện tại.\n` +
              `• \`${prefix}slowmode <giây>\`: Đặt thời gian chờ giữa các lần chat.\n` +
              `• \`${prefix}kick @user [lý do]\`: Trục xuất thành viên khỏi server.\n` +
              `• \`${prefix}ban @user [lý do]\`: Cấm vĩnh viễn thành viên khỏi server.\n` +
              `• \`${prefix}timeout @user <phút>\`: Cách ly (mute) thành viên vi phạm.`
          },
          {
            name: '🔍 Quét Mã Độc & Link Phishing',
            value:
              `• \`${prefix}scanweb <url>\`: Phân tích độ an toàn của đường link lạ.\n` +
              `• \`${prefix}scanfile\`: Quét mã độc tệp đính kèm.`
          }
        )
        .setFooter({ text: footerText })
        .setTimestamp();
      break;

    case 'music':
      embed
        .setTitle('🎵 ÂM NHẠC ĐA NỀN TẢNG (YOUTUBE • SPOTIFY • SOUNDCLOUD)')
        .setColor('#2ec4b6')
        .setDescription(
          `Trình phát nhạc chất lượng cao hỗ trợ YouTube, Spotify playlist, SoundCloud và direct audio.\n` +
          `*Có thể dùng tiền tố \`${prefix}\` hoặc Slash Command \`/\`.*\n`
        )
        .addFields(
          {
            name: '▶️ Lệnh Phát & Điều Khiển Cơ Bản',
            value:
              `• \`${prefix}play <tên bài hát / link>\` (hoặc \`${prefix}p\`): Phát nhạc từ YouTube, Spotify hoặc SoundCloud.\n` +
              `• \`${prefix}skip\` (hoặc \`${prefix}s\`): Bỏ qua bài hát đang phát.\n` +
              `• \`${prefix}pause\`: Tạm dừng phát nhạc.\n` +
              `• \`${prefix}resume\`: Tiếp tục phát nhạc.\n` +
              `• \`${prefix}stop\` / \`${prefix}leave\`: Dừng phát, xóa hàng đợi và rời voice.`
          },
          {
            name: '🎛️ Nâng Cao & Quản Lý Hàng Đợi',
            value:
              `• \`${prefix}queue\` (hoặc \`${prefix}q\`): Xem danh sách các bài hát trong hàng đợi.\n` +
              `• \`${prefix}nowplaying\` (hoặc \`${prefix}np\`): Xem thông tin bài hát đang phát chi tiết.\n` +
              `• \`${prefix}volume <1-150>\` (hoặc \`${prefix}vol\`): Chỉnh âm lượng phát nhạc.\n` +
              `• \`${prefix}loop <off|track|queue>\`: Chế độ lặp 1 bài hoặc lặp cả hàng đợi.\n` +
              `• \`${prefix}shuffle\`: Xáo trộn ngẫu nhiên danh sách phát.\n` +
              `• \`/scstatus\` & \`/setscid\`: Kiểm tra và tự động cập nhật Client ID SoundCloud.`
          }
        )
        .setFooter({ text: footerText })
        .setTimestamp();
      break;

    case 'caro':
      embed
        .setTitle('🎮 ĐẤU CỜ CARO (BLITZ 5x5 & BOT AI)')
        .setColor('#3a86ff')
        .setDescription(
          `Đấu trường cờ Caro tương tác trực tiếp bằng **25 Discord Buttons**, tính điểm xếp hạng ELO.\n` +
          `*Luật chơi:* Đạt 4 quân liên tiếp (ngang, dọc hoặc chéo) để chiến thắng!\n`
        )
        .addFields(
          {
            name: '🤖 Đấu Với Bot AI (PvE)',
            value:
              `• \`${prefix}caro bot [easy|medium|hard|master]\`: Solo ngay với Bot AI thông minh.\n` +
              `• Cấp độ: \`easy\` (Dễ), \`medium\` (Vừa), \`hard\` (Khó), \`master\` (Đại Sư / Bất Bại).\n` +
              `• Slash command: \`/caro bot difficulty:<cấp độ>\``
          },
          {
            name: '⚔️ Thách Đấu Bạn Bè (PvP)',
            value:
              `• \`${prefix}caro @user\`: Gửi lời thách đấu tới 1 thành viên trong server.\n` +
              `• Đối thủ có 60 giây để bấm [⚔️ Chấp Nhận] hoặc [🏳️ Từ Chối].\n` +
              `• Slash command: \`/caro challenge user:<@user>\``
          },
          {
            name: '🏆 Bảng Xếp Hạng & Hồ Sơ',
            value:
              `• \`${prefix}caro stats [@user]\`: Xem điểm ELO, Rank, chuỗi thắng & thành tích đấu Bot.\n` +
              `• \`${prefix}caro top\` / \`${prefix}caro rank\`: Bảng Vàng Top 10 cao thủ server.\n` +
              `• \`${prefix}caro resign\` / \`${prefix}caro thua\`: Xin đầu hàng ván cờ hiện tại.`
          }
        )
        .setFooter({ text: footerText })
        .setTimestamp();
      break;

    case 'ai':
      embed
        .setTitle('🤖 CHAT AI CỌC TÍNH (GEMINI 3.8 FLASH)')
        .setColor('#8338ec')
        .setDescription(
          `Trợ lý AI siêu thông minh tích hợp Google Gemini 3.8 Flash, tính cách hài hước, cọc tính và cực gắt khi bị hỏi ngu!\n`
        )
        .addFields(
          {
            name: '💬 Cách Tương Tác Với Bot AI',
            value:
              `• **Tag trực tiếp Bot:** \`@SentinelBot <câu hỏi hoặc tâm sự>\`\n` +
              `• \`${prefix}chat <nội dung>\`: Trò chuyện hoặc giải toán, viết code, tư vấn.\n` +
              `• \`${prefix}ai <nội dung>\`: Lệnh tắt tương tự lệnh chat.\n` +
              `• \`${prefix}autochat on [webhook_url]\`: Tự động tham gia thảo luận trong kênh.`
          }
        )
        .setFooter({ text: footerText })
        .setTimestamp();
      break;

    case 'tiktok':
      embed
        .setTitle('📱 TẢI & TỰ ĐỘNG BẮT LINK TIKTOK (NO WATERMARK)')
        .setColor('#00f2fe')
        .setDescription(
          `Công cụ tự động tải video TikTok chất lượng cao không dính logo watermark và tách file âm thanh MP3.\n`
        )
        .addFields(
          {
            name: '🎬 Lệnh Tải Video',
            value:
              `• \`${prefix}tiktok <link>\` (hoặc \`${prefix}tt <link>\`): Tải ngay video không logo và nhạc nền MP3.\n` +
              `• Lệnh Slash: \`/tiktok url: <link>\`\n` +
              `• \`${prefix}tiktok auto <on/off>\`: Bật hoặc tắt tự động tải video khi có thành viên dán link TikTok vào kênh chat.`
          }
        )
        .setFooter({ text: footerText })
        .setTimestamp();
      break;

    case 'roblox':
      embed
        .setTitle('🧱 TRA CỨU TÀI KHOẢN ROBLOX')
        .setColor('#00a2ff')
        .setDescription(
          `Tra cứu hồ sơ tài khoản Roblox theo Tên người dùng (Username) hoặc ID tài khoản.\n`
        )
        .addFields(
          {
            name: '🔍 Lệnh Tra Cứu',
            value:
              `• \`${prefix}roblox <username/ID>\` (hoặc \`${prefix}rbx <tên>\`): Hiển thị ảnh Avatar 3D, ngày khởi tạo, tuổi tài khoản, bio và link profile.\n` +
              `• Lệnh Slash: \`/roblox username: <tên tài khoản>\``
          }
        )
        .setFooter({ text: footerText })
        .setTimestamp();
      break;

    case 'rpc':
      embed
        .setTitle('🎮 CÀI ĐẶT RICH PRESENCE (RPC TRẠNG THÁI)')
        .setColor('#5865f2')
        .setDescription(
          `Tùy biến hiển thị trạng thái hoạt động của Bot trong server.\n`
        )
        .addFields(
          {
            name: '🕹️ Các Lệnh RPC',
            value:
              `• \`${prefix}rpc playing <tên game>\`: Trạng thái "Đang chơi ..."\n` +
              `• \`${prefix}rpc watching <phim/stream>\`: Trạng thái "Đang xem ..."\n` +
              `• \`${prefix}rpc listening <bài hát>\`: Trạng thái "Đang nghe ..."\n` +
              `• \`${prefix}rpc streaming <link_twitch> <tiêu đề>\`: Trạng thái Livestream (Viền tím).\n` +
              `• \`${prefix}rpc status <online|idle|dnd>\`: Đổi màu chấm trạng thái bot.\n` +
              `• \`${prefix}rpc rotate <on/off>\`: Tự động đổi trạng thái luân phiên.`
          }
        )
        .setFooter({ text: footerText })
        .setTimestamp();
      break;

    case 'fun':
      embed
        .setTitle('🎉 GIẢI TRÍ & THẦN SỐ HỌC')
        .setColor('#eb459e')
        .setDescription(
          `Mini-games vui nhộn tăng tương tác cho các thành viên trong máy chủ.\n`
        )
        .addFields(
          {
            name: '💘 Ghép Đôi Tình Yêu (Ship)',
            value:
              `• \`${prefix}ghepdoi @crush\`: Ghép đôi bạn với người ấy, tính điểm % duyên số.\n` +
              `• \`${prefix}ghepdoi @user1 @user2\`: Đẩy thuyền 2 thành viên trong server.`
          },
          {
            name: '🌈 Máy Đo Độ Gay (Rainbow Scanner)',
            value:
              `• \`${prefix}gay\`: Quét chỉ số cầu vồng của chính bạn.\n` +
              `• \`${prefix}gay @user\`: Kiểm tra độ gay lọ của thành viên khác.`
          }
        )
        .setFooter({ text: footerText })
        .setTimestamp();
      break;

    case 'ticket':
      embed
        .setTitle('🎫 HỆ THỐNG TICKET HỖ TRỢ')
        .setColor('#ffb703')
        .setDescription(
          `Tạo kênh hỗ trợ riêng tư tự động cho từng thành viên khi gặp sự cố.\n`
        )
        .addFields(
          {
            name: '📩 Chức Năng Ticket',
            value:
              `• Nút **[📩 Mở Ticket]** tạo kênh text ẩn chỉ thành viên và ban quản trị thấy được.\n` +
              `• Nút **[🔒 Đóng Ticket]** kèm popup xác nhận đóng an toàn.\n` +
              `• Nút **[🔔 Gọi Admin]** để ping nhanh vai trò hỗ trợ khi cần gấp.`
          }
        )
        .setFooter({ text: footerText })
        .setTimestamp();
      break;

    case 'whitelist':
      embed
        .setTitle('🔐 PHÂN QUYỀN WHITELIST & QUẢN LÝ CHỦ BOT')
        .setColor('#5865f2')
        .setDescription(
          `Cơ chế bảo vệ đặc quyền: Khi bật chế độ Whitelist, chỉ **Chủ Bot (Owner)** và những thành viên được cấp phép mới có thể sử dụng bot.\n`
        )
        .addFields(
          {
            name: '📋 Quản Lý Danh Sách Whitelist',
            value:
              `• \`${prefix}wl list\` (hoặc \`${prefix}wl ds\`): Xem danh sách toàn bộ thành viên đang được phép dùng bot.\n` +
              `• \`${prefix}wl add @user\`: Cấp quyền sử dụng bot cho thành viên (Chỉ Chủ Bot).\n` +
              `• \`${prefix}wl remove @user\` (hoặc \`${prefix}wl del\`): Thu hồi quyền dùng bot.\n` +
              `• \`${prefix}wl on\`: Bật khóa bảo vệ (Chỉ Chủ Bot & Whitelist được dùng).\n` +
              `• \`${prefix}wl off\`: Tắt khóa bảo vệ (Tất cả mọi người đều được dùng).\n` +
              `• \`${prefix}wl addowner @user\`: Thêm Chủ Bot mới.\n` +
              `• \`${prefix}wl claim\`: Nhận quyền Chủ Bot (nếu chưa có ai nhận).`
          }
        )
        .setFooter({ text: footerText })
        .setTimestamp();
      break;

    case 'home':
    default:
      embed
        .setTitle('🛡️ SENTINELBOT • TRUNG TÂM ĐIỀU KHIỂN & LỆNH')
        .setColor('#2b2d31')
        .setDescription(
          `Xin chào! Dưới đây là danh mục toàn bộ tính năng và lệnh của **SentinelBot**.\n\n` +
          `📍 **Prefix máy chủ:** \`${prefix}\` (hoặc tag bot, hoặc dùng lệnh Slash \`/\`)\n` +
          `💡 **Cách dùng:** Hãy **chọn danh mục trong Menu thả xuống** hoặc **nhấn các nút bên dưới** để xem chi tiết từng module!`
        )
        .addFields(
          { name: '🚨 BẢO MẬT & ANTI-RAID', value: `\`${prefix}antiraid\`, \`${prefix}lockdown\`, \`${prefix}clean\``, inline: true },
          { name: '🔐 BẢO VỆ & WHITELIST', value: `\`${prefix}wl list\`, \`${prefix}wl add\`, \`${prefix}wl on/off\``, inline: true },
          { name: '🎵 ÂM NHẠC ĐA NỀN TẢNG', value: `\`${prefix}play\`, \`${prefix}skip\`, \`${prefix}queue\`, \`${prefix}loop\``, inline: true },
          { name: '🎮 ĐẤU CỜ CARO (5x5)', value: `\`${prefix}caro bot\`, \`${prefix}caro @user\`, \`${prefix}caro stats\`, \`${prefix}caro top\``, inline: true },
          { name: '🤖 CHAT AI CỌC TÍNH', value: `\`${prefix}chat\`, \`${prefix}ai\`, hoặc tag trực tiếp \`@SentinelBot\``, inline: true },
          { name: '📱 TẢI TIKTOK (NO LOGO)', value: `\`${prefix}tiktok <link>\`, \`${prefix}tiktok auto on/off\``, inline: true },
          { name: '🧱 TRA CỨU ROBLOX', value: `\`${prefix}roblox <user/ID>\`, \`/roblox\``, inline: true },
          { name: '🎉 GIẢI TRÍ & GAYRATE', value: `\`${prefix}ghepdoi @crush\`, \`${prefix}gay [@user]\``, inline: true },
          { name: '⚙️ CẤU HÌNH SERVER', value: `\`${prefix}prefix <ký tự>\`, \`/setwelcome\`, \`/setgoodbye\``, inline: true }
        )
        .setFooter({ text: footerText })
        .setTimestamp();
      break;
  }

  // Gắn banner GIF động theo yêu cầu của user: https://tenor.com/qYXTTRbn3CM.gif
  embed.setImage('https://media1.tenor.com/m/w-flhIvMF9IAAAAC/sad-anime-rain-raining.gif');

  // Row 1: StringSelectMenu lựa chọn chuyên mục
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`help_cat_select_${requestedUserId || 'any'}`)
    .setPlaceholder('📂 Chọn chuyên mục lệnh bạn muốn khám phá...')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Trang Chủ (Tổng Quan)')
        .setValue('home')
        .setDescription('Xem tổng quan các tính năng chính của Bot')
        .setEmoji('🏠')
        .setDefault(category === 'home'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Bảo Mật & Anti-Raid')
        .setValue('security')
        .setDescription('Phòng chống Nuke, Anti-Spam, Whitelist, Lockdown & Clean')
        .setEmoji('🚨')
        .setDefault(category === 'security'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Phân Quyền & Whitelist Bot')
        .setValue('whitelist')
        .setDescription('Chỉ chủ bot & người trong whitelist mới được dùng bot')
        .setEmoji('🔐')
        .setDefault(category === 'whitelist'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Âm Nhạc Đa Nền Tảng')
        .setValue('music')
        .setDescription('YouTube, Spotify, SoundCloud, Loop, Shuffle & Volume')
        .setEmoji('🎵')
        .setDefault(category === 'music'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Đấu Cờ Caro (5x5 & Bot AI)')
        .setValue('caro')
        .setDescription('Bàn cờ 25 Buttons, Solo Bot AI, Thách đấu bạn bè & ELO')
        .setEmoji('🎮')
        .setDefault(category === 'caro'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Chat AI Cọc Tính (Gemini 3.8)')
        .setValue('ai')
        .setDescription('Trò chuyện, tư vấn, giải bài tập và cà khịa')
        .setEmoji('🤖')
        .setDefault(category === 'ai'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Tải Video TikTok (No Watermark)')
        .setValue('tiktok')
        .setDescription('Tải video không logo kèm file MP3 và tự động bắt link')
        .setEmoji('📱')
        .setDefault(category === 'tiktok'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Tra Cứu Tài Khoản Roblox')
        .setValue('roblox')
        .setDescription('Xem ảnh Avatar 3D, ngày tạo, tuổi tài khoản và link')
        .setEmoji('🧱')
        .setDefault(category === 'roblox'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Rich Presence (RPC)')
        .setValue('rpc')
        .setDescription('Tùy biến trạng thái Playing, Watching, Streaming của Bot')
        .setEmoji('🕹️')
        .setDefault(category === 'rpc'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Giải Trí & Ghép Đôi')
        .setValue('fun')
        .setDescription('Ghép đôi crush và máy đo độ gay lọ hài hước')
        .setEmoji('🎉')
        .setDefault(category === 'fun'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Hệ Thống Ticket')
        .setValue('ticket')
        .setDescription('Panel tạo vé hỗ trợ riêng tư và đóng ticket')
        .setEmoji('🎫')
        .setDefault(category === 'ticket')
    );

  const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  // Row 2: Nút bấm tắt (Quick Buttons)
  const btnHome = new ButtonBuilder()
    .setCustomId(`help_btn_home_${requestedUserId || 'any'}`)
    .setLabel('Trang Chủ')
    .setEmoji('🏠')
    .setStyle(category === 'home' ? ButtonStyle.Primary : ButtonStyle.Secondary);

  const btnSecurity = new ButtonBuilder()
    .setCustomId(`help_btn_security_${requestedUserId || 'any'}`)
    .setLabel('Bảo Mật')
    .setEmoji('🚨')
    .setStyle(category === 'security' ? ButtonStyle.Primary : ButtonStyle.Secondary);

  const btnMusic = new ButtonBuilder()
    .setCustomId(`help_btn_music_${requestedUserId || 'any'}`)
    .setLabel('Âm Nhạc')
    .setEmoji('🎵')
    .setStyle(category === 'music' ? ButtonStyle.Primary : ButtonStyle.Secondary);

  const btnCaro = new ButtonBuilder()
    .setCustomId(`help_btn_caro_${requestedUserId || 'any'}`)
    .setLabel('Cờ Caro')
    .setEmoji('🎮')
    .setStyle(category === 'caro' ? ButtonStyle.Primary : ButtonStyle.Secondary);

  const btnClose = new ButtonBuilder()
    .setCustomId(`help_btn_close_${requestedUserId || 'any'}`)
    .setLabel('Đóng')
    .setEmoji('🗑️')
    .setStyle(ButtonStyle.Danger);

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    btnHome,
    btnSecurity,
    btnMusic,
    btnCaro,
    btnClose
  );

  return { embed, components: [row1, row2] };
}

export async function handleHelpInteraction(
  interaction: StringSelectMenuInteraction | ButtonInteraction,
  guildPrefix: string = '.'
): Promise<boolean> {
  const { customId, user } = interaction;

  // Kiểm tra tương tác có thuộc Help Panel không
  if (!customId.startsWith('help_cat_select_') && !customId.startsWith('help_btn_')) {
    return false;
  }

  // Tách requestedUserId nếu có để đảm bảo quyền tương tác
  const parts = customId.split('_');
  const targetUserId = parts[parts.length - 1];

  if (targetUserId && targetUserId !== 'any' && targetUserId !== user.id) {
    await interaction.reply({
      content: '❌ Panel trợ giúp này do thành viên khác mở! Hãy gõ `/help` hoặc `.help` để mở panel riêng của bạn.',
      ephemeral: true,
    });
    return true;
  }

  // Nút đóng panel
  if (customId.startsWith('help_btn_close_')) {
    await (interaction as any).message?.delete().catch(() => {});
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Đã đóng bảng trợ giúp.', ephemeral: true }).catch(() => {});
    }
    return true;
  }

  let selectedCategory = 'home';

  if (interaction.isStringSelectMenu()) {
    selectedCategory = interaction.values[0] || 'home';
  } else if (interaction.isButton()) {
    if (customId.startsWith('help_btn_home_')) selectedCategory = 'home';
    else if (customId.startsWith('help_btn_security_')) selectedCategory = 'security';
    else if (customId.startsWith('help_btn_music_')) selectedCategory = 'music';
    else if (customId.startsWith('help_btn_caro_')) selectedCategory = 'caro';
  }

  const { embed, components } = buildHelpPanel(guildPrefix, selectedCategory, user.id);

  await interaction.update({
    embeds: [embed],
    components,
  });

  return true;
}
