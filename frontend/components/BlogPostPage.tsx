'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowRightIcon } from '@/components/Icons'
import { cn, formatDate } from '@/lib/utils'

interface BlogPost {
  id: string
  destination: string
  country: string
  author: string
  authorAvatar: string
  startDate: string
  endDate: string
  coverImage: string
  title: string
  content: string
  days: Array<{
    dayNumber: number
    date: string
    title: string
    content: string
    images: string[]
  }>
}

const mockBlogPost: BlogPost = {
  id: '1',
  destination: 'Tokyo',
  country: 'Japan',
  author: 'Elena Vance',
  authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Elena',
  startDate: '2024-10-12',
  endDate: '2024-10-22',
  coverImage:
    'https://images.unsplash.com/photo-1540959375944-7049f642e9d4?w=1400&h=700&fit=crop',
  title: 'Tokyo: A Symphony of Silicon & Silence',
  content: `Tokyo is not a city; it is a thousand small towns stacked on top of each other, held together by high-speed rail and the collective politeness of fourteen million souls. My journey began not with a plan, but with an inquiry to my digital Curator: "Find me the intersection of ancient craft and modern chaos."

This is the story of how a solo traveler got wonderfully lost in the alleys of tradition while the neon lights flickered overhead like digital ghosts, and how I learned that the best trips are the ones where you arrive with an open heart and leave with stories written in your bones.`,
  days: [
    {
      dayNumber: 1,
      date: '2024-10-12',
      title: 'Arrival in Tokyo',
      content: `The Shinjuku Gaze

Our first evening was spent wandering the narrow alleys of Omotesando Yokocho. Known as "Piss Alley," it's a sensory overload of charcoal-grilled yakitori and steam. We watched salarymen loosen their ties, laughing over glass mugs of highball while the neon lights flickered overhead like digital ghosts.

Standing at that intersection, I felt both ninety years back and a century ahead.`,
      images: [
        'https://images.unsplash.com/photo-1540959375944-7049f642e9d4?w=500&h=400&fit=crop',
        'https://images.unsplash.com/photo-1522383892331-f34b4d5f3c86?w=500&h=400&fit=crop',
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&h=400&fit=crop',
      ],
    },
    {
      dayNumber: 2,
      date: '2024-10-13',
      title: 'Meiji Jingu: The Forest in the City',
      content: `By morning, the neon frenzy of the night before felt like a dream. We walked through the massive Torii gates of Meiji Jingu. The sudden silence was absolute. Within the 170-acre forest, the only sound was the crunch of gravel beneath our feet and the distant chant of a Shinto priest.

The sudden silence was absolute.

Wandering deeper, we found ourselves not in a city, but in a world the Shoguns knew. We paused at a small shrine where local visitors left their wishes written on wooden plaques, requesting everything from good health to successful romance. In that moment, Tokyo wasn't about technology or chaos—it was about meaning.`,
      images: [
        'https://images.unsplash.com/photo-1545543519-54e8f9e7aee5?w=500&h=400&fit=crop',
        'https://images.unsplash.com/photo-1589519160732-57fc498494f8?w=500&h=400&fit=crop',
        'https://images.unsplash.com/photo-1582919755944-3a02b1827586?w=500&h=400&fit=crop',
      ],
    },
    {
      dayNumber: 3,
      date: '2024-10-14',
      title: 'Tsukiji Market & Beyond',
      content: `On the final morning, we descended into the culinary theater of Tsukiji Market. The tuna auction at 5 AM is a ballet performed at violent speed—ancient choreography meets industrial precision. We watched as steel hooks and shouts determined the fate of 200-pound fish in seconds.

Afterward, sushi breakfast. Six pieces of nigiri, each one a small work of art. The sushi chef knew we were tourists, but treated us as if we were regulars. That kind of grace is what I'll remember most.

In Tokyo, you don't look for beauty. You wait for it to reveal itself in the stream of 500 words, the smile of a stranger, or the way steam rises from a bowl of ramen on a cool October evening.`,
      images: [
        'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=500&h=400&fit=crop',
        'https://images.unsplash.com/photo-1553621042-f6e147245754?w=500&h=400&fit=crop',
        'https://images.unsplash.com/photo-1567521464027-f127ff144326?w=500&h=400&fit=crop',
      ],
    },
  ],
}

