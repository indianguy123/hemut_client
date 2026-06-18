'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { xhrGet, xhrPost } from '@/lib/xhr';
import { API } from '@/lib/constants';
import { getAuthHeaders } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import { useWebSocket } from '@/context/WebSocketContext';
import styles from './Sidebar.module.css';

interface ChannelInfo {
  id: string;
  name: string;
  description: string | null;
  is_direct: boolean;
  unread_count: number;
  member_count: number;
}

interface DMConversation {
  channel_id: string;
  channel_name: string;
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    status: string;
  };
}

interface UserInfo {
  id: string;
  username: string;
  display_name: string;
  status: string;
}

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { on, off, isConnected } = useWebSocket();

  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [dmConversations, setDMConversations] = useState<DMConversation[]>([]);
  const [presenceMap, setPresenceMap] = useState<Record<string, string>>({});
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [allUsers, setAllUsers] = useState<UserInfo[]>([]);
  const [channelError, setChannelError] = useState('');
  const [alertsUnreadCount, setAlertsUnreadCount] = useState(0);

  const loadAlertsCount = useCallback(async () => {
    try {
      const { promise } = xhrGet<{ alerts: any[] }>(API.ALERTS, getAuthHeaders());
      const resp = await promise;
      setAlertsUnreadCount(resp.data.alerts.length);
    } catch (err) {
      console.error('Failed to load alerts count:', err);
    }
  }, []);

  const loadChannels = useCallback(async () => {
    try {
      const { promise } = xhrGet<ChannelInfo[]>(API.CHANNELS, getAuthHeaders());
      const resp = await promise;
      setChannels(resp.data);
    } catch (err) {
      console.error('Failed to load channels:', err);
    }
  }, []);

  const loadDMs = useCallback(async () => {
    try {
      const { promise } = xhrGet<DMConversation[]>(API.DM_LIST, getAuthHeaders());
      const resp = await promise;
      setDMConversations(resp.data);
    } catch (err) {
      console.error('Failed to load DMs:', err);
    }
  }, []);

  useEffect(() => {
    loadChannels();
    loadDMs();
    loadAlertsCount();
  }, [loadChannels, loadDMs, loadAlertsCount]);

  // Listen for new messages to update unread counts
  useEffect(() => {
    const handleNewMessage = (data: Record<string, unknown>) => {
      const channelId = data.channel_id as string;
      const currentChannelId = pathname?.split('/').pop();

      if (channelId !== currentChannelId) {
        setChannels(prev => prev.map(ch =>
          ch.id === channelId ? { ...ch, unread_count: ch.unread_count + 1 } : ch
        ));
      }
    };

    const handlePresence = (data: Record<string, unknown>) => {
      const userId = data.user_id as string;
      const status = data.status as string;
      setPresenceMap(prev => ({ ...prev, [userId]: status }));
    };

    const handleAlertCreated = () => {
      setAlertsUnreadCount(prev => prev + 1);
    };

    on('new_message', handleNewMessage);
    on('presence_update', handlePresence);
    on('AI_ALERT_CREATED', handleAlertCreated);

    return () => {
      off('new_message', handleNewMessage);
      off('presence_update', handlePresence);
      off('AI_ALERT_CREATED', handleAlertCreated);
    };
  }, [on, off, pathname]);

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    setChannelError('');

    try {
      const { promise } = xhrPost(API.CHANNELS, {
        name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
        description: null,
      }, getAuthHeaders());
      const resp = await promise;
      const newChannel = resp.data as ChannelInfo;
      setChannels(prev => [...prev, { ...newChannel, unread_count: 0, member_count: 1 }]);
      setNewChannelName('');
      setShowNewChannel(false);
      router.push(`/chat/channel/${newChannel.id}`);
    } catch (err) {
      setChannelError('Channel name already taken');
    }
  };

  const handleStartDM = async (targetUser: UserInfo) => {
    try {
      const { promise } = xhrPost<{ id: string }>(API.DM_CREATE(targetUser.id), {}, getAuthHeaders());
      const resp = await promise;
      setShowNewDM(false);
      loadDMs();
      router.push(`/chat/dm/${resp.data.id}`);
    } catch (err) {
      console.error('Failed to create DM:', err);
    }
  };

  const loadUsers = async () => {
    try {
      const { promise } = xhrGet<UserInfo[]>(API.USERS, getAuthHeaders());
      const resp = await promise;
      setAllUsers(resp.data.filter(u => u.id !== user?.id));
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  const getPresence = (userId: string, defaultStatus?: string) => {
    return presenceMap[userId] || defaultStatus || 'offline';
  };

  return (
    <aside className={styles.sidebar}>
      {/* Workspace header */}
      <div className={styles.workspaceHeader}>
        <div className={styles.workspaceName}>
          <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
            <path d="M14 24L20 8L22 8L18 20L26 20L20 36L18 36L22 24L14 24Z" fill="#FFD33B" />
          </svg>
          <span>Hemut Logistics</span>
        </div>
        <div className={styles.connectionStatus}>
          <span className={`${styles.connectionDot} ${isConnected ? styles.connected : ''}`} />
        </div>
      </div>

      {/* Global Apps / Alerts */}
      <div className={styles.section} style={{ marginTop: '12px' }}>
        <button
          className={`${styles.channelItem} ${pathname === '/alerts' ? styles.active : ''}`}
          onClick={() => {
            router.push('/alerts');
            setAlertsUnreadCount(0); // optimistic clear
          }}
        >
          <span className={styles.channelHash}>⚠️</span>
          <span className={`${styles.channelName} ${alertsUnreadCount > 0 ? styles.unread : ''}`}>
            AI Alerts
          </span>
          {alertsUnreadCount > 0 && (
            <span className="badge">{alertsUnreadCount}</span>
          )}
        </button>
      </div>

      {/* Channels */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Channels</span>
          <button className={styles.addButton} onClick={() => setShowNewChannel(!showNewChannel)} title="Create channel">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </svg>
          </button>
        </div>

        {showNewChannel && (
          <div className={styles.newChannelForm}>
            <input
              className={styles.newChannelInput}
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="channel-name"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateChannel()}
              autoFocus
            />
            {channelError && <span className={styles.formError}>{channelError}</span>}
          </div>
        )}

        <div className={styles.channelList}>
          {channels.map(channel => {
            const isActive = pathname === `/chat/channel/${channel.id}`;
            return (
              <button
                key={channel.id}
                className={`${styles.channelItem} ${isActive ? styles.active : ''}`}
                onClick={() => {
                  router.push(`/chat/channel/${channel.id}`);
                  // Clear unread
                  setChannels(prev => prev.map(ch =>
                    ch.id === channel.id ? { ...ch, unread_count: 0 } : ch
                  ));
                }}
              >
                <span className={styles.channelHash}>#</span>
                <span className={`${styles.channelName} ${channel.unread_count > 0 ? styles.unread : ''}`}>
                  {channel.name}
                </span>
                {channel.unread_count > 0 && (
                  <span className="badge">{channel.unread_count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Direct Messages */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Direct Messages</span>
          <button className={styles.addButton} onClick={() => { setShowNewDM(!showNewDM); if (!showNewDM) loadUsers(); }} title="New DM">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </svg>
          </button>
        </div>

        {showNewDM && (
          <div className={styles.userPicker}>
            {allUsers.map(u => (
              <button key={u.id} className={styles.userPickerItem} onClick={() => handleStartDM(u)}>
                <div className={styles.userPickerAvatar}>{getInitials(u.display_name)}</div>
                <span>{u.display_name}</span>
                <span className={`presence-dot ${getPresence(u.id, u.status)}`} />
              </button>
            ))}
            {allUsers.length === 0 && <span className={styles.noUsers}>No other users yet</span>}
          </div>
        )}

        <div className={styles.channelList}>
          {dmConversations.map(dm => {
            const isActive = pathname === `/chat/dm/${dm.channel_id}`;
            const presence = getPresence(dm.user.id, dm.user.status);
            return (
              <button
                key={dm.channel_id}
                className={`${styles.channelItem} ${isActive ? styles.active : ''}`}
                onClick={() => router.push(`/chat/dm/${dm.channel_id}`)}
              >
                <div className={styles.dmItemAvatar}>
                  {getInitials(dm.user.display_name)}
                  <span className={`presence-dot ${presence} ${styles.dmPresenceDot}`} />
                </div>
                <span className={styles.channelName}>{dm.user.display_name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* User footer */}
      <div className={styles.userFooter}>
        <div className={styles.userInfo}>
          <div className={styles.userAvatar}>{user ? getInitials(user.display_name) : '?'}</div>
          <div className={styles.userDetails}>
            <span className={styles.userName}>{user?.display_name}</span>
            <span className={styles.userStatus}>
              <span className={`presence-dot online ${isConnected ? 'pulse' : ''}`} />
              {isConnected ? 'Online' : 'Connecting...'}
            </span>
          </div>
        </div>
        <button className={styles.logoutButton} onClick={logout} title="Sign out">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
