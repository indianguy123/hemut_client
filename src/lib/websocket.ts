/**
 * Native WebSocket client with auto-reconnect, heartbeat, and message routing.
 */

export type MessageHandler = (data: Record<string, unknown>) => void;

export interface WSClient {
  connect: () => void;
  disconnect: () => void;
  send: (data: Record<string, unknown>) => void;
  on: (type: string, handler: MessageHandler) => void;
  off: (type: string, handler: MessageHandler) => void;
  isConnected: () => boolean;
}

export function createWSClient(url: string): WSClient {
  let ws: WebSocket | null = null;
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let intentionalClose = false;

  const MAX_RECONNECT_ATTEMPTS = 10;
  const HEARTBEAT_INTERVAL = 30000; // 30 seconds

  // Event handlers registry
  const handlers: Map<string, Set<MessageHandler>> = new Map();

  function getBackoffDelay(): number {
    return Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, HEARTBEAT_INTERVAL);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function emit(type: string, data: Record<string, unknown>) {
    const typeHandlers = handlers.get(type);
    if (typeHandlers) {
      typeHandlers.forEach(handler => handler(data));
    }
    // Also emit to wildcard handlers
    const wildcardHandlers = handlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => handler({ ...data, _type: type }));
    }
  }

  function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    intentionalClose = false;

    try {
      ws = new WebSocket(url);
    } catch (err) {
      console.error('WebSocket connection failed:', err);
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      console.log('WebSocket connected');
      reconnectAttempts = 0;
      startHeartbeat();
      emit('connected', {});
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const type = data.type as string;

        if (type === 'pong') {
          // Heartbeat response, ignore
          return;
        }

        emit(type, data);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = (event) => {
      console.log(`WebSocket closed: code=${event.code} reason=${event.reason}`);
      stopHeartbeat();
      emit('disconnected', { code: event.code, reason: event.reason });

      if (!intentionalClose) {
        scheduleReconnect();
      }
    };

    ws.onerror = (event) => {
      console.error('WebSocket error:', event);
      emit('error', {});
    };
  }

  function scheduleReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnect attempts reached');
      emit('max_reconnect', {});
      return;
    }

    const delay = getBackoffDelay();
    console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1})`);
    reconnectAttempts++;

    reconnectTimer = setTimeout(() => {
      connect();
    }, delay);
  }

  function disconnect() {
    intentionalClose = true;
    stopHeartbeat();

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (ws) {
      ws.close(1000, 'Client disconnect');
      ws = null;
    }
  }

  function send(data: Record<string, unknown>) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket not connected, message dropped');
    }
  }

  function on(type: string, handler: MessageHandler) {
    if (!handlers.has(type)) {
      handlers.set(type, new Set());
    }
    handlers.get(type)!.add(handler);
  }

  function off(type: string, handler: MessageHandler) {
    const typeHandlers = handlers.get(type);
    if (typeHandlers) {
      typeHandlers.delete(handler);
    }
  }

  function isConnected(): boolean {
    return ws !== null && ws.readyState === WebSocket.OPEN;
  }

  return { connect, disconnect, send, on, off, isConnected };
}
