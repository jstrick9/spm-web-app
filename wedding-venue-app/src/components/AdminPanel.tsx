// src/components/AdminPanel.tsx - thin coordinator for extracted admin tab components.
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Venue,
  TableSpec,
  FixtureType,
  Guideline,
  ShapeType,
  PatternType,
  LayoutCategory,
  LayoutTemplate,
  PlacedTable,
  PlacedFixture,
  PatternColors,
  ChairType,
  RectangularChairLayout,
  ChairSpec,
  User,
  EventQuestion,
  EventQuestionAnswerType,
  EventQuestionGroup,
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import { DrawingTool } from './DrawingTool';
import { CustomVenueBuilder } from './CustomVenueBuilder';
import { WelcomeModal } from './WelcomeModal';
import ModalDialog from './ModalDialog';
import { buildMessageThreadId } from '../models/DirectMessage';
import { useDirectMessages } from '../hooks/useDirectMessages';
import { useSubmissionWorkflow } from '../hooks/useSubmissionWorkflow';
import {
  layoutCategories,
  LinenColor,
  getChairSpecs,
  setChairSpecs,
  getSpacingSettings,
  setSpacingSettings,
  getWallStyles,
  setWallStyles,
  defaultWallStyles,
} from '../data/venueData';
import { WallStyle } from '../types';
import {
  getVenues,
  setVenues,
  getTableSpecs,
  setTableSpecs,
  getFixtureTypes,
  setFixtureTypes,
  getGuidelines,
  setGuidelines,
  getLinenColors,
  setLinenColors,
  getTemplates,
  setTemplates,
  getDecorItems,
  setDecorItems,
  getDecorCategories,
  setDecorCategories,
  getDecorArrangements,
  setDecorArrangements,
  getDecorPackages,
  setDecorPackages,
  setUsers,
  resetToDefaults,
} from '../hooks/useLayoutState';
import { getConfig, setConfig, Config } from '../config';
import { AdminDecorSection } from './AdminDecorSection';
import { canAccessAdminPanel } from '../utils/permissions';
import { useRBAC } from '../hooks/useRBAC';
import { createPasswordRecord } from '../utils/auth';

import { VenueManagement } from './admin/VenueManagement';
import { TableManagement } from './admin/TableManagement';
import { ChairManagement } from './admin/ChairManagement';
import { FixtureManagement } from './admin/FixtureManagement';
import { WallManagement } from './admin/WallManagement';
import { LinenManagement } from './admin/LinenManagement';
import { SpacingManagement } from './admin/SpacingManagement';
import { TemplateManagement } from './admin/TemplateManagement';
import { GuidelineManagement } from './admin/GuidelineManagement';
import { EventQuestionsManagement } from './admin/EventQuestionsManagement';
import { UserManagement } from './admin/UserManagement';
import { BrandingManagement } from './admin/BrandingManagement';
import { AccessControlPanel } from './admin/AccessControlPanel';
import { GuestPortalManagement } from './admin/GuestPortalManagement';
import type { AdminCommonProps, AdminDialogOptions, AdminTabDefinition } from './admin/AdminTabTypes';

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
  layoutState?: any;
}

const shapeOptions: ShapeType[] = ['circle', 'rectangle', 'triangle', 'semicircle', 'oval', 'hexagon', 'octagon', 'polygon'];
const patternOptions: PatternType[] = ['solid', 'checkered', 'gravel', 'concrete', 'grass', 'wood', 'tile', 'brick', 'marble', 'water', 'carpet'];

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
  carpet: { color1: '#8B4513', color2: '#654321' },
};

const DEFAULT_EVENT_ROLES = [
  'Bride',
  'Groom',
  'Wedding Planner',
  'Venue Manager',
  'Photographer',
  'DJ',
  'Caterer',
  'Decorator',
  'Coordinator',
];

type AdminDialogState = AdminDialogOptions & {
  onConfirm?: () => void | Promise<void>;
};

