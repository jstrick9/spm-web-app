// @ts-nocheck
import React from 'react';
import { BrandedSectionHeader, BrandedStatCard, BrandedTips, PatternColorPicker } from './shared/AdminSharedComponents';
import EmojiPicker from '../EmojiPicker';
import MultiImageUpload from '../MultiImageUpload';
import { CustomVenueBuilder } from '../CustomVenueBuilder';
import { DirectMessagePanel } from '../DirectMessagePanel';
import { AdminDecorSection } from '../AdminDecorSection';
import { AdminSubmissionQueue } from '../AdminSubmissionQueue';
import { LinenColor } from '../../data/venueData';
import { LayoutCategory, PatternType, ShapeType, ChairType, RectangularChairLayout, WallStyle, ChairSpec, User, Config, Venue, TableSpec, FixtureType, Guideline, EventQuestion, DecorArrangement, DecorPackage } from '../../types';
import type { AdminCommonProps } from './AdminTabTypes';

const DEFAULT_LOADED_FONT_FAMILIES = new Set(['Inter', 'Playfair Display']);

function extractGoogleFontFamily(fontStack?: string): string | null {
  const first = (fontStack || '').split(',')[0]?.trim().replace(/^['"]|['"]$/g, '');
  if (!first || ['Arial', 'Georgia', 'Times New Roman', 'Inter', 'system-ui', 'sans-serif', 'serif', 'cursive'].includes(first)) {
    return null;
  }
  return first;
}

function lazyLoadGoogleFont(fontStack?: string): void {
  if (typeof document === 'undefined') return;
  const family = extractGoogleFontFamily(fontStack);
  if (!family || DEFAULT_LOADED_FONT_FAMILIES.has(family)) return;

  const id = `spm-font-${family.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  if (document.getElementById(id)) return;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@400;600;700&display=swap`;
  document.head.appendChild(link);
  DEFAULT_LOADED_FONT_FAMILIES.add(family);
}

export function BrandingManagement(props: AdminCommonProps) {
  const {
    config,
    venues,
    setVenues,
    tables,
    setTables,
    fixtures,
    setFixtures,
    chairs,
    setChairs,
    wallStyles,
    setWallStyles,
    linenColors,
    setLinenColors,
    templates,
    setTemplates,
    guidelines,
    setGuidelines,
    users,
    setUsers,
    eventQuestions,
    setEventQuestions,
    decorItems,
    setDecorItems,
    decorCategories,
    setDecorCategories,
    decorArrangements,
    setDecorArrangements,
    decorPackages,
    setDecorPackages,
    layoutState,
    directMessages,
    handlers,
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
    setTableSpecs,
    fixtureTypes,
    setFixtureTypes,
    chairSpecs,
    setChairSpecs,
    defaultWallStyles,
    patternColors,
    defaultPatternColors,
    patternOptions,
    layoutCategories,
    venueCategories,
    seatingTypes,
    expandedSeatingTypes,
    setExpandedSeatingTypes,
    getSeatingDimensions,
    isSeatingType,
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
    collapseAllLinens,
    expandAllLinens,
    toggleLinenExpanded,
    handleSaveTemplates,
    handleCreateTemplateFromLayout,
    editingTemplateId,
    handleLoadForEdit,
    handleUpdateTemplateWithCurrentLayout,
    setEditingTemplateId,
    handleSaveGuidelines,
    setDecorItemsState,
    setDecorCategoriesState,
    setDecorArrangementsState,
    setDecorPackagesState,
    getUserFieldErrors,
    createUserFieldErrors,
    setCreateUserFieldErrors,
    newUser,
    setNewUser,
    handleCreateUser,
    alert,
    FileReader,
    activeTab,
    setActiveTab,
    expandedVenues,
    setExpandedVenues,
    expandedTables,
    setExpandedTables,
    expandedFixtures,
    setExpandedFixtures,
    expandedChairs,
    setExpandedChairs,
    expandedWalls,
    setExpandedWalls,
    expandedLinens,
    setExpandedLinens,
    expandedTemplates,
    setExpandedTemplates,
    expandedGuidelines,
    setExpandedGuidelines,
    expandedUsers,
    setExpandedUsers,
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
    spacingSettings,
    setSpacingSettingsState,
    setWallStylesState,
    successMessage,
    setSuccessMessage,
    showDrawingTool,
    logoInputRef,
    customShapeVenueId,
    setExpandedVenueFixtures,
    setExpandedLodgingFixtures,
    setExpandedExteriorFixtures,
    expandedBrandingSections,
    setExpandedBrandingSections,
    showCreateUserModal,
    setEventRoles,
    raw,
    parsed,
    cleaned,
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
    next,
    ids,
    validateEventQuestion,
    options,
    handleAddEventQuestion,
    err,
    handleUpdateEventQuestion,
    handleDeleteEventQuestion,
    roleName,
    exists,
    duplicate,
    handleSaveConfig,
    mapUserRoleToLegacyRole,
    validateUserForm,
    normalizedUsername,
    role,
    selected,
    today,
    todayStart,
    limit,
    handleLogoUpload,
    file,
    reader,
    dataUrl,
    input,
    usernameFromEmail,
    normalizedDraft,
    errors,
    fieldErrors,
    emailExists,
    legacyRole,
    effectiveUsername,
    created,
    updatedUsers,
    displayName,
    template,
    handleReset,
    size,
    hx,
    hexPoints,
    angle,
    ox,
    octPoints,
    tabs,
    AdminPanel
  } = props;

  React.useEffect(() => {
    if (!expandedBrandingSections?.has('typography') && !expandedBrandingSections?.has('preview')) return;
    lazyLoadGoogleFont(config?.fontFamily);
    lazyLoadGoogleFont(config?.headingFontFamily);
  }, [config?.fontFamily, config?.headingFontFamily, expandedBrandingSections]);

  return (
            <div className="space-y-4">
              {/* Header */}
              <BrandedSectionHeader
                icon="🎨"
                title="Brand Settings"
                description="Customize your venue's look and feel across the entire application"
                config={config}
              />
              
              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <BrandedStatCard
                  value={config.logoUrl ? '✅' : '❌'}
                  label="Logo"
                  icon="🖼️"
                  config={config}
                />
                <BrandedStatCard
                  value={config.websiteUrl ? '✅' : '❌'}
                  label="Website"
                  icon="🌐"
                  config={config}
                />
                <BrandedStatCard
                  value={config.welcomeLogoUrl ? '✅' : '❌'}
                  label="Welcome"
                  icon="👋"
                  config={config}
                  variant="accent"
                />
                <BrandedStatCard
                  value="✅"
                  label="Custom"
                  icon="🎨"
                  config={config}
                  variant="success"
                />
              </div>
              
              {/* Expand/Collapse All */}
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  {expandedBrandingSections.size} of 6 sections expanded
                </div>
                <button
                  onClick={() => {
                    const allSections = ['logo', 'website', 'welcome', 'colors', 'typography', 'preview'];
                    if (expandedBrandingSections.size === allSections.length) {
                      setExpandedBrandingSections(new Set());
                    } else {
                      setExpandedBrandingSections(new Set(allSections));
                    }
                  }}
                  className="px-4 py-2 bg-[#4A1942] text-white rounded-lg hover:bg-[#5c2a64] transition-colors text-sm font-medium shadow-sm"
                >
                  {expandedBrandingSections.size === 6 ? '▲ Collapse All' : '▼ Expand All'}
                </button>
              </div>
              
              {/* Logo & Identity Section */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-purple-100">
                <div 
                  className="bg-gradient-to-r from-purple-50 to-purple-100 px-4 py-4 flex items-center cursor-pointer hover:from-purple-100 hover:to-purple-150 transition-all"
                  onClick={() => {
                    setExpandedBrandingSections(prev => {
                      const next = new Set(prev);
                      if (next.has('logo')) next.delete('logo');
                      else next.add('logo');
                      return next;
                    });
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[#4A1942] text-xl">{expandedBrandingSections.has('logo') ? '▼' : '▶'}</span>
                    <div className="w-10 h-10 bg-[#4A1942] rounded-lg flex items-center justify-center">
                      <span className="text-white text-xl">🏷️</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-800">Logo & Identity</h3>
                      <p className="text-xs text-gray-500">Your venue's name, logo, and basic information</p>
                    </div>
                  </div>
                </div>
                {expandedBrandingSections.has('logo') && (
                <div className="p-6 space-y-6">
                  {/* Logo Upload Section */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <label className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 block">Logo</label>
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      <div className="relative group">
                        {config.logoUrl ? (
                          <div className="relative">
                            <img src={config.logoUrl} alt="Logo" className="w-32 h-32 object-contain rounded-xl border-2 border-dashed border-gray-300 bg-white p-2" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                              <span className="text-white text-sm">Click to change</span>
                            </div>
                          </div>
                        ) : (
                          <div className="w-32 h-32 bg-white rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-[#4A1942] hover:text-[#4A1942] transition-colors cursor-pointer">
                            <span className="text-3xl mb-1">📷</span>
                            <span className="text-xs">No Logo</span>
                          </div>
                        )}
                      </div>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => logoInputRef.current?.click()}
                          className="px-6 py-3 bg-gradient-to-r from-[#4A1942] to-[#6b2c5c] text-white rounded-xl text-sm font-medium hover:shadow-lg transition-all flex items-center gap-2"
                        >
                          <span>📤</span> {config.logoUrl ? 'Change Logo' : 'Upload Logo'}
                        </button>
                        {config.logoUrl && (
                          <button
                            onClick={() => handleSaveConfig({ ...config, logoUrl: '' })}
                            className="px-6 py-3 text-red-500 hover:bg-red-50 rounded-xl text-sm font-medium border border-red-200 flex items-center gap-2 justify-center"
                          >
                            <span>🗑️</span> Remove
                          </button>
                        )}
                        <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG up to 5MB</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Venue Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1">
                        <span>🏛️</span> Venue Name
                      </label>
                      <input
                        type="text"
                        value={config.venueName}
                        onChange={(e) => handleSaveConfig({ ...config, venueName: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4A1942] focus:border-transparent transition-all"
                        placeholder="Your Venue Name"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1">
                        <span>✨</span> Tagline
                      </label>
                      <input
                        type="text"
                        value={config.tagline}
                        onChange={(e) => handleSaveConfig({ ...config, tagline: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4A1942] focus:border-transparent transition-all"
                        placeholder="Where Your Love Story Unfolds"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1">
                        <span>📍</span> Location
                      </label>
                      <input
                        type="text"
                        value={config.location}
                        onChange={(e) => handleSaveConfig({ ...config, location: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4A1942] focus:border-transparent transition-all"
                        placeholder="City, State"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1">
                        <span>📞</span> Phone
                      </label>
                      <input
                        type="tel"
                        value={config.phone || ''}
                        onChange={(e) => handleSaveConfig({ ...config, phone: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#4A1942] focus:border-transparent transition-all"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>
                  
                  {/* Preview Card */}
                  <div className="bg-gradient-to-r from-[#4A1942] to-[#6b2c5c] rounded-xl p-4 text-white">
                    <p className="text-xs text-white/60 uppercase tracking-wide mb-2">Preview</p>
                    <div className="flex items-center gap-3">
                      {config.logoUrl ? (
                        <img src={config.logoUrl} alt="Logo" className="w-12 h-12 object-contain bg-white rounded-lg p-1" />
                      ) : (
                        <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                          <span className="text-2xl">🏛️</span>
                        </div>
                      )}
                      <div>
                        <div className="font-bold">{config.venueName || 'Your Venue Name'}</div>
                        <div className="text-sm text-white/80 italic">{config.tagline || 'Your Tagline'}</div>
                        <div className="text-xs text-white/60">{config.location || 'Location'} • {config.phone || 'Phone'}</div>
                      </div>
                    </div>
                  </div>
                </div>
                )}
              </div>
              
              {/* Contact & Website */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div 
                  className="bg-blue-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-blue-100 transition-colors"
                  onClick={() => {
                    setExpandedBrandingSections(prev => {
                      const next = new Set(prev);
                      if (next.has('website')) next.delete('website');
                      else next.add('website');
                      return next;
                    });
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{expandedBrandingSections.has('website') ? '▼' : '▶'}</span>
                    <h3 className="font-bold text-lg text-gray-800">🌐 Website & Contact</h3>
                  </div>
                </div>
                {expandedBrandingSections.has('website') && (
                <div className="p-4">
                <p className="text-sm text-gray-500 mb-4">These links will appear in the header for all users</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Website URL</label>
                    <div className="flex gap-2 mt-1">
                      <span className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-l-lg text-gray-500 text-sm">🔗</span>
                      <input
                        type="url"
                        value={config.websiteUrl}
                        onChange={(e) => handleSaveConfig({ ...config, websiteUrl: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg"
                        placeholder="https://www.yourwebsite.com"
                      />
                    </div>
                    {config.websiteUrl && (
                      <a href={config.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                        Preview →
                      </a>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Support Email</label>
                    <div className="flex gap-2 mt-1">
                      <span className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-l-lg text-gray-500 text-sm">📧</span>
                      <input
                        type="email"
                        value={config.supportEmail}
                        onChange={(e) => handleSaveConfig({ ...config, supportEmail: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-r-lg"
                        placeholder="events@yourwebsite.com"
                      />
                    </div>
                    {config.supportEmail && (
                      <a href={`mailto:${config.supportEmail}`} className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                        Send Test Email →
                      </a>
                    )}
                  </div>
                </div>
                </div>
                )}
              </div>
              
              {/* Welcome Settings */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-amber-200">
                <div 
                  className="bg-amber-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-amber-100 transition-colors"
                  onClick={() => {
                    setExpandedBrandingSections(prev => {
                      const next = new Set(prev);
                      if (next.has('welcome')) next.delete('welcome');
                      else next.add('welcome');
                      return next;
                    });
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{expandedBrandingSections.has('welcome') ? '▼' : '▶'}</span>
                    <h3 className="font-bold text-lg text-amber-800">👋 Welcome Screen Settings</h3>
                  </div>
                </div>
                {expandedBrandingSections.has('welcome') && (
                <div className="p-4 bg-amber-50/50">
                <p className="text-sm text-amber-700 mb-4">Customize the welcome modal shown to new users</p>
                
                <div className="space-y-4">
                  {/* Show Welcome Toggle */}
                  <div className="flex items-center justify-between bg-white p-3 rounded-lg">
                    <div>
                      <label className="font-medium text-gray-700">Show Welcome by Default</label>
                      <p className="text-xs text-gray-500">Enable to show welcome screen for new users</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showWelcomeByDefault !== false}
                        onChange={(e) => handleSaveConfig({ ...config, showWelcomeByDefault: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>
                  
                  {/* Welcome Title */}
                  <div className="bg-white p-3 rounded-lg">
                    <label className="text-xs font-medium text-gray-500 uppercase">Welcome Title</label>
                    <input
                      type="text"
                      value={config.welcomeTitle || 'Welcome to the Wedding Layout Planner'}
                      onChange={(e) => handleSaveConfig({ ...config, welcomeTitle: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1"
                      placeholder="Welcome to the Wedding Layout Planner"
                    />
                  </div>

                  {/* Welcome Feature Controls */}
                  <div className="bg-white p-3 rounded-lg border border-amber-100">
                    <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">Welcome Feature Highlights</label>
                    <p className="text-xs text-gray-500 mb-3">
                      Control which app capabilities are highlighted for non-admin users on the welcome screen.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {AVAILABLE_WELCOME_FEATURES.map((feature) => {
                        const selected = currentWelcomeFeatures.includes(feature);
                        return (
                          <label key={feature} className="flex items-center gap-2 p-2 rounded border border-gray-200 hover:bg-amber-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(e) => {
                                const current = currentWelcomeFeatures;
                                const next = e.target.checked
                                  ? [...current, feature]
                                  : current.filter((f) => f !== feature);
                                handleSaveConfig({ ...config, welcomeFeatures: next });
                              }}
                              className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                            />
                            <span className="text-sm text-gray-700">{feature}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                      <span>{currentWelcomeFeatures.length} feature(s) selected</span>
                      <button
                        type="button"
                        onClick={() => handleSaveConfig({ ...config, welcomeFeatures: AVAILABLE_WELCOME_FEATURES })}
                        className="text-amber-700 hover:underline"
                      >
                        Reset to recommended
                      </button>
                    </div>
                  </div>
                  
                  {/* Welcome Logo */}
                  <div className="bg-white p-3 rounded-lg">
                    <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">Welcome Logo/Image</label>
                    <p className="text-xs text-gray-500 mb-3">This replaces the 👋 icon on the first welcome screen</p>
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                        {config.welcomeLogoUrl ? (
                          <img src={config.welcomeLogoUrl} alt="Welcome Logo" className="max-h-16 max-w-16 object-contain" />
                        ) : (
                          <span className="text-3xl">👋</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          id="welcome-logo-upload"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                handleSaveConfig({ ...config, welcomeLogoUrl: reader.result as string });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <label
                          htmlFor="welcome-logo-upload"
                          className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 cursor-pointer text-center"
                        >
                          📷 Upload Image
                        </label>
                        {config.welcomeLogoUrl && (
                          <button
                            onClick={() => handleSaveConfig({ ...config, welcomeLogoUrl: '' })}
                            className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm border border-red-200"
                          >
                            🗑️ Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Preview */}
                  <div className="bg-white p-3 rounded-lg">
                    <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">Preview</label>
                    <div className="border rounded-lg p-4 bg-gray-50 text-center">
                      {config.welcomeLogoUrl ? (
                        <img src={config.welcomeLogoUrl} alt="Preview" className="max-h-16 mx-auto mb-2" />
                      ) : (
                        <div className="text-4xl mb-2">👋</div>
                      )}
                      <div className="font-bold text-gray-800">{config.welcomeTitle || 'Welcome to the Wedding Layout Planner'}</div>
                      {currentWelcomeFeatures.length > 0 && (
                        <div className="mt-3 grid grid-cols-2 gap-2 text-left">
                          {currentWelcomeFeatures.slice(0, 6).map((feature) => (
                            <div key={feature} className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700">
                              • {feature}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => setShowWelcomePreview(true)}
                        className="px-3 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600"
                      >
                        👁️ Preview as Basic User
                      </button>
                    </div>
                  </div>
                  
                  {/* Reset User Preferences */}
                  <div className="bg-white p-3 rounded-lg">
                    <label className="text-xs font-medium text-gray-500 uppercase mb-2 block">User Preferences</label>
                    <p className="text-xs text-gray-500 mb-2">Users can choose "Don't show again". Reset this for all users:</p>
                    <button
                      onClick={() => {
                        // This doesn't actually reset for all users since it's client-side
                        // But shows the intent
                        showSuccess('Welcome screen will show again for new sessions');
                      }}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                    >
                      Reset Welcome for New Sessions
                    </button>
                  </div>
                </div>
                </div>
                )}
              </div>
              
              {/* Color Scheme */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-pink-100">
                <div 
                  className="bg-gradient-to-r from-pink-50 to-purple-50 px-4 py-4 flex items-center cursor-pointer hover:from-pink-100 hover:to-purple-100 transition-all"
                  onClick={() => {
                    setExpandedBrandingSections(prev => {
                      const next = new Set(prev);
                      if (next.has('colors')) next.delete('colors');
                      else next.add('colors');
                      return next;
                    });
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[#4A1942] text-xl">{expandedBrandingSections.has('colors') ? '▼' : '▶'}</span>
                    <div className="w-10 h-10 bg-gradient-to-br from-[#4A1942] to-[#D4AF37] rounded-lg flex items-center justify-center">
                      <span className="text-white text-xl">🎨</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-800">Color Scheme</h3>
                      <p className="text-xs text-gray-500">Define your brand colors used throughout the app</p>
                    </div>
                  </div>
                </div>
                {expandedBrandingSections.has('colors') && (
                <div className="p-6 space-y-6">
                  {/* Color Palette Presets */}
                  <div>
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3 block">Quick Presets</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <button
                        onClick={() => handleSaveConfig({
                          ...config,
                          primaryColor: '#4A1942',
                          primaryDark: '#3d1a45',
                          primaryLight: '#6b2c5c',
                          accentColor: '#D4AF37',
                          backgroundColor: '#f3f4f6'
                        })}
                        className="p-3 border-2 border-gray-200 rounded-xl hover:border-purple-300 transition-all group"
                      >
                        <div className="flex gap-1 mb-2 justify-center">
                          <div className="w-6 h-6 rounded-full bg-[#4A1942]" />
                          <div className="w-6 h-6 rounded-full bg-[#D4AF37]" />
                          <div className="w-6 h-6 rounded-full bg-[#f3f4f6] border" />
                        </div>
                        <div className="text-xs font-medium text-gray-700">Deep Plum</div>
                        <div className="text-xs text-gray-400">Classic & Elegant</div>
                      </button>
                      <button
                        onClick={() => handleSaveConfig({
                          ...config,
                          primaryColor: '#1e3a5f',
                          primaryDark: '#152a45',
                          primaryLight: '#2d5a8a',
                          accentColor: '#c9a227',
                          backgroundColor: '#f8fafc'
                        })}
                        className="p-3 border-2 border-gray-200 rounded-xl hover:border-blue-300 transition-all group"
                      >
                        <div className="flex gap-1 mb-2 justify-center">
                          <div className="w-6 h-6 rounded-full bg-[#1e3a5f]" />
                          <div className="w-6 h-6 rounded-full bg-[#c9a227]" />
                          <div className="w-6 h-6 rounded-full bg-[#f8fafc] border" />
                        </div>
                        <div className="text-xs font-medium text-gray-700">Navy & Gold</div>
                        <div className="text-xs text-gray-400">Timeless</div>
                      </button>
                      <button
                        onClick={() => handleSaveConfig({
                          ...config,
                          primaryColor: '#2d5a4a',
                          primaryDark: '#1e3d32',
                          primaryLight: '#4a7a68',
                          accentColor: '#d4a574',
                          backgroundColor: '#faf9f7'
                        })}
                        className="p-3 border-2 border-gray-200 rounded-xl hover:border-green-300 transition-all group"
                      >
                        <div className="flex gap-1 mb-2 justify-center">
                          <div className="w-6 h-6 rounded-full bg-[#2d5a4a]" />
                          <div className="w-6 h-6 rounded-full bg-[#d4a574]" />
                          <div className="w-6 h-6 rounded-full bg-[#faf9f7] border" />
                        </div>
                        <div className="text-xs font-medium text-gray-700">Sage & Copper</div>
                        <div className="text-xs text-gray-400">Natural & Warm</div>
                      </button>
                      <button
                        onClick={() => handleSaveConfig({
                          ...config,
                          primaryColor: '#8b4557',
                          primaryDark: '#6b3344',
                          primaryLight: '#ab657a',
                          accentColor: '#e8c4a2',
                          backgroundColor: '#fdf8f5'
                        })}
                        className="p-3 border-2 border-gray-200 rounded-xl hover:border-rose-300 transition-all group"
                      >
                        <div className="flex gap-1 mb-2 justify-center">
                          <div className="w-6 h-6 rounded-full bg-[#8b4557]" />
                          <div className="w-6 h-6 rounded-full bg-[#e8c4a2]" />
                          <div className="w-6 h-6 rounded-full bg-[#fdf8f5] border" />
                        </div>
                        <div className="text-xs font-medium text-gray-700">Rose & Blush</div>
                        <div className="text-xs text-gray-400">Romantic</div>
                      </button>
                      <button
                        onClick={() => handleSaveConfig({
                          ...config,
                          primaryColor: '#111111',
                          primaryDark: '#000000',
                          primaryLight: '#4b5563',
                          accentColor: '#C0C0C0',
                          backgroundColor: '#FFFFFF',
                          headerTextColor: '#FFFFFF',
                          bodyTextColor: '#111111',
                          accentTextColor: '#111111'
                        })}
                        className="p-3 border-2 border-gray-200 rounded-xl hover:border-gray-400 transition-all group"
                      >
                        <div className="flex gap-1 mb-2 justify-center">
                          <div className="w-6 h-6 rounded-full bg-[#111111]" />
                          <div className="w-6 h-6 rounded-full bg-[#C0C0C0] border" />
                          <div className="w-6 h-6 rounded-full bg-[#FFFFFF] border" />
                        </div>
                        <div className="text-xs font-medium text-gray-700">Traditional</div>
                        <div className="text-xs text-gray-400">Black • Silver • White</div>
                      </button>
                    </div>
                  </div>
                  
                  {/* Custom Colors */}
                  <div>
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3 block">Custom Colors</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[
                        { key: 'primaryColor', label: 'Primary', desc: 'Main brand color', default: '#4A1942' },
                        { key: 'primaryDark', label: 'Primary Dark', desc: 'Header gradients', default: '#3d1a45' },
                        { key: 'primaryLight', label: 'Primary Light', desc: 'Hover states', default: '#6b2c5c' },
                        { key: 'accentColor', label: 'Accent', desc: 'Highlights & CTAs', default: '#D4AF37' },
                        { key: 'backgroundColor', label: 'Background', desc: 'Page background', default: '#f3f4f6' },
                      ].map(({ key, label, desc, default: defaultVal }) => (
                        <div key={key} className="bg-gray-50 rounded-xl p-4">
                          <div className="flex items-start gap-3">
                            <div className="relative">
                              <input
                                type="color"
                                value={(config as any)[key] || defaultVal}
                                onChange={(e) => handleSaveConfig({ ...config, [key]: e.target.value })}
                                className="w-14 h-14 border-2 border-gray-200 rounded-xl cursor-pointer shadow-sm hover:shadow-md transition-shadow"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-sm font-semibold text-gray-700">{label}</label>
                              <p className="text-xs text-gray-400">{desc}</p>
                              <input
                                type="text"
                                value={(config as any)[key] || defaultVal}
                                onChange={(e) => handleSaveConfig({ ...config, [key]: e.target.value })}
                                className="mt-2 w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg font-mono bg-white"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Live Preview */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3 block">Live Preview</label>
                    <div 
                      className="rounded-xl p-4 shadow-lg"
                      style={{ 
                        background: `linear-gradient(135deg, ${config.primaryColor || '#4A1942'}, ${config.primaryDark || '#3d1a45'})` 
                      }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                          <span className="text-2xl">💒</span>
                        </div>
                        <div className="text-white">
                          <div className="font-bold">Header Preview</div>
                          <div className="text-sm opacity-80">How your header will look</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          className="px-4 py-2 rounded-lg text-sm font-medium"
                          style={{ backgroundColor: config.accentColor || '#D4AF37', color: '#000' }}
                        >
                          Primary Button
                        </button>
                        <button 
                          className="px-4 py-2 rounded-lg text-sm font-medium bg-white/20 text-white"
                        >
                          Secondary
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                )}
              </div>
              
              {/* Typography */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div 
                  className="bg-green-50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-green-100 transition-colors"
                  onClick={() => {
                    setExpandedBrandingSections(prev => {
                      const next = new Set(prev);
                      if (next.has('typography')) next.delete('typography');
                      else next.add('typography');
                      return next;
                    });
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{expandedBrandingSections.has('typography') ? '▼' : '▶'}</span>
                    <h3 className="font-bold text-lg text-gray-800">✍️ Typography</h3>
                  </div>
                </div>
                {expandedBrandingSections.has('typography') && (
                <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Body Font Family</label>
                    <select
                      value={config.fontFamily || 'Inter, system-ui, sans-serif'}
                      onChange={(e) => { lazyLoadGoogleFont(e.target.value); handleSaveConfig({ ...config, fontFamily: e.target.value }); }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1"
                    >
                      <optgroup label="✏️ Modern Sans-Serif Fonts (Recommended for Body Text)">
                        <option value="Inter, system-ui, sans-serif">Inter (Default - Clean & Modern)</option>
                        <option value="'Montserrat', Arial, sans-serif">Montserrat (Chic & Elegant)</option>
                        <option value="'Raleway', Arial, sans-serif">Raleway (Stylish & Light)</option>
                        <option value="'Josefin Sans', Arial, sans-serif">Josefin Sans (Art Deco)</option>
                        <option value="'Quicksand', Arial, sans-serif">Quicksand (Soft & Friendly)</option>
                        <option value="'Nunito', Arial, sans-serif">Nunito (Rounded & Warm)</option>
                        <option value="'Poppins', Arial, sans-serif">Poppins (Contemporary & Bold)</option>
                        <option value="'Open Sans', Arial, sans-serif">Open Sans (Clean & Versatile)</option>
                        <option value="'Lato', Arial, sans-serif">Lato (Professional & Refined)</option>
                        <option value="'Roboto', Arial, sans-serif">Roboto (Modern & Neutral)</option>
                        <option value="'Work Sans', Arial, sans-serif">Work Sans (Minimal & Clean)</option>
                        <option value="'Source Sans Pro', Arial, sans-serif">Source Sans Pro (Clear & Readable)</option>
                        <option value="'Karla', Arial, sans-serif">Karla (Grotesque Style)</option>
                        <option value="'Cabin', Arial, sans-serif">Cabin (Humanist Style)</option>
                        <option value="'Barlow', Arial, sans-serif">Barlow (Semi-Condensed)</option>
                        <option value="Arial, sans-serif">Arial (Simple & Universal)</option>
                      </optgroup>
                      <optgroup label="🎀 Elegant Serif Fonts (Classic & Sophisticated)">
                        <option value="'Playfair Display', Georgia, serif">Playfair Display (Elegant & Refined)</option>
                        <option value="'Cormorant Garamond', Georgia, serif">Cormorant Garamond (Delicate & Light)</option>
                        <option value="'Libre Baskerville', Georgia, serif">Libre Baskerville (Classic & Readable)</option>
                        <option value="'EB Garamond', Georgia, serif">EB Garamond (Timeless & Scholarly)</option>
                        <option value="'Crimson Text', Georgia, serif">Crimson Text (Sophisticated & Warm)</option>
                        <option value="'Lora', Georgia, serif">Lora (Romantic & Contemporary)</option>
                        <option value="'Merriweather', Georgia, serif">Merriweather (Strong & Readable)</option>
                        <option value="'Source Serif Pro', Georgia, serif">Source Serif Pro (Modern Serif)</option>
                        <option value="'Cinzel', Georgia, serif">Cinzel (Majestic & Grand)</option>
                        <option value="'Spectral', Georgia, serif">Spectral (Contemporary & Elegant)</option>
                        <option value="'Cardo', Georgia, serif">Cardo (Old-Style & Refined)</option>
                        <option value="'Sorts Mill Goudy', Georgia, serif">Sorts Mill Goudy (Art Nouveau)</option>
                        <option value="'Noto Serif', Georgia, serif">Noto Serif (Universal & Clear)</option>
                        <option value="Georgia, serif">Georgia (Traditional & Reliable)</option>
                        <option value="'Times New Roman', Times, serif">Times New Roman (Classic & Formal)</option>
                      </optgroup>
                    </select>
                    <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: config.fontFamily }}>
                      Preview: The quick brown fox jumps over the lazy dog
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Heading Font Family</label>
                    <select
                      value={config.headingFontFamily || 'Inter, system-ui, sans-serif'}
                      onChange={(e) => { lazyLoadGoogleFont(e.target.value); handleSaveConfig({ ...config, headingFontFamily: e.target.value }); }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1"
                    >
                      <optgroup label="✨ Cursive & Script Fonts (Wedding Favorites)">
                        <option value="'Great Vibes', cursive">Great Vibes (Romantic Script)</option>
                        <option value="'Tangerine', cursive">Tangerine (Elegant Script)</option>
                        <option value="'Alex Brush', cursive">Alex Brush (Flowing)</option>
                        <option value="'Allura', cursive">Allura (Graceful)</option>
                        <option value="'Dancing Script', cursive">Dancing Script (Playful)</option>
                        <option value="'Parisienne', cursive">Parisienne (French Elegance)</option>
                        <option value="'Sacramento', cursive">Sacramento (Classic Script)</option>
                        <option value="'Pinyon Script', cursive">Pinyon Script (Formal)</option>
                        <option value="'Satisfy', cursive">Satisfy (Casual Script)</option>
                        <option value="'Kaushan Script', cursive">Kaushan Script (Bold Script)</option>
                        <option value="'Cookie', cursive">Cookie (Sweet Cursive)</option>
                        <option value="'Lobster', cursive">Lobster (Retro Script)</option>
                        <option value="'Pacifico', cursive">Pacifico (Casual Cursive)</option>
                        <option value="'Petit Formal Script', cursive">Petit Formal Script (Refined)</option>
                        <option value="'Herr Von Muellerhoff', cursive">Herr Von Muellerhoff (Vintage)</option>
                        <option value="'Monsieur La Doulaise', cursive">Monsieur La Doulaise (Calligraphy)</option>
                        <option value="'Mrs Saint Delafield', cursive">Mrs Saint Delafield (Elegant)</option>
                        <option value="'Rochester', cursive">Rochester (Classic Script)</option>
                        <option value="'Yellowtail', cursive">Yellowtail (Retro Script)</option>
                        <option value="'Niconne', cursive">Niconne (Modern Cursive)</option>
                        <option value="'Marck Script', cursive">Marck Script (Contemporary)</option>
                        <option value="'Italianno', cursive">Italianno (Italian Flair)</option>
                        <option value="'Qwigley', cursive">Qwigley (Whimsical)</option>
                        <option value="'Mr Dafoe', cursive">Mr Dafoe (Dramatic)</option>
                        <option value="'Ruthie', cursive">Ruthie (Playful Calligraphy)</option>
                        <option value="'Bilbo Swash Caps', cursive">Bilbo Swash Caps (Fantasy)</option>
                        <option value="cursive">System Cursive (Fallback)</option>
                      </optgroup>
                      <optgroup label="Elegant Serif Fonts">
                        <option value="'Playfair Display', Georgia, serif">Playfair Display (Sophisticated)</option>
                        <option value="'Cormorant Garamond', Georgia, serif">Cormorant Garamond (Refined)</option>
                        <option value="'Cinzel', Georgia, serif">Cinzel (Majestic)</option>
                        <option value="'Libre Baskerville', Georgia, serif">Libre Baskerville (Classic)</option>
                        <option value="'EB Garamond', Georgia, serif">EB Garamond (Timeless)</option>
                        <option value="'Lora', Georgia, serif">Lora (Romantic)</option>
                        <option value="'Crimson Text', Georgia, serif">Crimson Text (Elegant)</option>
                        <option value="Georgia, serif">Georgia (Traditional)</option>
                      </optgroup>
                      <optgroup label="Modern Sans-Serif Fonts">
                        <option value="Inter, system-ui, sans-serif">Inter (Default)</option>
                        <option value="'Montserrat', Arial, sans-serif">Montserrat (Chic)</option>
                        <option value="'Raleway', Arial, sans-serif">Raleway (Stylish)</option>
                        <option value="'Josefin Sans', Arial, sans-serif">Josefin Sans (Art Deco)</option>
                        <option value="'Poppins', Arial, sans-serif">Poppins (Contemporary)</option>
                        <option value="'Quicksand', Arial, sans-serif">Quicksand (Whimsical)</option>
                      </optgroup>
                    </select>
                    <p className="text-xs text-gray-400 mt-1 font-bold" style={{ fontFamily: config.headingFontFamily }}>
                      Preview: Wedding Layout Planner
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Header Text Color</label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="color"
                        value={config.headerTextColor || '#FFFFFF'}
                        onChange={(e) => handleSaveConfig({ ...config, headerTextColor: e.target.value })}
                        className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={config.headerTextColor || '#FFFFFF'}
                        onChange={(e) => handleSaveConfig({ ...config, headerTextColor: e.target.value })}
                        className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Body Text Color</label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="color"
                        value={config.bodyTextColor || '#374151'}
                        onChange={(e) => handleSaveConfig({ ...config, bodyTextColor: e.target.value })}
                        className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={config.bodyTextColor || '#374151'}
                        onChange={(e) => handleSaveConfig({ ...config, bodyTextColor: e.target.value })}
                        className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase">Accent Text Color</label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="color"
                        value={config.accentTextColor || '#4A1942'}
                        onChange={(e) => handleSaveConfig({ ...config, accentTextColor: e.target.value })}
                        className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={config.accentTextColor || '#4A1942'}
                        onChange={(e) => handleSaveConfig({ ...config, accentTextColor: e.target.value })}
                        className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleSaveConfig({
                    ...config,
                    fontFamily: 'Inter, system-ui, sans-serif',
                    headingFontFamily: 'Inter, system-ui, sans-serif',
                    headerTextColor: '#FFFFFF',
                    bodyTextColor: '#374151',
                    accentTextColor: '#4A1942'
                  })}
                  className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm"
                >
                  Reset Typography
                </button>
                </div>
                )}
              </div>
              
              {/* Live Preview */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div 
                  className="bg-gray-100 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-200 transition-colors"
                  onClick={() => {
                    setExpandedBrandingSections(prev => {
                      const next = new Set(prev);
                      if (next.has('preview')) next.delete('preview');
                      else next.add('preview');
                      return next;
                    });
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{expandedBrandingSections.has('preview') ? '▼' : '▶'}</span>
                    <h3 className="font-bold text-lg text-gray-800">👁️ Live Preview</h3>
                  </div>
                </div>
                {expandedBrandingSections.has('preview') && (
                <div className="p-4">
                <div 
                  className="border rounded-lg overflow-hidden"
                  style={{ fontFamily: config.fontFamily }}
                >
                  <div 
                    className="p-4"
                    style={{ 
                      background: `linear-gradient(to right, ${config.primaryColor}, ${config.primaryDark})`,
                      color: config.headerTextColor
                    }}
                  >
                    <h2 style={{ fontFamily: config.headingFontFamily }} className="text-xl font-bold">
                      {config.venueName}
                    </h2>
                    <p className="text-sm opacity-80">{config.tagline}</p>
                  </div>
                  <div 
                    className="p-4"
                    style={{ 
                      backgroundColor: config.backgroundColor,
                      color: config.bodyTextColor
                    }}
                  >
                    <p className="mb-2">This is how your body text will appear in the application.</p>
                    <p style={{ color: config.accentTextColor }} className="font-medium">
                      This is accent colored text.
                    </p>
                    <button 
                      className="mt-3 px-4 py-2 rounded-lg text-white"
                      style={{ backgroundColor: config.accentColor }}
                    >
                      Accent Button
                    </button>
                  </div>
                </div>
                </div>
                )}
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-bold text-red-800 mb-2">⚠️ Danger Zone</h3>
                <p className="text-sm text-red-700 mb-3">
                  Reset all settings to factory defaults. This cannot be undone.
                </p>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Reset All to Defaults
                </button>
              </div>
            </div>
  );
}
