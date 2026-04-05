'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BrainIcon } from './Icons'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { getBlogIdByDestination } from '@/lib/blogData'

interface Trip {
  id: string
  destination: string
  country: string
  image: string
  date: string
  year: string
  status: 'Completed' | 'Ongoing'
  friendName?: string
  friendAvatar?: string
}

const mockTrips: Trip[] = [
  {
    id: '1',
    destination: 'Las Vegas',
    country: 'USA',
    image: '/images/posters/vegas.png',
    date: 'Mar 20 - Mar 24',
    year: '2024',
    status: 'Completed',
  },
  {
    id: '2',
    destination: 'Vermont',
    country: 'USA',
    image: '/images/posters/vermount.png',
    date: 'Oct 10 - Oct 13',
    year: '2024',
    status: 'Completed',
  },
  {
    id: '3',
    destination: 'Tokyo',
    country: 'Japan',
    image: '/images/posters/japan.png',
    date: 'Apr 1 - Apr 14',
    year: '2024',
    status: 'Completed',
    friendName: 'Sarah',
    friendAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
  },
]

export const RightPanel = () => {
  const [activeTab, setActiveTab] = useState<'my' | 'friends'>('my')

  const displayTrips = activeTab === 'my' ? mockTrips.slice(0, 2) : mockTrips.slice(2, 3)

  return (
    <div className="fixed right-0 top-0 h-screen w-[280px] bg-off-white border-l border-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <BrainIcon size={18} className="text-teal" />
          <h2 className="text-sm font-semibold text-text-primary">Trip Memory</h2>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {['my', 'friends'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as 'my' | 'friends')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-colors rounded-md',
                activeTab === tab
                  ? 'bg-teal text-white'
                  : 'text-text-secondary hover:bg-white'
              )}
            >
              {tab === 'my' ? 'My Trips' : 'Friends'}
            </button>
          ))}
        </div>
      </div>

      {/* Trips List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {displayTrips.length ? (
          displayTrips.map((trip) => {
            const blogId = getBlogIdByDestination(`${trip.destination}, ${trip.country}`)
            const tripLink = blogId ? `/blog/${blogId}` : '#'

            return (
              <Link
                key={trip.id}
                href={tripLink}
                className="group cursor-pointer transition-all duration-300 hover:translate-y-[-2px] block"
              >
                <div className="relative rounded-lg overflow-hidden h-40 mb-3 border border-gray-100 group-hover:border-teal group-hover:shadow-md transition-all duration-300">
                  <Image
                    src={trip.image}
                    alt={trip.destination}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 100vw, 280px"
                  />
                  {trip.friendName && (
                    <div className="absolute bottom-2 left-2">
                      <Image
                        src={trip.friendAvatar!}
                        alt={trip.friendName}
                        width={28}
                        height={28}
                        className="rounded-full border-2 border-white"
                        unoptimized
                      />
                    </div>
                  )}
                </div>

                <h3 className="text-sm font-semibold text-text-primary group-hover:text-teal transition-colors">
                  {trip.destination}
                </h3>
                <p className="text-xs text-text-muted mb-2">{trip.country}</p>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">{trip.year}</span>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      trip.status === 'Completed'
                        ? 'bg-success/10 text-success'
                        : 'bg-blue-100 text-blue-700'
                    )}
                  >
                    {trip.status === 'Completed' ? '✓ Completed' : 'Ongoing'}
                  </span>
                </div>
              </Link>
            )
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 text-4xl">🗺️</div>
            <p className="text-xs text-text-muted">
              Your trip memories will appear here
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
