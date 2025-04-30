"use client";

import { useState, useCallback } from "react";
import { toast as sonnerToast } from "sonner";

interface ToastOptions {
  title?: string;
  description?: string;
  duration?: number;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top-center" | "bottom-center";
  variant?: "default" | "destructive";
}

export function useToast() {
  const toast = useCallback(
    ({ title, description, variant, ...props }: ToastOptions) => {
      if (variant === "destructive") {
        return sonnerToast.error(title, {
          description,
          ...props,
        });
      }

      return sonnerToast(title, {
        description,
        ...props,
      });
    },
    []
  );

  return { toast };
} 