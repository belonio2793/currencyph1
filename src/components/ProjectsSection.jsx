import { useState } from 'react'

export default function ProjectsSection({ projects, loading }) {
  const [votes, setVotes] = useState({})
  const [contributions, setContributions] = useState({})

  const handleContribute = (projectId) => {
    alert(`Contributing to project ${projectId}... (Staging Mode)`)
    setContributions(prev => ({
      ...prev,
      [projectId]: true
    }))
    setTimeout(() => {
      setContributions(prev => ({
        ...prev,
        [projectId]: false
      }))
    }, 1000)
  }

  const handleVote = (projectId) => {
    setVotes(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }))
  }

  const getProgressPercent = (current, goal) => {
    return Math.min((current / goal) * 100, 100)
  }

  if (loading) {
    return (
      <div className="section-card text-center">
        <p className="text-gray-600">Loading projects...</p>
      </div>
    )
  }

  return (
    <div className="section-card">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Community Projects</h2>
      <p className="text-gray-600 mb-6 text-sm">Support ambitious, creative projects with transparent ownership and community consensus voting</p>

      <div className="project-grid">
        {projects.map((project) => (
          <div key={project.id} className="project-card hover:shadow-md transition-shadow">
            <div className="mb-4">
              <h3 className="text-lg font-bold text-gray-800 mb-1">{project.name}</h3>
              <p className="text-sm text-gray-600 mb-3">{project.description}</p>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <div className="flex justify-between text-xs text-gray-700 mb-1">
                  <span>Progress</span>
                  <span>{Math.round(getProgressPercent(project.current, project.goal))}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full"
                    style={{ width: `${getProgressPercent(project.current, project.goal)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2 rounded border border-gray-200">
                  <p className="text-gray-600">Raised</p>
                  <p className="font-semibold text-gray-800">₱{project.current.toLocaleString()}</p>
                </div>
                <div className="bg-white p-2 rounded border border-gray-200">
                  <p className="text-gray-600">Goal</p>
                  <p className="font-semibold text-gray-800">₱{project.goal.toLocaleString()}</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-2 rounded text-center">
                <p className="text-xs text-gray-700">
                  <strong>{project.ownership}% Ownership</strong> available
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleContribute(project.id)}
                disabled={contributions[project.id]}
                className="w-full btn-primary text-sm disabled:opacity-60"
              >
                {contributions[project.id] ? 'Contributing...' : 'Contribute'}
              </button>
              <button
                onClick={() => handleVote(project.id)}
                className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  votes[project.id]
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
              >
                {votes[project.id] ? '✓ Support' : 'Vote to Support'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
        <p className="text-xs text-green-800">
          <strong>Non-Profit Model:</strong> Contributions are tax-deductible write-offs. No guaranteed financial returns. Ownership grants voting rights and project credits.
        </p>
      </div>
    </div>
  )
}
