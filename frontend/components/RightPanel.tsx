'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { BrainIcon } from './Icons'
import { cn } from '@/lib/utils'
import { getBlogIdByDestination } from '@/lib/blogData'
import { useAppStore } from '@/store/appStore'

interface RightPanelProps {
  userId: string
}

export const RightPanel = ({ userId }: RightPanelProps) => {
  const [activeTab, setActiveTab] = useState<'my' | 'friends'>('my')
  const ensureWorkspace = useAppStore((state) => state.ensureWorkspace)
  const tripMemories = useAppStore((state) => state.workspaces[userId]?.tripMemories ?? [])

  useEffect(() => {
    ensureWorkspace(userId)
  }, [ensureWorkspace, userId])

  const displayTrips = tripMemories.filter((trip) =>
    activeTab === 'my' ? trip.source === 'mine' : trip.source === 'friends'
  )

  return (
    <div className="fixed right-0 top-0 flex h-screen w-[280px] flex-col overflow-hidden border-l border-gray-100 bg-off-white">
      <div className="border-b border-gray-100 px-6 pb-4 pt-6">
        <div className="mb-4 flex items-center gap-2">
          <BrainIcon size={18} className="text-teal" />
          <h2 className="text-sm font-semibold text-text-primary">Trip Memory</h2>
        </div>

        <div className="flex gap-2">
          {['my', 'friends'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as 'my' | 'friends')}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                activeTab === tab ? 'bg-teal text-white' : 'text-text-secondary hover:bg-white'
              )}
            >
              {tab === 'my' ? 'My Trips' : 'Friends'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {displayTrips.length ? (
          displayTrips.map((trip) => {
            const blogId = getBlogIdByDestination(`${trip.destination}, ${trip.country}`)
            const tripLink = blogId ? `/blog/${blogId}` : '#'

            return (
              <Link
                key={trip.id}
                href={tripLink}
                className="group block cursor-pointer transition-all duration-300 hover:translate-y-[-2px]"
              >
                {trip.image ? (
                  <div className="relative mb-3 h-40 overflow-hidden rounded-lg border border-gray-100 transition-all duration-300 group-hover:border-teal group-hover:shadow-md">
                    <Image
                      src={trip.image}
                      alt={trip.destination}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, 280px"
                    />
                    {trip.friendName && trip.friendAvatar && (
                      <div className="absolute bottom-2 left-2">
                        <Image
                          src={trip.friendAvatar}
                          alt={trip.friendName}
                          width={28}
                          height={28}
                          className="rounded-full border-2 border-white"
                          unoptimized
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mb-3 rounded-2xl border border-gray-100 bg-white px-4 py-4">
                    <p className="text-sm font-semibold text-text-primary">{trip.destination}</p>
                    <p className="mt-2 text-xs leading-5 text-text-secondary">{trip.summary}</p>
                  </div>
                )}

                <h3 className="text-sm font-semibold text-text-primary transition-colors group-hover:text-teal">
                  {trip.destination}
                </h3>
                <p className="mb-2 text-xs text-text-muted">{trip.country}</p>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">
                    {trip.date} · {trip.year}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      trip.status === 'Completed'
                        ? 'bg-success/10 text-success'
                        : 'bg-blue-100 text-blue-700'
                    )}
                  >
                    {trip.status}
                  </span>
                </div>

                <p className="mt-2 text-xs leading-5 text-text-secondary">{trip.summary}</p>
              </Link>
            )
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 text-4xl">Memory</div>
            <p className="text-xs text-text-muted">Your trip memories will appear here</p>
          </div>
        )}
      </div>
    </div>
  )
}
