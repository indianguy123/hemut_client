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
  is_direct: boolean;
  members: { id: string; username: string; display_name: string; status: string }[];
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

export default function DMPage() {
  const params = useParams();
  const channelId = params.userId as string; // This is actually the channel ID for the DM
  const { user } = useAuth();
  const { on, off, send } = useWebSocket();

  const [messages, setMessages] = useState<MessageData[]>([]);
  const [channel, setChannel] = useState<ChannelDetail | null>(null);
  const [otherUser, setOtherUser] = useState<{ display_name: string; status: string } | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Load channel details to find the other user
  useEffect(() => {
    const loadChannel = async () => {
      try {
        const { promise } = xhrGet<ChannelDetail>(API.CHANNEL(channelId), getAuthHeaders());
        const resp = await promise;
        setChannel(resp.data);
        const other = resp.data.members.find(m => m.id !== user?.id);
        if (other) {
          setOtherUser({ display_name: other.display_name, status: other.status });
        }
      } catch (err) {
        console.error('Failed to load DM channel:', err);
      }
    };
    loadChannel();
  }, [channelId, user?.id]);

  // Load messages
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
    xhrPost(API.MARK_READ(channelId), {}, getAuthHeaders()).promise.catch(() => {});
    send({ type: 'subscribe', channel_id: channelId });
  }, [channelId, send, scrollToBottom]);

  // Real-time messages
  useEffect(() => {
    const handleNewMessage = (data: Record<string, unknown>) => {
      if ((data.channel_id as string) !== channelId) return;
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
      xhrPost(API.MARK_READ(channelId), {}, getAuthHeaders()).promise.catch(() => {});
    };

    const handleTyping = (data: Record<string, unknown>) => {
      if ((data.channel_id as string) !== channelId) return;
      const typingUsername = data.username as string;
      if (typingUsername === user?.username) return;
      setTypingUsers(prev => prev.includes(typingUsername) ? prev : [...prev, typingUsername]);
      setTimeout(() => {
        setTypingUsers(prev => prev.filter(u => u !== typingUsername));
      }, 3000);
    };

    on('new_message', handleNewMessage);
    on('typing_indicator', handleTyping);
    return () => { off('new_message', handleNewMessage); off('typing_indicator', handleTyping); };
  }, [channelId, on, off, user?.username, scrollToBottom]);

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text) return;
    setInputValue('');

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: MessageData = {
      id: tempId,
      channel_id: channelId,
      sender_id: user?.id || '',
      sender_username: user?.username || '',
      sender_display_name: user?.display_name || user?.username || '',
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
      const { promise } = xhrPost(API.MESSAGES(channelId), { content: text, message_type: 'text' }, getAuthHeaders());
      const resp = await promise;
      setMessages(prev => prev.map(m => m.id === tempId ? { ...resp.data, status: 'sent' } : m));
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'error' } : m));
    }
  };

  const getInitials = (name: string) => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={styles.channelView}>
      {/* Header */}
      <div className={styles.channelHeader}>
        <div className={styles.channelHeaderLeft}>
          <div className={styles.dmHeader}>
            <div className={styles.dmAvatar}>{otherUser ? getInitials(otherUser.display_name) : '?'}</div>
            <span className={styles.channelHeaderName}>{otherUser?.display_name || 'Direct Message'}</span>
          </div>
        </div>
        <div className={styles.channelHeaderRight}>
          <button
            className={`${styles.aiChatBtn} ${isAiPanelOpen ? styles.active : ''}`}
            onClick={() => setIsAiPanelOpen(!isAiPanelOpen)}
            title="AI Assistant"
            id="dm-ai-chat-toggle"
          >
            <span className={styles.aiChatBtnIcon}>🤖</span>
            <span className={styles.aiChatBtnLabel}>AI</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className={styles.messagesArea}>
        {isLoading ? (
          <ChatSkeleton />
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`${styles.messageGroup} ${msg.sender_id === user?.id ? styles.messageSelf : ''} ${msg.status === 'sending' ? styles.messageSending : ''} ${msg.status === 'error' ? styles.messageError : ''}`}
            >
              <div className={styles.messageAvatar}>{getInitials(msg.sender_display_name)}</div>
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
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing */}
      <div className={styles.typingIndicator}>
        {typingUsers.length > 0 && (
          <>
            <div className={styles.typingDots}><span /><span /><span /></div>
            <span>{typingUsers.join(', ')} is typing...</span>
          </>
        )}
      </div>

      {/* Input */}
      <div className={styles.messageInputContainer}>
        <div className={styles.messageInputWrapper}>
          <input
            className={styles.messageInput}
            value={inputValue}
            onChange={(e) => { setInputValue(e.target.value); send({ type: 'typing', channel_id: channelId }); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={`Message ${otherUser?.display_name || '...'}`}
            id="dm-message-input"
          />
          <button className={styles.sendButton} onClick={handleSend} disabled={!inputValue.trim()} id="dm-send-button">
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
