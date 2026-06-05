import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CatalogScreen } from './CatalogScreen';
import { catalogSdk } from '../../sdk/catalog';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../ui/Toast';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

vi.mock('../../sdk', () => ({
  sdk: {
    catalog: {
      list: vi.fn().mockResolvedValue({ 
        items: [
          { id: 'item-1', name: 'Standard Round', spec: JSON.stringify({ type: 'table', shape: 'round', radius: 30 }) }
        ] 
      }),
      replaceAll: vi.fn().mockResolvedValue({ items: [] })
    },
    platformConfig: {
      getOrg: vi.fn().mockResolvedValue({
        config: {
          guestPortal: {
            requirePasscode: true,
            showMeals: true,
            allowSongs: true,
            enableRegistry: true,
            registryUrl: 'https://withjoy.com/smith-wedding',
            expiryDays: 60,
            lodgingRooms: 8,
            portalWelcome: 'Welcome to our digital layout assistant.'
          }
        }
      }),
      putOrg: vi.fn().mockResolvedValue({ config: {} })
    }
  }
}));

describe('CatalogScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const TestWrapper = ({ children }: any) => (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {children}
      </ToastProvider>
    </QueryClientProvider>
  );

  it('renders catalog items and allows adding new', async () => {
    render(<CatalogScreen orgId="org-1" />, { wrapper: TestWrapper });
    
    expect(await screen.findByDisplayValue('Standard Round')).toBeInTheDocument();
    
    const addBtn = screen.getByRole('button', { name: /Add Item/i });
    fireEvent.click(addBtn);
    
    expect(screen.getByDisplayValue('New table')).toBeInTheDocument();
  });

  it('supports Guideline Management defaults loading and quick adding', async () => {
    render(<CatalogScreen orgId="org-1" />, { wrapper: TestWrapper });

    // Switch to Guideline tab
    const guidelineTabBtn = await screen.findByRole('button', { name: /🚒 Guidelines/i });
    fireEvent.click(guidelineTabBtn);

    // Verify loading defaults
    const loadDefaultsBtn = screen.getByRole('button', { name: /💾 Load Guideline Defaults/i });
    fireEvent.click(loadDefaultsBtn);

    expect(screen.getByDisplayValue('ADA Wheelchair Buffer')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Emergency Exit Corridor')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Fire Flame Safety Ring')).toBeInTheDocument();

    // Verify quick adding Fire Safety Ring
    const quickAddFireBtn = screen.getByRole('button', { name: /🚒 Fire Safety Ring/i });
    fireEvent.click(quickAddFireBtn);
    expect(screen.getByDisplayValue('Fire Safety Ring')).toBeInTheDocument();

    // Verify quick adding ADA spacing buffer rule
    const quickAddAdaBtn = screen.getByRole('button', { name: /♿ ADA Spacing Buffer Rules/i });
    fireEvent.click(quickAddAdaBtn);
    expect(screen.getByDisplayValue('ADA Seating Gap')).toBeInTheDocument();

    // Verify quick adding Regulatory Clearance
    const quickAddClearanceBtn = screen.getByRole('button', { name: /🚨 Regulatory Clearances/i });
    fireEvent.click(quickAddClearanceBtn);
    expect(screen.getByDisplayValue('Main Exit Path Buffer')).toBeInTheDocument();
  });

  it('supports Spacing Management defaults loading and quick adding', async () => {
    render(<CatalogScreen orgId="org-1" />, { wrapper: TestWrapper });

    // Switch to Spacing tab
    const spacingTabBtn = await screen.findByRole('button', { name: /📐 Spacing Presets/i });
    fireEvent.click(spacingTabBtn);

    // Verify loading defaults
    const loadDefaultsBtn = screen.getByRole('button', { name: /💾 Load Spacing Defaults/i });
    fireEvent.click(loadDefaultsBtn);

    expect(screen.getByDisplayValue('Spacious Dining Setup')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Traditional Ceremony Spacing')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Cozy Bistro Spacing')).toBeInTheDocument();

    // Verify quick adding Spacious Luxury
    const quickAddLuxBtn = screen.getByRole('button', { name: /📐 Spacious Luxury/i });
    fireEvent.click(quickAddLuxBtn);
    expect(screen.getByDisplayValue('Spacious Luxury Dining')).toBeInTheDocument();

    // Verify quick adding Ceremony Seating
    const quickAddCeremonyBtn = screen.getByRole('button', { name: /💒 Ceremony Seating/i });
    fireEvent.click(quickAddCeremonyBtn);
    expect(screen.getByDisplayValue('Ceremony Seating Offset')).toBeInTheDocument();

    // Verify quick adding Bistro Style
    const quickAddBistroBtn = screen.getByRole('button', { name: /☕ Bistro Cafe Style/i });
    fireEvent.click(quickAddBistroBtn);
    expect(screen.getByDisplayValue('Bistro Snug Spacing')).toBeInTheDocument();
  });

  it('supports Template Management defaults loading and quick adding', async () => {
    render(<CatalogScreen orgId="org-1" />, { wrapper: TestWrapper });

    // Switch to Template tab
    const templateTabBtn = await screen.findByRole('button', { name: /📋 Layout Templates/i });
    fireEvent.click(templateTabBtn);

    // Verify loading defaults
    const loadDefaultsBtn = screen.getByRole('button', { name: /💾 Load Template Defaults/i });
    fireEvent.click(loadDefaultsBtn);

    expect(screen.getByDisplayValue('Grand Ballroom Banquet Setup')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Symmetrical Ceremony Row Seating')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Cocktail Hour Mixer Layout')).toBeInTheDocument();

    // Verify quick adding Banquet Reception
    const quickAddBanquetBtn = screen.getByRole('button', { name: /🎉 Banquet Reception/i });
    fireEvent.click(quickAddBanquetBtn);
    expect(screen.getByDisplayValue('Seated Reception Banquet')).toBeInTheDocument();

    // Verify quick adding Row Ceremony
    const quickAddCeremonyBtn = screen.getByRole('button', { name: /💒 Row Ceremony/i });
    fireEvent.click(quickAddCeremonyBtn);
    expect(screen.getByDisplayValue('Symmetrical Row Ceremony')).toBeInTheDocument();

    // Verify quick adding Cocktail Mixer
    const quickAddCocktailBtn = screen.getByRole('button', { name: /🍸 Cocktail Mixer/i });
    fireEvent.click(quickAddCocktailBtn);
    expect(screen.getByDisplayValue('Cocktail Hour Mixer')).toBeInTheDocument();
  });

  it('supports Guest Portal Studio defaults loading, quick adding and custom configurations', async () => {
    render(<CatalogScreen orgId="org-1" />, { wrapper: TestWrapper });

    // Switch to Guest Portal Studio tab
    const portalTabBtn = await screen.findByRole('button', { name: /🌐 Guest Portal Studio/i });
    fireEvent.click(portalTabBtn);

    // Verify initial values from mock config
    expect(await screen.findByDisplayValue('Welcome to our digital layout assistant.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://withjoy.com/smith-wedding')).toBeInTheDocument();

    // Verify loading defaults
    const loadDefaultsBtn = screen.getByRole('button', { name: /💾 Load Portal Defaults/i });
    fireEvent.click(loadDefaultsBtn);

    // Verify loading presets: Light Informative
    const lightPresetBtn = screen.getByRole('button', { name: /📖 Light Informative/i });
    fireEvent.click(lightPresetBtn);
    expect(screen.getByDisplayValue('Explore our digital layouts and accommodations.')).toBeInTheDocument();

    // Verify loading presets: Standard RSVP
    const standardPresetBtn = screen.getByRole('button', { name: /🎉 Standard RSVP/i });
    fireEvent.click(standardPresetBtn);
    expect(screen.getByDisplayValue('Welcome to our digital layout assistant.')).toBeInTheDocument();

    // Verify saving preferences
    const saveBtn = screen.getByRole('button', { name: /Save Portal Preferences/i });
    fireEvent.click(saveBtn);
  });
});
