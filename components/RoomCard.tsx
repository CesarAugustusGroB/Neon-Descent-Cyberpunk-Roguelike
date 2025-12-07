import React from 'react';
import { RoomCardData, RoomType } from '../types';
import { Skull, Swords, Gem, HelpCircle, Coffee, Ghost, ArrowUpCircle, ShoppingBag } from 'lucide-react';

interface RoomCardProps {
  card: RoomCardData;
  onClick: (card: RoomCardData) => void;
  disabled: boolean;
  shortcutKey?: string;
}

const getTypeColor = (type: RoomType) => {
  switch (type) {
    case RoomType.ENEMY: return 'border-cyber-red text-cyber-red shadow-cyber-red/20';
    case RoomType.BOSS: return 'border-red-700 text-red-600 bg-red-950/20 shadow-red-900/40 animate-pulse-fast';
    case RoomType.ELITE: return 'border-purple-500 text-purple-400 shadow-purple-500/20';
    case RoomType.TREASURE: return 'border-cyber-yellow text-cyber-yellow shadow-cyber-yellow/20';
    case RoomType.REST: return 'border-cyber-green text-cyber-green shadow-cyber-green/20';
    case RoomType.EVENT: return 'border-cyber-neon text-cyber-neon shadow-cyber-neon/20';
    case RoomType.MERCHANT: return 'border-orange-500 text-orange-500 shadow-orange-500/20 bg-orange-950/10';
    default: return 'border-gray-500 text-gray-500';
  }
};

const getTypeIcon = (type: RoomType, size = "w-8 h-8") => {
  switch (type) {
    case RoomType.ENEMY: return <Skull className={size} />;
    case RoomType.BOSS: return <Ghost className={size} />;
    case RoomType.ELITE: return <Swords className={size} />;
    case RoomType.TREASURE: return <Gem className={size} />;
    case RoomType.REST: return <Coffee className={size} />;
    case RoomType.EVENT: return <HelpCircle className={size} />;
    case RoomType.MERCHANT: return <ShoppingBag className={size} />;
    default: return <HelpCircle className={size} />;
  }
};

const getMiniIcon = (type: RoomType) => {
    // Smaller icons for the scouting preview
    return getTypeIcon(type, "w-4 h-4");
}

export const RoomCard: React.FC<RoomCardProps> = ({ card, onClick, disabled, shortcutKey }) => {
  const colorClass = getTypeColor(card.type);

  return (
    <button
      onClick={() => !disabled && onClick(card)}
      disabled={disabled}
      className={`
        relative group flex flex-col items-center justify-between
        w-full max-w-sm h-80 p-6 rounded-xl border-2 bg-cyber-panel/80 backdrop-blur-sm
        transition-all duration-300 ease-out
        ${colorClass}
        ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:scale-105 hover:bg-cyber-panel hover:shadow-[0_0_30px_rgba(0,0,0,0.5)] cursor-pointer'}
      `}
    >
      {/* Scouting Info (Top) */}
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-cyber-black border border-gray-800 px-3 py-1 rounded-full shadow-lg z-10">
        <span className="text-[10px] text-gray-400 uppercase tracking-tighter mr-1">Scan:</span>
        {card.nextScoutInfo.map((type, idx) => (
            <div key={idx} className={`${type === RoomType.BOSS ? 'text-red-500 animate-pulse' : 'text-gray-300'}`}>
                {getMiniIcon(type)}
            </div>
        ))}
      </div>

      {/* Shortcut Key Indicator */}
      {shortcutKey && (
        <div className="absolute top-3 left-3 z-20 flex items-center justify-center w-8 h-8 rounded-md border border-current bg-black/80 font-mono text-lg font-bold shadow-lg backdrop-blur-md opacity-80 group-hover:opacity-100 transition-opacity">
          {shortcutKey}
        </div>
      )}

      {/* Main Icon */}
      <div className="mt-8 mb-4 p-4 rounded-full bg-black/40 border border-current shadow-lg group-hover:shadow-[0_0_15px_currentColor] transition-all duration-300">
        {getTypeIcon(card.type, "w-16 h-16")}
      </div>

      {/* Text Content */}
      <div className="flex flex-col items-center text-center space-y-2">
        <h3 className="text-xl font-mono font-bold tracking-wider uppercase">{card.name}</h3>
        <p className="text-xs font-mono opacity-70 leading-relaxed px-2">
            {card.description}
        </p>
      </div>

      {/* Bottom Decoration */}
      <div className="w-full mt-4 flex justify-between items-center opacity-40 text-[10px] font-mono">
        <span>ID: {card.id.slice(0,4)}</span>
        <span>LVL: {card.difficultyScale.toFixed(1)}</span>
      </div>

      {/* Hover Glow Effect Overlay */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-current to-transparent opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none" />
    </button>
  );
};