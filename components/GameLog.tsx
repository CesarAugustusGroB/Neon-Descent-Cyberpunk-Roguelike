import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface GameLogProps {
  logs: LogEntry[];
}

export const GameLog: React.FC<GameLogProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getTypeStyle = (type: LogEntry['type']) => {
    switch (type) {
      case 'combat': return 'text-cyber-red';
      case 'gain': return 'text-cyber-green';
      case 'danger': return 'text-cyber-pink font-bold';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="w-full h-48 bg-black border-t-2 border-cyber-dark relative overflow-hidden">
        <div className="absolute top-0 left-0 bg-cyber-neon/20 px-2 py-0.5 text-[10px] text-cyber-neon font-mono z-10">
            SYSTEM_LOG
        </div>
        <div className="h-full overflow-y-auto p-4 pt-6 font-mono text-sm space-y-1">
            {logs.length === 0 && <span className="text-gray-600 italic">System initialized. Awaiting input...</span>}
            {logs.map((log) => (
                <div key={log.id} className="flex gap-4 border-b border-gray-900/50 pb-1 mb-1 last:border-0">
                    <span className="text-gray-600 shrink-0 w-16">DEPTH:{log.floor}</span>
                    <span className={`${getTypeStyle(log.type)}`}>
                        <span className="mr-2 opacity-50">{'>'}</span>
                        {log.message}
                    </span>
                </div>
            ))}
            <div ref={bottomRef} />
        </div>
    </div>
  );
};
