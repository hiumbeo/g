import crypto from 'crypto';
import dns from 'dns/promises';
import { EmbedBuilder } from 'discord.js';
import { GoogleGenAI } from '@google/genai';
import { addScanRecord } from './scanHistory';
import { ScanRecord } from './src/types';

// Common phishing & malicious patterns
const PHISHING_KEYWORDS = [
  'free-nitro', 'nitro-gift', 'discorcl', 'dlscord', 'discrod', 'discord-app',
  'discord-nitro', 'steamcommunity-gift', 'steamcommynity', 'roblox-robux',
  'iplogger', 'grabify', '2no.co', 'leak', 'free-crypto', 'airdrop-claim',
  'metamask-verify', 'token-grabber', 'steam-community', 'giveaway-gift',
  'account-checker', 'login-verify'
];

// Adult, Casino, Gambling content patterns
const CONTENT_KEYWORDS = [
  'sex', 'porn', 'xxx', 'adult', '18plus', 'phimnguoilon', 'jav',
  'casino', 'bet', 'gambling', 'ca-cuoc', 'xoc-dia', 'da-ga', 'keo-nha-cai', 'cobac'
];

const SUSPICIOUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'scr', 'vbs', 'ps1', 'vbe', 'hta', 'jar', 'pif',
  'msi', 'reg', 'dll', 'com', 'wsf', 'cpl', 'iso', 'img', 'lnk',
  'jse', 'vb', 'ocx', 'gadget', 'app', 'xap'
]);

// Magic byte signatures for file format detection
const MAGIC_BYTES: { [signature: string]: { mime: string; ext: string; isExecutable?: boolean } } = {
  '4d5a': { mime: 'application/x-dosexec', ext: 'exe', isExecutable: true }, // MZ (Windows EXE/DLL)
  '7f454c46': { mime: 'application/x-elf', ext: 'elf', isExecutable: true }, // ELF binary
  '504b0304': { mime: 'application/zip', ext: 'zip' }, // PK (ZIP / Office / JAR)
  '25504446': { mime: 'application/pdf', ext: 'pdf' }, // %PDF
  '89504e47': { mime: 'image/png', ext: 'png' }, // PNG
  'ffd8ff': { mime: 'image/jpeg', ext: 'jpg' }, // JPEG
  '47494638': { mime: 'image/gif', ext: 'gif' }, // GIF87a/89a
  '1f8b08': { mime: 'application/gzip', ext: 'gz' }, // GZIP
  '52617221': { mime: 'application/x-rar-compressed', ext: 'rar' }, // Rar!
};

/**
 * Calculate Shannon Entropy of a buffer (0 - 8 bits)
 * Values > 7.0 indicate high packing, encryption or compression (common in malware payloads)
 */
function calculateEntropy(buffer: Buffer): number {
  if (buffer.length === 0) return 0;
  const frequencies = new Array(256).fill(0);
  for (let i = 0; i < buffer.length; i++) {
    frequencies[buffer[i]]++;
  }

  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    if (frequencies[i] > 0) {
      const p = frequencies[i] / buffer.length;
      entropy -= p * Math.log2(p);
    }
  }
  return Number(entropy.toFixed(3));
}

/**
 * Scan a Website URL with deep network, SSL, header, and threat heuristics
 */
