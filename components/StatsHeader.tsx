
import React from 'react';
import { PlayerStats, Module } from '../types';
import { Shield, Zap, Heart, Layers, Bitcoin, AlertTriangle, Cpu, Droplet, Activity, Database, Box, Cross, Eye, MemoryStick, ClipboardList, Pickaxe, Trash2 } from 'lucide-react';

interface StatsHeaderProps {
  floor: number;
  player: PlayerStats;
  onPurgeMiner: () => void;
}

export const StatsHeader: React.FC<StatsHeaderProps> = ({ floor, player, onPurgeMiner }) => {
  // Calculate HP percentage for bar
  const hpPercent = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
  
  // Alert System Logic (DEFCON Phases) - NEW THRESHOLDS
  const getAlertState = (level: number) => {
      if (level < 30) return { 
          phase: 'STEALTH MODE', 
          color: 'text-cyber-green', 
          barColor: 'bg-cyber-green',
          effect: 'Surprise Attack (x1.7 DMG)' 
      };
      if (level < 60) return { 
          phase: 'ACTIVE SWEEP', 
          color: 'text-cyber-yellow', 
          barColor: 'bg-cyber-yellow',
          effect: 'Standard Protocols | 1.3x Crypto' 
      };
      if (level < 90) return { 
          phase: 'LOCKDOWN', 
          color: 'text-orange-500', 
          barColor: 'bg-orange-500',
          effect: 'Prices +25% | Heal -20%' 
      };
      return { 
          phase: 'KILL SWITCH', 
          color: 'text-cyber-red animate-pulse glitch-text', 
          barColor: 'bg-cyber-red animate-pulse',
          effect: 'HUNTER ACTIVE (25% Spawn)' 
      };
  };

  const alertState = getAlertState(player.securityAlert);

  const getModuleIcon = (effectId: string) => {
    switch(effectId) {
        case 'vampire': return <Droplet className="w-4 h-4 text-red-400" />;
        case 'thorns': return <Activity className="w-4 h-4 text-orange-400" />;
        case 'miner': return <Database className="w-4 h-4 text-emerald-400" />;
        case 'nano_armor': return <Box className="w-4 h-4 text-cyan-400" />;
        case 'overclock': return <Zap className="w-4 h-4 text-yellow-400" />;
        case 'guardian': return <Cross className="w-4 h-4 text-white" />;
        case 'logic_bomb': return <Eye className="w-4 h-4 text-purple-400" />;
        default: return <Cpu className="w-4 h-4 text-purple-400" />;
    }
  };

  // Group modules by ID to show stacks
  const moduleGroups = player.modules.reduce((acc, mod) => {
      if (!acc[mod.id]) {
          acc[mod.id] = { ...mod, count: 0 };
      }
      acc[mod.id].count += 1;
      return acc;
  }, {} as Record<string, Module & { count: number }>);

  const uniqueModules: (Module & { count: number })[] = Object.values(moduleGroups);

  const getDynamicDescription = (m: Module & { count: number }) => {
      const c = m.count;
      switch(m.effectId) {
          case 'vampire': return `Recover ${2 * c} HP on kill.`;
          case 'thorns': return `Deal ${3 * c} DMG to attackers.`;
          case 'miner': return `+${Math.round(0.2 * c * 100)}% Crypto gain.`;
          case 'nano_armor': return `${8 * c}% chance to negate DMG.`;
          case 'overclock': return `Overclocked: RAM +${3 * c}, MaxHP -${10 * c}.`;
          case 'logic_bomb': return `${12 * c}% chance to reflect 50% DMG.`;
          case 'guardian': return `Reduces DMG by ${2 * c} flat amount.`;
          default: return m.description;
      }
  };

  return (
    <div className="sticky top-0 z-50 w-full bg-cyber-black/90 border-b border-cyber-neon/30 backdrop-blur-md shadow-[0_0_15px_rgba(0,243,255,0.1)]">
      <div className="max-w-6xl mx-auto p-3 flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
        
        {/* Floor Indicator */}
        <div className="flex items-center space-x-2 text-cyber-neon shrink-0">
          <Layers className="w-5 h-5" />
          <span className="font-mono text-xl font-bold tracking-widest">
            DEPTH:{floor.toString().padStart(3, '0')}
          </span>
        </div>

        {/* Stats Grid */}
        <div className="flex-1 flex flex-wrap items-center justify-end gap-x-6 gap-y-2">
            
            {/* Security Alert Level */}
            <div className="flex items-center space-x-3 bg-black/40 px-3 py-1 rounded border border-gray-800 hover:border-gray-600 transition-colors" title={`Phase: ${alertState.phase} - ${alertState.effect}`}>
                <AlertTriangle className={`w-5 h-5 ${alertState.color}`} />
                <div className="flex flex-col w-32">
                    <div className="flex justify-between items-baseline">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${alertState.color}`}>
                            {alertState.phase}
                        </span>
                        <span className={`text-[10px] ${alertState.color}`}>{player.securityAlert}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mt-0.5">
                        <div 
                            className={`h-full transition-all duration-500 ${alertState.barColor}`}
                            style={{ width: `${player.securityAlert}%` }}
                        />
                    </div>
                    <span className="text-[8px] text-gray-500 font-mono mt-0.5 uppercase">{alertState.effect}</span>
                </div>
            </div>

            {/* Crypto Miner Status */}
            {player.hasCryptoMiner && (
                <div className="group relative flex items-center justify-center p-1.5 bg-emerald-900/20 border border-emerald-500/50 rounded cursor-help">
                    <Pickaxe className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <div className="absolute top-full right-0 mt-3 w-48 bg-cyber-black/95 border border-emerald-500 p-3 shadow-xl backdrop-blur-xl rounded z-[60] hidden group-hover:block">
                        <p className="font-mono font-bold text-xs text-emerald-400 mb-1">CRYPTO MINER ACTIVE</p>
                        <p className="text-[10px] text-gray-400 mb-2">+10 Crypto/Room, +4 Alert/Floor</p>
                        <button 
                            onClick={onPurgeMiner}
                            className="w-full flex items-center justify-center gap-2 px-2 py-1 bg-red-900/30 border border-red-500 text-red-500 text-[10px] font-bold hover:bg-red-500 hover:text-white transition-colors"
                        >
                            <Trash2 className="w-3 h-3" />
                            PURGE (-20 HP)
                        </button>
                    </div>
                </div>
            )}

            {/* Active Contracts */}
            {player.activeContracts.length > 0 && (
                <div className="flex items-center space-x-2 border-r border-gray-700 pr-4 mr-2">
                    {player.activeContracts.map(contract => (
                        <div key={contract.id} className="group relative cursor-help">
                            <ClipboardList className="w-4 h-4 text-purple-400" />
                            <div className="absolute top-full right-0 mt-3 w-56 bg-cyber-black/95 border border-purple-500 p-3 shadow-xl backdrop-blur-xl rounded z-[60] hidden group-hover:block">
                                <p className="font-mono font-bold text-xs text-purple-400 mb-1">{contract.name}</p>
                                <p className="text-[10px] text-gray-300 mb-2">{contract.description}</p>
                                <div className="text-[10px] text-gray-400 flex justify-between">
                                    <span>Progress: {contract.currentValue}/{contract.targetValue}</span>
                                    <span>Expires: {contract.durationFloors} floors</span>
                                </div>
                                <div className="w-full h-1 bg-gray-800 mt-1 rounded-full overflow-hidden">
                                    <div className="h-full bg-purple-500" style={{ width: `${(contract.currentValue / contract.targetValue) * 100}%` }}></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modules (Mini) - Grouped with Stacks */}
            {uniqueModules.length > 0 && (
                <div className="hidden sm:flex items-center space-x-3 border-r border-gray-700 pr-4 mr-2">
                     {uniqueModules.map((m) => (
                         <div key={m.id} className="group relative cursor-help py-1">
                             <div className="relative">
                                {getModuleIcon(m.effectId)}
                                {m.count > 1 && (
                                    <span className="absolute -top-2 -right-2 text-[8px] font-bold bg-cyber-neon text-black px-1 rounded-sm shadow-sm">
                                        x{m.count}
                                    </span>
                                )}
                             </div>
                             
                             {/* Enhanced Tooltip */}
                             <div className="absolute top-full right-0 mt-3 w-52 bg-cyber-black/95 border border-cyber-neon/50 p-3 shadow-xl backdrop-blur-xl rounded-sm z-[60] hidden group-hover:block transition-all animate-in fade-in slide-in-from-top-2">
                                 <div className="flex items-center justify-between mb-1 border-b border-gray-700 pb-1">
                                     <p className="font-mono font-bold text-xs text-cyber-neon uppercase tracking-wider">{m.name} {m.count > 1 && `(Lvl ${m.count})`}</p>
                                 </div>
                                 <p className="font-mono text-[10px] text-gray-300 leading-tight mb-1">{m.description}</p>
                                 <p className="font-mono text-[10px] text-cyber-green leading-tight">Current: {getDynamicDescription(m)}</p>
                             </div>
                         </div>
                     ))}
                </div>
            )}

            {/* Integrity / HP */}
            <div className="flex flex-col items-end w-24 sm:w-32">
                <div className="flex items-center space-x-2 text-cyber-red mb-0.5">
                    <Heart className="w-4 h-4 fill-current" />
                    <span className="font-mono text-sm font-bold">HP</span>
                    <span className="font-mono text-sm">{player.hp}/{player.maxHp}</span>
                </div>
                <div className="w-full h-1.5 bg-cyber-panel border border-cyber-red/30 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-cyber-red transition-all duration-500 ease-out" 
                        style={{ width: `${hpPercent}%` }}
                    />
                </div>
            </div>

            {/* RAM / Power */}
            <div className="flex items-center space-x-2 text-cyber-pink">
                <MemoryStick className="w-5 h-5" />
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-cyber-pink/70">RAM</span>
                    <span className="font-mono font-bold leading-none">{player.power}</span>
                </div>
            </div>

            {/* Firewall / Shield */}
            <div className="flex items-center space-x-2 text-cyber-yellow">
                <Shield className="w-5 h-5" />
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-cyber-yellow/70">FIREWALL</span>
                    <span className="font-mono font-bold leading-none">{player.shield}</span>
                </div>
            </div>

            {/* Credits / Crypto */}
            <div className="flex items-center space-x-2 text-cyber-green">
                <Bitcoin className="w-5 h-5" />
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-cyber-green/70">Crypto</span>
                    <span className="font-mono font-bold leading-none">{player.credits}</span>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};
