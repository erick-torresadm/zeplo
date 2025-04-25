import React from 'react';
import { twMerge } from 'tailwind-merge';

interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: 'credit' | 'debit';
  date: string;
  icon?: React.ReactNode;
  status?: 'pending' | 'completed' | 'failed';
}

interface TransactionListProps {
  transactions: Transaction[];
  className?: string;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  className
}) => {
  return (
    <div className={twMerge('space-y-4', className)}>
      {transactions.map((transaction) => (
        <div
          key={transaction.id}
          className="flex items-center justify-between p-4 rounded-lg bg-[#171717] border border-[#404040] hover:bg-[#262626] transition-colors"
        >
          <div className="flex items-center space-x-4">
            {transaction.icon && (
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#262626] flex items-center justify-center">
                {transaction.icon}
              </div>
            )}
            
            <div>
              <h4 className="text-sm font-medium text-white">
                {transaction.title}
              </h4>
              <p className="text-xs text-gray-400">
                {new Date(transaction.date).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {transaction.status && (
              <span
                className={twMerge(
                  'px-2 py-1 text-xs rounded-full',
                  transaction.status === 'completed' && 'bg-green-500/20 text-green-500',
                  transaction.status === 'pending' && 'bg-yellow-500/20 text-yellow-500',
                  transaction.status === 'failed' && 'bg-red-500/20 text-red-500'
                )}
              >
                {transaction.status}
              </span>
            )}
            
            <span
              className={twMerge(
                'text-sm font-medium',
                transaction.type === 'credit' ? 'text-green-500' : 'text-red-500'
              )}
            >
              {transaction.type === 'credit' ? '+' : '-'}
              ${Math.abs(transaction.amount).toLocaleString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}; 