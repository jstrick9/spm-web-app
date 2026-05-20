import { useState, useCallback, useEffect } from 'react';
import { WeddingTimeline, TimelineDay, TimelineEvent, TimelineCategory } from '../types/timeline';
import { STORAGE_KEYS } from '../constants/storageKeys';

const STORAGE_KEY = 'spm_timelines';

function loadTimelines(): WeddingTimeline[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTimelines(timelines: WeddingTimeline[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(timelines));
}

export function useTimeline() {
  const [timelines, setTimelines] = useState<WeddingTimeline[]>(() => loadTimelines());
  const [activeTimelineId, setActiveTimelineId] = useState<string | null>(null);

  useEffect(() => {
    saveTimelines(timelines);
  }, [timelines]);

  const activeTimeline = timelines.find(t => t.id === activeTimelineId) || null;

  const createTimeline = useCallback((name: string, weddingDate: string): WeddingTimeline => {
    const newTimeline: WeddingTimeline = {
      id: `timeline-${Date.now()}`,
      name,
      weddingDate,
      days: [
        {
          id: `day-${Date.now()}`,
          date: weddingDate,
          label: 'Wedding Day',
          events: [],
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setTimelines(prev => [...prev, newTimeline]);
    setActiveTimelineId(newTimeline.id);
    return newTimeline;
  }, []);

  const updateTimeline = useCallback((timelineId: string, updates: Partial<WeddingTimeline>) => {
    setTimelines(prev => prev.map(t => 
      t.id === timelineId 
        ? { ...t, ...updates, updatedAt: new Date().toISOString() }
        : t
    ));
  }, []);

  const deleteTimeline = useCallback((timelineId: string) => {
    setTimelines(prev => prev.filter(t => t.id !== timelineId));
    if (activeTimelineId === timelineId) {
      setActiveTimelineId(null);
    }
  }, [activeTimelineId]);

  const addDay = useCallback((timelineId: string, date: string, label: string): TimelineDay => {
    const newDay: TimelineDay = {
      id: `day-${Date.now()}`,
      date,
      label,
      events: [],
    };

    setTimelines(prev => prev.map(t => 
      t.id === timelineId 
        ? { ...t, days: [...t.days, newDay].sort((a, b) => a.date.localeCompare(b.date)), updatedAt: new Date().toISOString() }
        : t
    ));

    return newDay;
  }, []);

  const removeDay = useCallback((timelineId: string, dayId: string) => {
    setTimelines(prev => prev.map(t => 
      t.id === timelineId 
        ? { ...t, days: t.days.filter(d => d.id !== dayId), updatedAt: new Date().toISOString() }
        : t
    ));
  }, []);

  const addEvent = useCallback((timelineId: string, dayId: string, event: Omit<TimelineEvent, 'id'>): TimelineEvent => {
    const newEvent: TimelineEvent = {
      ...event,
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    };

    setTimelines(prev => prev.map(t => 
      t.id === timelineId 
        ? {
            ...t,
            days: t.days.map(d => 
              d.id === dayId 
                ? { ...d, events: [...d.events, newEvent].sort((a, b) => a.startTime.localeCompare(b.startTime)) }
                : d
            ),
            updatedAt: new Date().toISOString(),
          }
        : t
    ));

    return newEvent;
  }, []);

  const updateEvent = useCallback((timelineId: string, dayId: string, eventId: string, updates: Partial<TimelineEvent>) => {
    setTimelines(prev => prev.map(t => 
      t.id === timelineId 
        ? {
            ...t,
            days: t.days.map(d => 
              d.id === dayId 
                ? {
                    ...d,
                    events: d.events.map(e => 
                      e.id === eventId ? { ...e, ...updates } : e
                    ).sort((a, b) => a.startTime.localeCompare(b.startTime)),
                  }
                : d
            ),
            updatedAt: new Date().toISOString(),
          }
        : t
    ));
  }, []);

  const removeEvent = useCallback((timelineId: string, dayId: string, eventId: string) => {
    setTimelines(prev => prev.map(t => 
      t.id === timelineId 
        ? {
            ...t,
            days: t.days.map(d => 
              d.id === dayId 
                ? { ...d, events: d.events.filter(e => e.id !== eventId) }
                : d
            ),
            updatedAt: new Date().toISOString(),
          }
        : t
    ));
  }, []);

  const toggleEventComplete = useCallback((timelineId: string, dayId: string, eventId: string) => {
    setTimelines(prev => prev.map(t => 
      t.id === timelineId 
        ? {
            ...t,
            days: t.days.map(d => 
              d.id === dayId 
                ? {
                    ...d,
                    events: d.events.map(e => 
                      e.id === eventId 
                        ? { 
                            ...e, 
                            isCompleted: !e.isCompleted,
                            completedAt: !e.isCompleted ? new Date().toISOString() : undefined,
                          } 
                        : e
                    ),
                  }
                : d
            ),
            updatedAt: new Date().toISOString(),
          }
        : t
    ));
  }, []);

  const duplicateEvent = useCallback((timelineId: string, dayId: string, eventId: string): TimelineEvent | null => {
    const timeline = timelines.find(t => t.id === timelineId);
    if (!timeline) return null;

    const day = timeline.days.find(d => d.id === dayId);
    if (!day) return null;

    const event = day.events.find(e => e.id === eventId);
    if (!event) return null;

    return addEvent(timelineId, dayId, {
      ...event,
      title: `${event.title} (Copy)`,
      isCompleted: false,
      completedAt: undefined,
    });
  }, [timelines, addEvent]);

  const getEventsByCategory = useCallback((timelineId: string, category: TimelineCategory): TimelineEvent[] => {
    const timeline = timelines.find(t => t.id === timelineId);
    if (!timeline) return [];

    return timeline.days.flatMap(d => d.events.filter(e => e.category === category));
  }, [timelines]);

  const getUpcomingEvents = useCallback((timelineId: string, minutes: number = 60): TimelineEvent[] => {
    const timeline = timelines.find(t => t.id === timelineId);
    if (!timeline) return [];

    const now = new Date();
    const future = new Date(now.getTime() + minutes * 60000);

    return timeline.days.flatMap(d => 
      d.events.filter(e => {
        if (e.isCompleted) return false;
        const eventTime = new Date(`${d.date}T${e.startTime}`);
        return eventTime >= now && eventTime <= future;
      })
    );
  }, [timelines]);

  return {
    timelines,
    activeTimeline,
    activeTimelineId,
    setActiveTimelineId,
    createTimeline,
    updateTimeline,
    deleteTimeline,
    addDay,
    removeDay,
    addEvent,
    updateEvent,
    removeEvent,
    toggleEventComplete,
    duplicateEvent,
    getEventsByCategory,
    getUpcomingEvents,
  };
}