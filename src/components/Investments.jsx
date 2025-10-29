import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getCurrencySymbol, formatCurrency } from '../lib/currency'

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

  useEffect(() => {
    loadProjects()
    loadWallets()
  }, [])

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
    setSelectedProject(project)
    setInvestAmount('')
    setError('')
    setSuccess('')
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

  function openProjectDetail(project) {
    setSelectedProject(project)
    setShowDetail(true)
    setError('')
    setSuccess('')
    loadProjectContributions(project.id)
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
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-light text-slate-900">Investment Opportunities</h2>
        <div>
          <p className="text-sm text-slate-500">Manage and invest in listed projects.</p>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading...</p>}
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {success && <p className="text-sm text-emerald-600 mb-3">{success}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {projects.map(p => {
          const funded = fundedMap[p.id] || 0
          const pct = p.total_cost > 0 ? ((funded / Number(p.total_cost)) * 100).toFixed(2) : '0.00'
          return (
            <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
              <h3 className="text-lg font-medium text-slate-900 mb-2">{p.name}</h3>
              <p className="text-sm text-slate-600 mb-3">{p.description}</p>
              <div className="text-sm text-slate-700 space-y-1 mb-4">
                <div className="flex justify-between"><span>Total Cost</span><span className="font-medium">{getCurrencySymbol(p.currency_code || 'PHP')}{Number(p.total_cost || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Funded</span><span className="font-medium">{getCurrencySymbol(p.currency_code || 'PHP')}{Number(funded).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Remaining</span><span className="font-medium">{getCurrencySymbol(p.currency_code || 'PHP')}{(Number(p.total_cost || 0) - Number(funded)).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Progress</span><span className="font-medium">{pct}%</span></div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={(e) => { e.stopPropagation(); openInvestModal(p) }} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm">Invest</button>
                <button onClick={() => openProjectDetail(p)} className="px-3 py-2 text-sm text-slate-600 hover:text-slate-800">View Details</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Project Detail Modal */}
      {showDetail && selectedProject && (
        <div className="fixed inset-0 bg-black/40 flex items-start md:items-center justify-center z-50 p-6 overflow-auto">
          <div className="w-full max-w-4xl bg-white rounded-xl p-6 shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-2xl font-semibold text-slate-900">{selectedProject.name}</h3>
                <p className="text-sm text-slate-600 mt-1">{selectedProject.description}</p>
              </div>
              <div>
                <button onClick={() => setShowDetail(false)} className="text-sm text-slate-500 hover:text-slate-800">Close</button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <div className="text-sm text-slate-600">Total Cost</div>
                    <div className="font-medium">{getCurrencySymbol(selectedProject.currency_code || 'PHP')}{Number(selectedProject.total_cost || 0).toLocaleString()}</div>
                  </div>
                  <div className="flex justify-between mb-2">
                    <div className="text-sm text-slate-600">Funded</div>
                    <div className="font-medium">{getCurrencySymbol(selectedProject.currency_code || 'PHP')}{Number(fundedMap[selectedProject.id] || 0).toLocaleString()}</div>
                  </div>
                  <div className="flex justify-between mb-2">
                    <div className="text-sm text-slate-600">Remaining</div>
                    <div className="font-medium">{getCurrencySymbol(selectedProject.currency_code || 'PHP')}{(Number(selectedProject.total_cost || 0) - Number(fundedMap[selectedProject.id] || 0)).toLocaleString()}</div>
                  </div>

                  <div className="mt-4">
                    <div className="text-xs uppercase text-slate-500 mb-2">Funding Progress</div>
                    <div className="w-full bg-slate-200 rounded-full h-3">
                      <div className="bg-emerald-600 h-3 rounded-full" style={{ width: `${selectedProject.total_cost > 0 ? ((fundedMap[selectedProject.id] || 0) / Number(selectedProject.total_cost) * 100) : 0}%` }} />
                    </div>
                    <div className="text-xs text-slate-600 mt-2">{selectedProject.total_cost > 0 ? (((fundedMap[selectedProject.id] || 0) / Number(selectedProject.total_cost)) * 100).toFixed(2) : '0.00'}%</div>
                  </div>

                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-slate-900 mb-2">Contribution Distribution</h4>
                    {projectContributions.length === 0 ? (
                      <p className="text-sm text-slate-500">No contributions yet</p>
                    ) : (
                      <div className="space-y-2 text-sm">
                        {projectContributions.map(c => {
                          const pct = (c.total / (fundedMap[selectedProject.id] || 1)) * 100
                          return (
                            <div key={c.user_id} className="flex justify-between items-center">
                              <div>
                                <div className="font-medium">{c.full_name}</div>
                                <div className="text-xs text-slate-500">{c.email}</div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium">{getCurrencySymbol(selectedProject.currency_code || 'PHP')}{Number(c.total).toLocaleString()}</div>
                                <div className="text-xs text-slate-500">{pct.toFixed(2)}%</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <div className="bg-white border border-slate-100 rounded-lg p-4">
                  <div className="mb-4">
                    <div className="text-sm text-slate-600">Status</div>
                    <div className="font-medium">{selectedProject.status || 'funding'}</div>
                  </div>
                  <div className="mb-4">
                    <div className="text-sm text-slate-600">Min Investment</div>
                    <div className="font-medium">{getCurrencySymbol(selectedProject.currency_code || 'PHP')}{selectedProject.min_investment || 0}</div>
                  </div>

                  <div>
                    <button onClick={(e) => { e.stopPropagation(); openInvestModal(selectedProject) }} className="w-full bg-blue-600 text-white py-2 rounded-lg">Invest in this project</button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Invest Modal - simple inline panel */}
      {showInvestModal && selectedProject && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
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

              {error && <p className="text-sm text-red-600">{error}</p>}
              {success && <p className="text-sm text-emerald-600">{success}</p>}

              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-emerald-600 text-white py-2 rounded-lg">Confirm Invest</button>
                <button type="button" onClick={() => setSelectedProject(null)} className="px-4 py-2 border rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
