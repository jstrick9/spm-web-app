import React, { useState } from 'react';
import { useTimeline } from '../hooks/useTimeline';
import { TimelineEvent, TimelineDay, TIMELINE_CATEGORIES, TimelineCategory } from '../types/timeline';

interface TimelinePanelProps {
  onClose: () => void;
}

export function TimelinePanel({ onClose }: TimelinePanelProps) {
  const {
    timelines,
    activeTimeline,
    activeTimelineId,
    setActiveTimelineId,
    createTimeline,
    addDay,
    removeDay,
    addEvent,
    updateEvent,
    removeEvent,
    toggleEventComplete,
    deleteTimeline,
  } = useTimeline();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTimelineName, setNewTimelineName] = useState('');
  const [newTimelineDate, setNewTimelineDate] = useState('');
  const [showAddEvent, setShowAddEvent] = useState<string | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: '',
    startTime: '09:00',
    endTime: '10:00',
    category: 'other' as TimelineCategory,
    location: '',
    notes: '',
  });

  const handleCreateTimeline = () => {
    if (!newTimelineName.trim() || !newTimelineDate) return;
    createTimeline(newTimelineName.trim(), newTimelineDate);
    setNewTimelineName('');
    setNewTimelineDate('');
    setShowCreateModal(false);
  };

  const handleAddEvent = (dayId: string) => {
    if (!activeTimelineId || !newEvent.title.trim()) return;
    
    addEvent(activeTimelineId, dayId, {
      title: newEvent.title.trim(),
      startTime: newEvent.startTime,
      endTime: newEvent.endTime,
      date: activeTimeline?.days.find(d => d.id === dayId)?.date || '',
      category: newEvent.category,
      location: newEvent.location || undefined,
      notes: newEvent.notes || undefined,
    });

    setNewEvent({
      title: '',
      startTime: '09:00',
      endTime: '10:00',
      category: 'other',
      location: '',
      notes: '',
    });
    setShowAddEvent(null);
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  const getCategoryInfo = (category: TimelineCategory) => {
    return TIMELINE_CATEGORIES.find(c => c.id === category) || TIMELINE_CATEGORIES[TIMELINE_CATEGORIES.length - 1];
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
      <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#4A1942] to-[#3d1a45] text-white p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">📅 Wedding Timeline</h2>
            <p className="text-sm text-white/70">
              {activeTimeline ? activeTimeline.name : 'Plan your wedding day schedule'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {/* No timeline selected */}
          {!activeTimelineId && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📅</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No Timeline Selected</h3>
              <p className="text-gray-500 mb-6">Create a new timeline or select an existing one to get started.</p>
              
              <div className="flex flex-col gap-3 items-center">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-3 bg-[#4A1942] text-white rounded-lg font-medium hover:bg-[#3b1435] transition-colors"
                >
                  ➕ Create New Timeline
                </button>

                {timelines.length > 0 && (
                  <div className="mt-6 w-full max-w-md">
                    <h4 className="text-sm font-medium text-gray-600 mb-3">Existing Timelines:</h4>
                    <div className="space-y-2">
                      {timelines.map(t => (
                        <button
                          key={t.id}
                          onClick={() => setActiveTimelineId(t.id)}
                          className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-left transition-colors flex items-center justify-between"
                        >
                          <div>
                            <div className="font-medium">{t.name}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(t.weddingDate).toLocaleDateString()} • {t.days.length} day(s)
                            </div>
                          </div>
                          <span className="text-gray-400">→</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Active timeline */}
          {activeTimeline && (
            <div className="space-y-6">
              {/* Timeline header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{activeTimeline.name}</h3>
                  <p className="text-sm text-gray-500">
                    Wedding Date: {new Date(activeTimeline.weddingDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const date = prompt('Enter date (YYYY-MM-DD):');
                      const label = prompt('Enter day label (e.g., "Day Before"):');
                      if (date && label && activeTimelineId) {
                        addDay(activeTimelineId, date, label);
                      }
                    }}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                  >
                    ➕ Add Day
                  </button>
                  <button
                    onClick={() => setActiveTimelineId(null)}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                  >
                    ← Back
                  </button>
                </div>
              </div>

              {/* Days */}
              {activeTimeline.days.map(day => (
                <div key={day.id} className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-semibold text-gray-800">{day.label}</h4>
                      <p className="text-sm text-gray-500">
                        {new Date(day.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowAddEvent(day.id)}
                        className="px-3 py-1.5 bg-[#4A1942] text-white rounded-lg text-sm hover:bg-[#3b1435] transition-colors"
                      >
                        + Add Event
                      </button>
                      {activeTimeline.days.length > 1 && (
                        <button
                          onClick={() => activeTimelineId && removeDay(activeTimelineId, day.id)}
                          className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200 transition-colors"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Add event form */}
                  {showAddEvent === day.id && (
                    <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-500 mb-1">Event Title</label>
                          <input
                            type="text"
                            value={newEvent.title}
                            onChange={e => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="e.g., Hair & Makeup"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Start Time</label>
                          <input
                            type="time"
                            value={newEvent.startTime}
                            onChange={e => setNewEvent(prev => ({ ...prev, startTime: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">End Time</label>
                          <input
                            type="time"
                            value={newEvent.endTime}
                            onChange={e => setNewEvent(prev => ({ ...prev, endTime: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                          <select
                            value={newEvent.category}
                            onChange={e => setNewEvent(prev => ({ ...prev, category: e.target.value as TimelineCategory }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          >
                            {TIMELINE_CATEGORIES.map(cat => (
                              <option key={cat.id} value={cat.id}>
                                {cat.icon} {cat.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
                          <input
                            type="text"
                            value={newEvent.location}
                            onChange={e => setNewEvent(prev => ({ ...prev, location: e.target.value }))}
                            placeholder="Optional"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setShowAddEvent(null)}
                          className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleAddEvent(day.id)}
                          disabled={!newEvent.title.trim()}
                          className="px-4 py-2 bg-[#4A1942] text-white rounded-lg text-sm hover:bg-[#3b1435] disabled:opacity-50"
                        >
                          Add Event
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Events list */}
                  {day.events.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <p>No events scheduled for this day</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {day.events.map(event => {
                        const categoryInfo = getCategoryInfo(event.category);
                        return (
                          <div
                            key={event.id}
                            className={`flex items-center gap-3 p-3 bg-white rounded-lg border-l-4 transition-all ${
                              event.isCompleted ? 'opacity-60' : ''
                            }`}
                            style={{ borderLeftColor: categoryInfo.color }}
                          >
                            <button
                              onClick={() => activeTimelineId && toggleEventComplete(activeTimelineId, day.id, event.id)}
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                event.isCompleted
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-gray-300 hover:border-green-400'
                              }`}
                            >
                              {event.isCompleted && '✓'}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{categoryInfo.icon}</span>
                                <span className={`font-medium ${event.isCompleted ? 'line-through text-gray-400' : ''}`}>
                                  {event.title}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                                <span>🕐 {formatTime(event.startTime)} - {formatTime(event.endTime)}</span>
                                {event.location && <span>📍 {event.location}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => activeTimelineId && removeEvent(activeTimelineId, day.id, event.id)}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="Delete event"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              {/* Delete timeline */}
              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this timeline?') && activeTimelineId) {
                      deleteTimeline(activeTimelineId);
                    }
                  }}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  🗑️ Delete this timeline
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Create Timeline Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 10001 }}>
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
              <h3 className="text-lg font-semibold mb-4">Create New Timeline</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timeline Name</label>
                  <input
                    type="text"
                    value={newTimelineName}
                    onChange={e => setNewTimelineName(e.target.value)}
                    placeholder="e.g., Sarah & John's Wedding"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Wedding Date</label>
                  <input
                    type="date"
                    value={newTimelineDate}
                    onChange={e => setNewTimelineDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTimeline}
                  disabled={!newTimelineName.trim() || !newTimelineDate}
                  className="flex-1 px-4 py-2 bg-[#4A1942] text-white rounded-lg hover:bg-[#3b1435] disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TimelinePanel;