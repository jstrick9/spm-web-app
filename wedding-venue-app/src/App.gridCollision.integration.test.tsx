import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const addTableMock = vi.fn();
const updateTableMock = vi.fn();
const checkTableCollisionMock = vi.fn();
const showToastMock = vi.fn();

vi.mock('./components/Header', () => ({
  Header: () => <div data-testid="header" />,
}));

vi.mock('./components/Sidebar', () => ({
  Sidebar: (props: any) => (
    <div>
      <button onClick={() => props.onDragStart('table', 'table-spec-1', false)}>start-drag-table</button>
      <button onClick={() => props.onDragEnd?.()}>end-drag</button>
    </div>
  ),
}));

vi.mock('./components/FloorPlanCanvas', () => ({
  FloorPlanCanvas: (props: any) => (
    <div>
      <button onClick={() => props.onDrop({ x: 7.6, y: 7.6 }, false)}>drop-item</button>
      <button onClick={() => props.onClickToPlace({ x: 7.6, y: 7.6 }, false)}>click-place-item</button>
    </div>
  ),
}));

vi.mock('./components/PropertiesPanel', () => ({
  PropertiesPanel: (props: any) => (
    <div>
      <button onClick={() => props.onUpdateTable('tbl1', { x: 7.6, y: 7.6 })}>properties-move-table</button>
    </div>
  ),
}));

vi.mock('./components/GuestPanel', () => ({ GuestPanel: () => null }));
vi.mock('./components/AdminPanel', () => ({ AdminPanel: () => null }));
vi.mock('./components/PrintView', () => ({ PrintView: () => null }));
vi.mock('./components/TemplateSelector', () => ({ TemplateSelector: () => null }));
vi.mock('./components/WelcomeModal', () => ({ WelcomeModal: () => null }));
vi.mock('./components/DirectMessagePanel', () => ({ DirectMessagePanel: () => null }));
vi.mock('./components/SubmissionStatusPanel', () => ({ SubmissionStatusPanel: () => null }));
vi.mock('./components/EventQuestionsWizard', () => ({ EventQuestionsWizard: () => null }));
vi.mock('./components/AppErrorBoundary', () => ({ AppErrorBoundary: ({ children }: any) => <>{children}</> }));

vi.mock('./components/Toast', () => ({
  ToastContainer: () => null,
  showToast: (...args: any[]) => showToastMock(...args),
}));

vi.mock('./hooks/useSubmissionWorkflow', () => ({
  useSubmissionWorkflow: () => ({
    getByMasterAndEvent: () => null,
    submit: vi.fn(),
  }),
}));

const layoutStateMockFactory = () => ({
  venues: [
    {
      id: 'v1',
      name: 'Venue 1',
      category: 'reception',
      width: 40,
      height: 30,
      capacity: 200,
      shape: 'rectangle',
      exteriorPadding: { top: 40, right: 30, bottom: 30, left: 40 },
      canvasWidth: 120,
      canvasHeight: 100,
    },
  ],
  currentVenue: {
    id: 'v1',
    name: 'Venue 1',
    category: 'reception',
    width: 40,
    height: 30,
    capacity: 200,
    shape: 'rectangle',
    exteriorPadding: { top: 40, right: 30, bottom: 30, left: 40 },
    canvasWidth: 120,
    canvasHeight: 100,
  },
  layout: {
    name: 'Test Layout',
    venueId: 'v1',
    category: 'reception',
    tables: [
      { id: 'tbl1', specId: 'table-spec-1', x: 2, y: 2, showChairs: true, chairType: 'white-plastic', chairLayout: 'all-sides' },
    ],
    fixtures: [],
    decor: [],
  },
  guests: [],
  selectedId: null,
  setSelectedId: vi.fn(),
  setOnVenueChange: vi.fn(),
  changeVenue: vi.fn(),
  refreshVenues: vi.fn(),
  addTable: addTableMock,
  addFixture: vi.fn(),
  updateTable: updateTableMock,
  updateFixture: vi.fn(),
  removeItem: vi.fn(),
  duplicateItem: vi.fn(),
  clearLayout: vi.fn(),
  saveLayout: vi.fn(),
  loadLayout: vi.fn(),
  loadTemplate: vi.fn(),
  saveMasterLayout: vi.fn(),
  clearMasterLayout: vi.fn(),
  addGuest: vi.fn(),
  updateGuest: vi.fn(),
  removeGuest: vi.fn(),
  assignGuestToTable: vi.fn(),
  assignGuestToRoom: vi.fn(),
  importGuestsFromCSV: vi.fn(),
  exportGuestsToCSV: vi.fn(),
  getDecorArrangements: vi.fn(() => []),
  getDecorItems: vi.fn(() => []),
});

