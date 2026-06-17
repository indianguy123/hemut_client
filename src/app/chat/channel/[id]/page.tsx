'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { xhrGet, xhrPost } from '@/lib/xhr';
import { API } from '@/lib/constants';
import { getAuthHeaders } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import { useWebSocket } from '@/context/WebSocketContext';
import AiChatPanel from '@/components/chat/AiChatPanel';
import styles from '../../chat.module.css';

interface MessageData {
  id: string;
  channel_id: string;
  sender_id: string;
  sender_username: string;
  sender_display_name: string;
  sender_avatar_url: string | null;
  content: string;
  message_type: string;
  metadata: Record<string, unknown> | null;
  sequence_num: number;
  created_at: string;
  status?: 'sending' | 'sent' | 'error';
}

interface ChannelDetail {
  id: string;
  name: string;
  description: string | null;
  member_count: number;
  members: { id: string; username: string; display_name: string; status: string }[];
}

interface ShipmentData {
  tracking_id: string;
  origin: string;
  destination: string;
  status: string;
  carrier: string;
  weight_kg: number;
  eta: string | null;
}

const ChatSkeleton = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
    {[...Array(5)].map((_, i) => (
      <div key={i} className={styles.messageGroup} style={{ opacity: 1 - i * 0.15 }}>
        <div className={`${styles.messageAvatar} skeleton`} style={{ background: 'none' }} />
        <div className={styles.messageContent} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className={styles.messageHeader}>
            <div className="skeleton" style={{ width: '120px', height: '16px', borderRadius: '4px' }} />
            <div className="skeleton" style={{ width: '60px', height: '12px', borderRadius: '4px' }} />
          </div>
          <div className="skeleton" style={{ width: i % 2 === 0 ? '70%' : '50%', height: '14px', borderRadius: '4px' }} />
        </div>
      </div>
    ))}
  </div>
);

