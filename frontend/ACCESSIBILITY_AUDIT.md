# Accessibility Audit & Improvement Guide

## Status Overview

Current Coverage: ~40% aria-label implementation  
Target: 85%+ for production launch

## Critical Routes for Accessibility Review

Based on platform importance (priority order):

### Priority 1: Core Navigation & Auth Routes
1. **Dashboard** (`/dashboard`)
   - Login/loaded state transitions
   - Tab navigation (recent/moments/patterns)
   - All button actions need aria-labels

2. **Entry View** (`/entry/view`)
   - Delete button (NOW has ConfirmDialog)
   - Mood selector
   - Skill/lesson tags display
   - Share/copy functionality

3. **Entry Create** (`/entry/new`)
   - Text editor interactions
   - Form validation feedback
   - Voice input button
   - Submit feedback

### Priority 2: Data-Heavy Routes
4. **Timeline** (`/timeline`)
   - View mode switchers (timeline/constellation)
   - Filter buttons
   - Search input + results
   - Keyboard navigation for seasonal jumps

5. **Insights/Portfolio** (`/portfolio`)
   - Mode selectors (export/growth/interview/evidence)
   - Filter tabs
   - Story detail expansions
   - Export/action buttons

6. **Chat/Guide** (`/chat`)
   - Message interactions (user/assistant)
   - Lens selector buttons (clarity/memory/growth/patterns/bridge)
   - Input field with auto-suggestions
   - Real-time transcript/response updates

### Priority 3: Secondary Features
7. **Import** (`/import`)
   - Connection status toggles
   - Story status indicators
   - Action buttons for each entry

8. **Chapters** (`/chapters`)
   - Group creation/edit controls
   - Stat tile labels
   - Group management actions

## Accessibility Fixes by Priority

### CRITICAL (Must Fix Before Launch)
- [ ] **Add aria-labels to all icon-only buttons**
  - FloatingVoiceButton (already has voice button baseline)
  - All delete/edit/action buttons
  - Tool tips for hover-only text
  - **Estimated**: 2-3 hours

- [ ] **Implement focus visible states**
  - Add `.focus-visible` styling (already in globals.css)
  - Verify tab order flows logically
  - Test keyboard-only navigation on each route
  - **Estimated**: 2-3 hours

- [ ] **Fix ConfirmDialog focus management**
  - Auto-focus on "danger" button in ConfirmDialog
  - Trap focus within modal
  - Return focus to trigger element on close
  - **Estimated**: 1 hour

- [ ] **Improve form labels**
  - All input fields have associated labels
  - Error messages linked via aria-describedby
  - Validation feedback is spoken
  - **Estimated**: 1-2 hours

### HIGH (Should Fix)
- [ ] **Add aria-live regions**
  - Loading state announcements
  - Toast notifications (already in context)
  - Data load completion feedback
  - **Estimated**: 1-2 hours

- [ ] **Test color contrast**
  - Verify WCAG AA minimum 4.5:1 for text
  - Check disabled state contrast
  - Verify focus indicators are visible
  - **Estimated**: 1 hour (testing) + fixes as needed

- [ ] **Implement skip navigation**
  - "Skip to main content" link at top
  - "Skip to next section" in long pages
  - **Estimated**: 30 minutes

- [ ] **Alt text for images**
  - User uploaded images: sensible defaults
  - Decorative images: empty alt or aria-hidden
  - Icons in UI: aria-hidden if decorative + aria-label on button
  - **Estimated**: 1-2 hours

### MEDIUM (Nice to Have)
- [ ] **Heading structure audit**
  - Proper h1 → h6 nesting
  - No skipped levels
  - Dashboard: "Home" or entry title as h1
  - **Estimated**: 1 hour

- [ ] **Semantic HTML improvements**
  - Use `<button>` for actions (not `<div>`)
  - Use `<nav>` for navigation
  - Use `<main>` for main content
  - **Estimated**: 2-3 hours

- [ ] **Screen reader testing**
  - Test with NVDA (Windows) or VoiceOver (Mac)
  - Verify content reading order
  - Check for hidden content that shouldn't be
  - **Estimated**: 2-3 hours

