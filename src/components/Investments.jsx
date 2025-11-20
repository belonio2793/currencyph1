import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getCurrencySymbol, formatCurrency } from '../lib/currency'
import { getPhpToUsdRate, phpToUsd, usdToPhp, formatPhp, formatUsd, CurrencyInput } from '../lib/currencyConversion'
import { createPortal } from 'react-dom'
import EquipmentManager from './EquipmentManager'

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
      const [eqp, sup, cost, cap, rev, mil, risk, fin] = await Promise.all([
        supabase.from('project_equipment').select('*').eq('project_id', projectId),
        supabase.from('project_suppliers').select('*').eq('project_id', projectId),
        supabase.from('project_costs').select('*').eq('project_id', projectId),
        supabase.from('production_capacity').select('*').eq('project_id', projectId),
        supabase.from('revenue_projections').select('*').eq('project_id', projectId).order('year_number'),
        supabase.from('project_milestones').select('*').eq('project_id', projectId).order('planned_date'),
        supabase.from('risk_assessment').select('*').eq('project_id', projectId),
        supabase.from('financial_metrics').select('*').eq('project_id', projectId)
      ])

      setProjectEquipment(eqp.data || [])
      setProjectSuppliers(sup.data || [])
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
      switch (tab) {
        case 'equipment':
          setEditData(prev => ({ ...prev, equipment: JSON.parse(JSON.stringify(projectEquipment)) }))
          break
        case 'suppliers':
          setEditData(prev => ({ ...prev, suppliers: JSON.parse(JSON.stringify(projectSuppliers)) }))
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

  async function saveProjectDescription() {
    if (!selectedProject) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('projects')
        .update({ long_description: editingDescription })
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
          return (
            <div key={p.id} onClick={() => openProjectDetail(p)} className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <h3 className="text-lg font-medium text-slate-900 mb-2">{p.name}</h3>
              <p className="text-sm text-slate-600 mb-3">{p.description}</p>
              <div className="text-sm text-slate-700 space-y-1 mb-4">
                <div className="flex justify-between"><span>Total Cost</span><span className="font-medium">{getCurrencySymbol(p.currency_code || 'PHP')}{Number(p.total_cost || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Funded</span><span className="font-medium">{getCurrencySymbol(p.currency_code || 'PHP')}{Number(funded).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Remaining</span><span className="font-medium">{getCurrencySymbol(p.currency_code || 'PHP')}{(Number(p.total_cost || 0) - Number(funded)).toLocaleString()}</span></div>
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
                <h3 className="text-2xl font-semibold text-slate-900">{selectedProject.name}</h3>
                <p className="text-sm text-slate-600 mt-1">{selectedProject.description}</p>
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
                  {/* Project Description */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-slate-900">Project Overview</h3>
                      <button
                        onClick={() => {
                          if (editMode.overview) {
                            saveProjectDescription()
                          } else {
                            setEditingDescription(selectedProject.long_description || selectedProject.description || '')
                            setEditMode(prev => ({ ...prev, overview: true }))
                          }
                        }}
                        disabled={saving}
                        className="px-3 py-2 bg-slate-700 text-white text-sm rounded hover:bg-slate-800 disabled:opacity-50"
                      >
                        {editMode.overview ? (saving ? 'Saving...' : 'Save Description') : '✎ Edit'}
                      </button>
                    </div>
                    {editMode.overview ? (
                      <textarea
                        value={editingDescription}
                        onChange={(e) => setEditingDescription(e.target.value)}
                        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 font-mono text-sm"
                        rows="15"
                        placeholder="Enter project overview and description..."
                      />
                    ) : (
                      <div className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">
                        {selectedProject.long_description || selectedProject.description || (
                          <span className="text-slate-500 italic">
                            {selectedProject.name === 'Coconut Oil & Water Processing Plant' || selectedProject.project_type === 'agriculture'
                              ? 'Click Edit to add detailed project overview describing coconut components, products, equipment requirements, and integrated processing workflows.'
                              : 'No description added yet. Click Edit to add project overview.'}
                          </span>
                        )}
                      </div>
                    )}
                    {editMode.overview && (
                      <button
                        onClick={() => setEditMode(prev => ({ ...prev, overview: false }))}
                        className="mt-3 px-3 py-2 border border-slate-300 text-slate-700 text-sm rounded hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-50 p-4 rounded-lg">
                      <div className="text-xs text-slate-600 mb-1">Total Cost</div>
                      <div className="text-xl font-semibold text-slate-900">{getCurrencySymbol(selectedProject.currency_code || 'PHP')}{Number(selectedProject.total_cost || 0).toLocaleString()}</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg">
                      <div className="text-xs text-slate-600 mb-1">Funded</div>
                      <div className="text-xl font-semibold text-slate-900">{getCurrencySymbol(selectedProject.currency_code || 'PHP')}{Number(fundedMap[selectedProject.id] || 0).toLocaleString()}</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg">
                      <div className="text-xs text-slate-600 mb-1">Remaining</div>
                      <div className="text-xl font-semibold text-slate-900">{getCurrencySymbol(selectedProject.currency_code || 'PHP')}{(Number(selectedProject.total_cost || 0) - Number(fundedMap[selectedProject.id] || 0)).toLocaleString()}</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase text-slate-500 mb-2 font-semibold">Funding Progress</div>
                    <div className="w-full bg-slate-200 rounded-full h-4">
                      <div className="bg-slate-400 h-4 rounded-full transition-all" style={{ width: `${selectedProject.total_cost > 0 ? ((fundedMap[selectedProject.id] || 0) / Number(selectedProject.total_cost) * 100) : 0}%` }} />
                    </div>
                    <div className="text-sm text-slate-600 mt-2">{selectedProject.total_cost > 0 ? (((fundedMap[selectedProject.id] || 0) / Number(selectedProject.total_cost)) * 100).toFixed(2) : '0.00'}%</div>
                  </div>

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
                                <div className="text-sm font-semibold text-slate-900">{getCurrencySymbol(selectedProject.currency_code || 'PHP')}{Number(c.total).toLocaleString()}</div>
                                <div className="text-xs text-slate-500">{pct.toFixed(2)}%</div>
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
                                <td className="py-4 px-4 font-medium text-sm">{eq.equipment_name}</td>
                                <td className="py-4 px-4 text-sm">{eq.equipment_type || '—'}</td>
                                <td className="py-4 px-4 text-sm">{eq.capacity_value ? `${eq.capacity_value} ${eq.capacity_unit}` : '—'}</td>
                                <td className="py-4 px-4 text-sm">{eq.power_consumption_kw || '—'}</td>
                                <td className="py-4 px-4 text-sm">
                                  <div className="font-medium">{formatUsd(eq.unit_cost_usd || 0)}</div>
                                </td>
                                <td className="py-4 px-4 font-semibold text-sm text-slate-900">
                                  {formatUsd((eq.unit_cost_usd || 0) * (eq.quantity || 1))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                        <div className="text-sm text-slate-900">
                          <span className="font-semibold">Total Equipment Cost: </span>
                          <span className="text-lg font-bold text-slate-900">
                            {formatUsd(projectEquipment.reduce((sum, eq) => sum + ((eq.unit_cost_usd || 0) * (eq.quantity || 1)), 0))}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {projectSuppliers.length > 0 && (
                    <div className="mt-6 border-t pt-6">
                      <h4 className="text-sm font-semibold text-slate-900 mb-3">Suppliers</h4>
                      <div className="space-y-3">
                        {projectSuppliers.map(sup => (
                          <div key={sup.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <div className="font-medium text-slate-900">{sup.supplier_name}</div>
                            {sup.supplier_type && <div className="text-xs font-medium text-slate-700 mt-1">Type: {sup.supplier_type}</div>}
                            <div className="text-xs text-slate-600 mt-2 space-y-1">
                              {sup.contact_person && <div>👤 {sup.contact_person}</div>}
                              {sup.email && <div>📧 {sup.email}</div>}
                              {sup.phone && <div>📞 {sup.phone}</div>}
                              {sup.city && sup.country && <div>📍 {sup.city}, {sup.country}</div>}
                              {sup.delivery_timeline_days && <div>🚚 Delivery: {sup.delivery_timeline_days} days</div>}
                            </div>
                          </div>
                        ))}
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
                                <td className="py-3 px-2 font-medium text-sm">{cost.cost_category}</td>
                                <td className="py-3 px-2 text-sm">
                                  <div>{formatPhp(cost.budgeted_amount_php || phpToUsd(cost.budgeted_amount_usd || 0, exchangeRate))}</div>
                                  <div className="text-xs text-slate-500">{formatUsd(cost.budgeted_amount_usd || 0)}</div>
                                </td>
                                <td className="py-3 px-2 text-sm">
                                  {cost.actual_amount_usd ? (
                                    <>
                                      <div>{formatPhp(cost.actual_amount_php || phpToUsd(cost.actual_amount_usd || 0, exchangeRate))}</div>
                                      <div className="text-xs text-slate-500">{formatUsd(cost.actual_amount_usd)}</div>
                                    </>
                                  ) : '��'}
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
                          <div>{formatPhp(projectCosts.reduce((sum, c) => sum + (Number(c.budgeted_amount_php) || phpToUsd(c.budgeted_amount_usd || 0, exchangeRate)), 0))}</div>
                          <div className="text-sm text-slate-700 mt-1">{formatUsd(projectCosts.reduce((sum, c) => sum + (Number(c.budgeted_amount_usd) || 0), 0))}</div>
                        </div>
                      </div>
                    </div>
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
                              <div className="font-semibold text-slate-900">{cap.phase_name}</div>
                              <div className="text-sm text-slate-600">{cap.product_type}</div>
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
                                    <td className="py-3 px-2 font-medium text-sm">{rev.product_type}</td>
                                    <td className="py-3 px-2 text-sm">Year {rev.year_number}</td>
                                    <td className="py-3 px-2 text-sm">{Number(rev.projected_annual_volume).toLocaleString()} {rev.volume_unit}</td>
                                    <td className="py-3 px-2 text-sm">
                                      <div>{formatPhp(rev.unit_price_php || phpToUsd(rev.unit_price_usd || 0, exchangeRate))}</div>
                                      <div className="text-xs text-slate-500">{formatUsd(rev.unit_price_usd || 0)}</div>
                                    </td>
                                    <td className="py-3 px-2 font-semibold text-sm">
                                      <div>{formatPhp(rev.projected_annual_revenue_php || phpToUsd(rev.projected_annual_revenue_usd || 0, exchangeRate))}</div>
                                      <div className="text-xs text-slate-500">{formatUsd(rev.projected_annual_revenue_usd || 0)}</div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {financialMetrics.length > 0 && (
                        <div className="mt-6">
                          <h4 className="text-sm font-semibold text-slate-900 mb-3">Key Metrics</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {financialMetrics.map(metric => (
                              <div key={metric.id} className="p-3 bg-slate-50 rounded-lg">
                                <div className="text-xs text-slate-600 mb-1">{metric.metric_name}</div>
                                <div className="text-lg font-semibold text-slate-900">
                                  {Number(metric.base_case_value).toLocaleString()} {metric.unit_of_measure}
                                </div>
                                {metric.conservative_case_value && (
                                  <div className="text-xs text-slate-600 mt-1">
                                    Conservative: {Number(metric.conservative_case_value).toLocaleString()}
                                  </div>
                                )}
                                {metric.optimistic_case_value && (
                                  <div className="text-xs text-slate-600">
                                    Optimistic: {Number(metric.optimistic_case_value).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            ))}
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
                            <div className="font-semibold text-slate-900">{mile.milestone_name}</div>
                            <div className="text-xs text-slate-600 mt-1">{mile.milestone_type}</div>
                          </div>
                          <div className={`px-2 py-1 rounded text-xs font-medium ${
                            mile.status === 'completed' ? 'bg-slate-200 text-slate-700' :
                            mile.status === 'in_progress' ? 'bg-slate-200 text-slate-700' :
                            mile.status === 'delayed' ? 'bg-slate-200 text-slate-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {mile.status}
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
                            <div className="font-semibold text-slate-900">{risk.risk_description}</div>
                            <div className="text-xs text-slate-600 mt-1">{risk.risk_category}</div>
                          </div>
                          <div className={`px-2 py-1 rounded text-xs font-bold ${
                            risk.impact_severity === 'critical' ? 'bg-slate-300 text-slate-700' :
                            risk.impact_severity === 'high' ? 'bg-slate-300 text-slate-700' :
                            risk.impact_severity === 'medium' ? 'bg-slate-200 text-slate-700' :
                            'bg-slate-200 text-slate-700'
                          }`}>
                            {risk.impact_severity?.toUpperCase()}
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
            <p className="text-sm text-slate-600 mb-4">Minimum: {getCurrencySymbol(selectedProject.currency_code || 'PHP')}{selectedProject.min_investment || 0}</p>
            <form onSubmit={handleInvest} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Amount ({selectedProject.currency_code || 'PHP'})</label>
                <input type="number" step="0.01" value={investAmount} onChange={e => setInvestAmount(e.target.value)} className="w-full px-4 py-3 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">From Wallet</label>
                <select className="w-full px-4 py-3 border rounded-lg">
                  {wallets.map(w => (
                    <option key={w.id} value={w.id}>{getCurrencySymbol(w.currency_code)}{Number(w.balance).toLocaleString()} ({w.currency_code})</option>
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
