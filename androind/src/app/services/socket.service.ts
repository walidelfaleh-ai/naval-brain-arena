import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { io, Socket } from 'socket.io-client';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket | null = null;
  private currentUrl = this.defaultUrl();

  connect(): Socket {
    if (!this.socket) {
      const isAndroid = Capacitor.getPlatform() === 'android';
      this.socket = io(this.currentUrl, {
        path: '/socket.io',
        transports: isAndroid ? ['polling'] : ['polling', 'websocket'],
        upgrade: !isAndroid,
        autoConnect: true,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 2,
        timeout: 10000
      });
    }

    return this.socket;
  }

  configureUrl(url: string): void {
    const normalized = url.trim().replace(/\/+$/, '');
    if (!normalized || normalized === this.currentUrl) {
      return;
    }

    this.currentUrl = normalized;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  get url(): string {
    return this.currentUrl;
  }

  get instance(): Socket {
    return this.connect();
  }

  private defaultUrl(): string {
    return Capacitor.getPlatform() === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
  }
}
