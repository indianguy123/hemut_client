'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { xhrGet, xhrPost, xhrRequest } from '@/lib/xhr';
import { API } from '@/lib/constants';
import { getAuthHeaders } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import styles from './AiChatPanel.module.css';

interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  context_count?: number;
  isError?: boolean;
}

interface AiChatPanelProps {
  channelId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function AiChatPanel({ channelId, isOpen, onClose }: AiChatPanelProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load persisted history when panel opens
  useEffect(() => {
    if (!isOpen) return;

    const loadHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const { promise } = xhrGet<{ history: AiMessage[]; channel_id: string }>(
          API.AI_CHAT_HISTORY(channelId),
          getAuthHeaders(),
        );
        const resp = await promise;
        setMessages(resp.data.history);
        setTimeout(() => scrollToBottom(), 100);
      } catch (err) {
        console.error('Failed to load AI chat history:', err);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
    // Focus input when panel opens
    setTimeout(() => inputRef.current?.focus(), 400);
  }, [isOpen, channelId, scrollToBottom]);

  // Send a question to the AI
  const handleSend = async () => {
    const question = inputValue.trim();
    if (!question || isThinking) return;

    setInputValue('');

    // Optimistically add user message
    const userMsg: AiMessage = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: question,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setTimeout(() => scrollToBottom(), 50);

    setIsThinking(true);

    try {
      const { promise } = xhrPost<{ answer: string; context_count: number }>(
        API.AI_CHAT(channelId),
        { question },
        getAuthHeaders(),
      );
      const resp = await promise;

      const aiMsg: AiMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: resp.data.answer,
        created_at: new Date().toISOString(),
        context_count: resp.data.context_count,
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error('AI chat error:', err);
      const errMsg: AiMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please check that your API keys are configured correctly.',
        created_at: new Date().toISOString(),
        isError: true,
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsThinking(false);
      setTimeout(() => scrollToBottom(), 50);
    }
  };

  // Clear chat history
  const handleClearHistory = async () => {
    try {
      const { promise } = xhrRequest<unknown>({
        method: 'DELETE',
        url: API.AI_CHAT_HISTORY(channelId),
        headers: getAuthHeaders(),
      });
      await promise;
      setMessages([]);
    } catch (err) {
      console.error('Failed to clear AI chat history:', err);
    }
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  // Format AI response content with basic markdown-like rendering
  const formatContent = (text: string) => {
    // Bold
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code style="background:var(--bg-hover);padding:1px 4px;border-radius:3px;font-family:var(--font-mono);font-size:0.85em">$1</code>');
    // Line breaks
    formatted = formatted.replace(/\n/g, '<br/>');
    return formatted;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Mobile overlay */}
      <div className={styles.panelOverlay} onClick={onClose} />

      {/* Panel */}
      <div className={styles.panel} id="ai-chat-panel">
        {/* Header */}
        <div className={styles.panelHeader}>
          <div className={styles.panelHeaderLeft}>
            <div className={styles.panelIcon}>🤖</div>
            <div>
              <div className={styles.panelTitle}>AI Assistant</div>
              <div className={styles.panelSubtitle}>Ask about this conversation</div>
            </div>
          </div>
          <div className={styles.panelHeaderActions}>
            {messages.length > 0 && (
              <button
                className={`${styles.panelActionBtn} ${styles.panelActionBtnDanger}`}
                onClick={handleClearHistory}
                title="Clear history"
                id="ai-clear-history"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
            )}
            <button
              className={styles.panelActionBtn}
              onClick={onClose}
              title="Close"
              id="ai-panel-close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className={styles.panelMessages}>
          {isLoadingHistory ? (
            <div className={styles.loadingHistory}>
              <div className={styles.loadingSpinner} />
              <span>Loading history...</span>
            </div>
          ) : messages.length === 0 && !isThinking ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>💬</div>
              <div className={styles.emptyTitle}>Ask me anything</div>
              <div className={styles.emptyText}>
                I can answer questions about this conversation, find specific messages, summarize discussions, and provide shipment information.
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className={styles.messageBubble}>
                  <div className={`${styles.msgAvatar} ${msg.role === 'user' ? styles.msgAvatarUser : styles.msgAvatarAi}`}>
                    {msg.role === 'user'
                      ? getInitials(user?.display_name || user?.username || 'U')
                      : '🤖'}
                  </div>
                  <div className={styles.msgBody}>
                    <div className={`${styles.msgRole} ${msg.role === 'user' ? styles.msgRoleUser : styles.msgRoleAi}`}>
                      {msg.role === 'user' ? (user?.display_name || 'You') : 'AI Assistant'}
                    </div>
                    <div
                      className={`${styles.msgContent} ${msg.role === 'assistant' ? styles.msgContentAi : styles.msgContentUser} ${msg.isError ? styles.errorMsg : ''}`}
                      dangerouslySetInnerHTML={
                        msg.role === 'assistant'
                          ? { __html: formatContent(msg.content) }
                          : undefined
                      }
                    >
                      {msg.role === 'user' ? msg.content : undefined}
                    </div>
                    <div className={styles.msgTimestamp}>
                      {formatTime(msg.created_at)}
                      {msg.context_count !== undefined && msg.context_count > 0 && (
                        <span className={styles.contextBadge}>
                          📎 {msg.context_count} sources
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Thinking indicator */}
              {isThinking && (
                <div className={styles.thinking}>
                  <div className={`${styles.msgAvatar} ${styles.msgAvatarAi}`}>🤖</div>
                  <div className={styles.thinkingContent}>
                    <div className={styles.thinkingDots}>
                      <span /><span /><span />
                    </div>
                    <span className={styles.thinkingText}>Searching context & thinking...</span>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className={styles.panelInput}>
          <div className={styles.inputWrapper}>
            <input
              ref={inputRef}
              className={styles.inputField}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask about this conversation..."
              disabled={isThinking}
              id="ai-chat-input"
            />
            <button
              className={styles.sendBtn}
              onClick={handleSend}
              disabled={!inputValue.trim() || isThinking}
              id="ai-send-button"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
