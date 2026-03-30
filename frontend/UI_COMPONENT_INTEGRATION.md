# UI Component Integration Guide

## Overview

This guide covers the newly created reusable UI components that standardize loading states, error feedback, empty states, and confirmation dialogs across the app.

## Components Created

### 1. Spinner (`src/components/ui/spinner.tsx`)

Standardized loading indicator replacing inline custom spinners.

**Sizes**: `sm` (16px) | `md` (24px) | `lg` (32px)  
**Variants**: `primary` (blue) | `accent` (sage) | `white`

**Usage Examples**:

```tsx
import { Spinner, LoadingButton } from '@/components/ui';

// Standalone spinner
<Spinner size="md" variant="primary" />

// In a loading state
{isProcessing ? (
  <div className="flex items-center gap-2">
    <Spinner size="sm" variant="white" />
    Processing...
  </div>
) : null}

// Loading button helper
<LoadingButton loading={isLoading} onClick={handleSave}>
  Save
</LoadingButton>
```

**Integration Status**: ✅  
- FloatingVoiceButton: Updated to use Spinner in processing state

**Files to Update**:
- Any component with `border-2 border-white border-t-transparent rounded-full animate-spin` → Replace with `<Spinner />`

---

### 2. ErrorState (`src/components/ui/error-state.tsx`)

Reusable component for displaying operation failures with optional retry action.

**Variants**: 
- `compact` (inline, e.g., in cards) 
- `full-page` (centered, e.g., for 404-style errors)

**Usage Examples**:

```tsx
import { ErrorState } from '@/components/ui';

// Compact variant (default)
<ErrorState
  title="Failed to load"
  message="Please check your connection and try again"
  action={{
    label: "Retry",
    onClick: () => refetch(),
  }}
/>

// Full-page variant for major failures
<ErrorState
  variant="full-page"
  title="Something went wrong"
  message="We couldn't process your request. Try again in a moment."
  action={{
    label: "Go Back",
    onClick: () => navigate(-1),
  }}
/>
```

**Integration Locations** (from Roadmap):
- Insights page: Failed chart loads
- Timeline: Failed data loads
- Import: Import failures
- Portfolio: Failure to load overview

**Example Integration**:

```tsx
if (error) {
  return (
    <ErrorState
      title="Failed to load insights"
      message={error}
      action={{
        label: "Retry",
        onClick: () => refetch(),
        loading: isRetrying,
      }}
    />
  );
}
```

---

### 3. EmptyState (`src/components/ui/empty-state.tsx`)

Friendly display for blank states in lists, feeds, galleries.

**Configuration**:
- Icon (optional, defaults to generic bookmark icon)
- Title & subtitle text
- Optional action (link or button)

**Usage Examples**:

```tsx
import { EmptyState } from '@/components/ui';

// With action link
<EmptyState
  icon="📝"  // or JSX element
  title="No entries yet"
  subtitle="Start writing to build your story."
  action={{
    label: "Write your first entry",
    href: "/entry/new",
  }}
/>

// With action button
<EmptyState
  title="No results"
  subtitle="Try adjusting your search."
  action={{
    label: "Clear filters",
    onClick: () => resetFilters(),
  }}
/>
```

**Note**: Surface.tsx has a simpler EmptyState used in chat, chapters, admin. Use the new version in ui/empty-state.tsx for more flexibility.

**Integration Locations** (from Roadmap):
- Dashboard: Empty portfolio
- Timeline: No entries matching filters
- Chat: New conversation (handled)
- Import: Import complete
- Chapters: No groups yet

---

### 4. ConfirmDialog (`src/components/ui/confirm-dialog.tsx`)

Modal dialog for confirming destructive actions.

**Props**:
- `open`: boolean (control visibility)
- `title`: what action to confirm
- `description`: optional details
- `isDangerous`: boolean (red button for dangerous actions)
- `isLoading`: show spinner while processing
- `onConfirm`: async/sync callback
- `onCancel`: close callback

**Usage Examples**:

