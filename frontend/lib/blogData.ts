// Blog data types and utilities
import tokyoData from '@/data/blogs/tokyo.json';
import vegasData from '@/data/blogs/vegas.json';
import vermountData from '@/data/blogs/vermount.json';

export interface BlogDay {
  dayNumber: number;
  date: string;
  title: string;
  content: string;
  wakeUp?: string;
  sleepDuration?: string;
  metrics?: Record<string, any>;
  images?: string[];
}

export interface Destination {
  dayNumber: number;
  name: string;
  lat: number;
  lng: number;
}

export interface BlogMetrics {
  totalDays: number;
  totalKm: number;
  stopsCount: number;
  averageActivitiesPerDay: number;
}

export interface Blog {
  id: string;
  destination: string;
  country: string;
  author: string;
  authorAvatar: string;
  startDate: string;
  endDate: string;
  coverImage: string;
  title: string;
  description: string;
  destinations?: Destination[];
  metrics?: BlogMetrics;
  days: BlogDay[];
}

// Blog data fixtures
const blogDatabase: Record<string, Blog> = {
  tokyo: tokyoData as Blog,
  vegas: vegasData as Blog,
  vermount: vermountData as Blog,
};

/**
 * Retrieves a blog by ID
 * @param blogId - The blog ID (tokyo, vegas, vermount)
 * @returns Blog object or null if not found
 */
export const getBlogById = (blogId: string): Blog | null => {
  return blogDatabase[blogId.toLowerCase()] || null;
};

/**
 * Gets all available blogs
 * @returns Array of all blogs
 */
export const getAllBlogs = (): Blog[] => {
  return Object.values(blogDatabase);
};

/**
 * Gets the blog ID for a given destination
 * @param destination - Destination name (Tokyo, Vegas, Vermont)
 * @returns Blog ID or null if not found
 */
export const getBlogIdByDestination = (destination: string): string | null => {
  const destinationMap: Record<string, string> = {
    tokyo: 'tokyo',
    'tokyo, japan': 'tokyo',
    vegas: 'vegas',
    'las vegas, usa': 'vegas',
    'las vegas': 'vegas',
    vermount: 'vermount',
    'vermont, usa': 'vermount',
    vermont: 'vermount',
  };

  return destinationMap[destination.toLowerCase()] || null;
};

/**
 * Formats date range for display
 * @param startDate - Start date string
 * @param endDate - End date string
 * @returns Formatted date range
 */
export const formatDateRange = (startDate: string, endDate: string): string => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
  const startDay = start.getDate();
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
  const endDay = end.getDate();
  const year = end.getFullYear();

  if (start.getMonth() === end.getMonth()) {
    return `${startMonth} ${startDay}${startDay !== endDay ? '-' + endDay : ''}, ${year}`;
  }

  return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
};

/**
 * Calculates trip duration in days
 * @param startDate - Start date string
 * @param endDate - End date string
 * @returns Number of days
 */
export const calculateTripDuration = (startDate: string, endDate: string): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include the first day
  return diffDays;
};
