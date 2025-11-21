import React, { useState, useEffect } from 'react'
import { employeeInvitationService } from '../lib/employeeInvitationService'
import { supabase } from '../lib/supabaseClient'
import JobInvitationCard from './JobInvitationCard'
import MyBusinessCard from './MyBusinessCard'
import ActiveJobCard from './ActiveJobCard'

export default function EmployeeDashboard({ userId }) {
  const [activeTab, setActiveTab] = useState('invitations')
  const [pendingInvitations, setPendingInvitations] = useState([])
  const [employeeBusinesses, setEmployeeBusinesses] = useState([])
  const [activeJobs, setActiveJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [invitationCount, setInvitationCount] = useState(0)
  const [businessCount, setBusinessCount] = useState(0)
  const [jobCount, setJobCount] = useState(0)

  useEffect(() => {
    loadData()

    // Subscribe to real-time updates
    const invSub = employeeInvitationService.subscribeToInvitations(userId, (payload) => {
      if (payload.eventType === 'INSERT') {
        loadInvitations()
      } else if (payload.eventType === 'UPDATE') {
        loadInvitations()
      }
    })

    const assgSub = employeeInvitationService.subscribeToAssignments(userId, (payload) => {
      if (payload.eventType === 'INSERT') {
        loadBusinesses()
        loadActiveJobs()
      } else if (payload.eventType === 'UPDATE') {
        loadBusinesses()
        loadActiveJobs()
      }
    })

    return () => {
      invSub.unsubscribe()
      assgSub.unsubscribe()
    }
  }, [userId])

  const loadData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        loadInvitations(),
        loadBusinesses(),
        loadActiveJobs()
      ])
    } catch (error) {
      const errorMsg = error?.message || JSON.stringify(error)
      console.error('Error loading employee dashboard data:', errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const loadInvitations = async () => {
    try {
      const { data } = await employeeInvitationService.getPendingInvitations(userId)
      setPendingInvitations(data || [])
      setInvitationCount(data?.length || 0)
    } catch (error) {
      const errorMsg = error?.message || JSON.stringify(error)
      console.error('Error loading invitations:', errorMsg)
    }
  }

  const loadBusinesses = async () => {
    try {
      const { data } = await employeeInvitationService.getEmployeeBusinesses(userId)
      setEmployeeBusinesses(data || [])
      setBusinessCount(data?.length || 0)
    } catch (error) {
      const errorMsg = error?.message || JSON.stringify(error)
      console.error('Error loading businesses:', errorMsg)
    }
  }

  const loadActiveJobs = async () => {
    try {
      // Fetch active job offers
      const { data } = await employeeInvitationService.getEmployeeJobOffers(userId, 'accepted')
      setActiveJobs(data || [])
      setJobCount(data?.length || 0)
    } catch (error) {
      const errorMsg = error?.message || JSON.stringify(error)
      console.error('Error loading active jobs:', errorMsg)
    }
  }

  const handleInvitationAccepted = async () => {
    await loadInvitations()
    await loadBusinesses()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-500">Loading your employment information...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">My Employment</h2>
        <p className="text-slate-600 mt-2">Manage your job invitations, businesses, and active positions</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('invitations')}
          className={`px-4 py-3 font-medium transition-colors border-b-2 ${
            activeTab === 'invitations'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center gap-2">
            Job Invitations
            {invitationCount > 0 && (
              <span className="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                {invitationCount}
              </span>
            )}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('businesses')}
          className={`px-4 py-3 font-medium transition-colors border-b-2 ${
            activeTab === 'businesses'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center gap-2">
            My Businesses
            {businessCount > 0 && (
              <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                {businessCount}
              </span>
            )}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('jobs')}
          className={`px-4 py-3 font-medium transition-colors border-b-2 ${
            activeTab === 'jobs'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <span className="flex items-center gap-2">
            Active Jobs
            {jobCount > 0 && (
              <span className="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                {jobCount}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {/* Invitations Tab */}
        {activeTab === 'invitations' && (
          <div className="space-y-4">
            {pendingInvitations.length === 0 ? (
              <div className="bg-slate-50 rounded-lg p-12 text-center border-2 border-dashed border-slate-200">
                <svg className="w-16 h-16 mx-auto text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <p className="text-slate-600 text-lg font-medium">No pending invitations</p>
                <p className="text-slate-500 mt-2">When businesses invite you to work, they'll appear here</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {pendingInvitations.map(invitation => (
                  <JobInvitationCard
                    key={invitation.id}
                    invitation={invitation}
                    userId={userId}
                    onInvitationAccepted={handleInvitationAccepted}
                    onInvitationRejected={loadInvitations}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Businesses Tab */}
        {activeTab === 'businesses' && (
          <div className="space-y-4">
            {employeeBusinesses.length === 0 ? (
              <div className="bg-slate-50 rounded-lg p-12 text-center border-2 border-dashed border-slate-200">
                <svg className="w-16 h-16 mx-auto text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <p className="text-slate-600 text-lg font-medium">No active businesses</p>
                <p className="text-slate-500 mt-2">Accept a job invitation to start working with a business</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {employeeBusinesses.map(business => (
                  <MyBusinessCard
                    key={business.id}
                    business={business}
                    userId={userId}
                    onStatusChange={loadBusinesses}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Active Jobs Tab */}
        {activeTab === 'jobs' && (
          <div className="space-y-4">
            {activeJobs.length === 0 ? (
              <div className="bg-slate-50 rounded-lg p-12 text-center border-2 border-dashed border-slate-200">
                <svg className="w-16 h-16 mx-auto text-slate-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-slate-600 text-lg font-medium">No active job offers</p>
                <p className="text-slate-500 mt-2">Accept a job offer to view it here</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {activeJobs.map(job => (
                  <ActiveJobCard
                    key={job.id}
                    job={job}
                    userId={userId}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
