import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { CellModel } from '../models/cell.model';
import { GameState, PlayerAvatar, TeamColor } from '../models/game-state.model';
import { GameService } from '../services/game.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, OnDestroy {
  readonly avatarOptions: PlayerAvatar[] = [
    { id: 'captain-ray', icon: '\u{1F9D1}\u200D\u2708\uFE0F', tint: '#38bdf8', source: 'preset' },
    { id: 'iron-beard', icon: '\u{1F9D4}', tint: '#f59e0b', source: 'preset' },
    { id: 'storm-lady', icon: '\u{1F469}\u200D\u2708\uFE0F', tint: '#f472b6', source: 'preset' },
    { id: 'shark-eye', icon: '\u{1F63C}', tint: '#60a5fa', source: 'preset' },
    { id: 'bolt-face', icon: '\u{1F916}', tint: '#a78bfa', source: 'preset' },
    { id: 'wave-fox', icon: '\u{1F98A}', tint: '#fb7185', source: 'preset' },
    { id: 'sea-panda', icon: '\u{1F43C}', tint: '#34d399', source: 'preset' },
    { id: 'ember-owl', icon: '\u{1F989}', tint: '#f97316', source: 'preset' }
  ];
  readonly emoteOptions = [
    { key: 'sword', icon: '⚔️' },
    { key: 'bomb', icon: '💣' },
    { key: 'laugh', icon: '😆' },
    { key: 'cry', icon: '😢' },
    { key: 'fire', icon: '🔥' },
    { key: 'cool', icon: '😎' }
  ];

  state: GameState | null = null;
  username = '';
  selectedAvatarId = this.avatarOptions[0].id;
  uploadedAvatarDataUrl: string | null = null;
  friendCode = '';
  lobbyStep: 'home' | 'avatar' | 'join' = 'home';
  liveSecondsLeft = 10;
  selfActiveEmote: string | null = null;
  enemyActiveEmote: string | null = null;
  sunkAnnouncement: { message: string; tone: 'enemy' | 'own' } | null = null;
  latestEnemyMiss: { row: number; col: number } | null = null;
  latestOwnMiss: { row: number; col: number } | null = null;
  pendingShot: { row: number; col: number; team: TeamColor } | null = null;

  private readonly subscription = new Subscription();
  private lastIncomingBurstId: string | null = null;
  private lastAttackWindupId: string | null = null;
  private lastGameId: string | null = null;
  private seenEmoteIds = new Set<string>();
  private timerId: ReturnType<typeof setInterval> | null = null;
  private selfEmoteTimer: ReturnType<typeof setTimeout> | null = null;
  private enemyEmoteTimer: ReturnType<typeof setTimeout> | null = null;
  private selfEmoteRenderTimer: ReturnType<typeof setTimeout> | null = null;
  private enemyEmoteRenderTimer: ReturnType<typeof setTimeout> | null = null;
  private sunkAnnouncementTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly gameService: GameService) {}

  ngOnInit(): void {
    this.restoreIdentity();
    this.gameService.connect();

    this.subscription.add(
      this.gameService.state$.subscribe((state) => {
        const previous = this.state;
        this.state = state;

        if (state.gameId !== this.lastGameId) {
          this.lastGameId = state.gameId;
          this.seenEmoteIds.clear();
          this.lastIncomingBurstId = null;
          this.lastAttackWindupId = null;
          this.selfActiveEmote = null;
          this.enemyActiveEmote = null;
          this.sunkAnnouncement = null;
          this.pendingShot = null;
        }

        this.captureLatestTransientMarks(previous, state);
        this.captureSunkAnnouncement(previous, state);
        this.captureIncomingBurst(state);
        this.captureAttackWindup(state);
        this.captureEnemyEmotesFromState(state);
        this.resolvePendingShot(state);

        this.liveSecondsLeft = state.turnSecondsLeft;
        this.restartCountdown();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.clearCountdown();
    this.clearEmoteTimers();
    this.clearSunkAnnouncementTimer();
  }

  selectAvatar(avatarId: string): void {
    this.selectedAvatarId = avatarId;
    this.uploadedAvatarDataUrl = null;
    this.persistIdentity();
  }

  async onAvatarFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    try {
      this.uploadedAvatarDataUrl = await this.resizeAvatar(file);
      this.selectedAvatarId = '';
      this.persistIdentity();
    } finally {
      input.value = '';
    }
  }

  clearUploadedAvatar(): void {
    this.uploadedAvatarDataUrl = null;
    this.selectedAvatarId = this.avatarOptions[0].id;
    this.persistIdentity();
  }

  openAvatarPicker(): void {
    this.lobbyStep = 'avatar';
  }

  backToLobbyHome(): void {
    this.lobbyStep = 'home';
  }

  async playRandom(): Promise<void> {
    const name = this.prepareIdentityForMatch();
    if (!name) {
      return;
    }

    await this.gameService.startMatch(name, this.currentAvatarPayload());
  }

  async createFriendMatch(): Promise<void> {
    const name = this.prepareIdentityForMatch();
    if (!name) {
      return;
    }

    await this.gameService.createPrivateMatch(name, this.currentAvatarPayload());
  }

  async joinFriendMatch(): Promise<void> {
    const name = this.prepareIdentityForMatch();
    const code = this.friendCode.trim().toUpperCase();
    if (!name || code.length !== 6) {
      return;
    }

    await this.gameService.joinPrivateMatch(name, code, this.currentAvatarPayload());
  }

  quitGame(): void {
    this.gameService.leaveGame();
    this.lobbyStep = 'home';
  }

  replay(): void {
    this.gameService.playAgain();
  }

  currentAvatarPreview(): PlayerAvatar {
    if (this.uploadedAvatarDataUrl) {
      return {
        id: 'upload-preview',
        tint: '#94a3b8',
        source: 'upload',
        imageDataUrl: this.uploadedAvatarDataUrl
      };
    }

    return this.avatarOptions.find((avatar) => avatar.id === this.selectedAvatarId) ?? this.avatarOptions[0];
  }

  homeErrorMessage(): string | null {
    if (!this.state?.statusMessage) {
      return null;
    }

    const label = (this.state.connectionLabel || '').toLowerCase();
    return label.includes('erreur') || label.includes('hors ligne') ? this.state.statusMessage : null;
  }

  fireAt(row: number, col: number): void {
    if (this.canTarget(row, col)) {
      this.pendingShot = {
        row,
        col,
        team: this.state?.selfTeam || 'BLUE'
      };
      this.gameService.attack(row, col);
    }
  }

  sendEmote(emoteKey: string): void {
    if (this.state?.phase === 'battle' || this.state?.phase === 'gameover') {
      this.showSelfEmote(emoteKey);
      this.gameService.sendEmote(emoteKey);
    }
  }

  canTarget(row: number, col: number): boolean {
    const enemy = this.enemyCell(row, col);
    return Boolean(
      this.state?.phase === 'battle' &&
      this.state?.isMyTurn &&
      !this.state?.resolvingAttack &&
      enemy &&
      !(this.state.lastSelfAttack?.row === row && this.state.lastSelfAttack?.col === col)
    );
  }

  ownCell(row: number, col: number): CellModel | null {
    return this.state?.ownBoard?.rows[row]?.[col] ?? null;
  }

  enemyCell(row: number, col: number): CellModel | null {
    return this.state?.enemyBoard?.rows[row]?.[col] ?? null;
  }

  cellClasses(row: number, col: number): string[] {
    const own = this.ownCell(row, col);
    const enemy = this.enemyCell(row, col);
    const classes = ['battle-cell'];

    if (this.state?.isMyTurn && !this.state?.resolvingAttack) {
      classes.push('battle-cell-aimable');
    }

    if (this.pendingShot?.row === row && this.pendingShot?.col === col) {
      classes.push('battle-cell-pending-shot');
      classes.push(this.pendingShot.team === 'RED' ? 'battle-cell-pending-shot-red' : 'battle-cell-pending-shot-blue');
    }

    if (own?.hasShip) {
      classes.push('battle-cell-own-ship');
      classes.push(this.selfTeamClass() === 'team-red' ? 'battle-cell-own-ship-red' : 'battle-cell-own-ship-blue');
    }

    if (own?.shipSegmentHit) {
      classes.push('battle-cell-own-hit');
    }

    if (enemy?.result === 'hit') {
      classes.push('battle-cell-hit');
      classes.push(this.enemyTeamClass() === 'team-red' ? 'battle-cell-hit-red' : 'battle-cell-hit-blue');
    } else if (enemy?.result === 'miss' && this.shouldShowEnemyMiss(row, col)) {
      classes.push('battle-cell-miss');
    }

    return classes;
  }

  enemyMarker(row: number, col: number): string {
    const enemy = this.enemyCell(row, col);
    if (enemy?.result === 'hit') {
      return '✓';
    }
    if (enemy?.result === 'miss' && this.shouldShowEnemyMiss(row, col)) {
      return 'X';
    }
    return '';
  }

  incomingMarker(row: number, col: number): string {
    const own = this.ownCell(row, col);
    if (!own?.attacked) {
      return '';
    }
    if (own.shipSegmentHit) {
      return '✓';
    }
    return this.shouldShowOwnMiss(row, col) ? 'X' : '';
  }

  enemyMarkerClass(row: number, col: number): string[] {
    const enemy = this.enemyCell(row, col);
    if (enemy?.result === 'hit') {
      return ['enemy-marker', 'enemy-marker-hit'];
    }
    if (enemy?.result === 'miss' && this.shouldShowEnemyMiss(row, col)) {
      return ['enemy-marker', 'enemy-marker-miss'];
    }
    return ['enemy-marker'];
  }

  incomingMarkerClass(row: number, col: number): string[] {
    const own = this.ownCell(row, col);
    if (!own?.attacked) {
      return ['incoming-marker'];
    }
    if (own.shipSegmentHit) {
      return ['incoming-marker', 'incoming-marker-hit'];
    }
    if (this.shouldShowOwnMiss(row, col)) {
      return ['incoming-marker', 'incoming-marker-miss'];
    }
    return ['incoming-marker'];
  }

  selfTeamClass(): string {
    return this.state?.selfTeam === 'RED' ? 'team-red' : 'team-blue';
  }

  enemyTeamClass(): string {
    return this.enemyTeam() === 'RED' ? 'team-red' : 'team-blue';
  }

  enemyTeam(): TeamColor {
    return this.state?.selfTeam === 'RED' ? 'BLUE' : 'RED';
  }

  activePlayerName(): string {
    if (!this.state?.activeTeam) {
      return '';
    }
    return this.state.activeTeam === this.state.selfTeam
      ? this.state.username
      : (this.state.opponentName || 'Adversaire');
  }

  selfKoCount(): number {
    return (this.state?.fleetSummary ?? []).filter((ship) => ship.sunk).length;
  }

  enemyKoCount(): number {
    return (this.state?.enemyFleetSummary ?? []).filter((ship) => ship.sunk).length;
  }

  gameOverTitle(): string {
    return this.state?.winner === this.state?.selfTeam ? 'Vous avez gagne' : 'Vous avez perdu';
  }

  emoteIcon(emoteKey: string | null): string {
    return this.emoteOptions.find((item) => item.key === emoteKey)?.icon || '';
  }

  trackByIndex(index: number): number {
    return index;
  }

  private prepareIdentityForMatch(): string | null {
    const trimmed = this.username.trim();
    if (!trimmed) {
      return null;
    }

    this.persistIdentity();
    this.gameService.connect();
    return trimmed;
  }

  private currentAvatarPayload(): { avatarId: string | null; uploadedAvatarDataUrl: string | null } {
    return {
      avatarId: this.uploadedAvatarDataUrl ? null : this.selectedAvatarId,
      uploadedAvatarDataUrl: this.uploadedAvatarDataUrl
    };
  }

  private persistIdentity(): void {
    localStorage.setItem('naval-mobile.identity', JSON.stringify({
      username: this.username.trim(),
      avatarId: this.selectedAvatarId,
      uploadedAvatarDataUrl: this.uploadedAvatarDataUrl
    }));
  }

  private restoreIdentity(): void {
    const stored = localStorage.getItem('naval-mobile.identity');
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as {
        username?: string;
        avatarId?: string | null;
        uploadedAvatarDataUrl?: string | null;
      };

      this.username = parsed.username || '';
      if (parsed.uploadedAvatarDataUrl) {
        this.uploadedAvatarDataUrl = parsed.uploadedAvatarDataUrl;
        this.selectedAvatarId = '';
      } else if (parsed.avatarId && this.avatarOptions.some((avatar) => avatar.id === parsed.avatarId)) {
        this.selectedAvatarId = parsed.avatarId;
      }
    } catch {
      localStorage.removeItem('naval-mobile.identity');
    }
  }

  private resizeAvatar(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read error'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('image error'));
        image.onload = () => {
          const size = 180;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const context = canvas.getContext('2d');
          if (!context) {
            reject(new Error('canvas error'));
            return;
          }

          const scale = Math.max(size / image.width, size / image.height);
          const drawWidth = image.width * scale;
          const drawHeight = image.height * scale;
          const offsetX = (size - drawWidth) / 2;
          const offsetY = (size - drawHeight) / 2;

          context.fillStyle = '#07111f';
          context.fillRect(0, 0, size, size);
          context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  private captureLatestTransientMarks(previous: GameState | null, current: GameState): void {
    const latestEnemyAttack = this.findLatestAttack(previous?.enemyBoard?.rows ?? null, current.enemyBoard?.rows ?? null);
    if (latestEnemyAttack) {
      this.latestEnemyMiss = latestEnemyAttack.result === 'miss'
        ? { row: latestEnemyAttack.row, col: latestEnemyAttack.col }
        : null;
    }

    const latestOwnAttack = this.findLatestAttack(previous?.ownBoard?.rows ?? null, current.ownBoard?.rows ?? null);
    if (latestOwnAttack) {
      this.latestOwnMiss = latestOwnAttack.result === 'miss'
        ? { row: latestOwnAttack.row, col: latestOwnAttack.col }
        : null;
    }
  }

  private findLatestAttack(previousRows: CellModel[][] | null, currentRows: CellModel[][] | null): CellModel | null {
    if (!currentRows) {
      return null;
    }

    for (let row = 0; row < currentRows.length; row += 1) {
      for (let col = 0; col < currentRows[row].length; col += 1) {
        const currentCell = currentRows[row][col];
        const previousCell = previousRows?.[row]?.[col];
        if (currentCell.attacked && !previousCell?.attacked) {
          return currentCell;
        }
      }
    }

    return null;
  }

  private shouldShowEnemyMiss(row: number, col: number): boolean {
    return this.latestEnemyMiss?.row === row && this.latestEnemyMiss?.col === col;
  }

  private shouldShowOwnMiss(row: number, col: number): boolean {
    return this.latestOwnMiss?.row === row && this.latestOwnMiss?.col === col;
  }

  private resolvePendingShot(state: GameState): void {
    if (!this.pendingShot) {
      return;
    }

    const enemyCell = state.enemyBoard?.rows?.[this.pendingShot.row]?.[this.pendingShot.col];
    if (!enemyCell || enemyCell.result === 'hit' || enemyCell.result === 'miss' || state.phase !== 'battle') {
      this.pendingShot = null;
    }
  }

  private captureIncomingBurst(current: GameState): void {
    const burst = current.incomingEmoteBurst;
    if (!burst || burst.id === this.lastIncomingBurstId) {
      return;
    }

    this.lastIncomingBurstId = burst.id;
    if (burst.team === current.selfTeam) {
      this.showSelfEmote(burst.emote);
    } else {
      this.showEnemyEmote(burst.emote);
    }
  }

  private captureAttackWindup(current: GameState): void {
    const windup = current.incomingAttackWindup;
    if (!windup || windup.id === this.lastAttackWindupId) {
      return;
    }

    this.lastAttackWindupId = windup.id;
    this.pendingShot = {
      row: windup.row,
      col: windup.col,
      team: windup.team
    };
  }

  private captureEnemyEmotesFromState(current: GameState): void {
    for (const emote of current.emotes ?? []) {
      if (this.seenEmoteIds.has(emote.id)) {
        continue;
      }

      this.seenEmoteIds.add(emote.id);
      if (emote.team !== current.selfTeam) {
        this.showEnemyEmote(emote.emote);
      }
    }
  }

  private showSelfEmote(emote: string): void {
    if (this.selfEmoteTimer) {
      clearTimeout(this.selfEmoteTimer);
    }
    if (this.selfEmoteRenderTimer) {
      clearTimeout(this.selfEmoteRenderTimer);
    }

    this.selfActiveEmote = null;
    this.selfEmoteRenderTimer = setTimeout(() => {
      this.selfActiveEmote = emote;
      this.selfEmoteRenderTimer = null;
      this.selfEmoteTimer = setTimeout(() => {
        this.selfActiveEmote = null;
        this.selfEmoteTimer = null;
      }, 2600);
    }, 20);
  }

  private showEnemyEmote(emote: string): void {
    if (this.enemyEmoteTimer) {
      clearTimeout(this.enemyEmoteTimer);
    }
    if (this.enemyEmoteRenderTimer) {
      clearTimeout(this.enemyEmoteRenderTimer);
    }

    this.enemyActiveEmote = null;
    this.enemyEmoteRenderTimer = setTimeout(() => {
      this.enemyActiveEmote = emote;
      this.enemyEmoteRenderTimer = null;
      this.enemyEmoteTimer = setTimeout(() => {
        this.enemyActiveEmote = null;
        this.enemyEmoteTimer = null;
      }, 2600);
    }, 20);
  }

  private captureSunkAnnouncement(previous: GameState | null, current: GameState): void {
    const previousEnemyKo = (previous?.enemyFleetSummary ?? []).filter((ship) => ship.sunk).length;
    const currentEnemyKo = (current.enemyFleetSummary ?? []).filter((ship) => ship.sunk).length;
    if (currentEnemyKo > previousEnemyKo) {
      this.showSunkAnnouncement(`Bateau ${currentEnemyKo} coule`, 'enemy');
      return;
    }

    const previousOwnKo = (previous?.fleetSummary ?? []).filter((ship) => ship.sunk).length;
    const currentOwnKo = (current.fleetSummary ?? []).filter((ship) => ship.sunk).length;
    if (currentOwnKo > previousOwnKo) {
      this.showSunkAnnouncement(`Bateau ${currentOwnKo} coule`, 'own');
    }
  }

  private showSunkAnnouncement(message: string, tone: 'enemy' | 'own'): void {
    this.clearSunkAnnouncementTimer();
    this.sunkAnnouncement = { message, tone };
    this.sunkAnnouncementTimer = setTimeout(() => {
      this.sunkAnnouncement = null;
      this.sunkAnnouncementTimer = null;
    }, 2200);
  }

  private restartCountdown(): void {
    this.clearCountdown();
    if (!this.state || this.state.phase !== 'battle' || this.state.resolvingAttack) {
      return;
    }

    this.timerId = setInterval(() => {
      if (this.liveSecondsLeft > 0) {
        this.liveSecondsLeft -= 1;
      }
    }, 1000);
  }

  private clearCountdown(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private clearEmoteTimers(): void {
    if (this.selfEmoteTimer) {
      clearTimeout(this.selfEmoteTimer);
    }
    if (this.enemyEmoteTimer) {
      clearTimeout(this.enemyEmoteTimer);
    }
    if (this.selfEmoteRenderTimer) {
      clearTimeout(this.selfEmoteRenderTimer);
    }
    if (this.enemyEmoteRenderTimer) {
      clearTimeout(this.enemyEmoteRenderTimer);
    }
  }

  private clearSunkAnnouncementTimer(): void {
    if (this.sunkAnnouncementTimer) {
      clearTimeout(this.sunkAnnouncementTimer);
      this.sunkAnnouncementTimer = null;
    }
  }
}
