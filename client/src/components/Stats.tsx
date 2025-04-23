import React from 'react';
import { twMerge } from 'tailwind-merge';

interface StatsProps {
  label: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
  };
  icon?: React.ReactNode;
  className?: string;
}

export const Stats: React.FC<StatsProps> = ({
  label,
  value,
  change,
  icon,
  className
}) => {
  return (
    <div className={twMerge('p-4 rounded-lg bg-[#171717] border border-[#404040]', className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-400">{label}</span>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>
      
      <div className="mt-2 flex items-baseline">
        <div className="text-2xl font-semibold text-white">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        
        {change && (
          <span
            className={twMerge(
              'ml-2 text-sm font-medium',
              change.type === 'increase' ? 'text-green-500' : 'text-red-500'
            )}
          >
            {change.type === 'increase' ? '+' : '-'}
            {Math.abs(change.value)}%
          </span>
        )}
      </div>
    </div>
  );
};

export const StatsGrid: React.FC<{
  children: React.ReactNode;
  columns?: number;
  className?: string;
}> = ({ children, columns = 3, className }) => {
  return (
    <div 
      className={twMerge(
        'grid gap-4',
        columns === 2 && 'grid-cols-1 sm:grid-cols-2',
        columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        columns === 4 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
        className
      )}
    >
      {children}
    </div>
  );
}; 