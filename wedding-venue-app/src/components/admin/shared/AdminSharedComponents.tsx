// @ts-nocheck
import React from 'react';
import { Config } from '../../../config';

interface BrandedSectionHeaderProps {
  icon: string;
  title: string;
  description?: string;
  config: Config;
  variant?: 'primary' | 'secondary' | 'accent';
}

export function BrandedSectionHeader({ icon, title, description, config, variant = 'primary' }: BrandedSectionHeaderProps) {
  const bgColor = variant === 'primary' ? config.primaryColor : 
                  variant === 'secondary' ? config.primaryDark : config.accentColor;
  
  return (
    <div className="p-4 rounded-t-xl" style={{ 
      background: `linear-gradient(135deg, ${bgColor} 0%, ${config.primaryDark} 100%)`,
      fontFamily: config.headingFontFamily 
    }}>
      <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: config.headerTextColor }}>
        <span className="text-xl">{icon}</span>
        {title}
      </h3>
      {description && (
        <p className="text-sm mt-1 opacity-90" style={{ color: config.headerTextColor }}>
          {description}
        </p>
      )}
    </div>
  );
}

interface BrandedStatCardProps {
  icon: string;
  label: string;
  value: string | number;
  config: Config;
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning';
}

export function BrandedStatCard({ icon, label, value, config, variant = 'primary' }: BrandedStatCardProps) {
  const bgColor = variant === 'primary' ? `${config.primaryColor}15` :
                  variant === 'secondary' ? `${config.primaryDark}15` :
                  variant === 'accent' ? `${config.accentColor}15` :
                  variant === 'success' ? '#10b98115' : '#f59e0b15';
  
  const textColor = variant === 'primary' ? config.primaryColor :
                    variant === 'secondary' ? config.primaryDark :
                    variant === 'accent' ? config.accentColor :
                    variant === 'success' ? '#059669' : '#d97706';

  return (
    <div className="p-3 rounded-xl text-center border" style={{ backgroundColor: bgColor, borderColor: `${textColor}30` }}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-xl font-bold" style={{ color: textColor }}>{value}</div>
      <div className="text-xs text-gray-600">{label}</div>
    </div>
  );
}

interface TipItem {
  icon?: string;
  title: string;
  description: string;
}

interface BrandedTipsProps {
  title: string;
  tips: TipItem[];
  config: Config;
  defaultOpen?: boolean;
}

