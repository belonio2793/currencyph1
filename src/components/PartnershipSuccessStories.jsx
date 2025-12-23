import React from 'react'
import { useDevice } from '../context/DeviceContext'

export default function PartnershipSuccessStories() {
  const { isMobile } = useDevice()

  const stories = [
    {
      icon: '🌾',
      name: 'Maria Santos',
      role: 'Coconut Farmer',
      location: 'Mindanao',
      story: 'Joined the network in 2024. Now directly supplies to 5 major retailers. Revenue increased by 300%.',
      achievement: '₱2.5M contributed',
      badge: '🥇 Gold Member'
    },
    {
      icon: '🏪',
      name: 'Juan Reyes',
      role: 'Retail Owner',
      location: 'Manila',
      story: 'Integrated our supply chain system. Reduced operational costs by 40%. Now mentoring new retailers.',
      achievement: '₱1.2M contributed',
      badge: '🥈 Silver Member'
    },
    {
      icon: '⚙️',
      name: 'Ana Torres',
      role: 'Processing Specialist',
      location: 'Visayas',
      story: 'Contributed premium processing equipment. Helped 10+ partners increase quality standards.',
      achievement: '₱3.8M contributed',
      badge: '🥇 Gold Member'
    },
    {
      icon: '✈️',
      name: 'Carlos Mendez',
      role: 'Export Manager',
      location: 'Luzon',
      story: 'Leading international market expansion. Connected partners with 8 international buyers.',
      achievement: '₱5.2M contributed',
      badge: '💎 Platinum Member'
    }
  ]

  const stats = [
    { number: '1,200+', label: 'Active Partners', emoji: '🤝' },
    { number: '₱45M+', label: 'Total Contributed', emoji: '💰' },
    { number: '500+', label: 'Success Stories', emoji: '📈' },
    { number: '28', label: 'Countries Reached', emoji: '🌍' }
  ]

  return (
    <div className={`space-y-8 ${isMobile ? 'px-3 py-4' : 'px-6 py-8'}`}>
      {/* Hero Section */}
      <div className="text-center space-y-3">
        <h2 className="text-3xl md:text-4xl font-bold text-white">🌟 Partnership Success Stories</h2>
        <p className="text-slate-400 text-lg">Join hundreds of successful contributors building the future of Coconuts.com.ph</p>
      </div>

      {/* Stats Grid */}
      <div className={`grid gap-4 ${isMobile ? 'grid-cols-2' : 'grid-cols-4'}`}>
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-gradient-to-br from-blue-900/40 to-cyan-900/40 rounded-lg p-4 border border-blue-700/30 text-center transform hover:scale-105 transition-all">
            <p className="text-3xl mb-2">{stat.emoji}</p>
            <p className="text-2xl font-bold text-white">{stat.number}</p>
            <p className="text-slate-300 text-sm mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Success Stories */}
      <div>
        <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <span>💬</span> Partner Testimonials
        </h3>
        <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {stories.map((story, idx) => (
            <div
              key={idx}
              className="group bg-gradient-to-br from-slate-700 to-slate-800 rounded-xl p-6 border border-slate-600 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-600/20 transition-all"
            >
              {/* Header with Icon */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-4xl">{story.icon}</div>
                  <div>
                    <h4 className="font-bold text-white group-hover:text-emerald-300 transition-colors">{story.name}</h4>
                    <p className="text-slate-400 text-sm">{story.role}</p>
                    <p className="text-slate-500 text-xs">📍 {story.location}</p>
                  </div>
                </div>
                <div className="bg-emerald-900/30 rounded-lg px-2 py-1 border border-emerald-700/50">
                  <p className="text-emerald-300 text-xs font-bold whitespace-nowrap">{story.badge}</p>
                </div>
              </div>

              {/* Story */}
              <p className="text-slate-300 text-sm mb-4 italic">"{story.story}"</p>

              {/* Achievement */}
              <div className="bg-slate-800/50 rounded-lg p-3 border-t border-slate-600">
                <p className="text-slate-400 text-xs font-medium">Total Contribution</p>
                <p className="text-emerald-300 font-bold text-lg">{story.achievement}</p>
              </div>

              {/* Quote mark decorator */}
              <div className="absolute top-3 right-3 text-6xl text-slate-700 opacity-10 font-serif">"</div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-emerald-900/30 to-cyan-900/30 rounded-xl p-8 border border-emerald-700/30 text-center">
        <h3 className="text-2xl font-bold text-white mb-2">Be the Next Success Story</h3>
        <p className="text-slate-300 mb-4">Join our growing community of partners and grow your business together</p>
        <div className="flex items-center justify-center gap-3">
          <span className="text-3xl">🚀</span>
          <button className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-bold rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-emerald-600/40">
            Start Contributing Now
          </button>
        </div>
      </div>

      {/* Benefits Grid */}
      <div>
        <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <span>✨</span> Partner Benefits
        </h3>
        <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3'}`}>
          {[
            { icon: '📊', title: 'Market Access', desc: 'Connect with buyers nationwide' },
            { icon: '💎', title: 'Premium Support', desc: 'Dedicated account managers' },
            { icon: '🎓', title: 'Training Program', desc: 'Business development workshops' },
            { icon: '🏆', title: 'Recognition', desc: 'Achievement badges & rewards' },
            { icon: '💰', title: 'Revenue Share', desc: 'Earn commissions on referrals' },
            { icon: '🌐', title: 'Global Network', desc: 'Access international markets' }
          ].map((benefit, idx) => (
            <div key={idx} className="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-blue-500/50 transition-colors">
              <p className="text-3xl mb-2">{benefit.icon}</p>
              <h4 className="font-bold text-white mb-1">{benefit.title}</h4>
              <p className="text-slate-400 text-sm">{benefit.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
