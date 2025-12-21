# Responsive Design Implementation Guide

## Overview

This document provides patterns and guidelines for making all components mobile-first and responsive across device sizes (mobile: <640px, tablet: 640px-1024px, desktop: >1024px).

## New Responsive Components Available

### 1. **ResponsiveModal** Component
Pre-built responsive modal that automatically adapts to device size.

```jsx
import ResponsiveModal from './ResponsiveModal'

<ResponsiveModal
  isOpen={isOpen}
  onClose={onClose}
  title="Modal Title"
  size="lg" // sm, md, lg, xl
  footer={<button>Action</button>}
>
  Your content here
</ResponsiveModal>
```

**Features:**
- Mobile: Full-screen with rounded top corners
- Tablet/Desktop: Centered dialog with max-width constraints
- Automatic header stickiness
- Touch-friendly padding: `p-4 sm:p-6`
- Responsive text sizes: `text-xl sm:text-2xl`

### 2. **ResponsiveButton** Component
Touch-optimized buttons with responsive sizing.

```jsx
import ResponsiveButton from './ResponsiveButton'

<ResponsiveButton
  variant="primary" // primary, secondary, danger, ghost
  size="md" // sm, md, lg
  fullWidth={true}
  loading={false}
  onClick={handleClick}
>
  Click Me
</ResponsiveButton>
```

**Features:**
- Minimum 44px touch target on mobile
- Responsive padding: `px-4 sm:px-6 py-2.5 sm:py-3`
- Automatic fullWidth option for mobile forms
- Loading state with spinner

### 3. **ResponsiveFormGrid** & Utilities
Form layout components with responsive grids.

```jsx
import { ResponsiveFormGrid, FormGroup, FormActions } from './ResponsiveFormGrid'

<ResponsiveFormGrid columns={2}>
  <FormGroup label="Name" required>
    <input className="form-input-responsive" />
  </FormGroup>
  <FormGroup label="Email">
    <input className="form-input-responsive" />
  </FormGroup>
</ResponsiveFormGrid>

<FormActions>
  <ResponsiveButton>Cancel</ResponsiveButton>
  <ResponsiveButton variant="primary">Submit</ResponsiveButton>
</FormActions>
```

## CSS Utility Classes

All classes follow Tailwind mobile-first breakpoints (`sm:`, `md:`, `lg:`).

### Modal Classes
```css
.modal-responsive           /* Full modal container with backdrop */
.modal-header-responsive    /* Header with padding p-4 sm:p-6 */
.modal-body-responsive      /* Body with overflow and spacing */
.modal-footer-responsive    /* Footer with flex and gap */
.modal-padding              /* p-4 sm:p-6 md:p-8 */
```

### Form Classes
```css
.input-responsive           /* Responsive input: px-3 sm:px-4 py-2.5 sm:py-3 */
.select-responsive          /* Responsive select with min-h-10 sm:min-h-11 */
.button-responsive          /* Responsive button sizing */
.form-input-responsive      /* Form input with focus states */
.form-label-responsive      /* Form labels: text-xs sm:text-sm */
.form-section-responsive    /* Sections with space-y-3 sm:space-y-4 */
```

### Grid Classes
```css
.grid-responsive-2          /* grid-cols-1 md:grid-cols-2 */
.grid-responsive-3          /* grid-cols-1 md:grid-cols-2 lg:grid-cols-3 */
.grid-responsive-4          /* grid-cols-2 md:grid-cols-3 lg:grid-cols-4 */
```

### Spacing Classes
```css
.gap-responsive-sm          /* gap-2 sm:gap-3 md:gap-4 */
.gap-responsive-md          /* gap-3 sm:gap-4 md:gap-6 */
.gap-responsive-lg          /* gap-4 sm:gap-6 md:gap-8 */
.p-responsive-sm            /* p-3 sm:p-4 md:p-6 */
.p-responsive-md            /* p-4 sm:p-6 md:p-8 */
.p-responsive-lg            /* p-6 sm:p-8 md:p-10 */
```

