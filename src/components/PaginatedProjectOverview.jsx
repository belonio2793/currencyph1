import React, { useState } from 'react'

export default function PaginatedProjectOverview({
  project,
  editMode,
  onEdit,
  onSave,
  isSaving,
  editingDescription = '',
  onEditingDescriptionChange
}) {
  const [currentSlide, setCurrentSlide] = useState(0)

  const coconutPlantOverview = [
    {
      title: 'Vision & Approach',
      content: 'A vertically integrated, zero-waste facility producing high-value coconut products\n\nThis project establishes a sustainable coconut processing plant capable of converting every part of the coconut—husk, shell, water, meat, and sap—into market-ready products. The design maximizes profitability, minimizes waste, and creates multiple revenue streams through a circular production model.'
    },
    {
      title: '1. Product Portfolio & Value Extraction',
      content: 'The plant converts a single raw material (the coconut) into multiple high-margin outputs:\n\nA. Husk / Coir\nProducts: Coir fiber, ropes, mats, brushes, erosion-control nets, coco peat, activated carbon\nProcessing: Dehusking → decortication → fiber separation → drying → matting/packing\nValue Note: Residual husk can fuel boilers or be converted into organic fertilizer.\n\nB. Shell\nProducts: Charcoal, activated carbon, eco-briquettes, handicrafts\nProcessing: Crushing → carbonization\nValue Note: Significant bioenergy potential reduces factory energy costs.'
    },
    {
      title: '1. Product Portfolio (cont.) - Coconut Water & Meat',
      content: 'C. Coconut Water (Young Coconuts)\nProducts: Bottled coconut water, concentrates, flavored beverages\nProcessing: Cleaning → extraction → filtration → pasteurization → bottling\nValue Note: One of the highest-margin export products in the coconut industry.\n\nD. Meat / Kernel\nProducts: Virgin Coconut Oil (VCO), refined oil, fractionated oil, Coconut milk and cream, Desiccated coconut, Coconut flour & powder\nProcessing: Wet or dry extraction → filtration → refining → packaging\nBy-products: Copra meal, presscake, animal feed, bioenergy residues'
    },
    {
      title: '1. Product Portfolio (cont.) - Residues & Optional',
      content: 'E. Combined Residues\nProducts: Organic fertilizer, compost, animal feed, biogas\nProcessing: Anaerobic digestion / composting\nValue Note: Supports zero-waste and reduces waste management cost.\n\nF. Optional Diversified Products\nProducts: Coconut sugar, toddy, vinegar, fermented beverages\nProcessing: Sap tapping → evaporation → fermentation/distillation\nValue Note: Allows premium niche market participation.'
    },
    {
      title: '2. Equipment & Processing Lines',
      content: 'The facility includes four primary production lines, each with specialized machinery:\n\nA. Coir / Husk Processing Line\nDehusking & decortication machines\nFiber cleaners, dryers, carding and matting equipment\nCoco peat grinding, screening, and compressing units\nQA lab for fiber quality tests\n\nB. Coconut Water Processing Line\nSorting and washing equipment\nWater extraction/cracking machines\nFiltration, pasteurization, and optional concentration units\nBottling line (PET / glass / Tetra Pak)\nCold storage + HACCP-certified environment'
    },
    {
      title: '2. Equipment & Processing Lines (cont.)',
      content: 'C. Oil Processing Line (VCO & RBD)\nCopra dryers or wet-process shredders\nExpellers, centrifuges, and filtration units\nRefining equipment (bleaching, deodorization, winterization)\nStainless steel oil storage tanks\nQuality testing lab for moisture and fatty acid profile\n\nD. Coconut Milk & Desiccated Coconut Line\nGraters, presses, extractors\nPasteurization & sterilization equipment\nHot-air dryers or freeze-dryers for powders\nAseptic packaging systems'
    },
    {
      title: '2. Equipment & Processing Lines (cont.)',
      content: 'E. Shell & Bioenergy Line\nCarbonization kilns\nPulverizers and sieving machines\nActivated carbon processing (optional)\nEnergy recovery systems for internal heat needs\n\nF. Circular Economy Add-ons\nComposting units for fertilizer\nAnaerobic digesters for biogas\nSmall-scale feed pelletizers (using presscake)'
    },
    {
      title: '3. Vertically-Integrated Operations Strategy',
      content: 'The plant is designed around three strategic pillars:\n\nA. Maximum Value Per Coconut\nEvery component—water, meat, shell, husk, sap—is processed into a sellable product.\n\nB. Circular Waste Management\nHusk → fiber, peat, boiler fuel\nShell → charcoal, activated carbon, heat energy\nOil/milk residues → feed & fertilizer\nWastewater → recycled or treated\nThis reduces operating costs and boosts profit margins.\n\nC. Multi-Line, Scalable Infrastructure\nDedicated lines allow simultaneous production\nCold chain and dry storage support quality\nAutomation options for future expansion\nR&D and quality labs ensure export compliance'
    },
    {
      title: '4. Key Value Drivers',
      content: '💰 Multiple High-Value Revenue Streams\nVCO, bottled water, coco peat, activated carbon\nCoconut milk, desiccated coconut, shell charcoal\nOrganic fertilizers & feed products\n\n💎 Premium, Export-Ready Products\nVCO and coconut water are globally high-demand\nCoco peat is widely used in modern agriculture\nActivated carbon has industrial-grade margins\n\n📦 Support Products Reduce Waste\nPresscake → animal feed\nResidues → compost & fertilizer\nShell gasification → plant energy'
    },
    {
      title: '4. Key Value Drivers (cont.)',
      content: '🏭 Scalable Industrial Infrastructure\nSupports long-term growth into beverages, cosmetics, bioenergy\nSuitable for local + export markets\n\n♻️ True Zero-Waste Production\nEvery part of the coconut becomes value\nReduces environmental impact\nStrengthens sustainability credentials (ISO, HACCP, organic certification)\n\n⚡ Clean Summary\nThis project establishes a fully integrated coconut processing plant designed to convert raw coconuts into multiple high-value products. The facility operates across four major production lines with quality labs, cold storage, and circular waste-to-energy systems. Maximum profitability through zero-waste sustainable model.'
    }
  ]

  const slides = project.name === 'Coconut Oil & Water Processing Plant' ? coconutPlantOverview : [
    { title: 'Project Overview', content: project.long_description || project.description || 'No description available.' }
  ]

  const handleNext = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length)
  }

  const handlePrev = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
  }

  const handleSave = async () => {
    await onSave(editingDescription)
  }

  return (
    <div className="w-full">
      {editMode ? (
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-600">EDIT PROJECT OVERVIEW</label>
          <textarea
            value={editingDescription}
            onChange={(e) => setEditingDescription(e.target.value)}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 font-mono text-sm"
            rows="20"
            placeholder="Enter detailed project overview..."
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 px-3 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-800 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Overview'}
            </button>
            <button
              onClick={onEdit}
              className="px-3 py-2 border border-slate-300 text-slate-700 text-sm rounded hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-3">
            <button
              onClick={onEdit}
              className="px-3 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-800"
            >
              ✎ Edit
            </button>
          </div>

          {/* Slide Container */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-200 rounded-xl p-8 min-h-96 flex flex-col justify-between">
            {/* Slide Title */}
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-4 border-b-2 border-slate-300 pb-3">
                {slides[currentSlide].title}
              </h3>

              {/* Slide Content */}
              <div className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed font-sans max-h-64 overflow-y-auto pr-3">
                {slides[currentSlide].content}
              </div>
            </div>

            {/* Slide Counter & Navigation */}
            <div className="mt-6 flex items-center justify-between">
              <div className="text-xs text-slate-600 font-semibold">
                Slide {currentSlide + 1} of {slides.length}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handlePrev}
                  disabled={slides.length === 1}
                  className="px-4 py-2 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  ← Previous
                </button>

                {/* Progress Indicator */}
                <div className="flex gap-1 items-center px-3">
                  {slides.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentSlide(idx)}
                      className={`h-2 rounded-full transition-all ${
                        idx === currentSlide ? 'bg-slate-700 w-6' : 'bg-slate-300 w-2'
                      }`}
                      title={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>

                <button
                  onClick={handleNext}
                  disabled={slides.length === 1}
                  className="px-4 py-2 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
