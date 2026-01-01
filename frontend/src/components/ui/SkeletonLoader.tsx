'use client';

import { cn } from "@/utils/cn";

interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse-skeleton bg-cream/5 rounded-lg",
        className
      )}
    />
  );
}