### Typography Classes
```css
.heading-responsive-h1      /* text-2xl sm:text-3xl md:text-4xl font-bold */
.heading-responsive-h2      /* text-xl sm:text-2xl md:text-3xl font-bold */
.heading-responsive-h3      /* text-lg sm:text-xl md:text-2xl font-semibold */
.text-responsive-base       /* text-sm sm:text-base md:text-base */
.text-responsive-sm         /* text-xs sm:text-sm */
.title-responsive           /* text-lg sm:text-xl md:text-2xl font-bold */
.subtitle-responsive        /* text-sm sm:text-base text-slate-600 */
```

## Responsive Patterns

### Pattern 1: Two-Column Form
**Before (NOT responsive):**
```jsx
<div className="grid grid-cols-2 gap-4">
  <input />
  <input />
</div>
```

**After (Mobile-first):**
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
  <input className="form-input-responsive" />
  <input className="form-input-responsive" />
</div>
```

### Pattern 2: Modal Structure
**Before:**
```jsx
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto">
    <div className="p-6 border-b">Header</div>
    <div className="p-6">Content</div>
    <div className="p-6 flex gap-3">Footer</div>
  </div>
</div>
```

**After (Using ResponsiveModal):**
```jsx
<ResponsiveModal isOpen={true} onClose={onClose} title="Title" size="lg">
  Content
</ResponsiveModal>
```

Or using CSS classes:
```jsx
<div className="modal-responsive overlay-responsive">
  <div className="modal-content-responsive max-w-2xl">
    <div className="modal-header-responsive">Header</div>
    <div className="modal-body-responsive">Content</div>
    <div className="modal-footer-responsive">Footer</div>
  </div>
</div>
```

### Pattern 3: Responsive Grid Cards
**Before:**
```jsx
<div className="grid grid-cols-3 gap-4">
  {items.map(item => <Card key={item.id} />)}
</div>
```

**After:**
```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
  {items.map(item => <Card key={item.id} />)}
</div>
```

### Pattern 4: Responsive Buttons
**Before:**
```jsx
<button className="px-4 py-2">Click</button>
```

**After:**
```jsx
<button className="button-responsive px-4 sm:px-6 py-2.5 sm:py-3">Click</button>
```

Or use ResponsiveButton component:
```jsx
<ResponsiveButton variant="primary" fullWidth>Click</ResponsiveButton>
```

### Pattern 5: Input Sizing
**Before:**
```jsx
<input className="px-4 py-3 border rounded-lg" />
```

**After:**
```jsx
<input className="form-input-responsive" />
```

Expands to: `w-full px-3 sm:px-4 py-2 sm:py-3 border border-slate-300 rounded-lg text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500`

## Spacing Standards

### Mobile (< 640px)
- Modal padding: `p-4` (16px)
- Form gaps: `gap-2` or `gap-3` (8px or 12px)
- Text size: `text-xs` or `text-sm`

### Tablet (640px - 1024px)
- Modal padding: `sm:p-6` (24px)
- Form gaps: `sm:gap-4` (16px)
- Text size: `sm:text-base`

### Desktop (> 1024px)
- Modal padding: `md:p-8` (32px)
- Form gaps: `md:gap-6` (24px)
- Text size: `md:text-base` or `md:text-lg`

## Touch Target Sizes

Minimum touch target for all interactive elements:
- **Mobile**: 44px (11mm) - use `min-h-11 min-w-11` or `.touch-target`
- **Desktop**: 40px acceptable but 44px preferred

## Font Scaling

```jsx
// Heading 1 (page title)
className="heading-responsive-h1"  // text-2xl sm:text-3xl md:text-4xl

// Heading 2 (section title)
className="heading-responsive-h2"  // text-xl sm:text-2xl md:text-3xl

// Body text
className="text-responsive-base"   // text-sm sm:text-base

