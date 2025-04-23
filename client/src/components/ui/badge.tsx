import * as React from "react"
import { twMerge } from "tailwind-merge"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-[#22C55E] text-white hover:bg-[#16A34A]",
        secondary: "bg-[#262626] text-white hover:bg-[#404040]",
        destructive: "bg-red-500 text-white hover:bg-red-600",
        outline: "border border-[#404040] text-white",
        success: "bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/20",
        warning: "bg-yellow-500/20 text-yellow-500 border border-yellow-500/20",
        error: "bg-red-500/20 text-red-500 border border-red-500/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={twMerge(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
