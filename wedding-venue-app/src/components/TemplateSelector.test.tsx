import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TemplateSelector } from './TemplateSelector';

vi.mock('../hooks/useLayoutState', () => ({
  getVenues: () => [{ id: 'v1', name: 'Reception Hall' }],
}));

describe('TemplateSelector', () => {
  it('renders a dialog with an accessible title', () => {
    render(
      <TemplateSelector
        templates={[] as any}
        layoutCategories={[] as any}
        onSelect={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(
      screen.getByRole('dialog', { name: /layout templates/i }),
    ).toBeInTheDocument();
  });

  it('allows keyboard activation of template cards', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <TemplateSelector
        templates={[
          {
            id: 'tpl-1',
            name: 'Classic Reception',
            description: 'Traditional layout',
            category: 'reception',
            venueId: 'v1',
            tables: [],
            fixtures: [],
            createdAt: new Date().toISOString(),
          } as any,
        ]}
        layoutCategories={[
          { id: 'reception', name: 'Reception', icon: '🎉' } as any,
        ]}
        onSelect={onSelect}
        onClose={() => undefined}
      />,
    );

    const card = screen.getByRole('listitem', {
      name: /use template classic reception/i,
    });

    card.focus();
    await user.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('filters templates by selected category', async () => {
    const user = userEvent.setup();

    render(
      <TemplateSelector
        templates={[
          {
            id: 'tpl-1',
            name: 'Reception Layout',
            description: 'Reception template',
            category: 'reception',
            venueId: 'v1',
            tables: [],
            fixtures: [],
            createdAt: new Date().toISOString(),
          } as any,
          {
            id: 'tpl-2',
            name: 'Ceremony Layout',
            description: 'Ceremony template',
            category: 'ceremony',
            venueId: 'v1',
            tables: [],
            fixtures: [],
            createdAt: new Date().toISOString(),
          } as any,
        ]}
        layoutCategories={[
          { id: 'reception', name: 'Reception', icon: '🎉' } as any,
          { id: 'ceremony', name: 'Ceremony', icon: '💒' } as any,
        ]}
        onSelect={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText('Reception Layout')).toBeInTheDocument();
    expect(screen.getByText('Ceremony Layout')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /ceremony/i }));

    expect(screen.queryByText('Reception Layout')).not.toBeInTheDocument();
    expect(screen.getByText('Ceremony Layout')).toBeInTheDocument();
  });
});