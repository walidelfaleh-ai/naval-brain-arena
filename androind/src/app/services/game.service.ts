import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { BehaviorSubject } from 'rxjs';
import { AttackWindup, EmoteMessage, GameState } from '../models/game-state.model';
import { SocketService } from './socket.service';

interface MatchAvatarPayload {
  avatarId: string | null;
  uploadedAvatarDataUrl: string | null;
}

@Injectable({ providedIn: 'root' })
export class GameService {
  private readonly initialState: GameState = {
    gameId: null,
    phase: 'home',
    matchMode: null,
    matchCode: null,
    selfTeam: null,
    activeTeam: null,
    resolvingAttack: false,
    isMyTurn: false,
    vsBot: false,
    winner: null,
    username: '',
    opponentName: null,
    selfAvatar: null,
    opponentAvatar: null,
    connectionLabel: 'Ready',
    statusMessage: 'Choisis ton pseudo puis lance la partie.',
    ownBoard: null,
    enemyBoard: null,
    log: [],
    rowLabels: [],
    colLabels: [],
    fleetSummary: [],
    enemyFleetSummary: [],
    emotes: [],
    incomingEmoteBurst: null,
    incomingAttackWindup: null,
    lastSelfAttack: null,
    turnSecondsLeft: 10,
    selfSkips: 0,
    enemySkips: 0
  };

  private readonly stateSubject = new BehaviorSubject<GameState>(this.initialState);
  readonly state$ = this.stateSubject.asObservable();
  private listenersBound = false;

  constructor(private readonly socketService: SocketService) {}

  configureServerUrl(url: string): void {
    this.socketService.configureUrl(url);
    this.listenersBound = false;
  }

  currentServerUrl(): string {
    return this.socketService.url;
  }

  connect(): void {
    const socket = this.socketService.connect();
    if (this.listenersBound) {
      return;
    }

    this.listenersBound = true;

    socket.on('connect', () => {
      this.patchState({
        connectionLabel: 'Connecte',
        statusMessage: this.stateSubject.value.phase === 'home'
          ? 'Choisis ton pseudo puis lance la partie.'
          : this.stateSubject.value.statusMessage
      });
    });

    socket.on('disconnect', () => {
      this.patchState({
        connectionLabel: 'Hors ligne',
        statusMessage: 'Connexion perdue avec le serveur.'
      });
    });

    socket.on('connect_error', (error: Error & { description?: unknown; message?: string; type?: string }) => {
      const detail = [
        error?.message,
        typeof error?.description === 'string' ? error.description : null,
        error?.type
      ].filter(Boolean).join(' | ');

      this.patchState({
        connectionLabel: 'Erreur reseau',
        statusMessage: detail
          ? `Socket error: ${detail}`
          : 'Socket error: impossible de joindre le serveur.'
      });
    });

    socket.on('gameState', (state: GameState) => {
      this.stateSubject.next({
        ...this.stateSubject.value,
        ...state,
        incomingEmoteBurst: this.stateSubject.value.incomingEmoteBurst,
        incomingAttackWindup: this.stateSubject.value.incomingAttackWindup
      });
    });

    socket.on('emoteBurst', (emote: EmoteMessage) => {
      const current = this.stateSubject.value;
      this.patchState({
        emotes: current.emotes.some((item) => item.id === emote.id)
          ? current.emotes
          : [...current.emotes, emote].slice(-8),
        incomingEmoteBurst: emote
      });
    });

    socket.on('attackWindup', (windup: AttackWindup) => {
      this.patchState({
        incomingAttackWindup: windup
      });
    });

    socket.on('serverMessage', (message: string) => {
      this.patchState({ statusMessage: message });
    });
  }

  async startMatch(username: string, avatar: MatchAvatarPayload): Promise<void> {
    const reachable = await this.ensureServerReachable();
    if (!reachable) {
      return;
    }

    this.patchState({
      username,
      phase: 'matching',
      matchMode: 'random',
      matchCode: null,
      connectionLabel: 'Recherche',
      statusMessage: 'Recherche d un joueur...'
    });
    this.socketService.instance.emit('joinQueue', {
      username,
      avatarId: avatar.avatarId,
      uploadedAvatarDataUrl: avatar.uploadedAvatarDataUrl
    });
  }

  async createPrivateMatch(username: string, avatar: MatchAvatarPayload): Promise<void> {
    const reachable = await this.ensureServerReachable();
    if (!reachable) {
      return;
    }

    this.patchState({
      username,
      phase: 'matching',
      matchMode: 'private',
      matchCode: null,
      connectionLabel: 'Salle privee',
      statusMessage: 'Generation du code ami...'
    });
    this.socketService.instance.emit('createPrivateMatch', {
      username,
      avatarId: avatar.avatarId,
      uploadedAvatarDataUrl: avatar.uploadedAvatarDataUrl
    });
  }

  async joinPrivateMatch(username: string, code: string, avatar: MatchAvatarPayload): Promise<void> {
    const reachable = await this.ensureServerReachable();
    if (!reachable) {
      return;
    }

    this.patchState({
      username,
      phase: 'matching',
      matchMode: 'private',
      matchCode: code,
      connectionLabel: 'Salle privee',
      statusMessage: 'Connexion a la salle ami...'
    });
    this.socketService.instance.emit('joinPrivateMatch', {
      username,
      code,
      avatarId: avatar.avatarId,
      uploadedAvatarDataUrl: avatar.uploadedAvatarDataUrl
    });
  }

  attack(row: number, col: number): void {
    this.socketService.instance.emit('attack', { row, col });
  }

  sendEmote(emote: string): void {
    this.socketService.instance.emit('sendEmote', { emote });
  }

  leaveGame(): void {
    this.socketService.instance.emit('leaveGame');
    this.stateSubject.next({
      ...this.initialState,
      connectionLabel: 'Ready',
      statusMessage: 'Choisis ton pseudo puis lance la partie.'
    });
  }

  playAgain(): void {
    const username = this.stateSubject.value.username;
    const avatar = this.stateSubject.value.selfAvatar;
    if (!username || !avatar) {
      return;
    }

    this.startMatch(username, {
      avatarId: avatar.source === 'upload' ? null : avatar.id,
      uploadedAvatarDataUrl: avatar.source === 'upload' ? avatar.imageDataUrl || null : null
    });
  }

  private patchState(partial: Partial<GameState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }

  private async ensureServerReachable(): Promise<boolean> {
    const url = `${this.socketService.url}/health`;

    try {
      const response = Capacitor.getPlatform() === 'web'
        ? await fetch(url, { method: 'GET' })
        : await CapacitorHttp.get({
            url,
            connectTimeout: 4500,
            readTimeout: 4500
          });

      const ok = 'ok' in response ? response.ok : (response.status >= 200 && response.status < 300);
      if (!ok) {
        throw new Error('bad response');
      }

      return true;
    } catch (error) {
      const detail = error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);

      this.stateSubject.next({
        ...this.initialState,
        connectionLabel: 'Erreur reseau',
        statusMessage: `Health check error: ${detail}`
      });
      return false;
    }
  }
}
