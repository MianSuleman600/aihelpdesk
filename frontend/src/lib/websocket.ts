type WSEventCallback = (data: Record<string, unknown>) => void;

function getWsUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_WS_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
  const clean = apiUrl.replace(/\/+$/, "").replace(/\/api\/v[12]$/, "");
  return clean.replace(/^http/, "ws");
}

let sharedAudioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (sharedAudioCtx) {
    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume();
    }
    return sharedAudioCtx;
  }
  try {
    sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

function playNotificationSound(): void {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Audio not available
  }
}

class WebSocketClient {
  private ws: WebSocket | null = null;
  private token = "";
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000;
  private listeners: Map<string, Set<WSEventCallback>> = new Map();
  private isConnecting = false;
  private shouldReconnect = true;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private subscribedTickets: Set<string> = new Set();
  private pendingMessages: Array<Record<string, unknown>> = [];

  connect(token: string): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) return;
    this.token = token;
    this.shouldReconnect = true;
    this._connect();
  }

  private _connect(): void {
    if (this.isConnecting) return;
    this.isConnecting = true;

    const url = `${getWsUrl()}/ws?token=${this.token}`;

    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      console.error("[WS] Connection failed:", err);
      this.isConnecting = false;
      return;
    }

    this.ws.onopen = () => {
      if (process.env.NODE_ENV !== 'production') console.debug("[WS] Connected");
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      // Re-subscribe to all previously subscribed tickets
      this.subscribedTickets.forEach((tid) => {
        this._sendImmediate({ type: "subscribe_ticket", ticket_id: tid });
      });
      // Flush pending messages
      const pending = this.pendingMessages;
      this.pendingMessages = [];
      pending.forEach((msg) => this._sendImmediate(msg));
      this._startPing();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as Record<string, unknown>;
        const typeListeners = this.listeners.get(data.type as string);
        if (typeListeners) {
          typeListeners.forEach((cb) => cb(data));
        }
        const allListeners = this.listeners.get("*");
        if (allListeners) {
          allListeners.forEach((cb) => cb(data));
        }
      } catch {
        // ignore malformed
      }
    };

    this.ws.onclose = (event) => {
      if (process.env.NODE_ENV !== 'production') console.debug(`[WS] Disconnected (code=${event.code})`);
      this.isConnecting = false;
      this._stopPing();
      if (this.shouldReconnect) {
        this._scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      this.isConnecting = false;
      this.ws?.close();
    };
  }

  private _scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn("[WS] Max reconnect attempts reached");
      return;
    }
    const delay = Math.min(
      this.baseReconnectDelay * 2 ** this.reconnectAttempts,
      30000,
    );
    this.reconnectAttempts++;
    if (process.env.NODE_ENV !== 'production') console.debug(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => this._connect(), delay);
  }

  private _startPing(): void {
    this._stopPing();
    this.pingInterval = setInterval(() => {
      this.send({ type: "ping" });
    }, 30000);
  }

  private _stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private _sendImmediate(data: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this._stopPing();
    this.ws?.close();
    this.ws = null;
    this.subscribedTickets.clear();
  }

  send(data: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      // Buffer for when connection is established
      this.pendingMessages.push(data);
    }
  }

  subscribe(ticketId: string): void {
    this.subscribedTickets.add(ticketId);
    this.send({ type: "subscribe_ticket", ticket_id: ticketId });
  }

  unsubscribe(ticketId: string): void {
    this.subscribedTickets.delete(ticketId);
    this.send({ type: "unsubscribe_ticket", ticket_id: ticketId });
  }

  on(eventType: string, callback: WSEventCallback): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);
    return () => this.listeners.get(eventType)?.delete(callback);
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

let wsClientInstance: WebSocketClient | null = null;

export function getWsClient(): WebSocketClient {
  if (!wsClientInstance) {
    wsClientInstance = new WebSocketClient();
  }
  return wsClientInstance;
}

export { playNotificationSound };
