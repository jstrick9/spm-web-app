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

export function LinenManagement(props: AdminCommonProps) {
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
      <div className="space-y-6">
              {/* Header */}
              <BrandedSectionHeader 
                icon="🎨" 
                title="Table Linen Colors" 
                description="Define available linen colors for tables and seating"
                config={config}
              />

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                  <div className="text-3xl font-bold text-pink-600">{linenColors.length}</div>
                  <div className="text-xs text-gray-500 font-medium">Total Colors</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                  <div className="text-3xl font-bold text-green-600">{linenColors.filter(c => c.enabled).length}</div>
                  <div className="text-xs text-gray-500 font-medium">✓ Enabled</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                  <div className="text-3xl font-bold text-gray-400">{linenColors.filter(c => !c.enabled).length}</div>
                  <div className="text-xs text-gray-500 font-medium">○ Disabled</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                  <div className="flex justify-center gap-1 mb-1">
                    {linenColors.slice(0, 6).map(c => (
                      <div key={c.id} className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: c.hex }} />
                    ))}
                    {linenColors.length > 6 && <span className="text-xs text-gray-400">+{linenColors.length - 6}</span>}
                  </div>
                  <div className="text-xs text-gray-500 font-medium">Color Palette</div>
                </div>
              </div>

              {/* Quick Add Presets */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                <h3 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                  <span>✨</span> Quick Add Color Palettes
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const classics = [
                        { id: `linen-${Date.now()}-1`, name: 'Classic White', hex: '#FFFFFF', textColor: '#374151', enabled: true },
                        { id: `linen-${Date.now()}-2`, name: 'Ivory', hex: '#FFFFF0', textColor: '#374151', enabled: true },
                        { id: `linen-${Date.now()}-3`, name: 'Champagne', hex: '#F7E7CE', textColor: '#374151', enabled: true },
                        { id: `linen-${Date.now()}-4`, name: 'Classic Black', hex: '#000000', textColor: '#FFFFFF', enabled: true },
                      ];
                      const existing = linenColors.map(c => c.name.toLowerCase());
                      const toAdd = classics.filter(c => !existing.includes(c.name.toLowerCase()));
                      if (toAdd.length > 0) handleSaveLinenColors([...linenColors, ...toAdd]);
                    }}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all text-sm font-medium flex items-center gap-2"
                  >
                    <div className="flex -space-x-1">
                      <span className="w-4 h-4 rounded-full bg-white border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#FFFFF0] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#F7E7CE] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-black border border-gray-300" />
                    </div>
                    Classic & Elegant
                  </button>
                  <button
                    onClick={() => {
                      const romantic = [
                        { id: `linen-${Date.now()}-1`, name: 'Blush Pink', hex: '#FFC0CB', textColor: '#374151', enabled: true },
                        { id: `linen-${Date.now()}-2`, name: 'Dusty Rose', hex: '#DCAE96', textColor: '#374151', enabled: true },
                        { id: `linen-${Date.now()}-3`, name: 'Mauve', hex: '#E0B0FF', textColor: '#374151', enabled: true },
                        { id: `linen-${Date.now()}-4`, name: 'Rose Gold', hex: '#B76E79', textColor: '#FFFFFF', enabled: true },
                      ];
                      const existing = linenColors.map(c => c.name.toLowerCase());
                      const toAdd = romantic.filter(c => !existing.includes(c.name.toLowerCase()));
                      if (toAdd.length > 0) handleSaveLinenColors([...linenColors, ...toAdd]);
                    }}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all text-sm font-medium flex items-center gap-2"
                  >
                    <div className="flex -space-x-1">
                      <span className="w-4 h-4 rounded-full bg-[#FFC0CB] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#DCAE96] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#E0B0FF] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#B76E79] border border-gray-300" />
                    </div>
                    💕 Romantic Blush
                  </button>
                  <button
                    onClick={() => {
                      const rustic = [
                        { id: `linen-${Date.now()}-1`, name: 'Sage Green', hex: '#9CAF88', textColor: '#FFFFFF', enabled: true },
                        { id: `linen-${Date.now()}-2`, name: 'Eucalyptus', hex: '#84A98C', textColor: '#FFFFFF', enabled: true },
                        { id: `linen-${Date.now()}-3`, name: 'Terracotta', hex: '#E2725B', textColor: '#FFFFFF', enabled: true },
                        { id: `linen-${Date.now()}-4`, name: 'Rust', hex: '#B7410E', textColor: '#FFFFFF', enabled: true },
                      ];
                      const existing = linenColors.map(c => c.name.toLowerCase());
                      const toAdd = rustic.filter(c => !existing.includes(c.name.toLowerCase()));
                      if (toAdd.length > 0) handleSaveLinenColors([...linenColors, ...toAdd]);
                    }}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all text-sm font-medium flex items-center gap-2"
                  >
                    <div className="flex -space-x-1">
                      <span className="w-4 h-4 rounded-full bg-[#9CAF88] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#84A98C] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#E2725B] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#B7410E] border border-gray-300" />
                    </div>
                    🌿 Rustic & Natural
                  </button>
                  <button
                    onClick={() => {
                      const navy = [
                        { id: `linen-${Date.now()}-1`, name: 'Navy Blue', hex: '#000080', textColor: '#FFFFFF', enabled: true },
                        { id: `linen-${Date.now()}-2`, name: 'Royal Blue', hex: '#4169E1', textColor: '#FFFFFF', enabled: true },
                        { id: `linen-${Date.now()}-3`, name: 'Dusty Blue', hex: '#7EB1C4', textColor: '#374151', enabled: true },
                        { id: `linen-${Date.now()}-4`, name: 'Gold', hex: '#FFD700', textColor: '#374151', enabled: true },
                      ];
                      const existing = linenColors.map(c => c.name.toLowerCase());
                      const toAdd = navy.filter(c => !existing.includes(c.name.toLowerCase()));
                      if (toAdd.length > 0) handleSaveLinenColors([...linenColors, ...toAdd]);
                    }}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all text-sm font-medium flex items-center gap-2"
                  >
                    <div className="flex -space-x-1">
                      <span className="w-4 h-4 rounded-full bg-[#000080] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#4169E1] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#7EB1C4] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#FFD700] border border-gray-300" />
                    </div>
                    👑 Navy & Gold
                  </button>
                  <button
                    onClick={() => {
                      const burgundy = [
                        { id: `linen-${Date.now()}-1`, name: 'Burgundy', hex: '#800020', textColor: '#FFFFFF', enabled: true },
                        { id: `linen-${Date.now()}-2`, name: 'Deep Plum', hex: '#4A1942', textColor: '#FFFFFF', enabled: true },
                        { id: `linen-${Date.now()}-3`, name: 'Wine', hex: '#722F37', textColor: '#FFFFFF', enabled: true },
                        { id: `linen-${Date.now()}-4`, name: 'Rose', hex: '#FF007F', textColor: '#FFFFFF', enabled: true },
                      ];
                      const existing = linenColors.map(c => c.name.toLowerCase());
                      const toAdd = burgundy.filter(c => !existing.includes(c.name.toLowerCase()));
                      if (toAdd.length > 0) handleSaveLinenColors([...linenColors, ...toAdd]);
                    }}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all text-sm font-medium flex items-center gap-2"
                  >
                    <div className="flex -space-x-1">
                      <span className="w-4 h-4 rounded-full bg-[#800020] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#4A1942] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#722F37] border border-gray-300" />
                      <span className="w-4 h-4 rounded-full bg-[#FF007F] border border-gray-300" />
                    </div>
                    🍷 Burgundy & Wine
                  </button>
                </div>
              </div>

              {/* Action Bar */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => expandedLinens.size === linenColors.length && linenColors.length > 0 ? collapseAllLinens() : expandAllLinens()}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                    >
                      {expandedLinens.size === linenColors.length && linenColors.length > 0 ? '▲ Collapse All' : '▼ Expand All'}
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => handleSaveLinenColors(linenColors.map(c => ({ ...c, enabled: true })))}
                      className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
                    >
                      ✓ Enable All
                    </button>
                    <button
                      onClick={() => handleSaveLinenColors(linenColors.map(c => ({ ...c, enabled: false })))}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                    >
                      ○ Disable All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => {
                        confirmAction(
                          { title: 'Sort colors?', message: 'Sort colors alphabetically?', kind: 'warning', confirmLabel: 'Sort Colors' },
                          () => handleSaveLinenColors([...linenColors].sort((a, b) => a.name.localeCompare(b.name))),
                        );
                      }}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                    >
                      🔤 Sort A-Z
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      const newId = `linen-${Date.now()}`;
                      const newColor: LinenColor = {
                        id: newId,
                        name: 'New Color',
                        hex: '#CCCCCC',
                        textColor: '#374151',
                        enabled: true
                      };
                      handleSaveLinenColors([...linenColors, newColor]);
                      setExpandedLinens(prev => new Set([...prev, newId]));
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg hover:from-pink-600 hover:to-rose-600 transition-all font-medium shadow-sm flex items-center gap-2"
                  >
                    <span>➕</span> Add Custom Color
                  </button>
                </div>
              </div>

              {/* Color Palette Preview */}
              {linenColors.length > 0 && (
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span>🎨</span> Color Palette Preview
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {linenColors.filter(c => c.enabled).map(color => (
                      <div
                        key={color.id}
                        className="group relative"
                        title={color.name}
                      >
                        <div
                          className="w-12 h-12 rounded-lg border-2 border-gray-200 shadow-sm transition-transform group-hover:scale-110 flex items-center justify-center"
                          style={{ backgroundColor: color.hex, color: color.textColor }}
                        >
                          <span className="text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">Aa</span>
                        </div>
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                          {color.name}
                        </div>
                      </div>
                    ))}
                    {linenColors.filter(c => c.enabled).length === 0 && (
                      <p className="text-sm text-gray-400 italic">No enabled colors to preview</p>
                    )}
                  </div>
                </div>
              )}

              {/* Linen Color Cards */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  <span>🎨</span> All Linen Colors
                  <span className="text-sm font-normal text-gray-400">({linenColors.length} total)</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {linenColors.map((color, index) => (
                    <div 
                      key={color.id} 
                      className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-all hover:shadow-md ${
                        color.enabled ? 'border-gray-200' : 'border-dashed border-gray-300 opacity-60'
                      }`}
                    >
                      {/* Color Header */}
                      <div 
                        className="p-4 flex items-center gap-4 cursor-pointer"
                        style={{ backgroundColor: color.hex }}
                        onClick={() => toggleLinenExpanded(color.id)}
                      >
                        <div className="text-xl opacity-80" style={{ color: color.textColor }}>
                          {expandedLinens.has(color.id) ? '▼' : '▶'}
                        </div>
                        <div 
                          className="w-16 h-16 rounded-xl border-4 border-white/50 shadow-lg flex items-center justify-center text-2xl font-bold shrink-0"
                          style={{ backgroundColor: color.hex, color: color.textColor }}
                        >
                          Aa
                        </div>
                        <div className="flex-1" onClick={e => e.stopPropagation()}>
                          <input
                            type="text"
                            value={color.name}
                            onChange={(e) => handleSaveLinenColors(linenColors.map(c => c.id === color.id ? { ...c, name: e.target.value } : c))}
                            className="w-full px-3 py-2 rounded-lg text-lg font-semibold bg-white/90 border-0 focus:ring-2 focus:ring-white"
                            style={{ color: '#374151' }}
                          />
                        </div>
                        {!expandedLinens.has(color.id) && (
                          <div className={`px-2 py-1 rounded text-xs font-bold whitespace-nowrap ${color.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {color.enabled ? '✓ Enabled' : '○ Disabled'}
                          </div>
                        )}
                        <div onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              confirmAction(
                                { title: 'Delete linen color?', message: `Delete "${color.name}"?`, kind: 'danger', confirmLabel: 'Delete Color' },
                                () => handleSaveLinenColors(linenColors.filter(c => c.id !== color.id)),
                              );
                            }}
                            className="p-2 rounded-lg transition-colors hover:bg-white/30"
                            style={{ color: color.textColor }}
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      
                      {/* Color Settings */}
                      {expandedLinens.has(color.id) && (
                      <div className="p-4 space-y-3 bg-gray-50">
                        {/* Hex & Color Picker Row */}
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="text-xs text-gray-500 font-medium mb-1 block">Hex Color</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={color.hex}
                                onChange={(e) => handleSaveLinenColors(linenColors.map(c => c.id === color.id ? { ...c, hex: e.target.value } : c))}
                                className="w-12 h-10 border-2 border-gray-200 rounded-lg cursor-pointer"
                              />
                              <input
                                type="text"
                                value={color.hex.toUpperCase()}
                                onChange={(e) => {
                                  const hex = e.target.value;
                                  if (/^#[0-9A-Fa-f]{0,6}$/.test(hex)) {
                                    handleSaveLinenColors(linenColors.map(c => c.id === color.id ? { ...c, hex } : c));
                                  }
                                }}
                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono uppercase"
                                maxLength={7}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 font-medium mb-1 block">Text Color</label>
                            <select
                              value={color.textColor === '#FFFFFF' ? 'white' : 'dark'}
                              onChange={(e) => handleSaveLinenColors(linenColors.map(c => c.id === color.id ? { ...c, textColor: e.target.value === 'white' ? '#FFFFFF' : '#374151' } : c))}
                              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                            >
                              <option value="dark">🌑 Dark</option>
                              <option value="white">☀️ White</option>
                            </select>
                          </div>
                        </div>
                        
                        {/* Status & Actions Row */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={color.enabled}
                              onChange={(e) => handleSaveLinenColors(linenColors.map(c => c.id === color.id ? { ...c, enabled: e.target.checked } : c))}
                              className="w-5 h-5 rounded accent-pink-500"
                            />
                            <span className={`text-sm font-medium ${color.enabled ? 'text-green-600' : 'text-gray-400'}`}>
                              {color.enabled ? '✓ Enabled' : '○ Disabled'}
                            </span>
                          </label>
                          <div className="flex items-center gap-1">
                            {index > 0 && (
                              <button
                                onClick={() => {
                                  const newColors = [...linenColors];
                                  [newColors[index - 1], newColors[index]] = [newColors[index], newColors[index - 1]];
                                  handleSaveLinenColors(newColors);
                                }}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                title="Move up"
                              >
                                ⬆️
                              </button>
                            )}
                            {index < linenColors.length - 1 && (
                              <button
                                onClick={() => {
                                  const newColors = [...linenColors];
                                  [newColors[index], newColors[index + 1]] = [newColors[index + 1], newColors[index]];
                                  handleSaveLinenColors(newColors);
                                }}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                                title="Move down"
                              >
                                ⬇️
                              </button>
                            )}
                            <button
                              onClick={() => {
                                const duplicate: LinenColor = {
                                  ...color,
                                  id: `linen-${Date.now()}`,
                                  name: `${color.name} Copy`
                                };
                                handleSaveLinenColors([...linenColors, duplicate]);
                              }}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Duplicate"
                            >
                              📋
                            </button>
                            <button
                              onClick={() => {
                                confirmAction(
                                  { title: 'Delete linen color?', message: `Delete "${color.name}"?`, kind: 'danger', confirmLabel: 'Delete Color' },
                                  () => handleSaveLinenColors(linenColors.filter(c => c.id !== color.id)),
                                );
                              }}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Empty State */}
              {linenColors.length === 0 && (
                <div className="bg-white rounded-xl p-12 text-center border-2 border-dashed border-gray-300">
                  <div className="text-6xl mb-4">🎨</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No Linen Colors Yet</h3>
                  <p className="text-gray-500 mb-6 max-w-md mx-auto">
                    Add linen colors that will be available for users to select when setting up tables.
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    <button
                      onClick={() => {
                        const newColor: LinenColor = {
                          id: `linen-${Date.now()}`,
                          name: 'New Color',
                          hex: '#CCCCCC',
                          textColor: '#374151',
                          enabled: true
                        };
                        handleSaveLinenColors([...linenColors, newColor]);
                      }}
                      className="px-6 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg hover:from-pink-600 hover:to-rose-600 transition-all font-medium shadow-sm"
                    >
                      ➕ Add Custom Color
                    </button>
                    <button
                      onClick={() => {
                        const defaults = [
                          { id: `linen-${Date.now()}-1`, name: 'White', hex: '#FFFFFF', textColor: '#374151', enabled: true },
                          { id: `linen-${Date.now()}-2`, name: 'Ivory', hex: '#FFFFF0', textColor: '#374151', enabled: true },
                          { id: `linen-${Date.now()}-3`, name: 'Black', hex: '#000000', textColor: '#FFFFFF', enabled: true },
                          { id: `linen-${Date.now()}-4`, name: 'Navy', hex: '#000080', textColor: '#FFFFFF', enabled: true },
                          { id: `linen-${Date.now()}-5`, name: 'Burgundy', hex: '#800020', textColor: '#FFFFFF', enabled: true },
                          { id: `linen-${Date.now()}-6`, name: 'Sage', hex: '#9CAF88', textColor: '#FFFFFF', enabled: true },
                          { id: `linen-${Date.now()}-7`, name: 'Blush', hex: '#FFC0CB', textColor: '#374151', enabled: true },
                          { id: `linen-${Date.now()}-8`, name: 'Gold', hex: '#FFD700', textColor: '#374151', enabled: true },
                        ];
                        handleSaveLinenColors(defaults);
                      }}
                      className="px-6 py-3 bg-white border-2 border-pink-300 text-pink-600 rounded-lg hover:bg-pink-50 transition-all font-medium"
                    >
                      🎨 Add Default Palette
                    </button>
                  </div>
                </div>
              )}

              {/* Tips Section */}
              <BrandedTips
                title="Tips for Linen Colors"
                config={config}
                tips={[
                  { icon: '☀️', title: 'White Text on Dark', description: 'Use white text on dark colors like Navy, Burgundy, and Black' },
                  { icon: '🌙', title: 'Dark Text on Light', description: 'Use dark text on light colors like White, Ivory, Blush, and Gold' },
                  { icon: '⏸️', title: 'Disable vs Delete', description: 'Disable seasonal colors instead of deleting them so you can reuse them later' },
                  { icon: '🎨', title: 'Palette Presets', description: 'Use palette presets to quickly add coordinated color schemes' },
                  { icon: '↕️', title: 'Reorder Colors', description: 'Put the most popular color options first using the up/down arrows' }
                ]}
              />
            </div>
    </div>
  );
}