export async function performWebScan(
  rawUrl: string,
  author: string = 'Hệ thống / Discord',
  guildName?: string
): Promise<EmbedBuilder> {
  let targetUrl = rawUrl.trim();
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  const startTime = Date.now();
  const findings: string[] = [];
  let threatScore = 0; // 0 to 100
  let ipAddress = 'N/A';
  let statusCode = 0;
  let serverBanner = 'Ẩn danh / Không xác định';
  let redirectsCount = 0;
  let isHttps = targetUrl.startsWith('https://');

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return new EmbedBuilder()
      .setTitle('🛡️ Sentinel CyberSec • Quét Web Pro')
      .setColor('#ED4245')
      .setDescription('❌ **Định dạng URL không hợp lệ!** Vui lòng nhập đúng cấu trúc liên kết.')
      .setTimestamp();
  }

  const hostname = parsed.hostname.toLowerCase();

  // 1. Phishing & Keyword Heuristic Check
  for (const keyword of PHISHING_KEYWORDS) {
    if (hostname.includes(keyword) || parsed.pathname.toLowerCase().includes(keyword)) {
      threatScore += 45;
      findings.push(`🚨 **Cảnh báo lừa đảo:** Chứa từ khóa độc hại/giả mạo (\`${keyword}\`)`);
      break;
    }
  }

  // Check for 18+, Casino, Gambling
  for (const keyword of CONTENT_KEYWORDS) {
    if (hostname.includes(keyword) || parsed.pathname.toLowerCase().includes(keyword)) {
      threatScore += 35;
      findings.push(`⚠️ **Cảnh báo nội dung:** Phát hiện từ khóa liên quan đến nội dung nhạy cảm/cờ bạc (\`${keyword}\`)`);
      break;
    }
  }

  // Check suspicious TLDs
  const suspiciousTlds = ['.xyz', '.top', '.zip', '.click', '.tk', '.gq', '.cf', '.work', '.rest'];
  if (suspiciousTlds.some(tld => hostname.endsWith(tld))) {
    threatScore += 20;
    findings.push(`⚠️ **TLD Rủi ro cao:** Đuôi miền \`${hostname.slice(hostname.lastIndexOf('.'))}\` thường bị lợi dụng phát tán mã độc/spam.`);
  }

  // Check IP-based Hostname
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    threatScore += 25;
    findings.push('⚠️ **Địa chỉ IP thô:** Truy cập trực tiếp qua IP thay vì tên miền đã đăng ký.');
  }

  // 2. DNS Resolution
  try {
    const dnsLookup = await dns.lookup(hostname);
    ipAddress = dnsLookup.address;

    // Check private/local IP (SSRF protection)
    if (
      ipAddress === '127.0.0.1' ||
      ipAddress.startsWith('10.') ||
      ipAddress.startsWith('192.168.') ||
      ipAddress.startsWith('172.')
    ) {
      threatScore += 80;
      findings.push(`🛑 **Phát hiện mạng nội bộ (SSRF):** IP \`${ipAddress}\` là dải mạng nội bộ riêng tư.`);
    }
  } catch (err: any) {
    findings.push(`⚠️ **Lỗi phân giải DNS:** Tên miền không tồn tại hoặc đã bị khóa.`);
    threatScore += 15;
  }

  // 3. HTTP Network Inspection & Header Security Audit
  let responseText = '';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(targetUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SentinelSec/2.5'
      }
    });
    clearTimeout(timeout);

    statusCode = res.status;
    serverBanner = res.headers.get('server') || 'Cloudflare / Protected';

    // Check Security Headers
    const hsts = res.headers.get('strict-transport-security');
    const csp = res.headers.get('content-security-policy');
    const xFrame = res.headers.get('x-frame-options');
    const xContentType = res.headers.get('x-content-type-options');

    const missingHeaders: string[] = [];
    if (!hsts && isHttps) missingHeaders.push('HSTS');
    if (!csp) missingHeaders.push('CSP');
    if (!xFrame) missingHeaders.push('X-Frame-Options');
    if (!xContentType) missingHeaders.push('X-Content-Type-Options');

    if (missingHeaders.length > 0) {
      findings.push(`ℹ️ **Thiếu tiêu đề bảo vệ:** ${missingHeaders.map(h => `\`${h}\``).join(', ')}`);
    } else {
      findings.push('✅ **Bảo vệ tiêu đề (Headers):** Trang web cấu hình đầy đủ HSTS, CSP và Anti-Clickjacking.');
    }

    // Inspect content snippet
    try {
      const text = await res.text();
      responseText = text.slice(0, 10000); // Analyze first 10KB

      // Check for Discord Token Stealer Webhook patterns
      if (responseText.includes('discord.com/api/webhooks/')) {
        threatScore += 70;
        findings.push('🚨 **CỰC KỲ NGUY HIỂM:** Phát hiện Webhook Discord nhúng trong mã nguồn trang (Dấu hiệu thu thập dữ liệu trái phép).');
      }

      // Check for credential harvesting forms without HTTPS
      if (!isHttps && responseText.includes('type="password"')) {
        threatScore += 40;
        findings.push('⚠️ **Thu thập mật khẩu không an toàn:** Form đăng nhập trên giao thức HTTP không mã hóa.');
      }
    } catch {
      // Content read timeout or binary response
    }

  } catch (err: any) {
    if (err.name === 'AbortError') {
      findings.push('⏱️ **Hết thời gian chờ (Timeout):** Máy chủ đích phản hồi quá chậm (>6s).');
    } else {
      findings.push(`⚠️ **Lỗi kết nối HTTP:** ${err.message || 'Không thể thiết lập kết nối.'}`);
    }
  }

  const durationMs = Date.now() - startTime;

  // 4. Gemini AI Deep Threat Evaluation (if key available)
  let aiVerdict = '';
  if (process.env.GEMINI_API_KEY && findings.length > 0) {
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      const prompt = `Phân tích độ an toàn trang web sau với vai trò chuyên gia an ninh mạng CyberSec:
URL: ${targetUrl}
Hostname: ${hostname}
IP: ${ipAddress}
Dấu hiệu kỹ thuật: ${findings.join(' | ')}
Điểm rủi ro nội bộ: ${threatScore}/100.
Hãy đưa ra 1 nhận định ngắn gọn (tối đa 2 câu) về mức độ an toàn cho người dùng Discord.`;

      const aiResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });
      if (aiResponse.text) {
        aiVerdict = aiResponse.text.trim();
      }
    } catch {
      // Fallback if AI fails
    }
  }

  // Determine Level & Badge
  let statusBadge = '🟢 AN TOÀN TUYỆT ĐỐI';
  let embedColor = '#23A559'; // Green
  let threatLevel: 'safe' | 'warning' | 'danger' = 'safe';

  if (threatScore >= 60) {
    statusBadge = '🔴 MÃ ĐỘC / LỪA ĐẢO NGUY HIỂM';
    embedColor = '#ED4245'; // Red
    threatLevel = 'danger';
  } else if (threatScore >= 25) {
    statusBadge = '🟡 ĐÁNG NGHI VẤN / CẨN TRỌNG';
    embedColor = '#FEE75C'; // Yellow
    threatLevel = 'warning';
  }

  // Save to local state history
  const scanRecord: ScanRecord = {
    id: `scan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: 'web',
    target: targetUrl,
    threatScore,
    threatLevel,
    statusBadge,
    timestamp: Date.now(),
    author,
    guildName,
    durationMs,
    findings,
    ipAddress,
    isHttps,
    statusCode,
    serverBanner,
    aiVerdict: aiVerdict || undefined,
  };
  addScanRecord(scanRecord);

  const embed = new EmbedBuilder()
    .setTitle('🛡️ Sentinel CyberSec • Báo Cáo Phân Tích Web Pro')
    .setColor(embedColor as any)
    .setDescription(`Mục tiêu phân tích: [**${hostname}**](${targetUrl})`)
    .addFields(
      { name: '📊 Đánh Giá An Ninh', value: `**${statusBadge}** (Threat Score: \`${threatScore}/100\`)`, inline: false },
      { name: '🌐 Địa Chỉ IP', value: `\`${ipAddress}\``, inline: true },
      { name: '🔒 Giao thức SSL', value: isHttps ? '`HTTPS Mã hóa`' : '`HTTP Không bảo mật`', inline: true },
      { name: '📡 HTTP Status', value: statusCode > 0 ? `\`${statusCode}\`` : '`Không phản hồi`', inline: true },
      { name: '🏢 Máy Chủ / Server', value: `\`${serverBanner}\``, inline: true },
      { name: '⚡ Thời gian phản hồi', value: `\`${durationMs}ms\``, inline: true },
      { name: '🛡️ Hệ thống kiểm duyệt', value: '`DNS + Headers + Phishing Heuristics`', inline: true }
    );

  if (findings.length > 0) {
    embed.addFields({
      name: '🔍 Phát hiện Kỹ thuật & Rủi ro',
      value: findings.slice(0, 5).join('\n'),
      inline: false
    });
  }

  if (aiVerdict) {
    embed.addFields({
      name: '🤖 Đánh Giá Trí Tuệ Nhân Tạo (AI CyberSec)',
      value: aiVerdict,
      inline: false
    });
  }

  embed.setFooter({ text: 'SentinelBot Cyber Threat Intelligence v2.5 • Quét thời gian thực' })
    .setTimestamp();

  return embed;
}

