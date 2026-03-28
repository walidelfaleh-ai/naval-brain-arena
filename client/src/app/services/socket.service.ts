import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket | null = null;

  connect(): Socket {
    if (!this.socket) {
      this.socket = io('http://localhost:3000', { transports: ['websocket'] });
    }

    return this.socket;
  }

  get instance(): Socket {
    return this.connect();
  }
}
