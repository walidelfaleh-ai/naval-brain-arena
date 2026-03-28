import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { EmoteMessage, GameState } from '../models/game-state.model';
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
    connectionLabel: 'Connecting...',
    statusMessage: 'Connecting to server...',
    ownBoard: null,
    enemyBoard: null,
    log: [],
    rowLabels: [],
    colLabels: [],
    fleetSummary: [],
    enemyFleetSummary: [],
    emotes: [],
    incomingEmoteBurst: null,
    lastSelfAttack: null,
    turnSecondsLeft: 10,
    selfSkips: 0,
    enemySkips: 0
  };

  private readonly stateSubject = new BehaviorSubject<GameState>(this.initialState);
  readonly state$ = this.stateSubject.asObservable();

  constructor(private readonly socketService: SocketService) {}

  connect(): void {
    const socket = this.socketService.connect();

    socket.on('connect', () => {
      this.patchState({ connectionLabel: 'Connected', statusMessage: 'Choose a username and click Start.' });
    });

    socket.on('disconnect', () => {
      this.patchState({ connectionLabel: 'Disconnected', statusMessage: 'Connection lost.' });
    });

    socket.on('gameState', (state: GameState) => {
      this.stateSubject.next({
        ...this.stateSubject.value,
        ...state,
        incomingEmoteBurst: this.stateSubject.value.incomingEmoteBurst
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

    socket.on('serverMessage', (message: string) => {
      this.patchState({ statusMessage: message });
    });
  }

  startMatch(username: string, avatar: MatchAvatarPayload): void {
    this.patchState({
      username,
      phase: 'matching',
      matchMode: 'random',
      matchCode: null,
      connectionLabel: 'Searching...',
      statusMessage: 'Searching for a player...'
    });
    this.socketService.instance.emit('joinQueue', {
      username,
      avatarId: avatar.avatarId,
      uploadedAvatarDataUrl: avatar.uploadedAvatarDataUrl
    });
  }

  createPrivateMatch(username: string, avatar: MatchAvatarPayload): void {
    this.patchState({
      username,
      phase: 'matching',
      matchMode: 'private',
      connectionLabel: 'Private room',
      statusMessage: 'Generating a private code...'
    });
    this.socketService.instance.emit('createPrivateMatch', {
      username,
      avatarId: avatar.avatarId,
      uploadedAvatarDataUrl: avatar.uploadedAvatarDataUrl
    });
  }

  joinPrivateMatch(username: string, code: string, avatar: MatchAvatarPayload): void {
    this.patchState({
      username,
      phase: 'matching',
      matchMode: 'private',
      matchCode: code,
      connectionLabel: 'Joining room',
      statusMessage: 'Joining friend match...'
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
      statusMessage: 'Choose a username and click Start.'
    });
  }

  playAgain(): void {
    const username = this.stateSubject.value.username;
    const avatar = this.stateSubject.value.selfAvatar;
    if (username && avatar) {
      this.startMatch(username, {
        avatarId: avatar.source === 'upload' ? null : avatar.id,
        uploadedAvatarDataUrl: avatar.source === 'upload' ? avatar.imageDataUrl || null : null
      });
    }
  }

  private patchState(partial: Partial<GameState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }
}
