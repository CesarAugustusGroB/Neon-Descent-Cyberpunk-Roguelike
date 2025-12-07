import React, { useState, useEffect, useCallback } from 'react';
import { PlayerStats, RoomCardData, RoomType, GameState, LogEntry, Module } from './types';
import { StatsHeader } from './components/StatsHeader';
import { RoomCard } from './components/RoomCard';
import { GameLog } from './components/GameLog';
import { getTacticalAnalysis, generateEventFlavor } from './services/geminiService';
import { Brain, RefreshCw, AlertTriangle, Terminal, ShoppingBag, Plus, X } from 'lucide-react';

// --- Constants & Config ---
const INITIAL_STATS: PlayerStats = {
  hp: 100,
  maxHp: 100,
  power: 10,
  shield: 0,
  credits: 0,
  securityAlert: 10, // Starts at 10%
  modules: []
};

// Available Modules (Prices divided by 3 and rounded up)
const AVAILABLE_MODULES: Module[] = [
    { id: 'm1', name: 'Vampire Kernel', description: 'Recover 3 HP when destroying enemies.', effectId: 'vampire', cost: 50 },
    { id: 'm2', name: 'Thorns Protocol', description: 'Deals 5 DMG to attacker per cycle.', effectId: 'thorns', cost: 67 },
    { id: 'm3', name: 'Crypto Miner', description: '+20% Crypto gain from all sources.', effectId: 'miner', cost: 40 },
    { id: 'm4', name: 'Nano-Armor', description: '+10% chance to Negate all damage.', effectId: 'nano_armor', cost: 84 },
    { id: 'm5', name: 'Overclock', description: '+3 Power, but -10 Max Integrity.', effectId: 'overclock', cost: 60 },
];

const NAMES = {
    [RoomType.ENEMY]: ["Security Drone", "Script Kiddie", "Data Leech", "Firewall Sentinel", "Cyber-Rat"],
    [RoomType.ELITE]: ["Black Ice", "Corp Assassin", "Mech-Enforcer", "Netrunner Phantom"],
    [RoomType.BOSS]: ["Mainframe Core", "Project 2501", "CEO Avatar", "The Architect"],
    [RoomType.TREASURE]: ["Encrypted Cache", "Bitcoin Wallet", "Abandon Server", "Hardware Drop"],
    [RoomType.REST]: ["Safe House", "VPN Tunnel", "Repair Node", "Offline Shelter"],
    [RoomType.EVENT]: ["Glitch Storm", "Rogue AI Contact", "Corrupted Sector", "Data Surge"],
    [RoomType.MERCHANT]: ["Black Market", "Rogue Dealer", "Darknet Node", "Fence"],
};