export const BlogPostPage = ({ params }: { params: { id: string } }) => {
  const post = mockBlogPost // In production, fetch based on params.id
  const [dayInView, setDayInView] = useState<number | null>(null)

  return (
    <div className="bg-warm-white min-h-screen">
      {/* Hero Section */}
      <div className="relative h-96 w-full overflow-hidden">
        <Image
          src={post.coverImage}
          alt={post.destination}
          fill
          className="object-cover"
          priority
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-warm-white" />

        <div className="absolute bottom-12 left-0 right-0">
          <div className="max-w-3xl mx-auto px-6">
            <h1 className="text-5xl font-bold text-text-primary mb-2">
              {post.title}
            </h1>
            <p className="text-lg text-text-secondary">
              {post.destination}, {post.country}
            </p>
          </div>
        </div>
      </div>

      {/* Author & Meta */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Image
                src={post.authorAvatar}
                alt={post.author}
                width={48}
                height={48}
                className="rounded-full"
                unoptimized
              />
              <div>
                <h3 className="font-semibold text-text-primary">
                  {post.author}
                </h3>
                <p className="text-xs text-text-muted">
                  {formatDate(post.startDate)} — {formatDate(post.endDate)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 bg-teal/10 rounded-full">
              <span className="text-xs font-medium text-teal">
                ✨ Written with TripMind
              </span>
            </div>
          </div>

          {/* Table of Contents */}
          <div className="flex gap-4 overflow-x-auto pb-2 -mb-2 scroll-smooth">
            {post.days.map((day) => (
              <button
                key={day.dayNumber}
                onClick={() => setDayInView(day.dayNumber)}
                className={cn(
                  'px-4 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-all duration-300 flex-shrink-0',
                  dayInView === day.dayNumber
                    ? 'bg-teal text-white'
                    : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                )}
              >
                Day {day.dayNumber}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Opening paragraph */}
        <article>
          <p className="text-lg leading-relaxed text-text-primary mb-8 font-serif">
            {post.content}
          </p>

          {/* Days */}
          {post.days.map((day) => (
            <section key={day.dayNumber} className="mb-12">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-px flex-1 bg-teal/30" />
                <h2 className="text-sm font-semibold text-teal uppercase tracking-widest whitespace-nowrap">
                  Day {day.dayNumber} — {day.title}
                </h2>
                <div className="h-px flex-1 bg-teal/30" />
              </div>

              <p className="text-lg leading-relaxed text-text-primary mb-8 font-serif">
                {day.content}
              </p>

              {/* Photo Grid */}
              <div className="grid grid-cols-3 gap-4 mb-12">
                {day.images.map((image, idx) => (
                  <div
                    key={idx}
                    className="relative h-48 rounded-lg overflow-hidden group"
                  >
                    <Image
                      src={image}
                      alt={`${day.title} - Photo ${idx + 1}`}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      unoptimized
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </article>

        {/* CTA */}
        <div className="mt-16 pt-12 border-t border-gray-100 bg-gradient-to-br from-teal/5 to-ocean/5 rounded-xl p-12 text-center">
          <h3 className="text-2xl font-bold text-text-primary mb-4">
            Feeling inspired?
          </h3>
          <p className="text-text-secondary mb-8 max-w-xl mx-auto">
            TripMind can recreate this Tokyo itinerary or tailor a new journey
            just for you. Let&apos;s get planning.
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
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-sm text-gray-300">
            © {new Date().getFullYear()} TripMind. Your memories, amplified.
          </p>
        </div>
      </div>
    </div>
  )
}
