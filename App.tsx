
import React, { useState, useEffect, useCallback } from 'react';
import { PlayerStats, RoomCardData, RoomType, GameState, LogEntry, Module, EventChoice, ShopType, TreasureType, Contract, ContractType } from './types';
import { StatsHeader } from './components/StatsHeader';
import { RoomCard } from './components/RoomCard';
import { GameLog } from './components/GameLog';
import { getTacticalAnalysis } from './services/geminiService';
import { Brain, RefreshCw, AlertTriangle, Terminal, ShoppingBag, X, HelpCircle, Keyboard, Info, Flame, MousePointerClick, Cpu, Disc, Database as DatabaseIcon, Shield, Zap, Lock, Unlock, Pickaxe, ClipboardList, CheckCircle } from 'lucide-react';

// --- Constants & Config ---
const INITIAL_STATS: PlayerStats = {
  hp: 100,
  maxHp: 100,
  power: 10,
  shield: 0,
  credits: 0,
  securityAlert: 0, // Starts at 0%
  modules: [],
  activeContracts: [],
  hasCryptoMiner: false
};

// Available Modules (Prices increased by 1.5x)
const AVAILABLE_MODULES: Module[] = [
    { id: 'm1', name: 'Vampire Kernel', description: 'Recover 2 HP when destroying enemies.', effectId: 'vampire', cost: 75 },
    { id: 'm2', name: 'Thorns Protocol', description: 'Deals 3 DMG to attacker per cycle.', effectId: 'thorns', cost: 101 },
    { id: 'm3', name: 'Crypto Miner', description: '+20% Crypto gain from all sources.', effectId: 'miner', cost: 60 },
    { id: 'm4', name: 'Nano-Armor', description: '+8% chance to Negate all damage.', effectId: 'nano_armor', cost: 126 },
    { id: 'm5', name: 'Overclock', description: '+3 RAM, but -10 Max Integrity.', effectId: 'overclock', cost: 90 },
    { id: 'm6', name: 'Logic Bomb', description: '12% chance to reflect 50% damage taken.', effectId: 'logic_bomb', cost: 113 },
    { id: 'm7', name: 'Guardian Angel', description: 'Flat -2 Damage reduction.', effectId: 'guardian', cost: 143 },
];

const NAMES = {
    [RoomType.ENEMY]: ["Security Drone", "Script Kiddie", "Data Leech", "Firewall Sentinel", "Cyber-Rat"],
    [RoomType.ELITE]: ["Black Ice", "Corp Assassin", "Mech-Enforcer", "Netrunner Phantom"],
    [RoomType.BOSS]: ["Mainframe Core", "Project 2501", "CEO Avatar", "The Architect"],
    [RoomType.TREASURE]: ["Data Cache", "Crypto Node", "Hidden Archive", "Encrypted Vault"],
    [RoomType.REST]: ["Safe House", "VPN Tunnel", "Repair Node", "Offline Shelter"],
    [RoomType.EVENT]: ["Glitch Storm", "Rogue AI Contact", "Corrupted Sector", "Data Surge", "Mysterious Signal"],
    [RoomType.MERCHANT]: ["Black Market", "Rogue Dealer", "Darknet Node", "Fence"],
};

