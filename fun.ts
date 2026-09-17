import crypto from 'crypto';

// Danh sách ghép đôi ngẫu nhiên với tỷ lệ duyên số và thông điệp vui nhộn
const LOVE_MESSAGES_HIGH = [
  'Định mệnh của đời nhau! Nồi nào úp vung nấy, cưới ngay kẻo lỡ! 💍💒',
  'Trời sinh một cặp, đất sinh một đôi, ngọt ngào như trà sữa trân châu đường đen! 🧋✨',
  'Tình yêu sét đánh! Hai bạn sinh ra là để dành cho nhau đấy! 💘🔥',
  'Đẹp đôi điểm 10 không có nhưng, phát cơm chó cho cả server ăn no nê! 🐶🍚'
];

const LOVE_MESSAGES_MID = [
  'Cũng tạm ổn, mưa dầm thấm lâu, chịu khó nhắn tin rủ đi ăn ốc là dính! 🐌🍻',
  'Tình trong như đã mặt ngoài còn e, một người chủ động là có bồ ngay! 😉💕',
  'Mức độ tâm đầu ý hợp ở mức khá, cần bồi dưỡng thêm vài ly trà đào! 🍑☕',
  'Trên tình bạn dưới tình yêu, chỉ chờ một lời tỏ tình là chốt đơn! 💌'
];

const LOVE_MESSAGES_LOW = [
  'Kiếp này coi như làm bạn nhậu thôi, chứ yêu vào khéo combat cả ngày! 🥊😂',
  'Hai đường thẳng song song, không chạm vào nhau nhưng nhìn nhau hoài! 📉💔',
  'Duyên chưa tới mà nợ thì nhiều, tốt nhất giữ tình đồng chí trong sáng! 🤝❄️',
  'Tỷ lệ hơi thấp, nhưng người ta bảo "ghét của nào trời trao của nấy" nha! 🤡'
];

// Danh sách nhận xét mức độ gay cấn / đo độ gay lọ hài hước
const GAY_COMMENTS = [
  { max: 15, title: 'Chuẩn Men / Thẳng như thước kẻ', desc: 'Thẳng tắp không một gợn sóng, nam tính ngời ngời! 📐🗿' },
  { max: 35, title: 'Có chút điệu đà sương sương', desc: 'Thỉnh thoảng cũng thích vuốt tóc, dùng kem chống nắng và điệu một tí! 💅✨' },
  { max: 60, title: 'Bóng mờ sương khói', desc: 'Dấu hiệu hơi uốn lượn nha, hay nhìn trộm các bạn nam 6 múi đúng không! 👀🌈' },
  { max: 85, title: 'Cầu vồng rực rỡ', desc: 'Chị em bạn dì thân thiết, tâm hồn màu hồng phấn ngập tràn! 🦄💖' },
  { max: 100, title: 'Gay chúa vũ trụ / Chúa tể cầu vồng', desc: '100% không thể chối cãi! Vua bóng đêm, nữ hoàng sàn catwalk! 👑🌈💅' }
];

/**
 * Tính toán tỷ lệ phần trăm ổn định dựa trên ID người dùng (deterministic để không bị nhảy số liên tục trong cùng 1 ngày)
 */
function getDeterministicScore(key: string, salt: string = ''): number {
  const hash = crypto.createHash('md5').update(`${key}-${salt}`).digest('hex');
  const num = parseInt(hash.substring(0, 4), 16);
  return num % 101; // 0 -> 100
}

export function calculateShip(user1Id: string, user2Id: string, user1Name: string, user2Name: string) {
  // Sắp xếp ID để ship A B hay B A đều ra cùng 1 kết quả
  const pairKey = [user1Id, user2Id].sort().join('-');
  // Thêm ngày hiện tại để mỗi ngày có quẻ tình duyên mới
  const today = new Date().toISOString().slice(0, 10);
  const score = getDeterministicScore(pairKey, today);

  // Tạo thanh tiến trình (progress bar)
  const fullBlocks = Math.round((score / 100) * 10);
  const emptyBlocks = 10 - fullBlocks;
  const progressBar = '❤️'.repeat(fullBlocks) + '🖤'.repeat(emptyBlocks);

  let comment = '';
  if (score >= 75) {
    comment = LOVE_MESSAGES_HIGH[score % LOVE_MESSAGES_HIGH.length];
  } else if (score >= 40) {
    comment = LOVE_MESSAGES_MID[score % LOVE_MESSAGES_MID.length];
  } else {
    comment = LOVE_MESSAGES_LOW[score % LOVE_MESSAGES_LOW.length];
  }

  // Tên cặp đôi ghép hài hước
  const half1 = user1Name.slice(0, Math.ceil(user1Name.length / 2));
  const half2 = user2Name.slice(Math.floor(user2Name.length / 2));
  const shipName = `${half1}${half2}`;

  return {
    score,
    progressBar,
    comment,
    shipName
  };
}

export function calculateGayRate(userId: string, userName: string) {
  const today = new Date().toISOString().slice(0, 10);
  const rate = getDeterministicScore(userId, `gay-${today}`);

  const fullBlocks = Math.round((rate / 100) * 10);
  const emptyBlocks = 10 - fullBlocks;
  const progressBar = '🏳️‍🌈'.repeat(fullBlocks) + '⬛'.repeat(emptyBlocks);

  let title = '';
  let desc = '';
  for (const c of GAY_COMMENTS) {
    if (rate <= c.max) {
      title = c.title;
      desc = c.desc;
      break;
    }
  }

  return {
    rate,
    progressBar,
    title,
    desc
  };
}
