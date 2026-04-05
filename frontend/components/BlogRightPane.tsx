'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Blog } from '@/lib/blogData'
import { ArrowRightIcon } from '@/components/Icons'
import { cn, formatDate } from '@/lib/utils'
import DayImageGallery from '@/components/DayImageGallery'

interface RightPaneProps {
  blog: Blog
  onScrollDayChange: (dayNumber: number | null) => void
}

export const RightPane = ({ blog, onScrollDayChange }: RightPaneProps) => {
  const router = useRouter()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [visibleDay, setVisibleDay] = useState<number | null>(null)

  // Use IntersectionObserver to track which day section is in view
  useEffect(() => {
    if (!scrollContainerRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        let topMostVisible: { day: number; ratio: number } | null = null

        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const dayNumber = parseInt((entry.target as HTMLElement).getAttribute('data-day') || '0')
            const ratio = entry.intersectionRatio

            if (!topMostVisible || ratio > topMostVisible.ratio) {
              topMostVisible = { day: dayNumber, ratio }
            }
          }
        })

        if (topMostVisible) {
          const visible: { day: number; ratio: number } = topMostVisible
          setVisibleDay(visible.day)
          onScrollDayChange(visible.day)
        }
      },
      {
        root: scrollContainerRef.current,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    )

    const daySections = scrollContainerRef.current.querySelectorAll('[data-day]')
    daySections.forEach((section) => observer.observe(section))

    return () => observer.disconnect()
  }, [onScrollDayChange])

  // Public method to scroll to a day
  const scrollToDay = (dayNumber: number) => {
    const dayElement = scrollContainerRef.current?.querySelector(`[data-day="${dayNumber}"]`)
    if (dayElement) {
      dayElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Expose scroll method on ref
  useEffect(() => {
    if (scrollContainerRef.current) {
      ;(scrollContainerRef.current as any).scrollToDay = scrollToDay
    }
  }, [])

  return (
    <div ref={scrollContainerRef} className="h-full overflow-y-auto">
      {/* Hero Section Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4 gap-4">
          <Link
            href="/"
            className="text-teal hover:text-teal-light transition-colors font-medium text-sm flex items-center gap-1 flex-shrink-0"
          >
            ← Back to trips
          </Link>
          <div className="flex items-center gap-4">
            {blog.authorAvatar && blog.authorAvatar.length < 5 ? (
              <div className="w-12 h-12 flex items-center justify-center bg-teal/10 rounded-full text-xl">
                {blog.authorAvatar}
              </div>
            ) : (
              <Image
                src={blog.authorAvatar}
                alt={blog.author}
                width={48}
                height={48}
                className="rounded-full"
                unoptimized
              />
            )}
            <div>
              <h3 className="font-semibold text-text-primary">{blog.author}</h3>
              <p className="text-xs text-text-muted">
                {formatDate(blog.startDate)} — {formatDate(blog.endDate)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-teal/10 rounded-full">
            <span className="text-xs font-medium text-teal">✨ Written with TripMind</span>
          </div>
        </div>

        {/* Day tabs */}
        <div className="flex gap-4 overflow-x-auto pb-2 scroll-smooth mt-4">
          {blog.days.map((day) => (
            <button
              key={day.dayNumber}
              onClick={() => scrollToDay(day.dayNumber)}
              className={cn(
                'px-4 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-all duration-300 flex-shrink-0',
                visibleDay === day.dayNumber ? 'bg-teal text-white' : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
              )}
            >
              Day {day.dayNumber}
            </button>
          ))}
        </div>
      </div>

      {/* Trip Metrics - At Top */}
      {blog.metrics && (
        <div className="px-6 py-8 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">Trip Highlights</h3>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white rounded-lg p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-teal">{blog.metrics.totalDays}</p>
              <p className="text-xs text-text-muted mt-1">Days</p>
            </div>
            <div className="bg-white rounded-lg p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-teal">{blog.metrics.totalKm}</p>
              <p className="text-xs text-text-muted mt-1">km</p>
            </div>
            <div className="bg-white rounded-lg p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-teal">{blog.metrics.stopsCount}</p>
              <p className="text-xs text-text-muted mt-1">Stops</p>
            </div>
            <div className="bg-white rounded-lg p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-teal">{blog.metrics.averageActivitiesPerDay}</p>
              <p className="text-xs text-text-muted mt-1">Avg/Day</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Opening Paragraph */}
        <article>
          <h1 className="text-4xl font-bold text-text-primary mb-6">{blog.title}</h1>
          <p className="text-lg text-text-secondary leading-relaxed mb-12 italic">
            {blog.description}
          </p>

          {/* Days Sections */}
          {blog.days.map((day) => (
            <section key={day.dayNumber} data-day={day.dayNumber} className="mb-16">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-px flex-1 bg-teal/30" />
                <h2 className="text-sm font-semibold text-teal uppercase tracking-widest whitespace-nowrap">
                  Day {day.dayNumber} — {day.title}
                </h2>
                <div className="h-px flex-1 bg-teal/30" />
              </div>

              <p className="text-lg text-text-primary mb-8 leading-relaxed font-serif">
                {day.content}
              </p>

              {/* Day Image Gallery */}
              <DayImageGallery images={day.images} dayNumber={day.dayNumber} />

              {/* Day metrics if available */}
              {day.metrics && Object.keys(day.metrics).length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 mb-8 grid grid-cols-2 gap-4">
                  {Object.entries(day.metrics).map(([key, value]) => (
                    <div key={key}>
                      <p className="text-xs text-text-muted uppercase tracking-wider">{key}</p>
                      <p className="text-lg font-semibold text-text-primary">{String(value)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </article>

        {/* CTA Section */}
        <div className="mt-12 pt-12 border-t border-gray-100 bg-gradient-to-br from-teal/5 to-ocean/5 rounded-xl p-12 text-center">
          <h3 className="text-2xl font-bold text-text-primary mb-4">Feeling inspired?</h3>
          <p className="text-text-secondary mb-8 max-w-xl mx-auto">
            TripMind can recreate this {blog.destination} itinerary or tailor a new journey just
            for you. Let&apos;s get planning.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-teal text-white rounded-lg font-medium hover:bg-teal-light transition-colors"
          >
            Plan a similar trip
            <ArrowRightIcon size={18} />
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-text-primary text-white py-12 mt-16">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <p className="text-sm text-gray-300">
            © {new Date().getFullYear()} TripMind. Your memories, amplified.
          </p>
        </div>
      </div>
    </div>
  )
}