// Small text (helper, error)
className="text-responsive-sm"     // text-xs sm:text-sm
```

## Implementation Checklist

When updating a component, verify:

- [ ] **Modals**: Using `ResponsiveModal` or `modal-*-responsive` classes
- [ ] **Forms**: Using `grid-responsive-*` for grids, `form-input-responsive` for inputs
- [ ] **Buttons**: Using `ResponsiveButton` or `button-responsive` classes
- [ ] **Typography**: Using heading/text responsive classes
- [ ] **Spacing**: Using gap-responsive/p-responsive classes
- [ ] **Touch targets**: Min 44px height/width on mobile
- [ ] **Padding**: p-4 on mobile, p-6 on tablet, p-8 on desktop
- [ ] **Text sizing**: text-sm on mobile, text-base on desktop
- [ ] **Grid columns**: Always start with `grid-cols-1` for mobile
- [ ] **Tested on mobile**: Verify components work on 320px-375px width

## Device Detection Hook

Use the device detection context to conditionally render:

```jsx
import { useDevice } from '../context/DeviceContext'

export function MyComponent() {
  const { isMobile, isTablet, isDesktop } = useDevice()
  
  return (
    <>
      {isMobile && <MobileLayout />}
      {!isMobile && <DesktopLayout />}
    </>
  )
}
```

## Testing Guidelines

### Mobile Testing (< 640px)
- iPhone 12/13: 390px
- iPhone SE: 375px
- Pixel 5: 393px

### Tablet Testing (640px - 1024px)
- iPad Mini: 768px
- iPad Air: 820px

### Desktop Testing (> 1024px)
- Laptop: 1920px, 1440px, 1024px

## Common Issues & Solutions

### Issue: Text too small on mobile
**Solution**: Add `sm:text-base` or use responsive text classes
```jsx
<p className="text-sm sm:text-base">Your text</p>
```

### Issue: 2-column grid doesn't stack on mobile
**Solution**: Start with single column, add responsive breakpoints
```jsx
// ❌ Wrong
<div className="grid grid-cols-2">

// ✅ Correct
<div className="grid grid-cols-1 md:grid-cols-2">
```

### Issue: Modals too wide on mobile
**Solution**: Use `ResponsiveModal` component or apply padding
```jsx
<div className="p-4 sm:p-6 md:p-8">
```

### Issue: Buttons not touch-friendly
**Solution**: Ensure min-height of 44px (11mm)
```jsx
<button className="button-responsive">  {/* includes min-h-11 */}
```

## Quick Reference

| Component | Before | After |
|-----------|--------|-------|
| Modal | Fixed width `max-w-2xl` | `ResponsiveModal` or modal-*-responsive |
| Input | `px-4 py-3` | `form-input-responsive` |
| Button | Fixed size | `ResponsiveButton` or button-responsive |
| Grid 2col | `grid-cols-2` | `grid-cols-1 md:grid-cols-2` |
| Grid 3col | `grid-cols-3` | `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` |
| Padding | `p-6` | `p-4 sm:p-6 md:p-8` |
| Gap | `gap-4` | `gap-3 sm:gap-4 md:gap-6` |
| Text | `text-sm` | `text-sm sm:text-base` |
| Heading | `text-2xl` | `heading-responsive-h2` |

## Next Steps

1. **Phase 1** (Complete): Foundation components created
2. **Phase 2** (In Progress): Critical modals updated
3. **Phase 3**: Apply patterns to remaining 45+ modals
4. **Phase 4**: Update all form layouts (40+ instances)
5. **Phase 5**: Test across all pages and devices

## Files Modified

### New Files Created
- `src/components/ResponsiveModal.jsx`
- `src/components/ResponsiveButton.jsx`
- `src/components/ResponsiveDropdown.jsx`
- `src/components/ResponsiveFormGrid.jsx`
- `src/lib/responsiveUtils.js`
- `src/styles/responsive.css`

### Components Updated
- `src/components/CurrencySelectionModal.jsx` (100% responsive)
- `src/components/SelectBusinessModal.jsx` (100% responsive)
- `src/components/SearchableSelect.jsx` (input responsive)
- `src/components/HomePage.jsx` (grids responsive)
- `src/index.css` (imports responsive.css)

## Support

For questions or issues with responsive design:
1. Check this guide
2. Review ResponsiveModal/Button examples
3. Look at updated components for reference
4. Use the CSS utility classes

---

**Last Updated**: 2025
**Status**: Active Implementation
