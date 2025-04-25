import React from 'react';
import { motion } from 'framer-motion';

interface AnimatedLogoProps {
  className?: string;
}

export function AnimatedLogo({ className = '' }: AnimatedLogoProps) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="relative w-16 h-16 mb-4">
        <motion.div
          className="absolute inset-0 bg-[#22C55E] rounded-2xl"
          animate={{
            rotate: [0, 45],
            scale: [1, 1.1, 1]
          }}
          transition={{
            duration: 3,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "reverse"
          }}
        />
        <motion.div
          className="absolute inset-0 bg-[#4ADE80] rounded-2xl"
          animate={{
            rotate: [0, 12],
            scale: [1, 1.05, 1]
          }}
          transition={{
            duration: 3,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "reverse",
            delay: 0.2
          }}
        />
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{
            scale: [1, 1.2, 1]
          }}
          transition={{
            duration: 2,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "reverse"
          }}
        >
          <div className="w-4 h-4 border-3 border-white rounded-full" />
        </motion.div>
      </div>
      <motion.span
        className="text-3xl font-bold text-[#1E293B]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        Ze<span className="text-[#22C55E]">plo</span>
      </motion.span>
    </div>
  );
} 