```tsx
import { ConfirmDialog } from '@/components/ui';

const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
const [deleting, setDeleting] = useState(false);

const handleDelete = async () => {
  setDeleting(true);
  try {
    await deleteEntry(entryId);
    setDeleteDialogOpen(false);
    toast.success("Entry deleted");
  } finally {
    setDeleting(false);
  }
};

return (
  <>
    <button onClick={() => setDeleteDialogOpen(true)}>
      Delete
    </button>
    
    <ConfirmDialog
      open={deleteDialogOpen}
      title="Delete entry?"
      description="This action cannot be undone."
      actionLabel="Delete"
      isDangerous={true}
      isLoading={deleting}
      onConfirm={handleDelete}
      onCancel={() => setDeleteDialogOpen(false)}
    />
  </>
);
```

**Integration Locations** (from Roadmap):
- Entry delete flows
- Portfolio: Clear all evidence
- Admin: User actions
- Account: Delete account confirmation

---

## Integration Roadmap

### Phase 1: Foundation ✅ COMPLETED
- [x] Spinner component created
- [x] ErrorState component created
- [x] EmptyState component created
- [x] ConfirmDialog component created
- [x] Spinner integrated into FloatingVoiceButton
- [x] All TypeScript compilation passing

### Phase 2: Confirmation Dialogs (Next)
- [ ] Add ConfirmDialog to entry delete button
- [ ] Add ConfirmDialog to portfolio "clear evidence" button
- [ ] Add ConfirmDialog to account deletion
- [ ] Add ConfirmDialog to admin user actions

### Phase 3: Loading States
- [ ] Replace inline spinners with Spinner component in:
  - Insights charts (if any)
  - Timeline load indicators
  - Import progress

### Phase 4: Error Feedback
- [ ] Add ErrorState to:
  - Insights failed charts
  - Timeline data load failures
  - Import error handling

### Phase 5: Empty States
- [ ] Dashboard: Portfolio empty state
- [ ] Timeline: No entries state
- [ ] Import: Import status empty
- [ ] Chat: Already handled
- [ ] Portfolio: Already handled

### Phase 6: Accessibility
- [ ] Run axe DevTools on modified routes
- [ ] Add missing aria-labels (~40% coverage target)
- [ ] Implement focus traps in modals
- [ ] Test keyboard navigation

---

## Files Modified

## Files Currently Using Updated Components
- `frontend/src/components/voice/FloatingVoiceButton.tsx` - Spinner integrated ✅
- `frontend/src/app/layout.tsx` - Error boundary + Toast (from previous phase) ✅

---

## Testing Checklist

Before marking integration complete, verify:

- [ ] Component renders without errors
- [ ] Loading states show spinners
- [ ] Error states show red styling and retry action
- [ ] Empty states show icon + action
- [ ] Confirm dialogs are modal (backdrop closes them)
- [ ] TypeScript compilation passes
- [ ] Mobile responsive (Spinner, ErrorState, EmptyState, ConfirmDialog all responsive)
-  [ ] Toast notifications appear (new Error/Empty/Confirm actions)

---

## Examples by Route

### Dashboard
```tsx
if (entries.length === 0) {
  return <EmptyState title="No entries" subtitle="Start writing" />;
}
if (error) {
  return <ErrorState title="Failed to load" action={{ label: "Retry", onClick: refetch }} />;
}
```

### Entry Delete
```tsx
<ConfirmDialog
  open={showConfirm}
  title="Delete this entry?"
  description="Can't undo."
  isDangerous={true}
  onConfirm={() => {
    deleteEntry(id);
    toast.success("Deleted");
  }}
  onCancel={() => setShowConfirm(false)}
/>
```

### Timeline with Filters
```tsx
{entries.length === 0 && hasFilters ? (
  <EmptyState
    title="No entries matching"
    action={{ label: "Clear filters", onClick: reset }}
  />
) : null}
```

---

## Backward Compatibility

- Existing `EmptyState` in surface.tsx remains unchanged
- Existing imports from surface continue to work
- New components in ui/ folder are additive
- No breaking changes to existing components

---

## Next Steps

1. Update ConfirmDialog integration (async callbacks for delete actions)
2. Run accessibility audit on modified routes
3. Verify mobile responsiveness
4. Update component storybook/docs if applicable
