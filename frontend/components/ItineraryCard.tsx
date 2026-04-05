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
import {
  type CalendarExportResult,
  launchGoogleCalendarExport,
  mapItineraryToCalendarEvents,
} from '@/lib/plannerApi'

interface ItineraryCardProps {
  itinerary: Itinerary
  onCalendarExportStarted?: (result: CalendarExportResult) => void
}

export const ItineraryCard = ({ itinerary, onCalendarExportStarted }: ItineraryCardProps) => {
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1]))
  const [visibleSections, setVisibleSections] = useState({
    hero: false,
    details: false,
    days: false,
    cta: false,
  })
  const [isConfirmingCalendarExport, setIsConfirmingCalendarExport] = useState(false)
  const [calendarExportResult, setCalendarExportResult] = useState<CalendarExportResult | null>(null)

  useEffect(() => {
    setExpandedDays(new Set([1]))
    setVisibleSections({
      hero: false,
      details: false,
      days: false,
      cta: false,
    })
    setIsConfirmingCalendarExport(false)
    setCalendarExportResult(null)

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

  const hasFlightRoute = itinerary.flights.departure && itinerary.flights.arrival
  const hasFlightDate = Boolean(itinerary.flights.date)
  const hasFlightPrice = itinerary.flights.price !== null && itinerary.flights.price !== undefined
  const hasHotelRating = itinerary.hotel.rating !== null && itinerary.hotel.rating !== undefined
  const hasHotelPrice = itinerary.hotel.price !== null && itinerary.hotel.price !== undefined
  const calendarEvents = mapItineraryToCalendarEvents(itinerary)
  const exportableEventCount = calendarEvents.filter((event) => event.isExportable).length
  const skippedEventCount = calendarEvents.length - exportableEventCount

  const handleCalendarExport = () => {
    const result = launchGoogleCalendarExport(itinerary)
    setCalendarExportResult(result)
    setIsConfirmingCalendarExport(false)
    onCalendarExportStarted?.(result)
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
                {itinerary.flights.airline ?? 'Flights not booked yet'}
              </div>
              <div className="mb-2 flex items-center gap-2 text-xs text-text-muted">
                {hasFlightRoute ? (
                  <>
                    <span>{itinerary.flights.departure}</span>
                    <ArrowRightIcon size={14} />
                    <span>{itinerary.flights.arrival}</span>
                  </>
                ) : (
                  <span>Arrival route can be finalized later.</span>
                )}
              </div>
              <div className="text-lg font-bold text-teal">
                {hasFlightPrice ? `$${itinerary.flights.price}` : 'TBD'}
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-text-muted">
              <CalendarIcon size={14} />
              <span>{hasFlightDate ? formatDate(itinerary.flights.date!) : 'Choose dates'}</span>
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
                {itinerary.hotel.name ?? 'Hotel to be selected'}
              </div>
              <div className="mb-2 flex items-center gap-1">
                {hasHotelRating ? (
                  <>
                    {[...Array(itinerary.hotel.rating!)].map((_, i) => (
                      <span key={i} aria-hidden="true" className="text-sm text-amber-400">
                        *
                      </span>
                    ))}
                    <span className="text-xs text-text-muted">({itinerary.hotel.rating}/5)</span>
                  </>
                ) : (
                  <span className="text-xs text-text-muted">Booking details can be chosen later.</span>
                )}
              </div>
              <div className="text-lg font-bold text-teal">
                {hasHotelPrice ? `$${itinerary.hotel.price}/night` : 'TBD'}
              </div>
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
        <div className="space-y-3">
          {isConfirmingCalendarExport ? (
            <div className="rounded-2xl border border-teal/20 bg-white/90 p-4 shadow-sm">
              <p className="text-sm font-semibold text-text-primary">
                Looks good? Add all itinerary events to Google Calendar.
              </p>
              <p className="mt-2 text-xs leading-5 text-text-muted">
                {exportableEventCount > 0
                  ? `We will open ${exportableEventCount} prefilled Google Calendar event${exportableEventCount === 1 ? '' : 's'} in new tabs.`
                  : 'No scheduled activities are ready for calendar export yet.'}
                {skippedEventCount > 0
                  ? ` ${skippedEventCount} item${skippedEventCount === 1 ? '' : 's'} will be skipped because they do not have a usable start time.`
                  : ''}
              </p>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleCalendarExport}
                  disabled={exportableEventCount === 0}
                  className="flex-1 rounded-2xl bg-teal px-4 py-3 text-sm font-medium text-white shadow-[0_14px_24px_rgba(13,115,119,0.18)] transition-colors hover:bg-teal-light disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Add to Google Calendar
                </button>
                <button
                  onClick={() => setIsConfirmingCalendarExport(false)}
                  className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-text-secondary transition-colors hover:border-teal hover:text-teal"
                >
                  Keep editing
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsConfirmingCalendarExport(true)}
              className="w-full rounded-2xl bg-teal px-4 py-3 text-sm font-medium text-white shadow-[0_14px_24px_rgba(13,115,119,0.18)] transition-colors hover:bg-teal-light"
            >
              Add to Google Calendar
            </button>
          )}

          {calendarExportResult && (
            <div className="rounded-2xl border border-white/80 bg-white/88 p-4 shadow-sm">
              <p className="text-sm font-semibold text-text-primary">
                Calendar handoff started
              </p>
              <p className="mt-2 text-xs leading-5 text-text-muted">
                {calendarExportResult.openedCount > 0
                  ? `${calendarExportResult.openedCount} event${calendarExportResult.openedCount === 1 ? '' : 's'} opened in Google Calendar.`
                  : 'No calendar tabs could be opened automatically.'}
                {calendarExportResult.blockedEvents.length > 0
                  ? ` ${calendarExportResult.blockedEvents.length} event${calendarExportResult.blockedEvents.length === 1 ? '' : 's'} need to be opened manually below.`
                  : ''}
                {calendarExportResult.skippedEvents.length > 0
                  ? ` ${calendarExportResult.skippedEvents.length} unscheduled item${calendarExportResult.skippedEvents.length === 1 ? ' was' : 's were'} skipped.`
                  : ''}
              </p>

              {calendarExportResult.blockedEvents.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Open manually
                  </p>
                  {calendarExportResult.blockedEvents.map((event) => (
                    <a
                      key={event.id}
                      href={event.googleCalendarUrl ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-text-primary transition-colors hover:border-teal hover:text-teal"
                    >
                      <span className="truncate pr-3">{event.title}</span>
                      <span className="text-xs font-medium text-text-muted">Open</span>
                    </a>
                  ))}
                </div>
              )}

              {calendarExportResult.skippedEvents.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Not added
                  </p>
                  {calendarExportResult.skippedEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-xl border border-gray-100 bg-[#f8fbfb] px-3 py-2 text-sm text-text-secondary"
                    >
                      {event.title}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
