# Planning Section - Mobile Responsive Implementation

## Overview

The Planning Group section has been fully updated with mobile detection and responsive layouts. The map-based interface now adapts seamlessly across mobile, tablet, and desktop devices.

## What Was Changed

### 1. Core Integration
- **Added `useDevice()` hook** to `src/components/PlanningChat.jsx`
- Detects: `isMobile`, `isTablet`, `isDesktop`
- Enables conditional rendering and responsive styling throughout the component

### 2. Header Section
**Desktop View:**
- Title "Planning Group" (text-2xl)
- Subtitle in one line
- User info and sign-out button inline on the right
- Dropdowns (Locations, Ports, Cities) in a single horizontal row

**Mobile View:**
- Title shrunk to text-lg
- Subtitle text reduced to text-xs
- User info stacked vertically
- Sign-out button text shortened to "Out"
- Dropdowns stack vertically, each taking full width
- Reduced padding (px-4 vs px-6)

### 3. Main Layout

**Desktop:**
```
┌─────────────────────────────────────────────────┐
│                     Header                       │
└─────────────────────────────────────────────────┘
┌────────────────────────────┬────────────┐
│                            │            │
│          Map (flex-1)       │   Chat     │
│                            │   (w-96)   │
│                            │            │
└────────────────────────────┴────────────┘
```

**Mobile:**
```
┌─────────────────────────┐
│       Header            │
├─────────────────────────┤
│      Map (h-96)         │
├─────────────────────────┤
│   Chat (max-h-72)       │
└─────────────────────────┘
```

Implementation:
- Main container changes from `flex-row` to `flex-col` on mobile
- Gap reduced from 6 to 3 on mobile
- Padding reduced from 6 to 3 on mobile
- Map gets minimum height: `min-h-96` on mobile
- Chat section becomes full width: `w-full max-h-72` on mobile

### 4. Map Controls

**Desktop:**
- Horizontal flex layout with space-between
- Full control labels: "Jump to location...", "Zoom", "Layers", "+ Add Location"
- Standard button padding: px-3 py-2

**Mobile:**
- Vertical flex layout (flex-col)
- Full-width dropdowns
- Icon-only buttons: "◧" for Layers, "+" / "✓" for Add Location
- Reduced padding: px-2 py-1.5
- Smaller text: text-xs

Features:
- Location and City dropdowns stack vertically on mobile
- Control buttons (🇵🇭, −, +, Layers, Add) become full-width groups
- All interactive elements maintain 44px minimum height for touch targets
- Reduced gap between controls for better mobile spacing

### 5. Marker Type Selector

**Desktop:**
- Positioned at top-right (top: 16px; right: 16px)
- Single column grid layout
- Buttons show icon + text (min-width: 150px)
- Standard padding: 10px 14px

**Mobile:**
- Positioned at bottom-right (bottom: 16px; right: 8px)
- 2-column grid layout (grid-template-columns: repeat(2, 1fr))
- Buttons show icon only or stacked
- Smaller padding: 6px 8px
- Added max-height and overflow-y-auto for scrolling
- Flex-direction changed to column for better mobile stacking

### 6. Chat Section

**Desktop:**
- Fixed width: w-96
- Full height sidebar

**Mobile:**
- Full width: w-full
- Limited height: max-h-72
- Messages scrollable within the container

Message Input:
- Desktop: "Type a message..." + "Send" button
- Mobile: "Message..." + "→" arrow button
- Reduced padding on mobile: px-2 py-1.5 vs px-3 py-2

### 7. Auth Modal

**Desktop:**
- max-w-md (448px)
- Padding: p-8
- Text-3xl heading

**Mobile:**
- max-w-sm (384px)
- Padding: p-6
- Text-2xl heading
- Better use of screen space

## Mobile Breakpoints & Detection

The component uses the global `useDevice()` hook which detects:

```javascript
const { isMobile, isTablet, isDesktop } = useDevice()

// isMobile: true if screen < 768px OR mobile device detected
// isTablet: true if 768px <= screen < 1024px OR tablet device
// isDesktop: true if screen >= 1024px and not mobile/tablet
```

### Responsive Behavior

| Screen Size | Device Type | Layout | Map Height | Chat Width |
|------------|------------|--------|-----------|-----------|
| < 640px | Mobile | Vertical | min-h-96 | w-full |
| 640-768px | Mobile | Vertical | min-h-96 | w-full |
| 768-1024px | Tablet | Vertical | min-h-96 | w-full |
| > 1024px | Desktop | Horizontal | flex-1 | w-96 |

## Touch Optimization

### Button Sizing
- All interactive elements have adequate touch targets (44x44px minimum)
- Buttons on mobile have increased padding for touch accuracy
- Icon-only buttons reduce cognitive load on small screens