export default function App() {
  // --- State ---
  const [gameState, setGameState] = useState<GameState>({
    floor: 1,
    player: { ...INITIAL_STATS },
    currentCards: [],
    history: [],
    status: 'PLAYING',
    lastBossFloor: 0
  });

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [helpTab, setHelpTab] = useState<'GUIDE' | 'DATA'>('GUIDE');

  // --- Helpers ---

  const getRandomRoomType = useCallback((floor: number, alertLevel: number, lastBossFloor: number): RoomType => {
      const floorsSinceLastBoss = floor - lastBossFloor;

      // 1. Dynamic Boss Chance (Accumulating Risk)
      if (floorsSinceLastBoss > 30) {
          const chance = (floorsSinceLastBoss - 30) * 5 + (alertLevel * 0.5);
          if (Math.random() * 100 < chance) return RoomType.BOSS;
      }

      const rand = Math.random();

      // 2. Early Boss Opportunity
      if (floor > 5 && rand < 0.015) return RoomType.BOSS; 

      // 3. High Heat Loot Rarity
      if (alertLevel > 20) {
          if (rand < (alertLevel / 500)) { 
             return Math.random() < 0.6 ? RoomType.ELITE : RoomType.TREASURE;
          }
      }

      // 4. Standard Probabilities
      if (roll(0.40)) return RoomType.ENEMY;
      if (roll(0.55)) return RoomType.EVENT;
      if (roll(0.65)) return RoomType.TREASURE;
      if (roll(0.75)) return RoomType.REST;
      if (roll(0.85)) return RoomType.MERCHANT; 
      if (roll(0.95)) return RoomType.ELITE;
      return RoomType.ENEMY;
  }, []);

  // Simple probability helper
  const roll = (threshold: number) => Math.random() < threshold;

  const generateScoutInfo = useCallback((currentFloor: number, alertLevel: number, lastBossFloor: number): RoomType[] => {
    return [
      getRandomRoomType(currentFloor + 1, alertLevel, lastBossFloor),
      getRandomRoomType(currentFloor + 1, alertLevel, lastBossFloor),
      getRandomRoomType(currentFloor + 1, alertLevel, lastBossFloor),
    ];
  }, [getRandomRoomType]);

  const generateCardsForFloor = useCallback((floor: number, alertLevel: number, lastBossFloor: number, forcedTypes?: RoomType[]): RoomCardData[] => {
    // If forcedTypes are provided (from previous scout info), use them. Otherwise generate random.
    const typesToUse = forcedTypes || [
        getRandomRoomType(floor, alertLevel, lastBossFloor),
        getRandomRoomType(floor, alertLevel, lastBossFloor),
        getRandomRoomType(floor, alertLevel, lastBossFloor)
    ];

    return typesToUse.map((type, i) => {
      let name = NAMES[type][Math.floor(Math.random() * NAMES[type].length)];
      let description = "";
      let alertPenalty = 5; // Default non-combat penalty
      let shopType: ShopType | undefined;

      // --- Custom Logic for Variable Alert Costs ---
      if (type === RoomType.TREASURE) {
          description = "Encrypted Node. Can contain Data Caches, Contracts, or Miners.";
          alertPenalty = 5;
      } else if (type === RoomType.REST) {
          if (Math.random() < 0.3) {
              name = "System Reboot Node";
              description = "Complete system restore (100% HP). Risk: Massive Alert Increase (+15).";
              alertPenalty = 15;
          } else {
              description = "Network quiet zone. Repairs Integrity (40%).";
              alertPenalty = 0;
          }
      } else if (type === RoomType.EVENT) {
          description = "Unpredictable interaction. Choose your approach.";
          alertPenalty = 0; // Events now have choice-based alert
      } else if (type === RoomType.MERCHANT) {
          // Shop Randomization
          const rand = Math.random();
          if (rand < 0.33) {
              shopType = 'HARDWARE';
              name = "Hardware Outpost";
              description = "Defensive upgrades and core systems.";
          } else if (rand < 0.66) {
              shopType = 'SOFTWARE';
              name = "Software Den";
              description = "Utility scripts and offensive protocols.";
          } else {
              shopType = 'GENERAL';
              name = "Black Market";
              description = "Anything and everything. For a price.";
          }
          alertPenalty = 5;
      } else {
          // Combat types
          description = type === RoomType.BOSS ? "EXTREME DANGER." : "Hostile entity. Combat lowers Alert Level.";
          
          if (type === RoomType.BOSS) alertPenalty = -30;
          else if (type === RoomType.ELITE) alertPenalty = -13; 
          else alertPenalty = -7;
      }
      
      return {
        id: `f${floor}-c${i}-${Math.random().toString(36).substring(7)}`,
        type,
        difficultyScale: 1 + (floor * 0.03),
        name,
        description,
        nextScoutInfo: generateScoutInfo(floor, alertLevel, lastBossFloor),
        alertPenalty,
        shopType
      };
    });
  }, [getRandomRoomType, generateScoutInfo]);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setGameState(prev => ({
      ...prev,
      history: [
        ...prev.history,
        { id: Math.random().toString(36).substring(7), floor: prev.floor, message, type }
      ]
    }));
  };

  // Init Game
  useEffect(() => {
    const cards = generateCardsForFloor(1, 0, 0);
    setGameState(prev => ({ 
        ...prev, 
        currentCards: cards, 
        history: [{ id: 'init', floor: 1, message: 'System Online. Connection established.', type: 'info' }],
        lastBossFloor: 0
    }));
  }, [generateCardsForFloor]);

  // --- Logic Helpers that need to be hoisted ---

  const updateContracts = useCallback((eventType: 'COMBAT_WIN' | 'FLOOR_ADVANCE', data?: any) => {
      setGameState(prev => {
          let updatedContracts = [...prev.player.activeContracts];
          let updatedPlayer = { ...prev.player };
          let newHistory = [...prev.history];

          // Filter out expired or completed contracts logic
          updatedContracts = updatedContracts.filter(contract => {
              let isCompleted = false;
              let isFailed = false;

              if (eventType === 'COMBAT_WIN') {
                  if (contract.type === ContractType.WETWORK && data?.isElite) {
                      contract.currentValue += 1;
                      if (contract.currentValue >= contract.targetValue) isCompleted = true;
                  }
                  if (contract.type === ContractType.GHOST_RUN) {
                      isFailed = true; // Failed if combat happens
                      newHistory.push({ id: Math.random().toString(), floor: prev.floor, message: `Contract Failed: ${contract.name}`, type: 'danger' });
                  }
              }

              if (eventType === 'FLOOR_ADVANCE') {
                  contract.durationFloors -= 1;
                  
                  if (contract.type === ContractType.GHOST_RUN) {
                      contract.currentValue += 1;
                      if (contract.currentValue >= contract.targetValue) isCompleted = true;
                  }
                  if (contract.type === ContractType.CHAOS_BET) {
                      if (prev.player.securityAlert >= 80) isCompleted = true;
                  }
              }

              if (isCompleted) {
                  newHistory.push({ id: Math.random().toString(), floor: prev.floor, message: `Contract Completed: ${contract.name}. Reward: ${contract.payoutAmount > 0 ? contract.payoutAmount + 'C' : contract.payoutReward}`, type: 'gain' });
                  updatedPlayer.credits += contract.payoutAmount;
                  if (contract.payoutReward && contract.payoutAmount === 0) {
                      // Logic for item reward (Module)
                      const mod = AVAILABLE_MODULES[Math.floor(Math.random() * AVAILABLE_MODULES.length)];
                      updatedPlayer.modules = [...updatedPlayer.modules, mod];
                      newHistory.push({ id: Math.random().toString(), floor: prev.floor, message: `Contract Reward: ${mod.name}`, type: 'gain' });
                  }
                  return false; // Remove from active
              }
              
              if (contract.durationFloors <= 0 || isFailed) {
                  if (!isFailed) newHistory.push({ id: Math.random().toString(), floor: prev.floor, message: `Contract Expired: ${contract.name}`, type: 'info' });
                  return false; // Remove
              }

              return true; // Keep active
          });

          return {
              ...prev,
              player: { ...updatedPlayer, activeContracts: updatedContracts },
              history: newHistory
          };
      });
  }, []);

  const advanceFloor = useCallback((player: PlayerStats, resolutionText: string, bossDefeated: boolean = false, nextRoomTypes?: RoomType[]) => {
      const nextFloor = gameState.floor + 1;
      const newLastBossFloor = bossDefeated ? gameState.floor : gameState.lastBossFloor;
      
      // REBALANCE: Passive drift +1 per floor
      // MINER: +4 Alert if miner active
      const minerAlert = player.hasCryptoMiner ? 4 : 0;
      const newAlert = Math.min(100, player.securityAlert + 1 + minerAlert);
      const playerWithDrift = { ...player, securityAlert: newAlert };
      
      // Use the scout info (nextRoomTypes) if available to force the room types
      const newCardsRaw = generateCardsForFloor(nextFloor, playerWithDrift.securityAlert, newLastBossFloor, nextRoomTypes);

      setGameState(prev => ({
        ...prev,
        player: playerWithDrift,
        floor: nextFloor,
        currentCards: newCardsRaw,
        status: 'RESOLVING',
        lastResolutionText: resolutionText,
        analysisResult: null,
        lastBossFloor: newLastBossFloor,
        pendingNextRoomTypes: undefined // Clear any pending path
    }));
    
    // Check Contracts on floor advance
    setTimeout(() => updateContracts('FLOOR_ADVANCE'), 0);

  }, [gameState.floor, gameState.lastBossFloor, generateCardsForFloor, updateContracts]);

  // --- Treasure & Event Logic ---

  const generateTreasure = (floor: number): { type: TreasureType, flavor: string, contracts?: Contract[] } => {
      const rand = Math.random();
      let type = TreasureType.DATA_CACHE;
      
      // Distribution based on floor tier (Early 1-3, Mid 4-6, Late 7+)
      if (floor <= 3) {
          if (rand < 0.55) type = TreasureType.DATA_CACHE;
          else if (rand < 0.80) type = TreasureType.DARK_CONTRACT;
          else type = TreasureType.CRYPTO_MINER;
      } else if (floor <= 6) {
          if (rand < 0.40) type = TreasureType.DATA_CACHE;
          else if (rand < 0.75) type = TreasureType.DARK_CONTRACT;
          else type = TreasureType.CRYPTO_MINER;
      } else {
          if (rand < 0.30) type = TreasureType.DATA_CACHE;
          else if (rand < 0.75) type = TreasureType.DARK_CONTRACT;
          else type = TreasureType.CRYPTO_MINER;
      }

      let contracts: Contract[] = [];
      if (type === TreasureType.DARK_CONTRACT) {
          contracts = [
              { id: 'c1'+Math.random(), name: 'GHOST RUN', description: 'Survive 4 floors without combat.', type: ContractType.GHOST_RUN, cost: 35, payoutAmount: 110, targetValue: 4, currentValue: 0, durationFloors: 4, startFloor: floor },
              { id: 'c2'+Math.random(), name: 'WETWORK', description: 'Kill an Elite enemy.', type: ContractType.WETWORK, cost: 20, payoutAmount: 0, payoutReward: 'Rare Module', targetValue: 1, currentValue: 0, durationFloors: 5, startFloor: floor },
              { id: 'c3'+Math.random(), name: 'CHAOS BET', description: 'Reach 80% Alert.', type: ContractType.CHAOS_BET, cost: 25, payoutAmount: 150, targetValue: 80, currentValue: 0, durationFloors: 5, startFloor: floor }
          ];
      }

      const flavors = {
          [TreasureType.DATA_CACHE]: "Encrypted server node detected. Layers of ICE present.",
          [TreasureType.CRYPTO_MINER]: "Dormant mining protocol detected. Installation will compromise security.",
          [TreasureType.DARK_CONTRACT]: "Darknet Futures Exchange. Place your bets, runner."
      };

      return { type, flavor: flavors[type], contracts };
  };

  const purgeMiner = () => {
      if (!gameState.player.hasCryptoMiner) return;
      const cost = 20;
      if (gameState.player.hp <= cost) return;

      setGameState(prev => ({
          ...prev,
          player: {
              ...prev.player,
              hp: prev.player.hp - cost,
              hasCryptoMiner: false
          },
          history: [...prev.history, { id: 'purge', floor: prev.floor, message: `Miner Purged. -${cost} HP`, type: 'info' }]
      }));
  };

  const handleTreasureInteraction = (action: string, data?: any) => {
      let player = { ...gameState.player };
      let resolutionText = '';
      let logMsg = '';
      let shouldAdvance = false;

      // Data Cache Actions
      if (action === 'CACHE_L1') {
          // Take Layer 1
          const gain = 30 + Math.floor(gameState.floor * 2);
          player.credits += gain;
          logMsg = `Cache Breached (Shell): +${gain} Crypto`;
          resolutionText = "You extracted the surface level data and jacked out.";
          shouldAdvance = true;
      }
      else if (action === 'CACHE_L2_PAY') {
          // Pay cost for Layer 2
          if (data.costType === 'HP') player.hp -= 15;
          if (data.costType === 'ALERT') player.securityAlert += 12;
          if (data.costType === 'MODULE') player.modules.pop(); // Simplistic removal
          
          // Reward
          const gain = 20;
          player.credits += gain;
          // Random Common Mod
          const mod = AVAILABLE_MODULES[Math.floor(Math.random() * AVAILABLE_MODULES.length)];
          player.modules = [...player.modules, mod];
          
          // Proceed state to Layer 3 or Leave? Prompt implies "Deeper = more loot".
          // We'll update the current treasure state to indicate layer 2 unlocked/cleared.
           setGameState(prev => ({
              ...prev,
              player,
              currentTreasure: { ...prev.currentTreasure!, dataCache: { layer: 3, rewardsCollected: [] } }
          }));
          return; // Stay in modal
      }
      else if (action === 'CACHE_L2_LEAVE') {
           // Took L2 reward in previous step (simulated) or just leaving now?
           // Actually implementation simplified: clicking L2 Pay instantly gives reward. Now player sees L3.
           logMsg = "Cache Layer 2 Breached. Loot secured.";
           resolutionText = "You breached the ICE and secured valuable hardware.";
           shouldAdvance = true;
      }
      else if (action === 'CACHE_L3') {
          // Gate checked in UI. Pay HP.
          player.hp -= 10;
          const mod = AVAILABLE_MODULES[Math.floor(Math.random() * AVAILABLE_MODULES.length)]; // Should be rare
          player.modules = [...player.modules, mod];
          logMsg = `Cache CORE Decrypted: ${mod.name} Acquired.`;
          resolutionText = "You cracked the core kernel. Legendary tech acquired.";
          shouldAdvance = true;
      }

      // Miner Actions
      else if (action === 'INSTALL_MINER') {
          player.hasCryptoMiner = true;
          logMsg = "Crypto Miner Installed. Passive income active.";
          resolutionText = "The mining protocol is running in the background. It's generating heat, but the credits are flowing.";
          shouldAdvance = true;
      }

      // Contract Actions
      else if (action === 'SIGN_CONTRACT') {
          const contract = data as Contract;
          if (player.credits >= contract.cost && player.activeContracts.length < 2) {
              player.credits -= contract.cost;
              player.activeContracts = [...player.activeContracts, contract];
              setGameState(prev => ({
                  ...prev,
                  player,
                  currentTreasure: { 
                      ...prev.currentTreasure!, 
                      contracts: prev.currentTreasure?.contracts?.filter(c => c.id !== contract.id) 
                  }
              }));
              return; // Stay in modal
          }
      }
      else if (action === 'LEAVE_TREASURE') {
          resolutionText = "You disconnected from the node.";
          shouldAdvance = true;
          logMsg = "Treasure Node bypassed.";
      }

      if (shouldAdvance) {
          addLog(logMsg, 'gain');
          advanceFloor(player, resolutionText, false, gameState.pendingNextRoomTypes);
      } else {
          setGameState(prev => ({ ...prev, player }));
      }
  };

    // --- Interactive Event Helpers ---
    
    const generateEvent = useCallback((): { title: string; description: string; choices: EventChoice[] } => {
        const events = [
            {
                title: "Corrupted Data Stream",
                description: "You encounter a fragmented data stream leaking high-value crypto keys. It's unstable.",
                choices: [
                    { id: 'ev_stream_siphon', text: "Siphon Data", description: "Gain Crypto. Risk Alert increase.", riskText: "MED RISK", style: "border-cyber-yellow text-cyber-yellow" },
                    { id: 'ev_stream_patch', text: "Patch Leak", description: "Heal Integrity. Small Crypto reward.", riskText: "SAFE", style: "border-cyber-green text-cyber-green" },
                    { id: 'ev_ignore', text: "Ignore", description: "Move on safely.", riskText: "NONE", style: "border-gray-500 text-gray-500" }
                ]
            },
            {
                title: "Rogue AI Terminal",
                description: "A sentient subroutine offers you power in exchange for system access.",
                choices: [
                    { id: 'ev_ai_accept', text: "Accept Deal", description: "Gain Power (RAM). Increase Alert significantly.", riskText: "HIGH RISK", style: "border-cyber-red text-cyber-red" },
                    { id: 'ev_ai_deny', text: "Purge AI", description: "Reduce Alert. Small damage taken.", riskText: "LOW RISK", style: "border-cyber-neon text-cyber-neon" },
                    { id: 'ev_ignore', text: "Disconnect", description: "Leave it alone.", riskText: "NONE", style: "border-gray-500 text-gray-500" }
                ]
            },
            {
                title: "Glitch Trap",
                description: "The room shifts around you. It's a trap!",
                choices: [
                    { id: 'ev_trap_break', text: "Brute Force", description: "Take Damage to escape quickly.", riskText: "PAINFUL", style: "border-cyber-red text-cyber-red" },
                    { id: 'ev_trap_hack', text: "Hack Defenses", description: "Chance to avoid damage. Risk Alert.", riskText: "SKILL CHECK", style: "border-purple-500 text-purple-500" }
                ]
            }
        ];
        return events[Math.floor(Math.random() * events.length)];
    }, []);

    const handleEventChoice = useCallback((choiceId: string) => {
        let player = { ...gameState.player };
        let resolutionText = "";
        let logMsg = "";
        let logType: LogEntry['type'] = 'info';
  
        switch(choiceId) {
            case 'ev_stream_siphon':
                const gain = 40 + (gameState.floor * 5);
                player.credits += gain;
                player.securityAlert += 10;
                resolutionText = `You siphoned ${gain} credits, but the intrusion was logged.`;
                logMsg = `Event: Siphoned ${gain} Crypto. Alert +10.`;
                logType = 'gain';
                break;
            case 'ev_stream_patch':
                const heal = 15;
                player.hp = Math.min(player.maxHp, player.hp + heal);
                player.credits += 10;
                resolutionText = "System stabilized. Integrity restored slightly.";
                logMsg = `Event: Patched stream. +${heal} HP.`;
                logType = 'gain';
                break;
            case 'ev_ai_accept':
                player.power += 2;
                player.securityAlert += 20;
                resolutionText = "Processing power augmented. The network is now watching you closely.";
                logMsg = "Event: Deal struck. +2 RAM. Alert +20.";
                logType = 'danger';
                break;
            case 'ev_ai_deny':
                player.securityAlert = Math.max(0, player.securityAlert - 15);
                player.hp -= 10;
                resolutionText = "AI purged. Security measures relaxed, but you took some feedback damage.";
                logMsg = "Event: AI Purged. Alert -15. Took 10 DMG.";
                logType = 'combat';
                break;
            case 'ev_trap_break':
                const dmg = 20;
                player.hp -= dmg;
                resolutionText = "You smashed through the firewall trap.";
                logMsg = `Event: Brute force escape. -${dmg} HP.`;
                logType = 'danger';
                break;
            case 'ev_trap_hack':
                if (player.power > 10 + (gameState.floor)) {
                    player.securityAlert += 5;
                    resolutionText = "Trap dismantled cleanly.";
                    logMsg = "Event: Hack successful.";
                } else {
                    player.hp -= 15;
                    player.securityAlert += 10;
                    resolutionText = "Hack failed! Countermeasures deployed.";
                    logMsg = "Event: Hack failed. -15 HP. Alert +10.";
                    logType = 'danger';
                }
                break;
            case 'ev_ignore':
                resolutionText = "You bypassed the anomaly.";
                logMsg = "Event: Bypassed.";
                break;
            default:
                resolutionText = "Event resolved.";
        }
  
        // Check death
        if (player.hp <= 0) {
            player.hp = 0;
            setGameState(prev => ({ ...prev, player, status: 'GAME_OVER', lastResolutionText: "Killed by environmental hazard." }));
            return;
        }
  
        addLog(logMsg, logType);
        advanceFloor(player, resolutionText, false, gameState.pendingNextRoomTypes);
    }, [gameState.player, gameState.floor, gameState.pendingNextRoomTypes, advanceFloor]);

  // --- Core Action: Resolve Card ---

  const handleTacticalAnalysis = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    setAnalysisResult(null);
    const advice = await getTacticalAnalysis(gameState.floor, gameState.player, gameState.currentCards);
    setAnalysisResult(advice);
    setAnalyzing(false);
  };

  const resolveCard = useCallback(async (initialCard: RoomCardData) => {
    if (gameState.status !== 'PLAYING') return;

    let player = { ...gameState.player };
    let card = { ...initialCard };

    // --- ALERT PHASE: KILL SWITCH (90-100%) ---
    // 25% chance to spawn a Hunter when clicking ANY card
    if (player.securityAlert >= 90 && Math.random() < 0.25) { 
        card.type = RoomType.BOSS; 
        card.name = "HUNTER KILLER";
        card.description = "SYSTEM COUNTERMEASURE DEPLOYED. RUNTIME INTERRUPTED.";
        card.alertPenalty = -20; 
        addLog("KILL SWITCH TRIGGERED: HUNTER SPAWNED", "danger");
    }

    // 1. Merchant
    if (card.type === RoomType.MERCHANT) {
        setGameState(prev => ({ 
            ...prev, 
            status: 'SHOPPING', 
            player, 
            pendingNextRoomTypes: card.nextScoutInfo,
            activeShopType: card.shopType || 'GENERAL'
        }));
        return;
    }

    // 2. Interactive Event
    if (card.type === RoomType.EVENT) {
        setGameState(prev => ({
            ...prev,
            status: 'EVENT_INTERACTION',
            currentEvent: generateEvent(),
            player,
            pendingNextRoomTypes: card.nextScoutInfo
        }));
        return;
    }

    // 3. Treasure Interaction (NEW)
    if (card.type === RoomType.TREASURE) {
        const treasure = generateTreasure(gameState.floor);
        // Special case for Deep Storage handled inside generateTreasure or here? 
        // Existing "Deep Storage" logic was random text. We'll replace/merge.
        // If Deep Storage text detected, force high reward cache?
        // Let's stick to the new system fully.
        setGameState(prev => ({
            ...prev,
            status: 'TREASURE_INTERACTION',
            currentTreasure: { ...treasure, dataCache: treasure.type === TreasureType.DATA_CACHE ? { layer: 1, rewardsCollected: [] } : undefined },
            player,
            pendingNextRoomTypes: card.nextScoutInfo
        }));
        return;
    }

    // 4. Standard Resolution (Combat/Rest)
    let logMsg = '';
    let resolutionText = '';
    let logType: LogEntry['type'] = 'info';
    let bossDefeated = false;

    // Miner Passive Income
    if (player.hasCryptoMiner) {
        player.credits += 10;
        addLog("Miner Protocol: +10 Crypto", 'gain');
    }

    // Module Checks
    const vampireCount = player.modules.filter(m => m.effectId === 'vampire').length;
    const thornsCount = player.modules.filter(m => m.effectId === 'thorns').length;
    const minerCount = player.modules.filter(m => m.effectId === 'miner').length;
    const nanoCount = player.modules.filter(m => m.effectId === 'nano_armor').length;
    const guardianCount = player.modules.filter(m => m.effectId === 'guardian').length;
    const logicBombCount = player.modules.filter(m => m.effectId === 'logic_bomb').length;

    // Scaling (REBALANCE: 1.035 per floor)
    const scalingFactor = Math.pow(1.035, gameState.floor); 
    const baseEnemyPower = 10 * scalingFactor;
    const baseEnemyHp = 20 * scalingFactor;

    // Apply Alert from Card
    const alertChange = card.alertPenalty ?? 5;
    player.securityAlert = Math.max(0, Math.min(100, player.securityAlert + alertChange));
    
    // Alert Multipliers
    const alertMultiplier = 1 + (player.securityAlert / 150); 
    const rewardMultiplier = 1 + (player.securityAlert / 100); 

    if (card.type === RoomType.ENEMY || card.type === RoomType.ELITE || card.type === RoomType.BOSS) {
      // Combat Logic
      let multiplier = card.type === RoomType.BOSS ? 2.5 : (card.type === RoomType.ELITE ? 1.5 : 1);
      const enemyPower = Math.floor(baseEnemyPower * 1.2 * multiplier * alertMultiplier);
      const enemyHp = Math.floor(baseEnemyHp * 1.2 * multiplier);

      let effectivePlayerPower = player.power + (3 * thornsCount);
      
      let firstHit = effectivePlayerPower;
      if (player.securityAlert < 30) {
          firstHit = Math.floor(effectivePlayerPower * 1.7); 
      }

      let remainingEnemyHp = enemyHp - firstHit;
      let roundsToKill = 1;
      if (remainingEnemyHp > 0) {
          roundsToKill += Math.ceil(remainingEnemyHp / effectivePlayerPower);
      }

      const flatReduction = 2 * guardianCount;
      let incomingDmgPerRound = Math.max(0, enemyPower - player.shield - flatReduction);
      
      let totalDamageTaken = 0;
      
      for(let i=0; i< roundsToKill -1; i++) {
          if (!(nanoCount > 0 && Math.random() < (0.08 * nanoCount))) {
              if (logicBombCount > 0 && Math.random() < (0.12 * logicBombCount)) {
              } else {
                  totalDamageTaken += incomingDmgPerRound;
              }
          }
      }

      player.hp -= totalDamageTaken;
      
      const powerGain = card.type === RoomType.BOSS ? 5 : 1;
      player.power += powerGain;
      if (vampireCount > 0) player.hp = Math.min(player.maxHp, player.hp + (2 * vampireCount));
      if (card.type === RoomType.BOSS) bossDefeated = true;

      const baseCredit = 6 * scalingFactor;
      const creditMultiplier = card.type === RoomType.BOSS ? 10 : (card.type === RoomType.ELITE ? 3 : 1);
      
      const isActiveSweep = player.securityAlert >= 30 && player.securityAlert < 60;
      const activeSweepBonus = isActiveSweep ? 1.3 : 1;

      let creditGain = Math.floor((baseCredit * creditMultiplier) * (0.8 + Math.random() * 0.4) * rewardMultiplier * activeSweepBonus);
      if (minerCount > 0) creditGain = Math.floor(creditGain * (1 + (0.2 * minerCount)));
      player.credits += creditGain;

      const stealthMsg = player.securityAlert < 30 ? " (Stealth: First Hit x1.7)" : "";
      const alertMsg = alertMultiplier > 1.1 ? ` (High Alert: Enemy DMG +${Math.floor((alertMultiplier-1)*100)}%)` : '';
      const heatBonusMsg = rewardMultiplier > 1.1 ? ` (High Heat: +${Math.floor((rewardMultiplier-1)*100)}% Crypto)` : '';
      const sweepMsg = isActiveSweep ? ` (Active Sweep: x1.3 Crypto)` : '';
      
      logMsg = `Combat: Took ${totalDamageTaken} DMG${alertMsg}. Gained ${creditGain} Crypto${heatBonusMsg}${sweepMsg}.${stealthMsg}`;
      
      if (card.name === "HUNTER KILLER") {
          resolutionText = `INTERCEPTION! The System Hunter found you. You barely survived the ambush.`;
      } else {
          resolutionText = `You engaged the ${card.name}. Security alert: ${player.securityAlert}%. Enemy strikes amplified by ${Math.floor((alertMultiplier-1)*100)}%. Firewall held for ${roundsToKill} cycles.`;
      }
      
      logType = 'combat';

      if (player.hp <= 0) {
        player.hp = 0;
        setGameState(prev => ({ ...prev, player, status: 'GAME_OVER', lastResolutionText: "CRITICAL SYSTEM FAILURE. SIGNAL LOST." }));
        return;
      }

      // Check Combat Contracts
      setTimeout(() => updateContracts('COMBAT_WIN', { isElite: card.type === RoomType.ELITE }), 0);
    } 
    else if (card.type === RoomType.REST) {
        // ... (Existing Rest Logic)
        const isLockdown = player.securityAlert >= 60 && player.securityAlert < 90;
        const lockdownMod = isLockdown ? 0.8 : 1; 

        if (card.alertPenalty && card.alertPenalty > 10) {
             player.hp = player.maxHp;
             logMsg = `Deep System Reboot: Fully Restored. Alert +${card.alertPenalty}`;
             resolutionText = "You initiated a complete system flush and restart. You are fully operational, but the extensive downtime revealed your location to everyone.";
        } else {
             const baseHeal = Math.floor(player.maxHp * 0.4);
             const healAmt = Math.floor(baseHeal * lockdownMod);
             
             player.hp = Math.min(player.maxHp, player.hp + healAmt);
             logMsg = `System Repair: +${healAmt} Integrity.${isLockdown ? ' (Lockdown Interference -20%)' : ''} Alert +0.`;
             resolutionText = isLockdown 
                ? "Network lockdown active. Repair protocols were throttled by security interference." 
                : "You found a quiet node to repair subroutines.";
        }
        logType = 'gain';
    }

    if (alertChange > 0) addLog(`Alert Increased by ${alertChange}%`, 'alert');
    if (alertChange < 0) addLog(`Alert Decreased by ${Math.abs(alertChange)}%`, 'gain');
    addLog(logMsg, logType);
    
    advanceFloor(player, resolutionText, bossDefeated, card.nextScoutInfo);

  }, [gameState, advanceFloor, updateContracts, generateEvent, generateTreasure]);

  const closeResolution = useCallback(() => {
    setGameState(prev => ({ ...prev, status: 'PLAYING' }));
  }, []);

  const leaveShop = useCallback(() => {
     const newAlert = Math.min(100, gameState.player.securityAlert + 5);
     const player = { ...gameState.player, securityAlert: newAlert };
     advanceFloor(player, "You jack out of the black market node. The transaction signals have slightly increased the local security alert.", false, gameState.pendingNextRoomTypes);
  }, [gameState.player, gameState.pendingNextRoomTypes, advanceFloor]);

  const calculateModuleCost = (module: Module, currentCount: number) => {
      const isLockdown = gameState.player.securityAlert >= 60 && gameState.player.securityAlert < 90;
      const lockdownMultiplier = isLockdown ? 1.25 : 1;
      const stackMultiplier = Math.pow(1.12, currentCount);
      return Math.ceil(module.cost * stackMultiplier * lockdownMultiplier);
  };

  const buyModule = (module: Module) => {
      const currentCount = gameState.player.modules.filter(m => m.id === module.id).length;
      const finalCost = calculateModuleCost(module, currentCount);

      if (gameState.player.credits >= finalCost && currentCount < 5) {
          setGameState(prev => {
              const newModules = [...prev.player.modules, module];
              const newPlayer = { ...prev.player, credits: prev.player.credits - finalCost, modules: newModules };
              if (module.effectId === 'overclock') {
                  newPlayer.power += 3;
                  newPlayer.maxHp -= 10;
                  newPlayer.hp = Math.min(newPlayer.hp, newPlayer.maxHp);
              }
              return { ...prev, player: newPlayer };
          });
      }
  };
  
  const buyRepair = () => {
      const isLockdown = gameState.player.securityAlert >= 60 && gameState.player.securityAlert < 90;
      const costMultiplier = isLockdown ? 1.25 : 1; 
      const finalCost = Math.ceil(41 * costMultiplier); 

      if (gameState.player.credits >= finalCost) {
          setGameState(prev => ({
              ...prev,
              player: {
                  ...prev.player,
                  credits: prev.player.credits - finalCost,
                  hp: Math.min(prev.player.maxHp, prev.player.hp + 30)
              }
          }));
      }
  };

  const restartGame = () => {
    const cards = generateCardsForFloor(1, 0, 0);
    setGameState({
        floor: 1,
        player: { ...INITIAL_STATS, modules: [] },
        currentCards: cards,
        history: [{ id: 'reset', floor: 1, message: 'System Rebooted. New Run Initiated.', type: 'info' }],
        status: 'PLAYING',
        analysisResult: null,
        lastBossFloor: 0
    });
  };

  // --- Keyboard Listener ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState.status === 'RESOLVING') {
        if (e.code === 'Space' || e.key === ' ') {
            e.preventDefault();
            closeResolution();
        }
        return;
      }
      
      if (gameState.status === 'SHOPPING') {
          if (e.code === 'Space' || e.key === ' ') {
              e.preventDefault();
              leaveShop();
          }
          return;
      }
      
      if (gameState.status === 'EVENT_INTERACTION' && gameState.currentEvent) {
          const key = e.key.toLowerCase();
          if (key === 'a' && gameState.currentEvent.choices[0]) handleEventChoice(gameState.currentEvent.choices[0].id);
          if (key === 's' && gameState.currentEvent.choices[1]) handleEventChoice(gameState.currentEvent.choices[1].id);
          if (key === 'd' && gameState.currentEvent.choices[2]) handleEventChoice(gameState.currentEvent.choices[2].id);
          return;
      }

      if (gameState.status === 'PLAYING') {
        const key = e.key.toLowerCase();
        let index = -1;
        if (key === 'a') index = 0;
        else if (key === 's') index = 1;
        else if (key === 'd') index = 2;
        if (index !== -1 && gameState.currentCards[index]) resolveCard(gameState.currentCards[index]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resolveCard, gameState.status, gameState.currentCards, closeResolution, handleEventChoice, gameState.currentEvent, leaveShop]);

  // --- RENDER HELPERS ---
  const isLockdown = gameState.player.securityAlert >= 60 && gameState.player.securityAlert < 90;
  const priceMultiplier = isLockdown ? 1.25 : 1;
  const repairCost = Math.ceil(41 * priceMultiplier);

  const getShopInventory = () => {
      if (!gameState.activeShopType) return AVAILABLE_MODULES;
      return AVAILABLE_MODULES.filter(m => {
          if (gameState.activeShopType === 'HARDWARE') {
              return ['nano_armor', 'overclock', 'guardian'].includes(m.effectId);
          }
          if (gameState.activeShopType === 'SOFTWARE') {
              return ['vampire', 'thorns', 'miner', 'logic_bomb'].includes(m.effectId);
          }
          return true;
      });
  };

  const shopModules = getShopInventory();
  const shopTitle = gameState.activeShopType === 'HARDWARE' ? 'HARDWARE OUTPOST' : 
                    gameState.activeShopType === 'SOFTWARE' ? 'SOFTWARE DEN' : 'BLACK MARKET';
  const shopColor = gameState.activeShopType === 'HARDWARE' ? 'text-cyan-500 border-cyan-500' :
                    gameState.activeShopType === 'SOFTWARE' ? 'text-purple-500 border-purple-500' : 'text-orange-500 border-orange-500';


  return (
    <div className="min-h-screen bg-cyber-black flex flex-col relative">
      <div className="fixed inset-0 pointer-events-none z-0 opacity-20" 
           style={{ backgroundImage: 'linear-gradient(rgba(0, 243, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 243, 255, 0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }} 
      />
      <StatsHeader floor={gameState.floor} player={gameState.player} onPurgeMiner={purgeMiner} />

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 z-10 relative">
        <div className="w-full max-w-6xl flex justify-between items-center mb-4">
             <div className="flex-1"></div>
             <div className="flex items-center space-x-4">
                <button 
                    onClick={handleTacticalAnalysis}
                    disabled={analyzing || gameState.status !== 'PLAYING'}
                    className="flex items-center space-x-2 px-4 py-2 border border-cyber-pink/50 text-cyber-pink bg-black/50 hover:bg-cyber-pink/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-mono text-sm"
                >
                    {analyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                    <span>{analyzing ? 'ANALYZING...' : 'TACTICAL ANALYSIS (AI)'}</span>
                </button>
                <button onClick={() => setShowHelp(true)} className="p-2 border border-cyber-neon/30 text-cyber-neon bg-black/50 hover:bg-cyber-neon/10 rounded-full transition-all">
                    <HelpCircle className="w-5 h-5" />
                </button>
             </div>
        </div>

        {analysisResult && (
            <div className="w-full max-w-6xl mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="border border-cyber-pink bg-cyber-pink/5 p-6 rounded-lg shadow-[0_0_20px_rgba(255,0,255,0.1)]">
                    <div className="flex items-center space-x-2 mb-2 text-cyber-pink border-b border-cyber-pink/30 pb-2">
                        <Terminal className="w-5 h-5" />
                        <span className="font-mono font-bold tracking-widest">AI TACTICAL REPORT</span>
                    </div>
                    <p className="font-mono text-sm sm:text-base leading-relaxed whitespace-pre-line text-gray-200">
                        {analysisResult}
                    </p>
                </div>
            </div>
        )}

        {gameState.status === 'GAME_OVER' ? (
             <div className="flex flex-col items-center justify-center w-full animate-in zoom-in-95">
                <AlertTriangle className="w-24 h-24 text-cyber-red mb-4 animate-pulse" />
                <h1 className="text-6xl font-mono font-bold text-cyber-red mb-2 glitch-text">TERMINATED</h1>
                <p className="text-xl font-mono text-gray-400 mb-8">Floor Reached: {gameState.floor}</p>
                <div className="border border-cyber-red/30 bg-cyber-red/10 p-6 rounded max-w-md text-center mb-8">
                    <p>{gameState.lastResolutionText}</p>
                </div>
                <button 
                    onClick={restartGame}
                    className="px-8 py-3 bg-cyber-red text-black font-bold font-mono text-xl hover:bg-red-400 transition-colors"
                >
                    REBOOT_SYSTEM
                </button>
            </div>
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full max-w-6xl place-items-center">
                {gameState.currentCards.map((card, index) => (
                    <RoomCard 
                        key={card.id} 
                        card={card} 
                        onClick={resolveCard} 
                        disabled={gameState.status !== 'PLAYING'}
                        shortcutKey={index === 0 ? 'A' : index === 1 ? 'S' : index === 2 ? 'D' : undefined} 
                    />
                ))}
            </div>
        )}
      </main>

      <GameLog logs={gameState.history} />

      {/* Resolution Modal */}
      {gameState.status === 'RESOLVING' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-cyber-panel border-2 border-cyan-500 w-full max-w-lg p-8 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.5)] transform scale-100 animate-in zoom-in-95 duration-200">
                  <h2 className="text-2xl font-mono text-cyan-400 mb-4 font-bold uppercase tracking-widest border-b border-cyan-900 pb-2">Cycle Complete</h2>
                  <p className="font-mono text-gray-300 mb-8 leading-relaxed">{gameState.lastResolutionText}</p>
                  <button onClick={closeResolution} className="w-full py-4 bg-cyan-400 text-black font-bold font-mono text-lg tracking-wider hover:bg-cyan-300 transition-colors shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-3">
                      <span>PROCEED TO DEPTH {gameState.floor}</span>
                      <span className="text-xs font-bold border border-black/80 px-1.5 py-0.5 rounded opacity-80">[SPACE]</span>
                  </button>
              </div>
          </div>
      )}

      {/* Event Interaction Modal */}
      {gameState.status === 'EVENT_INTERACTION' && gameState.currentEvent && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
               <div className="bg-cyber-panel border border-cyber-neon w-full max-w-2xl p-8 rounded-xl shadow-[0_0_50px_rgba(0,243,255,0.2)]">
                   <div className="flex items-center gap-3 mb-4 text-cyber-neon border-b border-cyber-neon/30 pb-4">
                       <Flame className="w-8 h-8 animate-pulse" />
                       <h2 className="text-2xl font-mono font-bold tracking-widest uppercase">{gameState.currentEvent.title}</h2>
                   </div>
                   <p className="text-gray-300 font-mono mb-8 leading-relaxed text-lg">{gameState.currentEvent.description}</p>
                   
                   <div className="grid grid-cols-1 gap-4">
                       {gameState.currentEvent.choices.map((choice, index) => (
                           <button 
                               key={choice.id}
                               onClick={() => handleEventChoice(choice.id)}
                               className={`w-full p-4 border-2 rounded bg-black/40 hover:bg-white/5 transition-all text-left group flex justify-between items-center ${choice.style} relative pl-12`}
                           >
                               <div className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-lg opacity-50 group-hover:opacity-100 border border-current rounded w-6 h-6 flex items-center justify-center">
                                    {index === 0 ? 'A' : index === 1 ? 'S' : 'D'}
                               </div>
                               <div>
                                   <div className="font-bold font-mono text-lg group-hover:tracking-wider transition-all">{choice.text}</div>
                                   <div className="text-xs text-gray-500 font-mono mt-1">{choice.description}</div>
                               </div>
                               <div className={`text-xs font-bold border px-2 py-1 rounded uppercase tracking-wider ${choice.style}`}>
                                   {choice.riskText}
                               </div>
                           </button>
                       ))}
                   </div>
               </div>
          </div>
      )}

      {/* TREASURE INTERACTION MODAL - NEW */}
      {gameState.status === 'TREASURE_INTERACTION' && gameState.currentTreasure && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
              <div className="bg-cyber-panel border border-yellow-500 w-full max-w-3xl p-8 rounded-xl shadow-[0_0_50px_rgba(234,179,8,0.2)]">
                  <div className="flex items-center gap-3 mb-6 text-yellow-500 border-b border-yellow-500/30 pb-4">
                      {gameState.currentTreasure.type === TreasureType.DATA_CACHE ? <DatabaseIcon className="w-8 h-8" /> :
                       gameState.currentTreasure.type === TreasureType.CRYPTO_MINER ? <Pickaxe className="w-8 h-8" /> :
                       <ClipboardList className="w-8 h-8" />}
                      <h2 className="text-3xl font-mono font-bold tracking-widest uppercase">
                          {gameState.currentTreasure.type.replace('_', ' ')}
                      </h2>
                  </div>
                  <p className="text-gray-300 font-mono mb-8 leading-relaxed text-lg italic">
                      "{gameState.currentTreasure.flavor}"
                  </p>

                  {/* DATA CACHE UI */}
                  {gameState.currentTreasure.type === TreasureType.DATA_CACHE && gameState.currentTreasure.dataCache && (
                      <div className="space-y-4">
                          {gameState.currentTreasure.dataCache.layer === 1 && (
                              <div className="space-y-4 animate-in fade-in">
                                  <div className="p-4 border border-green-500/50 bg-green-900/10 rounded">
                                      <h4 className="text-green-500 font-bold mb-1">LAYER 1 (SHELL) DECRYPTED</h4>
                                      <p className="text-sm text-gray-400">Contains: 25-35 Crypto</p>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                      <button onClick={() => handleTreasureInteraction('CACHE_L1')} className="p-4 border border-green-500 text-green-500 hover:bg-green-500/10 font-bold">EXTRACT & LEAVE</button>
                                      <button onClick={() => handleTreasureInteraction('CACHE_L2_PAY', {costType: 'HP'})} className="p-4 border border-red-500 text-red-500 hover:bg-red-500/10 font-bold flex flex-col items-center justify-center">
                                          <span>BREACH LAYER 2</span>
                                          <span className="text-xs mt-1">COST: -15 HP</span>
                                      </button>
                                  </div>
                              </div>
                          )}
                          {gameState.currentTreasure.dataCache.layer === 3 && (
                               <div className="space-y-4 animate-in fade-in">
                                  <div className="p-4 border border-purple-500/50 bg-purple-900/10 rounded">
                                      <h4 className="text-purple-500 font-bold mb-1">LAYER 2 (ICE) BREACHED</h4>
                                      <p className="text-sm text-gray-400">Reward: Common Module + 20 Crypto</p>
                                  </div>
                                  <p className="text-center text-gray-400 text-sm">Do you access the CORE?</p>
                                  <div className="grid grid-cols-2 gap-4">
                                      <button onClick={() => handleTreasureInteraction('CACHE_L2_LEAVE')} className="p-4 border border-gray-500 text-gray-400 hover:bg-gray-800 font-bold">TAKE LOOT & LEAVE</button>
                                      {gameState.player.power >= 15 ? (
                                        <button onClick={() => handleTreasureInteraction('CACHE_L3')} className="p-4 border border-yellow-500 text-yellow-500 hover:bg-yellow-500/10 font-bold flex flex-col items-center justify-center animate-pulse">
                                            <span>DECRYPT CORE</span>
                                            <span className="text-xs mt-1">REQ: 15 RAM | COST: -10 HP</span>
                                        </button>
                                      ) : (
                                        <button disabled className="p-4 border border-gray-800 text-gray-600 font-bold flex flex-col items-center justify-center cursor-not-allowed">
                                            <span>CORE LOCKED</span>
                                            <span className="text-xs mt-1">REQ: 15 RAM (Insufficient)</span>
                                        </button>
                                      )}
                                  </div>
                               </div>
                          )}
                      </div>
                  )}

                  {/* DARK CONTRACT UI */}
                  {gameState.currentTreasure.type === TreasureType.DARK_CONTRACT && (
                      <div className="grid grid-cols-1 gap-4">
                          <p className="text-sm text-gray-400 mb-2">Select a contract to sign (Max 2 Active). Cost is paid upfront.</p>
                          {gameState.currentTreasure.contracts?.map(contract => (
                              <div key={contract.id} className="border border-purple-500/50 bg-black/40 p-4 rounded flex justify-between items-center hover:bg-purple-900/10 transition-colors">
                                  <div>
                                      <h4 className="text-purple-400 font-bold">{contract.name}</h4>
                                      <p className="text-xs text-gray-400">{contract.description}</p>
                                      <div className="text-xs text-gray-500 mt-1 flex gap-3">
                                          <span>Cost: {contract.cost}C</span>
                                          <span>Reward: {contract.payoutAmount > 0 ? contract.payoutAmount + 'C' : contract.payoutReward}</span>
                                          <span>Exp: {contract.durationFloors} Flrs</span>
                                      </div>
                                  </div>
                                  <button 
                                    onClick={() => handleTreasureInteraction('SIGN_CONTRACT', contract)}
                                    disabled={gameState.player.credits < contract.cost || gameState.player.activeContracts.length >= 2}
                                    className="px-4 py-2 border border-purple-500 text-purple-500 hover:bg-purple-500 hover:text-black font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                                  >
                                      SIGN
                                  </button>
                              </div>
                          ))}
                          <button onClick={() => handleTreasureInteraction('LEAVE_TREASURE')} className="mt-4 w-full py-3 border border-gray-600 text-gray-400 hover:text-white font-bold">LEAVE EXCHANGE</button>
                      </div>
                  )}

                  {/* CRYPTO MINER UI */}
                  {gameState.currentTreasure.type === TreasureType.CRYPTO_MINER && (
                      <div className="text-center space-y-6">
                          <div className="p-6 border border-emerald-500/30 bg-emerald-900/10 rounded flex flex-col items-center gap-2">
                              <Pickaxe className="w-12 h-12 text-emerald-500" />
                              <h3 className="text-xl text-emerald-400 font-bold">MINING PROTOCOL v9.0</h3>
                              <p className="text-sm text-gray-300">Generates <span className="text-emerald-400">+10 Crypto</span> per room.</p>
                              <p className="text-sm text-red-400">WARNING: Increases Security Alert by <span className="font-bold">+4</span> per floor.</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <button onClick={() => handleTreasureInteraction('LEAVE_TREASURE')} className="p-4 border border-gray-500 text-gray-400 hover:bg-gray-800 font-bold">IGNORE</button>
                              <button onClick={() => handleTreasureInteraction('INSTALL_MINER')} className="p-4 border border-emerald-500 text-emerald-500 hover:bg-emerald-500/10 font-bold">INSTALL PROTOCOL</button>
                          </div>
                      </div>
                  )}

              </div>
          </div>
      )}

      {/* Shopping Modal */}
      {gameState.status === 'SHOPPING' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
               <div className={`bg-cyber-panel border w-full max-w-4xl p-8 rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] ${shopColor}`}>
                  <div className={`flex justify-between items-center mb-6 border-b pb-4 ${shopColor}`}>
                      <div className="flex items-center space-x-3">
                          {gameState.activeShopType === 'HARDWARE' ? <Cpu className="w-8 h-8" /> : 
                           gameState.activeShopType === 'SOFTWARE' ? <Disc className="w-8 h-8" /> : <ShoppingBag className="w-8 h-8" />}
                          <div>
                            <h2 className="text-3xl font-mono font-bold tracking-widest leading-none">{shopTitle}</h2>
                            {isLockdown && <p className="text-xs text-red-500 font-bold mt-1">LOCKDOWN ACTIVE: PRICES +25%</p>}
                          </div>
                      </div>
                      <div className="text-cyber-green font-mono text-xl">CRYPTO: {gameState.player.credits}</div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      <div className="border border-gray-700 bg-black/40 p-4 rounded hover:border-cyber-green transition-colors group">
                          <div className="flex justify-between items-start mb-2">
                              <h3 className="font-mono text-lg font-bold text-gray-300 group-hover:text-cyber-green">Emergency Repairs</h3>
                              <span className={`${isLockdown ? 'text-red-500' : 'text-cyber-green'}`}>{repairCost}C</span>
                          </div>
                          <p className="text-sm text-gray-500 mb-4">Restore 30 HP. Dirty patch job.</p>
                          <button onClick={buyRepair} className="w-full py-2 border border-cyber-green text-cyber-green hover:bg-cyber-green hover:text-black transition-colors font-mono font-bold text-sm">PURCHASE REPAIR</button>
                      </div>
                      {shopModules.map(mod => {
                          const ownedCount = gameState.player.modules.filter(m => m.id === mod.id).length;
                          const isMaxed = ownedCount >= 5;
                          const finalCost = calculateModuleCost(mod, ownedCount);

                          return (
                              <div key={mod.id} className={`border border-gray-700 bg-black/40 p-4 rounded transition-colors group ${isMaxed ? 'opacity-50' : 'hover:border-purple-500'}`}>
                                  <div className="flex justify-between items-start mb-2">
                                      <h3 className={`font-mono text-lg font-bold text-gray-300 ${!isMaxed && 'group-hover:text-purple-400'}`}>{mod.name}</h3>
                                      <span className={`${isLockdown ? 'text-red-500' : 'text-cyber-green'}`}>{finalCost}C</span>
                                  </div>
                                  <p className="text-sm text-gray-500 mb-4">{mod.description}</p>
                                  {isMaxed ? (
                                      <div className="w-full py-2 text-center text-gray-500 font-mono text-sm border border-gray-800 font-bold">MAX LEVEL</div>
                                  ) : (
                                    <button onClick={() => buyModule(mod)} disabled={gameState.player.credits < finalCost} className="w-full py-2 border border-purple-500 text-purple-500 hover:bg-purple-500 hover:text-black disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-purple-500 transition-colors font-mono font-bold text-sm">
                                        {ownedCount > 0 ? `UPGRADE (LVL ${ownedCount + 1})` : 'INSTALL MODULE'}
                                    </button>
                                  )}
                              </div>
                          );
                      })}
                  </div>
                  <button onClick={leaveShop} className="w-full py-4 bg-gray-800 text-white font-bold font-mono tracking-wider hover:bg-gray-700 transition-colors rounded-sm flex items-center justify-center gap-3">
                      <span>DISCONNECT</span>
                      <span className="text-xs font-bold border border-white/30 px-1.5 py-0.5 rounded opacity-50">[SPACE]</span>
                  </button>
               </div>
          </div>
      )}

      {/* HELP MODAL */}
      {showHelp && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-lg p-4 animate-in fade-in duration-200">
              <div className="bg-cyber-panel border border-cyber-neon w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg shadow-2xl relative flex flex-col">
                  <button onClick={() => setShowHelp(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X className="w-6 h-6" /></button>
                  
                  <div className="p-8">
                      <h2 className="text-3xl font-mono font-bold text-cyber-neon mb-2 flex items-center gap-3"><Terminal className="w-8 h-8" /> DATABASE</h2>
                      
                      {/* TABS */}
                      <div className="flex space-x-6 mb-6 border-b border-gray-800">
                          <button 
                              onClick={() => setHelpTab('GUIDE')} 
                              className={`py-3 font-mono font-bold text-sm tracking-wider transition-colors ${helpTab === 'GUIDE' ? 'text-cyber-neon border-b-2 border-cyber-neon' : 'text-gray-500 hover:text-gray-300'}`}
                          >
                              FIELD GUIDE
                          </button>
                          <button 
                              onClick={() => setHelpTab('DATA')} 
                              className={`py-3 font-mono font-bold text-sm tracking-wider transition-colors ${helpTab === 'DATA' ? 'text-cyber-neon border-b-2 border-cyber-neon' : 'text-gray-500 hover:text-gray-300'}`}
                          >
                              SYSTEM INTERNALS
                          </button>
                      </div>

                      {/* CONTENT */}
                      {helpTab === 'GUIDE' ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-mono text-sm leading-relaxed text-gray-300 animate-in fade-in slide-in-from-left-4 duration-300">
                              <div className="space-y-4">
                                  <h3 className="text-cyber-pink font-bold text-lg flex items-center gap-2"><Info className="w-4 h-4" /> CORE SYSTEMS</h3>
                                  <ul className="list-disc pl-4 space-y-2">
                                      <li><strong className="text-white">Goal:</strong> Descend as deep as possible.</li>
                                      <li><strong className="text-white">Scouting:</strong> Icons above cards show future room types.</li>
                                      <li><strong className="text-white">RAM (Power):</strong> Determines kill speed.</li>
                                      <li><strong className="text-white">Firewall:</strong> Reduces damage taken.</li>
                                  </ul>
                              </div>
                              <div className="space-y-4">
                                  <h3 className="text-cyber-yellow font-bold text-lg flex items-center gap-2"><Flame className="w-4 h-4" /> SYSTEM RESPONSES (ALERT)</h3>
                                  <p>The Alert level triggers system-wide responses. <strong className="text-red-500">Drift: +1 Alert every floor.</strong></p>
                                  <ul className="list-disc pl-4 space-y-2">
                                      <li><strong className="text-cyber-green">0-29% STEALTH MODE:</strong> First strike deals 1.7x Damage.</li>
                                      <li><strong className="text-cyber-yellow">30-59% ACTIVE SWEEP:</strong> Standard Protocols | <span className="text-green-400">1.3x Crypto Rewards</span>.</li>
                                      <li><strong className="text-orange-500">60-89% LOCKDOWN:</strong> Prices +25%, Healing -20%.</li>
                                      <li><strong className="text-cyber-red animate-pulse">90-100% KILL SWITCH:</strong> 25% Chance to spawn a HUNTER when acting.</li>
                                  </ul>
                              </div>
                              <div className="space-y-4">
                                  <h3 className="text-cyber-red font-bold text-lg flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> COMBAT LOGIC</h3>
                                  <div className="bg-black/50 p-3 rounded border border-gray-800">
                                      <p className="mb-2">Combat is instant but calculated:</p>
                                      <p className="text-xs text-gray-500 mb-1">1. Rounds Needed = Enemy HP / Player RAM</p>
                                      <p className="text-xs text-gray-500 mb-1">2. Damage Taken = (Rounds - 1) * (Enemy Atk - Firewall)</p>
                                      <p className="text-xs text-gray-500 mb-1 mt-2 text-orange-400">At 100% Alert, enemies deal ~1.6x damage.</p>
                                  </div>
                              </div>
                              <div className="space-y-4">
                                  <h3 className="text-purple-400 font-bold text-lg flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> MODULES</h3>
                                  <p>Purchase passive upgrades. Stack them up to 5 times for exponential power. Different shops sell different modules.</p>
                              </div>
                          </div>
                      ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-mono text-sm leading-relaxed text-gray-300 animate-in fade-in slide-in-from-right-4 duration-300">
                               <div className="space-y-4">
                                    <h3 className="text-cyber-pink font-bold text-lg flex items-center gap-2">ENTITY SCALING</h3>
                                    <div className="bg-black/50 p-4 rounded border border-gray-800 space-y-2">
                                        <div className="flex justify-between border-b border-gray-700 pb-1">
                                            <span>Base Algorithm</span>
                                            <span className="text-cyber-neon">1.035 ^ Floor</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-700 pb-1">
                                            <span>Base HP</span>
                                            <span className="text-cyber-red">24 * Scale</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Base RAM</span>
                                            <span className="text-cyber-pink">12 * Scale</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500">Base stats are pre-multiplied by 1.2x (Hard Mode Protocol).</p>
                                    
                                    <h4 className="text-white font-bold mt-4">Class Multipliers</h4>
                                    <ul className="list-disc pl-4 space-y-1 text-xs">
                                        <li><span className="text-purple-400">ELITE:</span> 1.5x HP & RAM (-13% Alert)</li>
                                        <li><span className="text-red-500">BOSS:</span> 2.5x HP & RAM (-30% Alert)</li>
                                        <li><span className="text-gray-400">STANDARD:</span> 1.0x Stats (-7% Alert)</li>
                                    </ul>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-cyber-yellow font-bold text-lg flex items-center gap-2">ALERT MATH</h3>
                                    <div className="bg-black/50 p-4 rounded border border-gray-800 space-y-2">
                                        <div className="flex justify-between">
                                            <span>Drift (Passive)</span>
                                            <span className="text-red-500">+1% / Floor</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Damage Scale</span>
                                            <span className="text-orange-500">1 + (Alert / 150)</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Reward Scale</span>
                                            <span className="text-green-500">1 + (Alert / 100)</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Active Sweep</span>
                                            <span className="text-green-500">1.3x Crypto (30-60%)</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500">At 100% Alert, enemies deal 1.66x damage.</p>

                                    <h3 className="text-cyber-green font-bold text-lg flex items-center gap-2 mt-6">TREASURE PROTOCOLS</h3>
                                    <div className="bg-black/50 p-4 rounded border border-gray-800 space-y-2">
                                        <div className="flex justify-between border-b border-gray-700 pb-1">
                                            <span>Data Cache</span>
                                            <span className="text-cyber-pink">Push-Your-Luck</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-700 pb-1">
                                            <span>Dark Contract</span>
                                            <span className="text-cyber-yellow">Betting System</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Crypto Miner</span>
                                            <span className="text-cyber-green">Passive Income/Risk</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        <span className="text-white font-bold">Deep Storage:</span> High Risk/Reward node mechanics.
                                    </p>
                                </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