/**
 * Scan an uploaded Discord attachment file with deep binary inspection, magic bytes & hash computation
 */
export async function performFileScan(
  fileUrl: string,
  fileName: string,
  fileSize: number,
  author: string = 'Hệ thống / Discord',
  guildName?: string
): Promise<EmbedBuilder> {
  const startTime = Date.now();
  const findings: string[] = [];
  let threatScore = 0;

  const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';

  // 1. Extension Threat Assessment
  if (SUSPICIOUS_EXTENSIONS.has(ext)) {
    threatScore += 50;
    findings.push(`🚨 **Định dạng file thực thi:** Đuôi \`.${ext}\` có khả năng chạy lệnh hoặc mã độc trực tiếp trên máy.`);
  }

  // Check double extension trick (e.g. funny_meme.png.exe)
  const parts = fileName.split('.');
  if (parts.length > 2) {
    const secondLast = parts[parts.length - 2].toLowerCase();
    const last = parts[parts.length - 1].toLowerCase();
    if (['png', 'jpg', 'pdf', 'docx', 'mp4', 'txt'].includes(secondLast) && SUSPICIOUS_EXTENSIONS.has(last)) {
      threatScore += 75;
      findings.push(`🛑 **Ngụy trang đuôi mở rộng kép (Double Extension):** File giả dạng tài liệu/ảnh \`.${secondLast}\` nhưng đuôi thật là \`.${last}\`!`);
    }
  }

  let sha256 = 'N/A';
  let md5 = 'N/A';
  let entropy = 0;
  let detectedType = 'Không xác định / Binary thô';
  let isDisguised = false;

  // 2. Fetch File Buffer for Binary Deep Inspection
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(fileUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const arrayBuf = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      // Compute Hashes
      sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
      md5 = crypto.createHash('md5').update(buffer).digest('hex');

      // Calculate Shannon Entropy
      entropy = calculateEntropy(buffer);
      if (entropy > 7.3 && buffer.length > 2048) {
        threatScore += 35;
        findings.push(`⚠️ **Độ hỗn loạn Entropy cao (\`${entropy}/8.0\`):** Dữ liệu bị nén chặt hoặc mã hóa/obfuscate (Dấu hiệu của packer/ransomware payload).`);
      } else {
        findings.push(`📊 **Độ hỗn loạn Entropy:** \`${entropy}/8.0\` (Bình thường)`);
      }

      // Read Magic Bytes (First 4 bytes)
      const headerHex = buffer.slice(0, 4).toString('hex').toLowerCase();
      let matchedSignature = false;

      for (const [sig, info] of Object.entries(MAGIC_BYTES)) {
        if (headerHex.startsWith(sig)) {
          detectedType = `${info.mime} (*.${info.ext})`;
          matchedSignature = true;

          // Detect executable disguised as innocent file (e.g. .exe named as .png)
          if (info.isExecutable && !['exe', 'dll', 'sys', 'com'].includes(ext)) {
            isDisguised = true;
            threatScore += 90;
            findings.push(`🛑 **NGỤY TRANG MÃ ĐỘC NGUY HIỂM:** File có đuôi hiển thị là \`.${ext}\` nhưng header nhị phân là file thực thi Windows EXE (\`MZ\`)!`);
          }
          break;
        }
      }

      if (!matchedSignature) {
        detectedType = `Binary Header: \`0x${headerHex.toUpperCase()}\``;
      }

      // Check text-based script payloads (batch, powershell, python, js)
      if (buffer.length < 500000) {
        const textContent = buffer.toString('utf-8', 0, Math.min(buffer.length, 50000));
        if (
          textContent.includes('discord.com/api/webhooks') ||
          (textContent.includes('token') && textContent.includes('localstorage')) ||
          textContent.includes('discord/Local Storage/leveldb') ||
          textContent.includes('d.py') ||
          textContent.includes('PyHook')
        ) {
          threatScore += 80;
          findings.push('🚨 **Phát hiện Discord Token Stealer:** Tìm thấy chuỗi trích xuất token.');
        }
        if (
          textContent.includes('Invoke-WebRequest') ||
          textContent.includes('DownloadString') ||
          textContent.includes('powershell -e') ||
          textContent.includes('FromBase64String') ||
          textContent.includes('WriteAllBytes') ||
          textContent.includes('eval(') ||
          textContent.includes('ExecuteStatement') ||
          textContent.includes('new ActiveXObject')
        ) {
          threatScore += 70;
          findings.push('⚠️ **Phát hiện mã độc tiềm ẩn:** Chứa lệnh thực thi từ xa hoặc script obfuse (Obfuscated Script).');
        }
      }
    }
  } catch (err: any) {
    findings.push(`⚠️ Không thể tải toàn bộ tệp để quét nhị phân: ${err.message || 'Lỗi kết nối'}`);
  }

  const durationMs = Date.now() - startTime;

  // Rating & Status
  let statusBadge = '🟢 FILE AN TOÀN';
  let embedColor = '#23A559';
  let threatLevel: 'safe' | 'warning' | 'danger' = 'safe';

  if (threatScore >= 60 || isDisguised) {
    statusBadge = '🔴 PHÁT HIỆN MÃ ĐỘC / NGUY HIỂM CAO';
    embedColor = '#ED4245';
    threatLevel = 'danger';
  } else if (threatScore >= 25) {
    statusBadge = '🟡 FILE CÓ RỦI RO / CẦN CẨN TRỌNG';
    embedColor = '#FEE75C';
    threatLevel = 'warning';
  }

  // Save to local state history
  const fileScanRecord: ScanRecord = {
    id: `scan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type: 'file',
    target: fileName,
    threatScore,
    threatLevel,
    statusBadge,
    timestamp: Date.now(),
    author,
    guildName,
    durationMs,
    findings,
    fileSize,
    detectedType,
    sha256,
    md5,
    entropy,
  };
  addScanRecord(fileScanRecord);

  const embed = new EmbedBuilder()
    .setTitle('🛡️ Sentinel CyberSec • Báo Cáo Phân Tích Tệp Tin Pro')
    .setColor(embedColor as any)
    .setDescription(`Tệp mục tiêu: **\`${fileName}\`**`)
    .addFields(
      { name: '📊 Kết Luận An Ninh', value: `**${statusBadge}** (Risk Score: \`${threatScore}/100\`)`, inline: false },
      { name: '📦 Kích Thước', value: `\`${(fileSize / 1024).toFixed(2)} KB\``, inline: true },
      { name: '🏷️ Định dạng nhị phân', value: `\`${detectedType}\``, inline: true },
      { name: '⚡ Thời gian quét', value: `\`${durationMs}ms\``, inline: true },
      { name: '🔑 Mã băm SHA-256', value: `\`${sha256.slice(0, 32)}...\``, inline: false },
      { name: '🔑 Mã băm MD5', value: `\`${md5}\``, inline: true },
      { name: '🛡️ Động cơ phân tích', value: '`Magic Bytes + Entropy + Anti-Stealer`', inline: true }
    );

  if (findings.length > 0) {
    embed.addFields({
      name: '🔍 Chi Tiết Phân Tích & Cảnh Báo',
      value: findings.join('\n'),
      inline: false
    });
  }

  embed.setFooter({ text: 'SentinelBot Deep File Inspector v2.5 • Bảo vệ Discord Server' })
    .setTimestamp();

  return embed;
}

export { getScanHistory, clearScanHistory, addScanRecord } from './scanHistory';

