/**
 * DashboardCalmerLayout — Pass-through component
 * 
 * Forwards all props (including showCalmerLayout) to DashboardNotebookView.
 * DashboardNotebookView handles conditional rendering of Tier 1 vs full dashboard.
 */

'use client';

import { lazy, Suspense } from 'react';
import { Spinner } from '@/components/ui';
import type { DashboardNotebookViewProps } from './DashboardNotebookView';

const DashboardNotebookView = lazy(() => import('./DashboardNotebookView'));

export default function DashboardCalmerLayout(props: DashboardNotebookViewProps) {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Spinner /></div>}>
      <DashboardNotebookView {...props} />
    </Suspense>
  );
}

