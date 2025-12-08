
export enum RoomType {
  ENEMY = 'ENEMY',
  ELITE = 'ELITE',
  BOSS = 'BOSS',
  TREASURE = 'TREASURE',
  EVENT = 'EVENT',
  REST = 'REST',
  MERCHANT = 'MERCHANT'
}

export type ShopType = 'HARDWARE' | 'SOFTWARE' | 'GENERAL';

export enum TreasureType {
  DATA_CACHE = 'DATA_CACHE',
  CRYPTO_MINER = 'CRYPTO_MINER',
  DARK_CONTRACT = 'DARK_CONTRACT'
}

export enum ContractType {
  GHOST_RUN = 'GHOST_RUN', // No combat
  WETWORK = 'WETWORK', // Kill Elite
  CHAOS_BET = 'CHAOS_BET', // Reach High Alert
  SPEEDRUN = 'SPEEDRUN', // Clear floors (survive X rooms)
  UNTOUCHABLE = 'UNTOUCHABLE' // Low damage
}

export interface Contract {
  id: string;
  name: string;
  description: string;
  type: ContractType;
  cost: number; // Upfront cost
  payoutAmount: number; // Crypto amount or 0 if module
  payoutReward?: string; // Description of reward if not crypto
  targetValue: number; // e.g., 4 rooms, 1 kill
  currentValue: number;
  durationFloors: number; // How many floors/rooms until it expires
  startFloor: number;
}

export interface Module {
  id: string;
  name: string;
  description: string;
  effectId: 'vampire' | 'thorns' | 'miner' | 'nano_armor' | 'overclock' | 'logic_bomb' | 'guardian';
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
  activeContracts: Contract[];
  hasCryptoMiner: boolean;
}

export interface RoomCardData {
  id: string;
  type: RoomType;
  difficultyScale: number;
  name: string;
  description: string;
  // The types of the 3 cards that will appear NEXT if this card is chosen
  nextScoutInfo: RoomType[];
  alertPenalty?: number; // Visual indicator of potential alert increase (or decrease if negative)
  shopType?: ShopType; // Specific type for Merchant cards
}

export interface LogEntry {
  id: string;
  floor: number;
  message: string;
  type: 'info' | 'combat' | 'gain' | 'danger' | 'alert';
}

export interface EventChoice {
    id: string;
    text: string;
    description: string;
    riskText: string;
    style: string;
}

export interface GameState {
  floor: number;
  player: PlayerStats;
  currentCards: RoomCardData[];
  history: LogEntry[];
  status: 'PLAYING' | 'RESOLVING' | 'GAME_OVER' | 'VICTORY' | 'SHOPPING' | 'EVENT_INTERACTION' | 'TREASURE_INTERACTION';
  lastResolutionText?: string;
  analyzing?: boolean;
  analysisResult?: string;
  lastBossFloor: number;
  currentEvent?: {
      title: string;
      description: string;
      choices: EventChoice[];
  };
  pendingNextRoomTypes?: RoomType[]; // Stores the scouted path while in a sub-screen (Shop/Event)
  activeShopType?: ShopType;
  currentTreasure?: {
      type: TreasureType;
      dataCache?: {
          layer: number; // 1, 2, 3
          rewardsCollected: string[];
      };
      contracts?: Contract[]; // Available contracts to sign
  };
}
