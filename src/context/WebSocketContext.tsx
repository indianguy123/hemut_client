'use client';

import React, { createContext, useContext, useEffect, useRef, useCallback, ReactNode } from 'react';
import { createWSClient, WSClient, MessageHandler } from '@/lib/websocket';
import { WS } from '@/lib/constants';
import { useAuth } from './AuthContext';

interface WebSocketContextType {
  send: (data: Record<string, unknown>) => void;
  on: (type: string, handler: MessageHandler) => void;
  off: (type: string, handler: MessageHandler) => void;
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({
  send: () => {},
  on: () => {},
  off: () => {},
  isConnected: false,
});

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const clientRef = useRef<WSClient | null>(null);
  const [isConnected, setIsConnected] = React.useState(false);

  useEffect(() => {
    if (!token) {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const client = createWSClient(WS.URL(token));

    client.on('connected', () => setIsConnected(true));
    client.on('disconnected', () => setIsConnected(false));

    client.connect();
    clientRef.current = client;

    return () => {
      client.disconnect();
      clientRef.current = null;
      setIsConnected(false);
    };
  }, [token]);

  const send = useCallback((data: Record<string, unknown>) => {
    clientRef.current?.send(data);
  }, []);

  const on = useCallback((type: string, handler: MessageHandler) => {
    clientRef.current?.on(type, handler);
  }, []);

  const off = useCallback((type: string, handler: MessageHandler) => {
    clientRef.current?.off(type, handler);
  }, []);

  return (
    <WebSocketContext.Provider value={{ send, on, off, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  return useContext(WebSocketContext);
}
