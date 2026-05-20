import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';

describe('Sidebar performance behavior', () => {
  it('does not register a polling interval on mount', () => {
    const intervalSpy = vi.spyOn(window, 'setInterval');

    render(
      <Sidebar
        width={280}
        collapsed={false}
        onWidthChange={() => undefined}
        onCollapsedChange={() => undefined}
        zoom={1}
        onZoomChange={() => undefined}
        showGrid={false}
        onShowGridChange={() => undefined}
        gridSize={1}
        onGridSizeChange={() => undefined}
        onDragStart={() => undefined}
        onDragEnd={() => undefined}
        currentDragItem={null}
        onClearLayout={() => undefined}
        isAdmin={true}
        currentUser={{
          id: 'u1',
          role: 'admin',
          name: 'Admin User',
          isActive: true,
        } as any}
        onViewImage={() => undefined}
        layoutCategories={[] as any}
        currentVenueCategory="reception"
        venueWidth={60}
        venueHeight={40}
        canvasWidth={100}
        canvasHeight={80}
        onResetView={() => undefined}
        onResetToVenue={() => undefined}
        onResetToCanvas={() => undefined}
        placedTables={[]}
        placedFixtures={[]}
      />,
    );

    expect(intervalSpy).not.toHaveBeenCalled();
  });
});