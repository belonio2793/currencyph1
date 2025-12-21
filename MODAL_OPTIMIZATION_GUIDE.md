# Modal Optimization Guide

This guide explains how to update existing modals to use the new mobile-optimized components.

## Overview

Two new components are available for mobile-optimized modals:

1. **ExpandableModal** - Recommended for most modals. Provides:
   - Fullscreen on mobile with rounded top corners
   - Collapsible header that minimizes to a button at the bottom
   - Smooth transitions and animations
   - Support for icons and badges
   - Responsive footer actions

2. **MobileOptimizedModalWrapper** - Alternative wrapper for existing modals (deprecated in favor of ExpandableModal)

## Migration Steps

### Step 1: Import the ExpandableModal component

```jsx
import ExpandableModal from './ExpandableModal'
import { useDevice } from '../context/DeviceContext'
```

### Step 2: Update component props

Add `isMobile` from the device context:
```jsx
const { isMobile } = useDevice()
```

Set initial expanded state (optional):
```jsx
const [isExpanded, setIsExpanded] = useState(!isMobile)
```

### Step 3: Replace modal JSX structure

**Before:**
```jsx
return (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
    <div className="bg-white rounded-lg w-full max-w-md p-6">
      {/* content */}
    </div>
  </div>
)
```

**After:**
```jsx
const footerContent = (
  <div className="flex gap-3 justify-end w-full">
    <button onClick={onClose}>Cancel</button>
    <button onClick={handleConfirm}>Confirm</button>
  </div>
)

return (
  <ExpandableModal
    isOpen={isOpen}
    onClose={onClose}
    title="Modal Title"
    icon="📍"
    size="md"
    footer={footerContent}
    badgeContent={selectedValue ? '✓ Selected' : null}
    showBadge={!!selectedValue}
  >
    {/* Your modal content goes here */}
  </ExpandableModal>
)
```

### Step 4: Update modal props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| isOpen | boolean | - | Show/hide modal |
| onClose | function | - | Close handler |
| title | string | - | Modal title |
| icon | string/emoji | - | Optional emoji icon |
| size | string | 'md' | sm, md, lg, xl, fullscreen |
| footer | JSX | null | Footer content/buttons |
| showBadge | boolean | false | Show status badge |
| badgeContent | string | null | Badge text (e.g., "✓ Selected") |
| defaultExpanded | boolean | true | Initially expanded state |

## Examples

### Simple Confirmation Modal

```jsx
import ExpandableModal from './ExpandableModal'
import { useDevice } from '../context/DeviceContext'

export default function SimpleModal({ isOpen, onClose }) {
  const { isMobile } = useDevice()
  const [selected, setSelected] = useState(null)

  const handleConfirm = () => {
    // ... logic
    onClose()
  }

  const footer = (
    <div className="flex gap-2 w-full">
      <button onClick={onClose} className="flex-1">Cancel</button>
      <button onClick={handleConfirm} className="flex-1">Confirm</button>
    </div>
  )

  return (
    <ExpandableModal
      isOpen={isOpen}
      onClose={onClose}
      title="My Modal"
      icon="📝"
      footer={footer}
      badgeContent={selected ? '✓' : null}
      showBadge={!!selected}
    >
      {/* Content */}
    </ExpandableModal>
  )
}
```

### Form Modal with Steps

```jsx
import ExpandableModal from './ExpandableModal'

export default function FormModal({ isOpen, onClose }) {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({})

  const footer = (
    <div className="flex gap-2 w-full">
      {step > 1 && (
        <button onClick={() => setStep(step - 1)} className="flex-1">
          Previous
        </button>
      )}
      <button onClick={() => setStep(step + 1)} className="flex-1">
        {step === totalSteps ? 'Submit' : 'Next'}
      </button>
    </div>
  )

  return (
    <ExpandableModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Step ${step}`}
      footer={footer}
    >
      {step === 1 && <StepOne data={formData} onChange={setFormData} />}
      {step === 2 && <StepTwo data={formData} onChange={setFormData} />}
    </ExpandableModal>
  )
}
```

## Mobile Behavior

### Expanded State (Default)
- Fullscreen on mobile with rounded top corners
- Content fills viewport
- Header sticky with title and close button
- Footer sticky with actions
- Collapse button visible on header

### Minimized State (Mobile Only)
- Header appears as a button at bottom of screen
- Button shows title, icon, and status badge
- Light backdrop
- Tap to expand back to fullscreen

## Responsive Breakpoints

The modals automatically adapt to:
- **Mobile** (< 640px): Fullscreen with collapsible header
- **Tablet** (640px - 1024px): Centered dialog, medium width
- **Desktop** (> 1024px): Centered dialog, full width with constraints

## CSS Classes Used

The modals use Tailwind CSS classes for styling. Ensure your project has:
- Tailwind CSS configured
- Dark mode support (optional)
- Responsive utilities enabled

## Common Patterns

### With Loading State
```jsx
<ExpandableModal isOpen={isOpen} onClose={onClose} title={title}>
  {loading ? (
    <div className="flex justify-center py-8">Loading...</div>
  ) : (
    {/* content */}
  )}
</ExpandableModal>
```

### With Tabs
```jsx
<ExpandableModal isOpen={isOpen} onClose={onClose} title={title}>
  <div className="flex border-b mb-4">
    <button className={activeTab === 'tab1' ? 'border-b-2' : ''}>Tab 1</button>
    <button className={activeTab === 'tab2' ? 'border-b-2' : ''}>Tab 2</button>
  </div>
  {activeTab === 'tab1' && <Content1 />}
  {activeTab === 'tab2' && <Content2 />}
</ExpandableModal>
```

### With Form Validation
```jsx
const footer = (
  <button 
    disabled={!isFormValid}
    className="disabled:opacity-50"
  >
    Submit
  </button>
)
```

## Migration Checklist

- [ ] Import ExpandableModal and useDevice
- [ ] Remove old modal wrapper div structure
- [ ] Add device context hook
- [ ] Create footer content
- [ ] Wrap JSX in ExpandableModal
- [ ] Update all props (title, icon, size, etc.)
- [ ] Test on mobile (< 640px)
- [ ] Test on tablet (640px - 1024px)
- [ ] Test on desktop (> 1024px)
- [ ] Test expand/collapse on mobile
- [ ] Verify footer actions work
- [ ] Test close button

## Troubleshooting

### Modal not appearing
- Check `isOpen` prop is true
- Verify z-index isn't being overridden
- Ensure modal is mounted in component tree

### Scrolling issues
- Content should use `overflow-y-auto` which is built-in
- Check for parent containers with `overflow: hidden`

### Styling issues
- Verify Tailwind CSS is properly configured
- Check for conflicting CSS classes
- Ensure parent container doesn't have conflicting styles

## Performance Tips

1. Use React.memo for modal content components
2. Debounce search/filter inputs
3. Lazy load heavy components inside modals
4. Close modals when not needed to free memory

## Related Components

- ExpandableModal - New optimized modal component
- ResponsiveModal - Alternative older modal (still available)
- MobileOptimizedModalWrapper - Wrapper alternative (deprecated)
