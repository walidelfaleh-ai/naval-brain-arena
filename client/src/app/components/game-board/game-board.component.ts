import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { CellModel } from '../../models/cell.model';
import { GameState } from '../../models/game-state.model';

@Component({
  selector: 'app-game-board',
  templateUrl: './game-board.component.html',
  standalone: false
})
export class GameBoardComponent implements OnChanges, OnDestroy {
  @Input() state: GameState | null = null;

  @Output() attackCoordinate = new EventEmitter<{ row: number; col: number }>();
  @Output() playAgain = new EventEmitter<void>();
  @Output() emoteSelected = new EventEmitter<string>();
  @Output() quitGame = new EventEmitter<void>();

  showOwnFleet = true;
  enemyExpanded = true;
  liveSecondsLeft = 10;
  latestEnemyMiss: { row: number; col: number } | null = null;
  latestOwnMiss: { row: number; col: number } | null = null;
  sunkAnnouncement: { message: string; tone: 'enemy' | 'own' } | null = null;
  readonly emoteOptions = [
    { key: 'sword', icon: '⚔️' },
    { key: 'bomb', icon: '💣' },
    { key: 'laugh', icon: '😆' },
    { key: 'cry', icon: '😢' },
    { key: 'fire', icon: '🔥' },
    { key: 'cool', icon: '😎' }
  ];
  selfActiveEmote: string | null = null;
  enemyActiveEmote: string | null = null;
  private seenEmoteIds = new Set<string>();
  private lastGameId: string | null = null;
  private lastIncomingBurstId: string | null = null;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private sunkAnnouncementTimer: ReturnType<typeof setTimeout> | null = null;
  private selfEmoteTimer: ReturnType<typeof setTimeout> | null = null;
  private enemyEmoteTimer: ReturnType<typeof setTimeout> | null = null;
  private selfEmoteRenderTimer: ReturnType<typeof setTimeout> | null = null;
  private enemyEmoteRenderTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['state']) {
      if (this.state?.gameId !== this.lastGameId) {
        this.lastGameId = this.state?.gameId ?? null;
        this.seenEmoteIds.clear();
        this.lastIncomingBurstId = null;
        this.selfActiveEmote = null;
        this.enemyActiveEmote = null;
        this.sunkAnnouncement = null;
      }
      this.captureLatestTransientMarks(changes['state'].previousValue as GameState | null, this.state);
      this.captureSunkAnnouncement(changes['state'].previousValue as GameState | null, this.state);
      this.captureIncomingBurst(this.state);
      this.captureEnemyEmotesFromState(this.state);
      this.liveSecondsLeft = this.state?.turnSecondsLeft ?? 10;
      this.restartCountdown();
    }
  }

  ngOnDestroy(): void {
    this.clearCountdown();
    this.clearEmoteTimers();
    this.clearSunkAnnouncementTimer();
  }

  replay(): void {
    this.playAgain.emit();
  }

  quit(): void {
    this.quitGame.emit();
  }

  toggleOwnFleet(): void {
    this.showOwnFleet = !this.showOwnFleet;
  }

  toggleEnemySize(): void {
    this.enemyExpanded = !this.enemyExpanded;
  }

  fireAt(row: number, col: number): void {
    if (this.canTarget(row, col)) {
      this.attackCoordinate.emit({ row, col });
    }
  }

  sendEmote(emoteKey: string): void {
    if (this.state?.phase === 'battle' || this.state?.phase === 'gameover') {
      this.showSelfEmote(emoteKey);
      this.emoteSelected.emit(emoteKey);
    }
  }

  emoteIcon(emoteKey: string | null): string {
    const match = this.emoteOptions.find((item) => item.key === emoteKey);
    return match?.icon || '';
  }

  activePlayerName(): string {
    if (!this.state?.activeTeam) {
      return '';
    }
    return this.state.activeTeam === this.state.selfTeam
      ? this.state.username
      : (this.state.opponentName || 'Adversaire');
  }

  gameOverTitle(): string {
    return this.state?.winner === this.state?.selfTeam ? 'Vous avez gagne' : 'Vous avez perdu';
  }

  enemyTeamLabel(): string {
    if (!this.state?.selfTeam) {
      return '';
    }
    return this.state.selfTeam === 'BLUE' ? 'RED' : 'BLUE';
  }

  selfTeamClass(): string {
    return this.state?.selfTeam === 'RED' ? 'player-team-red' : 'player-team-blue';
  }

  enemyTeamClass(): string {
    return this.enemyTeamLabel() === 'RED' ? 'player-team-red' : 'player-team-blue';
  }

  selfKoBadgeClass(): string {
    return this.state?.selfTeam === 'RED' ? 'player-ko-badge player-ko-badge-red' : 'player-ko-badge player-ko-badge-blue';
  }

  enemyKoBadgeClass(): string {
    return this.enemyTeamLabel() === 'RED' ? 'player-ko-badge player-ko-badge-red' : 'player-ko-badge player-ko-badge-blue';
  }

  selfKoCount(): number {
    return (this.state?.fleetSummary ?? []).filter((ship) => ship.sunk).length;
  }

  enemyKoCount(): number {
    return (this.state?.enemyFleetSummary ?? []).filter((ship) => ship.sunk).length;
  }

  ownCell(row: number, col: number): CellModel | null {
    return this.state?.ownBoard?.rows[row]?.[col] ?? null;
  }

  enemyCell(row: number, col: number): CellModel | null {
    return this.state?.enemyBoard?.rows[row]?.[col] ?? null;
  }

  canTarget(row: number, col: number): boolean {
    const enemy = this.enemyCell(row, col);
    const lastSelfAttack = this.state?.lastSelfAttack;
    const isLastClicked = lastSelfAttack?.row === row && lastSelfAttack?.col === col;
    return Boolean(this.state?.isMyTurn && !this.state?.resolvingAttack && this.state?.phase === 'battle' && enemy && !enemy.attacked && !isLastClicked);
  }

  cellClasses(row: number, col: number): string {
    const own = this.ownCell(row, col);
    const enemy = this.enemyCell(row, col);
    const classes = ['combo-cell'];

    if (this.enemyExpanded) {
      classes.push('combo-cell-large');
    }

    if (this.canTarget(row, col)) {
      classes.push('combo-cell-targetable');
    }

    if (enemy?.result === 'hit') {
      classes.push('combo-cell-hit');
      classes.push(this.enemyTeamLabel() === 'RED' ? 'combo-cell-hit-red' : 'combo-cell-hit-blue');
    } else if (enemy?.result === 'miss' && this.shouldShowEnemyMiss(row, col)) {
      classes.push('combo-cell-miss');
    }

    if (own?.hasShip && this.showOwnFleet) {
      classes.push('combo-cell-own-ship');
      classes.push(this.state?.selfTeam === 'RED' ? 'combo-cell-own-ship-red' : 'combo-cell-own-ship-blue');
    }

    if (own?.shipSegmentHit) {
      classes.push('combo-cell-own-hit');
    }

    return classes.join(' ');
  }

  enemyText(row: number, col: number): string {
    const enemy = this.enemyCell(row, col);
    if (enemy?.result === 'hit') {
      return '✓';
    }
    if (enemy?.result === 'miss' && this.shouldShowEnemyMiss(row, col)) {
      return 'X';
    }
    return '';
  }

  enemyMarkerClass(row: number, col: number): string {
    const enemy = this.enemyCell(row, col);
    if (enemy?.result === 'hit') {
      return 'combo-enemy-marker combo-enemy-marker-hit-success';
    }
    if (enemy?.result === 'miss') {
      return 'combo-enemy-marker combo-enemy-marker-miss-fail';
    }
    return 'combo-enemy-marker';
  }

  ownText(row: number, col: number): string {
    const own = this.ownCell(row, col);
    if (!this.showOwnFleet) {
      return '';
    }
    return '';
  }

  incomingShotText(row: number, col: number): string {
    const own = this.ownCell(row, col);
    if (!own?.attacked) {
      return '';
    }
    if (own?.shipSegmentHit) {
      return '✓';
    }
    return this.shouldShowOwnMiss(row, col) ? 'X' : '';
  }

  incomingShotClass(row: number, col: number): string {
    const own = this.ownCell(row, col);
    if (!own?.attacked) {
      return 'combo-incoming-marker';
    }
    if (!own?.shipSegmentHit && !this.shouldShowOwnMiss(row, col)) {
      return 'combo-incoming-marker';
    }
    return own?.shipSegmentHit
      ? 'combo-incoming-marker combo-incoming-marker-hit'
      : 'combo-incoming-marker combo-incoming-marker-miss';
  }

  private shouldShowEnemyMiss(row: number, col: number): boolean {
    return this.latestEnemyMiss?.row === row && this.latestEnemyMiss?.col === col;
  }

  private shouldShowOwnMiss(row: number, col: number): boolean {
    return this.latestOwnMiss?.row === row && this.latestOwnMiss?.col === col;
  }

  private captureLatestTransientMarks(previous: GameState | null, current: GameState | null): void {
    const latestEnemyAttack = this.findLatestAttack(previous?.enemyBoard?.rows ?? null, current?.enemyBoard?.rows ?? null);
    if (latestEnemyAttack) {
      this.latestEnemyMiss = latestEnemyAttack.result === 'miss'
        ? { row: latestEnemyAttack.row, col: latestEnemyAttack.col }
        : null;
    }

    const latestOwnAttack = this.findLatestAttack(previous?.ownBoard?.rows ?? null, current?.ownBoard?.rows ?? null);
    if (latestOwnAttack) {
      this.latestOwnMiss = latestOwnAttack.result === 'miss'
        ? { row: latestOwnAttack.row, col: latestOwnAttack.col }
        : null;
    }
  }

  private captureIncomingBurst(current: GameState | null): void {
    const burst = current?.incomingEmoteBurst;
    if (!burst || burst.id === this.lastIncomingBurstId) {
      return;
    }

    this.lastIncomingBurstId = burst.id;
    if (burst.team === current?.selfTeam) {
      this.showSelfEmote(burst.emote);
      return;
    }

    this.showEnemyEmote(burst.emote);
  }

  private captureSunkAnnouncement(previous: GameState | null, current: GameState | null): void {
    const previousEnemyKo = (previous?.enemyFleetSummary ?? []).filter((ship) => ship.sunk).length;
    const currentEnemyKo = (current?.enemyFleetSummary ?? []).filter((ship) => ship.sunk).length;
    if (currentEnemyKo > previousEnemyKo) {
      this.showSunkAnnouncement(`Bateau ${currentEnemyKo} coule`, 'enemy');
      return;
    }

    const previousOwnKo = (previous?.fleetSummary ?? []).filter((ship) => ship.sunk).length;
    const currentOwnKo = (current?.fleetSummary ?? []).filter((ship) => ship.sunk).length;
    if (currentOwnKo > previousOwnKo) {
      this.showSunkAnnouncement(`Bateau ${currentOwnKo} coule`, 'own');
    }
  }

  private captureEnemyEmotesFromState(current: GameState | null): void {
    for (const emote of current?.emotes ?? []) {
      if (this.seenEmoteIds.has(emote.id)) {
        continue;
      }

      this.seenEmoteIds.add(emote.id);
      if (emote.team === current?.selfTeam) {
        continue;
      }

      this.showEnemyEmote(emote.emote);
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

  private restartCountdown(): void {
    this.clearCountdown();

    if (!this.state || this.state.phase !== 'battle') {
      return;
    }

    if (this.state.resolvingAttack) {
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
      this.selfEmoteTimer = null;
    }
    if (this.enemyEmoteTimer) {
      clearTimeout(this.enemyEmoteTimer);
      this.enemyEmoteTimer = null;
    }
    if (this.selfEmoteRenderTimer) {
      clearTimeout(this.selfEmoteRenderTimer);
      this.selfEmoteRenderTimer = null;
    }
    if (this.enemyEmoteRenderTimer) {
      clearTimeout(this.enemyEmoteRenderTimer);
      this.enemyEmoteRenderTimer = null;
    }
  }

  private clearSunkAnnouncementTimer(): void {
    if (this.sunkAnnouncementTimer) {
      clearTimeout(this.sunkAnnouncementTimer);
      this.sunkAnnouncementTimer = null;
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

  private showSunkAnnouncement(message: string, tone: 'enemy' | 'own'): void {
    this.clearSunkAnnouncementTimer();
    this.sunkAnnouncement = { message, tone };
    this.sunkAnnouncementTimer = setTimeout(() => {
      this.sunkAnnouncement = null;
      this.sunkAnnouncementTimer = null;
    }, 1800);
  }
}
