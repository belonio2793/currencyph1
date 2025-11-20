import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getCurrencySymbol, formatCurrency } from '../lib/currency'
import { getPhpToUsdRate, phpToUsd, usdToPhp, formatPhp, formatUsd, CurrencyInput } from '../lib/currencyConversion'
import { createPortal } from 'react-dom'
import EquipmentManager from './EquipmentManager'
import PaginatedProjectOverview from './PaginatedProjectOverview'
import PaginatedSuppliersPartners from './PaginatedSuppliersPartners'

// Utility function to convert snake_case to Title Case
function toTitleCase(str) {
  if (!str) return ''
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

// Function to calculate total cost dynamically from equipment and costs
function calculateTotalCost(equipment, costs, exchangeRate) {
  let equipmentTotal = 0
  let costsTotal = 0

  // Sum equipment costs: (unit_cost_usd * quantity) for each item
  if (equipment && equipment.length > 0) {
    equipmentTotal = equipment.reduce((sum, eq) => {
      const unitCost = Number(eq.unit_cost_usd || 0)
      const quantity = Number(eq.quantity || 1)
      return sum + (unitCost * quantity)
    }, 0)
  }

  // Sum project costs: budgeted_amount_usd for each cost item
  if (costs && costs.length > 0) {
    costsTotal = costs.reduce((sum, cost) => {
      return sum + (Number(cost.budgeted_amount_usd || 0))
    }, 0)
  }

  // Total in USD, convert to PHP
  const totalUsd = equipmentTotal + costsTotal
  const totalPhp = usdToPhp(totalUsd, exchangeRate)

  return { totalUsd, totalPhp, equipmentTotal, costsTotal }
}

function Modal({ children, onClose, className = '' }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className={`fixed inset-0 flex items-center justify-center z-[9999] ${className} w-full h-full min-h-screen`} onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div onClick={(e) => e.stopPropagation()} className="relative w-full flex items-center justify-center">
        {children}
      </div>
    </div>,
    document.body
  )
}