const DESCRIPTIONS = {
    [RoomType.ENEMY]: "Hostile entity. Combat lowers Alert Level.",
    [RoomType.ELITE]: "High-threat signature. High risk, high reward. Lowers Alert Level.",
    [RoomType.BOSS]: "GATEKEEPER DETECTED. EXTREME DANGER.",
    [RoomType.TREASURE]: "Valuable resources. Risk: Increases Alert Level.",
    [RoomType.REST]: "Network quiet zone. Repairs Integrity. Risk: Increases Alert Level.",
    [RoomType.EVENT]: "Unpredictable anomaly. Risk: Increases Alert Level.",
    [RoomType.MERCHANT]: "Trade Crypto for Upgrades. Risk: Increases Alert Level.",
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

  // --- Helpers ---

  // Helper to generate a random room type based on probabilities & state
  const getRandomRoomType = useCallback((floor: number, alertLevel: number, lastBossFloor: number): RoomType => {
      const floorsSinceLastBoss = floor - lastBossFloor;

      // 1. Dynamic Boss Chance (Accumulating Risk)
      // Only starts checking after floor 30
      if (floorsSinceLastBoss > 30) {
          // Chance increases by 5% per floor over 30, plus alert level influence
          const chance = (floorsSinceLastBoss - 30) * 5 + (alertLevel * 0.5);
          if (Math.random() * 100 < chance) return RoomType.BOSS;
      }

      const rand = Math.random();

      // 2. Early Boss Opportunity (Random Spawn)
      // Small chance to find a boss early if the player wants to fight it
      if (floor > 5 && rand < 0.015) return RoomType.BOSS; // 1.5% chance

      // 3. Standard Probabilities
      if (rand < 0.40) return RoomType.ENEMY;
      if (rand < 0.55) return RoomType.EVENT;
      if (rand < 0.65) return RoomType.TREASURE;
      if (rand < 0.75) return RoomType.REST;
      if (rand < 0.85) return RoomType.MERCHANT; 
      if (rand < 0.95) return RoomType.ELITE;
      return RoomType.ENEMY; // Fallback
  }, []);

  // Generate 3 "next scout" types for a card
  const generateScoutInfo = useCallback((currentFloor: number, alertLevel: number, lastBossFloor: number): RoomType[] => {
    return [
      getRandomRoomType(currentFloor + 1, alertLevel, lastBossFloor),
      getRandomRoomType(currentFloor + 1, alertLevel, lastBossFloor),
      getRandomRoomType(currentFloor + 1, alertLevel, lastBossFloor),
    ];
  }, [getRandomRoomType]);

  const generateCardsForFloor = useCallback((floor: number, alertLevel: number, lastBossFloor: number): RoomCardData[] => {
    return Array.from({ length: 3 }).map((_, i) => {
      const type = getRandomRoomType(floor, alertLevel, lastBossFloor);
      const namesList = NAMES[type];
      const name = namesList[Math.floor(Math.random() * namesList.length)];
      
      return {
        id: `f${floor}-c${i}-${Math.random().toString(36).substring(7)}`,
        type,
        difficultyScale: 1 + (floor * 0.03), // 3% scaling per floor
        name,
        description: DESCRIPTIONS[type],
        nextScoutInfo: generateScoutInfo(floor, alertLevel, lastBossFloor),
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
    const cards = generateCardsForFloor(1, 10, 0);
    setGameState(prev => ({ 
        ...prev, 
        currentCards: cards, 
        history: [{ id: 'init', floor: 1, message: 'System Online. Connection established.', type: 'info' }],
        lastBossFloor: 0
    }));
  }, [generateCardsForFloor]);

  // --- Actions ---

  const handleTacticalAnalysis = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    setAnalysisResult(null);
    
    // Call Gemini Thinking Model
    const advice = await getTacticalAnalysis(gameState.floor, gameState.player, gameState.currentCards);
    
    setAnalysisResult(advice);
    setAnalyzing(false);
  };

  const resolveCard = useCallback(async (card: RoomCardData) => {
    if (gameState.status !== 'PLAYING') return;

    if (card.type === RoomType.MERCHANT) {
        setGameState(prev => ({ ...prev, status: 'SHOPPING' }));
        return;
    }

    let player = { ...gameState.player };
    let logMsg = '';
    let resolutionText = '';
    let logType: LogEntry['type'] = 'info';
    let bossDefeated = false;

    // Module Checks (Counts)
    const vampireCount = player.modules.filter(m => m.effectId === 'vampire').length;
    const thornsCount = player.modules.filter(m => m.effectId === 'thorns').length;
    const minerCount = player.modules.filter(m => m.effectId === 'miner').length;
    const nanoCount = player.modules.filter(m => m.effectId === 'nano_armor').length;

    // Scaling Logic
    const scalingFactor = Math.pow(1.03, gameState.floor); // 3% exponential scaling
    const baseEnemyPower = 10 * scalingFactor;
    const baseEnemyHp = 20 * scalingFactor;

    // --- ALERT LEVEL LOGIC ---
    let alertChange = 0;
    if ([RoomType.ENEMY, RoomType.ELITE, RoomType.BOSS].includes(card.type)) {
        alertChange = -15; // Combat reduces alert
    } else {
        alertChange = 5; // Loitering increases alert
    }
    
    // Apply Alert Change
    player.securityAlert = Math.max(0, Math.min(100, player.securityAlert + alertChange));
    const alertMultiplier = 1 + (player.securityAlert / 100); // 0% to 100% extra damage

    // --- LOGIC BY TYPE ---
    if (card.type === RoomType.ENEMY || card.type === RoomType.ELITE || card.type === RoomType.BOSS) {
      let multiplier = card.type === RoomType.BOSS ? 2.5 : (card.type === RoomType.ELITE ? 1.5 : 1);
      
      const enemyPower = Math.floor(baseEnemyPower * multiplier * alertMultiplier);
      const enemyHp = Math.floor(baseEnemyHp * multiplier);

      // Combat Simulation with Modules
      let effectivePlayerPower = player.power;
      if (thornsCount > 0) effectivePlayerPower += (5 * thornsCount);

      const roundsToKill = Math.ceil(enemyHp / effectivePlayerPower);
      const incomingDmgPerRound = Math.max(0, enemyPower - player.shield);
      
      // Calculate Total Damage
      let totalDamageTaken = 0;
      for(let i=0; i< roundsToKill -1; i++) {
          // Nano Armor: additive chance. 10% * count. Maxes at 50% usually if capped at 5 stacks.
          if (nanoCount > 0 && Math.random() < (0.10 * nanoCount)) {
              // Dodged
          } else {
              totalDamageTaken += incomingDmgPerRound;
          }
      }

      player.hp -= totalDamageTaken;
      
      // Rewards
      const powerGain = card.type === RoomType.BOSS ? 5 : 1;
      player.power += powerGain; // Kill rewards processing power
      
      if (vampireCount > 0) {
          player.hp = Math.min(player.maxHp, player.hp + (3 * vampireCount));
      }

      if (card.type === RoomType.BOSS) {
          bossDefeated = true;
      }

      // Credit Logic
      const baseCredit = 10 * scalingFactor;
      const creditMultiplier = card.type === RoomType.BOSS ? 10 : (card.type === RoomType.ELITE ? 3 : 1);
      let creditGain = Math.floor((baseCredit * creditMultiplier) * (0.8 + Math.random() * 0.4));
      
      if (minerCount > 0) {
          // Additive bonus: +20% per stack
          creditGain = Math.floor(creditGain * (1 + (0.2 * minerCount)));
      }
      
      player.credits += creditGain;

      const alertMsg = alertMultiplier > 1.2 ? ` (Alert High: Enemy DMG +${Math.floor((alertMultiplier-1)*100)}%)` : '';
      logMsg = `Combat: Took ${totalDamageTaken} DMG${alertMsg}. Gained ${creditGain} Crypto.`;
      resolutionText = `You engaged the ${card.name}. The security alert level is at ${player.securityAlert}%. Enemy strikes were amplified by ${Math.floor((alertMultiplier-1)*100)}%. Your firewall held for ${roundsToKill} cycles.`;
      logType = 'combat';

      if (player.hp <= 0) {
        player.hp = 0;
        setGameState(prev => ({ ...prev, player, status: 'GAME_OVER', lastResolutionText: "CRITICAL SYSTEM FAILURE. SIGNAL LOST." }));
        return;
      }
    } 
    else if (card.type === RoomType.TREASURE) {
        // Random upgrade or Credits
        const roll = Math.random();
        if (roll < 0.35) {
            player.power += 3;
            logMsg = "Acquired Optimization Patch: +3 Power";
            resolutionText = "You decrypted the secured cache. Inside was a kernel optimization patch, significantly boosting your processing speed.";
            logType = 'gain';
        } else if (roll < 0.70) {
            player.shield += 2;
            logMsg = "Acquired Security Protocol: +2 Shield";
            resolutionText = "You found an abandoned security suite. Installing it reinforced your firewall layers.";
            logType = 'gain';
        } else {
            // Credits
            const creditGain = Math.floor(75 * scalingFactor);
            player.credits += creditGain;
            logMsg = `Decrypted Wallet: +${creditGain} Crypto`;
            resolutionText = "You found an encrypted wallet on a dead server. Brute-forcing it revealed a significant stash of crypto.";
            logType = 'gain';
        }
    }
    else if (card.type === RoomType.REST) {
        const healAmt = Math.floor(player.maxHp * 0.4);
        player.hp = Math.min(player.maxHp, player.hp + healAmt);
        logMsg = `System Repair: +${healAmt} Integrity. Alert +5.`;
        resolutionText = "You found a quiet node in the network. Rerouting power to repair subroutines restored your hull integrity, but the delay allowed network security to trace you closer.";
        logType = 'gain';
    }
    else if (card.type === RoomType.EVENT) {
        // Risk/Reward
        const roll = Math.random();
        if (roll > 0.3) {
            player.maxHp += 5;
            player.hp += 5;
            logMsg = "Glitch Absorbed: +5 Max Integrity";
            resolutionText = "The anomaly tried to consume you, but your systems adapted. You absorbed its code, expanding your total integrity.";
            logType = 'gain';
        } else {
            const dmg = Math.floor(player.maxHp * 0.1);
            player.hp -= dmg;
            logMsg = `Data Corruption: -${dmg} Integrity`;
            resolutionText = "The event was a trap. Corrupted data surged through your connection, damaging your core systems.";
            logType = 'danger';
        }
    }

    // --- TRANSITION ---
    // Move to next floor
    const nextFloor = gameState.floor + 1;
    
    // Update last boss floor if we just killed one
    const newLastBossFloor = bossDefeated ? gameState.floor : gameState.lastBossFloor;

    const newCardsRaw = card.nextScoutInfo.map((type, i) => {
         const namesList = NAMES[type];
         const name = namesList[Math.floor(Math.random() * namesList.length)];
         return {
            id: `f${nextFloor}-c${i}-${Math.random().toString(36).substring(7)}`,
            type,
            difficultyScale: 1 + (nextFloor * 0.03), // 3% scaling per floor
            name,
            description: DESCRIPTIONS[type],
            nextScoutInfo: generateScoutInfo(nextFloor, player.securityAlert, newLastBossFloor),
         };
    });

    addLog(logMsg, logType);
    if (alertChange > 0) addLog(`Alert Level Increased to ${player.securityAlert}%`, 'alert');
    if (alertChange < 0) addLog(`Alert Level Decreased to ${player.securityAlert}%`, 'gain');
    if (bossDefeated) addLog(`GATEKEEPER NEUTRALIZED. SECURITY PROTOCOLS REBOOTING.`, 'gain');
    
    // Show resolution screen
    setGameState(prev => ({
        ...prev,
        player,
        floor: nextFloor,
        currentCards: newCardsRaw,
        status: 'RESOLVING',
        lastResolutionText: resolutionText,
        analysisResult: null,
        lastBossFloor: newLastBossFloor
    }));
  }, [gameState, generateScoutInfo]);

  const closeResolution = useCallback(() => {
    setGameState(prev => ({ ...prev, status: 'PLAYING' }));
  }, []);

  const leaveShop = useCallback(() => {
     // Advance floor after shop
     const nextFloor = gameState.floor + 1;
     const newCardsRaw = generateScoutInfo(nextFloor, gameState.player.securityAlert, gameState.lastBossFloor).map((type, i) => {
         const namesList = NAMES[type];
         const name = namesList[Math.floor(Math.random() * namesList.length)];
         return {
            id: `f${nextFloor}-c${i}-${Math.random().toString(36).substring(7)}`,
            type,
            difficultyScale: 1 + (nextFloor * 0.03), // 3% scaling per floor
            name,
            description: DESCRIPTIONS[type],
            nextScoutInfo: generateScoutInfo(nextFloor, gameState.player.securityAlert, gameState.lastBossFloor),
         };
    });

    // Alert increases for shopping
    const newAlert = Math.min(100, gameState.player.securityAlert + 5);
    const updatedPlayer = { ...gameState.player, securityAlert: newAlert };

    setGameState(prev => ({
        ...prev,
        player: updatedPlayer,
        floor: nextFloor,
        currentCards: newCardsRaw,
        status: 'RESOLVING',
        lastResolutionText: "You jack out of the black market node. The transaction signals have slightly increased the local security alert.",
        analysisResult: null
    }));
  }, [gameState.floor, gameState.player, generateScoutInfo, gameState.lastBossFloor]);

  const buyModule = (module: Module) => {
      // Check how many we already own
      const currentCount = gameState.player.modules.filter(m => m.id === module.id).length;

      if (gameState.player.credits >= module.cost && currentCount < 5) {
          setGameState(prev => {
              const newModules = [...prev.player.modules, module];
              const newPlayer = { ...prev.player, credits: prev.player.credits - module.cost, modules: newModules };
              
              // Apply immediate effects
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
      const cost = 34; // Rounded from 100/3 or just doubled from 17
      if (gameState.player.credits >= cost) {
          setGameState(prev => ({
              ...prev,
              player: {
                  ...prev.player,
                  credits: prev.player.credits - cost,
                  hp: Math.min(prev.player.maxHp, prev.player.hp + 30)
              }
          }));
      }
  };

  const restartGame = () => {
    const cards = generateCardsForFloor(1, 10, 0);
    setGameState({
        floor: 1,
        player: { ...INITIAL_STATS },
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
      // 1. Handle RESOLVING state shortcuts
      if (gameState.status === 'RESOLVING') {
        if (e.code === 'Space' || e.key === ' ') {
            e.preventDefault();
            closeResolution();
        }
        return;
      }

      // 2. Handle PLAYING state shortcuts
      if (gameState.status === 'PLAYING') {
        const key = e.key.toLowerCase();
        let index = -1;
        
        if (key === 'a') index = 0;
        else if (key === 's') index = 1;
        else if (key === 'd') index = 2;
        
        if (index !== -1 && gameState.currentCards[index]) {
            resolveCard(gameState.currentCards[index]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resolveCard, gameState.status, gameState.currentCards, closeResolution]);

  // --- RENDER ---

  if (gameState.status === 'GAME_OVER') {
    return (
        <div className="min-h-screen bg-cyber-black text-cyber-neon flex flex-col items-center justify-center p-4">
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
    );
  }

  return (
    <div className="min-h-screen bg-cyber-black flex flex-col relative">
      {/* Background Grids/Effects */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-20" 
           style={{ backgroundImage: 'linear-gradient(rgba(0, 243, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 243, 255, 0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }} 
      />
      
      <StatsHeader floor={gameState.floor} player={gameState.player} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 z-10 relative">
        
        {/* Tactical Analysis Button */}
        <div className="w-full max-w-6xl flex justify-end mb-4">
            <button 
                onClick={handleTacticalAnalysis}
                disabled={analyzing || gameState.status !== 'PLAYING'}
                className="flex items-center space-x-2 px-4 py-2 border border-cyber-pink/50 text-cyber-pink bg-black/50 hover:bg-cyber-pink/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-mono text-sm"
            >
                {analyzing ? (
                   <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                   <Brain className="w-4 h-4" />
                )}
                <span>{analyzing ? 'ANALYZING...' : 'TACTICAL ANALYSIS (AI)'}</span>
            </button>
        </div>

        {/* Analysis Result Box */}
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

        {/* Cards Grid */}
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
      </main>

      {/* History Log */}
      <GameLog logs={gameState.history} />

      {/* Resolution Modal */}
      {gameState.status === 'RESOLVING' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-cyber-panel border-2 border-cyan-500 w-full max-w-lg p-8 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.5)] transform scale-100 animate-in zoom-in-95 duration-200">
                  <h2 className="text-2xl font-mono text-cyan-400 mb-4 font-bold uppercase tracking-widest border-b border-cyan-900 pb-2">
                      Cycle Complete
                  </h2>
                  <p className="font-mono text-gray-300 mb-8 leading-relaxed">
                      {gameState.lastResolutionText}
                  </p>
                  <button 
                    onClick={closeResolution}
                    className="w-full py-4 bg-cyan-400 text-black font-bold font-mono text-lg tracking-wider hover:bg-cyan-300 transition-colors shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-3"
                  >
                      <span>PROCEED TO DEPTH {gameState.floor}</span>
                      <span className="text-xs font-bold border border-black/80 px-1.5 py-0.5 rounded opacity-80">[SPACE]</span>
                  </button>
              </div>
          </div>
      )}

      {/* Shopping Modal */}
      {gameState.status === 'SHOPPING' && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
               <div className="bg-cyber-panel border border-orange-500 w-full max-w-4xl p-8 rounded-xl shadow-[0_0_50px_rgba(255,165,0,0.2)]">
                  <div className="flex justify-between items-center mb-6 border-b border-orange-500/30 pb-4">
                      <div className="flex items-center space-x-3 text-orange-500">
                          <ShoppingBag className="w-8 h-8" />
                          <h2 className="text-3xl font-mono font-bold tracking-widest">BLACK MARKET</h2>
                      </div>
                      <div className="text-cyber-green font-mono text-xl">
                          CRYPTO: {gameState.player.credits}
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      {/* Repairs */}
                      <div className="border border-gray-700 bg-black/40 p-4 rounded hover:border-cyber-green transition-colors group">
                          <div className="flex justify-between items-start mb-2">
                              <h3 className="font-mono text-lg font-bold text-gray-300 group-hover:text-cyber-green">Emergency Repairs</h3>
                              <span className="text-cyber-green">34C</span>
                          </div>
                          <p className="text-sm text-gray-500 mb-4">Restore 30 HP. Dirty patch job.</p>
                          <button 
                             onClick={buyRepair}
                             className="w-full py-2 border border-cyber-green text-cyber-green hover:bg-cyber-green hover:text-black transition-colors font-mono font-bold text-sm"
                          >
                              PURCHASE REPAIR
                          </button>
                      </div>

                      {/* Modules */}
                      {AVAILABLE_MODULES.map(mod => {
                          const ownedCount = gameState.player.modules.filter(m => m.id === mod.id).length;
                          const isMaxed = ownedCount >= 5;
                          
                          return (
                              <div key={mod.id} className={`border border-gray-700 bg-black/40 p-4 rounded transition-colors group ${isMaxed ? 'opacity-50' : 'hover:border-purple-500'}`}>
                                  <div className="flex justify-between items-start mb-2">
                                      <h3 className={`font-mono text-lg font-bold text-gray-300 ${!isMaxed && 'group-hover:text-purple-400'}`}>{mod.name}</h3>
                                      <span className="text-cyber-green">{mod.cost}C</span>
                                  </div>
                                  <p className="text-sm text-gray-500 mb-4">{mod.description}</p>
                                  {isMaxed ? (
                                      <div className="w-full py-2 text-center text-gray-500 font-mono text-sm border border-gray-800 font-bold">MAX LEVEL</div>
                                  ) : (
                                    <button 
                                        onClick={() => buyModule(mod)}
                                        disabled={gameState.player.credits < mod.cost}
                                        className="w-full py-2 border border-purple-500 text-purple-500 hover:bg-purple-500 hover:text-black disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-purple-500 transition-colors font-mono font-bold text-sm"
                                    >
                                        {ownedCount > 0 ? `UPGRADE (LVL ${ownedCount + 1})` : 'INSTALL MODULE'}
                                    </button>
                                  )}
                              </div>
                          );
                      })}
                  </div>

                  <button 
                    onClick={leaveShop}
                    className="w-full py-4 bg-gray-800 text-white font-bold font-mono tracking-wider hover:bg-gray-700 transition-colors rounded-sm"
                  >
                      DISCONNECT
                  </button>
               </div>
          </div>
      )}
    </div>
  );
}