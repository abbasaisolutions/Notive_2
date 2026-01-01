import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}

export default function Skeleton({ className = '', variant = 'rectangular' }: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-[length:200%_100%]';

  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  return (
    <div
<<<<<<< HEAD
      className={cn(
        "animate-pulse-skeleton bg-cream/5 rounded-lg",
        className
      )}
=======
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={{ animation: 'shimmer 2s infinite' }}
>>>>>>> 9a9c056f33be4adfa1b5521a7d2268f2927d9d5e
    />
  );
}

// Skeleton card for entry previews
export function SkeletonCard() {
  return (
    <div className="bento-box p-8">
      <div className="flex justify-between items-start mb-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton variant="circular" className="h-8 w-8" />
      </div>
      <Skeleton className="h-8 w-3/4 mb-3" />
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-5/6 mb-2" />
      <Skeleton className="h-4 w-4/6 mb-6" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

// Skeleton for stat card
export function SkeletonStat() {
  return (
    <div className="bento-box p-6">
      <Skeleton variant="circular" className="h-10 w-10 mb-3" />
      <Skeleton className="h-8 w-16 mb-2" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
}
