import React from 'react';

interface LogoProps {
  className?: string;
}

export function Logo({ className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative w-8 h-8">
        <div className="absolute inset-0 bg-[#22C55E] rounded-lg transform rotate-45"></div>
        <div className="absolute inset-0 bg-[#4ADE80] rounded-lg transform rotate-12 opacity-70"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 border-2 border-white rounded-full"></div>
        </div>
      </div>
      <span className="text-xl font-semibold text-[#1E293B]">
        Ze<span className="text-[#22C55E]">plo</span>
      </span>
    </div>
  );
} 