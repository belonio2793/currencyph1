# Mobile-Responsive Layout System Guide

This document outlines the mobile detection and responsive layout system that has been implemented across the application.

## Overview

The app now includes:
- **Device Detection Hook**: Automatically detects mobile, tablet, and desktop devices
- **Device Context Provider**: Makes device info available throughout the app
- **Responsive Layout Components**: Pre-built mobile-optimized components
- **Screen Size Breakpoints**: xs, sm, md, lg, xl with responsive utilities

## Quick Start

### 1. Using Device Detection in Components

```jsx
import { useDevice } from '../context/DeviceContext'

export function MyComponent() {
  const { isMobile, isTablet, isDesktop, screenSize, width, height, deviceType, orientation } = useDevice()

  return (
    <div>
      {isMobile && <p>You're on mobile!</p>}
      {isTablet && <p>You're on tablet!</p>}
      {isDesktop && <p>You're on desktop!</p>}
    </div>
  )
}
```

### 2. Using Pre-built Responsive Components

```jsx
import { useDevice } from '../context/DeviceContext'

// Responsive Grid
<div className={isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}>
  {items.map(item => <div key={item.id}>{item.name}</div>)}
</div>

// Responsive Text
<h1 className={isMobile ? 'text-xl' : 'text-3xl'}>Title</h1>

// Responsive Padding
<div className={`p-${isMobile ? '4' : '6'}`}>Content</div>
```

## Available Hooks & Components

### useDevice() Hook

Returns an object with:
- `isMobile`: boolean - true if screen < 768px or mobile device detected
- `isTablet`: boolean - true if 768px <= screen < 1024px or tablet device
- `isDesktop`: boolean - true if screen >= 1024px and not mobile/tablet
- `screenSize`: string - 'xs', 'sm', 'md', 'lg', 'xl'
- `width`: number - window width in pixels
- `height`: number - window height in pixels
- `deviceType`: string - 'mobile', 'tablet', or 'desktop'
- `orientation`: string - 'portrait' or 'landscape'
- `isMobileDevice`: boolean - actual mobile device detected via User Agent
- `isTabletDevice`: boolean - actual tablet device detected via User Agent
- `isDesktopDevice`: boolean - actual desktop device detected via User Agent

### Responsive Layout Components

#### MobileCard
Touch-friendly card with optional hover effects (disabled on mobile)
```jsx
import { MobileCard, MobileCardHeader } from '../components/MobileLayouts'

<MobileCard hoverable className="bg-blue-50">
  <MobileCardHeader 
    title="Feature Title" 
    subtitle="Feature description"
    icon="F"
  />
  <p>Card content here</p>
</MobileCard>
```

#### MobileButton
Button with responsive sizing for touch devices
```jsx
import { MobileButton } from '../components/MobileLayouts'

<MobileButton 
  variant="primary" 
  size="md" 
  fullWidth={false}
  onClick={handleClick}
>
  Click Me
</MobileButton>

// Variants: 'primary', 'secondary', 'danger', 'outline'
// Sizes: 'sm', 'md', 'lg'
// fullWidth: true/false for full-width buttons
```

#### MobileSection
Section container with responsive heading and spacing
```jsx
import { MobileSection, MobileSectionGrid } from '../components/MobileLayouts'

<MobileSection 
  title="Section Title" 
  subtitle="Optional subtitle"
>
  <MobileSectionGrid columns={{ mobile: 1, tablet: 2, desktop: 3 }}>
    {items.map(item => <div key={item.id}>{item.name}</div>)}
  </MobileSectionGrid>
</MobileSection>
```

#### MobilePageContainer
Full-page container with responsive padding and max-width
```jsx
import { MobilePageContainer, MobilePageHeader } from '../components/MobileLayouts'

<MobilePageContainer>
  <MobilePageHeader 
    title="Page Title"
    subtitle="Page subtitle"
  />
  <div>Page content</div>
</MobilePageContainer>
```

