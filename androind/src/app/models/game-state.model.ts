import { CellModel } from './cell.model';
import { ShipModel } from './ship.model';

export type TeamColor = 'BLUE' | 'RED';
export type GamePhase = 'home' | 'matching' | 'battle' | 'gameover';

export interface FleetSummaryItem {
  id: string;
  name: string;
  size: number;
  hits: number;
  sunk: boolean;
  remaining: number;
}

export interface BoardView {
  rows: CellModel[][];
  ships: ShipModel[];
}

export interface EmoteMessage {
  id: string;
  team: TeamColor;
  username: string;
  emote: string;
  createdAt: number;
}

export interface PlayerAvatar {
  id: string;
  icon?: string;
  tint: string;
  source?: 'preset' | 'upload';
  imageDataUrl?: string;
}

export interface AttackWindup {
  id: string;
  row: number;
  col: number;
  team: TeamColor;
}

export interface GameState {
  gameId: string | null;
  phase: GamePhase;
  matchMode: 'random' | 'private' | null;
  matchCode: string | null;
  selfTeam: TeamColor | null;
  activeTeam: TeamColor | null;
  resolvingAttack: boolean;
  isMyTurn: boolean;
  vsBot: boolean;
  winner: TeamColor | null;
  username: string;
  opponentName: string | null;
  selfAvatar: PlayerAvatar | null;
  opponentAvatar: PlayerAvatar | null;
  connectionLabel: string;
  statusMessage: string;
  ownBoard: BoardView | null;
  enemyBoard: BoardView | null;
  log: string[];
  rowLabels: string[];
  colLabels: string[];
  fleetSummary: FleetSummaryItem[];
  enemyFleetSummary: FleetSummaryItem[];
  emotes: EmoteMessage[];
  incomingEmoteBurst: EmoteMessage | null;
  incomingAttackWindup: AttackWindup | null;
  lastSelfAttack: { row: number; col: number } | null;
  turnSecondsLeft: number;
  selfSkips: number;
  enemySkips: number;
}
