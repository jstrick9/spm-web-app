import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { cn } from './lib/cn';

interface Emoji {
  emoji: string;
  name: string;
  category: string;
}

const EMOJI_DB: Emoji[] = [
  // Smileys & Emotion
  { emoji: '😀', name: 'grinning face', category: 'Smileys' },
  { emoji: '😂', name: 'face with tears of joy', category: 'Smileys' },
  { emoji: '🥰', name: 'smiling face with hearts', category: 'Smileys' },
  { emoji: '😎', name: 'smiling face with sunglasses', category: 'Smileys' },
  { emoji: '🤔', name: 'thinking face', category: 'Smileys' },
  { emoji: '😭', name: 'loudly crying face', category: 'Smileys' },
  { emoji: '👍', name: 'thumbs up', category: 'Smileys' },
  { emoji: '🙏', name: 'folded hands', category: 'Smileys' },
  { emoji: '🎉', name: 'party popper', category: 'Smileys' },
  { emoji: '✨', name: 'sparkles', category: 'Smileys' },
  { emoji: '😍', name: 'smiling face with heart-eyes', category: 'Smileys' },
  { emoji: '🤩', name: 'star-struck', category: 'Smileys' },
  { emoji: '😊', name: 'smiling face with smiling eyes', category: 'Smileys' },
  { emoji: '👏', name: 'clapping hands', category: 'Smileys' },
  { emoji: '🙌', name: 'raising hands', category: 'Smileys' },
  { emoji: '💖', name: 'sparkling heart', category: 'Smileys' },
  { emoji: '❤️', name: 'red heart', category: 'Smileys' },
  { emoji: '💕', name: 'two hearts', category: 'Smileys' },
  { emoji: '🌟', name: 'glowing star', category: 'Smileys' },
  { emoji: '💫', name: 'dizzy symbol', category: 'Smileys' },
  
  // Wedding Specific
  { emoji: '👰', name: 'bride with veil', category: 'Wedding' },
  { emoji: '🤵', name: 'man in tuxedo', category: 'Wedding' },
  { emoji: '💍', name: 'ring', category: 'Wedding' },
  { emoji: '💐', name: 'bouquet', category: 'Wedding' },
  { emoji: '💒', name: 'wedding', category: 'Wedding' },
  { emoji: '🥂', name: 'clinking glasses', category: 'Wedding' },
  { emoji: '🍾', name: 'bottle with popping cork', category: 'Wedding' },
  { emoji: '💌', name: 'love letter', category: 'Wedding' },
  { emoji: '📸', name: 'camera', category: 'Wedding' },
  { emoji: '🕊️', name: 'dove', category: 'Wedding' },
  { emoji: '👑', name: 'crown', category: 'Wedding' },
  { emoji: '💎', name: 'gem stone', category: 'Wedding' },
  { emoji: '🎀', name: 'ribbon', category: 'Wedding' },
  { emoji: '💝', name: 'heart with ribbon', category: 'Wedding' },
  { emoji: '🎈', name: 'balloon', category: 'Wedding' },

  // Food & Drink
  { emoji: '🎂', name: 'birthday cake', category: 'Food' },
  { emoji: '🍰', name: 'shortcake', category: 'Food' },
  { emoji: '🍷', name: 'wine glass', category: 'Food' },
  { emoji: '🍽️', name: 'fork and knife with plate', category: 'Food' },
  { emoji: '🥗', name: 'green salad', category: 'Food' },
  { emoji: '🥩', name: 'cut of meat', category: 'Food' },
  { emoji: '🥖', name: 'baguette bread', category: 'Food' },
  { emoji: '🍲', name: 'pot of food', category: 'Food' },
  { emoji: '🍹', name: 'tropical drink', category: 'Food' },
  { emoji: '🍺', name: 'beer mug', category: 'Food' },

  // Activities & Music
  { emoji: '🎵', name: 'musical note', category: 'Music' },
  { emoji: '💃', name: 'woman dancing', category: 'Music' },
  { emoji: '🕺', name: 'man dancing', category: 'Music' },
  { emoji: '🎤', name: 'microphone', category: 'Music' },
  { emoji: '🎧', name: 'headphone', category: 'Music' },
  { emoji: '🎶', name: 'musical notes', category: 'Music' },
  { emoji: '🎸', name: 'guitar', category: 'Music' },
  { emoji: '🎹', name: 'musical keyboard', category: 'Music' },

  // Logistics
  { emoji: '📅', name: 'calendar', category: 'Logistics' },
  { emoji: '⏰', name: 'alarm clock', category: 'Logistics' },
  { emoji: '📍', name: 'round pushpin', category: 'Logistics' },
  { emoji: '🚗', name: 'automobile', category: 'Logistics' },
  { emoji: '🚚', name: 'delivery truck', category: 'Logistics' },
  { emoji: '🗺️', name: 'world map', category: 'Logistics' },
  { emoji: '📋', name: 'clipboard', category: 'Logistics' },
  { emoji: '🚒', name: 'fire engine', category: 'Logistics' },
  { emoji: '📐', name: 'triangular ruler', category: 'Logistics' },
  { emoji: '🏛️', name: 'classical building', category: 'Logistics' },
  
  // Decor & Seating
  { emoji: '🪑', name: 'chair style', category: 'Decor' },
  { emoji: '🛋️', name: 'couch and lamp', category: 'Decor' },
  { emoji: '🕯️', name: 'candle', category: 'Decor' },
  { emoji: '💡', name: 'light bulb', category: 'Decor' },
  { emoji: '🌿', name: 'herb foliage', category: 'Decor' },
  { emoji: '🌸', name: 'cherry blossom', category: 'Decor' },
  { emoji: '🌹', name: 'rose', category: 'Decor' },
  { emoji: '🥀', name: 'wilted flower', category: 'Decor' },
  { emoji: '🌺', name: 'hibiscus', category: 'Decor' },
  { emoji: '🌻', name: 'sunflower', category: 'Decor' },
  { emoji: '🌼', name: 'blossom', category: 'Decor' },
  { emoji: '🌲', name: 'evergreen tree', category: 'Decor' },
  { emoji: '🪵', name: 'wood timber', category: 'Decor' },
  { emoji: '🚪', name: 'door', category: 'Decor' },
  { emoji: '📦', name: 'package stage', category: 'Decor' },
  
  // Symbols
  { emoji: '✅', name: 'check mark button', category: 'Symbols' },
  { emoji: '❌', name: 'cross mark', category: 'Symbols' },
  { emoji: '⚠️', name: 'warning', category: 'Symbols' },
  { emoji: '❓', name: 'question mark', category: 'Symbols' },
  { emoji: '❗', name: 'exclamation mark', category: 'Symbols' },
  { emoji: '🚨', name: 'police car light', category: 'Symbols' },
  { emoji: '🛑', name: 'stop sign', category: 'Symbols' },
  { emoji: '♿', name: 'wheelchair symbol', category: 'Symbols' },
];