#### MobileModal
Modal that goes full-screen on mobile devices
```jsx
import { MobileModal } from '../components/MobileLayouts'

<MobileModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Modal Title"
  actions={[
    <button>Cancel</button>,
    <button>Submit</button>
  ]}
>
  Modal content here
</MobileModal>
```

### Base Responsive Layout Helpers

From `ResponsiveLayout.jsx`:

#### MobileOnly
Render only on mobile devices
```jsx
import { MobileOnly } from '../components/ResponsiveLayout'

<MobileOnly className="text-center">
  Mobile-only content
</MobileOnly>
```

#### DesktopOnly
Render only on desktop
```jsx
import { DesktopOnly } from '../components/ResponsiveLayout'

<DesktopOnly className="hidden md:block">
  Desktop-only content
</DesktopOnly>
```

#### TabletOnly
Render only on tablet
```jsx
import { TabletOnly } from '../components/ResponsiveLayout'

<TabletOnly>
  Tablet-only content
</TabletOnly>
```

#### ResponsiveContainer
Container that adjusts max-width based on device
```jsx
import { ResponsiveContainer } from '../components/ResponsiveLayout'

<ResponsiveContainer>
  Content automatically sized for device
</ResponsiveContainer>
```

#### MobileMenu
Conditional mobile menu with backdrop
```jsx
import { MobileMenu } from '../components/ResponsiveLayout'

<MobileMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)}>
  Menu items here
</MobileMenu>
```

#### ResponsiveGrid
Auto-responsive grid component
```jsx
import { ResponsiveGrid } from '../components/ResponsiveLayout'

<ResponsiveGrid columns={{ mobile: 1, tablet: 2, desktop: 3 }}>
  {items.map(item => <div key={item.id}>{item.name}</div>)}
</ResponsiveGrid>
```

## Responsive Design Patterns

### Pattern 1: Conditional Rendering

```jsx
import { useDevice } from '../context/DeviceContext'

function MyComponent() {
  const { isMobile } = useDevice()

  return (
    <div>
      {isMobile ? (
        // Mobile layout
        <div className="flex flex-col gap-2">
          {items.map(item => <MobileCard key={item.id}>{item.name}</MobileCard>)}
        </div>
      ) : (
        // Desktop layout
        <div className="grid grid-cols-3 gap-4">
          {items.map(item => <Card key={item.id}>{item.name}</Card>)}
        </div>
      )}
    </div>
  )
}
```

### Pattern 2: Responsive Classes

```jsx
import { useDevice } from '../context/DeviceContext'

function MyComponent() {
  const { isMobile, isTablet } = useDevice()

  return (
    <div className={`
      ${isMobile ? 'p-4' : 'p-6'} 
      ${isMobile ? 'text-sm' : 'text-base'}
      ${isMobile ? 'grid-cols-1' : isTablet ? 'grid-cols-2' : 'grid-cols-3'}
    `}>
      Content
    </div>
  )
}
```

### Pattern 3: Tailwind Responsive Classes

Keep using Tailwind's responsive prefixes for simple changes:

```jsx
// Simple responsive scaling
<h1 className="text-2xl sm:text-3xl md:text-4xl">Heading</h1>

// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map(item => <Card key={item.id}>{item.name}</Card>)}
</div>

// Responsive display
<div className="hidden md:block">Desktop only</div>
<div className="md:hidden">Mobile only</div>
```

## Breakpoints Reference

| Class | Pixels | Use Case |
|-------|--------|----------|
| xs | 0px | Extra small (mobile) |
| sm | 640px | Small (landscape mobile) |
| md | 768px | Medium (tablet) |
| lg | 1024px | Large (desktop) |
| xl | 1280px | Extra large (large desktop) |

## Implementation Examples

### Example 1: Update Existing Component

