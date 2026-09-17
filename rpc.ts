import { Client, ActivityType, PresenceStatusData } from 'discord.js';

export interface BotRpcConfig {
  activityType: 'Playing' | 'Watching' | 'Listening' | 'Streaming' | 'Competing' | 'Custom';
  activityName: string;
  status: 'online' | 'idle' | 'dnd' | 'invisible';
  streamUrl?: string;
  state?: string;
  autoRotate: boolean;
  intervalSeconds: number;
}

const DEFAULT_RPC: BotRpcConfig = {
  activityType: 'Watching',
  activityName: '🛡️ Bảo vệ máy chủ | .help',
  status: 'online',
  streamUrl: 'https://www.twitch.tv/sentinelbot_defense',
  state: 'Lá chắn Anti-Raid & Gemini AI',
  autoRotate: true,
  intervalSeconds: 30,
};

let currentRpc: BotRpcConfig = { ...DEFAULT_RPC };
let rotationTimer: NodeJS.Timeout | null = null;
let currentRotationIndex = 0;

export function getRpcConfig(): BotRpcConfig {
  return { ...currentRpc };
}

export function mapActivityType(type: BotRpcConfig['activityType']): ActivityType {
  switch (type) {
    case 'Playing':
      return ActivityType.Playing;
    case 'Streaming':
      return ActivityType.Streaming;
    case 'Listening':
      return ActivityType.Listening;
    case 'Watching':
      return ActivityType.Watching;
    case 'Competing':
      return ActivityType.Competing;
    case 'Custom':
      return ActivityType.Custom;
    default:
      return ActivityType.Playing;
  }
}

export function applyRpcToBot(client: Client, config?: Partial<BotRpcConfig>): boolean {
  if (config) {
    currentRpc = { ...currentRpc, ...config };
  }

  if (!client.user) {
    return false;
  }

  const actType = mapActivityType(currentRpc.activityType);
  const activityData: any = {
    name: currentRpc.activityName,
    type: actType,
  };

  if (currentRpc.state) {
    activityData.state = currentRpc.state;
  }

  if (currentRpc.activityType === 'Streaming' && currentRpc.streamUrl) {
    activityData.url = currentRpc.streamUrl;
  }

  try {
    client.user.setPresence({
      activities: [activityData],
      status: currentRpc.status as PresenceStatusData,
    });
    return true;
  } catch (err) {
    console.error('Lỗi khi set presence cho bot:', err);
    return false;
  }
}

export function startRpcRotation(client: Client) {
  if (rotationTimer) {
    clearInterval(rotationTimer);
    rotationTimer = null;
  }

  if (!currentRpc.autoRotate) return;

  const getDynamicPresets = () => {
    const guildCount = client.guilds?.cache?.size || 1;
    return [
      {
        activityType: 'Watching' as const,
        activityName: `🛡️ ${guildCount} máy chủ | .help`,
        state: 'Hệ thống Anti-Raid & Anti-Nuke hoạt động 24/7',
      },
      {
        activityType: 'Playing' as const,
        activityName: '🤖 Gemini 3.8 Flash | .chat / .ai',
        state: 'Trò chuyện AI cọc tính & siêu khịa 🤣💀',
      },
      {
        activityType: 'Listening' as const,
        activityName: '🎵 Nhạc 320kbps siêu mượt | .play',
        state: 'Voice channel audio player',
      },
      {
        activityType: 'Watching' as const,
        activityName: '🚨 .clean để dọn rác & spam links',
        state: 'Bảo vệ thành viên an toàn',
      },
      {
        activityType: 'Competing' as const,
        activityName: '🏆 Top 1 Bot Bảo Mật Discord VN',
        state: 'SentinelBot Defense Engine',
      },
    ];
  };

  rotationTimer = setInterval(() => {
    if (!currentRpc.autoRotate || !client.user) return;
    const presets = getDynamicPresets();
    currentRotationIndex = (currentRotationIndex + 1) % presets.length;
    const item = presets[currentRotationIndex];

    applyRpcToBot(client, {
      activityType: item.activityType,
      activityName: item.activityName,
      state: item.state,
    });
  }, Math.max(15, currentRpc.intervalSeconds) * 1000);
}

export function setRpcAutoRotate(client: Client, enabled: boolean, seconds?: number) {
  currentRpc.autoRotate = enabled;
  if (seconds && seconds >= 10) {
    currentRpc.intervalSeconds = seconds;
  }
  if (enabled) {
    startRpcRotation(client);
  } else if (rotationTimer) {
    clearInterval(rotationTimer);
    rotationTimer = null;
  }
}