const CATEGORIES = ['Smileys', 'Wedding', 'Food', 'Music', 'Logistics', 'Decor', 'Symbols'];

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  className?: string;
}

export function EmojiPicker({ onSelect, onClose, className }: Props) {
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<string>('Smileys');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const filtered = EMOJI_DB.filter(e => 
    (search === '' ? e.category === activeCat : true) && 
    (search === '' || e.name.includes(search.toLowerCase()))
  );

  return (
    <div ref={ref} className={cn("absolute z-50 w-72 bg-surface border border-border rounded-xl shadow-elev-2 flex flex-col animate-in fade-in zoom-in-95 duration-200", className)}>
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted" />
          <input 
            type="text" 
            placeholder="Search emojis..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-2 border-none rounded-md py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand transition-shadow"
            autoFocus
          />
        </div>
      </div>

      {!search && (
        <div className="flex px-2 py-1.5 border-b border-border overflow-x-auto no-scrollbar gap-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCat(cat)}
              className={cn(
                "px-2.5 py-1 text-[10px] font-medium rounded-pill whitespace-nowrap transition-colors",
                activeCat === cat ? "bg-brand-soft text-brand-strong" : "text-fg-muted hover:bg-surface-2 hover:text-fg"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="p-3 h-48 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center text-sm text-fg-muted py-8">No emojis found.</div>
        ) : (
          <div className="grid grid-cols-8 gap-1">
            {filtered.map((item, i) => (
              <button
                key={i}
                onClick={() => { onSelect(item.emoji); onClose(); }}
                className="w-8 h-8 flex items-center justify-center hover:bg-surface-2 rounded text-xl transition-transform hover:scale-110"
                title={item.name}
              >
                {item.emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
