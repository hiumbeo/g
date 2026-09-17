export type ScanType = 'web' | 'file';
export type ThreatLevel = 'safe' | 'warning' | 'danger';

export interface ScanRecord {
  id: string;
  type: ScanType;
  target: string;
  threatScore: number;
  threatLevel: ThreatLevel;
  statusBadge: string;
  timestamp: number;
  author: string;
  guildName?: string;
  durationMs: number;
  findings: string[];
  // Web specific details
  ipAddress?: string;
  isHttps?: boolean;
  statusCode?: number;
  serverBanner?: string;
  aiVerdict?: string;
  // File specific details
  fileSize?: number;
  detectedType?: string;
  sha256?: string;
  md5?: string;
  entropy?: number;
}

export interface BotStatus {
  online: boolean;
  manuallyStopped?: boolean;
  botName: string | null;
  error: string;
  guildCount: number;
}

export interface BotRpcConfig {
  activityType: 'Playing' | 'Watching' | 'Listening' | 'Streaming' | 'Competing' | 'Custom';
  activityName: string;
  status: 'online' | 'idle' | 'dnd' | 'invisible';
  streamUrl?: string;
  state?: string;
  autoRotate: boolean;
  intervalSeconds: number;
}

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

export interface TikTokData {
  id: string;
  title: string;
  cover: string;
  videoUrl: string;
  hdVideoUrl?: string;
  musicUrl?: string;
  musicTitle?: string;
  musicAuthor?: string;
  author: {
    id?: string;
    uniqueId: string;
    nickname: string;
    avatar: string;
  };
  stats: {
    diggCount: number;
    commentCount: number;
    shareCount: number;
    playCount: number;
  };
  duration: number;
  images?: string[];
  originalUrl: string;
}