export default function Investments({ userId }) {
  const [projects, setProjects] = useState([])
  const [fundedMap, setFundedMap] = useState({})
  const [loading, setLoading] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showInvestModal, setShowInvestModal] = useState(false)
  const [projectContributions, setProjectContributions] = useState([])
  const [investAmount, setInvestAmount] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [wallets, setWallets] = useState([])

  // Extended project details
  const [projectEquipment, setProjectEquipment] = useState([])
  const [projectSuppliers, setProjectSuppliers] = useState([])
  const [projectPartners, setProjectPartners] = useState([])
  const [projectCosts, setProjectCosts] = useState([])
  const [productionCapacity, setProductionCapacity] = useState([])
  const [revenueForecast, setRevenueForecast] = useState([])
  const [projectMilestones, setProjectMilestones] = useState([])
  const [riskAssessment, setRiskAssessment] = useState([])
  const [financialMetrics, setFinancialMetrics] = useState([])
  const [detailTab, setDetailTab] = useState('overview')

  // Edit mode states
  const [editMode, setEditMode] = useState({})
  const [editingDescription, setEditingDescription] = useState('')
  const [editData, setEditData] = useState({
    equipment: [],
    suppliers: [],
    partnerships: [],
    costs: [],
    production: [],
    revenues: [],
    milestones: [],
    risks: [],
    metrics: []
  })
  const [saving, setSaving] = useState(false)
  const [exchangeRate, setExchangeRate] = useState(0.018)
  const [loadingRate, setLoadingRate] = useState(true)
  const [showEquipmentManager, setShowEquipmentManager] = useState(false)
  const [supplierEditPage, setSupplierEditPage] = useState(1)
  const [partnerEditPage, setPartnerEditPage] = useState(1)

  useEffect(() => {
    loadExchangeRate()
    loadProjects()
    loadWallets()
  }, [])

  async function loadExchangeRate() {
    try {
      const rate = await getPhpToUsdRate()
      setExchangeRate(rate)
    } catch (err) {
      console.warn('Failed to load exchange rate:', err)
      setExchangeRate(0.018)
    } finally {
      setLoadingRate(false)
    }
  }

  // Prevent background scrolling when modals are open
  useEffect(() => {
    const locked = showDetail || showInvestModal
    if (typeof document !== 'undefined') {
      document.body.style.overflow = locked ? 'hidden' : ''
    }
    return () => {
      if (typeof document !== 'undefined') document.body.style.overflow = ''
    }
  }, [showDetail, showInvestModal])

  async function loadWallets() {
    try {
      const { data } = await supabase.from('wallets').select('*').eq('user_id', userId)
      setWallets(data || [])
    } catch (err) {
      console.error('Failed loading wallets', err)
    }
  }

  async function loadProjects() {
    setLoading(true)
    try {
      const { data: projs, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setProjects(projs || [])

      // Load aggregated funded amounts for confirmed investments
      const { data: invs } = await supabase.from('investments').select('project_id, amount, status')
      const map = {}
      ;(invs || []).forEach(i => {
        if (i.status !== 'confirmed') return
        map[i.project_id] = (map[i.project_id] || 0) + Number(i.amount || 0)
      })
      setFundedMap(map)
    } catch (err) {
      console.error('Error loading projects', err)
      setError('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  function openInvestModal(project) {
    // Close detail first, then open invest modal to avoid both showing
    setShowDetail(false)
    setSelectedProject(project)
    setInvestAmount('')
    setError('')
    setSuccess('')
    setTimeout(() => setShowInvestModal(true), 50)
  }

  async function loadProjectContributions(projectId) {
    try {
      const { data: invs, error } = await supabase
        .from('investments')
        .select('id, user_id, amount, status, investment_date, users(id, email, full_name)')
        .eq('project_id', projectId)
        .eq('status', 'confirmed')

      if (error) throw error
      const contributions = (invs || []).map(i => ({
        id: i.id,
        user_id: i.user_id,
        amount: Number(i.amount || 0),
        email: i.users?.email || null,
        full_name: i.users?.full_name || null,
        date: i.investment_date
      }))

      const byUser = {}
      contributions.forEach(c => {
        if (!byUser[c.user_id]) byUser[c.user_id] = { user_id: c.user_id, full_name: c.full_name || c.email || 'Anonymous', email: c.email, total: 0 }
        byUser[c.user_id].total += c.amount
      })
      const arr = Object.values(byUser).sort((a, b) => b.total - a.total)
      setProjectContributions(arr)
    } catch (err) {
      console.error('Failed loading contributions', err)
      setProjectContributions([])
    }
  }

  async function loadProjectDetails(projectId) {
    try {
      const [eqp, sup, part, cost, cap, rev, mil, risk, fin] = await Promise.all([
        supabase.from('project_equipment').select('*').eq('project_id', projectId),
        supabase.from('project_suppliers').select('*').eq('project_id', projectId),
        supabase.from('project_partnerships').select('*').eq('project_id', projectId),
        supabase.from('project_costs').select('*').eq('project_id', projectId),
        supabase.from('production_capacity').select('*').eq('project_id', projectId),
        supabase.from('revenue_projections').select('*').eq('project_id', projectId).order('year_number'),
        supabase.from('project_milestones').select('*').eq('project_id', projectId).order('planned_date'),
        supabase.from('risk_assessment').select('*').eq('project_id', projectId),
        supabase.from('financial_metrics').select('*').eq('project_id', projectId)
      ])

      setProjectEquipment(eqp.data || [])
      setProjectSuppliers(sup.data || [])
      setProjectPartners(part.data || [])
      setProjectCosts(cost.data || [])
      setProductionCapacity(cap.data || [])
      setRevenueForecast(rev.data || [])
      setProjectMilestones(mil.data || [])
      setRiskAssessment(risk.data || [])
      setFinancialMetrics(fin.data || [])
    } catch (err) {
      console.error('Failed loading project details', err)
    }
  }

  function toggleEditMode(tab) {
    setEditMode(prev => ({ ...prev, [tab]: !prev[tab] }))
    if (!editMode[tab]) {
      // Initialize edit data when entering edit mode
      if (tab === 'suppliers') {
        setSupplierEditPage(1)
      } else if (tab === 'partnerships') {
        setPartnerEditPage(1)
      }
      switch (tab) {
        case 'equipment':
          setEditData(prev => ({ ...prev, equipment: JSON.parse(JSON.stringify(projectEquipment)) }))
          break
        case 'suppliers':
          setEditData(prev => ({ ...prev, suppliers: JSON.parse(JSON.stringify(projectSuppliers)) }))
          break
        case 'partnerships':
          setEditData(prev => ({ ...prev, partnerships: JSON.parse(JSON.stringify(projectPartners)) }))
          break
        case 'costs':
          setEditData(prev => ({ ...prev, costs: JSON.parse(JSON.stringify(projectCosts)) }))
          break
        case 'production':
          setEditData(prev => ({ ...prev, production: JSON.parse(JSON.stringify(productionCapacity)) }))
          break
        case 'revenues':
          setEditData(prev => ({ ...prev, revenues: JSON.parse(JSON.stringify(revenueForecast)) }))
          break
        case 'milestones':
          setEditData(prev => ({ ...prev, milestones: JSON.parse(JSON.stringify(projectMilestones)) }))
          break
        case 'risks':
          setEditData(prev => ({ ...prev, risks: JSON.parse(JSON.stringify(riskAssessment)) }))
          break
        case 'metrics':
          setEditData(prev => ({ ...prev, metrics: JSON.parse(JSON.stringify(financialMetrics)) }))
          break
      }
    }
  }

  async function saveChanges(tab) {
    if (!selectedProject) return
    setSaving(true)
    try {
      const table = {
        equipment: 'project_equipment',
        suppliers: 'project_suppliers',
        partnerships: 'project_partnerships',
        costs: 'project_costs',
        production: 'production_capacity',
        revenues: 'revenue_projections',
        milestones: 'project_milestones',
        risks: 'risk_assessment',
        metrics: 'financial_metrics'
      }[tab]

      const data = editData[tab]

      for (const item of data) {
        if (item.id) {
          // Update existing
          const { error } = await supabase
            .from(table)
            .update(item)
            .eq('id', item.id)
          if (error) throw error
        } else if (Object.keys(item).length > 0) {
          // Insert new
          const { error } = await supabase
            .from(table)
            .insert([{ ...item, project_id: selectedProject.id }])
          if (error) throw error
        }
      }

      setSuccess(`${tab} updated successfully`)
      await loadProjectDetails(selectedProject.id)
      toggleEditMode(tab)
    } catch (err) {
      console.error(`Failed saving ${tab}:`, err)
      setError(`Failed to save ${tab}: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function saveProjectDescription(description = null) {
    if (!selectedProject) return
    setSaving(true)
    try {
      const descToSave = description !== null ? description : editingDescription
      const { error } = await supabase
        .from('projects')
        .update({ long_description: descToSave })
        .eq('id', selectedProject.id)

      if (error) throw error

      setSuccess('Project overview updated successfully')
      setEditMode(prev => ({ ...prev, overview: false }))

      // Reload projects to reflect changes
      const { data } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (data) {
        setProjects(data)
        // Update selected project
        const updated = data.find(p => p.id === selectedProject.id)
        if (updated) setSelectedProject(updated)
      }
    } catch (err) {
      console.error('Failed saving description:', err)
      setError(`Failed to save: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  async function deleteItem(tab, itemId) {
    if (!confirm('Are you sure you want to delete this item?')) return
    try {
      const table = {
        equipment: 'project_equipment',
        suppliers: 'project_suppliers',
        partnerships: 'project_partnerships',
        costs: 'project_costs',
        production: 'production_capacity',
        revenues: 'revenue_projections',
        milestones: 'project_milestones',
        risks: 'risk_assessment',
        metrics: 'financial_metrics'
      }[tab]

      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', itemId)

      if (error) throw error
      setSuccess('Item deleted successfully')
      await loadProjectDetails(selectedProject.id)
    } catch (err) {
      setError(`Failed to delete: ${err.message}`)
    }
  }

  function openProjectDetail(project) {
    // Close invest modal first to keep modals exclusive
    setShowInvestModal(false)
    setSelectedProject(project)
    setShowDetail(true)
    setDetailTab('overview')
    setError('')
    setSuccess('')
    loadProjectContributions(project.id)
    loadProjectDetails(project.id)
  }

  async function handleInvest(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    const amount = parseFloat(investAmount)
    if (!selectedProject) return setError('No project selected')
    if (!amount || amount <= 0) return setError('Enter a valid amount')
    if (amount < Number(selectedProject.min_investment || 0)) return setError(`Minimum investment is ${selectedProject.min_investment}`)

    // Check user's wallet for this currency
    try {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
        .eq('currency_code', selectedProject.currency_code || 'PHP')
        .single()

      if (!wallet || wallet.balance < amount) {
        return setError('Insufficient balance in your wallet for this currency')
      }

      // Begin: create investment, create transaction, update wallet balance (best-effort atomicity)
      // NOTE: If you need true atomicity move this logic to a Postgres function or Edge function.
      const { data: invest, error: invErr } = await supabase
        .from('investments')
        .insert([
          {
            project_id: selectedProject.id,
            user_id: userId,
            amount,
            currency_code: selectedProject.currency_code || 'PHP',
            status: 'confirmed'
          }
        ])
        .select()
        .single()
      if (invErr) throw invErr

      const { error: txErr } = await supabase
        .from('transactions')
        .insert([
          {
            user_id: userId,
            type: 'investment',
            amount: -Math.abs(amount),
            currency: selectedProject.currency_code || 'PHP',
            description: `Investment in project ${selectedProject.name}`,
            project_id: selectedProject.id,
            reference_investment_id: invest.id,
            status: 'confirmed'
          }
        ])
      if (txErr) throw txErr

      const { error: updateWalletErr } = await supabase
        .from('wallets')
        .update({ balance: wallet.balance - amount, updated_at: new Date() })
        .eq('id', wallet.id)
      if (updateWalletErr) throw updateWalletErr

      setSuccess('Investment recorded successfully')
      // refresh data
      await loadProjects()
      await loadWallets()
      setShowInvestModal(false)
      setSelectedProject(null)
    } catch (err) {
      console.error('Investment failed', err)
      setError(err.message || 'Failed to process investment')
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-light text-slate-900">Investment Opportunities</h2>
        <div>
          <p className="text-sm text-slate-500">Manage and invest in listed projects.</p>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading...</p>}
      {error && <p className="text-sm text-slate-700 mb-3">{error}</p>}
      {success && <p className="text-sm text-slate-700 mb-3">{success}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {projects.map(p => {
          const funded = fundedMap[p.id] || 0
          const pct = p.total_cost > 0 ? ((funded / Number(p.total_cost)) * 100).toFixed(2) : '0.00'
          const totalPhp = Number(p.total_cost || 0)
          const totalUsd = phpToUsd(totalPhp, exchangeRate)
          const fundedPhp = Number(funded)
          const fundedUsd = phpToUsd(fundedPhp, exchangeRate)
          const remainingPhp = totalPhp - fundedPhp
          const remainingUsd = totalUsd - fundedUsd
          return (
            <div key={p.id} onClick={() => openProjectDetail(p)} className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <h3 className="text-lg font-medium text-slate-900 mb-2">{toTitleCase(p.name) || p.name}</h3>
              <p className="text-sm text-slate-600 mb-3">{toTitleCase(p.description) || p.description}</p>
              <div className="text-sm text-slate-700 space-y-2 mb-4">
                <div>
                  <div className="flex justify-between mb-1"><span>Total Cost</span></div>
                  <div><span className="font-medium">{formatPhp(totalPhp)}</span></div>
                  <div className="text-xs text-slate-500">{formatUsd(totalUsd)}</div>
                </div>
                <div>
                  <div className="flex justify-between mb-1"><span>Funded</span></div>
                  <div><span className="font-medium">{formatPhp(fundedPhp)}</span></div>
                  <div className="text-xs text-slate-500">{formatUsd(fundedUsd)}</div>
                </div>
                <div>
                  <div className="flex justify-between mb-1"><span>Remaining</span></div>
                  <div><span className="font-medium">{formatPhp(remainingPhp)}</span></div>
                  <div className="text-xs text-slate-500">{formatUsd(remainingUsd)}</div>
                </div>
                <div className="flex justify-between"><span>Progress</span><span className="font-medium">{pct}%</span></div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={(e) => { e.stopPropagation(); openInvestModal(p) }} className="flex-1 bg-slate-700 text-white py-2 rounded-lg text-sm hover:bg-slate-800">Invest</button>
                <button onClick={() => openProjectDetail(p)} className="px-3 py-2 text-sm text-slate-600 hover:text-slate-800">View Details</button>
              </div>
            </div>
          )
        })}
      </div>

      {showDetail && selectedProject && (
        <Modal onClose={() => setShowDetail(false)} className="">
          <div className="w-full max-w-6xl bg-white rounded-xl shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-semibold text-slate-900">{toTitleCase(selectedProject.name) || selectedProject.name}</h3>
                <p className="text-sm text-slate-600 mt-1">{toTitleCase(selectedProject.description) || selectedProject.description}</p>
              </div>
              <button onClick={() => setShowDetail(false)} className="text-sm text-slate-500 hover:text-slate-800">✕ Close</button>
            </div>

            <div className="border-b border-slate-200">
              <div className="flex justify-between items-center px-6">
                <div className="flex gap-1 overflow-x-auto">
                  {[
                    { id: 'overview', label: 'Overview' },
                    { id: 'equipment', label: 'Equipment' },
                    { id: 'costs', label: 'Costs' },
                    { id: 'suppliers', label: 'Suppliers & Partnerships' },
                    { id: 'production', label: 'Production' },
                    { id: 'financials', label: 'Financials' },
                    { id: 'timeline', label: 'Timeline' },
                    { id: 'risks', label: 'Risks' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setDetailTab(tab.id)}
                      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                        detailTab === tab.id
                          ? 'border-slate-400 text-slate-900'
                          : 'border-transparent text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                {detailTab !== 'overview' && detailTab !== 'equipment' && (
                  <div className="flex gap-2">
                    {editMode[detailTab] ? (
                      <>
                        <button
                          onClick={() => saveChanges(detailTab)}
                          disabled={saving}
                          className="px-3 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-800 disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => toggleEditMode(detailTab)}
                          className="px-3 py-2 bg-slate-300 text-slate-900 text-sm rounded hover:bg-slate-400"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => toggleEditMode(detailTab)}
                        className="px-3 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-800"
                      >
                        ✎ Edit
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6">
              {/* Overview Tab */}
              {detailTab === 'overview' && (
                <div className="space-y-6">
                  {/* Paginated Project Overview */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-4">Project Overview</h3>
                    <PaginatedProjectOverview
                      project={selectedProject}
                      editMode={editMode.overview}
                      editingDescription={editingDescription}
                      onEditingDescriptionChange={setEditingDescription}
                      onEdit={() => {
                        setEditingDescription(selectedProject.long_description || selectedProject.description || '')
                        setEditMode(prev => ({ ...prev, overview: true }))
                      }}
                      onSave={async (description) => {
                        await saveProjectDescription(description)
                      }}
                      isSaving={saving}
                    />
                  </div>

                  {(() => {
                    const calculatedCost = calculateTotalCost(projectEquipment, projectCosts, exchangeRate)
                    const fundedAmount = Number(fundedMap[selectedProject.id] || 0)
                    const fundedAmountUsd = phpToUsd(fundedAmount, exchangeRate)
                    const totalAmount = calculatedCost.totalPhp > 0 ? calculatedCost.totalPhp : Number(selectedProject.total_cost || 0)
                    const totalAmountUsd = calculatedCost.totalUsd > 0 ? calculatedCost.totalUsd : phpToUsd(Number(selectedProject.total_cost || 0), exchangeRate)
                    const remainingPhpAmount = totalAmount - fundedAmount
                    const remainingUsdAmount = totalAmountUsd - fundedAmountUsd
                    const percentage = totalAmount > 0 ? ((fundedAmount / totalAmount) * 100).toFixed(2) : '0.00'

                    return (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-slate-50 p-4 rounded-lg">
                            <div className="text-xs text-slate-600 mb-2">Total Cost</div>
                            <div className="text-lg font-semibold text-slate-900">{formatPhp(totalAmount)}</div>
                            <div className="text-sm text-slate-500 mt-1">{formatUsd(totalAmountUsd)}</div>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-lg">
                            <div className="text-xs text-slate-600 mb-2">Funded</div>
                            <div className="text-lg font-semibold text-slate-900">{formatPhp(fundedAmount)}</div>
                            <div className="text-sm text-slate-500 mt-1">{formatUsd(fundedAmountUsd)}</div>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-lg">
                            <div className="text-xs text-slate-600 mb-2">Remaining</div>
                            <div className="text-lg font-semibold text-slate-900">{formatPhp(remainingPhpAmount > 0 ? remainingPhpAmount : 0)}</div>
                            <div className="text-sm text-slate-500 mt-1">{formatUsd(remainingUsdAmount > 0 ? remainingUsdAmount : 0)}</div>
                          </div>
                        </div>

                        <div>
                          <div className="text-xs uppercase text-slate-500 mb-2 font-semibold">Funding Progress</div>
                          <div className="w-full bg-slate-200 rounded-full h-4">
                            <div className="bg-slate-400 h-4 rounded-full transition-all" style={{ width: `${percentage}%` }} />
                          </div>
                          <div className="text-sm text-slate-600 mt-2">{percentage}%</div>
                        </div>
                      </>
                    )
                  })()}

                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-3">Investor Distribution</h4>
                    {projectContributions.length === 0 ? (
                      <p className="text-sm text-slate-500">No contributions yet</p>
                    ) : (
                      <div className="space-y-2">
                        {projectContributions.map(c => {
                          const pct = (c.total / (fundedMap[selectedProject.id] || 1)) * 100
                          return (
                            <div key={c.user_id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                              <div>
                                <div className="text-sm font-medium text-slate-900">{c.full_name}</div>
                                <div className="text-xs text-slate-500">{c.email}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-semibold text-slate-900">{formatPhp(Number(c.total))}</div>
                                <div className="text-xs text-slate-600">{formatUsd(phpToUsd(Number(c.total), exchangeRate))}</div>
                                <div className="text-xs text-slate-500 mt-1">{pct.toFixed(1)}%</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <button onClick={() => openInvestModal(selectedProject)} className="w-full bg-slate-700 text-white py-3 rounded-lg font-medium hover:bg-slate-800">Invest in this Project</button>
                </div>
              )}

              {/* Equipment Tab */}
              {detailTab === 'equipment' && (
                <div className="space-y-4">
                  <button
                    onClick={() => setShowEquipmentManager(true)}
                    className="w-full px-6 py-4 bg-slate-700 text-white rounded-lg hover:bg-slate-800 font-medium text-lg"
                  >
                    Manage Equipment
                  </button>

                  {projectEquipment.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-slate-300 rounded-lg">
                      <p className="text-slate-600 mb-4">No equipment added yet</p>
                      <p className="text-sm text-slate-500">Click the button above to add equipment with detailed specifications and photos</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-slate-200 bg-slate-50">
                            <tr className="text-left text-slate-600 font-semibold text-xs">
                              <th className="pb-3 px-4 py-3">Equipment</th>
                              <th className="pb-3 px-4 py-3">Type</th>
                              <th className="pb-3 px-4 py-3">Capacity</th>
                              <th className="pb-3 px-4 py-3">Power (kW)</th>
                              <th className="pb-3 px-4 py-3">Unit Cost</th>
                              <th className="pb-3 px-4 py-3">Total Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {projectEquipment.map(eq => (
                              <tr key={eq.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="py-4 px-4 font-medium text-sm">{toTitleCase(eq.equipment_name) || eq.equipment_name}</td>
                                <td className="py-4 px-4 text-sm">{toTitleCase(eq.equipment_type) || '—'}</td>
                                <td className="py-4 px-4 text-sm">{eq.capacity_value ? `${eq.capacity_value} ${eq.capacity_unit}` : '—'}</td>
                                <td className="py-4 px-4 text-sm">{eq.power_consumption_kw || '—'}</td>
                                <td className="py-4 px-4 text-sm">
                                  <div className="font-medium">{formatPhp(usdToPhp(eq.unit_cost_usd || 0, exchangeRate))}</div>
                                  <div className="text-xs text-slate-500">{formatUsd(eq.unit_cost_usd || 0)}</div>
                                </td>
                                <td className="py-4 px-4 font-semibold text-sm text-slate-900">
                                  <div>{formatPhp(usdToPhp((eq.unit_cost_usd || 0) * (eq.quantity || 1), exchangeRate))}</div>
                                  <div className="text-xs text-slate-500">{formatUsd((eq.unit_cost_usd || 0) * (eq.quantity || 1))}</div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                        <div className="text-sm text-slate-900">
                          <span className="font-semibold">Total Equipment Cost: </span>
                          <div className="text-lg font-bold text-slate-900 mt-2">
                            <div>{formatPhp(usdToPhp(projectEquipment.reduce((sum, eq) => sum + ((eq.unit_cost_usd || 0) * (eq.quantity || 1)), 0), exchangeRate))}</div>
                            <div className="text-sm text-slate-600 mt-1">{formatUsd(projectEquipment.reduce((sum, eq) => sum + ((eq.unit_cost_usd || 0) * (eq.quantity || 1)), 0))}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* Costs Tab */}
              {detailTab === 'costs' && (
                <div className="space-y-4">
                  {editMode.costs ? (
                    <div className="space-y-4">
                      {editData.costs.length > 0 ? (
                        editData.costs.map((cost, idx) => (
                          <div key={cost.id || idx} className="p-4 border border-slate-200 rounded-lg">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="text-xs font-medium text-slate-700">Cost Category</label>
                                <input
                                  type="text"
                                  value={cost.cost_category || ''}
                                  onChange={(e) => {
                                    const updated = [...editData.costs]
                                    updated[idx].cost_category = e.target.value
                                    setEditData(prev => ({ ...prev, costs: updated }))
                                  }}
                                  className="w-full px-3 py-2 border rounded text-sm mt-1"
                                  placeholder="e.g., equipment, labor, permits"
                                />
                              </div>
                              <CurrencyInput
                                label="Budgeted Amount (PHP ⇄ USD)"
                                value={cost.budgeted_amount_php || cost.budgeted_amount_usd || 0}
                                onChange={(phpVal) => {
                                  const updated = [...editData.costs]
                                  updated[idx].budgeted_amount_php = phpVal
                                  updated[idx].budgeted_amount_usd = phpToUsd(phpVal, exchangeRate)
                                  setEditData(prev => ({ ...prev, costs: updated }))
                                }}
                                exchangeRate={exchangeRate}
                                invertible={true}
                              />
                              <CurrencyInput
                                label="Actual Amount (PHP ⇄ USD)"
                                value={cost.actual_amount_php || cost.actual_amount_usd || 0}
                                onChange={(phpVal) => {
                                  const updated = [...editData.costs]
                                  updated[idx].actual_amount_php = phpVal
                                  updated[idx].actual_amount_usd = phpToUsd(phpVal, exchangeRate)
                                  setEditData(prev => ({ ...prev, costs: updated }))
                                }}
                                exchangeRate={exchangeRate}
                                invertible={true}
                              />
                              <div>
                                <label className="text-xs font-medium text-slate-700">% of Total</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={cost.percentage_of_total || ''}
                                  onChange={(e) => {
                                    const updated = [...editData.costs]
                                    updated[idx].percentage_of_total = parseFloat(e.target.value) || null
                                    setEditData(prev => ({ ...prev, costs: updated }))
                                  }}
                                  className="w-full px-3 py-2 border rounded text-sm mt-1"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-slate-200">
                              <button
                                onClick={() => {
                                  const updated = editData.costs.filter((_, i) => i !== idx)
                                  setEditData(prev => ({ ...prev, costs: updated }))
                                }}
                                className="px-3 py-1 text-sm bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 border border-dashed border-slate-300 rounded-lg text-center">
                          <p className="text-slate-600 text-sm mb-3">No costs added yet</p>
                          <button
                            onClick={() => {
                              setEditData(prev => ({
                                ...prev,
                                costs: [...prev.costs, {}]
                              }))
                            }}
                            className="px-4 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-800"
                          >
                            + Add Cost
                          </button>
                        </div>
                      )}
                      {editData.costs.length > 0 && (
                        <button
                          onClick={() => {
                            setEditData(prev => ({
                              ...prev,
                              costs: [...prev.costs, {}]
                            }))
                          }}
                          className="px-4 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-800 w-full"
                        >
                          + Add More Costs
                        </button>
                      )}
                    </div>
                  ) : projectCosts.length === 0 ? (
                    <p className="text-slate-500">No cost breakdown available</p>
                  ) : (
                    <div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-slate-200">
                            <tr className="text-left text-slate-600 font-semibold text-xs">
                              <th className="pb-3 px-2">Category</th>
                              <th className="pb-3 px-2">Budgeted</th>
                              <th className="pb-3 px-2">Actual</th>
                              <th className="pb-3 px-2">% of Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {projectCosts.map(cost => (
                              <tr key={cost.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="py-3 px-2 font-medium text-sm">{toTitleCase(cost.cost_category) || cost.cost_category}</td>
                                <td className="py-3 px-2 text-sm">
                                  <div>{formatPhp(cost.budgeted_amount_php || usdToPhp(cost.budgeted_amount_usd || 0, exchangeRate))}</div>
                                  <div className="text-xs text-slate-500">{formatUsd(cost.budgeted_amount_usd || 0)}</div>
                                </td>
                                <td className="py-3 px-2 text-sm">
                                  {cost.actual_amount_usd ? (
                                    <>
                                      <div>{formatPhp(cost.actual_amount_php || usdToPhp(cost.actual_amount_usd || 0, exchangeRate))}</div>
                                      <div className="text-xs text-slate-500">{formatUsd(cost.actual_amount_usd)}</div>
                                    </>
                                  ) : '—'}
                                </td>
                                <td className="py-3 px-2">{cost.percentage_of_total ? `${cost.percentage_of_total.toFixed(1)}%` : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="text-sm font-semibold text-slate-900">Total Project Cost</div>
                        <div className="text-lg font-bold text-slate-900">
                          <div>{formatPhp(projectCosts.reduce((sum, c) => sum + (Number(c.budgeted_amount_php) || usdToPhp(c.budgeted_amount_usd || 0, exchangeRate)), 0))}</div>
                          <div className="text-sm text-slate-600 mt-1">{formatUsd(projectCosts.reduce((sum, c) => sum + (Number(c.budgeted_amount_usd) || 0), 0))}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Suppliers & Partnerships Tab */}
              {detailTab === 'suppliers' && (
                <div className="space-y-6">
                  {editMode.partnerships ? (
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 mb-4">Edit Partnerships</h4>
                        <div className="space-y-4">
                          {editData.partnerships.length > 0 ? (
                            (() => {
                              const itemsPerPage = 1
                              const totalPages = Math.ceil(editData.partnerships.length / itemsPerPage)
                              const startIdx = (partnerEditPage - 1) * itemsPerPage
                              const endIdx = startIdx + itemsPerPage
                              const paginatedPartners = editData.partnerships.slice(startIdx, endIdx)
                              return (
                                <>
                                  {paginatedPartners.map((partner, idx) => {
                                    const actualIdx = startIdx + idx
                                    return (
                              <div key={partner.id || idx} className="p-4 border border-slate-200 rounded-lg">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-xs font-medium text-slate-700">Partner Name *</label>
                                    <input
                                      type="text"
                                      value={partner.partner_name || ''}
                                      onChange={(e) => {
                                        const updated = [...editData.partnerships]
                                        updated[actualIdx].partner_name = e.target.value
                                        setEditData(prev => ({ ...prev, partnerships: updated }))
                                      }}
                                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                                      placeholder="e.g., Acme Distribution"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-slate-700">Partnership Type *</label>
                                    <select
                                      value={partner.partnership_type || ''}
                                      onChange={(e) => {
                                        const updated = [...editData.partnerships]
                                        updated[actualIdx].partnership_type = e.target.value
                                        setEditData(prev => ({ ...prev, partnerships: updated }))
                                      }}
                                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                                    >
                                      <option value="">Select type...</option>
                                      <option value="distribution">Distribution</option>
                                      <option value="manufacturing">Manufacturing</option>
                                      <option value="joint_venture">Joint Venture</option>
                                      <option value="supplier_partnership">Supplier Partnership</option>
                                      <option value="technology">Technology</option>
                                      <option value="marketing">Marketing</option>
                                      <option value="financial">Financial</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-slate-700">Contact Person</label>
                                    <input
                                      type="text"
                                      value={partner.contact_person || ''}
                                      onChange={(e) => {
                                        const updated = [...editData.partnerships]
                                        updated[actualIdx].contact_person = e.target.value
                                        setEditData(prev => ({ ...prev, partnerships: updated }))
                                      }}
                                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                                      placeholder="John Doe"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-slate-700">Email</label>
                                    <input
                                      type="email"
                                      value={partner.email || ''}
                                      onChange={(e) => {
                                        const updated = [...editData.partnerships]
                                        updated[actualIdx].email = e.target.value
                                        setEditData(prev => ({ ...prev, partnerships: updated }))
                                      }}
                                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                                      placeholder="john@example.com"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-slate-700">Phone</label>
                                    <input
                                      type="tel"
                                      value={partner.phone || ''}
                                      onChange={(e) => {
                                        const updated = [...editData.partnerships]
                                        updated[actualIdx].phone = e.target.value
                                        setEditData(prev => ({ ...prev, partnerships: updated }))
                                      }}
                                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                                      placeholder="+63 912 345 6789"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-slate-700">City</label>
                                    <input
                                      type="text"
                                      value={partner.city || ''}
                                      onChange={(e) => {
                                        const updated = [...editData.partnerships]
                                        updated[actualIdx].city = e.target.value
                                        setEditData(prev => ({ ...prev, partnerships: updated }))
                                      }}
                                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                                      placeholder="Manila"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-slate-700">Country</label>
                                    <input
                                      type="text"
                                      value={partner.country || ''}
                                      onChange={(e) => {
                                        const updated = [...editData.partnerships]
                                        updated[actualIdx].country = e.target.value
                                        setEditData(prev => ({ ...prev, partnerships: updated }))
                                      }}
                                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                                      placeholder="Philippines"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-slate-700">Partnership Status</label>
                                    <select
                                      value={partner.partnership_status || 'active'}
                                      onChange={(e) => {
                                        const updated = [...editData.partnerships]
                                        updated[actualIdx].partnership_status = e.target.value
                                        setEditData(prev => ({ ...prev, partnerships: updated }))
                                      }}
                                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                                    >
                                      <option value="active">Active</option>
                                      <option value="pending">Pending</option>
                                      <option value="suspended">Suspended</option>
                                      <option value="terminated">Terminated</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-slate-700">Start Date</label>
                                    <input
                                      type="date"
                                      value={partner.start_date || ''}
                                      onChange={(e) => {
                                        const updated = [...editData.partnerships]
                                        updated[actualIdx].start_date = e.target.value
                                        setEditData(prev => ({ ...prev, partnerships: updated }))
                                      }}
                                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-slate-700">End Date</label>
                                    <input
                                      type="date"
                                      value={partner.end_date || ''}
                                      onChange={(e) => {
                                        const updated = [...editData.partnerships]
                                        updated[actualIdx].end_date = e.target.value
                                        setEditData(prev => ({ ...prev, partnerships: updated }))
                                      }}
                                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-slate-700">Revenue Share %</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={partner.revenue_share_percentage || ''}
                                      onChange={(e) => {
                                        const updated = [...editData.partnerships]
                                        updated[actualIdx].revenue_share_percentage = parseFloat(e.target.value) || null
                                        setEditData(prev => ({ ...prev, partnerships: updated }))
                                      }}
                                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                                      placeholder="15.5"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-slate-700">Investment Amount (USD)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={partner.investment_amount_usd || ''}
                                      onChange={(e) => {
                                        const updated = [...editData.partnerships]
                                        updated[actualIdx].investment_amount_usd = parseFloat(e.target.value) || null
                                        setEditData(prev => ({ ...prev, partnerships: updated }))
                                      }}
                                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                                      placeholder="50000"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-slate-700">Contract Duration (months)</label>
                                    <input
                                      type="number"
                                      value={partner.contract_duration_months || ''}
                                      onChange={(e) => {
                                        const updated = [...editData.partnerships]
                                        updated[actualIdx].contract_duration_months = parseInt(e.target.value) || null
                                        setEditData(prev => ({ ...prev, partnerships: updated }))
                                      }}
                                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                                      placeholder="24"
                                    />
                                  </div>
                                  <div className="md:col-span-2">
                                    <label className="text-xs font-medium text-slate-700">Payment Terms</label>
                                    <input
                                      type="text"
                                      value={partner.payment_terms || ''}
                                      onChange={(e) => {
                                        const updated = [...editData.partnerships]
                                        updated[actualIdx].payment_terms = e.target.value
                                        setEditData(prev => ({ ...prev, partnerships: updated }))
                                      }}
                                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                                      placeholder="Net 30, FOB"
                                    />
                                  </div>
                                  <div className="md:col-span-2">
                                    <label className="text-xs font-medium text-slate-700">Key Terms</label>
                                    <textarea
                                      value={partner.key_terms || ''}
                                      onChange={(e) => {
                                        const updated = [...editData.partnerships]
                                        updated[actualIdx].key_terms = e.target.value
                                        setEditData(prev => ({ ...prev, partnerships: updated }))
                                      }}
                                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                                      placeholder="Key terms and conditions"
                                      rows="2"
                                    />
                                  </div>
                                  <div className="md:col-span-2">
                                    <label className="text-xs font-medium text-slate-700">Notes</label>
                                    <textarea
                                      value={partner.notes || ''}
                                      onChange={(e) => {
                                        const updated = [...editData.partnerships]
                                        updated[actualIdx].notes = e.target.value
                                        setEditData(prev => ({ ...prev, partnerships: updated }))
                                      }}
                                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                                      placeholder="Additional notes"
                                      rows="2"
                                    />
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-slate-200">
                                  <button
                                    onClick={() => {
                                      const updated = editData.partnerships.filter((_, i) => i !== actualIdx)
                                      setEditData(prev => ({ ...prev, partnerships: updated }))
                                    }}
                                    className="px-3 py-1 text-sm bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                                    )
                                  })}
                                  {totalPages > 1 && (
                                    <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                                      <div className="text-sm text-slate-600">Page {partnerEditPage} of {totalPages}</div>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => setPartnerEditPage(Math.max(1, partnerEditPage - 1))}
                                          disabled={partnerEditPage === 1}
                                          className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          ← Previous
                                        </button>
                                        <button
                                          onClick={() => setPartnerEditPage(Math.min(totalPages, partnerEditPage + 1))}
                                          disabled={partnerEditPage === totalPages}
                                          className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          Next →
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )
                            })()
                          ) : (
                            <div className="p-4 border border-dashed border-slate-300 rounded-lg text-center">
                              <p className="text-slate-600 text-sm mb-3">No partnerships added yet</p>
                              <button
                                onClick={() => {
                                  setEditData(prev => ({
                                    ...prev,
                                    partnerships: [...prev.partnerships, {}]
                                  }))
                                }}
                                className="px-4 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-800"
                              >
                                + Add Partnership
                              </button>
                            </div>
                          )}
                          {editData.partnerships.length > 0 && (
                            <button
                              onClick={() => {
                                setEditData(prev => ({
                                  ...prev,
                                  partnerships: [...prev.partnerships, {}]
                                }))
                              }}
                              className="px-4 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-800 w-full"
                            >
                              + Add More Partnerships
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : editMode.suppliers ? (
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 mb-4">Edit Suppliers</h4>
                        <div className="space-y-4">
                          {editData.suppliers.length > 0 ? (
                            (() => {
                              const itemsPerPage = 1
                              const totalPages = Math.ceil(editData.suppliers.length / itemsPerPage)
                              const startIdx = (supplierEditPage - 1) * itemsPerPage
                              const endIdx = startIdx + itemsPerPage
                              const paginatedSuppliers = editData.suppliers.slice(startIdx, endIdx)
                              return (
                                <>
                                  {paginatedSuppliers.map((sup, idx) => {
                                    const actualIdx = startIdx + idx
                                    return (
                              <div key={sup.id || idx} className="p-4 border border-slate-200 rounded-lg">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-xs font-medium text-slate-700">Supplier Name *</label>
                                    <input
                                      type="text"
                                      value={sup.supplier_name || ''}
                                      onChange={(e) => {
                                        const updated = [...editData.suppliers]
                                        updated[actualIdx].supplier_name = e.target.value
                                        setEditData(prev => ({ ...prev, suppliers: updated }))
                                      }}
                                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                                      placeholder="e.g., ABC Equipment Supplies"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-slate-700">Supplier Type</label>
                                    <input
                                      type="text"
                                      value={sup.supplier_type || ''}
                                      onChange={(e) => {
                                        const updated = [...editData.suppliers]
                                        updated[actualIdx].supplier_type = e.target.value
                                        setEditData(prev => ({ ...prev, suppliers: updated }))
                                      }}
                                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                                      placeholder="e.g., Equipment, Raw Materials"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-slate-700">Contact Person</label>
                                    <input
                                      type="text"
                                      value={sup.contact_person || ''}
                                      onChange={(e) => {
                                        const updated = [...editData.suppliers]
                                        updated[actualIdx].contact_person = e.target.value
                                        setEditData(prev => ({ ...prev, suppliers: updated }))
                                      }}
                                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                                      placeholder="John Smith"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-slate-700">Email</label>
                                    <input
                                      type="email"
                                      value={sup.email || ''}
                                      onChange={(e) => {
                                        const updated = [...editData.suppliers]
                                        updated[actualIdx].email = e.target.value
                                        setEditData(prev => ({ ...prev, suppliers: updated }))
                                      }}
                                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                                      placeholder="john@supplier.com"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-slate-700">Phone</label>
                                    <input
                                      type="tel"
                                      value={sup.phone || ''}
                                      onChange={(e) => {
                                        const updated = [...editData.suppliers]
                                        updated[actualIdx].phone = e.target.value
                                        setEditData(prev => ({ ...prev, suppliers: updated }))
                                      }}
                                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                                      placeholder="+63 2 1234 5678"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-slate-700">City</label>
                                    <input
                                      type="text"
                                      value={sup.city || ''}
                                      onChange={(e) => {
                                        const updated = [...editData.suppliers]
                                        updated[actualIdx].city = e.target.value
                                        setEditData(prev => ({ ...prev, suppliers: updated }))
                                      }}
                                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                                      placeholder="Metro Manila"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-slate-700">Country</label>
                                    <input
                                      type="text"
                                      value={sup.country || ''}
                                      onChange={(e) => {
                                        const updated = [...editData.suppliers]
                                        updated[actualIdx].country = e.target.value
                                        setEditData(prev => ({ ...prev, suppliers: updated }))
                                      }}
                                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                                      placeholder="Philippines"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-slate-700">Delivery Timeline (days)</label>
                                    <input
                                      type="number"
                                      value={sup.delivery_timeline_days || ''}
                                      onChange={(e) => {
                                        const updated = [...editData.suppliers]
                                        updated[actualIdx].delivery_timeline_days = parseInt(e.target.value) || null
                                        setEditData(prev => ({ ...prev, suppliers: updated }))
                                      }}
                                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                                      placeholder="30"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-slate-700">Warranty (months)</label>
                                    <input
                                      type="number"
                                      value={sup.warranty_months || ''}
                                      onChange={(e) => {
                                        const updated = [...editData.suppliers]
                                        updated[actualIdx].warranty_months = parseInt(e.target.value) || null
                                        setEditData(prev => ({ ...prev, suppliers: updated }))
                                      }}
                                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                                      placeholder="12"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-slate-700 flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={sup.is_primary || false}
                                        onChange={(e) => {
                                          const updated = [...editData.suppliers]
                                          updated[actualIdx].is_primary = e.target.checked
                                          setEditData(prev => ({ ...prev, suppliers: updated }))
                                        }}
                                        className="rounded"
                                      />
                                      Mark as Primary
                                    </label>
                                  </div>
                                  <div className="md:col-span-2">
                                    <label className="text-xs font-medium text-slate-700">Payment Terms</label>
                                    <input
                                      type="text"
                                      value={sup.payment_terms || ''}
                                      onChange={(e) => {
                                        const updated = [...editData.suppliers]
                                        updated[actualIdx].payment_terms = e.target.value
                                        setEditData(prev => ({ ...prev, suppliers: updated }))
                                      }}
                                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                                      placeholder="Net 30, FOB"
                                    />
                                  </div>
                                  <div className="md:col-span-2">
                                    <label className="text-xs font-medium text-slate-700">Notes</label>
                                    <textarea
                                      value={sup.notes || ''}
                                      onChange={(e) => {
                                        const updated = [...editData.suppliers]
                                        updated[actualIdx].notes = e.target.value
                                        setEditData(prev => ({ ...prev, suppliers: updated }))
                                      }}
                                      className="w-full px-3 py-2 border rounded text-sm mt-1"
                                      placeholder="Additional notes about supplier"
                                      rows="2"
                                    />
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-slate-200">
                                  <button
                                    onClick={() => {
                                      const updated = editData.suppliers.filter((_, i) => i !== actualIdx)
                                      setEditData(prev => ({ ...prev, suppliers: updated }))
                                    }}
                                    className="px-3 py-1 text-sm bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                                    )
                                  })}
                                  {totalPages > 1 && (
                                    <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                                      <div className="text-sm text-slate-600">Page {supplierEditPage} of {totalPages}</div>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => setSupplierEditPage(Math.max(1, supplierEditPage - 1))}
                                          disabled={supplierEditPage === 1}
                                          className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          ← Previous
                                        </button>
                                        <button
                                          onClick={() => setSupplierEditPage(Math.min(totalPages, supplierEditPage + 1))}
                                          disabled={supplierEditPage === totalPages}
                                          className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          Next →
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )
                            })()
                          ) : (
                            <div className="p-4 border border-dashed border-slate-300 rounded-lg text-center">
                              <p className="text-slate-600 text-sm mb-3">No suppliers added yet</p>
                              <button
                                onClick={() => {
                                  setEditData(prev => ({
                                    ...prev,
                                    suppliers: [...prev.suppliers, {}]
                                  }))
                                }}
                                className="px-4 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-800"
                              >
                                + Add Supplier
                              </button>
                            </div>
                          )}
                          {editData.suppliers.length > 0 && (
                            <button
                              onClick={() => {
                                setEditData(prev => ({
                                  ...prev,
                                  suppliers: [...prev.suppliers, {}]
                                }))
                              }}
                              className="px-4 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-800 w-full"
                            >
                              + Add More Suppliers
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <PaginatedSuppliersPartners
                      suppliers={projectSuppliers}
                      partnerships={projectPartners}
                      editMode={false}
                      itemsPerPage={3}
                      formatUsd={formatUsd}
                    />
                  )}
                </div>
              )}

              {/* Production Tab */}
              {detailTab === 'production' && (
                <div className="space-y-4">
                  {productionCapacity.length === 0 ? (
                    <p className="text-slate-500">No production capacity data available</p>
                  ) : (
                    <div className="space-y-3">
                      {productionCapacity.map(cap => (
                        <div key={cap.id} className="p-4 border border-slate-200 rounded-lg">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <div className="font-semibold text-slate-900">{toTitleCase(cap.phase_name) || cap.phase_name}</div>
                              <div className="text-sm text-slate-600">{toTitleCase(cap.product_type) || cap.product_type}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-slate-900">{cap.utilization_percentage}% Utilization</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <div className="text-xs text-slate-600">Per Hour</div>
                              <div className="font-medium">{cap.capacity_per_hour} {cap.capacity_unit}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-600">Per Day</div>
                              <div className="font-medium">{cap.capacity_per_day} {cap.capacity_unit}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-600">Per Month</div>
                              <div className="font-medium">{cap.capacity_per_month} {cap.capacity_unit}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-600">Per Year</div>
                              <div className="font-medium">{cap.capacity_per_year} {cap.capacity_unit}</div>
                            </div>
                          </div>
                          {cap.phase_start_date && (
                            <div className="mt-3 text-xs text-slate-600">
                              {cap.phase_start_date} to {cap.phase_end_date || 'ongoing'}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Financials Tab */}
              {detailTab === 'financials' && (
                <div className="space-y-4">
                  {revenueForecast.length === 0 && financialMetrics.length === 0 ? (
                    <p className="text-slate-500">No financial data available</p>
                  ) : (
                    <>
                      {revenueForecast.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900 mb-3">Revenue Projections</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="border-b border-slate-200">
                                <tr className="text-left text-slate-600 font-semibold text-xs">
                                  <th className="pb-3 px-2">Product</th>
                                  <th className="pb-3 px-2">Year</th>
                                  <th className="pb-3 px-2">Annual Volume</th>
                                  <th className="pb-3 px-2">Unit Price</th>
                                  <th className="pb-3 px-2">Annual Revenue</th>
                                </tr>
                              </thead>
                              <tbody>
                                {revenueForecast.map(rev => (
                                  <tr key={rev.id} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="py-3 px-2 font-medium text-sm">{toTitleCase(rev.product_type) || rev.product_type}</td>
                                    <td className="py-3 px-2 text-sm">Year {rev.year_number}</td>
                                    <td className="py-3 px-2 text-sm">{Number(rev.projected_annual_volume).toLocaleString()} {rev.volume_unit}</td>
                                    <td className="py-3 px-2 text-sm">
                                      <div>{formatPhp(rev.unit_price_php || usdToPhp(rev.unit_price_usd || 0, exchangeRate))}</div>
                                      <div className="text-xs text-slate-500">{formatUsd(rev.unit_price_usd || 0)}</div>
                                    </td>
                                    <td className="py-3 px-2 font-semibold text-sm">
                                      <div>{formatPhp(rev.projected_annual_revenue_php || usdToPhp(rev.projected_annual_revenue_usd || 0, exchangeRate))}</div>
                                      <div className="text-xs text-slate-500">{formatUsd(rev.projected_annual_revenue_usd || 0)}</div>
                                    </td>
                                  </tr>
                                ))}
                                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                                  <td colSpan="4" className="py-3 px-2 text-sm text-slate-900">Total Annual Revenue</td>
                                  <td className="py-3 px-2 text-sm">
                                    <div className="text-slate-900">{formatPhp(revenueForecast.reduce((sum, rev) => sum + (rev.projected_annual_revenue_php || usdToPhp(rev.projected_annual_revenue_usd || 0, exchangeRate)), 0))}</div>
                                    <div className="text-xs text-slate-600">{formatUsd(revenueForecast.reduce((sum, rev) => sum + (rev.projected_annual_revenue_usd || 0), 0))}</div>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {financialMetrics.length > 0 && (
                        <div className="mt-6">
                          <h4 className="text-sm font-semibold text-slate-900 mb-3">Key Metrics</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {financialMetrics.map(metric => {
                              const isCurrencyMetric = metric.unit_of_measure === 'USD' || metric.unit_of_measure?.includes('USD')
                              return (
                                <div key={metric.id} className="p-3 bg-slate-50 rounded-lg">
                                  <div className="text-xs text-slate-600 mb-1">{toTitleCase(metric.metric_name) || metric.metric_name}</div>
                                  <div className="text-lg font-semibold text-slate-900">
                                    {isCurrencyMetric ? formatPhp(usdToPhp(Number(metric.base_case_value), exchangeRate)) : `${Number(metric.base_case_value).toLocaleString()} ${metric.unit_of_measure}`}
                                </div>
                                {isCurrencyMetric && (
                                  <div className="text-sm text-slate-600 mt-1">
                                    {formatUsd(Number(metric.base_case_value))}
                                  </div>
                                )}
                                  {metric.conservative_case_value && (
                                    <div className="text-xs text-slate-600 mt-1">
                                      Conservative: {isCurrencyMetric ? formatUsd(Number(metric.conservative_case_value)) : Number(metric.conservative_case_value).toLocaleString()}
                                    </div>
                                  )}
                                  {metric.optimistic_case_value && (
                                    <div className="text-xs text-slate-600">
                                      Optimistic: {isCurrencyMetric ? formatUsd(Number(metric.optimistic_case_value)) : Number(metric.optimistic_case_value).toLocaleString()}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Timeline Tab */}
              {detailTab === 'timeline' && (
                <div className="space-y-3">
                  {projectMilestones.length === 0 ? (
                    <p className="text-slate-500">No timeline data available</p>
                  ) : (
                    projectMilestones.map(mile => (
                      <div key={mile.id} className="p-4 border border-slate-200 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-semibold text-slate-900">{toTitleCase(mile.milestone_name) || mile.milestone_name}</div>
                            <div className="text-xs text-slate-600 mt-1">{toTitleCase(mile.milestone_type) || mile.milestone_type}</div>
                          </div>
                          <div className={`px-2 py-1 rounded text-xs font-medium ${
                            mile.status === 'completed' ? 'bg-slate-200 text-slate-700' :
                            mile.status === 'in_progress' ? 'bg-slate-200 text-slate-700' :
                            mile.status === 'delayed' ? 'bg-slate-200 text-slate-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {toTitleCase(mile.status) || mile.status}
                          </div>
                        </div>
                        {mile.description && <p className="text-sm text-slate-600 mb-2">{mile.description}</p>}
                        <div className="text-xs text-slate-600">
                          Planned: {mile.planned_date} {mile.actual_date && `• Actual: ${mile.actual_date}`}
                        </div>
                        {mile.progress_percentage > 0 && (
                          <div className="mt-2">
                            <div className="w-full bg-slate-200 rounded h-2">
                              <div className="bg-slate-400 h-2 rounded" style={{ width: `${mile.progress_percentage}%` }} />
                            </div>
                            <div className="text-xs text-slate-600 mt-1">{mile.progress_percentage}%</div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Risks Tab */}
              {detailTab === 'risks' && (
                <div className="space-y-3">
                  {riskAssessment.length === 0 ? (
                    <p className="text-slate-500">No risk assessment data available</p>
                  ) : (
                    riskAssessment.map(risk => (
                      <div key={risk.id} className={`p-4 border rounded-lg ${
                        risk.impact_severity === 'critical' ? 'border-slate-300 bg-slate-50' :
                        risk.impact_severity === 'high' ? 'border-slate-300 bg-slate-50' :
                        'border-slate-200 bg-slate-50'
                      }`}>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-semibold text-slate-900">{toTitleCase(risk.risk_description) || risk.risk_description}</div>
                            <div className="text-xs text-slate-600 mt-1">{toTitleCase(risk.risk_category) || risk.risk_category}</div>
                          </div>
                          <div className={`px-2 py-1 rounded text-xs font-bold ${
                            risk.impact_severity === 'critical' ? 'bg-slate-300 text-slate-700' :
                            risk.impact_severity === 'high' ? 'bg-slate-300 text-slate-700' :
                            risk.impact_severity === 'medium' ? 'bg-slate-200 text-slate-700' :
                            'bg-slate-200 text-slate-700'
                          }`}>
                            {toTitleCase(risk.impact_severity) || risk.impact_severity}
                          </div>
                        </div>
                        <div className="text-sm mb-2">
                          Probability: {risk.probability_percentage}% | Risk Score: {risk.risk_score?.toFixed(1) || 'N/A'}
                        </div>
                        {risk.mitigation_strategy && (
                          <div className="text-sm text-slate-700 bg-white/50 p-2 rounded">
                            <strong>Mitigation:</strong> {risk.mitigation_strategy}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {showInvestModal && selectedProject && (
        <Modal onClose={() => setShowInvestModal(false)}>
          <div className="w-full max-w-lg bg-white rounded-xl p-6">
            <h3 className="text-lg font-medium text-slate-900 mb-2">Invest in {selectedProject.name}</h3>
            <p className="text-sm text-slate-600 mb-4">
              Minimum: {formatPhp(selectedProject.min_investment || 0)} <span className="text-slate-500">({formatUsd(phpToUsd(selectedProject.min_investment || 0, exchangeRate))})</span>
            </p>
            <form onSubmit={handleInvest} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Amount ({selectedProject.currency_code || 'PHP'})</label>
                <input type="number" step="0.01" value={investAmount} onChange={e => setInvestAmount(e.target.value)} className="w-full px-4 py-3 border rounded-lg" />
                {investAmount && (
                  <div className="text-xs text-slate-500 mt-2">
                    ≈ {formatUsd(phpToUsd(Number(investAmount) || 0, exchangeRate))} USD
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">From Wallet</label>
                <select className="w-full px-4 py-3 border rounded-lg">
                  {wallets.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.currency_code === 'PHP'
                        ? `${formatPhp(Number(w.balance))} (${formatUsd(phpToUsd(Number(w.balance), exchangeRate))} USD)`
                        : `${formatUsd(Number(w.balance))} (${formatPhp(usdToPhp(Number(w.balance), exchangeRate))} PHP)`}
                    </option>
                  ))}
                </select>
              </div>

              {error && <p className="text-sm text-slate-700">{error}</p>}
              {success && <p className="text-sm text-slate-700">{success}</p>}

              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-slate-700 text-white py-2 rounded-lg hover:bg-slate-800">Confirm Invest</button>
                <button type="button" onClick={() => setShowInvestModal(false)} className="px-4 py-2 border rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {showEquipmentManager && selectedProject && (
        <Modal onClose={() => {
          setShowEquipmentManager(false)
          loadProjectDetails(selectedProject.id)
        }}>
          <EquipmentManager
            projectId={selectedProject.id}
            onClose={() => {
              setShowEquipmentManager(false)
              loadProjectDetails(selectedProject.id)
            }}
            exchangeRate={exchangeRate}
          />
        </Modal>
      )}
    </div>
  )
}
