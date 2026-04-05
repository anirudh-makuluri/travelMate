'use client'

import { useState, useRef } from 'react'
import type { Blog } from '@/lib/blogData'
import { LeftPane } from './BlogLeftPane'
import { RightPane } from './BlogRightPane'

interface EnhancedBlogPostPageProps {
  blog: Blog
}

export const EnhancedBlogPostPage = ({ blog }: EnhancedBlogPostPageProps) => {
  const [activeDayInView, setActiveDayInView] = useState<number | null>(
    blog.days.length > 0 ? blog.days[0].dayNumber : null
  )
  const rightPaneRef = useRef<HTMLDivElement>(null)

  const handleMarkerClick = (dayNumber: number) => {
    // Call the exposed scrollToDay method on the right pane
    if (rightPaneRef.current && 'scrollToDay' in rightPaneRef.current) {
      ;(rightPaneRef.current as any).scrollToDay(dayNumber)
    }
  }

  const handleScrollDayChange = (dayNumber: number | null) => {
    setActiveDayInView(dayNumber)
  }

  return (
    <div className="flex h-screen bg-white">
      {/* Left Pane - Fixed (45%) */}
      <div className="w-[45%] h-screen overflow-hidden bg-white border-r border-gray-200 p-6">
        <LeftPane
          blog={blog}
          activeDayInView={activeDayInView}
          onMarkerClick={handleMarkerClick}
        />
      </div>

      {/* Right Pane - Scrollable (55%) */}
      <div ref={rightPaneRef} className="w-[55%] h-screen bg-white">
        <RightPane blog={blog} onScrollDayChange={handleScrollDayChange} />
      </div>
    </div>
  )
}
