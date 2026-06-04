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

export function FixtureManagement(props: AdminCommonProps) {
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

  return (
    <div className="space-y-4">
      <div className="space-y-4">
              {/* Header Section */}
              <BrandedSectionHeader 
                icon="🎪" 
                title="Fixtures & Features" 
                description="Interior venue items and exterior architectural/landscape features"
                config={config}
              />

              {/* Quick Statistics */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {fixtureTypes.filter(f => f.category !== 'exterior' && f.category !== 'lodging').length}
                  </div>
                  <div className="text-xs text-purple-700 font-medium">🏛️ Venue Fixtures</div>
                </div>
                <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-cyan-600">
                    {fixtureTypes.filter(f => f.category === 'lodging').length}
                  </div>
                  <div className="text-xs text-cyan-700 font-medium">🛏️ Lodging/Utilities</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {fixtureTypes.filter(f => f.category === 'exterior').length}
                  </div>
                  <div className="text-xs text-green-700 font-medium">🌳 Arch/Landscape</div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {fixtureTypes.filter(f => f.inventoryCount !== undefined).length}
                  </div>
                  <div className="text-xs text-blue-700 font-medium">📦 With Inventory</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-amber-600">
                    {fixtureTypes.filter(f => f.wallStyleId).length}
                  </div>
                  <div className="text-xs text-amber-700 font-medium">🧱 Wall-Linked</div>
                </div>
              </div>

              {/* Quick Add Presets */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                    <span>⚡</span> Quick Add Preset Fixtures
                  </h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {/* Venue Fixture Presets */}
                  <button
                    onClick={() => {
                      const presets: FixtureType[] = [
                        { id: `fix-${Date.now()}-1`, name: 'Dance Floor', shape: 'rectangle', width: 18, height: 18, icon: '💃', color: '#1a1a1a', category: 'interior', pattern: 'checkered' },
                        { id: `fix-${Date.now()}-2`, name: 'DJ Booth', shape: 'rectangle', width: 6, height: 4, icon: '🎧', color: '#374151', category: 'interior' },
                        { id: `fix-${Date.now()}-3`, name: 'Stage', shape: 'rectangle', width: 12, height: 8, icon: '🎤', color: '#78350f', category: 'interior', pattern: 'wood' },
                      ];
                      handleSaveFixtures([...fixtureTypes, ...presets]);
                    }}
                    className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium text-center"
                  >
                    🎉 Entertainment
                  </button>
                  <button
                    onClick={() => {
                      const presets: FixtureType[] = [
                        { id: `fix-${Date.now()}-1`, name: 'Sweetheart Table', shape: 'semicircle', width: 6, height: 3, icon: '💕', color: '#fdf2f8', category: 'interior' },
                        { id: `fix-${Date.now()}-2`, name: 'Head Table', shape: 'rectangle', width: 16, height: 3, icon: '👑', color: '#fef3c7', category: 'interior' },
                        { id: `fix-${Date.now()}-3`, name: 'Gift Table', shape: 'rectangle', width: 6, height: 3, icon: '🎁', color: '#f3e8ff', category: 'interior' },
                      ];
                      handleSaveFixtures([...fixtureTypes, ...presets]);
                    }}
                    className="px-3 py-2 bg-pink-100 text-pink-700 rounded-lg hover:bg-pink-200 transition-colors text-sm font-medium text-center"
                  >
                    💒 Wedding
                  </button>
                  <button
                    onClick={() => {
                      const presets: FixtureType[] = [
                        { id: `fix-${Date.now()}-1`, name: 'Buffet Station', shape: 'rectangle', width: 10, height: 3, icon: '🍽️', color: '#fef3c7', category: 'interior' },
                        { id: `fix-${Date.now()}-2`, name: 'Bar', shape: 'rectangle', width: 12, height: 4, icon: '🍸', color: '#422006', category: 'interior', pattern: 'wood' },
                        { id: `fix-${Date.now()}-3`, name: 'Cake Table', shape: 'circle', width: 4, height: 4, icon: '🎂', color: '#fce7f3', category: 'interior' },
                        { id: `fix-${Date.now()}-4`, name: 'Dessert Table', shape: 'rectangle', width: 8, height: 3, icon: '🧁', color: '#fed7aa', category: 'interior' },
                      ];
                      handleSaveFixtures([...fixtureTypes, ...presets]);
                    }}
                    className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors text-sm font-medium text-center"
                  >
                    🍰 Food & Drink
                  </button>
                  <button
                    onClick={() => {
                      const presets: FixtureType[] = [
                        { id: `fix-${Date.now()}-1`, name: 'Photo Booth', shape: 'rectangle', width: 8, height: 6, icon: '📸', color: '#e0e7ff', category: 'interior' },
                        { id: `fix-${Date.now()}-2`, name: 'Guest Book Station', shape: 'rectangle', width: 4, height: 2, icon: '📖', color: '#fef3c7', category: 'interior' },
                        { id: `fix-${Date.now()}-3`, name: 'Welcome Sign', shape: 'rectangle', width: 3, height: 4, icon: '✨', color: '#f3e8ff', category: 'interior' },
                      ];
                      handleSaveFixtures([...fixtureTypes, ...presets]);
                    }}
                    className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors text-sm font-medium text-center"
                  >
                    📸 Guest Areas
                  </button>
                  {/* Exterior Presets */}
                  <button
                    onClick={() => {
                      const presets: FixtureType[] = [
                        { id: `fix-${Date.now()}-1`, name: 'Fountain', shape: 'circle', width: 8, height: 8, icon: '⛲', color: '#bfdbfe', category: 'exterior', pattern: 'water' },
                        { id: `fix-${Date.now()}-2`, name: 'Garden Path', shape: 'rectangle', width: 20, height: 4, icon: '🪨', color: '#d6d3d1', category: 'exterior', pattern: 'gravel' },
                        { id: `fix-${Date.now()}-3`, name: 'Pond', shape: 'oval', width: 15, height: 10, icon: '🦆', color: '#7dd3fc', category: 'exterior', pattern: 'water' },
                      ];
                      handleSaveFixtures([...fixtureTypes, ...presets]);
                    }}
                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium text-center"
                  >
                    💧 Water Features
                  </button>
                  <button
                    onClick={() => {
                      const presets: FixtureType[] = [
                        { id: `fix-${Date.now()}-1`, name: 'Large Tree', shape: 'circle', width: 12, height: 12, icon: '🌳', color: '#166534', category: 'exterior' },
                        { id: `fix-${Date.now()}-2`, name: 'Flower Bed', shape: 'oval', width: 8, height: 4, icon: '🌸', color: '#f9a8d4', category: 'exterior', pattern: 'grass' },
                        { id: `fix-${Date.now()}-3`, name: 'Hedge Row', shape: 'rectangle', width: 20, height: 3, icon: '🌿', color: '#22c55e', category: 'exterior' },
                        { id: `fix-${Date.now()}-4`, name: 'Lawn Area', shape: 'rectangle', width: 30, height: 20, icon: '🌱', color: '#86efac', category: 'exterior', pattern: 'grass' },
                      ];
                      handleSaveFixtures([...fixtureTypes, ...presets]);
                    }}
                    className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium text-center"
                  >
                    🌿 Landscaping
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">
                    {fixtureTypes.length} total fixtures
                  </span>
                  <div className="flex gap-1">
                    {fixtureTypes.slice(0, 8).map(f => (
                      <span key={f.id} className="text-lg" title={f.name}>{f.icon}</span>
                    ))}
                    {fixtureTypes.length > 8 && <span className="text-xs text-gray-400 ml-1">+{fixtureTypes.length - 8}</span>}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      const newFixture: FixtureType = {
                        id: `fixture-${Date.now()}`,
                        name: 'New Venue Fixture',
                        shape: 'rectangle',
                        width: 4,
                        height: 4,
                        icon: '📦',
                        color: '#E5E5E5',
                        category: 'interior'
                      };
                      handleSaveFixtures([...fixtureTypes, newFixture]);
                    }}
                    className="px-4 py-2 bg-[#4A1942] text-white rounded-lg hover:bg-[#5c2a64] transition-colors font-medium shadow-sm"
                  >
                    + Venue
                  </button>
                  <button
                    onClick={() => {
                      const newFixture: FixtureType = {
                        id: `fixture-${Date.now()}`,
                        name: 'New Lodging/Utilities Fixture',
                        shape: 'rectangle',
                        width: 12,
                        height: 10,
                        icon: '🛏️',
                        color: '#E0F2FE',
                        category: 'lodging',
                        lodgingType: 'rooms',
                        isRoom: true,
                        capacity: 2,
                      };
                      handleSaveFixtures([...fixtureTypes, newFixture]);
                    }}
                    className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium shadow-sm"
                  >
                    + Lodging/Utilities
                  </button>
                  <button
                    onClick={() => {
                      const newFixture: FixtureType = {
                        id: `fixture-${Date.now()}`,
                        name: 'New Architectural/Landscape Feature',
                        shape: 'rectangle',
                        width: 10,
                        height: 10,
                        icon: '🌳',
                        color: '#90EE90',
                        category: 'exterior'
                      };
                      handleSaveFixtures([...fixtureTypes, newFixture]);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
                  >
                    + Architectural/Landscape
                  </button>
                  <button
                     onClick={() => {
                       setShowDrawingTool(true);
                     }}
                     className="px-4 py-2 bg-gradient-to-r from-[#4A1942] via-purple-600 to-cyan-600 text-white rounded-lg hover:opacity-90 transition-opacity font-medium shadow-sm flex items-center gap-2"
                   >
                     <span>🎨</span>
                     Draw Custom Feature
                   </button>
                </div>
              </div>
              
              {/* Venue Fixtures */}
              <div className="bg-white rounded-xl shadow-sm border border-purple-200 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-3 flex items-center justify-between cursor-pointer"
                  onClick={() => setShowVenueFixturesSection(v => !v)}>
                  <div className="flex items-center gap-3 text-white">
                    <span className="text-lg">{showVenueFixturesSection ? '▼' : '▶'}</span>
                    <span className="text-2xl">🏛️</span>
                    <div>
                      <h4 className="font-bold">Venue Fixtures</h4>
                      <p className="text-xs text-purple-100">Interior items for your venue layout</p>
                    </div>
                    <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                      {fixtureTypes.filter(f => f.category !== 'exterior' && f.category !== 'lodging').length} items
                    </span>
                  </div>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={expandAllVenueFixtures}
                      className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white font-medium transition-colors"
                    >
                      ▼ Expand All
                    </button>
                    <button
                      onClick={collapseAllVenueFixtures}
                      className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white font-medium transition-colors"
                    >
                      ▲ Collapse All
                    </button>
                  </div>
                </div>
                {showVenueFixturesSection && (
                <div className="p-4 bg-purple-50/50">
                {fixtureTypes.filter(f => f.category !== 'exterior' && f.category !== 'lodging').map(fixture => (
                  <div key={fixture.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-3">
                    <div 
                      className="bg-purple-50 px-4 py-3 border-b border-purple-200 flex items-center justify-between cursor-pointer hover:bg-purple-100 transition-colors"
                      onClick={() => toggleVenueFixtureExpanded(fixture.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{expandedVenueFixtures.has(fixture.id) ? '▼' : '▶'}</span>
                        {/* Shape Preview */}
                        <svg width="32" height="32" className="flex-shrink-0">
                          {renderShapePreview(fixture.shape || 'rectangle', fixture.color || '#E5E5E5')}
                        </svg>
                        <span className="text-2xl">{fixture.icon}</span>
                        <span className="font-semibold text-purple-800">{fixture.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                          {fixture.width}' × {fixture.height}'
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmAction(
                              { title: 'Delete fixture?', message: `Delete fixture "${fixture.name}"?`, kind: 'danger', confirmLabel: 'Delete Fixture' },
                              () => handleSaveFixtures(fixtureTypes.filter(f => f.id !== fixture.id)),
                            );
                          }}
                          className="text-red-500 hover:text-red-700 text-sm px-2"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    {expandedVenueFixtures.has(fixture.id) && (
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Name</label>
                          <input
                            type="text"
                            value={fixture.name}
                            onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, name: e.target.value } : f))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Shape</label>
                          <select
                            value={fixture.shape || 'rectangle'}
                            onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, shape: e.target.value as ShapeType } : f))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          >
                            {shapeOptions.map(s => (
                              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                        {/* Icon and Icon Visible - separate row for better spacing */}
                        <div className="col-span-2 sm:col-span-4 grid grid-cols-2 gap-4 bg-purple-50 p-3 rounded-lg border border-purple-200">
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Icon</label>
                            <EmojiPicker
                              value={fixture.icon || '📦'}
                              onChange={(emoji) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, icon: emoji } : f))}
                              position="bottom"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Icon Visible</label>
                            <div className="flex items-center h-[42px] bg-white rounded-lg border border-gray-200 px-3">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={fixture.showIconOnCanvas !== false}
                                  onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, showIconOnCanvas: e.target.checked } : f))}
                                  className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-sm text-gray-700">On Layout</span>
                              </label>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Width (ft)</label>
                          <input
                            type="number"
                            value={fixture.width}
                            onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, width: parseFloat(e.target.value) || 4 } : f))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Height (ft)</label>
                          <input
                            type="number"
                            value={fixture.height}
                            onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, height: parseFloat(e.target.value) || 4 } : f))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Fill Color</label>
                          <div className="flex gap-1">
                            <input
                              type="color"
                              value={fixture.color || '#E5E5E5'}
                              onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, color: e.target.value } : f))}
                              className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Font Color</label>
                          <div className="flex gap-1">
                            <input
                              type="color"
                              value={fixture.fontColor || '#374151'}
                              onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, fontColor: e.target.value } : f))}
                              className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Pattern</label>
                          <select
                            value={fixture.pattern || 'solid'}
                            onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, pattern: e.target.value as PatternType, patternColors: defaultPatternColors[e.target.value as PatternType] } : f))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          >
                            {patternOptions.map(p => (
                              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {/* Pattern Colors for Venue Fixtures */}
                      {fixture.pattern && fixture.pattern !== 'solid' && (
                        <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-amber-800">🎨 Pattern Colors</span>
                          </div>
                          <PatternColorPicker
                            pattern={fixture.pattern}
                            patternColors={fixture.patternColors}
                            onChange={(colors) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, patternColors: colors } : f))}
                          />
                        </div>
                      )}
                      {/* Border Settings */}
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-blue-800">🔲 Border Settings</span>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={fixture.showBorder || false}
                              onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { 
                                ...f, 
                                showBorder: e.target.checked,
                                borderColor: e.target.checked ? (f.borderColor || '#000000') : f.borderColor,
                                borderWidth: e.target.checked ? (f.borderWidth || 2) : f.borderWidth
                              } : f))}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-blue-700">Show Border</span>
                          </label>
                        </div>
                        {fixture.showBorder && (
                          <div className="grid grid-cols-2 gap-3 mt-2">
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase">Border Color</label>
                              <div className="flex gap-1">
                                <input
                                  type="color"
                                  value={fixture.borderColor || '#000000'}
                                  onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, borderColor: e.target.value } : f))}
                                  className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
                                />
                                <input
                                  type="text"
                                  value={fixture.borderColor || '#000000'}
                                  onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, borderColor: e.target.value } : f))}
                                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase">Border Width (px)</label>
                              <input
                                type="number"
                                min="1"
                                max="10"
                                step="0.5"
                                value={fixture.borderWidth || 2}
                                onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, borderWidth: parseFloat(e.target.value) || 2 } : f))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Venue Category Availability - Venue Fixtures */}
                      <div className="mt-3 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                        <h4 className="text-sm font-semibold text-indigo-800 mb-2 flex items-center gap-2">
                          🏛️ Venue Category Availability
                        </h4>
                        <p className="text-xs text-indigo-600 mb-3">Choose which venue categories can use this venue fixture. Leave all unchecked to allow in all categories.</p>
                        <div className="flex flex-wrap gap-2">
                          {layoutCategories.map(cat => {
                            const selected = (fixture.venueCategories || []).includes(cat.id as any);
                            return (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => {
                                  const current = fixture.venueCategories || [];
                                  const venueCategories = selected
                                    ? current.filter(c => c !== cat.id)
                                    : [...current, cat.id as any];
                                  handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, venueCategories } : f));
                                }}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selected ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50'}`}
                              >
                                {cat.icon} {cat.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Inventory / Availability / Spacing - Venue Fixtures */}
                      <div className="mt-3 grid md:grid-cols-2 gap-3">
                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-green-800">📦 Inventory</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                value={fixture.inventoryCount ?? ''}
                                onChange={(e) => {
                                  const value = e.target.value === '' ? undefined : parseInt(e.target.value);
                                  handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, inventoryCount: value } : f));
                                }}
                                className="w-20 px-2 py-1 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-center"
                                placeholder="∞"
                              />
                              <span className="text-sm text-green-600">
                                {fixture.inventoryCount === undefined ? 'Unlimited' : `${fixture.inventoryCount} available`}
                              </span>
                              {fixture.inventoryCount !== undefined && (
                                <button
                                  onClick={() => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, inventoryCount: undefined } : f))}
                                  className="text-xs text-green-600 hover:text-green-800 underline"
                                >
                                  Unlimited
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="p-3 bg-violet-50 rounded-lg border border-violet-200 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-violet-800">👥 User Availability</span>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={fixture.visibleToUsers !== false}
                                onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, visibleToUsers: e.target.checked } : f))}
                                className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                              />
                              <span className="text-sm text-violet-700 font-medium">Visible to Basic/Guest users</span>
                            </label>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-violet-800">📏 Spacing Rules</span>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={fixture.ignoreSpacingRules || false}
                                onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, ignoreSpacingRules: e.target.checked } : f))}
                                className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                              />
                              <span className="text-sm text-violet-700 font-medium">Ignore spacing guidelines</span>
                            </label>
                          </div>
                          <p className="text-xs text-violet-600">Enable this for venue fixtures that should be placeable anywhere on the full canvas.</p>
                          <div className="flex items-center justify-between gap-3 pt-2 border-t border-violet-100">
                            <span className="text-sm font-semibold text-violet-800">🎀 Decor Designer</span>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!fixture.allowAsDecorBase}
                                onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, allowAsDecorBase: e.target.checked } : f))}
                                className="w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                              />
                              <span className="text-sm text-violet-700 font-medium">Available in Decor Designer</span>
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Fixture Image Gallery (up to 4 images) */}
                      <MultiImageUpload
                        images={fixture.images || []}
                        onChange={(images) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, images } : f))}
                        maxImages={4}
                        itemName="fixture"
                      />

                      {/* Delete button */}
                      <div className="flex justify-end pt-3 border-t border-gray-100">
                        <button
                          onClick={() => handleSaveFixtures(fixtureTypes.filter(f => f.id !== fixture.id))}
                          className="px-3 py-1 text-red-500 hover:bg-red-50 rounded text-sm"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                    )}
                  </div>
                ))}
                </div>
                )}
              </div>

              {/* Lodging/Utilities Fixtures */}
              <div className="bg-white rounded-xl shadow-sm border border-cyan-200 overflow-hidden">
                <div className="bg-gradient-to-r from-cyan-500 to-sky-600 px-4 py-3 flex items-center justify-between cursor-pointer"
                  onClick={() => setShowLodgingFixturesSection(v => !v)}>
                  <div className="flex items-center gap-3 text-white">
                    <span className="text-lg">{showLodgingFixturesSection ? '▼' : '▶'}</span>
                    <span className="text-2xl">🛏️</span>
                    <div>
                      <h4 className="font-bold">Lodging/Utilities Fixtures</h4>
                      <p className="text-xs text-cyan-100">Rooms, furniture, appliances, and utilities for lodging venues (Admin Only)</p>
                    </div>
                    <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                      {fixtureTypes.filter(f => f.category === 'lodging').length} items
                    </span>
                  </div>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={expandAllLodgingFixtures}
                      className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white font-medium transition-colors"
                    >
                      ▼ Expand All
                    </button>
                    <button
                      onClick={collapseAllLodgingFixtures}
                      className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white font-medium transition-colors"
                    >
                      ▲ Collapse All
                    </button>
                  </div>
                </div>
                {showLodgingFixturesSection && (
                <div className="p-4 bg-cyan-50/50">
                  {fixtureTypes.filter(f => f.category === 'lodging').map(fixture => (
                    <div key={fixture.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-3">
                      <div
                        className="bg-cyan-50 px-4 py-3 border-b border-cyan-200 flex items-center justify-between cursor-pointer hover:bg-cyan-100 transition-colors"
                        onClick={() => toggleLodgingFixtureExpanded(fixture.id)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{expandedLodgingFixtures.has(fixture.id) ? '▼' : '▶'}</span>
                          <svg width="32" height="32" className="flex-shrink-0">
                            {renderShapePreview(fixture.shape || 'rectangle', fixture.color || '#E0F2FE')}
                          </svg>
                          <span className="text-2xl">{fixture.icon || '🛏️'}</span>
                          <span className="font-semibold text-cyan-800">{fixture.name}</span>
                          <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-1 rounded">{(fixture.lodgingType || 'other').replace('entry-exit', 'entry/exit').replace(/^./, c => c.toUpperCase())}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-1 rounded">{fixture.width}' × {fixture.height}'</span>
                          {fixture.lodgingType === 'rooms' && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">Max {fixture.capacity || 0}</span>}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmAction(
                                { title: 'Delete lodging/utility fixture?', message: `Delete lodging/utility fixture "${fixture.name}"?`, kind: 'danger', confirmLabel: 'Delete Fixture' },
                                () => handleSaveFixtures(fixtureTypes.filter(f => f.id !== fixture.id)),
                              );
                            }}
                            className="text-red-500 hover:text-red-700 text-sm px-2"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      {expandedLodgingFixtures.has(fixture.id) && (
                        <div className="p-4 space-y-3">
                          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase">Name</label>
                              <input
                                type="text"
                                value={fixture.name}
                                onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, name: e.target.value } : f))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase">Shape</label>
                              <select
                                value={fixture.shape || 'rectangle'}
                                onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, shape: e.target.value as ShapeType } : f))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              >
                                {shapeOptions.map(s => (
                                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                                ))}
                              </select>
                            </div>
                            <div className="col-span-2 sm:col-span-4 grid grid-cols-2 gap-4 bg-cyan-50 p-3 rounded-lg border border-cyan-200">
                              <div>
                                <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Icon</label>
                                <EmojiPicker
                                  value={fixture.icon || '🛏️'}
                                  onChange={(emoji) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, icon: emoji } : f))}
                                  position="bottom"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Icon Visible</label>
                                <div className="flex items-center h-[42px] bg-white rounded-lg border border-gray-200 px-3">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={fixture.showIconOnCanvas !== false}
                                      onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, showIconOnCanvas: e.target.checked } : f))}
                                      className="w-5 h-5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                                    />
                                    <span className="text-sm text-gray-700">On Layout</span>
                                  </label>
                                </div>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase">Width (ft)</label>
                              <input
                                type="number"
                                value={fixture.width}
                                onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, width: parseFloat(e.target.value) || 12 } : f))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase">Height (ft)</label>
                              <input
                                type="number"
                                value={fixture.height}
                                onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, height: parseFloat(e.target.value) || 10 } : f))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase">Fill Color</label>
                              <div className="flex gap-1">
                                <input
                                  type="color"
                                  value={fixture.color || '#E0F2FE'}
                                  onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, color: e.target.value } : f))}
                                  className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase">Font Color</label>
                              <div className="flex gap-1">
                                <input
                                  type="color"
                                  value={fixture.fontColor || '#1F2937'}
                                  onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, fontColor: e.target.value } : f))}
                                  className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase">Pattern</label>
                              <select
                                value={fixture.pattern || 'solid'}
                                onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, pattern: e.target.value as PatternType, patternColors: defaultPatternColors[e.target.value as PatternType] } : f))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              >
                                {patternOptions.map(p => (
                                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                              <label className="text-xs font-medium text-gray-500 uppercase block mb-1">Type</label>
                              <select
                                value={fixture.lodgingType || 'other'}
                                onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? {
                                  ...f,
                                  lodgingType: e.target.value as FixtureType['lodgingType'],
                                  isRoom: e.target.value === 'rooms',
                                  capacity: e.target.value === 'rooms' ? (f.capacity || 2) : undefined,
                                  inventoryCount: e.target.value === 'rooms' ? undefined : f.inventoryCount
                                } : f))}
                                className="w-full px-3 py-2 border border-indigo-300 rounded-lg"
                              >
                                <option value="furniture">Furniture</option>
                                <option value="appliances">Appliances</option>
                                <option value="electronics">Electronics</option>
                                <option value="entry-exit">Entry/Exit Points</option>
                                <option value="utilities">Utilities</option>
                                <option value="rooms">Rooms</option>
                                <option value="other">Other</option>
                              </select>
                              <p className="text-xs text-indigo-700 mt-2">Classify this lodging/utility item for easier organization and room behavior.</p>
                            </div>
                            {fixture.lodgingType === 'rooms' ? (
                              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                                <label className="text-xs font-medium text-gray-500 uppercase block mb-1">Max Occupancy</label>
                                <input
                                  type="number"
                                  min="1"
                                  max="20"
                                  value={fixture.capacity || 2}
                                  onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, isRoom: true, lodgingType: 'rooms', capacity: Math.max(1, parseInt(e.target.value) || 1) } : f))}
                                  className="w-full px-3 py-2 border border-emerald-300 rounded-lg"
                                />
                                <p className="text-xs text-emerald-700 mt-2">Room-type items can hold guest assignments like tables.</p>
                              </div>
                            ) : (
                              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="text-sm font-semibold text-slate-700">Guest Assignment</div>
                                <p className="text-xs text-slate-600 mt-2">Set Type to <strong>Rooms</strong> to enable occupancy and guest assignment for this item.</p>
                              </div>
                            )}
                          </div>

                          {fixture.pattern && fixture.pattern !== 'solid' && (
                            <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-amber-800">🎨 Pattern Colors</span>
                              </div>
                              <PatternColorPicker
                                pattern={fixture.pattern}
                                patternColors={fixture.patternColors}
                                onChange={(colors) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, patternColors: colors } : f))}
                              />
                            </div>
                          )}

                          <MultiImageUpload
                            images={fixture.images || []}
                            onChange={(images) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, images } : f))}
                            maxImages={4}
                            itemName="lodging/utilities fixture"
                          />

                          <div className="flex justify-end pt-3 border-t border-gray-100">
                            <button
                              onClick={() => handleSaveFixtures(fixtureTypes.filter(f => f.id !== fixture.id))}
                              className="px-3 py-1 text-red-500 hover:bg-red-50 rounded text-sm"
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                )}
              </div>
              
              {/* Exterior Fixtures */}
              <div className="bg-white rounded-xl shadow-sm border border-green-200 overflow-hidden">
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-3 flex items-center justify-between cursor-pointer"
                  onClick={() => setShowExteriorFixturesSection(v => !v)}>
                  <div className="flex items-center gap-3 text-white">
                    <span className="text-lg">{showExteriorFixturesSection ? '▼' : '▶'}</span>
                    <span className="text-2xl">🌳</span>
                    <div>
                      <h4 className="font-bold">Architectural/Landscape Features</h4>
                      <p className="text-xs text-green-100">Exterior features (Admin Only)</p>
                    </div>
                    <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                      {fixtureTypes.filter(f => f.category === 'exterior').length} items
                    </span>
                  </div>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={expandAllExteriorFixtures}
                      className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white font-medium transition-colors"
                    >
                      ▼ Expand All
                    </button>
                    <button
                      onClick={collapseAllExteriorFixtures}
                      className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white font-medium transition-colors"
                    >
                      ▲ Collapse All
                    </button>
                  </div>
                </div>
                {showExteriorFixturesSection && (
                <div className="p-4 bg-green-50/50">
                {fixtureTypes.filter(f => f.category === 'exterior').map(fixture => (
                  <div key={fixture.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-3">
                    <div 
                      className="bg-green-50 px-4 py-3 border-b border-green-200 flex items-center justify-between cursor-pointer hover:bg-green-100 transition-colors"
                      onClick={() => toggleExteriorFixtureExpanded(fixture.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{expandedExteriorFixtures.has(fixture.id) ? '▼' : '▶'}</span>
                        {/* Shape Preview */}
                        <svg width="32" height="32" className="flex-shrink-0">
                          {renderShapePreview(fixture.shape || 'rectangle', fixture.color || '#90EE90')}
                        </svg>
                        <span className="text-2xl">{fixture.icon}</span>
                        <span className="font-semibold text-green-800">{fixture.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                          {fixture.width}' × {fixture.height}'
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmAction(
                              { title: 'Delete feature?', message: `Delete feature "${fixture.name}"?`, kind: 'danger', confirmLabel: 'Delete Feature' },
                              () => handleSaveFixtures(fixtureTypes.filter(f => f.id !== fixture.id)),
                            );
                          }}
                          className="text-red-500 hover:text-red-700 text-sm px-2"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    {expandedExteriorFixtures.has(fixture.id) && (
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Name</label>
                          <input
                            type="text"
                            value={fixture.name}
                            onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, name: e.target.value } : f))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Shape</label>
                          <select
                            value={fixture.shape || 'rectangle'}
                            onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, shape: e.target.value as ShapeType } : f))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          >
                            {shapeOptions.map(s => (
                              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                        {/* Icon and Icon Visible - separate row for better spacing */}
                        <div className="col-span-2 sm:col-span-4 grid grid-cols-2 gap-4 bg-green-50 p-3 rounded-lg border border-green-200">
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Icon</label>
                            <EmojiPicker
                              value={fixture.icon || '🌳'}
                              onChange={(emoji) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, icon: emoji } : f))}
                              position="bottom"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">Icon Visible</label>
                            <div className="flex items-center h-[42px] bg-white rounded-lg border border-gray-200 px-3">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={fixture.showIconOnCanvas !== false}
                                  onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, showIconOnCanvas: e.target.checked } : f))}
                                  className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                />
                                <span className="text-sm text-gray-700">On Layout</span>
                              </label>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Width (ft)</label>
                          <input
                            type="number"
                            value={fixture.width}
                            onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, width: parseFloat(e.target.value) || 10 } : f))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Height (ft)</label>
                          <input
                            type="number"
                            value={fixture.height}
                            onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, height: parseFloat(e.target.value) || 10 } : f))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Fill Color</label>
                          <div className="flex gap-1">
                            <input
                              type="color"
                              value={fixture.color || '#90EE90'}
                              onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, color: e.target.value } : f))}
                              className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Font Color</label>
                          <div className="flex gap-1">
                            <input
                              type="color"
                              value={fixture.fontColor || '#374151'}
                              onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, fontColor: e.target.value } : f))}
                              className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Pattern</label>
                          <select
                            value={fixture.pattern || 'solid'}
                            onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, pattern: e.target.value as PatternType, patternColors: defaultPatternColors[e.target.value as PatternType] } : f))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          >
                            {patternOptions.map(p => (
                              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {/* Pattern Colors for Exterior Fixtures */}
                      {fixture.pattern && fixture.pattern !== 'solid' && (
                        <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-amber-800">🎨 Pattern Colors</span>
                          </div>
                          <PatternColorPicker
                            pattern={fixture.pattern}
                            patternColors={fixture.patternColors}
                            onChange={(colors) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, patternColors: colors } : f))}
                          />
                        </div>
                      )}
                      {/* Border Settings */}
                      <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-green-800">🔲 Border Settings</span>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={fixture.showBorder || false}
                              onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { 
                                ...f, 
                                showBorder: e.target.checked,
                                borderColor: e.target.checked ? (f.borderColor || '#000000') : f.borderColor,
                                borderWidth: e.target.checked ? (f.borderWidth || 2) : f.borderWidth
                              } : f))}
                              className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                            />
                            <span className="text-sm font-medium text-green-700">Show Border</span>
                          </label>
                        </div>
                        {fixture.showBorder && (
                          <div className="grid grid-cols-2 gap-3 mt-2">
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase">Border Color</label>
                              <div className="flex gap-1">
                                <input
                                  type="color"
                                  value={fixture.borderColor || '#000000'}
                                  onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, borderColor: e.target.value } : f))}
                                  className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
                                />
                                <input
                                  type="text"
                                  value={fixture.borderColor || '#000000'}
                                  onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, borderColor: e.target.value } : f))}
                                  className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase">Border Width (px)</label>
                              <input
                                type="number"
                                min="1"
                                max="10"
                                step="0.5"
                                value={fixture.borderWidth || 2}
                                onChange={(e) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, borderWidth: parseFloat(e.target.value) || 2 } : f))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Fixture Image Gallery (up to 4 images) */}
                      <MultiImageUpload
                        images={fixture.images || []}
                        onChange={(images) => handleSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, images } : f))}
                        maxImages={4}
                        itemName="feature"
                      />

                      {/* Delete button */}
                      <div className="flex justify-end pt-3 border-t border-gray-100">
                        <button
                          onClick={() => handleSaveFixtures(fixtureTypes.filter(f => f.id !== fixture.id))}
                          className="px-3 py-1 text-red-500 hover:bg-red-50 rounded text-sm"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                    )}
                  </div>
                ))}
                </div>
                )}
              </div>
            </div>
    </div>
  );
}