- [ ] **Reduced motion support**
  - ✅ Already in globals.css (`prefers-reduced-motion`)
  - Verify Framer Motion animations respect it
  - Check that spinners/transitions still work (no flashing)

---

## Implementation Examples

### Icon-Only Button Fix
```tsx
// BEFORE (if not already labeled)
<button onClick={delete}>
  <FiTrash2 size={20} />
</button>

// AFTER
<button onClick={delete} aria-label="Delete entry">
  <FiTrash2 size={20} aria-hidden="true" />
</button>
```

### Form Input Fix
```tsx
// BEFORE (implicit label)
<input type="text" placeholder="Enter content..." />

// AFTER (explicit label)
<label htmlFor="content">Content description</label>
<input id="content" type="text" aria-describedby="content-error" />
{error && <span id="content-error" className="error">{error}</span>}
```

### Loading State Announcement
```tsx
// AFTER
<div aria-live="polite" aria-busy={isLoading}>
  {isLoading ? "Loading..." : content}
</div>
```

### Modal Focus Trap (ConfirmDialog Already Has This)
```tsx
// In ConfirmDialog: Auto-focus danger button, trap Tab within modal
<div role="alertdialog" aria-modal="true">
  {/* Content */}
  <button autoFocus onClick={onConfirm}>Confirm</button>
  <button onClick={onCancel}>Cancel</button>
</div>
```

---

## Testing Tooling

### Browser Tools (Automated)
- **axe DevTools** (Chrome/Firefox extension)
  - Install: https://www.deque.com/axe/devtools/
  - Run on each priority route
  - Note: ~25% false positives, manual review needed

- **WAVE** (WebAIM)
  - Browser extension for quick feedback
  
- **Lighthouse** (Built into Chrome DevTools)
  - Run audit tab → Accessibility section

### Manual Testing
- **Keyboard-only navigation**
  - Disable mouse, use Tab/Shift+Tab/Enter/Escape
  - Verify tab order is logical
  - Check focus indicators are visible

- **Screen Reader Testing**
  - Windows: NVDA (free, open-source)
  - macOS: VoiceOver (built-in, Cmd+F5)
  - Test on each priority route

### Mobile Accessibility
- Android: TalkBack (built-in screen reader)
- iOS: VoiceOver (built-in)
- Test gesture controls for modals/dropdowns

---

## Routes & Components Requiring Focus

### DashboardPage
- Navigation tabs (recent/moments/patterns)
- Card interactions
- Add Entry button
- Mood sparkline (if interactive)

### EntryDetailClient
- ✅ Delete button now has ConfirmDialog with focus management
- Share/copy button
- Editor interactions
- All skill/lesson tags

### Chat
- Message sender (aria-label for send button)
- Lens selector buttons (clarity/memory/etc)
- Response streaming (aria-live)

### Timeline
- View switcher buttons (timeline/constellation)
- Filter toggle buttons
- Search input + results
- Seasonal navigation

### Portfolio
- Mode switcher tabs
- Filter radios/buttons
- Import/export buttons
- Story interaction modals

---

## Deployment Readiness Checklist

Before shipping to production:

- [ ] Run axe DevTools on Dashboard, Entry, Chat, Timeline, Portfolio
- [ ] Fix all CRITICAL violations
- [ ] Manual keyboard navigation test on all Priority 1 routes
- [ ] Screen reader test on top 3 user flows (Create/Edit/View)
- [ ] Verify focus indicators visible at 200% zoom
- [ ] Check color contrast with WCAG CC tool
- [ ] Document accessibility features in README
- [ ] Add alt text guidelines to style guide (if exists)

---

## Budget Estimate

- Icon labels + button fixes: **2-3 hours**
- Focus management + ConfirmDialog: **1 hour** (already done)
- Form improvements: **1-2 hours**
- aria-live regions: **1-2 hours**
- Testing + fixes: **3-4 hours**
- **Total: 8-12 hours** (1-2 person-days)

Can be split across multiple PRs or done in phases. Priority 1 routes are minimum viable for launch.

---

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [aria-labels Best Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Testing with Screen Readers](https://webaim.org/articles/screenreader_testing/)
- [Keyboard Accessibility](https://webaim.org/articles/keyboard/)
- [Focus Management for Modals](https://www.a11y-101.com/design/focus-management)
