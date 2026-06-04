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

export function VenueManagement(props: AdminCommonProps) {
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
                icon="🏛️" 
                title="Venue Layouts" 
                description="Create and manage venue spaces for receptions, ceremonies, and events"
                config={config}
              />

              {/* Quick Statistics */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <BrandedStatCard icon="🏛️" label="Total Venues" value={venues.length} config={config} variant="primary" />
                <BrandedStatCard icon="★" label="Master" value={venues.filter(v => v.isMaster).length} config={config} variant="warning" />
                <BrandedStatCard icon="📐" label="With Layouts" value={venues.filter(v => v.masterLayout).length} config={config} variant="success" />
                <BrandedStatCard icon="👥" label="Total Capacity" value={venues.reduce((sum, v) => sum + (v.capacity || 0), 0)} config={config} variant="accent" />
                <div 
                  className="p-3 rounded-xl text-center border"
                  style={{ backgroundColor: `${config.primaryLight}15`, borderColor: `${config.primaryLight}30` }}
                >
                  <div className="flex justify-center gap-1 mb-1">
                    {layoutCategories.slice(0, 4).map(cat => (
                      <span key={cat.id} title={cat.name} className="text-lg">{cat.icon}</span>
                    ))}
                  </div>
                  <div className="text-xs" style={{ color: config.primaryColor }}>Categories</div>
                </div>
              </div>

              {/* Quick Add Venue Presets */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-semibold text-purple-800 text-sm mb-3 flex items-center gap-2">
                  ✨ Quick Add Venue Presets
                </h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const preset: Venue = {
                        id: `venue-${Date.now()}`,
                        name: 'Reception Venue',
                        width: 60,
                        height: 40,
                        capacity: 150,
                        category: 'reception',
                        color: '#F5F0E8',
                        borderColor: '#4A1942',
                        pattern: 'wood',
                        isMaster: true,
                        canvasWidth: 140,
                        canvasHeight: 120,
                        venueX: 40,
                        venueY: 40,
                        exteriorPadding: { top: 40, right: 40, bottom: 40, left: 40 }
                      };
                      handleSaveVenues([...venues, preset]);
                    }}
                    className="px-3 py-2 bg-white border border-purple-300 rounded-lg text-sm hover:bg-purple-50 hover:border-purple-400 transition-all flex items-center gap-2 shadow-sm"
                  >
                    🎉 Reception
                  </button>
                  <button
                    onClick={() => {
                      const preset: Venue = {
                        id: `venue-${Date.now()}`,
                        name: 'Cocktail Hour Venue',
                        width: 40,
                        height: 30,
                        capacity: 75,
                        category: 'cocktail',
                        color: '#E8E0D0',
                        borderColor: '#8B7355',
                        pattern: 'concrete',
                        isMaster: true,
                        canvasWidth: 100,
                        canvasHeight: 90,
                        venueX: 30,
                        venueY: 30,
                        exteriorPadding: { top: 30, right: 30, bottom: 30, left: 30 }
                      };
                      handleSaveVenues([...venues, preset]);
                    }}
                    className="px-3 py-2 bg-white border border-amber-300 rounded-lg text-sm hover:bg-amber-50 hover:border-amber-400 transition-all flex items-center gap-2 shadow-sm"
                  >
                    🍸 Cocktail Hour
                  </button>
                  <button
                    onClick={() => {
                      const preset: Venue = {
                        id: `venue-${Date.now()}`,
                        name: 'Ceremony Venue',
                        width: 80,
                        height: 60,
                        capacity: 200,
                        category: 'ceremony',
                        color: '#90EE90',
                        borderColor: '#228B22',
                        pattern: 'grass',
                        isMaster: true,
                        canvasWidth: 160,
                        canvasHeight: 140,
                        venueX: 40,
                        venueY: 40,
                        exteriorPadding: { top: 40, right: 40, bottom: 40, left: 40 }
                      };
                      handleSaveVenues([...venues, preset]);
                    }}
                    className="px-3 py-2 bg-white border border-green-300 rounded-lg text-sm hover:bg-green-50 hover:border-green-400 transition-all flex items-center gap-2 shadow-sm"
                  >
                    💒 Ceremony
                  </button>
                  <button
                    onClick={() => {
                      const preset: Venue = {
                        id: `venue-${Date.now()}`,
                        name: 'Lodging Venue',
                        width: 40,
                        height: 30,
                        capacity: 20,
                        category: 'lodging',
                        color: '#FFF8DC',
                        borderColor: '#8B4513',
                        pattern: 'wood',
                        isMaster: true,
                        rooms: [],
                        floors: [{
                          id: `floor-${Date.now()}`,
                          name: 'Floor 1',
                          level: 1,
                          width: 40,
                          height: 30,
                          rooms: []
                        }],
                        canvasWidth: 100,
                        canvasHeight: 90,
                        venueX: 30,
                        venueY: 30,
                        exteriorPadding: { top: 30, right: 30, bottom: 30, left: 30 }
                      };
                      handleSaveVenues([...venues, preset]);
                    }}
                    className="px-3 py-2 bg-white border border-indigo-300 rounded-lg text-sm hover:bg-indigo-50 hover:border-indigo-400 transition-all flex items-center gap-2 shadow-sm"
                  >
                    🏨 Lodging
                  </button>
                  <button
                    onClick={() => {
                      const preset: Venue = {
                        id: `venue-${Date.now()}`,
                        name: 'Rehearsal Dinner Venue',
                        width: 30,
                        height: 25,
                        capacity: 40,
                        category: 'rehearsal-dinner',
                        color: '#F8F4E8',
                        borderColor: '#4A1942',
                        pattern: 'wood',
                        isMaster: true,
                        canvasWidth: 80,
                        canvasHeight: 75,
                        venueX: 25,
                        venueY: 25,
                        exteriorPadding: { top: 25, right: 25, bottom: 25, left: 25 }
                      };
                      handleSaveVenues([...venues, preset]);
                    }}
                    className="px-3 py-2 bg-white border border-rose-300 rounded-lg text-sm hover:bg-rose-50 hover:border-rose-400 transition-all flex items-center gap-2 shadow-sm"
                  >
                    🍽️ Rehearsal Dinner
                  </button>
                </div>
              </div>

              {/* Action Bar */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {venues.slice(0, 4).map((v, i) => (
                      <div 
                        key={i} 
                        className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white shadow-sm"
                        style={{ backgroundColor: v.borderColor || '#4A1942' }}
                      >
                        {v.name.charAt(0)}
                      </div>
                    ))}
                    {venues.length > 4 && (
                      <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-400 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                        +{venues.length - 4}
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-gray-600 font-medium">{venues.length} Venues</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => expandedVenues.size === venues.length ? collapseAllVenues() : expandAllVenues()}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors"
                  >
                    {expandedVenues.size === venues.length ? '▲ Collapse All' : '▼ Expand All'}
                  </button>
                  <button
                    onClick={() => {
                      const newVenue: Venue = {
                        id: `venue-${Date.now()}`,
                        name: 'New Venue',
                        width: 50,
                        height: 30,
                        capacity: 100,
                        category: 'reception',
                        color: '#FFFFFF',
                        borderColor: '#4A1942',
                        pattern: 'wood',
                        isMaster: true,
                        exteriorPadding: { top: 30, right: 30, bottom: 30, left: 30 }
                      };
                      handleSaveVenues([...venues, newVenue]);
                    }}
                    className="px-4 py-1.5 bg-gradient-to-r from-[#4A1942] to-[#6d2c5a] text-white rounded-lg hover:from-[#5c2a64] hover:to-[#7d3c6a] transition-all font-medium shadow-sm flex items-center gap-1"
                  >
                    <span className="text-lg">+</span> Add Venue
                  </button>
                </div>
              </div>

              {/* Category Legend */}
              <div className="flex flex-wrap gap-2 text-xs">
                {layoutCategories.map(cat => (
                  <span key={cat.id} className="px-2 py-1 bg-gray-100 rounded-full flex items-center gap-1 text-gray-600">
                    {cat.icon} {cat.name} ({venues.filter(v => v.category === cat.id).length})
                  </span>
                ))}
              </div>

              {/* Venues List */}
              <div className="space-y-3">
              
              {venues.map(venue => {
                const category = layoutCategories.find(c => c.id === venue.category);
                return (
                <div key={venue.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                  {/* Color bar based on venue pattern/color */}
                  <div 
                    className="h-1.5"
                    style={{ backgroundColor: venue.borderColor || '#4A1942' }}
                  />
                  <div 
                    className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleVenueExpanded(venue.id)}
                  >
                    <div className="flex items-center gap-3">
                      {/* Venue Preview */}
                      <div 
                        className="w-12 h-10 rounded border-2 flex items-center justify-center text-lg shadow-sm"
                        style={{ 
                          backgroundColor: venue.color || '#FFFFFF',
                          borderColor: venue.borderColor || '#4A1942'
                        }}
                      >
                        {category?.icon || '🏛️'}
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{expandedVenues.has(venue.id) ? '▼' : '▶'}</span>
                          <span className="font-semibold text-gray-800">{venue.name}</span>
                          {venue.isMaster && (
                            <span className="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded font-medium">★</span>
                          )}
                          {venue.masterLayout && (
                            <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded font-medium">📐</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{venue.width}' × {venue.height}'</span>
                          <span>•</span>
                          <span>👥 {venue.capacity}</span>
                          {venue.masterLayout && (
                            <>
                              <span>•</span>
                              <span>{venue.masterLayout.tables.length} tables</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span 
                        className="text-xs px-2 py-1 rounded-full font-medium"
                        style={{ 
                          backgroundColor: `${venue.borderColor || '#4A1942'}15`,
                          color: venue.borderColor || '#4A1942'
                        }}
                      >
                        {category?.icon} {category?.name || venue.category}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const copy: Venue = {
                            ...venue,
                            id: `venue-${Date.now()}`,
                            name: `${venue.name} (Copy)`,
                            masterLayout: undefined
                          };
                          handleSaveVenues([...venues, copy]);
                        }}
                        className="text-gray-400 hover:text-blue-600 text-sm px-1.5 py-1 hover:bg-blue-50 rounded"
                        title="Duplicate"
                      >
                        📋
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmAction(
                            { title: 'Delete venue?', message: `Delete venue "${venue.name}"?`, kind: 'danger', confirmLabel: 'Delete Venue' },
                            () => handleSaveVenues(venues.filter(v => v.id !== venue.id)),
                          );
                        }}
                        className="text-gray-400 hover:text-red-500 text-sm px-1.5 py-1 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  {expandedVenues.has(venue.id) && (
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Name</label>
                        <input
                          type="text"
                          value={venue.name}
                          onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, name: e.target.value } : v))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Shape Builder</label>
                        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3 space-y-3">
                          <div className="flex flex-col sm:flex-row gap-2">
                            <select
                              value={venue.shape || 'rectangle'}
                              onChange={(e) => {
                                const nextShape = e.target.value as ShapeType;
                                handleSaveVenues(venues.map(v => {
                                  if (v.id !== venue.id) return v;
                                  if (nextShape === 'custom') {
                                    return {
                                      ...v,
                                      shape: 'custom',
                                      isCustomShape: true,
                                      shapePoints: v.shapePoints && v.shapePoints.length >= 3
                                        ? v.shapePoints
                                        : [
                                            { x: 0, y: 0 },
                                            { x: v.width, y: 0 },
                                            { x: v.width, y: v.height },
                                            { x: 0, y: v.height }
                                          ],
                                      customPath: v.customPath || `M 0 0 L ${v.width} 0 L ${v.width} ${v.height} L 0 ${v.height} Z`
                                    };
                                  }
                                  return {
                                    ...v,
                                    shape: nextShape,
                                    isCustomShape: false
                                  };
                                }));
                              }}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-white"
                            >
                              <option value="rectangle">Rectangle</option>
                              <option value="l-shape">L-Shape</option>
                              <option value="t-shape">T-Shape</option>
                              <option value="u-shape">U-Shape</option>
                              <option value="custom">Custom</option>
                            </select>
                            <button
                              onClick={() => setCustomShapeVenueId(venue.id)}
                              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-colors font-medium shadow-sm whitespace-nowrap"
                              title="Open venue shape builder"
                            >
                              ✏️ Open Shape Builder
                            </button>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                            {[
                              { key: 'rectangle', label: 'Rectangle' },
                              { key: 'l-shape', label: 'L-Shape' },
                              { key: 't-shape', label: 'T-Shape' },
                              { key: 'u-shape', label: 'U-Shape' },
                              { key: 'custom', label: 'Custom' },
                            ].map(option => (
                              <button
                                key={option.key}
                                type="button"
                                onClick={() => {
                                  const nextShape = option.key as ShapeType;
                                  handleSaveVenues(venues.map(v => {
                                    if (v.id !== venue.id) return v;
                                    if (nextShape === 'custom') {
                                      return {
                                        ...v,
                                        shape: 'custom',
                                        isCustomShape: true,
                                        shapePoints: v.shapePoints && v.shapePoints.length >= 3
                                          ? v.shapePoints
                                          : [
                                              { x: 0, y: 0 },
                                              { x: v.width, y: 0 },
                                              { x: v.width, y: v.height },
                                              { x: 0, y: v.height }
                                            ],
                                        customPath: v.customPath || `M 0 0 L ${v.width} 0 L ${v.width} ${v.height} L 0 ${v.height} Z`
                                      };
                                    }
                                    return { ...v, shape: nextShape, isCustomShape: false };
                                  }));
                                }}
                                className={`px-2 py-2 rounded-lg border font-medium transition-colors ${(venue.shape || 'rectangle') === option.key ? 'bg-purple-100 border-purple-300 text-purple-800' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                          <p className="text-xs text-purple-700">
                            Use the shape builder for truly custom venues. It supports draggable points, starter templates, direct dimension editing, and live scaling to your venue width and height.
                          </p>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Width (ft)</label>
                        <input
                          type="number"
                          value={venue.width}
                          onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, width: parseInt(e.target.value) || 0 } : v))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Height (ft)</label>
                        <input
                          type="number"
                          value={venue.height}
                          onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, height: parseInt(e.target.value) || 0 } : v))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Capacity</label>
                        <input
                          type="number"
                          value={venue.capacity}
                          onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, capacity: parseInt(e.target.value) || 0 } : v))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Category</label>
                        <select
                          value={venue.category}
                          onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, category: e.target.value as LayoutCategory } : v))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
                        >
                          {layoutCategories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pattern</label>
                        <select
                          value={venue.pattern || 'solid'}
                          onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, pattern: e.target.value as PatternType, patternColors: defaultPatternColors[e.target.value as PatternType] } : v))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
                        >
                          {patternOptions.map(p => (
                            <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    
                    {/* Venue Features Builder Button removed as requested */}


                    {/* Fill Color - Only show when pattern is solid */}
                    {(venue.pattern === 'solid' || !venue.pattern) && (
                      <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <h4 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                          🎨 Venue Fill Color
                        </h4>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={venue.color || '#FFFFFF'}
                            onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, color: e.target.value } : v))}
                            className="w-16 h-12 border-2 border-gray-400 rounded-lg cursor-pointer shadow-md hover:shadow-lg transition-shadow"
                            style={{ padding: '2px' }}
                          />
                          <div className="flex-1">
                            <input
                              type="text"
                              value={venue.color || '#FFFFFF'}
                              onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, color: e.target.value } : v))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                              placeholder="#FFFFFF"
                            />
                            <p className="text-xs text-amber-600 mt-1">Click the color box to choose a fill color</p>
                          </div>
                          <div 
                            className="w-12 h-12 rounded-lg border-2 border-gray-300 shadow-inner"
                            style={{ backgroundColor: venue.color || '#FFFFFF' }}
                            title="Color Preview"
                          />
                        </div>
                      </div>
                    )}
                    

                    {/* Border Settings */}
                    <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <h4 className="text-sm font-semibold text-purple-800 mb-3 flex items-center gap-2">
                        🔲 Venue Border Settings
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={venue.showBorder !== false}
                              onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, showBorder: e.target.checked } : v))}
                              className="w-5 h-5 accent-[#4A1942]"
                            />
                            <span className="text-sm font-medium text-gray-700">Show Border</span>
                          </label>
                        </div>
                        {venue.showBorder !== false && (
                          <>
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Border Color</label>
                              <div className="flex gap-2">
                                <input
                                  type="color"
                                  value={venue.borderColor || '#4A1942'}
                                  onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, borderColor: e.target.value } : v))}
                                  className="w-10 h-9 border border-gray-300 rounded cursor-pointer"
                                />
                                <input
                                  type="text"
                                  value={venue.borderColor || '#4A1942'}
                                  onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, borderColor: e.target.value } : v))}
                                  className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Border Width (px)</label>
                              <input
                                type="number"
                                value={venue.borderWidth || 2}
                                onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, borderWidth: parseInt(e.target.value) || 1 } : v))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                min={1}
                                max={10}
                              />
                            </div>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-purple-600 mt-2">
                        💡 Configure the border around your venue layout. This helps define the venue boundaries.
                      </p>
                    </div>
                    
                    {/* Pattern Colors */}
                    {venue.pattern && venue.pattern !== 'solid' && (
                      <PatternColorPicker
                        pattern={venue.pattern}
                        patternColors={venue.patternColors}
                        onChange={(colors) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, patternColors: colors } : v))}
                      />
                    )}
                    
                    {/* Canvas Size & Venue Position */}
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                        📐 Canvas & Positioning Settings
                        <span className="text-xs font-normal text-blue-600">(for exterior features)</span>
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Canvas Width (ft)</label>
                          <input
                            type="number"
                            value={venue.canvasWidth || venue.width + 80}
                            onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, canvasWidth: parseInt(e.target.value) || venue.width + 80 } : v))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            min={venue.width + 10}
                          />
                          <p className="text-[10px] text-gray-400 mt-1">Min: {venue.width + 10}ft</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Canvas Height (ft)</label>
                          <input
                            type="number"
                            value={venue.canvasHeight || venue.height + 80}
                            onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, canvasHeight: parseInt(e.target.value) || venue.height + 80 } : v))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            min={venue.height + 10}
                          />
                          <p className="text-[10px] text-gray-400 mt-1">Min: {venue.height + 10}ft</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Venue X Position (ft)</label>
                          <input
                            type="number"
                            value={venue.venueX ?? (venue.exteriorPadding?.left || 40)}
                            onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, venueX: parseInt(e.target.value) || 0 } : v))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            min={0}
                          />
                          <p className="text-[10px] text-gray-400 mt-1">Distance from left edge</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Venue Y Position (ft)</label>
                          <input
                            type="number"
                            value={venue.venueY ?? (venue.exteriorPadding?.top || 40)}
                            onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, venueY: parseInt(e.target.value) || 0 } : v))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            min={0}
                          />
                          <p className="text-[10px] text-gray-400 mt-1">Distance from top edge</p>
                        </div>
                      </div>
                      
                      {/* Canvas Colors */}
                      <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-blue-200">
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Canvas Fill Color</label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={venue.canvasFillColor || '#e8e4e0'}
                              onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, canvasFillColor: e.target.value } : v))}
                              className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                            />
                            <input
                              type="text"
                              value={venue.canvasFillColor || '#e8e4e0'}
                              onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, canvasFillColor: e.target.value } : v))}
                              className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1">Background color of exterior area</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Canvas Border Color</label>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={venue.canvasBorderColor || '#888888'}
                              onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, canvasBorderColor: e.target.value } : v))}
                              className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                            />
                            <input
                              type="text"
                              value={venue.canvasBorderColor || '#888888'}
                              onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, canvasBorderColor: e.target.value } : v))}
                              className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1">Border color of the canvas</p>
                        </div>
                      </div>
                      
                      <p className="text-xs text-blue-600 mt-2">
                        💡 Tip: Use canvas size and venue position to create space around your venue for exterior features like driveways, landscaping, and signage.
                      </p>
                    </div>
                    
                    {/* Indoor/Outdoor features removed - use Fixtures tab instead */}
                    
                    {/* Master Venue Toggle */}
                    <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={venue.isMaster || false}
                            onChange={(e) => {
                              handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, isMaster: e.target.checked } : v));
                            }}
                            className="w-5 h-5 accent-[#4A1942]"
                          />
                          <span className="text-sm font-medium text-gray-700">Master Venue</span>
                        </label>
                        {venue.isMaster && (
                          <span className="text-xs bg-[#4A1942] text-white px-2 py-1 rounded">
                            ★ Visible to Basic Users
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 flex-1">
                        Only master venues are visible to basic users.
                      </p>
                    </div>
                    
                    {/* Master Layout Status */}
                    <div className="flex items-center gap-4 pt-3 border-t border-gray-100 bg-amber-50 p-3 rounded-lg -mx-4 -mb-4 mt-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-700">📐 Master Layout</span>
                          {venue.masterLayout ? (
                            <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">
                              ✓ Saved
                            </span>
                          ) : (
                            <span className="text-xs bg-gray-400 text-white px-2 py-0.5 rounded">
                              Not Set
                            </span>
                          )}
                        </div>
                        {venue.masterLayout ? (
                          <p className="text-xs text-gray-600">
                            {venue.masterLayout.tables.length} tables, {venue.masterLayout.fixtures.length} fixtures
                            <span className="ml-2 text-gray-400">
                              (saved {new Date(venue.masterLayout.savedAt).toLocaleDateString()})
                            </span>
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500">
                            To set a master layout, go to the canvas view for this venue, add your fixtures, then click Menu → "Save as Master Layout"
                          </p>
                        )}
                      </div>
                      {venue.masterLayout && (
                        <button
                          onClick={() => {
                            confirmAction(
                              { title: 'Clear master layout?', message: `Clear master layout for "${venue.name}"? All pre-placed items will be removed.`, kind: 'danger', confirmLabel: 'Clear Layout' },
                              () => handleSaveVenues(venues.map(v => {
                                if (v.id === venue.id) {
                                  const { masterLayout, ...rest } = v;
                                  return rest;
                                }
                                return v;
                              })),
                            );
                          }}
                          className="px-3 py-1.5 text-orange-600 hover:bg-orange-100 border border-orange-200 rounded-lg text-xs"
                        >
                          Clear Layout
                        </button>
                      )}
                    </div>
                    
                    {/* Primary Image upload */}
                    <div className="space-y-3 pt-2 border-t border-gray-100">
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Primary Venue Image</label>
                        <div className="flex items-center gap-2 mt-1">
                          {venue.imageUrl ? (
                            <img src={venue.imageUrl} alt="" className="w-16 h-16 object-cover rounded border" />
                          ) : (
                            <div className="w-16 h-16 bg-gray-100 rounded border flex items-center justify-center text-gray-400">
                              No img
                            </div>
                          )}
                          <button
                            onClick={() => handleImageUpload((url) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, imageUrl: url } : v)))}
                            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
                          >
                            📷 Upload
                          </button>
                          {venue.imageUrl && (
                            <button
                              onClick={() => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, imageUrl: undefined } : v))}
                              className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm transition-colors"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Multi-Image Gallery (up to 10 images for venues) */}
                      <MultiImageUpload
                        images={venue.images || []}
                        onChange={(images) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, images } : v))}
                        maxImages={10}
                        itemName="venue"
                      />
                      
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={() => handleSaveVenues(venues.filter(v => v.id !== venue.id))}
                          className="px-4 py-2 text-red-500 hover:bg-red-50 border border-red-200 rounded-lg text-sm"
                        >
                          🗑️ Delete Venue
                        </button>
                      </div>
                    </div>
                  </div>
                  )}
                </div>
              );
              })}
              </div>
              
              {/* Tips Section */}
              <BrandedTips
                title="Tips for Venue Setup"
                config={config}
                tips={[
                  { icon: '★', title: 'Master Venue', description: 'Mark venues as "Master" so basic users can see and use them' },
                  { icon: '📐', title: 'Master Layout', description: 'Save a pre-configured layout with fixtures for each venue' },
                  { icon: '🖼️', title: 'Canvas Size', description: 'Use canvas settings to add exterior features around your venue' },
                  { icon: '📁', title: 'Categories', description: 'Assign categories to help organize and filter venues' },
                  { icon: '📷', title: 'Images', description: 'Upload up to 10 reference images per venue for client reference' }
                ]}
              />
            </div>
    </div>
  );
}
