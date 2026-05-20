import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Header } from './Header';

vi.mock('../config', () => ({
  getConfig: () => ({
    venueName: 'Seven Paths Manor',
    websiteUrl: '',
    supportEmail: '',
    logoUrl: '',
    primaryColor: '#4A1942',
    primaryDark: '#3d1a45',
    headerTextColor: '#FFFFFF',
  }),
}));

const venues = [
  {
    id: 'v1',
    name: 'Reception Hall',
    category: 'reception',
    width: 50,
    height: 30,
    capacity: 150,
    isMaster: true,
  },
  {
    id: 'v2',
    name: 'Lodge',
    category: 'lodging',
    width: 30,
    height: 20,
    capacity: 40,
    isMaster: true,
  },
] as any;

function renderHeader(overrides: Partial<React.ComponentProps<typeof Header>> = {}) {
  const props: React.ComponentProps<typeof Header> = {
    currentVenue: venues[0],
    venues,
    selectedVenueCategories: [],
    onChangeVenue: vi.fn(),
    onChangeVenueCategories: vi.fn(),
    onSaveLayout: vi.fn(),
    onSaveMasterLayout: vi.fn(),
    onClearMasterLayout: vi.fn(),
    onPrint: vi.fn(),
    onShowTemplates: vi.fn(),
    onShowGuests: vi.fn(),
    onShowAdmin: vi.fn(),
    onOpenOperations: vi.fn(),
    onLogout: vi.fn(),
    userName: 'Jane',
    isAdmin: false,
    isStaff: false,
    savedLayouts: [
      {
        id: 'layout-1',
        name: 'My Layout',
        tables: [],
        fixtures: [],
        decor: [],
        guests: [],
        createdAt: new Date().toISOString(),
      } as any,
    ],
    onLoadSavedLayout: vi.fn(),
    onDeleteSavedLayout: vi.fn(),
    mobileMenuOpen: false,
    setMobileMenuOpen: vi.fn(),
    currentUser: {
      id: 'u1',
      role: 'basic',
      name: 'Jane',
      isActive: true,
    } as any,
    ...overrides,
  };

  return {
    ...render(<Header {...props} />),
    props,
  };
}

describe('Header', () => {
  it('shows admin button only for admin users', () => {
    const { rerender } = render(
      <Header
        currentVenue={venues[0]}
        venues={venues}
        selectedVenueCategories={[]}
        onChangeVenue={vi.fn()}
        onChangeVenueCategories={vi.fn()}
        onSaveLayout={vi.fn()}
        onSaveMasterLayout={vi.fn()}
        onClearMasterLayout={vi.fn()}
        onPrint={vi.fn()}
        onShowTemplates={vi.fn()}
        onShowGuests={vi.fn()}
        onShowAdmin={vi.fn()}
        onOpenOperations={vi.fn()}
        onLogout={vi.fn()}
        userName="Jane"
        isAdmin={false}
        isStaff={false}
        savedLayouts={[] as any}
        onLoadSavedLayout={vi.fn()}
        onDeleteSavedLayout={vi.fn()}
        mobileMenuOpen={false}
        setMobileMenuOpen={vi.fn()}
        currentUser={{ id: 'u1', role: 'basic', name: 'Jane', isActive: true } as any}
      />,
    );

    expect(screen.queryByRole('button', { name: /admin panel/i })).not.toBeInTheDocument();

    rerender(
      <Header
        currentVenue={venues[0]}
        venues={venues}
        selectedVenueCategories={[]}
        onChangeVenue={vi.fn()}
        onChangeVenueCategories={vi.fn()}
        onSaveLayout={vi.fn()}
        onSaveMasterLayout={vi.fn()}
        onClearMasterLayout={vi.fn()}
        onPrint={vi.fn()}
        onShowTemplates={vi.fn()}
        onShowGuests={vi.fn()}
        onShowAdmin={vi.fn()}
        onOpenOperations={vi.fn()}
        onLogout={vi.fn()}
        userName="Admin"
        isAdmin={true}
        isStaff={false}
        savedLayouts={[] as any}
        onLoadSavedLayout={vi.fn()}
        onDeleteSavedLayout={vi.fn()}
        mobileMenuOpen={false}
        setMobileMenuOpen={vi.fn()}
        currentUser={{ id: 'u2', role: 'admin', name: 'Admin', isActive: true } as any}
      />,
    );

    expect(screen.getByRole('button', { name: /admin panel/i })).toBeInTheDocument();
  });

  it('opens save layout dialog and saves layout name', async () => {
    const user = userEvent.setup();
    const { props } = renderHeader();

    await user.click(screen.getByRole('button', { name: /menu/i }));
    await user.click(screen.getByRole('button', { name: /save layout/i }));

    const dialog = screen.getByRole('dialog', { name: /save layout/i });
    expect(dialog).toBeInTheDocument();

    const input = within(dialog).getByPlaceholderText(
      /enter layout name/i,
    ) as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'Wedding Plan' } });
    expect(input.value).toBe('Wedding Plan');

    const buttons = within(dialog).getAllByRole('button');
    const saveButton = buttons.find(
      (button) => button.textContent?.trim() === 'Save Layout',
    );

    expect(saveButton).toBeTruthy();
    if (!saveButton) throw new Error('Save Layout action button not found');

    fireEvent.click(saveButton);

    expect(props.onSaveLayout).toHaveBeenCalledWith('Wedding Plan');
  });

  it('opens load layout dialog', async () => {
    const user = userEvent.setup();

    renderHeader();

    await user.click(screen.getByRole('button', { name: /menu/i }));
    await user.click(screen.getByRole('button', { name: /load layout/i }));

    const dialog = screen.getByRole('dialog', { name: /load layout/i });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('My Layout')).toBeInTheDocument();
  });
});