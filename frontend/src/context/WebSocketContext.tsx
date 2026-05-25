"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { getWsClient, playNotificationSound } from "@/lib/websocket";
import { tokenUtils } from "@/lib/api";

interface WebSocketContextValue {
  subscribe: (ticketId: string) => void;
  unsubscribe: (ticketId: string) => void;
  on: (
    eventType: string,
    callback: (data: Record<string, unknown>) => void,
  ) => () => void;
  connected: boolean;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const connected = useRef(false);
  const [connectedState, setConnectedState] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (user && !connected.current) {
      const token = tokenUtils.get();
      if (token) {
        connected.current = true;
        const client = getWsClient();
        client.connect(token);

        const interval = setInterval(() => {
          setConnectedState(client.connected);
        }, 5000);
        setConnectedState(client.connected);

        return () => clearInterval(interval);
      }
    }

    if (!user) {
      getWsClient().disconnect();
      connected.current = false;
      setConnectedState(false);
    }
  }, [user, loading]);

  const subscribe = useCallback((ticketId: string) => {
    getWsClient().subscribe(ticketId);
  }, []);

  const unsubscribe = useCallback((ticketId: string) => {
    getWsClient().unsubscribe(ticketId);
  }, []);

  const on = useCallback(
    (eventType: string, callback: (data: Record<string, unknown>) => void) => {
      return getWsClient().on(eventType, callback);
    },
    [],
  );

  return (
    <WebSocketContext.Provider
      value={{ subscribe, unsubscribe, on, connected: connectedState }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket(): WebSocketContextValue {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error("useWebSocket must be used within WebSocketProvider");
  }
  return ctx;
}
