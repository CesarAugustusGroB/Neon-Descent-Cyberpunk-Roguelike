export enum RoomType {
  ENEMY = 'ENEMY',
  ELITE = 'ELITE',
  BOSS = 'BOSS',
  TREASURE = 'TREASURE',
  EVENT = 'EVENT',
  REST = 'REST',
  MERCHANT = 'MERCHANT'
}

export interface Module {
  id: string;
  name: string;
  description: string;
  effectId: 'vampire' | 'thorns' | 'miner' | 'nano_armor' | 'overclock';
  cost: number;
  icon?: string; 
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  power: number; // RAM/CPU
  shield: number; // Firewall
  credits: number;
  securityAlert: number; // 0-100%
  modules: Module[];
}

export interface RoomCardData {
  id: string;
  type: RoomType;
  difficultyScale: number;
  name: string;
  description: string;
  // The types of the 3 cards that will appear NEXT if this card is chosen
  nextScoutInfo: RoomType[]; 
}

export interface LogEntry {
  id: string;
  floor: number;
  message: string;
  type: 'info' | 'combat' | 'gain' | 'danger' | 'alert';
}

export interface GameState {
  floor: number;
  player: PlayerStats;
  currentCards: RoomCardData[];
  history: LogEntry[];
  status: 'PLAYING' | 'RESOLVING' | 'GAME_OVER' | 'VICTORY' | 'SHOPPING';
  lastResolutionText?: string;
  analyzing?: boolean;
  analysisResult?: string;
  lastBossFloor: number;
}