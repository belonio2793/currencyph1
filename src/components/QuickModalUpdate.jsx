/**
 * QuickModalUpdate.jsx
 * 
 * Helper component that shows how to quickly update any modal to use ExpandableModal.
 * This file serves as a reference for modal updates.
 * 
 * QUICK UPDATE STEPS:
 * 
 * 1. Add these imports:
 *    import ExpandableModal from './ExpandableModal'
 *    import { useDevice } from '../context/DeviceContext'
 * 
 * 2. Add hook:
 *    const { isMobile } = useDevice()
 * 
 * 3. Create footer content:
 *    const footerContent = (
 *      <div className="flex gap-2 w-full">
 *        <button onClick={onClose}>Cancel</button>
 *        <button onClick={handleConfirm}>Confirm</button>
 *      </div>
 *    )
 * 
 * 4. Wrap content in ExpandableModal:
 *    return (
 *      <ExpandableModal
 *        isOpen={isOpen}
 *        onClose={onClose}
 *        title="Your Modal Title"
 *        icon="🎯"
 *        size="md"
 *        footer={footerContent}
 *        defaultExpanded={!isMobile}
 *      >
 *        {/* Move your modal content here */}
 *      </ExpandableModal>
 *    )
 * 
 * PROPS GUIDE:
 * - isOpen: boolean - Controls modal visibility
 * - onClose: function - Called when modal closes
 * - title: string - Modal title
 * - icon: string - Optional emoji icon (e.g., "📝", "✓", "⚠️")
 * - size: string - "sm" | "md" | "lg" | "xl" | "fullscreen"
 * - footer: JSX - Button actions (optional)
 * - defaultExpanded: boolean - Start expanded on mobile
 * - showBadge: boolean - Show status badge
 * - badgeContent: string - Badge text (e.g., "✓ Selected")
 */

// Example Simple Modal
export function ExampleSimpleModal() {
  const [isOpen, setIsOpen] = useState(false)
  
  const footer = (
    <div className="flex gap-2 w-full">
      <button onClick={() => setIsOpen(false)}>Close</button>
    </div>
  )
  
  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open Modal</button>
      
      <ExpandableModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Simple Modal"
        icon="📝"
        footer={footer}
      >
        <p>Your content goes here</p>
      </ExpandableModal>
    </>
  )
}

// Example Form Modal
export function ExampleFormModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({ name: '' })
  
  const handleSubmit = () => {
    console.log('Form data:', formData)
    setIsOpen(false)
  }
  
  const footer = (
    <div className="flex gap-2 w-full">
      <button 
        onClick={() => setIsOpen(false)}
        className="flex-1 px-4 py-2 border rounded"
      >
        Cancel
      </button>
      <button 
        onClick={handleSubmit}
        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded"
      >
        Submit
      </button>
    </div>
  )
  
  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open Form</button>
      
      <ExpandableModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Form Modal"
        icon="📝"
        footer={footer}
        badgeContent={formData.name ? '✓' : null}
        showBadge={!!formData.name}
      >
        <div className="space-y-4">
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ name: e.target.value })}
            placeholder="Enter name"
            className="w-full px-4 py-2 border rounded"
          />
        </div>
      </ExpandableModal>
    </>
  )
}

// Example Multi-Step Modal
export function ExampleMultiStepModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState(1)
  
  const handleNext = () => {
    if (step < 3) setStep(step + 1)
    else setIsOpen(false)
  }
  
  const footer = (
    <div className="flex gap-2 w-full">
      {step > 1 && (
        <button 
          onClick={() => setStep(step - 1)}
          className="flex-1 px-4 py-2 border rounded"
        >
          Back
        </button>
      )}
      <button 
        onClick={handleNext}
        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded"
      >
        {step === 3 ? 'Finish' : 'Next'}
      </button>
    </div>
  )
  
  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open Wizard</button>
      
      <ExpandableModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={`Step ${step}`}
        icon="📋"
        footer={footer}
      >
        {step === 1 && <p>Step 1 Content</p>}
        {step === 2 && <p>Step 2 Content</p>}
        {step === 3 && <p>Step 3 Content</p>}
      </ExpandableModal>
    </>
  )
}

/**
 * MIGRATION CHECKLIST FOR EACH MODAL:
 * 
 * - [ ] Add imports (ExpandableModal, useDevice)
 * - [ ] Add hook: const { isMobile } = useDevice()
 * - [ ] Create footer JSX
 * - [ ] Remove old modal wrapper <div>
 * - [ ] Wrap in ExpandableModal component
 * - [ ] Update props (title, icon, size, footer)
 * - [ ] Test on mobile (< 640px)
 * - [ ] Test on tablet (640px - 1024px)
 * - [ ] Test on desktop (> 1024px)
 * - [ ] Test collapse/expand (mobile)
 * - [ ] Verify close button works
 * - [ ] Verify footer buttons work
 */

/**
 * FOOTER BUTTON PATTERNS:
 * 
 * Single button:
 * <button className="flex-1">Action</button>
 * 
 * Two buttons:
 * <div className="flex gap-2 w-full">
 *   <button className="flex-1">Cancel</button>
 *   <button className="flex-1">Confirm</button>
 * </div>
 * 
 * Three buttons:
 * <div className="flex gap-2 w-full">
 *   <button className="flex-1">Previous</button>
 *   <button className="flex-1">Next</button>
 *   <button className="flex-1">Skip</button>
 * </div>
 */

export default {
  ExampleSimpleModal,
  ExampleFormModal,
  ExampleMultiStepModal
}