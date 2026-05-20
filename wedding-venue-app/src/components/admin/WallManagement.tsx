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

export function WallManagement(props: AdminCommonProps) {
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
                icon="🧱" 
                title="Wall Styles" 
                description="Define decorative wall options for backdrops, photo walls, and venue décor"
                config={config}
              />

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                  <div className="text-3xl font-bold text-teal-600">{wallStyles.length}</div>
                  <div className="text-xs text-gray-500 font-medium">Total Styles</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                  <div className="text-3xl font-bold text-green-600">{wallStyles.filter(s => s.enabled).length}</div>
                  <div className="text-xs text-gray-500 font-medium">✓ Enabled</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                  <div className="text-3xl font-bold text-gray-400">{wallStyles.filter(s => !s.enabled).length}</div>
                  <div className="text-xs text-gray-500 font-medium">○ Disabled</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                  <div className="text-3xl font-bold text-purple-600">
                    {fixtureTypes.filter(f => f.wallStyleId).length}
                  </div>
                  <div className="text-xs text-gray-500 font-medium">🔗 Linked Fixtures</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                  <div className="flex justify-center gap-1 mb-1">
                    {wallStyles.slice(0, 5).map(s => (
                      <div key={s.id} className="w-5 h-5 rounded border border-gray-200" style={{ backgroundColor: s.color }} />
                    ))}
                    {wallStyles.length > 5 && <span className="text-xs text-gray-400">+{wallStyles.length - 5}</span>}
                  </div>
                  <div className="text-xs text-gray-500 font-medium">Palette</div>
                </div>
              </div>

              {/* Quick Add Presets */}
              <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl p-4 border border-teal-200">
                <h3 className="font-semibold text-teal-800 mb-3 flex items-center gap-2">
                  <span>✨</span> Quick Add Wall Style Presets
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const presets = [
                        { id: `wall-${Date.now()}-1`, name: 'Greenery Wall', color: '#228B22', icon: '🌿', pattern: 'grass' as const, enabled: true },
                        { id: `wall-${Date.now()}-2`, name: 'Flower Wall', color: '#FFB6C1', icon: '🌸', pattern: 'solid' as const, enabled: true },
                        { id: `wall-${Date.now()}-3`, name: 'Ivy Wall', color: '#355E3B', icon: '🍃', pattern: 'grass' as const, enabled: true },
                      ];
                      const existing = wallStyles.map(s => s.name.toLowerCase());
                      const toAdd = presets.filter(s => !existing.includes(s.name.toLowerCase()));
                      if (toAdd.length > 0) handleSaveWallStyles([...wallStyles, ...toAdd]);
                    }}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all text-sm font-medium flex items-center gap-2"
                  >
                    <span className="text-lg">🌿</span> Nature & Greenery
                  </button>
                  <button
                    onClick={() => {
                      const presets = [
                        { id: `wall-${Date.now()}-1`, name: 'White Drapery', color: '#FFFFFF', icon: '🪟', pattern: 'solid' as const, enabled: true },
                        { id: `wall-${Date.now()}-2`, name: 'Ivory Drapery', color: '#FFFFF0', icon: '🪟', pattern: 'solid' as const, enabled: true },
                        { id: `wall-${Date.now()}-3`, name: 'Blush Drapery', color: '#FFE4E1', icon: '🎀', pattern: 'solid' as const, enabled: true },
                      ];
                      const existing = wallStyles.map(s => s.name.toLowerCase());
                      const toAdd = presets.filter(s => !existing.includes(s.name.toLowerCase()));
                      if (toAdd.length > 0) handleSaveWallStyles([...wallStyles, ...toAdd]);
                    }}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all text-sm font-medium flex items-center gap-2"
                  >
                    <span className="text-lg">🪟</span> Elegant Drapery
                  </button>
                  <button
                    onClick={() => {
                      const presets = [
                        { id: `wall-${Date.now()}-1`, name: 'Exposed Brick', color: '#8B4513', icon: '🧱', pattern: 'brick' as const, enabled: true },
                        { id: `wall-${Date.now()}-2`, name: 'Stone Wall', color: '#808080', icon: '🪨', pattern: 'gravel' as const, enabled: true },
                        { id: `wall-${Date.now()}-3`, name: 'Wood Panel', color: '#8B4513', icon: '🪵', pattern: 'wood' as const, enabled: true },
                      ];
                      const existing = wallStyles.map(s => s.name.toLowerCase());
                      const toAdd = presets.filter(s => !existing.includes(s.name.toLowerCase()));
                      if (toAdd.length > 0) handleSaveWallStyles([...wallStyles, ...toAdd]);
                    }}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all text-sm font-medium flex items-center gap-2"
                  >
                    <span className="text-lg">🧱</span> Rustic & Industrial
                  </button>
                  <button
                    onClick={() => {
                      const presets = [
                        { id: `wall-${Date.now()}-1`, name: 'Sequin Wall', color: '#FFD700', icon: '✨', pattern: 'solid' as const, enabled: true },
                        { id: `wall-${Date.now()}-2`, name: 'Mirror Wall', color: '#C0C0C0', icon: '🪞', pattern: 'marble' as const, enabled: true },
                        { id: `wall-${Date.now()}-3`, name: 'Balloon Wall', color: '#FF69B4', icon: '🎈', pattern: 'solid' as const, enabled: true },
                      ];
                      const existing = wallStyles.map(s => s.name.toLowerCase());
                      const toAdd = presets.filter(s => !existing.includes(s.name.toLowerCase()));
                      if (toAdd.length > 0) handleSaveWallStyles([...wallStyles, ...toAdd]);
                    }}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all text-sm font-medium flex items-center gap-2"
                  >
                    <span className="text-lg">✨</span> Glam & Sparkle
                  </button>
                  <button
                    onClick={() => {
                      const presets = [
                        { id: `wall-${Date.now()}-1`, name: 'Photo Backdrop', color: '#F5F5F5', icon: '📸', pattern: 'solid' as const, enabled: true },
                        { id: `wall-${Date.now()}-2`, name: 'Neon Sign Wall', color: '#000000', icon: '💡', pattern: 'solid' as const, enabled: true },
                        { id: `wall-${Date.now()}-3`, name: 'Chalkboard Wall', color: '#2F4F4F', icon: '🖌️', pattern: 'solid' as const, enabled: true },
                      ];
                      const existing = wallStyles.map(s => s.name.toLowerCase());
                      const toAdd = presets.filter(s => !existing.includes(s.name.toLowerCase()));
                      if (toAdd.length > 0) handleSaveWallStyles([...wallStyles, ...toAdd]);
                    }}
                    className="px-3 py-2 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all text-sm font-medium flex items-center gap-2"
                  >
                    <span className="text-lg">📸</span> Photo & Display
                  </button>
                </div>
              </div>

              {/* Action Bar */}
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        const allIds = wallStyles.map(s => s.id);
                        if (expandedWalls.size === allIds.length) {
                          setExpandedWalls(new Set());
                        } else {
                          setExpandedWalls(new Set(allIds));
                        }
                      }}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                    >
                      {expandedWalls.size === wallStyles.length ? '▲ Collapse All' : '▼ Expand All'}
                    </button>
                    <button
                      onClick={() => handleSaveWallStyles(wallStyles.map(s => ({ ...s, enabled: true })))}
                      className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
                    >
                      ✓ Enable All
                    </button>
                    <button
                      onClick={() => handleSaveWallStyles(wallStyles.map(s => ({ ...s, enabled: false })))}
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                    >
                      ○ Disable All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => {
                        confirmAction(
                          { title: 'Reset wall styles?', message: 'Reset to default wall styles?', kind: 'warning', confirmLabel: 'Reset Styles' },
                          () => handleSaveWallStyles(defaultWallStyles),
                        );
                      }}
                      className="px-3 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors text-sm font-medium"
                    >
                      🔄 Reset Defaults
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      const newStyle: WallStyle = {
                        id: `wall-${Date.now()}`,
                        name: 'New Wall Style',
                        color: '#FFFFFF',
                        icon: '🪟',
                        pattern: 'solid',
                        enabled: true
                      };
                      handleSaveWallStyles([...wallStyles, newStyle]);
                      setExpandedWalls(prev => new Set([...prev, newStyle.id]));
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg hover:from-teal-600 hover:to-emerald-600 transition-all font-medium shadow-sm flex items-center gap-2"
                  >
                    <span>➕</span> Add Custom Wall Style
                  </button>
                </div>
              </div>

              {/* Wall Style Preview Gallery */}
              {wallStyles.length > 0 && (
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span>🖼️</span> Style Preview Gallery
                    <span className="text-xs font-normal text-gray-400">(Enabled styles visible to users)</span>
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {wallStyles.filter(s => s.enabled).map(style => (
                      <div
                        key={style.id}
                        className="group relative bg-white rounded-lg border-2 border-gray-200 overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                        onClick={() => setExpandedWalls(prev => new Set([...prev, style.id]))}
                        style={{ width: '120px' }}
                      >
                        <div 
                          className="h-16 flex items-center justify-center"
                          style={{ backgroundColor: style.color }}
                        >
                          <span className="text-3xl">{style.icon}</span>
                        </div>
                        <div className="p-2 text-center">
                          <span className="text-xs font-medium text-gray-700 truncate block">{style.name}</span>
                          <span className="text-[10px] text-gray-400">{style.pattern || 'solid'}</span>
                        </div>
                      </div>
                    ))}
                    {wallStyles.filter(s => s.enabled).length === 0 && (
                      <p className="text-sm text-gray-400 italic">No enabled wall styles to preview</p>
                    )}
                  </div>
                </div>
              )}

              {/* Linked Fixtures Info */}
              {fixtureTypes.filter(f => f.wallStyleId).length > 0 && (
                <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                  <h3 className="font-semibold text-purple-800 mb-3 flex items-center gap-2">
                    <span>🔗</span> Fixtures Using Wall Styles
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {fixtureTypes.filter(f => f.wallStyleId).map(fixture => {
                      const linkedStyle = wallStyles.find(s => s.id === fixture.wallStyleId);
                      return (
                        <div key={fixture.id} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-purple-200">
                          <span className="text-lg">{fixture.icon}</span>
                          <span className="text-sm font-medium text-gray-700">{fixture.name}</span>
                          <span className="text-gray-400">→</span>
                          {linkedStyle ? (
                            <div className="flex items-center gap-1">
                              <div className="w-4 h-4 rounded border border-gray-300" style={{ backgroundColor: linkedStyle.color }} />
                              <span className="text-sm text-teal-600">{linkedStyle.name}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-red-500">Style not found</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Wall Style Cards */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  <span>🧱</span> All Wall Styles
                  <span className="text-sm font-normal text-gray-400">({wallStyles.length} total)</span>
                </h3>

              </div>

              {/* Wall Style Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {wallStyles.map((style, index) => (
                  <div 
                    key={style.id} 
                    className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-all hover:shadow-md ${style.enabled ? 'border-teal-400' : 'border-gray-200 opacity-70'}`}
                  >
                    {/* Wall Header - Clickable */}
                    <div 
                      className="h-20 flex items-center justify-between px-4 cursor-pointer hover:opacity-90 transition-opacity relative"
                      style={{ backgroundColor: style.color }}
                      onClick={() => {
                        const newSet = new Set(expandedWalls);
                        if (newSet.has(style.id)) {
                          newSet.delete(style.id);
                        } else {
                          newSet.add(style.id);
                        }
                        setExpandedWalls(newSet);
                      }}
                    >
                      {/* Status badges */}
                      <div className="absolute top-2 left-2 flex gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${style.enabled ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'}`}>
                          {style.enabled ? '✓ Active' : 'Disabled'}
                        </span>
                        {fixtureTypes.some(f => f.wallStyleId === style.id) && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500 text-white">🔗 Linked</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-4">
                        <span className="text-lg text-gray-700 bg-white/50 rounded-full w-6 h-6 flex items-center justify-center">
                          {expandedWalls.has(style.id) ? '▼' : '▶'}
                        </span>
                        <span className="text-4xl drop-shadow-sm">{style.icon}</span>
                        <div>
                          <span className="font-bold text-gray-800 block">{style.name}</span>
                          <span className="text-xs text-gray-600 capitalize">{style.pattern || 'solid'} pattern</span>
                        </div>
                      </div>
                      <div className="flex gap-1 mt-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Move up
                            if (index > 0) {
                              const newStyles = [...wallStyles];
                              [newStyles[index - 1], newStyles[index]] = [newStyles[index], newStyles[index - 1]];
                              handleSaveWallStyles(newStyles);
                            }
                          }}
                          className="px-1.5 py-0.5 bg-white/70 hover:bg-white rounded text-xs disabled:opacity-30"
                          disabled={index === 0}
                        >
                          ⬆️
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // Move down
                            if (index < wallStyles.length - 1) {
                              const newStyles = [...wallStyles];
                              [newStyles[index], newStyles[index + 1]] = [newStyles[index + 1], newStyles[index]];
                              handleSaveWallStyles(newStyles);
                            }
                          }}
                          className="px-1.5 py-0.5 bg-white/70 hover:bg-white rounded text-xs disabled:opacity-30"
                          disabled={index === wallStyles.length - 1}
                        >
                          ⬇️
                        </button>
                      </div>
                    </div>
                    {expandedWalls.has(style.id) && (
                    <div className="p-4 space-y-4 bg-gray-50">
                      {/* Name & Toggle */}
                      <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
                        <div className="flex-1 mr-4">
                          <label className="text-xs font-medium text-gray-500 uppercase">Style Name</label>
                          <input
                            type="text"
                            value={style.name}
                            onChange={(e) => handleSaveWallStyles(wallStyles.map(s => s.id === style.id ? { ...s, name: e.target.value } : s))}
                            className="w-full font-semibold text-gray-800 border-b-2 border-teal-300 focus:border-teal-500 outline-none mt-1 py-1 bg-transparent"
                          />
                        </div>
                        <div className="flex flex-col items-center">
                          <label className="text-xs font-medium text-gray-500 uppercase mb-1">Status</label>
                          <button
                            onClick={() => handleSaveWallStyles(wallStyles.map(s => s.id === style.id ? { ...s, enabled: !s.enabled } : s))}
                            className={`relative w-14 h-7 rounded-full transition-colors ${style.enabled ? 'bg-teal-500' : 'bg-gray-300'}`}
                          >
                            <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${style.enabled ? 'left-8' : 'left-1'}`} />
                          </button>
                        </div>
                      </div>

                      {/* Appearance Settings */}
                      <div className="bg-white p-3 rounded-lg border border-gray-200">
                        <h4 className="text-xs font-semibold text-gray-600 uppercase mb-3 flex items-center gap-1">
                          <span>🎨</span> Appearance
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium text-gray-500">Color</label>
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="color"
                                value={style.color}
                                onChange={(e) => handleSaveWallStyles(wallStyles.map(s => s.id === style.id ? { ...s, color: e.target.value } : s))}
                                className="w-10 h-10 border-2 border-gray-300 rounded-lg cursor-pointer"
                              />
                              <input
                                type="text"
                                value={style.color}
                                onChange={(e) => handleSaveWallStyles(wallStyles.map(s => s.id === style.id ? { ...s, color: e.target.value } : s))}
                                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm font-mono uppercase"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500">Icon</label>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg border border-gray-200">
                                <span className="text-2xl">{style.icon}</span>
                              </div>
                              <EmojiPicker
                                value={style.icon}
                                onChange={(emoji) => handleSaveWallStyles(wallStyles.map(s => s.id === style.id ? { ...s, icon: emoji } : s))}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <label className="text-xs font-medium text-gray-500">Pattern</label>
                          <select
                            value={style.pattern || 'solid'}
                            onChange={(e) => handleSaveWallStyles(wallStyles.map(s => s.id === style.id ? { ...s, pattern: e.target.value as PatternType } : s))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mt-1"
                          >
                            {patternOptions.map(p => (
                              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Preview */}
                      <div className="bg-white p-3 rounded-lg border border-gray-200">
                        <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2 flex items-center gap-1">
                          <span>👁️</span> Preview
                        </h4>
                        <div 
                          className="h-24 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300"
                          style={{ backgroundColor: style.color }}
                        >
                          <div className="text-center">
                            <span className="text-4xl block">{style.icon}</span>
                            <span className="text-xs font-medium mt-1 px-2 py-0.5 bg-white/80 rounded" style={{ color: style.color === '#FFFFFF' || style.color === '#ffffff' ? '#374151' : 'inherit' }}>{style.name}</span>
                          </div>
                        </div>
                      </div>

                      {/* Image Gallery */}
                      <div className="bg-white p-3 rounded-lg border border-gray-200">
                        <h4 className="text-xs font-semibold text-gray-600 uppercase mb-2 flex items-center gap-1">
                          <span>🖼️</span> Reference Images
                        </h4>
                        <MultiImageUpload
                          images={style.images || []}
                          onChange={(images) => handleSaveWallStyles(wallStyles.map(s => s.id === style.id ? { ...s, images } : s))}
                          maxImages={4}
                          itemName="wall style"
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                        <button
                          onClick={() => {
                            const newStyle: WallStyle = {
                              ...style,
                              id: `wall-${Date.now()}`,
                              name: `${style.name} (Copy)`
                            };
                            handleSaveWallStyles([...wallStyles, newStyle]);
                          }}
                          className="px-3 py-1.5 text-teal-600 hover:bg-teal-50 rounded-lg text-sm font-medium flex items-center gap-1"
                        >
                          📋 Duplicate
                        </button>
                        <button
                          onClick={() => {
                            confirmAction(
                              { title: 'Delete wall style?', message: `Delete "${style.name}"? This cannot be undone.`, kind: 'danger', confirmLabel: 'Delete Style' },
                              () => handleSaveWallStyles(wallStyles.filter(s => s.id !== style.id)),
                            );
                          }}
                          className="px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-lg text-sm font-medium flex items-center gap-1"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Empty State */}
              {wallStyles.length === 0 && (
                <div className="bg-white rounded-xl p-12 text-center border-2 border-dashed border-gray-200">
                  <span className="text-6xl mb-4 block">🧱</span>
                  <h3 className="text-xl font-bold text-gray-700 mb-2">No Wall Styles Yet</h3>
                  <p className="text-gray-500 mb-4">Create decorative wall options for backdrops and photo areas</p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => {
                        const newStyle: WallStyle = {
                          id: `wall-${Date.now()}`,
                          name: 'New Wall Style',
                          color: '#FFFFFF',
                          icon: '🪟',
                          pattern: 'solid',
                          enabled: true
                        };
                        handleSaveWallStyles([...wallStyles, newStyle]);
                        setExpandedWalls(prev => new Set([...prev, newStyle.id]));
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg hover:from-teal-600 hover:to-emerald-600 font-medium"
                    >
                      ➕ Create Wall Style
                    </button>
                    <button
                      onClick={() => handleSaveWallStyles(defaultWallStyles)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                    >
                      📥 Load Defaults
                    </button>
                  </div>
                </div>
              )}

              {/* Tips Section */}
              <BrandedTips
                title="Tips for Wall Styles"
                config={config}
                tips={[
                  { icon: '🔗', title: 'Link to Fixtures', description: 'Go to Fixtures tab, create a wall fixture (name containing "wall"), then select a wall style' },
                  { icon: '🎨', title: 'Use Patterns', description: 'Choose "grass" for greenery walls, "brick" for rustic walls, etc.' },
                  { icon: '📷', title: 'Reference Images', description: 'Upload photos of real walls to help users visualize options' },
                  { icon: '↕️', title: 'Organize Order', description: 'Use the up/down arrows to put popular styles at the top' },
                  { icon: '⏸️', title: 'Disable Seasonal', description: 'Instead of deleting, disable styles that aren\'t currently available' }
                ]}
              />
            </div>
    </div>
  );
}
