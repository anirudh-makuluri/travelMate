'use client'

import Image from 'next/image'
import type { Blog, Destination } from '@/lib/blogData'
import { InteractiveDestinationMap } from './InteractiveDestinationMap'
import { cn } from '@/lib/utils'

interface LeftPaneProps {
  blog: Blog
  activeDayInView: number | null
  onMarkerClick: (dayNumber: number) => void
}

export const LeftPane = ({ blog, activeDayInView, onMarkerClick }: LeftPaneProps) => {
  if (!blog.destinations) return null

  const displayDestinations = blog.destinations as Destination[]

  return (
    <div className="w-full h-full flex flex-col gap-4 overflow-hidden py-4 px-3">
      {/* Cover Image - Eye-Catching Frame */}
      <div className="relative flex-shrink-0">
        {/* Outer frame with shadow */}
        <div className="relative rounded-2xl overflow-hidden shadow-lg">
          {/* Image container */}
          <div className="relative w-full bg-gradient-to-br from-blue-50 to-indigo-50 p-3">
            <div className="relative w-full h-64 rounded-xl overflow-hidden bg-white">
              <Image
                src={blog.coverImage}
                alt={blog.title}
                fill
                className="object-contain"
                priority
                unoptimized
              />
            </div>
          </div>
        </div>

        {/* Destination Info Card Overlay */}
        <div className="absolute bottom-6 left-4 z-10 bg-white rounded-lg shadow-lg p-4 max-w-xs">
          <h2 className="text-2xl font-bold text-text-primary">{blog.destination}</h2>
          <p className="text-sm text-text-muted">{blog.country}</p>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0 px-2">
        <div className="h-full bg-gray-100 rounded-xl overflow-hidden shadow-md">
          <InteractiveDestinationMap
            destinations={displayDestinations}
            activeDayInView={activeDayInView}
            onMarkerClick={onMarkerClick}
          />
        </div>
      </div>
    </div>
  )
}
