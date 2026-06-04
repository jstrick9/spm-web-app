import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Venue, PlacedTable, PlacedFixture, Guest, CeremonyChairRow, RectangularChairLayout, PlacedDecor, DecorArrangement } from '../types';
import { getTableSpecs, getFixtureTypes, getLinenColors, getDecorArrangements, getDecorItems } from '../hooks/useLayoutState';
import { getChairSpecs, getSpacingSettings } from '../data/venueData';
import { getConfig } from '../config';
import { on } from '../utils/appEvents';

interface Position {
  x: number;
  y: number;
}

export interface FloorPlanCanvasProps {
  venue: Venue;
  tables: PlacedTable[];
  fixtures: PlacedFixture[];
  decor: PlacedDecor[];
  guests: Guest[];
  arrangements?: DecorArrangement[];
  ceremonyRows?: CeremonyChairRow[];
  selectedId: string | null;
  zoom: number;
  showGrid: boolean;
  gridSize: number;
  gridContrast?: number;
  onSelect: (id: string | null) => void;
  onDoubleClick: (id: string) => void;
  onMove: (id: string, position: Position, isExterior?: boolean) => void;
  onDrop: (position: Position, isExterior?: boolean) => void;
  onClickToPlace: (position: Position, isExterior?: boolean) => void;
  isDragging: boolean;
  isDraggingExterior?: boolean;
  isAdmin: boolean;
  onViewImage: (url: string, title: string) => void;
  panOffset: { x: number; y: number };
  onPanChange: (offset: { x: number; y: number }) => void;
  onZoomChange: (zoom: number) => void;
  containerRef?: React.RefObject<HTMLDivElement>;
  onMoveVenueFeature?: (featureType: 'indoor' | 'outdoor', featureId: string, position: Position) => void;
}

