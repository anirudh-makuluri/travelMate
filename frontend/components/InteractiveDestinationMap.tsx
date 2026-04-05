'use client'

import { useEffect, useRef, useState } from 'react'
import type { Destination } from '@/lib/blogData'

interface InteractiveDestinationMapProps {
  destinations: Destination[]
  activeDayInView: number | null
  onMarkerClick: (dayNumber: number) => void
}

export const InteractiveDestinationMap = ({
  destinations,
  activeDayInView,
  onMarkerClick,
}: InteractiveDestinationMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const markersRef = useRef<Map<number, any>>(new Map())

  // Wait for Google Maps to load
  useEffect(() => {
    let attempts = 0
    const checkGoogleMaps = () => {
      if (typeof window !== 'undefined' && window.google?.maps) {
        setIsLoading(false)
        setError(null)
      } else if (attempts < 50) {
        attempts++
        setTimeout(checkGoogleMaps, 100)
      } else {
        setError('map_not_available')
        setIsLoading(false)
      }
    }
    checkGoogleMaps()
  }, [])

  // Initialize map
  useEffect(() => {
    if (isLoading || !mapRef.current || !window.google?.maps) return

    try {
      const mapCenter = {
        lat: destinations[0]?.lat || 0,
        lng: destinations[0]?.lng || 0,
      }

      const googleMap = new window.google.maps.Map(mapRef.current, {
        zoom: 7,
        center: mapCenter,
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
      })

      setMap(googleMap)
    } catch (err) {
      setError('map_init_failed')
      console.error('Map initialization error:', err)
    }
  }, [isLoading, destinations])

  // Add/Update markers
  useEffect(() => {
    if (!map) return

    try {
      // Clear existing markers
      markersRef.current.forEach((marker) => marker.setMap(null))
      markersRef.current.clear()

      // Add new markers
      destinations.forEach((dest) => {
        const isActive = dest.dayNumber === activeDayInView

        const marker = new window.google.maps.Marker({
          position: { lat: dest.lat, lng: dest.lng },
          map,
          title: `Day ${dest.dayNumber}: ${dest.name}`,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: isActive ? 14 : 10,
            fillColor: isActive ? '#14b8a6' : '#94a3b8',
            fillOpacity: 1,
            strokeColor: isActive ? '#0d9488' : '#64748b',
            strokeWeight: isActive ? 3 : 2,
          },
        })

        marker.addListener('click', () => {
          onMarkerClick(dest.dayNumber)
        })

        markersRef.current.set(dest.dayNumber, marker)
      })
    } catch (err) {
      console.error('Error adding markers:', err)
    }
  }, [map, destinations, activeDayInView, onMarkerClick])

  // Fit bounds around all markers
  useEffect(() => {
    if (!map || destinations.length === 0) return

    try {
      const bounds = new window.google.maps.LatLngBounds()
      destinations.forEach((dest) => {
        bounds.extend({ lat: dest.lat, lng: dest.lng })
      })

      map.fitBounds(bounds, {
        top: 20,
        right: 20,
        bottom: 20,
        left: 20,
      })
    } catch (err) {
      console.error('Error fitting bounds:', err)
    }
  }, [map, destinations])

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
        <p className="text-gray-500">Loading map...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4">
        <p className="text-sm text-gray-600 text-center mb-3">
          📍 Trip destinations preview
        </p>
        <p className="text-xs text-gray-500 text-center max-w-xs mb-3">
          {destinations.length} stop{destinations.length !== 1 ? 's' : ''} on this journey
        </p>
        {/* Interactive destination list as fallback */}
        <div className="w-full max-h-32 overflow-y-auto space-y-1">
          {destinations.map((dest) => (
            <button
              key={dest.dayNumber}
              onClick={() => onMarkerClick(dest.dayNumber)}
              className={`w-full px-3 py-2 text-xs rounded text-left transition-all ${
                activeDayInView === dest.dayNumber
                  ? 'bg-teal text-white font-semibold'
                  : 'bg-white hover:bg-teal/5 text-gray-700 border border-gray-200'
              }`}
            >
              <span className={activeDayInView === dest.dayNumber ? '' : 'text-teal font-semibold'}>
                Day {dest.dayNumber}:
              </span>{' '}
              {dest.name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full rounded-lg overflow-hidden shadow-md">
      <div ref={mapRef} className="w-full h-full" />
    </div>
  )
}
