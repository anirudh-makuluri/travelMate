'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import {
  ChevronDownIcon,
  ArrowRightIcon,
  CalendarIcon,
  PlaneIcon,
  HotelIcon,
  MapPinIcon,
} from './Icons'
import { cn, formatDate } from '@/lib/utils'
import { Itinerary } from '@/store/appStore'

interface ItineraryCardProps {
  itinerary: Itinerary
}

export const ItineraryCard = ({ itinerary }: ItineraryCardProps) => {
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1]))
  const [visibleSections, setVisibleSections] = useState({
    hero: false,
    details: false,
    days: false,
    cta: false,
  })

  useEffect(() => {
    setExpandedDays(new Set([1]))
    setVisibleSections({
      hero: false,
      details: false,
      days: false,
      cta: false,
    })

    const timers = [
      setTimeout(() => setVisibleSections((prev) => ({ ...prev, hero: true })), 60),
      setTimeout(() => setVisibleSections((prev) => ({ ...prev, details: true })), 180),
      setTimeout(() => setVisibleSections((prev) => ({ ...prev, days: true })), 320),
      setTimeout(() => setVisibleSections((prev) => ({ ...prev, cta: true })), 460),
    ]

    return () => {
      timers.forEach((timer) => clearTimeout(timer))
    }
  }, [itinerary])

  const toggleDayExpanded = (dayNumber: number) => {
    const newExpanded = new Set(expandedDays)
    if (newExpanded.has(dayNumber)) {
      newExpanded.delete(dayNumber)
    } else {
      newExpanded.add(dayNumber)
    }
    setExpandedDays(newExpanded)
  }

  return (
    <div className="glass-panel mx-auto max-w-2xl overflow-hidden rounded-[28px] border border-white/70 shadow-[0_24px_48px_rgba(15,23,42,0.1)]">
      <div
        className={cn(
          'section-reveal relative h-64 w-full overflow-hidden bg-gray-200',
          visibleSections.hero && 'is-visible'
        )}
      >
        <Image
          src={itinerary.heroImage}
          alt={itinerary.destination}
          fill
          className="object-cover scale-[1.03]"
          priority
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-black/5 to-black/55" />
        <div className="absolute bottom-6 left-6">
          <h2 className="mb-1 text-3xl font-bold text-white">{itinerary.destination}</h2>
          <p className="text-sm text-gray-100">{itinerary.country}</p>
        </div>
      </div>

      <div
        className={cn(
          'section-reveal border-b border-white/70 bg-gradient-to-br from-white/90 to-[#f8fbfb] p-6',
          visibleSections.details && 'is-visible'
        )}
      >
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white bg-white/85 p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <PlaneIcon size={18} className="text-teal" />
              <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Flights
              </span>
            </div>
            <div className="mb-2">
              <div className="mb-1 text-sm font-semibold text-text-primary">
                {itinerary.flights.airline}
              </div>
              <div className="mb-2 flex items-center gap-2 text-xs text-text-muted">
                <span>{itinerary.flights.departure}</span>
                <ArrowRightIcon size={14} />
                <span>{itinerary.flights.arrival}</span>
              </div>
              <div className="text-lg font-bold text-teal">${itinerary.flights.price}</div>
            </div>
            <div className="flex items-center gap-1 text-xs text-text-muted">
              <CalendarIcon size={14} />
              <span>{formatDate(itinerary.flights.date)}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white bg-white/85 p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <HotelIcon size={18} className="text-teal" />
              <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Hotel
              </span>
            </div>
            <div className="mb-2">
              <div className="mb-1 text-sm font-semibold text-text-primary">
                {itinerary.hotel.name}
              </div>
              <div className="mb-2 flex items-center gap-1">
                {[...Array(itinerary.hotel.rating)].map((_, i) => (
                  <span key={i} aria-hidden="true" className="text-sm text-amber-400">
                    *
                  </span>
                ))}
                <span className="text-xs text-text-muted">({itinerary.hotel.rating}/5)</span>
              </div>
              <div className="text-lg font-bold text-teal">${itinerary.hotel.price}/night</div>
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-text-muted">
          <span>{formatDate(itinerary.startDate)}</span>
          <span className="mx-2">•</span>
          <span>{itinerary.days.length} days</span>
        </div>
      </div>

      <div
        className={cn(
          'section-reveal divide-y divide-gray-100',
          visibleSections.days && 'is-visible'
        )}
      >
        {itinerary.days.map((day) => (
          <div key={day.dayNumber} className="bg-white/90">
            <button
              onClick={() => toggleDayExpanded(day.dayNumber)}
              className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-[#f8fcfc]"
            >
              <h3 className="text-sm font-semibold text-text-primary">
                Day {day.dayNumber} - {formatDate(day.date)}
              </h3>
              <ChevronDownIcon
                size={18}
                className={cn(
                  'text-text-muted transition-transform duration-300',
                  expandedDays.has(day.dayNumber) && 'rotate-180'
                )}
              />
            </button>

            {expandedDays.has(day.dayNumber) && (
              <div className="space-y-3 bg-[#f7fbfb] px-6 pb-4">
                {day.activities.map((activity, idx) => (
                  <div
                    key={`${day.dayNumber}-${activity.time}-${idx}`}
                    className="stagger-fade flex gap-4 border-b border-white pb-3 last:border-b-0 last:pb-0"
                    style={{ animationDelay: `${idx * 90}ms` }}
                  >
                    <div className="min-w-fit text-right">
                      <span className="text-xs font-semibold text-teal">{activity.time}</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="mb-1 text-sm font-semibold text-text-primary">
                        {activity.name}
                      </h4>
                      <div className="mb-1 flex items-center gap-1">
                        <MapPinIcon size={14} className="text-text-muted" />
                        <span className="text-xs text-text-muted">{activity.location}</span>
                      </div>
                      {activity.description && (
                        <p className="text-xs italic text-text-muted">{activity.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div
        className={cn(
          'section-reveal border-t border-teal/10 bg-teal/5 p-6',
          visibleSections.cta && 'is-visible'
        )}
      >
        <button className="w-full rounded-2xl bg-teal px-4 py-3 text-sm font-medium text-white shadow-[0_14px_24px_rgba(13,115,119,0.18)] transition-colors hover:bg-teal-light">
          Save This Itinerary
        </button>
      </div>
    </div>
  )
}
