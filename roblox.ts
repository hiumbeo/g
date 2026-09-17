import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

export interface RobloxUserProfile {
  id: number;
  name: string;
  displayName: string;
  description: string;
  created: string;
  formattedJoinDate: string;
  accountAgeText: string;
  daysOld: number;
  isBanned: boolean;
  hasVerifiedBadge: boolean;
  profileUrl: string;
  avatarUrl: string;
  headshotUrl: string;
  friendsCount: number;
  followersCount: number;
  followingsCount: number;
}

/**
 * Tính toán độ tuổi tài khoản và format ngày tháng tiếng Việt
 */
function formatAccountAge(createdIso: string) {
  const createdDate = new Date(createdIso);
  const now = new Date();
  const diffMs = now.getTime() - createdDate.getTime();
  const daysOld = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  const years = Math.floor(daysOld / 365.25);
  const remainingDays = Math.floor(daysOld % 365.25);

  let ageStr = '';
  if (years > 0) {
    ageStr = `${years} năm ${remainingDays} ngày (${daysOld.toLocaleString()} ngày trước)`;
  } else {
    ageStr = `${daysOld} ngày trước`;
  }

  // Định dạng ngày: DD/MM/YYYY lúc HH:mm (Giờ Việt Nam UTC+7)
  const d = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(createdDate);

  return {
    formattedJoinDate: d,
    accountAgeText: ageStr,
    daysOld,
  };
}

/**
 * Tra cứu thông tin người dùng Roblox qua Roblox Web APIs chính thức
 */
export async function fetchRobloxUser(query: string): Promise<RobloxUserProfile> {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    throw new Error('Vui lòng nhập tên tài khoản (Username) hoặc ID Roblox.');
  }

  let userId: number | null = null;
  let rawUsername: string = cleanQuery;

  // Nếu query toàn là chữ số, có thể là User ID
  if (/^\d+$/.test(cleanQuery)) {
    userId = parseInt(cleanQuery, 10);
  }

  // Nếu chưa có ID hoặc cần tra cứu qua Username
  if (!userId) {
    const userLookupRes = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        usernames: [cleanQuery],
        excludeBannedUsers: false,
      }),
    });

    if (!userLookupRes.ok) {
      throw new Error(`Roblox API phản hồi lỗi (${userLookupRes.status}) khi tìm kiếm người dùng.`);
    }

    const lookupData = (await userLookupRes.json()) as any;
    if (!lookupData.data || lookupData.data.length === 0) {
      throw new Error(`Không tìm thấy người dùng Roblox nào có tên: "${cleanQuery}". Hãy kiểm tra lại chính tả!`);
    }

    userId = lookupData.data[0].id;
    rawUsername = lookupData.data[0].name;
  }

  // Lấy chi tiết tài khoản từ Users API
  const detailRes = await fetch(`https://users.roblox.com/v1/users/${userId}`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!detailRes.ok) {
    if (detailRes.status === 404) {
      throw new Error(`Không tìm thấy tài khoản Roblox có ID: ${userId}.`);
    }
    throw new Error(`Lỗi khi lấy thông tin tài khoản Roblox ID: ${userId} (${detailRes.status}).`);
  }

  const detail = (await detailRes.json()) as any;
  const { formattedJoinDate, accountAgeText, daysOld } = formatAccountAge(detail.created);
  const profileUrl = `https://www.roblox.com/users/${detail.id}/profile`;

  // Gọi song song: Thumbnail Body, Thumbnail Headshot, Friends count, Followers count
  const [avatarRes, headshotRes, friendsRes, followersRes] = await Promise.allSettled([
    // Full body avatar 420x420
    fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${detail.id}&size=420x420&format=Png&isCircular=false`)
      .then((r) => (r.ok ? r.json() : null)),
    // Headshot avatar 420x420
    fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${detail.id}&size=420x420&format=Png&isCircular=false`)
      .then((r) => (r.ok ? r.json() : null)),
    // Friends count
    fetch(`https://friends.roblox.com/v1/users/${detail.id}/friends/count`)
      .then((r) => (r.ok ? r.json() : null)),
    // Followers count
    fetch(`https://friends.roblox.com/v1/users/${detail.id}/followers/count`)
      .then((r) => (r.ok ? r.json() : null)),
  ]);

  let avatarUrl = 'https://www.roblox.com/images/RobloxLogo.png';
  if (avatarRes.status === 'fulfilled' && avatarRes.value?.data?.[0]?.imageUrl) {
    avatarUrl = avatarRes.value.data[0].imageUrl;
  }

  let headshotUrl = avatarUrl;
  if (headshotRes.status === 'fulfilled' && headshotRes.value?.data?.[0]?.imageUrl) {
    headshotUrl = headshotRes.value.data[0].imageUrl;
  }

  let friendsCount = 0;
  if (friendsRes.status === 'fulfilled' && typeof friendsRes.value?.count === 'number') {
    friendsCount = friendsRes.value.count;
  }

  let followersCount = 0;
  if (followersRes.status === 'fulfilled' && typeof followersRes.value?.count === 'number') {
    followersCount = followersRes.value.count;
  }

  return {
    id: detail.id,
    name: detail.name || rawUsername,
    displayName: detail.displayName || detail.name,
    description: detail.description ? detail.description.trim() : '',
    created: detail.created,
    formattedJoinDate,
    accountAgeText,
    daysOld,
    isBanned: Boolean(detail.isBanned),
    hasVerifiedBadge: Boolean(detail.hasVerifiedBadge),
    profileUrl,
    avatarUrl,
    headshotUrl,
    friendsCount,
    followersCount,
    followingsCount: 0,
  };
}

