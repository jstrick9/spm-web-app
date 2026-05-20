export interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
  date: string;      // ISO date string
  category: TimelineCategory;
  venueId?: string;
  assignedTo?: string[]; // User IDs
  vendorIds?: string[];  // Vendor IDs
  location?: string;
  notes?: string;
  isCompleted?: boolean;
  completedAt?: string;
  color?: string;
  icon?: string;
  reminderMinutes?: number; // Minutes before event to remind
}

export type TimelineCategory = 
  | 'ceremony'
  | 'reception'
  | 'getting-ready'
  | 'photography'
  | 'transportation'
  | 'vendor-arrival'
  | 'meal'
  | 'entertainment'
  | 'other';

export interface TimelineDay {
  id: string;
  date: string; // ISO date string
  label: string; // e.g., "Wedding Day", "Day Before"
  events: TimelineEvent[];
}

export interface WeddingTimeline {
  id: string;
  name: string;
  weddingDate: string;
  days: TimelineDay[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export const TIMELINE_CATEGORIES: { id: TimelineCategory; label: string; icon: string; color: string }[] = [
  { id: 'ceremony', label: 'Ceremony', icon: '💒', color: '#4A1942' },
  { id: 'reception', label: 'Reception', icon: '🎉', color: '#8B5A8B' },
  { id: 'getting-ready', label: 'Getting Ready', icon: '💄', color: '#E8B4B8' },
  { id: 'photography', label: 'Photography', icon: '📸', color: '#4A90A4' },
  { id: 'transportation', label: 'Transportation', icon: '🚗', color: '#5B8C5A' },
  { id: 'vendor-arrival', label: 'Vendor Arrival', icon: '📦', color: '#D4A574' },
  { id: 'meal', label: 'Meals', icon: '🍽️', color: '#C77D63' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎵', color: '#6B5B95' },
  { id: 'other', label: 'Other', icon: '📋', color: '#808080' },
];