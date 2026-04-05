'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeftIcon, ArrowRightIcon } from '@/components/Icons'
import { cn, formatDate } from '@/lib/utils'
import { Blog, BlogDay, formatDateRange, calculateTripDuration } from '@/lib/blogData'

interface BlogPostContentProps {
  blog: Blog
}

export const BlogPostContent = ({ blog }: BlogPostContentProps) => {
  const [expandedDays, setExpandedDays] = useState<number[]>([1]) // Day 1 expanded by default

  const toggleDay = (dayNumber: number) => {
    setExpandedDays((prev) =>
      prev.includes(dayNumber)
        ? prev.filter((d) => d !== dayNumber)
        : [...prev, dayNumber]
    )
  }

  const tripDuration = calculateTripDuration(blog.startDate, blog.endDate)
  const dateRange = formatDateRange(blog.startDate, blog.endDate)

  return (
    <div className="bg-warm-white min-h-screen">
      {/* Hero Section */}
      <div className="relative h-96 w-full overflow-hidden">
        <Image
          src={blog.coverImage}
          alt={blog.destination}
          fill
          className="object-cover"
          priority
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-warm-white" />

        <div className="absolute bottom-12 left-0 right-0">
          <div className="max-w-3xl mx-auto px-6">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2 font-serif">
              {blog.title}
            </h1>
            <p className="text-lg text-white/90">
              {blog.destination}, {blog.country}
            </p>
          </div>
        </div>
      </div>

      {/* Back Button & Meta */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-teal hover:text-teal-light transition-colors"
            >
              <ArrowLeftIcon size={18} />
              <span className="text-sm font-medium">Back to trips</span>
            </Link>

            <div className="flex items-center gap-2 px-3 py-1.5 bg-teal/10 rounded-full">
              <span className="text-xs font-medium text-teal">
                ✨ Memory Captured
              </span>
            </div>
          </div>

          {/* Trip Meta Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4">
            <div>
              <p className="text-xs text-text-muted uppercase tracking-widest font-semibold">
                Duration
              </p>
              <p className="text-sm font-semibold text-text-primary mt-1">
                {tripDuration} days
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-widest font-semibold">
                Dates
              </p>
              <p className="text-sm font-semibold text-text-primary mt-1">
                {dateRange}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-widest font-semibold">
                Author
              </p>
              <p className="text-sm font-semibold text-text-primary mt-1">
                {blog.author}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted uppercase tracking-widest font-semibold">
                Memory Type
              </p>
              <p className="text-sm font-semibold text-text-primary mt-1">
                Experience
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Opening Description */}
        <article className="prose prose-lg max-w-none mb-12">
          <p className="text-lg leading-relaxed text-text-primary mb-8 font-serif whitespace-pre-wrap">
            {blog.description}
          </p>
        </article>

        {/* Days Sections */}
        <div className="space-y-8">
          {blog.days.map((day: BlogDay) => (
            <div
              key={day.dayNumber}
              className="border border-gray-200 rounded-lg overflow-hidden hover:border-teal/30 transition-colors"
            >
              {/* Day Header - Clickable */}
              <button
                onClick={() => toggleDay(day.dayNumber)}
                className="w-full px-6 py-5 bg-cream hover:bg-off-white transition-colors text-left flex items-center justify-between group"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="h-px w-8 bg-teal/30 group-hover:bg-teal/60 transition-colors" />
                  <h3 className="text-lg font-semibold text-text-primary font-serif">
                    Day {day.dayNumber}: {day.title}
                  </h3>
                  {day.wakeUp && (
                    <span className="text-xs text-text-muted ml-auto">
                      Wake: {day.wakeUp}
                    </span>
                  )}
                </div>
                <div className="text-teal group-hover:text-teal-light transition-colors">
                  <svg
                    className={cn(
                      'w-5 h-5 transition-transform duration-300',
                      expandedDays.includes(day.dayNumber) ? 'rotate-180' : ''
                    )}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                </div>
              </button>

              {/* Day Content - Collapsible */}
              <div
                className={cn(
                  'overflow-hidden transition-all duration-300 bg-white',
                  expandedDays.includes(day.dayNumber) ? 'max-h-[2000px]' : 'max-h-0'
                )}
              >
                <div className="px-6 py-6 border-t border-gray-100">
                  {/* Sleep & Duration Info */}
                  {day.sleepDuration && (
                    <div className="mb-4 p-3 bg-warm-white rounded-lg">
                      <p className="text-xs text-text-muted uppercase tracking-widest font-semibold mb-1">
                        Rest
                      </p>
                      <p className="text-sm text-text-primary font-medium">
                        {day.sleepDuration}
                      </p>
                    </div>
                  )}

                  {/* Main Content */}
                  <div className="prose prose-lg max-w-none mb-6">
                    <p className="text-base leading-relaxed text-text-primary font-serif whitespace-pre-wrap">
                      {day.content}
                    </p>
                  </div>

                  {/* Metrics Grid */}
                  {day.metrics && Object.keys(day.metrics).length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-100">
                      <p className="text-xs text-text-muted uppercase tracking-widest font-semibold mb-4">
                        Day Metrics
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {Object.entries(day.metrics).map(([key, value]) => (
                          <div
                            key={key}
                            className="p-3 bg-warm-white rounded-lg text-center"
                          >
                            <p className="text-xs text-text-muted uppercase tracking-widest font-semibold mb-1">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </p>
                            <p className="text-sm font-semibold text-teal">
                              {String(value)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-16 pt-12 border-t border-gray-100 bg-gradient-to-br from-teal/5 to-ocean/5 rounded-xl p-12 text-center">
          <h3 className="text-2xl font-bold text-text-primary mb-4 font-serif">
            Inspired to explore?
          </h3>
          <p className="text-text-secondary mb-8 max-w-xl mx-auto">
            Every journey creates memories. Start planning your own adventure with TravelMate and create experiences worth writing about.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-teal text-white rounded-lg font-medium hover:bg-teal-light transition-colors"
          >
            Plan your trip
            <ArrowRightIcon size={18} />
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-text-primary text-white py-12 mt-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-sm text-gray-300">
            © {new Date().getFullYear()} TravelMate. Your memories, amplified.
          </p>
        </div>
      </div>
    </div>
  )
}
