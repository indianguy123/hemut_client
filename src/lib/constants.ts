const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

export const API = {
  // Auth
  REGISTER: `${API_URL}/api/auth/register`,
  LOGIN: `${API_URL}/api/auth/login`,
  ME: `${API_URL}/api/auth/me`,

  // Channels
  CHANNELS: `${API_URL}/api/channels`,
  ALL_CHANNELS: `${API_URL}/api/channels/all`,
  CHANNEL: (id: string) => `${API_URL}/api/channels/${id}`,
  JOIN_CHANNEL: (id: string) => `${API_URL}/api/channels/${id}/join`,
  LEAVE_CHANNEL: (id: string) => `${API_URL}/api/channels/${id}/leave`,

  // Messages
  MESSAGES: (channelId: string) => `${API_URL}/api/channels/${channelId}/messages`,
  MARK_READ: (channelId: string) => `${API_URL}/api/channels/${channelId}/read`,

  // Shipments
  SHIPMENTS: `${API_URL}/api/shipments`,
  SHIPMENT: (trackingId: string) => `${API_URL}/api/shipments/${trackingId}`,

  // Users
  USERS: `${API_URL}/api/users`,
  USER: (id: string) => `${API_URL}/api/users/${id}`,

  // DM
  DM_CREATE: (userId: string) => `${API_URL}/api/dm/${userId}`,
  DM_LIST: `${API_URL}/api/dm`,

  // AI
  AI_CHAT: (channelId: string) => `${API_URL}/api/ai/chat/${channelId}`,
  AI_CHAT_HISTORY: (channelId: string) => `${API_URL}/api/ai/chat/${channelId}/history`,
  SUMMARIZE: (channelId: string) => `${API_URL}/api/ai/summarize/${channelId}`,

  // Health
  HEALTH: `${API_URL}/api/health`,
} as const;

export const WS = {
  URL: (token: string) => `${WS_URL}/ws?token=${token}`,
} as const;