export function BrandedTips({ title, tips, config, defaultOpen = false }: BrandedTipsProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: `${config.primaryColor}08`, borderColor: `${config.primaryColor}30` }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between cursor-pointer hover:opacity-90"
        style={{ backgroundColor: `${config.primaryColor}15` }}
      >
        <h4 className="font-semibold flex items-center gap-2" style={{ color: config.primaryColor }}>
          <span>💡</span>
          <span>{title}</span>
        </h4>
        <span style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </button>
      {isOpen && (
        <div className="p-4 space-y-3">
          {tips.map((tip, index) => (
            <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-white/50 border" style={{ borderColor: `${config.primaryColor}20` }}>
              <span className="text-lg flex-shrink-0">{tip.icon || '💡'}</span>
              <div>
                <h5 className="font-semibold text-sm" style={{ color: config.primaryColor }}>{tip.title}</h5>
                <p className="text-xs text-gray-600 mt-0.5">{tip.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// Chair layout options for rectangular tables
const chairLayoutOptions: { id: RectangularChairLayout; name: string; description: string }[] = [
  { id: 'all-sides', name: 'All Sides', description: 'Chairs on all 4 sides' },
  { id: 'long-sides-only', name: 'Long Sides Only', description: 'Chairs only on long sides (e.g., 4+4)' },
  { id: 'head-table', name: 'Head Table', description: 'Chairs on one side only (facing out)' },
];

export interface AdminPanelProps {
  onClose: () => void;
  currentLayout?: {
    tables: PlacedTable[];
    fixtures: PlacedFixture[];
    venueId: string;
    category?: LayoutCategory;
  };
  onLoadTemplateForEdit?: (template: LayoutTemplate) => void;
}

const shapeOptions: ShapeType[] = ['circle', 'rectangle', 'triangle', 'semicircle', 'oval', 'hexagon', 'octagon', 'polygon'];
const patternOptions: PatternType[] = ['solid', 'checkered', 'gravel', 'concrete', 'grass', 'wood', 'tile', 'brick', 'marble', 'water', 'carpet'];

// Default colors for each pattern type
const defaultPatternColors: Record<PatternType, PatternColors> = {
  solid: { color1: '#FFFFFF', color2: '#FFFFFF' },
  checkered: { color1: '#FFFFFF', color2: '#1a1a1a' },
  gravel: { color1: '#B8860B', color2: '#8B7355' },
  concrete: { color1: '#C0C0C0', color2: '#A9A9A9' },
  grass: { color1: '#90EE90', color2: '#228B22' },
  wood: { color1: '#DEB887', color2: '#CD853F' },
  tile: { color1: '#E8E8E8', color2: '#D0D0D0' },
  brick: { color1: '#B74A3A', color2: '#8B4513' },
  marble: { color1: '#F5F5F5', color2: '#C0C0C0' },
  water: { color1: '#87CEEB', color2: '#4169E1' },
  carpet: { color1: '#8B4513', color2: '#654321' }
};

// Get pattern color labels based on pattern type
const getPatternColorLabels = (pattern: PatternType): { label1: string; label2: string } => {
  switch (pattern) {
    case 'checkered': return { label1: 'Square 1 Color', label2: 'Square 2 Color' };
    case 'gravel': return { label1: 'Background', label2: 'Gravel Color' };
    case 'concrete': return { label1: 'Concrete Color', label2: 'Joint Color' };
    case 'grass': return { label1: 'Grass Color', label2: 'Blade Color' };
    case 'wood': return { label1: 'Wood Color', label2: 'Grain Color' };
    case 'tile': return { label1: 'Tile Color', label2: 'Grout Color' };
    case 'brick': return { label1: 'Brick Color', label2: 'Mortar Color' };
    case 'marble': return { label1: 'Marble Color', label2: 'Vein Color' };
    case 'water': return { label1: 'Water Color', label2: 'Ripple Color' };
    case 'carpet': return { label1: 'Carpet Color', label2: 'Texture Color' };
    default: return { label1: 'Primary Color', label2: 'Secondary Color' };
  }
};

// Pattern color picker component

interface PatternColorPickerProps {
  pattern: PatternType;
  patternColors?: PatternColors;
  onChange: (colors: PatternColors) => void;
}

export function PatternColorPicker({ pattern, patternColors, onChange }: PatternColorPickerProps) {
  if (pattern === 'solid') return null;
  
  const colors = patternColors || defaultPatternColors[pattern];
  const labels = getPatternColorLabels(pattern);
  
  return (
    <div className="mt-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
      <h5 className="text-xs font-semibold text-purple-800 mb-2 flex items-center gap-1">
        🎨 Pattern Colors for {pattern.charAt(0).toUpperCase() + pattern.slice(1)}
      </h5>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600">{labels.label1}</label>
          <div className="flex gap-1 mt-1">
            <input
              type="color"
              value={colors.color1}
              onChange={(e) => onChange({ ...colors, color1: e.target.value })}
              className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
            />
            <input
              type="text"
              value={colors.color1}
              onChange={(e) => onChange({ ...colors, color1: e.target.value })}
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">{labels.label2}</label>
          <div className="flex gap-1 mt-1">
            <input
              type="color"
              value={colors.color2}
              onChange={(e) => onChange({ ...colors, color2: e.target.value })}
              className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
            />
            <input
              type="text"
              value={colors.color2}
              onChange={(e) => onChange({ ...colors, color2: e.target.value })}
              className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
            />
          </div>
        </div>
      </div>
      {/* Pattern preview */}
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-gray-500">Preview:</span>
        <div 
          className="w-16 h-8 rounded border border-gray-300"
          style={{
            background: pattern === 'checkered' 
              ? `repeating-conic-gradient(${colors.color1} 0% 25%, ${colors.color2} 0% 50%) 50% / 16px 16px`
              : pattern === 'grass' || pattern === 'gravel'
              ? `radial-gradient(circle at 25% 25%, ${colors.color2} 2px, transparent 2px), radial-gradient(circle at 75% 75%, ${colors.color2} 2px, transparent 2px), ${colors.color1}`
              : pattern === 'wood'
              ? `repeating-linear-gradient(0deg, ${colors.color1}, ${colors.color1} 4px, ${colors.color2} 4px, ${colors.color2} 5px)`
              : pattern === 'tile' || pattern === 'brick'
              ? `linear-gradient(${colors.color2} 1px, transparent 1px), linear-gradient(90deg, ${colors.color2} 1px, ${colors.color1} 1px)`
              : pattern === 'water'
              ? `linear-gradient(135deg, ${colors.color1} 25%, ${colors.color2} 25%, ${colors.color2} 50%, ${colors.color1} 50%, ${colors.color1} 75%, ${colors.color2} 75%)`
              : `linear-gradient(135deg, ${colors.color1} 50%, ${colors.color2} 50%)`
          }}
        />
        <button
          type="button"
          onClick={() => onChange(defaultPatternColors[pattern])}
          className="text-xs text-purple-600 hover:text-purple-800"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

