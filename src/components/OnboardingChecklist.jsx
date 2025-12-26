import React, { useState, useEffect, useRef, useCallback } from 'react'
import { onboardingService } from '../lib/onboardingService'
import { supabase } from '../lib/supabaseClient'

export default function OnboardingChecklist({ userId, userEmail, onTaskComplete, onOpenAddressModal, onOpenProfileModal, onOpenVerificationModal, onOpenCurrencyModal, onNavigate }) {
  const [tasks, setTasks] = useState([])
  const [progress, setProgress] = useState({ percentage: 0, completed: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)
  const [completingTaskId, setCompletingTaskId] = useState(null)
  const [showChecklist, setShowChecklist] = useState(true)

  const allCompleted = progress.completed === progress.total && progress.total === 4

  // Load tasks and preferences - memoized to avoid recreating on each render
  const loadTasks = useCallback(async () => {
    try {
      const [tasksData, progressData] = await Promise.all([
        onboardingService.getOnboardingTasks(userId),
        onboardingService.getOnboardingProgress(userId)
      ])
      setTasks(tasksData)
      setProgress(progressData)
    } catch (err) {
      console.error('Error loading tasks:', err)
    }
  }, [userId])

  // Load user preference for showing/hiding checklist
  const loadShowChecklistPreference = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('show_onboarding_checklist')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.warn('Error loading checklist preference:', error)
        return
      }

      if (data) {
        setShowChecklist(data.show_onboarding_checklist !== false)
      }
    } catch (err) {
      console.error('Error loading checklist preference:', err)
    }
  }, [userId])

  // Load tasks and preferences once on userId change
  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([
      loadTasks(),
      loadShowChecklistPreference()
    ]).finally(() => setLoading(false))
  }, [userId, loadTasks, loadShowChecklistPreference])

  // Auto-expand only when all tasks are completed
  useEffect(() => {
    if (allCompleted && showChecklist) {
      setIsExpanded(true)
    }
  }, [allCompleted, showChecklist])

  // Remove auto-detection to prevent unnecessary database queries
  // Tasks are now only validated when user explicitly clicks "Start"

  const handleTaskComplete = async (task) => {
    setCompletingTaskId(task.id)
    try {
      // Handle specific task actions first
      if (task.action === 'open-address-modal') {
        onOpenAddressModal?.()
      } else if (task.action === 'navigate-profile') {
        onOpenProfileModal?.()
      } else if (task.action === 'verify-email') {
        onOpenVerificationModal?.()
      } else if (task.action === 'set-currency') {
        onOpenCurrencyModal?.()
      }

      // Mark task as complete in database
      await onboardingService.updateTaskCompletion(userId, task.id, true)

      // Reload tasks to reflect changes
      await loadTasks()

      onTaskComplete?.(task)
    } catch (err) {
      console.error('Error completing task:', err)
    } finally {
      setCompletingTaskId(null)
    }
  }

  // Save preference to hide checklist permanently
  const handleRemoveChecklist = async () => {
    try {
      const { error } = await supabase
        .from('user_preferences')
        .update({ show_onboarding_checklist: false })
        .eq('user_id', userId)

      if (error) {
        console.error('Error saving checklist preference:', error)
        return
      }

      setShowChecklist(false)
    } catch (err) {
      console.error('Error removing checklist:', err)
    }
  }

  if (!userId || loading || !showChecklist) {
    return null
  }

  const incompleteTasks = tasks.filter(t => !t.completed)

  // Auto-collapse after showing completion
  const shouldShowExpanded = isExpanded || (allCompleted && progress.total > 0)

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-slate-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎯</span>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-slate-900">Welcome To Currency.ph</h3>
              <p className="text-sm text-slate-500">{allCompleted ? '✓ All tasks completed!' : 'Complete tasks to get started'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-900 transition-all duration-300"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <span className="text-sm font-medium text-slate-900 w-12">
                {progress.percentage}%
              </span>
            </div>
            {allCompleted && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemoveChecklist()
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                title="Remove checklist"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <button
              className="text-slate-400 hover:text-slate-600 transition-colors"
              title={shouldShowExpanded ? 'Collapse' : 'Expand'}
            >
              {shouldShowExpanded ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tasks List */}
      {isExpanded && (
        <div className="border-t border-slate-200">
          {incompleteTasks.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-sm text-slate-500">All tasks completed! 🎉</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {tasks.map(task => (
                <div
                  key={task.id}
                  className={`p-4 transition-all ${
                    task.completed ? 'bg-slate-50' : 'hover:bg-blue-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => handleTaskComplete(task)}
                      disabled={completingTaskId === task.id}
                      className={`mt-1 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        task.completed
                          ? 'bg-green-500 border-green-500'
                          : 'border-slate-300 hover:border-blue-500'
                      } disabled:opacity-50`}
                    >
                      {task.completed && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>

                    {/* Task Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className={`text-sm font-medium ${
                            task.completed ? 'text-slate-500 line-through' : 'text-slate-900'
                          }`}>
                            {task.icon} {task.title}
                          </h4>
                          <p className={`text-sm mt-1 ${
                            task.completed ? 'text-slate-400' : 'text-slate-600'
                          }`}>
                            {task.description}
                          </p>
                        </div>
                        {task.category !== 'essential' && (
                          <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                            task.category === 'important'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {task.category === 'important' ? '⭐ Important' : 'Optional'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    {!task.completed && (
                      <button
                        onClick={() => handleTaskComplete(task)}
                        disabled={completingTaskId === task.id}
                        className="flex-shrink-0 px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                      >
                        {completingTaskId === task.id ? 'Loading...' : 'Start'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer Stats */}
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-sm text-slate-600">
            {progress.completed} of {progress.total} tasks completed
          </div>
        </div>
      )}
    </div>
  )
}