/**
 * Xây dựng Discord Embed & Action Row Buttons cho Roblox Profile
 */
export function buildRobloxDiscordEmbed(profile: RobloxUserProfile) {
  const verifiedBadge = profile.hasVerifiedBadge ? ' ☑️ [Verified]' : '';
  const banStatus = profile.isBanned
    ? '🚨 **ĐÃ BỊ CẤM / BANNED**'
    : '🟢 **Đang hoạt động bình thường**';

  const descText = profile.description
    ? `>>> *"${profile.description.length > 250 ? profile.description.slice(0, 247) + '...' : profile.description}"*`
    : '*Chưa thiết lập tiểu sử (About me)*';

  const embed = new EmbedBuilder()
    .setTitle(`🎮 ROBLOX PROFILE • ${profile.displayName} (@${profile.name})${verifiedBadge}`)
    .setURL(profile.profileUrl)
    .setColor(profile.isBanned ? '#ED4245' : '#00A2FF')
    .setThumbnail(profile.headshotUrl)
    .setImage(profile.avatarUrl)
    .setDescription(
      `Thông tin chi tiết tài khoản Roblox tra cứu trực tiếp từ hệ thống API Roblox:`
    )
    .addFields(
      {
        name: '👤 Tên & Tên hiển thị',
        value: `• **Username:** \`${profile.name}\`\n• **Display Name:** **${profile.displayName}**`,
        inline: true,
      },
      {
        name: '🆔 ID Tài Khoản',
        value: `\`${profile.id}\``,
        inline: true,
      },
      {
        name: '🛡️ Trạng thái Acc',
        value: `${banStatus}`,
        inline: true,
      },
      {
        name: '📅 Ngày tham gia (Join Roblox)',
        value: `🗓️ **${profile.formattedJoinDate}**\n⏳ **${profile.accountAgeText}**`,
        inline: false,
      },
      {
        name: '👥 Tương tác xã hội',
        value: `🤝 Bạn bè: **${profile.friendsCount.toLocaleString('vi-VN')}** | 🌟 Theo dõi: **${profile.followersCount.toLocaleString('vi-VN')}**`,
        inline: false,
      },
      {
        name: '📝 Tiểu sử (About / Bio)',
        value: descText,
        inline: false,
      },
      {
        name: '🔗 Đường dẫn Profile',
        value: `👉 [Nhấn vào đây để xem profile: roblox.com/users/${profile.id}/profile](${profile.profileUrl})`,
        inline: false,
      }
    )
    .setFooter({
      text: `SentinelBot Roblox Lookup • Yêu cầu bởi người dùng`,
      iconURL: 'https://images.rbxcdn.com/2b356da0fbab6111a21ab414aecb662b.ico',
    })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('🌐 Mở Profile Roblox')
      .setStyle(ButtonStyle.Link)
      .setURL(profile.profileUrl),
    new ButtonBuilder()
      .setLabel('🖼️ Xem Avatar Đầy Đủ')
      .setStyle(ButtonStyle.Link)
      .setURL(profile.avatarUrl)
  );

  return { embed, row };
}
