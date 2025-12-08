
import React, { useState, useEffect, useCallback } from 'react';
import { PlayerStats, RoomCardData, RoomType, GameState, LogEntry, Module, EventChoice, ShopType } from './types';
import { StatsHeader } from './components/StatsHeader';
import { RoomCard } from './components/RoomCard';
import { GameLog } from './components/GameLog';
import { getTacticalAnalysis } from './services/geminiService';
import { Brain, RefreshCw, AlertTriangle, Terminal, ShoppingBag, X, HelpCircle, Keyboard, Info, Flame, MousePointerClick, Cpu, Disc, Database as DatabaseIcon, Shield, Zap } from 'lucide-react';

// --- Constants & Config ---
const INITIAL_STATS: PlayerStats = {
  hp: 100,
  maxHp: 100,
  power: 10,
  shield: 0,
  credits: 0,
  securityAlert: 0, // Starts at 0%
  modules: []
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
    [RoomType.TREASURE]: ["Encrypted Cache", "Bitcoin Wallet", "Abandon Server", "Hardware Drop"],
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
          if (Math.random() < 0.3) {
              name = "Deep Storage Server";
              description = "High value data. Requires heavy brute force. Risk: Massive Alert Increase.";
              alertPenalty = 20;
          } else {
              description = "Valuable resources. Risk: Increases Alert Level.";
              alertPenalty = 5;
          }
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

  const advanceFloor = useCallback((player: PlayerStats, resolutionText: string, bossDefeated: boolean = false, nextRoomTypes?: RoomType[]) => {
      const nextFloor = gameState.floor + 1;
      const newLastBossFloor = bossDefeated ? gameState.floor : gameState.lastBossFloor;
      
      // REBALANCE: Passive drift reduced to +1 per floor
      const newAlert = Math.min(100, player.securityAlert + 1);
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
  }, [gameState.floor, gameState.lastBossFloor, generateCardsForFloor]);

  // --- Event Handling Logic ---

  const generateEvent = (): { title: string, description: string, choices: EventChoice[] } => {
      const scenarios = [
          {
              title: "Rogue AI Signal",
              description: "You intercept a fragmented signal from a rogue AI. It offers power in exchange for exposing your location.",
              choices: [
                  { id: 'accept_power', text: 'Merge Protocols', description: '+2 RAM, +15 Alert', riskText: 'High Alert', style: 'text-cyber-pink border-cyber-pink' },
                  { id: 'mask_signal', text: 'Mask Signal', description: '-15 Alert, -75 Crypto', riskText: 'Cost: Crypto', style: 'text-cyber-green border-cyber-green' },
                  { id: 'ignore', text: 'Sever Connection', description: 'No Effect', riskText: 'Safe', style: 'text-gray-400 border-gray-400' }
              ]
          },
          {
              title: "Corrupted Data Bank",
              description: "A massive, unguarded server. It's glitching heavily. You could try to siphon funds or purge the corruption to lower your signature.",
              choices: [
                  { id: 'siphon', text: 'Siphon Funds', description: 'Gain High Crypto, +15 Alert', riskText: 'Greedy', style: 'text-cyber-yellow border-cyber-yellow' },
                  { id: 'purge', text: 'Purge Corruption', description: '-20 Alert, -3 RAM (Burnout)', riskText: 'Tactical', style: 'text-cyber-neon border-cyber-neon' },
                  { id: 'leave', text: 'Leave', description: 'No Effect', riskText: 'Safe', style: 'text-gray-400 border-gray-400' }
              ]
          },
          {
              title: "Security Checkpoint",
              description: "You stumbled into a dormant security hub. Systems are waking up.",
              choices: [
                  { id: 'smash', text: 'Smash Console', description: '-15 Alert, -10 HP (Sparks)', riskText: 'Aggressive', style: 'text-cyber-red border-cyber-red' },
                  { id: 'hack', text: 'Inject Trojan', description: '+15 Alert, +1 Module (Random)', riskText: 'High Risk', style: 'text-purple-400 border-purple-400' },
                  { id: 'stealth', text: 'Stealth Bypass', description: 'No Effect', riskText: 'Cautious', style: 'text-gray-400 border-gray-400' }
              ]
          }
      ];
      return scenarios[Math.floor(Math.random() * scenarios.length)];
  };

  const handleEventChoice = useCallback((choiceId: string) => {
      let player = { ...gameState.player };
      let logMsg = '';
      let resolutionText = '';
      let alertChange = 0;

      // Event Logic Switch
      switch (choiceId) {
          case 'accept_power':
              player.power += 2;
              alertChange = 15;
              logMsg = "Merged with Rogue AI: +2 RAM, +15 Alert";
              resolutionText = "You accepted the raw data stream. Your processing power surged, but the massive signal spike alerted every subsystem in the sector.";
              break;
          case 'mask_signal':
              player.credits = Math.max(0, player.credits - 75);
              alertChange = -15;
              logMsg = "Signal Masked: -15 Alert, -75 Crypto";
              resolutionText = "You spent heavy resources to scramble your digital footprint, confusing local scanners.";
              break;
          case 'siphon':
              const gain = 100 * (1 + (gameState.floor * 0.1));
              player.credits += Math.floor(gain);
              alertChange = 15;
              logMsg = `Siphoned Funds: +${Math.floor(gain)} Crypto, +15 Alert`;
              resolutionText = "Greed is good. You drained the accounts, but the theft didn't go unnoticed.";
              break;
          case 'purge':
              player.power = Math.max(1, player.power - 3);
              alertChange = -20;
              logMsg = "System Purge: -20 Alert, -3 RAM";
              resolutionText = "You actively hunted down and deleted your own logs from the corrupted server, frying some of your circuits in the process.";
              break;
          case 'smash':
              player.hp = Math.max(1, player.hp - 10);
              alertChange = -15;
              logMsg = "Console Destroyed: -15 Alert, -10 Integrity";
              resolutionText = "Subtlety is overrated. You smashed the surveillance hub before it could broadcast, taking some feedback damage.";
              break;
          case 'hack':
              alertChange = 15;
              // Random module chance
              const mod = AVAILABLE_MODULES[Math.floor(Math.random() * AVAILABLE_MODULES.length)];
              // Ensure we create a new array to avoid mutating the initial stats or shared references
              player.modules = [...player.modules, mod];
              if (mod.effectId === 'overclock') { player.power+=3; player.maxHp-=10; } // Instant effect check
              logMsg = `Trojan Installed: Acquired ${mod.name}, +15 Alert`;
              resolutionText = `You risked detection to inject a worm. It returned with a payload: ${mod.name}.`;
              break;
          case 'ignore':
          case 'leave':
          case 'stealth':
              logMsg = "Event Bypassed.";
              resolutionText = "You chose not to interact with the anomaly, slipping away unseen.";
              break;
      }

      // Apply Alert
      player.securityAlert = Math.max(0, Math.min(100, player.securityAlert + alertChange));

      addLog(logMsg, alertChange > 0 ? 'danger' : 'gain');
      // Pass the pending next room types from state to maintain path
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
        // Store the next path (from the original card) in pendingNextRoomTypes
        // Also set active shop type
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

    // 3. Standard Resolution (Combat/Treasure/Rest)
    let logMsg = '';
    let resolutionText = '';
    let logType: LogEntry['type'] = 'info';
    let bossDefeated = false;

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
    
    // Alert Multipliers (REBALANCE: Reduced damage scaling, nerfed reward scaling)
    const alertMultiplier = 1 + (player.securityAlert / 150); // Damage +66% at 100% alert
    const rewardMultiplier = 1 + (player.securityAlert / 100); // Reward max 2x at 100% alert

    // Logic Switch
    if (card.type === RoomType.ENEMY || card.type === RoomType.ELITE || card.type === RoomType.BOSS) {
      // Combat Logic
      let multiplier = card.type === RoomType.BOSS ? 2.5 : (card.type === RoomType.ELITE ? 1.5 : 1);
      // Hard mode: Enemy base stats buffed by 1.2x
      const enemyPower = Math.floor(baseEnemyPower * 1.2 * multiplier * alertMultiplier);
      const enemyHp = Math.floor(baseEnemyHp * 1.2 * multiplier);

      // NERF: Thorns now gives +3 instead of +5
      let effectivePlayerPower = player.power + (3 * thornsCount);
      
      // --- ALERT PHASE: STEALTH (0-29%) ---
      // Benefit: First Attack x1.7 Damage
      let firstHit = effectivePlayerPower;
      if (player.securityAlert < 30) {
          firstHit = Math.floor(effectivePlayerPower * 1.7); 
      }

      // Calculate Rounds
      let remainingEnemyHp = enemyHp - firstHit;
      let roundsToKill = 1;
      if (remainingEnemyHp > 0) {
          roundsToKill += Math.ceil(remainingEnemyHp / effectivePlayerPower);
      }

      // Guardian Angel Flat Reduction (NERF: -2 instead of -5)
      const flatReduction = 2 * guardianCount;
      let incomingDmgPerRound = Math.max(0, enemyPower - player.shield - flatReduction);
      
      let totalDamageTaken = 0;
      
      // Player hits first, so roundsToKill - 1 hits taken
      for(let i=0; i< roundsToKill -1; i++) {
          // Nano Armor check (NERF: 8% instead of 10%)
          if (!(nanoCount > 0 && Math.random() < (0.08 * nanoCount))) {
              // Logic Bomb Check (Reflect Damage) (NERF: 12% instead of 15%)
              if (logicBombCount > 0 && Math.random() < (0.12 * logicBombCount)) {
                  // Logic Bomb mitigation for simulation
              } else {
                  totalDamageTaken += incomingDmgPerRound;
              }
          }
      }

      player.hp -= totalDamageTaken;
      
      const powerGain = card.type === RoomType.BOSS ? 5 : 1;
      player.power += powerGain;
      // NERF: Vampire now heals 2 instead of 3
      if (vampireCount > 0) player.hp = Math.min(player.maxHp, player.hp + (2 * vampireCount));
      if (card.type === RoomType.BOSS) bossDefeated = true;

      // Crypto
      // REBALANCE: Reduced base credit gain
      const baseCredit = 6 * scalingFactor;
      const creditMultiplier = card.type === RoomType.BOSS ? 10 : (card.type === RoomType.ELITE ? 3 : 1);
      
      // --- ALERT PHASE: ACTIVE SWEEP (30-59%) ---
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
    } 
    else if (card.type === RoomType.TREASURE) {
        // --- ALERT PHASE: ACTIVE SWEEP (30-59%) ---
        const isActiveSweep = player.securityAlert >= 30 && player.securityAlert < 60;
        const activeSweepBonus = isActiveSweep ? 1.3 : 1;

        if (card.alertPenalty && card.alertPenalty > 15) {
            // High Risk Treasure
            const baseGain = 150 * scalingFactor;
            const creditGain = Math.floor(baseGain * rewardMultiplier * activeSweepBonus);
            player.credits += creditGain;
            player.modules.push(AVAILABLE_MODULES[Math.floor(Math.random()*AVAILABLE_MODULES.length)]);
            logMsg = `Deep Storage Cracked: +${creditGain} Crypto${isActiveSweep ? ' (Active Sweep Bonus)' : ''}, +Random Module`;
            resolutionText = "You brute-forced a deep storage server. The massive data breach triggered a network-wide alert, but the payout was legendary.";
        } else {
             // Standard Treasure
             const roll = Math.random();
             if (roll < 0.35) {
                 player.power += 3;
                 logMsg = "Acquired Optimization Patch: +3 RAM";
                 resolutionText = "You decrypted the secured cache. Inside was a kernel optimization patch.";
             } else if (roll < 0.70) {
                 player.shield += 2;
                 logMsg = "Acquired Security Protocol: +2 Firewall";
                 resolutionText = "You found an abandoned security suite. Installing it reinforced your firewall.";
             } else {
                 const baseGain = 75 * scalingFactor;
                 const creditGain = Math.floor(baseGain * rewardMultiplier * activeSweepBonus);
                 player.credits += creditGain;
                 logMsg = `Decrypted Wallet: +${creditGain} Crypto${isActiveSweep ? ' (Active Sweep Bonus)' : ''}`;
                 resolutionText = `You found an encrypted wallet. Brute-forcing it revealed a stash of crypto.`;
             }
        }
        logType = 'gain';
    }
    else if (card.type === RoomType.REST) {
        // --- ALERT PHASE: LOCKDOWN (60-89%) ---
        const isLockdown = player.securityAlert >= 60 && player.securityAlert < 90;
        const lockdownMod = isLockdown ? 0.8 : 1; // 20% penalty (0.8x multiplier)

        // Check for Deep Reboot
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
    
    // Pass the actual scout info from the card to determine the next path
    advanceFloor(player, resolutionText, bossDefeated, card.nextScoutInfo);

  }, [gameState, advanceFloor]);

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
      // Price increases by 12% per stack (compounding)
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
      
      // Shop Shortcut
      if (gameState.status === 'SHOPPING') {
          if (e.code === 'Space' || e.key === ' ') {
              e.preventDefault();
              leaveShop();
          }
          return;
      }
      
      // Event Interaction Shortcuts: A, S, D
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
  const priceMultiplier = isLockdown ? 1.25 : 1; // 25% price increase
  const repairCost = Math.ceil(41 * priceMultiplier); // Base cost 41

  // Shop Inventory Logic
  const getShopInventory = () => {
      if (!gameState.activeShopType) return AVAILABLE_MODULES;
      
      return AVAILABLE_MODULES.filter(m => {
          if (gameState.activeShopType === 'HARDWARE') {
              return ['nano_armor', 'overclock', 'guardian'].includes(m.effectId);
          }
          if (gameState.activeShopType === 'SOFTWARE') {
              return ['vampire', 'thorns', 'miner', 'logic_bomb'].includes(m.effectId);
          }
          return true; // General/Black Market has everything
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
      <StatsHeader floor={gameState.floor} player={gameState.player} />

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
                                            <span>RAM Patch (+3)</span>
                                            <span className="text-cyber-pink">35%</span>
                                        </div>
                                        <div className="flex justify-between border-b border-gray-700 pb-1">
                                            <span>Firewall Suite (+2)</span>
                                            <span className="text-cyber-yellow">35%</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Crypto Cache</span>
                                            <span className="text-cyber-green">30%</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        <span className="text-white font-bold">Deep Storage:</span> Guaranteed High Crypto + Random Module. (High Alert Cost)
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