export function AdminPanel({ onClose, currentLayout, onLoadTemplateForEdit, layoutState }: AdminPanelProps) {
  const { createUser, deleteUser, getAllUsers, user, isAdmin } = useAuth();
  const canAccessThisPanel = canAccessAdminPanel(user);
  const EVENT_ROLES_STORAGE_KEY = 'spm_event_roles';
  const EVENT_QUESTIONS_STORAGE_KEY = 'spm_event_questions';

  const [activeTab, setActiveTab] = useState('venues');
  const [tabSearch, setTabSearch] = useState('');
  const [venues, setVenuesState] = useState(() => getVenues());
  const [tableSpecs, setTableSpecsState] = useState(() => getTableSpecs());
  const [fixtureTypes, setFixtureTypesState] = useState(() => getFixtureTypes());
  const [guidelines, setGuidelinesState] = useState(() => getGuidelines());
  const [templates, setTemplatesState] = useState(() => getTemplates());
  const [linenColors, setLinenColorsState] = useState(() => getLinenColors());
  const [config, setConfigState] = useState(() => getConfig());
  const [users, setUsersState] = useState(() => getAllUsers());
  const [chairSpecs, setChairSpecsState] = useState(() => getChairSpecs());
  const [spacingSettings, setSpacingSettingsState] = useState(() => getSpacingSettings());
  const [wallStyles, setWallStylesState] = useState<WallStyle[]>(() => getWallStyles());
  const [decorItems, setDecorItemsState] = useState(() => getDecorItems());
  const [decorCategories, setDecorCategoriesState] = useState(() => getDecorCategories());
  const [decorArrangements, setDecorArrangementsState] = useState(() => getDecorArrangements());
  const [decorPackages, setDecorPackagesState] = useState(() => getDecorPackages());

  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    name: '',
    role: 'basic' as 'admin' | 'basic' | 'staff' | 'guest',
    email: '',
    phone: '',
    contactPhoneNumber: '',
    phoneType: 'Mobile' as 'Mobile' | 'Home' | 'Work' | 'Other',
    preferredCommunication: [] as ('call' | 'text' | 'email')[],
    eventRole: '',
    eventName: '',
    userRole: 'master' as 'admin' | 'master' | 'shared' | 'read-only' | 'staff',
    isMasterUser: false,
    parentUserId: undefined as string | undefined,
    allowSharedAccess: false,
    sharedUserLimit: 0,
    userStatus: 'active' as 'invited' | 'pending' | 'active' | 'suspended' | 'disabled',
    eventDate: '',
    jobTitle: '',
    department: '',
    assignedRoles: [] as string[],
  });

  const [successMessage, setSuccessMessage] = useState('');
  const [createUserFieldErrors, setCreateUserFieldErrors] = useState<Record<string, string>>({});
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [showDrawingTool, setShowDrawingTool] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [customShapeVenueId, setCustomShapeVenueId] = useState<string | null>(null);
  const [expandedVenues, setExpandedVenues] = useState<Set<string>>(new Set());
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [expandedSeatingTypes, setExpandedSeatingTypes] = useState<Set<string>>(new Set());
  const [showTableTypesSection, setShowTableTypesSection] = useState(false);
  const [showSeatingTypesSection, setShowSeatingTypesSection] = useState(false);
  const [expandedVenueFixtures, setExpandedVenueFixtures] = useState<Set<string>>(new Set());
  const [expandedLodgingFixtures, setExpandedLodgingFixtures] = useState<Set<string>>(new Set());
  const [expandedExteriorFixtures, setExpandedExteriorFixtures] = useState<Set<string>>(new Set());
  const [showVenueFixturesSection, setShowVenueFixturesSection] = useState(false);
  const [showLodgingFixturesSection, setShowLodgingFixturesSection] = useState(false);
  const [showExteriorFixturesSection, setShowExteriorFixturesSection] = useState(false);
  const [expandedChairs, setExpandedChairs] = useState<Set<string>>(new Set());
  const [expandedWalls, setExpandedWalls] = useState<Set<string>>(new Set());
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());
  const [expandedGuidelines, setExpandedGuidelines] = useState<Set<string>>(new Set());
  const [expandedBrandingSections, setExpandedBrandingSections] = useState<Set<string>>(new Set());
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [showUserDirectMessagesSection, setShowUserDirectMessagesSection] = useState(false);
  const [showUserPendingApprovalsSection, setShowUserPendingApprovalsSection] = useState(false);
  const [showUserEventRolesSection, setShowUserEventRolesSection] = useState(false);
  const [showUserAccountsSection, setShowUserAccountsSection] = useState(false);
  const [expandedLinens, setExpandedLinens] = useState<Set<string>>(new Set());
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [dialog, setDialog] = useState<AdminDialogState | null>(null);

  const [eventRoles, setEventRoles] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(EVENT_ROLES_STORAGE_KEY);
      if (!raw) return DEFAULT_EVENT_ROLES;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return DEFAULT_EVENT_ROLES;
      const cleaned = parsed.map((r: unknown) => String(r || '').trim()).filter((r: string) => r.length > 0);
      return cleaned.length > 0 ? cleaned : DEFAULT_EVENT_ROLES;
    } catch {
      return DEFAULT_EVENT_ROLES;
    }
  });
  const [newEventRoleName, setNewEventRoleName] = useState('');
  const [editingEventRoleName, setEditingEventRoleName] = useState<string | null>(null);
  const [editingEventRoleValue, setEditingEventRoleValue] = useState('');
  const [eventQuestions, setEventQuestions] = useState<EventQuestion[]>(() => {
    try {
      const raw = localStorage.getItem(EVENT_QUESTIONS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as EventQuestion[];
    } catch {
      return [];
    }
  });
  const [newQuestion, setNewQuestion] = useState<{
    text: string;
    group: EventQuestionGroup;
    answerType: EventQuestionAnswerType;
    optionsText: string;
  }>({ text: '', group: 'Ceremony', answerType: 'text', optionsText: '' });
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [questionError, setQuestionError] = useState('');
  const [selectedMessageMasterUserId, setSelectedMessageMasterUserId] = useState<string>('');
  const [showWelcomePreview, setShowWelcomePreview] = useState(false);
  const [showAccessControl, setShowAccessControl] = useState(false);

  const submissionWorkflow = useSubmissionWorkflow();
  const directMessages = useDirectMessages();
  const rbac = useRBAC();
  const allRoles = rbac.getAllRoles();

  const AVAILABLE_WELCOME_FEATURES = [
    'Layout Design',
    'Guest Management',
    'Templates',
    'Print & Share',
    'Event Questions',
    'Chat',
    'Venue Filtering',
  ];
  const currentWelcomeFeatures = config.welcomeFeatures && config.welcomeFeatures.length > 0
    ? config.welcomeFeatures
    : AVAILABLE_WELCOME_FEATURES;

  const masterUsers = users.filter((u) => u.role === 'basic' && (u.userRole === 'master' || u.isMasterUser));

  useEffect(() => {
    if (masterUsers.length === 0) {
      setSelectedMessageMasterUserId('');
      return;
    }
    if (!selectedMessageMasterUserId || !masterUsers.some((u) => u.id === selectedMessageMasterUserId)) {
      setSelectedMessageMasterUserId(masterUsers[0].id);
    }
  }, [users, selectedMessageMasterUserId, masterUsers]);

  useEffect(() => {
    localStorage.setItem(EVENT_ROLES_STORAGE_KEY, JSON.stringify(eventRoles));
  }, [eventRoles]);

  useEffect(() => {
    localStorage.setItem(EVENT_QUESTIONS_STORAGE_KEY, JSON.stringify(eventQuestions));
  }, [eventQuestions]);

  const toggleSet = (setter: any) => (id: string) => {
    setter((prev: Set<string>) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleVenueExpanded = toggleSet(setExpandedVenues);
  const toggleTableExpanded = toggleSet(setExpandedTables);
  const toggleSeatingTypeExpanded = toggleSet(setExpandedSeatingTypes);
  const toggleVenueFixtureExpanded = toggleSet(setExpandedVenueFixtures);
  const toggleLodgingFixtureExpanded = toggleSet(setExpandedLodgingFixtures);
  const toggleExteriorFixtureExpanded = toggleSet(setExpandedExteriorFixtures);
  const toggleChairExpanded = toggleSet(setExpandedChairs);
  const toggleWallExpanded = toggleSet(setExpandedWalls);
  const toggleLinenExpanded = toggleSet(setExpandedLinens);
  const toggleTemplateExpanded = toggleSet(setExpandedTemplates);
  const toggleGuidelineExpanded = toggleSet(setExpandedGuidelines);
  const toggleUserExpanded = toggleSet(setExpandedUsers);

  const expandAllVenues = () => setExpandedVenues(new Set(venues.map((v) => v.id)));
  const collapseAllVenues = () => setExpandedVenues(new Set());
  const expandAllTables = () => setExpandedTables(new Set(tableSpecs.filter((t) => !t.isSeatingType).map((t) => t.id)));
  const collapseAllTables = () => setExpandedTables(new Set());
  const expandAllSeatingTypes = () => setExpandedSeatingTypes(new Set(tableSpecs.filter((t) => t.isSeatingType).map((t) => t.id)));
  const collapseAllSeatingTypes = () => setExpandedSeatingTypes(new Set());
  const expandAllVenueFixtures = () => setExpandedVenueFixtures(new Set(fixtureTypes.filter((f) => f.category !== 'exterior' && f.category !== 'lodging').map((f) => f.id)));
  const collapseAllVenueFixtures = () => setExpandedVenueFixtures(new Set());
  const expandAllLodgingFixtures = () => setExpandedLodgingFixtures(new Set(fixtureTypes.filter((f) => f.category === 'lodging').map((f) => f.id)));
  const collapseAllLodgingFixtures = () => setExpandedLodgingFixtures(new Set());
  const expandAllExteriorFixtures = () => setExpandedExteriorFixtures(new Set(fixtureTypes.filter((f) => f.category === 'exterior').map((f) => f.id)));
  const collapseAllExteriorFixtures = () => setExpandedExteriorFixtures(new Set());
  const expandAllLinens = () => setExpandedLinens(new Set(linenColors.map((l) => l.id)));
  const collapseAllLinens = () => setExpandedLinens(new Set());

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const showInfo = (title: string, message: string, kind: AdminDialogState['kind'] = 'info') => {
    setDialog({ title, message, kind, confirmLabel: 'OK' });
  };

  const confirmAction = (options: AdminDialogOptions, onConfirm: () => void | Promise<void>) => {
    setDialog({
      kind: 'warning',
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      ...options,
      onConfirm,
    });
  };

  const handleSaveVenues = (updated: Venue[]) => { setVenues(updated); setVenuesState(updated); showSuccess('Venues saved!'); };
  const handleSaveTables = (updated: TableSpec[]) => { setTableSpecs(updated); setTableSpecsState(updated); showSuccess('Tables saved!'); };
  const handleSaveFixtures = (updated: FixtureType[]) => { setFixtureTypes(updated); setFixtureTypesState(updated); showSuccess('Fixtures saved!'); };
  const handleSaveGuidelines = (updated: Guideline[]) => { setGuidelines(updated); setGuidelinesState(updated); showSuccess('Guidelines saved!'); };
  const handleSaveTemplates = (updated: LayoutTemplate[]) => { setTemplates(updated); setTemplatesState(updated); showSuccess('Templates saved!'); };
  const handleSaveLinenColors = (updated: LinenColor[]) => { setLinenColors(updated); setLinenColorsState(updated); showSuccess('Linen colors saved!'); };
  const handleSaveWallStyles = (updated: WallStyle[]) => { setWallStyles(updated); setWallStylesState(updated); showSuccess('Wall styles saved!'); };
  const handleSaveConfig = (updated: Config) => { setConfig(updated); setConfigState(updated); showSuccess('Branding saved!'); };
  const handleSaveUsers = (updated: User[]) => { setUsers(updated); setUsersState(updated); showSuccess('Users saved!'); };
  const handleSaveSpacing = (updated: typeof spacingSettings) => { setSpacingSettings(updated); setSpacingSettingsState(updated); showSuccess('Spacing saved!'); };

  const validateEventQuestion = (q: { text: string; answerType: EventQuestionAnswerType; optionsText: string }): string | null => {
    if (!q.text.trim()) return 'Question text is required.';
    if (q.answerType === 'dropdown') {
      const options = q.optionsText.split(',').map((o) => o.trim()).filter(Boolean);
      if (options.length === 0) return 'Dropdown questions require at least one option.';
    }
    return null;
  };

  const handleAddEventQuestion = () => {
    const err = validateEventQuestion(newQuestion);
    if (err) {
      setQuestionError(err);
      return;
    }
    const options = newQuestion.answerType === 'dropdown'
      ? newQuestion.optionsText.split(',').map((o) => o.trim()).filter(Boolean)
      : undefined;
    const question: EventQuestion = {
      id: `eq-${Date.now()}`,
      text: newQuestion.text.trim(),
      group: newQuestion.group,
      answerType: newQuestion.answerType,
      options,
      workflow: [],
    };
    setEventQuestions((prev) => [...prev, question]);
    setNewQuestion({ text: '', group: 'Ceremony', answerType: 'text', optionsText: '' });
    setQuestionError('');
    showSuccess('Event question added!');
  };

  const handleUpdateEventQuestion = (id: string, updates: Partial<EventQuestion>) => setEventQuestions((prev) => prev.map((q) => q.id === id ? { ...q, ...updates } : q));
  const handleDeleteEventQuestion = (id: string) => {
    confirmAction(
      {
        title: 'Delete event question?',
        message: 'This question will be removed from future event questionnaires.',
        kind: 'danger',
        confirmLabel: 'Delete Question',
      },
      () => {
        setEventQuestions((prev) => prev.filter((q) => q.id !== id));
        if (editingQuestionId === id) setEditingQuestionId(null);
        showSuccess('Event question deleted!');
      },
    );
  };

  const handleAddEventRole = () => {
    const roleName = newEventRoleName.trim();
    if (!roleName) {
      showInfo('Event role required', 'Enter an Event Role name before adding it.', 'warning');
      return;
    }
    if (eventRoles.some((r) => r.toLowerCase() === roleName.toLowerCase())) {
      showInfo('Duplicate event role', 'This Event Role already exists.', 'warning');
      return;
    }
    setEventRoles((prev) => [...prev, roleName]);
    setNewEventRoleName('');
    showSuccess('Event Role added!');
  };
  const handleStartEditEventRole = (role: string) => { setEditingEventRoleName(role); setEditingEventRoleValue(role); };
  const handleSaveEventRoleEdit = () => {
    if (!editingEventRoleName) return;
    const next = editingEventRoleValue.trim();
    if (!next) {
      showInfo('Event role required', 'Enter an Event Role name before saving.', 'warning');
      return;
    }
    if (eventRoles.some((r) => r.toLowerCase() === next.toLowerCase() && r !== editingEventRoleName)) {
      showInfo('Duplicate event role', 'This Event Role already exists.', 'warning');
      return;
    }
    setEventRoles((prev) => prev.map((r) => (r === editingEventRoleName ? next : r)));
    setEditingEventRoleName(null);
    setEditingEventRoleValue('');
    showSuccess('Event Role updated!');
  };
  const handleDeleteEventRole = (role: string) => {
    confirmAction(
      {
        title: 'Delete event role?',
        message: `Delete Event Role "${role}"? Existing users with this label will not be automatically reassigned.`,
        kind: 'danger',
        confirmLabel: 'Delete Role',
      },
      () => {
        setEventRoles((prev) => prev.filter((r) => r !== role));
        showSuccess('Event Role deleted!');
      },
    );
  };

  const mapUserRoleToLegacyRole = (userRole?: 'admin' | 'master' | 'shared' | 'read-only' | 'staff'): 'admin' | 'basic' | 'staff' => {
    if (userRole === 'admin') return 'admin';
    if (userRole === 'staff') return 'staff';
    return 'basic';
  };

  const validateUserForm = (u: any, requireAuthFields = false): string[] => {
    const errors: string[] = [];
    const normalizedUsername = (u.username || u.email || '').trim();
    if (requireAuthFields) {
      if (!normalizedUsername) errors.push('Username is required.');
      if (!u.password?.trim()) errors.push('Password is required.');
      if (!u.name?.trim()) errors.push('Name is required.');
    }
    const role = u.userRole ?? 'shared';
    if (!u.userRole) errors.push('User Role is required.');
    if (role !== 'admin') {
      if (!u.email?.trim()) errors.push('Email is required for non-admin users.');
      if (!u.contactPhoneNumber?.trim()) errors.push('Contact Phone Number is required for non-admin users.');
      if (!u.phoneType) errors.push('Phone Type is required for non-admin users.');
      if (!u.eventRole?.trim()) errors.push('Event Role is required for non-admin users.');
      if (!u.eventName?.trim()) errors.push('Event Name is required for non-admin users.');
      if (!u.eventDate?.trim()) {
        errors.push('Event Date is required for non-admin users.');
      } else {
        const selected = new Date(`${u.eventDate}T00:00:00`);
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        if (Number.isNaN(selected.getTime()) || selected <= todayStart) errors.push('Event Date must be in the future for non-admin users.');
      }
    }
    if ((u.preferredCommunication || []).includes('text') && u.phoneType !== 'Mobile') errors.push('Preferred Communication "Text" requires Phone Type to be Mobile.');
    if (u.allowSharedAccess) {
      const limit = Math.floor(Number(u.sharedUserLimit ?? 0));
      if (!Number.isFinite(limit) || limit <= 0 || limit > 10) errors.push('Shared User Limit must be an integer between 1 and 10 when shared access is enabled.');
    }
    return errors;
  };

  const getUserFieldErrors = (u: any, requireAuthFields = false): Record<string, string> => {
    const fieldErrors: Record<string, string> = {};
    const role = u.userRole ?? 'shared';
    const normalizedUsername = (u.username || u.email || '').trim();
    if (requireAuthFields) {
      if (!u.name?.trim()) fieldErrors.name = 'Name is required.';
      if (!normalizedUsername) fieldErrors.email = 'Email is required.';
      if (!u.password?.trim()) fieldErrors.password = 'Password is required.';
    }
    if (!u.userRole) fieldErrors.userRole = 'User Role is required.';
    if (role !== 'admin') {
      if (!u.email?.trim()) fieldErrors.email = 'Email is required for non-admin users.';
      if (!u.contactPhoneNumber?.trim()) fieldErrors.contactPhoneNumber = 'Contact Phone Number is required for non-admin users.';
      if (!u.phoneType) fieldErrors.phoneType = 'Phone Type is required for non-admin users.';
      if (!u.eventRole?.trim()) fieldErrors.eventRole = 'Event Role is required for non-admin users.';
      if (!u.eventName?.trim()) fieldErrors.eventName = 'Event Name is required for non-admin users.';
      if (!u.eventDate?.trim()) fieldErrors.eventDate = 'Event Date is required for non-admin users.';
    }
    if ((u.preferredCommunication || []).includes('text') && u.phoneType !== 'Mobile') fieldErrors.preferredCommunication = 'Preferred Communication "Text" requires Phone Type to be Mobile.';
    if (u.allowSharedAccess) {
      const limit = Math.floor(Number(u.sharedUserLimit ?? 0));
      if (!Number.isFinite(limit) || limit <= 0 || limit > 10) fieldErrors.sharedUserLimit = 'Shared User Limit must be an integer between 1 and 10.';
    }
    return fieldErrors;
  };

  const handleImageUpload = (callback: (dataUrl: string) => void) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        showInfo('File too large', 'Maximum image size is 5MB.', 'warning');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => callback(event.target?.result as string);
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleCreateUser = async () => {
    const usernameFromEmail = (newUser.email || '').trim().toLowerCase();
    const normalizedDraft = {
      ...newUser,
      username: (newUser.username || usernameFromEmail).trim(),
      preferredCommunication: newUser.preferredCommunication || [],
      allowSharedAccess: !!newUser.allowSharedAccess,
      sharedUserLimit: newUser.allowSharedAccess ? Math.max(1, Math.min(10, Math.floor(Number(newUser.sharedUserLimit || 1)))) : 0,
    };
    const errors = validateUserForm(normalizedDraft, true);
    const fieldErrors = getUserFieldErrors(normalizedDraft, true);
    if (!usernameFromEmail) errors.push('Email is required.');
    else if (users.some((u) => (u.email || u.username || '').trim().toLowerCase() === usernameFromEmail)) errors.push('Email already exists.');
    if (errors.length > 0) {
      setCreateUserFieldErrors(fieldErrors);
      showInfo('Please review the user details', errors.join('\n'), 'warning');
      return;
    }
    setCreateUserFieldErrors({});
    const legacyRole = mapUserRoleToLegacyRole(normalizedDraft.userRole);
    const effectiveUsername = usernameFromEmail || normalizedDraft.username;
    const created = await createUser(effectiveUsername, normalizedDraft.password || '', normalizedDraft.name || '', legacyRole, normalizedDraft.email || '');
    if (!created) {
      showInfo('Unable to create user', 'The username or email may already exist.', 'warning');
      return;
    }
    const updatedUsers = getAllUsers().map((u) => u.username.toLowerCase() === effectiveUsername.toLowerCase()
      ? {
          ...u,
          email: normalizedDraft.email || '',
          contactPhoneNumber: normalizedDraft.contactPhoneNumber || '',
          phoneType: normalizedDraft.phoneType || 'Mobile',
          preferredCommunication: normalizedDraft.preferredCommunication || [],
          eventRole: normalizedDraft.eventRole || '',
          eventName: normalizedDraft.eventName || '',
          userRole: normalizedDraft.userRole || 'shared',
          isMasterUser: normalizedDraft.isMasterUser || false,
          parentUserId: normalizedDraft.parentUserId,
          allowSharedAccess: normalizedDraft.allowSharedAccess || false,
          sharedUserLimit: normalizedDraft.allowSharedAccess ? normalizedDraft.sharedUserLimit : 0,
          userStatus: normalizedDraft.userStatus || 'active',
          eventDate: normalizedDraft.eventDate || '',
          phone: normalizedDraft.contactPhoneNumber || '',
          jobTitle: normalizedDraft.eventRole || '',
          department: normalizedDraft.eventName || '',
        }
      : u);
    handleSaveUsers(updatedUsers);
    setNewUser({
      username: '', password: '', name: '', role: 'basic', email: '', phone: '', contactPhoneNumber: '', phoneType: 'Mobile',
      preferredCommunication: [], eventRole: '', eventName: '', userRole: 'master', isMasterUser: false, parentUserId: undefined,
      allowSharedAccess: false, sharedUserLimit: 0, userStatus: 'active', eventDate: '', jobTitle: '', department: '', assignedRoles: [],
    });
    setShowCreateUserModal(false);
    showSuccess('User created!');
  };

  const handleDeleteUser = (userId: string, label?: string) => {
    const displayName = label || users.find((u) => u.id === userId)?.name || userId;
    confirmAction(
      {
        title: 'Delete user?',
        message: `Delete user "${displayName}"? This cannot be undone.`,
        kind: 'danger',
        confirmLabel: 'Delete User',
      },
      () => {
        deleteUser(userId);
        setUsersState(getAllUsers());
        showSuccess('User deleted!');
      },
    );
  };

  const handleImpersonate = () => undefined;

  const handleUpdateTemplateWithCurrentLayout = (templateId: string) => {
    if (!currentLayout) {
      showInfo('No current layout', 'Please design a layout first.', 'warning');
      return;
    }
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    const updatedTemplate: LayoutTemplate = {
      ...template,
      tables: currentLayout.tables.map((t) => ({ id: t.id, type: 'table' as const, specId: t.specId, x: t.x, y: t.y, rotation: t.rotation, label: t.label, guests: t.guests || [], hasLinen: t.hasLinen, linenColor: t.linenColor, customCapacity: t.customCapacity })),
      fixtures: currentLayout.fixtures.map((f) => ({ id: f.id, type: 'fixture' as const, specId: f.specId, x: f.x, y: f.y, rotation: f.rotation, label: f.label, isExterior: f.isExterior })),
      venueId: currentLayout.venueId,
    };
    handleSaveTemplates(templates.map((t) => t.id === templateId ? updatedTemplate : t));
    setEditingTemplateId(null);
  };

  const handleCreateTemplateFromLayout = () => {
    if (!currentLayout) {
      showInfo('No current layout', 'Please design a layout first, then come back to save it as a template.', 'warning');
      return;
    }
    const newTemplate: LayoutTemplate = {
      id: `template-${Date.now()}`,
      name: 'New Template from Layout',
      description: 'Created from current layout',
      venueId: currentLayout.venueId,
      category: currentLayout.category || 'reception',
      tables: currentLayout.tables.map((t) => ({ id: t.id, type: 'table' as const, specId: t.specId, x: t.x, y: t.y, rotation: t.rotation, label: t.label, guests: t.guests || [], hasLinen: t.hasLinen, linenColor: t.linenColor, customCapacity: t.customCapacity })),
      fixtures: currentLayout.fixtures.map((f) => ({ id: f.id, type: 'fixture' as const, specId: f.specId, x: f.x, y: f.y, rotation: f.rotation, label: f.label, isExterior: f.isExterior })),
      isMasterTemplate: false,
      createdAt: new Date().toISOString(),
    };
    handleSaveTemplates([...templates, newTemplate]);
  };

  const handleLoadForEdit = (template: LayoutTemplate) => {
    if (onLoadTemplateForEdit) {
      onLoadTemplateForEdit(template);
      onClose();
    }
  };

  const handleReset = () => {
    confirmAction(
      {
        title: 'Reset all settings?',
        message: 'This will reset all admin-managed settings to factory defaults. This cannot be undone.',
        kind: 'danger',
        confirmLabel: 'Reset Everything',
      },
      () => {
        resetToDefaults();
        setVenuesState(getVenues());
        setTableSpecsState(getTableSpecs());
        setFixtureTypesState(getFixtureTypes());
        setGuidelinesState(getGuidelines());
        setTemplatesState(getTemplates());
        setLinenColorsState(getLinenColors());
        setWallStylesState(getWallStyles());
        setChairSpecsState(getChairSpecs());
        setSpacingSettingsState(getSpacingSettings());
        showSuccess('Reset to defaults!');
      },
    );
  };

  const renderShapePreview = (shape: ShapeType, color: string = '#4A1942') => {
    const size = 48;
    switch (shape) {
      case 'circle': return <circle cx={size / 2} cy={size / 2} r={size / 2 - 4} fill={color} stroke="#333" strokeWidth="1" />;
      case 'rectangle': return <rect x="4" y="8" width={size - 8} height={size - 16} fill={color} stroke="#333" strokeWidth="1" />;
      case 'oval': return <ellipse cx={size / 2} cy={size / 2} rx={size / 2 - 4} ry={size / 3} fill={color} stroke="#333" strokeWidth="1" />;
      case 'triangle': return <polygon points={`${size / 2},4 ${size - 4},${size - 4} 4,${size - 4}`} fill={color} stroke="#333" strokeWidth="1" />;
      case 'semicircle': return <path d={`M 4,${size / 2} A ${size / 2 - 4},${size / 2 - 4} 0 0,1 ${size - 4},${size / 2} L 4,${size / 2}`} fill={color} stroke="#333" strokeWidth="1" />;
      case 'hexagon': {
        const h = size / 2, r = size / 2 - 4;
        return <polygon points={Array.from({ length: 6 }, (_, i) => `${h + r * Math.cos((i * 60 - 90) * Math.PI / 180)},${h + r * Math.sin((i * 60 - 90) * Math.PI / 180)}`).join(' ')} fill={color} stroke="#333" strokeWidth="1" />;
      }
      case 'octagon': {
        const h = size / 2, r = size / 2 - 4;
        return <polygon points={Array.from({ length: 8 }, (_, i) => `${h + r * Math.cos((i * 45 - 90) * Math.PI / 180)},${h + r * Math.sin((i * 45 - 90) * Math.PI / 180)}`).join(' ')} fill={color} stroke="#333" strokeWidth="1" />;
      }
      default: return <rect x="4" y="4" width={size - 8} height={size - 8} fill={color} stroke="#333" strokeWidth="1" />;
    }
  };

  const tableTypes = tableSpecs.filter((t) => !t.isSeatingType);
  const seatingTypes = tableSpecs.filter((t) => t.isSeatingType);
  const getSeatingDimensions = (chairType: string | undefined, chairsPerRow: number, rowCount: number, rowSpacingFt: number) => {
    const chair = getChairSpecs().find((c) => c.id === (chairType || 'white-plastic'));
    const chairWidth = chair?.width || 1.5;
    const chairDepth = chair?.depth || chair?.width || 1.5;
    const chairGap = Math.max(0.2, chairWidth * 0.15);
    const width = Math.max(1, chairsPerRow) * chairWidth + Math.max(0, Math.max(1, chairsPerRow) - 1) * chairGap;
    const height = Math.max(1, rowCount) * chairDepth + Math.max(0, Math.max(1, rowCount) - 1) * Math.max(0.5, rowSpacingFt);
    return { width: Number(width.toFixed(2)), height: Number(height.toFixed(2)) };
  };

  if (!canAccessThisPanel) {
    return (
      <div className="fixed inset-0 z-[10000] bg-black/50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-xl bg-white shadow-xl p-6">
          <h2 className="text-xl font-semibold text-red-700">Access denied</h2>
          <p className="mt-2 text-sm text-gray-600">You do not have permission to access the admin panel.</p>
          <button type="button" onClick={onClose} className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white">Close</button>
        </div>
      </div>
    );
  }

  const commonProps: AdminCommonProps = {
    config,
    venues,
    setVenues,
    tables: tableSpecs,
    setTables: handleSaveTables,
    fixtures: fixtureTypes,
    setFixtures: handleSaveFixtures,
    chairs: chairSpecs,
    setChairs: handleSaveChairs,
    wallStyles,
    setWallStyles: handleSaveWallStyles,
    linenColors,
    setLinenColors: handleSaveLinenColors,
    templates,
    setTemplates: handleSaveTemplates,
    guidelines,
    setGuidelines: handleSaveGuidelines,
    users,
    setUsers: handleSaveUsers,
    eventQuestions,
    setEventQuestions,
    decorItems,
    setDecorItems: setDecorItemsState,
    decorCategories,
    setDecorCategories: setDecorCategoriesState,
    decorArrangements,
    setDecorArrangements: setDecorArrangementsState,
    decorPackages,
    setDecorPackages: setDecorPackagesState,
    layoutState,
    directMessages,
    handlers: {},
    user,
    isAdmin,
    selectedMessageMasterUserId,
    setSelectedMessageMasterUserId,
    buildMessageThreadId,
    setShowCreateUserModal,
    setShowEditUserModal,
    setEditingUser,
    handleSaveUsers,
    handleDeleteUser,
    handleImpersonate,
    submissionWorkflow,
    showUserDirectMessagesSection,
    setShowUserDirectMessagesSection,
    showUserPendingApprovalsSection,
    setShowUserPendingApprovalsSection,
    showUserEventRolesSection,
    setShowUserEventRolesSection,
    showUserAccountsSection,
    setShowUserAccountsSection,
    newEventRoleName,
    setNewEventRoleName,
    handleAddEventRole,
    eventRoles,
    editingEventRoleName,
    editingEventRoleValue,
    setEditingEventRoleValue,
    handleSaveEventRoleEdit,
    setEditingEventRoleName,
    handleStartEditEventRole,
    handleDeleteEventRole,
    handleImageUpload,
    showSuccess,
    showInfo,
    confirmAction,
    createPasswordRecord,
    tableTypes,
    tableSpecs,
    setTableSpecs: handleSaveTables,
    fixtureTypes,
    setFixtureTypes: handleSaveFixtures,
    chairSpecs,
    setChairSpecs: handleSaveChairs,
    defaultWallStyles,
    defaultPatternColors,
    patternOptions,
    layoutCategories,
    venueCategories: layoutCategories,
    seatingTypes,
    expandedSeatingTypes,
    setExpandedSeatingTypes,
    getSeatingDimensions,
    toggleSeatingTypeExpanded,
    expandAllSeatingTypes,
    collapseAllSeatingTypes,
    shapeOptions,
    chairLayoutOptions,
    getChairSpecs,
    setShowTableTypesSection,
    showTableTypesSection,
    setShowSeatingTypesSection,
    showSeatingTypesSection,
    setShowLodgingFixturesSection,
    showLodgingFixturesSection,
    expandAllLodgingFixtures,
    collapseAllLodgingFixtures,
    toggleLodgingFixtureExpanded,
    expandedLodgingFixtures,
    setShowExteriorFixturesSection,
    showExteriorFixturesSection,
    expandAllExteriorFixtures,
    collapseAllExteriorFixtures,
    toggleExteriorFixtureExpanded,
    expandedExteriorFixtures,
    setShowVenueFixturesSection,
    showVenueFixturesSection,
    expandAllVenueFixtures,
    collapseAllVenueFixtures,
    toggleVenueFixtureExpanded,
    expandedVenueFixtures,
    setShowDrawingTool,
    renderShapePreview,
    handleSaveVenues,
    collapseAllVenues,
    expandAllVenues,
    toggleVenueExpanded,
    setCustomShapeVenueId,
    handleSaveTables,
    collapseAllTables,
    expandAllTables,
    toggleTableExpanded,
    handleSaveFixtures,
    setChairSpecsState,
    handleSaveWallStyles,
    handleSaveLinenColors,
    handleSaveGuidelines,
    handleSaveTemplates,
    handleSaveConfig,
    handleSaveSpacing,
    spacingSettings,
    setSpacingSettingsState,
    expandedVenues,
    setExpandedVenues,
    expandedTables,
    setExpandedTables,
    expandedChairs,
    setExpandedChairs,
    toggleChairExpanded,
    expandedWalls,
    setExpandedWalls,
    toggleWallExpanded,
    expandedLinens,
    setExpandedLinens,
    toggleLinenExpanded,
    expandAllLinens,
    collapseAllLinens,
    expandedTemplates,
    setExpandedTemplates,
    toggleTemplateExpanded,
    expandedGuidelines,
    setExpandedGuidelines,
    toggleGuidelineExpanded,
    expandedUsers,
    setExpandedUsers,
    toggleUserExpanded,
    onClose,
    currentLayout,
    onLoadTemplateForEdit,
    createUser,
    deleteUser,
    getAllUsers,
    canAccessThisPanel,
    EVENT_ROLES_STORAGE_KEY,
    EVENT_QUESTIONS_STORAGE_KEY,
    DEFAULT_EVENT_ROLES,
    setVenuesState,
    setTableSpecsState,
    setFixtureTypesState,
    setGuidelinesState,
    setTemplatesState,
    setLinenColorsState,
    setConfigState,
    setUsersState,
    setWallStylesState,
    successMessage,
    setSuccessMessage,
    showDrawingTool,
    logoInputRef,
    customShapeVenueId,
    expandedBrandingSections,
    setExpandedBrandingSections,
    showCreateUserModal,
    showEditUserModal,
    editingUser,
    setEventRoles,
    newQuestion,
    setNewQuestion,
    editingQuestionId,
    setEditingQuestionId,
    questionError,
    setQuestionError,
    showWelcomePreview,
    setShowWelcomePreview,
    showAccessControl,
    setShowAccessControl,
    rbac,
    allRoles,
    AVAILABLE_WELCOME_FEATURES,
    currentWelcomeFeatures,
    masterUsers,
    validateEventQuestion,
    handleAddEventQuestion,
    handleUpdateEventQuestion,
    handleDeleteEventQuestion,
    handleCreateUser,
    newUser,
    setNewUser,
    createUserFieldErrors,
    setCreateUserFieldErrors,
    editingTemplateId,
    setEditingTemplateId,
    handleUpdateTemplateWithCurrentLayout,
    handleCreateTemplateFromLayout,
    handleLoadForEdit,
    handleReset,
  };

  const tabs: AdminTabDefinition[] = [
    { id: 'venues', label: '🏛️ Venues', icon: '🏛️', Component: VenueManagement, props: commonProps },
    { id: 'tables', label: '🪑 Tables/Seating', icon: '🪑', Component: TableManagement, props: commonProps },
    { id: 'chairs', label: '💺 Chairs', icon: '💺', Component: ChairManagement, props: commonProps },
    { id: 'fixtures', label: '📦 Fixtures', icon: '📦', Component: FixtureManagement, props: commonProps },
    {
      id: 'decor',
      label: '🎀 Decor',
      icon: '🎀',
      Component: AdminDecorSection,
      props: {
        config,
        decorItems,
        setDecorItems: (items: any[]) => { setDecorItems(items); setDecorItemsState(items); },
        decorCategories,
        setDecorCategories: (categories: any[]) => { setDecorCategories(categories); setDecorCategoriesState(categories); },
        decorArrangements,
        setDecorArrangements: (arrangements: any[]) => { setDecorArrangements(arrangements); setDecorArrangementsState(arrangements); },
        decorPackages,
        setDecorPackages: (packages: any[]) => { setDecorPackages(packages); setDecorPackagesState(packages); },
        onShowSuccess: showSuccess,
        confirmAction,
      },
    },
    { id: 'walls', label: '🪟 Walls', icon: '🪟', Component: WallManagement, props: commonProps },
    { id: 'linens', label: '🎨 Linens', icon: '🎨', Component: LinenManagement, props: commonProps },
    { id: 'spacing', label: '📐 Spacing', icon: '📐', Component: SpacingManagement, props: commonProps },
    { id: 'templates', label: '📋 Templates', icon: '📋', Component: TemplateManagement, props: commonProps },
    { id: 'guidelines', label: '💡 Guidelines', icon: '💡', Component: GuidelineManagement, props: commonProps },
    { id: 'event-questions', label: '❓ Event Questions', icon: '❓', Component: EventQuestionsManagement, props: commonProps },
    { id: 'users', label: '👥 Users', icon: '👥', Component: UserManagement, props: commonProps },
    { id: 'access-control', label: '🔐 Access Control', icon: '🔐', Component: AccessControlPanel, props: { inline: true, onClose: () => setActiveTab('venues') } },
    {
      id: 'guest-portal',
      label: '💍 Guest Portal',
      icon: '💍',
      Component: GuestPortalManagement,
      props: { onShowSuccess: showSuccess },
    },
    { id: 'branding', label: '🎨 Branding', icon: '🎨', Component: BrandingManagement, props: commonProps },
  ];

  const filteredTabs = tabs.filter((tab) => {
    const q = tabSearch.trim().toLowerCase();
    if (!q) return true;
    return `${tab.label} ${tab.id}`.toLowerCase().includes(q);
  });
  const activeTabConfig =
    filteredTabs.find((tab) => tab.id === activeTab) ||
    tabs.find((tab) => tab.id === activeTab) ||
    filteredTabs[0] ||
    tabs[0];
  const ActiveComponent = activeTabConfig.Component;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4" style={{ zIndex: 10000 }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b" style={{ backgroundColor: config.primaryColor, color: config.headerTextColor }}>
          <div className="flex justify-between items-start gap-4">
            <div>
              <h2 className="text-xl font-bold" style={{ fontFamily: config.headingFontFamily }}>Admin Panel</h2>
              <p className="text-sm opacity-90 mt-1">Manage venues, fixtures, users, branding, and wedding intelligence data.</p>
            </div>
            <button type="button" onClick={onClose} className="text-2xl hover:opacity-80" aria-label="Close admin panel">✕</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-xs">
            <div className="rounded-lg bg-white/10 px-3 py-2">
              <div className="font-semibold text-base text-white">{venues.length}</div>
              <div className="text-white/70">Venues</div>
            </div>
            <div className="rounded-lg bg-white/10 px-3 py-2">
              <div className="font-semibold text-base text-white">{templates.length}</div>
              <div className="text-white/70">Templates</div>
            </div>
            <div className="rounded-lg bg-white/10 px-3 py-2">
              <div className="font-semibold text-base text-white">{users.length}</div>
              <div className="text-white/70">Users</div>
            </div>
            <div className="rounded-lg bg-white/10 px-3 py-2">
              <div className="font-semibold text-base text-white">{activeTabConfig.label.replace(`${activeTabConfig.icon} `, '')}</div>
              <div className="text-white/70">Current section</div>
            </div>
          </div>
        </div>

        <div className="border-b bg-white px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 max-w-lg">
            <label htmlFor="admin-tab-search" className="sr-only">Find an admin section</label>
            <input
              id="admin-tab-search"
              type="search"
              value={tabSearch}
              onChange={(e) => setTabSearch(e.target.value)}
              placeholder="Quick find an admin section..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A1942]/20 focus:border-[#4A1942]"
            />
          </div>
          <div className="text-xs text-gray-500">
            Showing <strong>{filteredTabs.length}</strong> of {tabs.length} sections
          </div>
        </div>

        <div className="flex overflow-x-auto border-b" style={{ backgroundColor: config.primaryColor }}>
          {filteredTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2"
              style={{
                backgroundColor: activeTab === tab.id ? 'white' : 'transparent',
                color: activeTab === tab.id ? config.primaryColor : config.headerTextColor,
                opacity: activeTab === tab.id ? 1 : 0.9,
              }}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label.replace(`${tab.icon} `, '')}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50">
          {filteredTabs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-gray-500">
              <div className="text-3xl mb-3">🔎</div>
              <p className="text-lg font-semibold text-gray-700">No admin sections match “{tabSearch}”</p>
              <p className="text-sm mt-1">Try a broader term like venue, guest, user, or branding.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-[#4A1942]/10 px-3 py-1 text-[#4A1942] font-medium">
                  {activeTabConfig.icon} {activeTabConfig.label.replace(`${activeTabConfig.icon} `, '')}
                </span>
                <span>Use Quick find to jump between sections without scanning the full admin tab list.</span>
              </div>
              <ActiveComponent {...activeTabConfig.props} />
            </div>
          )}
        </div>

        {dialog && (
          <ModalDialog
            title={dialog.title}
            description={dialog.kind === 'danger' ? 'Please confirm this destructive action.' : undefined}
            onClose={() => setDialog(null)}
            className="max-w-lg"
          >
            <div className="space-y-4">
              <p className="whitespace-pre-line text-sm text-gray-700">{dialog.message}</p>
              <div className="flex justify-end gap-2">
                {dialog.onConfirm && (
                  <button
                    type="button"
                    onClick={() => setDialog(null)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {dialog.cancelLabel || 'Cancel'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const onConfirm = dialog.onConfirm;
                    setDialog(null);
                    void onConfirm?.();
                  }}
                  className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
                    dialog.kind === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#4A1942] hover:bg-[#5c2a64]'
                  }`}
                >
                  {dialog.confirmLabel || 'OK'}
                </button>
              </div>
            </div>
          </ModalDialog>
        )}

        {successMessage && (
          <div className="absolute bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
            ✅ {successMessage}
          </div>
        )}

        {customShapeVenueId && venues.find((v) => v.id === customShapeVenueId) && (
          <CustomVenueBuilder
            venue={venues.find((v) => v.id === customShapeVenueId)!}
            onClose={() => setCustomShapeVenueId(null)}
            onSave={(points) => {
              const customPath = points.length >= 3 ? `M ${points.map((p, i) => `${i === 0 ? '' : 'L '}${p.x} ${p.y}`).join(' ')} Z` : undefined;
              handleSaveVenues(venues.map((v) => v.id === customShapeVenueId ? { ...v, shape: 'custom', shapePoints: points, customPath, isCustomShape: true } : v));
              setCustomShapeVenueId(null);
            }}
          />
        )}

        {showDrawingTool && (
          <DrawingTool
            onClose={() => setShowDrawingTool(false)}
            onSave={(payload) => {
              const { imageDataUrl, name, fixtureType, objects, drawingWidth, drawingHeight } = payload;
              const newFixture: FixtureType = {
                id: `fixture-custom-${Date.now()}`,
                name: name || (fixtureType === 'architectural' ? 'Custom Landscape Feature' : 'Custom Venue Fixture'),
                shape: 'custom',
                width: fixtureType === 'architectural' ? 10 : 4,
                height: fixtureType === 'architectural' ? 10 : 4,
                icon: fixtureType === 'architectural' ? '🎨' : '🖼️',
                color: fixtureType === 'architectural' ? '#90EE90' : '#E5E5E5',
                category: fixtureType === 'architectural' ? 'exterior' : 'interior',
                imageUrl: imageDataUrl,
                customDrawing: { objects, drawingWidth, drawingHeight },
              };
              handleSaveFixtures([...fixtureTypes, newFixture]);
              setShowDrawingTool(false);
              showSuccess(`Custom ${fixtureType === 'architectural' ? 'landscape feature' : 'venue fixture'} "${name}" created!`);
            }}
          />
        )}

        {showWelcomePreview && (
          <WelcomeModal isAdmin={false} isGuest={false} onClose={() => setShowWelcomePreview(false)} />
        )}
      </div>
    </div>
  );

  function handleSaveChairs(updated: ChairSpec[]) {
    setChairSpecs(updated);
    setChairSpecsState(updated);
    showSuccess('Chairs saved!');
  }
}