export function FloorPlanCanvas({
  venue,
  tables,
  fixtures,
  decor = [],
  guests,
  arrangements: propArrangements,
  ceremonyRows = [],
  selectedId,
  zoom,
  showGrid,
  gridSize,
  gridContrast = 0.45,
  onSelect,
  onDoubleClick,
  onMove,
  onDrop,
  onClickToPlace,
  isDragging,
  isDraggingExterior = false,
  onViewImage,
  panOffset,
  onPanChange,
  onZoomChange,
  containerRef: externalContainerRef,
}: FloorPlanCanvasProps) {
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = externalContainerRef || internalContainerRef;
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragState, setDragState] = useState<{ id: string; startX: number; startY: number; itemX: number; itemY: number; isExterior: boolean } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  
  const tableSpecs = getTableSpecs();
  const fixtureTypes = getFixtureTypes();
  const linenColors = getLinenColors();
  const arrangements = propArrangements || getDecorArrangements();
  const config = getConfig();

  const scale = 8; // pixels per foot
  
  const padding = venue.exteriorPadding || { top: 40, right: 30, bottom: 30, left: 40 };
  const canvasWidth = venue.canvasWidth 
    ? venue.canvasWidth * scale 
    : (venue.width + padding.left + padding.right) * scale;
  const canvasHeight = venue.canvasHeight 
    ? venue.canvasHeight * scale 
    : (venue.height + padding.top + padding.bottom) * scale;
  
  const venueX = venue.venueX !== undefined 
    ? venue.venueX * scale 
    : padding.left * scale;
  const venueY = venue.venueY !== undefined 
    ? venue.venueY * scale 
    : padding.top * scale;
  const venueWidth = venue.width * scale;
  const venueHeight = venue.height * scale;

  const customVenueShape = useMemo(() => {
    if (venue.shape !== 'custom' || !venue.shapePoints || venue.shapePoints.length < 3) {
      return null;
    }

    const abs = venue.shapePoints.map((p) => ({
      x: venueX + p.x * scale,
      y: venueY + p.y * scale,
    }));

    const minX = Math.min(...abs.map((p) => p.x));
    const minY = Math.min(...abs.map((p) => p.y));
    const maxX = Math.max(...abs.map((p) => p.x));
    const maxY = Math.max(...abs.map((p) => p.y));
    const path = `M ${abs.map((p, i) => `${i === 0 ? '' : 'L '}${p.x} ${p.y}`).join(' ')} Z`;

    return {
      path,
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
    };
  }, [venue, venueX, venueY, scale]);

  const customVenueBounds = customVenueShape || {
    minX: venueX,
    minY: venueY,
    maxX: venueX + venueWidth,
    maxY: venueY + venueHeight,
    width: venueWidth,
    height: venueHeight,
    centerX: venueX + venueWidth / 2,
    centerY: venueY + venueHeight / 2,
  };
  void customVenueBounds;

  const getLinenColorInfo = useCallback((colorId?: string) => {
    const defaultColor = { id: 'white', name: 'White', hex: '#FFFFFF', textColor: '#374151' };
    if (!colorId) return defaultColor;
    const found = linenColors.find(c => c.id === colorId);
    return found || defaultColor;
  }, [linenColors]);

  const chairSpecs = getChairSpecs();
  const decorCatalog = getDecorItems();
  const [localArrangements, setLocalArrangements] = useState<any[]>(() => {
	try {
	  const raw = localStorage.getItem('spm_decor_arrangements');
      return raw ? JSON.parse(raw) : [];
	} catch {
      return [];
	}
  });

  const decorArrangements = propArrangements || localArrangements;

  // Update when storage changes
  useEffect(() => {
	const handleChange = () => {
	  try {
        const raw = localStorage.getItem('spm_decor_arrangements');
        setLocalArrangements(raw ? JSON.parse(raw) : []);
	  } catch {
		setLocalArrangements([]);
      }
    };
    return on('spm_data_changed', handleChange);
  }, []);
  void getSpacingSettings();

  // Render applied arrangement helper
  const renderAppliedArrangement = (arrangementId: string, centerX: number, centerY: number) => {
    const arrangement = decorArrangements.find(a => a.id === arrangementId);
    if (!arrangement) return null;

    // 12 pixels per inch in designer, 8 pixels per foot in layout
    // ratio = (8/12) / 12 = 0.666 / 12 ... wait.
    // In designer: 1 inch = 12 pixels.
    // In layout: 1 foot = 8 pixels => 1 inch = 8/12 = 0.666 pixels.
    // So relative coords in inches need to be multiplied by (8/12).
    const designScale = 8 / 12; 

    return [...arrangement.items].sort((a: any, b: any) => a.zIndex - b.zIndex).map((item: any, idx: number) => {
      const spec = decorCatalog.find(s => s.id === item.decorItemId);
      if (!spec) return null;

      const w = (spec.width * 12 + (spec.widthInches || 0)) * item.scaleX * designScale;
      const h = (spec.height * 12 + (spec.heightInches || 0)) * item.scaleY * designScale;
      
      const ix = centerX + item.x * designScale - w / 2;
      const iy = centerY + item.y * designScale - h / 2;

      return (
        <g key={`${arrangementId}-${idx}`} transform={`rotate(${item.rotation}, ${ix + w/2}, ${iy + h/2})`}>
          {spec.imageUrl || (spec.images && spec.images.length > 0) ? (
            <image href={spec.imageUrl || spec.images?.[0]?.url} x={ix} y={iy} width={w} height={h} />
          ) : (
            <rect x={ix} y={iy} width={w} height={h} fill={spec.color || '#ddd'} stroke="#4A1942" strokeWidth="0.5" rx="1" />
          )}
        </g>
      );
    });
  };

  // Render decor item helper
  const renderDecor = (d: PlacedDecor) => {
    const spec = decorCatalog.find(item => item.id === d.decorItemId);
    if (!spec) return null;

    const x = d.parentType === 'canvas' ? d.x * scale : venueX + d.x * scale;
    const y = d.parentType === 'canvas' ? d.y * scale : venueY + d.y * scale;
    const w = (spec.width * 12 + (spec.widthInches || 0)) / 12 * scale * d.scaleX;
    const h = (spec.height * 12 + (spec.heightInches || 0)) / 12 * scale * d.scaleY;
    const isSelected = selectedId === d.id;

    // Use image if available, fallback to icon/color
    return (
      <g
        key={d.id}
        className="cursor-move"
        transform={`rotate(${d.rotation}, ${x + w / 2}, ${y + h / 2})`}
        onMouseDown={(e) => handleItemMouseDown(e, d.id, d.x, d.y, d.parentType === 'canvas')}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(d.id);
        }}
        opacity={d.opacity}
      >
        {spec.imageUrl || (spec.images && spec.images.length > 0) ? (
          <image
            href={spec.imageUrl || spec.images?.[0]?.url}
            x={x}
            y={y}
            width={w}
            height={h}
            preserveAspectRatio="xMidYMid meet"
          />
        ) : (
          <g>
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill={spec.color || '#E5E7EB'}
              stroke="#4A1942"
              strokeWidth={1}
              rx={2}
            />
            {spec.icon && (
              <text
                x={x + w / 2}
                y={y + h / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.min(w, h) * 0.6}
              >
                {spec.icon}
              </text>
            )}
          </g>
        )}
        
        {isSelected && (
          <rect
            x={x - 2}
            y={y - 2}
            width={w + 4}
            height={h + 4}
            fill="none"
            stroke={config.primaryColor}
            strokeWidth={2}
            strokeDasharray="4,2"
            rx={3}
          />
        )}
      </g>
    );
  };

  // Calculate chair positions
  const calculateChairPositions = useCallback((
    tableX: number, 
    tableY: number, 
    tableWidth: number, 
    tableHeight: number, 
    chairCount: number, 
    tableShape: string,
    chairType: string,
    chairLayout?: RectangularChairLayout
  ): { x: number; y: number; rotation: number }[] => {
    const positions: { x: number; y: number; rotation: number }[] = [];
    const chairSpec = chairSpecs.find(c => c.id === chairType) || chairSpecs[0];
    if (!chairSpec || chairType === 'none') return positions;

    const chairSize = chairSpec.width * scale;
    const paddingVal = 2;

    if (tableShape === 'circle' || tableShape === 'oval') {
      const radiusX = (tableWidth / 2) + chairSize / 2 + paddingVal;
      const radiusY = (tableHeight / 2) + chairSize / 2 + paddingVal;
      for (let i = 0; i < chairCount; i++) {
        const angle = (i / chairCount) * Math.PI * 2 - Math.PI / 2;
        const angleInDegrees = angle * 180 / Math.PI;
        const rotation = angleInDegrees + 90;
        positions.push({
          x: tableX + tableWidth / 2 + Math.cos(angle) * radiusX - chairSize / 2,
          y: tableY + tableHeight / 2 + Math.sin(angle) * radiusY - chairSize / 2,
          rotation: rotation
        });
      }
    } else if (tableShape === 'rectangle') {
      const isHorizontal = tableWidth >= tableHeight;
      const layout = chairLayout || 'all-sides';
      
      if (layout === 'head-table') {
        const longSide = Math.max(tableWidth, tableHeight);
        for (let i = 0; i < chairCount; i++) {
          const offset = (i + 0.5) / chairCount * longSide;
          if (isHorizontal) {
            positions.push({ 
              x: tableX + offset - chairSize / 2, 
              y: tableY + tableHeight + paddingVal, 
              rotation: 0
            });
          } else {
            positions.push({ 
              x: tableX + tableWidth + paddingVal, 
              y: tableY + offset - chairSize / 2, 
              rotation: -90
            });
          }
        }
      } else if (layout === 'long-sides-only') {
        const longSide = Math.max(tableWidth, tableHeight);
        const chairsPerSide = Math.ceil(chairCount / 2);
        
        for (let i = 0; i < chairsPerSide; i++) {
          const offset = (i + 0.5) / chairsPerSide * longSide;
          if (isHorizontal) {
            if (positions.length < chairCount) {
              positions.push({ 
                x: tableX + offset - chairSize / 2, 
                y: tableY - chairSize - paddingVal, 
                rotation: 0
              });
            }
            if (positions.length < chairCount) {
              positions.push({ 
                x: tableX + offset - chairSize / 2, 
                y: tableY + tableHeight + paddingVal, 
                rotation: 180
              });
            }
          } else {
            if (positions.length < chairCount) {
              positions.push({ 
                x: tableX - chairSize - paddingVal, 
                y: tableY + offset - chairSize / 2, 
                rotation: -90
              });
            }
            if (positions.length < chairCount) {
              positions.push({ 
                x: tableX + tableWidth + paddingVal, 
                y: tableY + offset - chairSize / 2, 
                rotation: 90
              });
            }
          }
        }
      } else {
        // all-sides
        const longSide = Math.max(tableWidth, tableHeight);
        const shortSide = Math.min(tableWidth, tableHeight);
        const longSideCapacity = Math.floor(longSide / (chairSize + 2));
        const shortSideCapacity = Math.floor(shortSide / (chairSize + 2));
        const totalCapacity = (longSideCapacity * 2) + (shortSideCapacity * 2);
        
        let remaining = chairCount;
        const chairsPerLongSide = Math.min(
          Math.ceil(remaining * (longSideCapacity / totalCapacity)),
          longSideCapacity
        );
        remaining -= chairsPerLongSide * 2;
        const chairsPerShortSide = Math.min(
          Math.ceil(remaining / 2),
          shortSideCapacity
        );
        
        for (let i = 0; i < chairsPerLongSide; i++) {
          const offset = (i + 0.5) / chairsPerLongSide * longSide;
          if (isHorizontal) {
            positions.push({ x: tableX + offset - chairSize / 2, y: tableY - chairSize - paddingVal, rotation: 0 });
            positions.push({ x: tableX + offset - chairSize / 2, y: tableY + tableHeight + paddingVal, rotation: 180 });
          } else {
            positions.push({ x: tableX - chairSize - paddingVal, y: tableY + offset - chairSize / 2, rotation: -90 });
            positions.push({ x: tableX + tableWidth + paddingVal, y: tableY + offset - chairSize / 2, rotation: 90 });
          }
        }
        
        for (let i = 0; i < chairsPerShortSide; i++) {
          const offset = (i + 0.5) / Math.max(1, chairsPerShortSide) * shortSide;
          if (isHorizontal) {
            if (positions.length < chairCount) {
              positions.push({ x: tableX - chairSize - paddingVal, y: tableY + offset - chairSize / 2, rotation: -90 });
            }
            if (positions.length < chairCount) {
              positions.push({ x: tableX + tableWidth + paddingVal, y: tableY + offset - chairSize / 2, rotation: 90 });
            }
          } else {
            if (positions.length < chairCount) {
              positions.push({ x: tableX + offset - chairSize / 2, y: tableY - chairSize - paddingVal, rotation: 0 });
            }
            if (positions.length < chairCount) {
              positions.push({ x: tableX + offset - chairSize / 2, y: tableY + tableHeight + paddingVal, rotation: 180 });
            }
          }
        }
      }
    } else if (tableShape === 'semicircle') {
      const straightSideWidth = tableWidth;
      for (let i = 0; i < chairCount; i++) {
        const offset = (i + 0.5) / chairCount * straightSideWidth;
        positions.push({
          x: tableX + offset - chairSize / 2,
          y: tableY + tableHeight + paddingVal,
          rotation: 180
        });
      }
    } else {
      const radius = (Math.max(tableWidth, tableHeight) / 2) + chairSize / 2 + paddingVal;
      for (let i = 0; i < chairCount; i++) {
        const angle = (i / chairCount) * Math.PI * 2 - Math.PI / 2;
        const angleInDegrees = angle * 180 / Math.PI;
        const rotation = angleInDegrees + 90;
        positions.push({
          x: tableX + tableWidth / 2 + Math.cos(angle) * radius - chairSize / 2,
          y: tableY + tableHeight / 2 + Math.sin(angle) * radius - chairSize / 2,
          rotation: rotation
        });
      }
    }

    return positions.slice(0, chairCount);
  }, [chairSpecs, scale]);

  // Render ceremony chair row
  const renderCeremonyChairRow = useCallback((row: CeremonyChairRow, index: number) => {
    const chairSpec = chairSpecs.find(c => c.id === row.chairType) || chairSpecs[0];
    if (!chairSpec || row.chairType === 'none') return null;
    
    const chairSize = chairSpec.width * scale;
    const rowX = venueX + row.x * scale;
    const rowY = venueY + row.y * scale;
    const spacing = row.spacing * scale;
    
    const chairs: React.ReactElement[] = [];
    
    for (let i = 0; i < row.chairCount; i++) {
      let chairX: number;
      let chairY: number;
      let chairRotation: number;
      
      if (row.rowStyle === 'straight') {
        const totalWidth = (row.chairCount - 1) * spacing;
        chairX = rowX - totalWidth / 2 + i * spacing - chairSize / 2;
        chairY = rowY - chairSize / 2;
        chairRotation = row.facingDirection;
      } else if (row.rowStyle === 'curved' || row.rowStyle === 'semicircle') {
        const curveRadius = row.curveRadius || 20 * scale;
        const angleSpan = Math.PI * 0.6;
        const startAngle = Math.PI / 2 - angleSpan / 2;
        const angle = startAngle + (i / (row.chairCount - 1 || 1)) * angleSpan;
        chairX = rowX + Math.cos(angle) * curveRadius - chairSize / 2;
        chairY = rowY + Math.sin(angle) * curveRadius - chairSize / 2;
        chairRotation = angle * 180 / Math.PI - 90 + row.facingDirection;
      } else if (row.rowStyle === 'diagonal-left' || row.rowStyle === 'diagonal-right') {
        const diagonalAngle = (row.rowStyle === 'diagonal-left' ? -15 : 15) * Math.PI / 180;
        chairX = rowX + i * spacing * Math.cos(diagonalAngle) - chairSize / 2;
        chairY = rowY + i * spacing * Math.sin(diagonalAngle) - chairSize / 2;
        chairRotation = row.facingDirection;
      } else if (row.rowStyle === 'stadium') {
        const rowDepth = 2 * scale;
        const curve = Math.abs(i - (row.chairCount - 1) / 2) / ((row.chairCount - 1) / 2);
        chairX = rowX + i * spacing - chairSize / 2;
        chairY = rowY + curve * rowDepth - chairSize / 2;
        chairRotation = row.facingDirection;
      } else {
        const totalWidth = (row.chairCount - 1) * spacing;
        chairX = rowX - totalWidth / 2 + i * spacing - chairSize / 2;
        chairY = rowY - chairSize / 2;
        chairRotation = row.facingDirection;
      }
      
      chairs.push(
        <g key={`ceremony-chair-${index}-${i}`} transform={`rotate(${chairRotation}, ${chairX + chairSize/2}, ${chairY + chairSize/2})`}>
          <rect
            x={chairX}
            y={chairY}
            width={chairSize}
            height={chairSize}
            fill={chairSpec.color || '#F5F5DC'}
            stroke="#8B7355"
            strokeWidth={1}
            rx={2}
          />
          <rect
            x={chairX + 1}
            y={chairY + 1}
            width={chairSize - 2}
            height={chairSize * 0.3}
            fill={chairSpec.color || '#F5F5DC'}
            stroke="#8B7355"
            strokeWidth={0.5}
            rx={1}
          />
        </g>
      );
    }
    
    return (
      <g key={`ceremony-row-${index}`}>
        {chairs}
        {row.label && (
          <text
            x={rowX}
            y={rowY - chairSize - 5}
            textAnchor="middle"
            fontSize="10"
            fill="#374151"
          >
            {row.label}
          </text>
        )}
      </g>
    );
  }, [chairSpecs, scale, venueX, venueY]);

  // Auto-size font to fit within item
  const getFontSize = (text: string, width: number, height: number): number => {
    const maxWidth = width * 0.9;
    const maxHeight = height * 0.4;
    const charWidth = 7;
    const estimatedWidth = text.length * charWidth;
    const widthBasedSize = Math.min(12, (maxWidth / estimatedWidth) * 12);
    const heightBasedSize = Math.min(12, maxHeight);
    return Math.max(7, Math.min(widthBasedSize, heightBasedSize));
  };

  // Render shape helper
  const renderShape = (
    shape: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fill: string,
    stroke: string,
    strokeWidth: number,
    patternId?: string,
    customPoints?: string
  ) => {
    const fillValue = patternId ? `url(#${patternId})` : fill;
    
    switch (shape) {
      case 'polygon':
        if (customPoints) {
          // customPoints are likely absolute coordinates, but they might need to be shifted by (x,y) 
          // However, CustomVenueBuilder produces points from 0 to canvasWidth.
          // Wait, if it's a table/fixture polygon, it might be relative to 0,0. 
          // Let's assume customPoints are relative to (x,y) if they are just basic shapes, 
          // but for venue it's already absolute. We'll handle shifting in the rendering.
          return (
            <polygon
              points={customPoints}
              fill={fillValue}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          );
        }
        return null;
      case 'circle':
        return (
          <ellipse
            cx={x + width / 2}
            cy={y + height / 2}
            rx={width / 2}
            ry={height / 2}
            fill={fillValue}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );
      case 'oval':
        return (
          <ellipse
            cx={x + width / 2}
            cy={y + height / 2}
            rx={width / 2}
            ry={height / 2}
            fill={fillValue}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );
      case 'triangle':
        return (
          <polygon
            points={`${x + width / 2},${y} ${x + width},${y + height} ${x},${y + height}`}
            fill={fillValue}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );
      case 'semicircle':
        return (
          <path
            d={`M ${x} ${y + height} A ${width / 2} ${height} 0 0 1 ${x + width} ${y + height} L ${x} ${y + height}`}
            fill={fillValue}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );
      case 'hexagon':
        const hxCenter = x + width / 2;
        const hyCenter = y + height / 2;
        const hr = Math.min(width, height) / 2;
        const hexPoints = Array.from({ length: 6 }, (_, i) => {
          const angle = (i * 60 - 30) * Math.PI / 180;
          return `${hxCenter + hr * Math.cos(angle)},${hyCenter + hr * Math.sin(angle)}`;
        }).join(' ');
        return (
          <polygon
            points={hexPoints}
            fill={fillValue}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );
      case 'octagon':
        const oxCenter = x + width / 2;
        const oyCenter = y + height / 2;
        const or = Math.min(width, height) / 2;
        const octPoints = Array.from({ length: 8 }, (_, i) => {
          const angle = (i * 45 - 22.5) * Math.PI / 180;
          return `${oxCenter + or * Math.cos(angle)},${oyCenter + or * Math.sin(angle)}`;
        }).join(' ');
        return (
          <polygon
            points={octPoints}
            fill={fillValue}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );
      default:
        return (
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill={fillValue}
            stroke={stroke}
            strokeWidth={strokeWidth}
            rx={3}
          />
        );
    }
  };

  // Render chair with occupied indicator
  const renderChair = (
    x: number,
    y: number,
    size: number,
    rotation: number,
    chairSpec: typeof chairSpecs[0],
    isOccupied: boolean = false,
    guestName?: string
  ) => {
    const baseColor = chairSpec?.color || '#F5F5DC';
    // Occupied chairs have a different visual treatment
    const color = isOccupied ? baseColor : baseColor;
    const occupiedIndicatorColor = '#4A1942'; // Deep plum for occupied
    
    return (
      <g transform={`rotate(${rotation}, ${x + size/2}, ${y + size/2})`}>
        {/* Chair seat */}
        <rect
          x={x}
          y={y}
          width={size}
          height={size}
          fill={color}
          stroke={isOccupied ? occupiedIndicatorColor : "#8B7355"}
          strokeWidth={isOccupied ? 2 : 1}
          rx={2}
        />
        {/* Chair back */}
        <rect
          x={x + 1}
          y={y}
          width={size - 2}
          height={size * 0.3}
          fill={color}
          stroke={isOccupied ? occupiedIndicatorColor : "#8B7355"}
          strokeWidth={isOccupied ? 1.5 : 0.5}
          rx={1}
        />
        {/* Occupied indicator - person icon or filled circle */}
        {isOccupied && (
          <>
            {/* Filled circle to show occupied */}
            <circle
              cx={x + size / 2}
              cy={y + size / 2 + 2}
              r={size * 0.25}
              fill={occupiedIndicatorColor}
            />
            {/* Small person icon head */}
            <circle
              cx={x + size / 2}
              cy={y + size / 2 - 1}
              r={size * 0.12}
              fill="white"
            />
            {/* Guest name tooltip - rendered as title for hover */}
            {guestName && (
              <title>{guestName}</title>
            )}
          </>
        )}
        {/* Empty seat indicator */}
        {!isOccupied && (
          <circle
            cx={x + size / 2}
            cy={y + size / 2 + 2}
            r={size * 0.15}
            fill="none"
            stroke="#ccc"
            strokeWidth={1}
            strokeDasharray="2,2"
          />
        )}
      </g>
    );
  };

  // Convert screen coordinates to venue coordinates
  const screenToVenue = useCallback((clientX: number, clientY: number, forExterior: boolean = false): Position => {
    if (!svgRef.current || !containerRef.current) return { x: 0, y: 0 };
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = (clientX - rect.left + containerRef.current.scrollLeft - panOffset.x) / zoom;
    const y = (clientY - rect.top + containerRef.current.scrollTop - panOffset.y) / zoom;
    
    if (forExterior) {
      return { x: Math.max(0, x / scale), y: Math.max(0, y / scale) };
    } else {
      return { x: Math.max(0, (x - venueX) / scale), y: Math.max(0, (y - venueY) / scale) };
    }
  }, [zoom, panOffset, scale, venueX, venueY, containerRef]);

  // Handle item mouse down
  const handleItemMouseDown = (e: React.MouseEvent, id: string, itemX: number, itemY: number, isExterior: boolean = false) => {
    e.stopPropagation();
    if (e.button === 1 || e.shiftKey) return;
    
    onSelect(id);
    setDragState({
      id,
      startX: e.clientX,
      startY: e.clientY,
      itemX,
      itemY,
      isExterior
    });
  };

  // Handle item double click
  const handleItemDoubleClick = (e: React.MouseEvent, id: string, imageUrl?: string, title?: string) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      if (imageUrl) {
        onViewImage(imageUrl, title || 'Item Image');
      }
    } else {
      onDoubleClick(id);
    }
  };

  // Handle canvas click for placing items
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (dragState || isPanning) return;
    
    const target = e.target as Element;
    const isItemGroup = target.closest('g.cursor-move');
    
    if (isItemGroup) return;
    
    if (isDragging) {
      const position = screenToVenue(e.clientX, e.clientY, isDraggingExterior);
      onClickToPlace(position, isDraggingExterior);
      return;
    }
    
    onSelect(null);
  };

  // Mouse move effect for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isPanning) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        onPanChange({ x: panStart.offsetX + dx, y: panStart.offsetY + dy });
        return;
      }
      
      if (dragState) {
        const dx = (e.clientX - dragState.startX) / zoom;
        const dy = (e.clientY - dragState.startY) / zoom;
        
        let newX = dragState.itemX + dx / scale;
        let newY = dragState.itemY + dy / scale;
        
        // Clamp to positive positions
        newX = Math.max(0, newX);
        newY = Math.max(0, newY);
        
        onMove(dragState.id, { x: newX, y: newY }, dragState.isExterior);
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
      setIsPanning(false);
    };

    if (dragState || isPanning) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState, isPanning, panStart, zoom, scale, onMove, onPanChange]);

  // Handle wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(0.25, Math.min(2, zoom + delta));
      onZoomChange(newZoom);
    }
  }, [zoom, onZoomChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel, containerRef]);

  // Handle pan start
  const handlePanStart = (e: React.MouseEvent) => {
    if (e.button === 1 || e.shiftKey) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY, offsetX: panOffset.x, offsetY: panOffset.y });
    }
  };

  // Handle drag over and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const data = e.dataTransfer.getData('application/json');
      if (data) {
        const parsed = JSON.parse(data);
        const isExterior = parsed.isExterior || false;
        const position = screenToVenue(e.clientX, e.clientY, isExterior);
        onDrop(position, isExterior);
      }
    } catch (err) {
      console.error('Drop error:', err);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-auto bg-gray-100"
      onMouseDown={handlePanStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleCanvasClick}
      style={{ cursor: isPanning ? 'grabbing' : isDragging ? 'crosshair' : 'default' }}
    >
      <style>{`
        @keyframes spm-pulse-aura {
          0% { stroke-width: 2px; stroke-opacity: 0.8; box-shadow: 0 0 5px rgba(74, 25, 66, 0.5); }
          50% { stroke-width: 8px; stroke-opacity: 0.4; box-shadow: 0 0 15px rgba(74, 25, 66, 0.8); }
          100% { stroke-width: 2px; stroke-opacity: 0.8; box-shadow: 0 0 5px rgba(74, 25, 66, 0.5); }
        }
        @keyframes spm-badge-float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
          100% { transform: translateY(0px); }
        }
        .design-active-aura {
          animation: spm-pulse-aura 2.5s infinite ease-in-out;
          pointer-events: none;
        }
        .design-badge-float {
          animation: spm-badge-float 3s infinite ease-in-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .design-active-aura,
          .design-badge-float {
            animation: none;
          }
        }
      `}</style>
      <svg
        ref={svgRef}
        width={canvasWidth * zoom}
        height={canvasHeight * zoom}
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        className="block"
        style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px)` }}
      >
        <defs>
          {/* Pattern definitions */}
          <pattern id="checkered" patternUnits="userSpaceOnUse" width="20" height="20">
            <rect width="10" height="10" fill="#FFFFFF"/>
            <rect x="10" width="10" height="10" fill="#000000"/>
            <rect y="10" width="10" height="10" fill="#000000"/>
            <rect x="10" y="10" width="10" height="10" fill="#FFFFFF"/>
          </pattern>
          <pattern id="grass" patternUnits="userSpaceOnUse" width="10" height="10">
            <rect width="10" height="10" fill="#90EE90"/>
            <circle cx="3" cy="3" r="1" fill="#228B22" opacity="0.5"/>
            <circle cx="7" cy="7" r="1" fill="#228B22" opacity="0.5"/>
          </pattern>
          <pattern id="wood" patternUnits="userSpaceOnUse" width="20" height="20">
            <rect width="20" height="20" fill="#DEB887"/>
            <line x1="0" y1="5" x2="20" y2="5" stroke="#CD853F" strokeWidth="0.5" opacity="0.3"/>
            <line x1="0" y1="15" x2="20" y2="15" stroke="#CD853F" strokeWidth="0.5" opacity="0.3"/>
          </pattern>
          <pattern id="gravel" patternUnits="userSpaceOnUse" width="10" height="10">
            <rect width="10" height="10" fill="#A9A9A9"/>
            <circle cx="2" cy="2" r="1" fill="#808080"/>
            <circle cx="8" cy="5" r="1.5" fill="#696969"/>
            <circle cx="4" cy="8" r="1" fill="#778899"/>
          </pattern>
          <pattern id="concrete" patternUnits="userSpaceOnUse" width="20" height="20">
            <rect width="20" height="20" fill="#C0C0C0"/>
            <line x1="0" y1="0" x2="20" y2="0" stroke="#A0A0A0" strokeWidth="0.5"/>
            <line x1="0" y1="0" x2="0" y2="20" stroke="#A0A0A0" strokeWidth="0.5"/>
          </pattern>
          <pattern id="tile" patternUnits="userSpaceOnUse" width="15" height="15">
            <rect width="15" height="15" fill="#F5F5DC"/>
            <rect width="14" height="14" fill="#FFFAF0" stroke="#D2B48C" strokeWidth="0.5"/>
          </pattern>
          <pattern id="brick" patternUnits="userSpaceOnUse" width="20" height="10">
            <rect width="20" height="10" fill="#CD5C5C"/>
            <rect width="9" height="4" fill="#B22222" stroke="#8B4513" strokeWidth="0.3"/>
            <rect x="10" width="10" height="4" fill="#B22222" stroke="#8B4513" strokeWidth="0.3"/>
            <rect x="5" y="5" width="9" height="5" fill="#B22222" stroke="#8B4513" strokeWidth="0.3"/>
            <rect x="15" y="5" width="5" height="5" fill="#B22222" stroke="#8B4513" strokeWidth="0.3"/>
            <rect y="5" width="4" height="5" fill="#B22222" stroke="#8B4513" strokeWidth="0.3"/>
          </pattern>
          <pattern id="marble" patternUnits="userSpaceOnUse" width="30" height="30">
            <rect width="30" height="30" fill="#F5F5F5"/>
            <path d="M0 15 Q 10 10, 20 15 T 30 15" stroke="#D3D3D3" strokeWidth="0.5" fill="none" opacity="0.5"/>
            <path d="M5 25 Q 15 20, 25 25" stroke="#E0E0E0" strokeWidth="0.3" fill="none" opacity="0.5"/>
          </pattern>
          <pattern id="carpet" patternUnits="userSpaceOnUse" width="8" height="8">
            <rect width="8" height="8" fill="#8B0000"/>
            <rect width="4" height="4" fill="#A52A2A" opacity="0.3"/>
            <rect x="4" y="4" width="4" height="4" fill="#A52A2A" opacity="0.3"/>
          </pattern>
          <pattern id="decor-sparkle" patternUnits="userSpaceOnUse" width="10" height="10">
            <circle cx="2" cy="2" r="0.5" fill="white" opacity="0.6" />
            <circle cx="7" cy="7" r="0.5" fill="white" opacity="0.6" />
            <circle cx="5" cy="3" r="0.3" fill="white" opacity="0.4" />
          </pattern>
        </defs>

        {/* Canvas background */}
        <rect
          x="0"
          y="0"
          width={canvasWidth}
          height={canvasHeight}
          fill={venue.canvasFillColor || '#e8e4e0'}
          stroke={venue.canvasBorderColor || '#888888'}
          strokeWidth={2}
          className="canvas-bg"
        />

        {/* Grid */}
        {showGrid && (
          <g>
            {Array.from({ length: Math.ceil(canvasWidth / (gridSize * scale)) + 1 }).map((_, i) => (
              <line
                key={`v-${i}`}
                x1={i * gridSize * scale}
                y1={0}
                x2={i * gridSize * scale}
                y2={canvasHeight}
                stroke="#4b5563"
                strokeWidth={0.8}
                opacity={Math.max(0.15, Math.min(1, gridContrast))}
              />
            ))}
            {Array.from({ length: Math.ceil(canvasHeight / (gridSize * scale)) + 1 }).map((_, i) => (
              <line
                key={`h-${i}`}
                x1={0}
                y1={i * gridSize * scale}
                x2={canvasWidth}
                y2={i * gridSize * scale}
                stroke="#4b5563"
                strokeWidth={0.8}
                opacity={Math.max(0.15, Math.min(1, gridContrast))}
              />
            ))}
            {Array.from({ length: Math.ceil(canvasWidth / (gridSize * scale * 5)) + 1 }).map((_, i) => (
              <line
                key={`mv-${i}`}
                x1={i * gridSize * scale * 5}
                y1={0}
                x2={i * gridSize * scale * 5}
                y2={canvasHeight}
                stroke="#1f2937"
                strokeWidth={1}
                opacity={Math.max(0.25, Math.min(1, gridContrast + 0.15))}
              />
            ))}
            {Array.from({ length: Math.ceil(canvasHeight / (gridSize * scale * 5)) + 1 }).map((_, i) => (
              <line
                key={`mh-${i}`}
                x1={0}
                y1={i * gridSize * scale * 5}
                x2={canvasWidth}
                y2={i * gridSize * scale * 5}
                stroke="#1f2937"
                strokeWidth={1}
                opacity={Math.max(0.25, Math.min(1, gridContrast + 0.15))}
              />
            ))}
          </g>
        )}

        {/* Venue boundary */}
        {(() => {
          const fill = venue.pattern ? `url(#${venue.pattern})` : (venue.color || '#FFFFFF');
          const stroke = venue.showBorder !== false ? (venue.borderColor || config.primaryColor) : 'transparent';
          const strokeWidth = venue.showBorder !== false ? (venue.borderWidth || 3) : 0;
          
          if (venue.shape === 'l-shape') {
            const thickX = venueWidth * 0.4;
            const thickY = venueHeight * 0.4;
            return (
              <polygon
                points={`${venueX},${venueY} ${venueX + thickX},${venueY} ${venueX + thickX},${venueY + venueHeight - thickY} ${venueX + venueWidth},${venueY + venueHeight - thickY} ${venueX + venueWidth},${venueY + venueHeight} ${venueX},${venueY + venueHeight}`}
                fill={fill} stroke={stroke} strokeWidth={strokeWidth}
              />
            );
          } else if (venue.shape === 't-shape') {
            const thickX = venueWidth * 0.4;
            const thickY = venueHeight * 0.4;
            const startX = venueX + (venueWidth - thickX) / 2;
            return (
              <polygon
                points={`${venueX},${venueY} ${venueX + venueWidth},${venueY} ${venueX + venueWidth},${venueY + thickY} ${startX + thickX},${venueY + thickY} ${startX + thickX},${venueY + venueHeight} ${startX},${venueY + venueHeight} ${startX},${venueY + thickY} ${venueX},${venueY + thickY}`}
                fill={fill} stroke={stroke} strokeWidth={strokeWidth}
              />
            );
          } else if (venue.shape === 'u-shape') {
            const thickX = venueWidth * 0.3;
            const thickY = venueHeight * 0.4;
            return (
              <polygon
                points={`${venueX},${venueY} ${venueX + thickX},${venueY} ${venueX + thickX},${venueY + venueHeight - thickY} ${venueX + venueWidth - thickX},${venueY + venueHeight - thickY} ${venueX + venueWidth - thickX},${venueY} ${venueX + venueWidth},${venueY} ${venueX + venueWidth},${venueY + venueHeight} ${venueX},${venueY + venueHeight}`}
                fill={fill} stroke={stroke} strokeWidth={strokeWidth}
              />
            );
          } else if (venue.shape === 'custom' && (customVenueShape?.path || venue.customPath)) {
            return (
              <path d={customVenueShape?.path || venue.customPath} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
            );
          }
          
          // Default Rectangle
          return (
            <rect
              x={venueX}
              y={venueY}
              width={venueWidth}
              height={venueHeight}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          );
        })()}

        {/* Lodging Rooms */}
        {venue.rooms && venue.rooms.map(room => {
          const rx = venueX + room.x * scale;
          const ry = venueY + room.y * scale;
          const rw = room.width * scale;
          const rh = room.height * scale;
          return (
            <g key={room.id}>
              <rect
                x={rx}
                y={ry}
                width={rw}
                height={rh}
                fill={room.color || '#E2E8F0'}
                stroke="#94A3B8"
                strokeWidth={2}
                opacity={0.8}
              />
              <text
                x={rx + rw / 2}
                y={ry + rh / 2 - 5}
                textAnchor="middle"
                fontSize={Math.max(10, Math.min(rw, rh) * 0.15)}
                fill="#334155"
                fontWeight="bold"
              >
                {room.name}
              </text>
              <text
                x={rx + rw / 2}
                y={ry + rh / 2 + 10}
                textAnchor="middle"
                fontSize={Math.max(8, Math.min(rw, rh) * 0.1)}
                fill="#475569"
              >
                {room.assignedGuests.length}/{room.capacity} Guests
              </text>
            </g>
          );
        })}

        {/* Venue label */}
        <text
          x={venueX + venueWidth / 2}
          y={venueY - 12}
          textAnchor="middle"
          className="font-bold"
          fontSize="13"
          fill={config.primaryColor}
        >
          {venue.name} ({venue.width}' × {venue.height}')
        </text>

        {/* Ceremony rows */}
        {ceremonyRows.map((row, index) => renderCeremonyChairRow(row, index))}

        {/* Placed Decor */}
        {decor.map(d => renderDecor(d))}

        {/* Fixtures (exterior first, then interior) */}
        {fixtures
          .sort((a, b) => (a.isExterior ? -1 : 1) - (b.isExterior ? -1 : 1))
          .map(fixture => {
            const spec = fixtureTypes.find(s => s.id === fixture.specId);
            if (!spec) return null;

            const x = fixture.isExterior 
              ? fixture.x * scale 
              : venueX + fixture.x * scale;
            const y = fixture.isExterior 
              ? fixture.y * scale 
              : venueY + fixture.y * scale;
            const w = spec.width * scale;
            const h = spec.height * scale;
            const isSelected = selectedId === fixture.id;
            const fontSize = getFontSize(fixture.label, w, h);
            
            let color = spec.color || '#9CA3AF';
            let displayIcon = spec.showIconOnCanvas !== false ? spec.icon : '';
            const fontColor = spec.fontColor || '#374151';
            const showBorder = spec.showBorder === true;
            const borderColor = showBorder ? (spec.borderColor || '#000000') : 'transparent';
            const borderWidth = showBorder ? (spec.borderWidth || 2) : 0;
            
            // Determine pattern ID for this fixture
            let fixturePatternId: string | undefined = undefined;
            if (spec.pattern && spec.pattern !== 'solid') {
              fixturePatternId = spec.pattern;
            }
            
            if (spec.hasVariants && spec.variants && fixture.variant) {
              const selectedVariant = spec.variants.find(v => v.id === fixture.variant);
              if (selectedVariant) {
                color = selectedVariant.color || color;
                displayIcon = selectedVariant.icon || displayIcon;
              }
            }

          // Calculate rotation center point
          const centerX = x + w / 2;
          const centerY = y + h / 2;
          const fixtureRotation = fixture.rotation || 0;

          return (
            <g
              key={fixture.id}
              className="cursor-move"
              transform={`rotate(${fixtureRotation}, ${centerX}, ${centerY})`}
              onMouseDown={(e) => handleItemMouseDown(e, fixture.id, fixture.x, fixture.y, fixture.isExterior)}
              onDoubleClick={(e) => handleItemDoubleClick(e, fixture.id, spec.imageUrl, spec.name)}
            >
              {/* Design Active Status Overlay */}
              {fixture.appliedArrangementId && (
                <>
                  {/* Atmospheric Aura */}
                  <g className="design-active-aura">
                    {renderShape(spec.shape || 'rectangle', x - 4, y - 4, w + 8, h + 8, 'transparent', config.primaryColor, 3, undefined)}
                  </g>
                  
                  {/* Floating Status Badge */}
                  {(() => {
                    const arrangement = arrangements.find(a => a.id === fixture.appliedArrangementId);
                    return (
                      <g transform={`translate(${x + w - 2}, ${y + 2})`} className="design-badge-float">
                        <circle r="13" fill="white" className="shadow-md" />
                        <circle r="11" fill={config.primaryColor} stroke="white" strokeWidth="2" />
                        <text textAnchor="middle" dy="4" fontSize="11" fill="white" style={{ pointerEvents: 'none' }}>🎀</text>
                        {arrangement && <title>Applied Design: {arrangement.name}</title>}
                      </g>
                    );
                  })()}
                </>
              )}

              {renderShape(spec.shape || 'rectangle', x, y, w, h, color, borderColor, borderWidth, fixturePatternId)}
              
              {/* Surface Sparkle Overlay for active design */}
              {fixture.appliedArrangementId && (
                <g style={{ pointerEvents: 'none' }}>
                  {renderShape(spec.shape || 'rectangle', x, y, w, h, 'url(#decor-sparkle)', 'transparent', 0, undefined)}
                </g>
              )}
                
                {displayIcon && (
                  <text
                    x={x + w / 2}
                    y={y + h / 2 - 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={Math.min(w, h) * 0.4}
                  >
                    {displayIcon}
                  </text>
                )}
                
                <text
                  x={x + w / 2}
                  y={y + h / 2 + (displayIcon ? 10 : 4)}
                  textAnchor="middle"
                  fontSize={fontSize}
                  fill={fontColor}
                  fontWeight="500"
                >
                  {fixture.label}
                </text>
                
                {isSelected && (
                  <rect
                    x={x - 3}
                    y={y - 3}
                    width={w + 6}
                    height={h + 6}
                    fill="none"
                    stroke={config.primaryColor}
                    strokeWidth={2}
                    strokeDasharray="4,2"
                    rx={3}
                  />
                )}

                {/* Render applied design */}
                {fixture.appliedArrangementId && renderAppliedArrangement(fixture.appliedArrangementId, centerX, centerY)}
              </g>
            );
          })}

        {/* Tables */}
        {tables.map(table => {
          const spec = tableSpecs.find(s => s.id === table.specId);
          if (!spec) return null;

          const x = venueX + table.x * scale;
          const y = venueY + table.y * scale;
          const isSelected = selectedId === table.id;
          const isSeatingOnly = !!spec.isSeatingType;
          const chairType = table.chairType || spec.defaultChairType || 'white-plastic';
          const chairCount = Math.max(1, table.chairCount ?? table.customCapacity ?? spec.capacity);
          const chairSpec = chairSpecs.find(c => c.id === chairType);

          // Seating types are chair-only rows: dimensions are derived from chair type + chair count.
          const seatingLayout = (() => {
            if (!isSeatingOnly) return null;
            const chairWidthFt = chairSpec?.width || 1.5;
            const chairDepthFt = chairSpec?.depth || chairSpec?.width || 1.5;
            const rowCount = Math.max(1, spec.seatingRowCount || 1);
            const rowSpacingFt = Math.max(0.5, spec.seatingRowSpacing || 3);
            const chairGapFt = Math.max(0.2, chairWidthFt * 0.15);
            const rowWidthFt = (chairCount * chairWidthFt) + Math.max(0, chairCount - 1) * chairGapFt;
            const rowDepthFt = (rowCount * chairDepthFt) + Math.max(0, rowCount - 1) * rowSpacingFt;
            return {
              rowCount,
              rowSpacingFt,
              chairWidthFt,
              chairDepthFt,
              chairGapFt,
              rowWidthFt,
              rowDepthFt,
            };
          })();

          const w = isSeatingOnly && seatingLayout
            ? Math.max(1, seatingLayout.rowWidthFt) * scale
            : spec.width * scale;
          const h = isSeatingOnly && seatingLayout
            ? Math.max(1, seatingLayout.rowDepthFt) * scale
            : spec.height * scale;
          const fontSize = getFontSize(table.label, w, h);
          
          // Handle linen color
          let tableColor = spec.color || '#FFFFFF';
          let textColor = '#374151';
          
          if (table.hasLinen && table.linenColor) {
            const linenInfo = getLinenColorInfo(table.linenColor);
            tableColor = linenInfo.hex;
            textColor = linenInfo.textColor || '#374151';
          }
          
          // Chair rendering
          const showChairs = table.showChairs !== false;
          const chairPositions = showChairs && chairSpec && chairType !== 'none'
            ? (isSeatingOnly
                ? (() => {
                    const chairWidthPx = chairSpec.width * scale;
                    const chairDepthPx = (chairSpec.depth || chairSpec.width) * scale;
                    const count = chairCount;
                    const style = spec.seatingStyle || 'straight-row';
                    const rowCount = seatingLayout?.rowCount || 1;
                    const rowSpacingPx = Math.max(1, (seatingLayout?.rowSpacingFt || 3) * scale);
                    const chairGapPx = Math.max(1, (seatingLayout?.chairGapFt || 0.2) * scale);
                    const rowPitchPx = chairDepthPx + rowSpacingPx;
                    const positions: { x: number; y: number; rotation: number }[] = [];

                    const rowStartX = x;
                    const rowCenterX = x + w / 2;
                    const rowStartY = y;

                    for (let row = 0; row < rowCount; row++) {
                      const rowY = rowStartY + row * rowPitchPx;

                      if (style === 'curved-row' || style === 'semicircle-row') {
                        const span = style === 'semicircle-row' ? Math.PI : Math.PI * 0.75;
                        const start = Math.PI / 2 - span / 2;
                        const radius = Math.max(w / 2, 24) + row * (rowSpacingPx * 0.6);
                        const centerY = rowY + chairDepthPx;
                        for (let i = 0; i < count; i++) {
                          const t = count === 1 ? 0.5 : i / (count - 1);
                          const a = start + t * span;
                          positions.push({
                            x: rowCenterX + Math.cos(a) * radius - chairWidthPx / 2,
                            y: centerY + Math.sin(a) * radius - chairDepthPx / 2,
                            rotation: (a * 180) / Math.PI + 90,
                          });
                        }
                        continue;
                      }

                      const totalWidth = (count * chairWidthPx) + Math.max(0, count - 1) * chairGapPx;
                      const offsetX = rowStartX + Math.max(0, (w - totalWidth) / 2);
                      for (let i = 0; i < count; i++) {
                        const curveOffset = style === 'stadium' ? Math.abs(i - (count - 1) / 2) * 1.2 : 0;
                        positions.push({
                          x: offsetX + i * (chairWidthPx + chairGapPx),
                          y: rowY + curveOffset,
                          rotation: 180,
                        });
                      }
                    }
                    return positions;
                  })()
                : calculateChairPositions(x, y, w, h, chairCount, spec.shape, chairType, table.chairLayout))
            : [];

          // Get assigned guests
          const assignedGuests = guests.filter(g => g.tableId === table.id);
          const seatingRows = isSeatingOnly ? (seatingLayout?.rowCount || 1) : 1;
          const totalSeatCapacity = isSeatingOnly ? chairCount * seatingRows : chairCount;
          const seatDisplay = assignedGuests.length > 0 
            ? `${assignedGuests.length}/${totalSeatCapacity}` 
            : `🪑 ${totalSeatCapacity}`;

                // Calculate rotation center point for the table (and its chairs)
                const tableCenterX = x + w / 2;
                const tableCenterY = y + h / 2;
                const tableRotation = table.rotation || 0;

                return (
                  <g
                    key={table.id}
                    className="cursor-move"
                    transform={`rotate(${tableRotation}, ${tableCenterX}, ${tableCenterY})`}
                    onMouseDown={(e) => handleItemMouseDown(e, table.id, table.x, table.y)}
                    onDoubleClick={(e) => handleItemDoubleClick(e, table.id, spec.imageUrl, spec.name)}
                  >
                    {/* Design Active Status Overlay */}
                    {table.appliedArrangementId && (
                      <>
                        {/* Atmospheric Aura (Chair-Aware) */}
                        <g className="design-active-aura">
                          {(() => {
                            const chairW = (chairSpec?.width || 1.5) * scale;
                            return renderShape(
                              spec.shape, 
                              x - chairW - 4, 
                              y - chairW - 4, 
                              w + (chairW * 2) + 8, 
                              h + (chairW * 2) + 8, 
                              'transparent', 
                              config.primaryColor, 
                              3
                            );
                          })()}
                        </g>
                        
                        {/* Floating Status Badge (Outer-Positioned) */}
                        {(() => {
                          const arrangement = arrangements.find(a => a.id === table.appliedArrangementId);
                          const chairW = (chairSpec?.width || 1.5) * scale;
                          return (
                            <g 
                              transform={`translate(${x + w + chairW - 4}, ${y - chairW + 4})`} 
                              className="design-badge-float"
                            >
                              <circle r="13" fill="white" className="shadow-md" />
                              <circle r="11" fill={config.primaryColor} stroke="white" strokeWidth="2" />
                              <text textAnchor="middle" dy="4" fontSize="11" fill="white" style={{ pointerEvents: 'none' }}>🎀</text>
                              {arrangement && <title>Applied Design: {arrangement.name}</title>}
                            </g>
                          );
                        })()}
                      </>
                    )}
              {/* Chairs - show occupied status */}
              {chairPositions.map((pos, idx) => {
                // Check if this seat is occupied by a guest
                const guestAtSeat = assignedGuests[idx];
                const isOccupied = idx < assignedGuests.length;
                const guestName = guestAtSeat?.name;
                
                return (
                  <React.Fragment key={`chair-${table.id}-${idx}`}>
                    {chairSpec && renderChair(
                      pos.x, 
                      pos.y, 
                      chairSpec.width * scale, 
                      pos.rotation, 
                      chairSpec,
                      isOccupied,
                      guestName
                    )}
                  </React.Fragment>
                );
              })}
              
              {/* Table surface (hidden for seating-only types) */}
              {!isSeatingOnly && renderShape(spec.shape, x, y, w, h, tableColor, '#4A1942', 2)}
              
              {/* Surface Sparkle Overlay for active design */}
              {table.appliedArrangementId && !isSeatingOnly && (
                <g style={{ pointerEvents: 'none' }}>
                  {renderShape(spec.shape, x, y, w, h, 'url(#decor-sparkle)', 'transparent', 0)}
                </g>
              )}
              
              {/* Table label */}
              <text
                x={x + w / 2}
                y={isSeatingOnly ? y - 6 : y + h / 2 - 4}
                textAnchor="middle"
                fontSize={fontSize}
                fill={textColor}
                fontWeight="600"
              >
                {table.label}
              </text>

              {isSeatingOnly && (
                <text
                  x={x + w / 2}
                  y={y - 18}
                  textAnchor="middle"
                  fontSize={Math.max(9, fontSize - 1)}
                  fill="#7c3aed"
                  fontWeight="700"
                >
                  💺 Seating
                </text>
              )}
              
              {/* Seat count */}
              <text
                x={x + w / 2}
                y={y + h / 2 + 8}
                textAnchor="middle"
                fontSize={Math.max(7, fontSize - 2)}
                fill={table.appliedArrangementId ? config.primaryColor : textColor}
                fontWeight={table.appliedArrangementId ? "bold" : "normal"}
                opacity={table.appliedArrangementId ? 1 : 0.8}
              >
                {seatDisplay}
              </text>
              
              {/* Selection indicator */}
              {isSelected && (
                <rect
                  x={x - 3}
                  y={y - 3}
                  width={w + 6}
                  height={h + 6}
                  fill="none"
                  stroke={config.primaryColor}
                  strokeWidth={2}
                  strokeDasharray="4,2"
                  rx={spec.shape === 'circle' ? (w + 6) / 2 : 3}
                />
              )}

              {/* Render applied design */}
              {table.appliedArrangementId && renderAppliedArrangement(table.appliedArrangementId, tableCenterX, tableCenterY)}
            </g>
          );
        })}

        {/* Capacity indicator */}
        <g transform={`translate(${canvasWidth - 160}, ${canvasHeight - 30})`}>
          <rect x="0" y="0" width="155" height="25" fill="white" stroke="#ccc" strokeWidth={1} rx={4} opacity={0.95} />
          <text x="10" y="17" fontSize="11" fill="#374151">
            👥 {guests.filter(g => g.tableId).length} / {tables.reduce((sum, t) => {
              const spec = tableSpecs.find(s => s.id === t.specId);
              const isSeating = !!spec?.isSeatingType;
              const perRow = t.chairCount ?? t.customCapacity ?? spec?.capacity ?? 0;
              const rows = isSeating ? Math.max(1, spec?.seatingRowCount || 1) : 1;
              return sum + (isSeating ? perRow * rows : (t.customCapacity || spec?.capacity || 0));
            }, 0)} seated • Max: {venue.capacity}
          </text>
        </g>
      </svg>

      {/* Status bar when dragging */}
      {isDragging && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-10 text-sm font-medium">
          {isDraggingExterior ? '🌳' : '🪑'} Click on the canvas to place the item
        </div>
      )}
    </div>
  );
}
