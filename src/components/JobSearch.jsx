import { useState, useEffect, useRef } from 'react'
import { jobsService } from '../lib/jobsService'
import './JobSearch.css'

export default function JobSearch({ onFilterChange, categories = [], cities = [] }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    city: '',
    jobType: '',
    minRate: '',
    maxRate: ''
  })
  const suggestionsRef = useRef(null)
  const searchInputRef = useRef(null)

  // Fetch search suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchTerm.length > 2) {
        try {
          const data = await jobsService.getSearchSuggestions(searchTerm)
          const uniqueSuggestions = [
            ...new Map(
              data.map(item => [
                item.job_title,
                { title: item.job_title, category: item.job_category, city: item.city }
              ])
            ).values()
          ].slice(0, 8)
          setSuggestions(uniqueSuggestions)
          setShowSuggestions(true)
        } catch (err) {
          console.error('Error fetching suggestions:', err)
        }
      } else {
        setSuggestions([])
        setShowSuggestions(false)
      }
    }

    const timer = setTimeout(fetchSuggestions, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value)
  }

  const handleSuggestionClick = (suggestion) => {
    setSearchTerm(suggestion.title)
    setShowSuggestions(false)
    setFilters({
      ...filters,
      search: suggestion.title
    })
    onFilterChange({
      ...filters,
      search: suggestion.title
    })
  }

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    const newFilters = { ...filters, [name]: value }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const handleSearch = (e) => {
    e.preventDefault()
    const newFilters = { ...filters, search: searchTerm }
    setFilters(newFilters)
    onFilterChange(newFilters)
    setShowSuggestions(false)
  }

  const handleClearFilters = () => {
    setSearchTerm('')
    setSuggestions([])
    setFilters({
      search: '',
      category: '',
      city: '',
      jobType: '',
      minRate: '',
      maxRate: ''
    })
    onFilterChange({
      search: '',
      category: '',
      city: '',
      jobType: '',
      minRate: '',
      maxRate: ''
    })
  }

  const hasActiveFilters = Object.values(filters).some(v => v !== '')

  return (
    <div className="job-search-container">
      <div className="search-section">
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-wrapper" ref={suggestionsRef}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search jobs by title, category, or keyword..."
              value={searchTerm}
              onChange={handleSearchChange}
              onFocus={() => searchTerm.length > 2 && setShowSuggestions(true)}
              className="search-input"
            />
            <button type="submit" className="search-btn">
              Search
            </button>

            {/* Autocomplete Suggestions */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="suggestions-dropdown">
                {suggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    className="suggestion-item"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <div className="suggestion-title">{suggestion.title}</div>
                    <div className="suggestion-meta">
                      {suggestion.category && (
                        <span className="meta-badge">{suggestion.category}</span>
                      )}
                      {suggestion.city && (
                        <span className="meta-badge">{suggestion.city}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Filter Section */}
      <div className="filters-section">
        <div className="filters-grid">
          <div className="filter-group">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              name="category"
              value={filters.category}
              onChange={handleFilterChange}
              className="filter-select"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="city">City</label>
            <select
              id="city"
              name="city"
              value={filters.city}
              onChange={handleFilterChange}
              className="filter-select"
            >
              <option value="">All Cities</option>
              {cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="jobType">Job Type</label>
            <select
              id="jobType"
              name="jobType"
              value={filters.jobType}
              onChange={handleFilterChange}
              className="filter-select"
            >
              <option value="">All Types</option>
              <option value="one_time">One-time</option>
              <option value="hourly">Hourly</option>
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="contract">Contract</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="minRate">Min Rate (₱)</label>
            <input
              id="minRate"
              type="number"
              name="minRate"
              value={filters.minRate}
              onChange={handleFilterChange}
              placeholder="Min"
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label htmlFor="maxRate">Max Rate (₱)</label>
            <input
              id="maxRate"
              type="number"
              name="maxRate"
              value={filters.maxRate}
              onChange={handleFilterChange}
              placeholder="Max"
              className="filter-input"
            />
          </div>

          {hasActiveFilters && (
            <div className="filter-group">
              <button
                type="button"
                onClick={handleClearFilters}
                className="btn-clear-filters"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