Before:
```jsx
export function ProductList() {
  return (
    <div className="grid grid-cols-3 gap-4 p-6">
      {products.map(p => <ProductCard key={p.id} product={p} />)}
    </div>
  )
}
```

After:
```jsx
import { useDevice } from '../context/DeviceContext'

export function ProductList() {
  const { isMobile, isTablet } = useDevice()
  
  const cols = isMobile ? 1 : isTablet ? 2 : 3
  
  return (
    <div className={`grid gap-4 grid-cols-${cols} p-${isMobile ? '4' : '6'}`}>
      {products.map(p => <ProductCard key={p.id} product={p} />)}
    </div>
  )
}
```

### Example 2: Mobile-First Approach

```jsx
import { useDevice } from '../context/DeviceContext'
import { MobileButton } from '../components/MobileLayouts'

export function Hero() {
  const { isMobile } = useDevice()

  return (
    <div className={`text-center ${isMobile ? 'py-8 px-4' : 'py-16 px-8'}`}>
      <h1 className={isMobile ? 'text-2xl' : 'text-4xl'}>Welcome</h1>
      <p className={`mt-4 ${isMobile ? 'text-sm' : 'text-base'}`}>
        Description text
      </p>
      <div className={`mt-6 flex gap-2 ${isMobile ? 'flex-col' : 'flex-row'}`}>
        <MobileButton variant="primary">Sign In</MobileButton>
        <MobileButton variant="secondary">Create Account</MobileButton>
      </div>
    </div>
  )
}
```

## Updated Components

The following components have been updated with mobile detection:
- ✅ **App.jsx** - Wrapped with DeviceProvider
- ✅ **Navbar.jsx** - Device detection integrated
- ✅ **OfflineDisplay.jsx** - Full mobile optimization
- All future components should use `useDevice()` hook

## Best Practices

1. **Always wrap app with DeviceProvider** (already done in App.jsx)
2. **Use useDevice() hook at component level** for dynamic responsive behavior
3. **Combine hooks with Tailwind classes** for simple styling
4. **Prefer mobile-first approach** - design for mobile, enhance for desktop
5. **Test on actual devices** - use browser dev tools AND real devices
6. **Consider touch targets** - buttons should be at least 44x44px on mobile
7. **Avoid hover effects on mobile** - they don't work well
8. **Use full-screen modals on mobile** - better for small screens
9. **Simplify layouts on mobile** - use single columns when possible
10. **Test orientation changes** - device may rotate at any time

## Testing Mobile Responsiveness

### Using Browser DevTools
1. Open Chrome/Edge DevTools (F12)
2. Click device toggle (Ctrl+Shift+M / Cmd+Shift+M)
3. Test various screen sizes: 375px, 768px, 1024px, 1280px

### Real Device Testing
- Test on actual mobile devices in portrait and landscape
- Verify touch interactions work smoothly
- Check font sizes are readable
- Ensure buttons are easy to tap

### Recommended Test Breakpoints
- iPhone SE (375px width)
- iPad (768px width)
- iPad Pro (1024px width)
- Desktop (1280px+ width)

## Troubleshooting

### Device detection not working
- Ensure DeviceProvider wraps your app in App.jsx ✓
- Verify useDevice() is called inside a component, not at module level
- Check browser console for errors

### Styles not applying on mobile
- Verify component is wrapped with DeviceProvider
- Use lowercase class names (e.g., `grid-cols-1` not `grid-cols-${cols}`)
- Test in incognito mode (no cache issues)
- Clear browser cache if styles seem stuck

### Layout shifts on resize
- Avoid hardcoded widths, use percentages
- Use `max-w-full` instead of `w-screen`
- Test with gradual window resizing

## Future Improvements

- [ ] Add CSS media queries as alternative to JS detection
- [ ] Create mobile-specific page layouts
- [ ] Add touch gesture support
- [ ] Create performance monitoring for mobile
- [ ] Add PWA support for mobile installation
- [ ] Create component variants library