export default function ChannelPage() {
  const params = useParams();
  const channelId = params.id as string;
  const { user } = useAuth();
  const { on, off, send } = useWebSocket();

  const [messages, setMessages] = useState<MessageData[]>([]);
  const [channel, setChannel] = useState<ChannelDetail | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Load channel details
  useEffect(() => {
    const loadChannel = async () => {
      try {
        const { promise } = xhrGet<ChannelDetail>(API.CHANNEL(channelId), getAuthHeaders());
        const resp = await promise;
        setChannel(resp.data);
      } catch (err) {
        console.error('Failed to load channel:', err);
      }
    };
    loadChannel();
  }, [channelId]);

  // Load message history
  useEffect(() => {
    const loadMessages = async () => {
      setIsLoading(true);
      try {
        const { promise } = xhrGet<{ messages: MessageData[]; has_more: boolean; next_cursor: number | null }>(
          API.MESSAGES(channelId),
          getAuthHeaders(),
        );
        const resp = await promise;
        setMessages(resp.data.messages.reverse());
        setHasMore(resp.data.has_more);
        setNextCursor(resp.data.next_cursor);
        setTimeout(() => scrollToBottom(false), 50);
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadMessages();

    // Mark as read
    xhrPost(API.MARK_READ(channelId), {}, getAuthHeaders()).promise.catch(() => {});

    // Subscribe to channel via WebSocket
    send({ type: 'subscribe', channel_id: channelId });
  }, [channelId, send, scrollToBottom]);

  // Real-time message handling
  useEffect(() => {
    const handleNewMessage = (data: Record<string, unknown>) => {
      const msgChannelId = data.channel_id as string;
      if (msgChannelId !== channelId) return;

      const message = data.message as MessageData;
      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) return prev;
        const sendingIndex = prev.findIndex(
          m => m.status === 'sending' && m.content === message.content && m.sender_id === message.sender_id
        );
        if (sendingIndex !== -1) {
          const updated = [...prev];
          updated[sendingIndex] = { ...message, status: 'sent' };
          return updated;
        }
        return [...prev, message];
      });
      setTimeout(() => scrollToBottom(), 50);

      // Mark as read
      xhrPost(API.MARK_READ(channelId), {}, getAuthHeaders()).promise.catch(() => {});
    };

    const handleTyping = (data: Record<string, unknown>) => {
      const typingChannelId = data.channel_id as string;
      const typingUsername = data.username as string;
      if (typingChannelId !== channelId || typingUsername === user?.username) return;

      setTypingUsers(prev => {
        if (prev.includes(typingUsername)) return prev;
        return [...prev, typingUsername];
      });

      setTimeout(() => {
        setTypingUsers(prev => prev.filter(u => u !== typingUsername));
      }, 3000);
    };

    on('new_message', handleNewMessage);
    on('typing_indicator', handleTyping);

    return () => {
      off('new_message', handleNewMessage);
      off('typing_indicator', handleTyping);
    };
  }, [channelId, on, off, user?.username, scrollToBottom]);

  // Load more (older) messages
  const loadMore = async () => {
    if (!hasMore || nextCursor === null) return;
    try {
      const { promise } = xhrGet<{ messages: MessageData[]; has_more: boolean; next_cursor: number | null }>(
        `${API.MESSAGES(channelId)}?cursor=${nextCursor}`,
        getAuthHeaders(),
      );
      const resp = await promise;
      setMessages(prev => [...resp.data.messages.reverse(), ...prev]);
      setHasMore(resp.data.has_more);
      setNextCursor(resp.data.next_cursor);
    } catch (err) {
      console.error('Failed to load more:', err);
    }
  };

  // Send message
  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text) return;

    setInputValue('');

    // Check for /shipment command
    const shipmentMatch = text.match(/^\/shipment\s+(.+)$/i);
    if (shipmentMatch) {
      const trackingId = shipmentMatch[1].trim();
      try {
        const { promise } = xhrGet<ShipmentData>(API.SHIPMENT(trackingId), getAuthHeaders());
        const shipment = await promise;

        const tempId = `temp-${Date.now()}`;
        const optimisticMsg: MessageData = {
          id: tempId,
          channel_id: channelId,
          sender_id: user?.id || '',
          sender_username: user?.username || '',
          sender_display_name: user?.display_name || user?.username || '',
          sender_avatar_url: user?.avatar_url || null,
          content: `📦 Shipment ${shipment.data.tracking_id}`,
          message_type: 'shipment',
          metadata: shipment.data as unknown as Record<string, unknown>,
          sequence_num: (messages.length > 0 ? messages[messages.length - 1].sequence_num : 0) + 1,
          created_at: new Date().toISOString(),
          status: 'sending',
        };
        setMessages(prev => [...prev, optimisticMsg]);
        setTimeout(() => scrollToBottom(), 50);

        const { promise: postPromise } = xhrPost(API.MESSAGES(channelId), {
          content: `📦 Shipment ${shipment.data.tracking_id}`,
          message_type: 'shipment',
          metadata: shipment.data,
        }, getAuthHeaders());
        const resp = await postPromise;
        setMessages(prev => prev.map(m => m.id === tempId ? { ...resp.data, status: 'sent' } : m));
      } catch {
        const tempId = `temp-${Date.now()}`;
        const optimisticMsg: MessageData = {
          id: tempId,
          channel_id: channelId,
          sender_id: user?.id || '',
          sender_username: user?.username || '',
          sender_display_name: user?.display_name || user?.username || '',
          sender_avatar_url: user?.avatar_url || null,
          content: `⚠️ Shipment "${trackingId}" not found`,
          message_type: 'text',
          metadata: null,
          sequence_num: (messages.length > 0 ? messages[messages.length - 1].sequence_num : 0) + 1,
          created_at: new Date().toISOString(),
          status: 'sending',
        };
        setMessages(prev => [...prev, optimisticMsg]);
        setTimeout(() => scrollToBottom(), 50);

        try {
          const { promise: postPromise } = xhrPost(API.MESSAGES(channelId), {
            content: `⚠️ Shipment "${trackingId}" not found`,
            message_type: 'text',
          }, getAuthHeaders());
          const resp = await postPromise;
          setMessages(prev => prev.map(m => m.id === tempId ? { ...resp.data, status: 'sent' } : m));
        } catch {
          setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error' } : m));
        }
      }
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: MessageData = {
      id: tempId,
      channel_id: channelId,
      sender_id: user?.id || '',
      sender_username: user?.username || '',
      sender_display_name: user?.display_name || user?.username || '',
      sender_avatar_url: user?.avatar_url || null,
      content: text,
      message_type: 'text',
      metadata: null,
      sequence_num: (messages.length > 0 ? messages[messages.length - 1].sequence_num : 0) + 1,
      created_at: new Date().toISOString(),
      status: 'sending',
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => scrollToBottom(), 50);

    try {
      const { promise } = xhrPost(API.MESSAGES(channelId), {
        content: text,
        message_type: 'text',
      }, getAuthHeaders());
      const resp = await promise;
      setMessages(prev => prev.map(m => m.id === tempId ? { ...resp.data, status: 'sent' } : m));
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error' } : m));
    }
  };

  // Typing indicator
  const handleInputChange = (value: string) => {
    setInputValue(value);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    send({ type: 'typing', channel_id: channelId });
    typingTimeoutRef.current = setTimeout(() => {}, 3000);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: MessageData[] }[] = [];
  let currentDate = '';
  for (const msg of messages) {
    const msgDate = formatDate(msg.created_at);
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groupedMessages.push({ date: msgDate, messages: [] });
    }
    groupedMessages[groupedMessages.length - 1].messages.push(msg);
  }

  const renderShipmentCard = (metadata: Record<string, unknown>) => {
    const status = (metadata.status as string) || 'pending';
    const statusClass = status.replace(' ', '_');
    return (
      <div className={styles.shipmentCard}>
        <div className={styles.shipmentCardHeader}>
          <span className={styles.shipmentTrackingId}>{metadata.tracking_id as string}</span>
          <span className={`${styles.shipmentStatus} ${styles[statusClass]}`}>
            {status === 'in_transit' ? '🚚 In Transit' :
             status === 'delivered' ? '✅ Delivered' :
             status === 'delayed' ? '⚠️ Delayed' : '⏳ Pending'}
          </span>
        </div>
        <div className={styles.shipmentRoute}>
          <span>{metadata.origin as string}</span>
          <span className={styles.shipmentArrow}>→</span>
          <span>{metadata.destination as string}</span>
        </div>
        <div className={styles.shipmentDetails}>
          <span className={styles.shipmentDetail}>
            <span className={styles.shipmentDetailLabel}>Carrier:</span> {metadata.carrier as string}
          </span>
          <span className={styles.shipmentDetail}>
            <span className={styles.shipmentDetailLabel}>Weight:</span> {metadata.weight_kg as number}kg
          </span>
          {!!metadata.eta && (
            <span className={styles.shipmentDetail}>
              <span className={styles.shipmentDetailLabel}>ETA:</span> {new Date(metadata.eta as string).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.channelView}>
      {/* Header */}
      <div className={styles.channelHeader}>
        <div className={styles.channelHeaderLeft}>
          <span className={styles.channelHeaderHash}>#</span>
          <span className={styles.channelHeaderName}>{channel?.name || '...'}</span>
          {channel?.description && (
            <>
              <span className={styles.channelHeaderDivider} />
              <span className={styles.channelHeaderDesc}>{channel.description}</span>
            </>
          )}
        </div>
        <div className={styles.channelHeaderRight}>
          <button
            className={`${styles.aiChatBtn} ${isAiPanelOpen ? styles.active : ''}`}
            onClick={() => setIsAiPanelOpen(!isAiPanelOpen)}
            title="AI Assistant"
            id="ai-chat-toggle"
          >
            <span className={styles.aiChatBtnIcon}>🤖</span>
            <span className={styles.aiChatBtnLabel}>AI</span>
          </button>
          <span className={styles.memberCount}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" strokeLinecap="round" />
            </svg>
            {channel?.member_count || 0}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className={styles.messagesArea} ref={messagesAreaRef}>
        {hasMore && (
          <button className={styles.loadMoreButton} onClick={loadMore}>
            Load older messages
          </button>
        )}

        {isLoading ? (
          <ChatSkeleton />
        ) : (
          groupedMessages.map((group, gi) => (
            <React.Fragment key={gi}>
              <div className={styles.dateSeparator}>
                <span className={styles.dateSeparatorText}>{group.date}</span>
              </div>
              {group.messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`${styles.messageGroup} ${msg.status === 'sending' ? styles.messageSending : ''} ${msg.status === 'error' ? styles.messageError : ''}`}
                >
                  <div className={styles.messageAvatar}>
                    {getInitials(msg.sender_display_name)}
                  </div>
                  <div className={styles.messageContent}>
                    <div className={styles.messageHeader}>
                      <span className={styles.messageSender}>{msg.sender_display_name}</span>
                      <span className={styles.messageTimestamp}>
                        {msg.status === 'sending' ? 'sending...' : formatTime(msg.created_at)}
                      </span>
                      {msg.status === 'error' && (
                        <span className={styles.messageErrorIndicator} title="Failed to send.">
                          ⚠️ Failed to send
                        </span>
                      )}
                    </div>
                    <div className={styles.messageText}>{msg.content}</div>
                    {msg.message_type === 'shipment' && msg.metadata && renderShipmentCard(msg.metadata)}
                  </div>
                </div>
              ))}
            </React.Fragment>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      <div className={styles.typingIndicator}>
        {typingUsers.length > 0 && (
          <>
            <div className={styles.typingDots}><span /><span /><span /></div>
            <span>
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </span>
          </>
        )}
      </div>

      {/* Message input */}
      <div className={styles.messageInputContainer}>
        <div className={styles.messageInputWrapper}>
          <input
            className={styles.messageInput}
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Message #${channel?.name || '...'}`}
            id="message-input"
          />
          <button
            className={styles.sendButton}
            onClick={handleSend}
            disabled={!inputValue.trim()}
            id="send-message-button"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* AI Chat Panel */}
      <AiChatPanel
        channelId={channelId}
        isOpen={isAiPanelOpen}
        onClose={() => setIsAiPanelOpen(false)}
      />
    </div>
  );
}