vi.mock('./hooks/useLayoutState', () => ({
  useLayoutState: () => layoutStateMockFactory(),
  getSavedLayouts: () => [],
  setSavedLayouts: vi.fn(),
  getTemplates: () => [],
  getTableSpecs: () => [{ id: 'table-spec-1', capacity: 10 }],
  getFixtureTypes: () => [],
  getDecorArrangements: () => [],
  getDecorItems: () => [],
  getLinenColors: () => [],
  getChairSpecs: () => [],
}));

vi.mock('./contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test', username: 'testadmin', role: 'admin', name: 'Test Admin', isActive: true, createdAt: new Date().toISOString() },
    isAdmin: true,
    isBasicUser: false,
    isGuest: false,
    login: vi.fn(),
    logout: vi.fn(),
    continueAsGuest: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
    getAllUsers: vi.fn(() => []),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('./utils/collisionDetection', () => ({
  checkTableCollision: (...args: any[]) => checkTableCollisionMock(...args),
  checkFixtureCollision: () => ({ collides: false }),
}));

vi.mock('./config', () => ({
  getConfig: () => ({
    primaryColor: '#4A1942',
    primaryDark: '#3d1a45',
    primaryLight: '#6f2a67',
    accentColor: '#C0C0C0',
    backgroundColor: '#f8f8f8',
    textColor: '#111111',
    headerTextColor: '#ffffff',
    bodyTextColor: '#111111',
    accentTextColor: '#4A1942',
    fontFamily: 'Inter, sans-serif',
    headingFontFamily: 'Playfair Display, serif',
    showWelcomeByDefault: false,
  }),
}));

import App from './App';

describe('App grid/snap + authoritative collision integration', () => {
  beforeEach(() => {
    addTableMock.mockReset();
    updateTableMock.mockReset();
    checkTableCollisionMock.mockReset();
    showToastMock.mockReset();
  });

  it.skip('blocks drag+snap placement on collision and shows non-blocking toast', async () => {
    checkTableCollisionMock.mockReturnValue({ collides: true, details: 'blocked by spacing' });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('start-drag-table'));
    await user.click(screen.getByText('drop-item'));

    expect(addTableMock).not.toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledWith('blocked by spacing', 'warning');
    expect(checkTableCollisionMock).toHaveBeenCalled();
    const firstArg = checkTableCollisionMock.mock.calls[0][0];
    expect(firstArg.x).toBe(10);
    expect(firstArg.y).toBe(10);
  });

  it.skip('blocks click-to-place on collision and shows toast', async () => {
    checkTableCollisionMock.mockReturnValue({ collides: true, details: 'cannot place here' });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('start-drag-table'));
    await user.click(screen.getByText('click-place-item'));

    expect(addTableMock).not.toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledWith('cannot place here', 'warning');
  });

  it.skip('blocks properties x/y table edits on collision', async () => {
    checkTableCollisionMock.mockReturnValue({ collides: true, details: 'collision from properties' });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('properties-move-table'));

    expect(updateTableMock).not.toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledWith('collision from properties', 'warning');
  });
});
