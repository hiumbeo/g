import fs from 'fs';
import path from 'path';
import { ScanRecord } from './src/types';

const HISTORY_FILE = path.join(process.cwd(), 'scan_history.json');
const MAX_HISTORY_ITEMS = 50;

let scanHistory: ScanRecord[] = [];

// Initial default seed scans so the dashboard interface is immediately informative
const SEED_SCANS: ScanRecord[] = [
  {
    id: 'seed-1',
    type: 'web',
    target: 'https://discord-nitro-free.xyz/claim',
    threatScore: 85,
    threatLevel: 'danger',
    statusBadge: '🔴 MÃ ĐỘC / LỪA ĐẢO NGUY HIỂM',
    timestamp: Date.now() - 1000 * 60 * 12, // 12 mins ago
    author: 'thanhphutv123#0001',
    guildName: 'Sentinel Defense Hub',
    durationMs: 412,
    ipAddress: '185.190.140.23',
    isHttps: true,
    statusCode: 200,
    serverBanner: 'nginx/1.18.0',
    findings: [
      '🚨 Cảnh báo lừa đảo: Chứa từ khóa độc hại/giả mạo (`discord-nitro`, `free-nitro`)',
      '⚠️ TLD Rủi ro cao: Đuôi miền `.xyz` thường bị lợi dụng phát tán mã độc',
      '🚨 CỰC KỲ NGUY HIỂM: Phát hiện Webhook Discord nhúng trong mã nguồn trang'
    ],
    aiVerdict: 'Trang web có dấu hiệu lừa đảo chiếm đoạt tài khoản Discord rõ ràng qua giao diện giả mạo Nitro. Khuyến cáo không truy cập hoặc nhập thông tin.'
  },
  {
    id: 'seed-2',
    type: 'file',
    target: 'steam_giftcard_generator.png.exe',
    threatScore: 90,
    threatLevel: 'danger',
    statusBadge: '🔴 PHÁT HIỆN MÃ ĐỘC / NGUY HIỂM CAO',
    timestamp: Date.now() - 1000 * 60 * 35, // 35 mins ago
    author: 'security_officer#9921',
    guildName: 'Sentinel Defense Hub',
    durationMs: 530,
    fileSize: 184320,
    detectedType: 'application/x-dosexec (*.exe)',
    sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    md5: '5d41402abc4b2a76b9719d911017c592',
    entropy: 7.82,
    findings: [
      '🚨 Định dạng file thực thi: Đuôi `.exe` có khả năng chạy mã độc trực tiếp',
      '🛑 Ngụy trang đuôi mở rộng kép (Double Extension): Giả dạng `.png` nhưng đuôi thật là `.exe`',
      '🛑 NGỤY TRANG MÃ ĐỘC: Header nhị phân là file thực thi Windows EXE (MZ Header)',
      '⚠️ Độ hỗn loạn Entropy cao (7.82/8.0): Dữ liệu bị nén chặt (Dấu hiệu Packer/Trojan)'
    ]
  },
  {
    id: 'seed-3',
    type: 'web',
    target: 'https://github.com/discordjs/discord.js',
    threatScore: 0,
    threatLevel: 'safe',
    statusBadge: '🟢 AN TOÀN TUYỆT ĐỐI',
    timestamp: Date.now() - 1000 * 60 * 85, // 85 mins ago
    author: 'moderator#1337',
    guildName: 'Sentinel Defense Hub',
    durationMs: 198,
    ipAddress: '140.82.121.4',
    isHttps: true,
    statusCode: 200,
    serverBanner: 'GitHub.com',
    findings: [
      '✅ Bảo vệ tiêu đề (Headers): Trang web cấu hình đầy đủ HSTS, CSP và Anti-Clickjacking',
      '✅ Chứng chỉ SSL hợp lệ và bảo mật cao'
    ],
    aiVerdict: 'Tên miền chính thức của GitHub, hoàn toàn an toàn và đáng tin cậy cho người dùng.'
  }
];

function initHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        scanHistory = parsed;
        return;
      }
    }
  } catch (err) {
    console.error('Lỗi khi đọc file scan_history.json:', err);
  }

  // Fallback to seed scans
  scanHistory = [...SEED_SCANS];
  saveHistory();
}

function saveHistory() {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(scanHistory, null, 2), 'utf-8');
  } catch (err) {
    console.error('Lỗi khi lưu file scan_history.json:', err);
  }
}

// Initialize on module load
initHistory();

export function getScanHistory(): ScanRecord[] {
  return scanHistory;
}

export function addScanRecord(record: ScanRecord): void {
  // Prepend new record
  scanHistory.unshift(record);
  if (scanHistory.length > MAX_HISTORY_ITEMS) {
    scanHistory = scanHistory.slice(0, MAX_HISTORY_ITEMS);
  }
  saveHistory();
}

export function clearScanHistory(): void {
  scanHistory = [];
  saveHistory();
}