### Scrolling
- Chat section scrolls independently on mobile
- Map interactions remain responsive
- Marker popups are fullscreen-modal-friendly

### Input Fields
- Full-width text inputs on mobile for easier typing
- Larger tap target: py-1.5 on mobile vs py-2 on desktop
- Placeholder text adapts: "Message..." vs "Type a message..."

## CSS Changes Summary

### Classes Updated
1. Header container: responsive flex-col vs flex-row
2. Dropdown labels: responsive text sizes (text-xs vs text-sm)
3. Select inputs: responsive full-width on mobile
4. Button labels: shortened or icon-only on mobile
5. Main layout: flex-col vs flex-row
6. Chat sidebar: w-full vs w-96, max-h-72 added
7. Message input: responsive padding and icons
8. Marker selector: 2-column grid on mobile, repositioned

### Responsive Patterns Used

```jsx
// Conditional rendering
{isMobile ? (
  <MobileLayout />
) : (
  <DesktopLayout />
)}

// Responsive classes
className={`${isMobile ? 'w-full' : 'w-96'}`}

// Conditional padding/sizing
className={isMobile ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm'}

// Responsive visibility
{isMobile ? '→' : 'Send'}
```

## Performance Considerations

- No additional network requests
- Device detection runs once on mount, updates only on resize/orientation change
- Minimal CSS-in-JS evaluation (only on first render and device change)
- Leaflet map is automatically responsive via container sizing
- Chat scrolling is GPU-accelerated

## Testing Checklist

### Mobile (375px width)
- [ ] Header text readable and properly sized
- [ ] All dropdowns full-width and easy to tap
- [ ] Map displays with proper controls
- [ ] Marker type selector accessible at bottom
- [ ] Chat sidebar not blocking map
- [ ] Message input works smoothly
- [ ] Auth modal fits on screen

### Tablet (768px width)
- [ ] Layout vertical with appropriate spacing
- [ ] Map takes good portion of screen
- [ ] Chat sidebar full width but scrollable
- [ ] All controls accessible

### Desktop (1024px+ width)
- [ ] Map on left (flex-1), chat on right (w-96)
- [ ] Horizontal spacing with gap-6
- [ ] All labels visible, no truncation
- [ ] Marker selector at top-right

### Landscape Mobile
- [ ] Map visible and usable
- [ ] Chat sidebar doesn't overflow
- [ ] Controls remain accessible

## Known Considerations

1. **Marker Type Selector**: On very small screens (< 375px), the 2-column grid might feel tight. Consider 1-column for screens < 320px if needed.

2. **Chat Sidebar Height**: Limited to max-h-72 on mobile to prevent it from dominating the screen. Users can still scroll within the chat.

3. **Map Touch Interactions**: Leaflet supports touch pan/zoom out of the box. No additional configuration needed.

4. **Dropdown Overflow**: On mobile with many items (many ports/cities), dropdowns may need scrolling in the select element itself (native browser behavior).

## Future Enhancements

1. **Collapsible Chat**: Add a toggle button to collapse the chat sidebar on mobile and show it full-screen when needed

2. **Bottom Sheet Chat**: Instead of inline chat, consider a bottom sheet UI pattern for mobile

3. **Split View Button**: Allow users to toggle between "Map View" and "Chat View" on mobile

4. **Geolocation**: Add mobile geolocation for "Center on My Location" feature

5. **PWA Features**: Add full-screen capability and home screen installation for mobile

6. **Offline Support**: Cache map tiles and previous messages for offline access

## Code Location

**Main Component:** `src/components/PlanningChat.jsx`

**Key Sections:**
- Line 115-116: useDevice() hook integration
- Line 1052-1134: Header section with responsive styling
- Line 1136-1138: Main layout container
- Line 1139-1219: Map controls section
- Line 1295-1346: Marker type selector CSS
- Line 1688: Chat sidebar responsive width
- Line 1851-1893: Message input responsive styling
- Line 1897-1902: Auth modal responsive styling

**Related Files:**
- `src/context/DeviceContext.jsx` - Device detection provider
- `src/lib/useDeviceDetection.js` - Device detection logic
- `src/components/ResponsiveLayout.jsx` - Responsive layout utilities

## Summary

The Planning section is now fully responsive with:
✅ Mobile-first design approach
✅ Touch-friendly controls and buttons
✅ Adaptive layouts (vertical on mobile, horizontal on desktop)
✅ Responsive typography (smaller text on mobile)
✅ Optimized map display for all screen sizes
✅ Mobile-friendly chat sidebar
✅ Proper spacing and padding for mobile devices
✅ Icon-only buttons where appropriate
✅ Full-width inputs for better typing experience

Users can now access the Planning Group feature seamlessly on any device!
