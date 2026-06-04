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

export function ChairManagement(props: AdminCommonProps) {
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
                icon="🪑" 
                title="Chair Types" 
                description="Manage chair styles for tables, ceremonies, and events"
                config={config}
              />

              {/* Quick Statistics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 text-center">
                  <div className="text-3xl mb-1">🪑</div>
                  <div className="text-2xl font-bold text-amber-600">{chairSpecs.filter(c => c.id !== 'none').length}</div>
                  <div className="text-xs text-gray-500">Chair Types</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 text-center">
                  <div className="text-3xl mb-1">📦</div>
                  <div className="text-2xl font-bold text-green-600">
                    {chairSpecs.filter(c => c.inventoryCount !== undefined && c.inventoryCount > 0).reduce((sum, c) => sum + (c.inventoryCount || 0), 0)}
                  </div>
                  <div className="text-xs text-gray-500">Total Inventory</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 text-center">
                  <div className="text-3xl mb-1">📐</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {chairSpecs.length > 0 ? (chairSpecs.filter(c => c.id !== 'none').reduce((sum, c) => sum + (c.width || 1.5), 0) / Math.max(1, chairSpecs.filter(c => c.id !== 'none').length)).toFixed(1) : 0}ft
                  </div>
                  <div className="text-xs text-gray-500">Avg. Width</div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                  <div className="text-xs text-gray-500 mb-2">Color Palette</div>
                  <div className="flex flex-wrap gap-1">
                    {chairSpecs.filter(c => c.id !== 'none').slice(0, 8).map(c => (
                      <div 
                        key={c.id}
                        className="w-6 h-6 rounded border border-gray-300" 
                        style={{ backgroundColor: c.color }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick Add Presets */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                <h4 className="font-bold text-lg text-gray-800 mb-3 flex items-center gap-2">
                  ⚡ Quick Add Chair Presets
                </h4>
                <p className="text-sm text-gray-500 mb-4">Add common wedding chair styles with one click</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {[
                    { name: 'Classic Collection', icon: '👑', chairs: [
                      { name: 'Chiavari Gold', color: '#D4AF37', icon: '✨' },
                      { name: 'Chiavari Silver', color: '#C0C0C0', icon: '🪑' },
                      { name: 'Chiavari White', color: '#FFFFFF', icon: '🪑' }
                    ]},
                    { name: 'Modern Elegance', icon: '🎨', chairs: [
                      { name: 'Ghost Chair', color: '#E8E8E8', icon: '🪑' },
                      { name: 'Acrylic Clear', color: '#F5F5F5', icon: '💎' },
                      { name: 'Lucite White', color: '#FFFFFF', icon: '✨' }
                    ]},
                    { name: 'Rustic & Natural', icon: '🌿', chairs: [
                      { name: 'Cross Back Wood', color: '#8B4513', icon: '🪵' },
                      { name: 'Vineyard Oak', color: '#A0522D', icon: '🌳' },
                      { name: 'Farm Bench', color: '#DEB887', icon: '🪵' }
                    ]},
                    { name: 'Garden Party', icon: '🌸', chairs: [
                      { name: 'White Resin', color: '#FFFFFF', icon: '⬜' },
                      { name: 'Folding White', color: '#F8F8F8', icon: '🪑' },
                      { name: 'Garden Lattice', color: '#FFFAF0', icon: '🌿' }
                    ]},
                    { name: 'Ceremony Seating', icon: '💒', chairs: [
                      { name: 'Padded Ceremony', color: '#F5F5DC', icon: '💺' },
                      { name: 'Church Pew', color: '#654321', icon: '⛪' },
                      { name: 'Ceremony Bench', color: '#D2B48C', icon: '🪵' }
                    ]}
                  ].map(preset => (
                    <button
                      key={preset.name}
                      onClick={() => {
                        const existingNames = chairSpecs.map(c => c.name.toLowerCase());
                        const newChairs = preset.chairs
                          .filter(c => !existingNames.includes(c.name.toLowerCase()))
                          .map((c, i) => ({
                            id: `chair-${Date.now()}-${i}` as ChairType,
                            name: c.name,
                            color: c.color,
                            width: 1.5,
                            depth: 1.5,
                            icon: c.icon
                          }));
                        if (newChairs.length > 0) {
                          const updated = [...chairSpecs, ...newChairs];
                          setChairSpecs(updated);
                          setChairSpecsState(updated);
                          showSuccess(`Added ${newChairs.length} chairs from "${preset.name}"!`);
                        } else {
                          showSuccess('All chairs from this preset already exist!');
                        }
                      }}
                      className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl hover:border-amber-400 hover:shadow-md transition-all text-left group"
                    >
                      <div className="text-2xl mb-2">{preset.icon}</div>
                      <div className="font-semibold text-amber-800 group-hover:text-amber-600 text-sm">{preset.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{preset.chairs.length} chairs</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="flex flex-wrap gap-1">
                    {chairSpecs.filter(c => c.id !== 'none').slice(0, 5).map(c => (
                      <span key={c.id} className="text-xl" title={c.name}>{c.icon || '🪑'}</span>
                    ))}
                    {chairSpecs.filter(c => c.id !== 'none').length > 5 && (
                      <span className="text-sm text-gray-400">+{chairSpecs.filter(c => c.id !== 'none').length - 5}</span>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">
                    {chairSpecs.filter(c => c.id !== 'none').length} chair type{chairSpecs.filter(c => c.id !== 'none').length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      const allIds = chairSpecs.filter(c => c.id !== 'none').map(c => c.id);
                      if (expandedChairs.size === allIds.length) {
                        setExpandedChairs(new Set());
                      } else {
                        setExpandedChairs(new Set(allIds));
                      }
                    }}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                  >
                    {expandedChairs.size === chairSpecs.filter(c => c.id !== 'none').length ? '▲ Collapse All' : '▼ Expand All'}
                  </button>
                  <button
                    onClick={() => {
                      const newChair: ChairSpec = {
                        id: `chair-${Date.now()}` as ChairType,
                        name: 'New Chair',
                        color: '#FFFFFF',
                        width: 1.5,
                        depth: 1.5,
                        icon: '🪑'
                      };
                      const updated = [...chairSpecs, newChair];
                      setChairSpecs(updated);
                      setChairSpecsState(updated);
                      setExpandedChairs(prev => new Set([...prev, newChair.id]));
                      showSuccess('Chair added!');
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all font-medium shadow-sm"
                  >
                    ➕ Add Chair Type
                  </button>
                </div>
              </div>

              {/* Chair Type Legend */}
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                <div className="flex flex-wrap gap-4 items-center text-sm">
                  <span className="font-medium text-amber-800">Chair Features:</span>
                  <span className="flex items-center gap-1"><span className="w-4 h-4 bg-white border border-gray-300 rounded"></span> Color</span>
                  <span className="flex items-center gap-1">📦 Inventory</span>
                  <span className="flex items-center gap-1">📐 Dimensions</span>
                  <span className="flex items-center gap-1">📷 Images</span>
                </div>
              </div>

              {/* Chair Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {chairSpecs.filter(c => c.id !== 'none').map((chair) => (
                  <div key={chair.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                    {/* Chair Header */}
                    <div 
                      className="p-4 cursor-pointer transition-colors"
                      style={{ backgroundColor: chair.color, borderBottom: '3px solid rgba(0,0,0,0.1)' }}
                      onClick={() => {
                        const newSet = new Set(expandedChairs);
                        if (newSet.has(chair.id)) {
                          newSet.delete(chair.id);
                        } else {
                          newSet.add(chair.id);
                        }
                        setExpandedChairs(newSet);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{expandedChairs.has(chair.id) ? '▼' : '▶'}</span>
                          <div className="w-12 h-12 bg-white/80 rounded-xl flex items-center justify-center text-2xl shadow-sm">
                            {chair.icon || '🪑'}
                          </div>
                          <div>
                            <div className="font-bold text-gray-800">{chair.name}</div>
                            <div className="text-xs text-gray-600 flex items-center gap-2">
                              <span>📐 {chair.width}' × {chair.depth}'</span>
                              {chair.inventoryCount !== undefined && (
                                <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-xs">
                                  📦 {chair.inventoryCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Duplicate chair
                              const newChair: ChairSpec = {
                                ...chair,
                                id: `chair-${Date.now()}` as ChairType,
                                name: `${chair.name} (Copy)`
                              };
                              const updated = [...chairSpecs, newChair];
                              setChairSpecs(updated);
                              setChairSpecsState(updated);
                              setExpandedChairs(prev => new Set([...prev, newChair.id]));
                              showSuccess('Chair duplicated!');
                            }}
                            className="p-1.5 bg-white/80 hover:bg-white rounded-lg text-gray-600 hover:text-blue-600 transition-colors"
                            title="Duplicate"
                          >
                            📋
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmAction(
                                { title: 'Delete chair type?', message: `Delete chair type "${chair.name}"?`, kind: 'danger', confirmLabel: 'Delete Chair' },
                                () => {
                                  const updated = chairSpecs.filter(c => c.id !== chair.id);
                                  setChairSpecs(updated);
                                  setChairSpecsState(updated);
                                  showSuccess('Chair deleted!');
                                },
                              );
                            }}
                            className="p-1.5 bg-white/80 hover:bg-white rounded-lg text-gray-600 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Chair Details - Collapsible */}
                    {expandedChairs.has(chair.id) && (
                    <div className="p-4 space-y-4 bg-gray-50">
                      {/* Name & Dimensions Row */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <h5 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                          📝 Basic Info
                        </h5>
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-medium text-gray-500">Chair Name</label>
                            <input
                              type="text"
                              value={chair.name}
                              onChange={(e) => {
                                const updated = chairSpecs.map(c => c.id === chair.id ? { ...c, name: e.target.value } : c);
                                setChairSpecs(updated);
                                setChairSpecsState(updated);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-medium text-gray-500">Width (ft)</label>
                              <input
                                type="number"
                                step="0.25"
                                min="0.5"
                                max="5"
                                value={chair.width}
                                onChange={(e) => {
                                  const updated = chairSpecs.map(c => c.id === chair.id ? { ...c, width: parseFloat(e.target.value) || 1.5 } : c);
                                  setChairSpecs(updated);
                                  setChairSpecsState(updated);
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500">Depth (ft)</label>
                              <input
                                type="number"
                                step="0.25"
                                min="0.5"
                                max="5"
                                value={chair.depth}
                                onChange={(e) => {
                                  const updated = chairSpecs.map(c => c.id === chair.id ? { ...c, depth: parseFloat(e.target.value) || 1.5 } : c);
                                  setChairSpecs(updated);
                                  setChairSpecsState(updated);
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Appearance Row */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <h5 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                          🎨 Appearance
                        </h5>
                        <div className="grid grid-cols-2 gap-4">
                          {/* Color */}
                          <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Chair Color</label>
                            <div className="flex gap-2">
                              <input
                                type="color"
                                value={chair.color}
                                onChange={(e) => {
                                  const updated = chairSpecs.map(c => c.id === chair.id ? { ...c, color: e.target.value } : c);
                                  setChairSpecs(updated);
                                  setChairSpecsState(updated);
                                }}
                                className="w-12 h-10 border-2 border-gray-300 rounded-lg cursor-pointer shadow-sm"
                              />
                              <input
                                type="text"
                                value={chair.color}
                                onChange={(e) => {
                                  const updated = chairSpecs.map(c => c.id === chair.id ? { ...c, color: e.target.value } : c);
                                  setChairSpecs(updated);
                                  setChairSpecsState(updated);
                                }}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                                placeholder="#FFFFFF"
                              />
                            </div>
                          </div>
                          {/* Icon */}
                          <div>
                            <label className="text-xs font-medium text-gray-500 mb-1 block">Icon/Emoji</label>
                            <div className="flex gap-2 items-center">
                              <EmojiPicker
                                value={chair.icon || '🪑'}
                                onChange={(emoji) => {
                                  const updated = chairSpecs.map(c => c.id === chair.id ? { ...c, icon: emoji } : c);
                                  setChairSpecs(updated);
                                  setChairSpecsState(updated);
                                }}
                                position="auto"
                              />
                              <div className="flex-1 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200 text-center">
                                <span className="text-2xl">{chair.icon || '🪑'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Color Presets */}
                        <div className="mt-3">
                          <label className="text-xs font-medium text-gray-500 mb-2 block">Quick Colors</label>
                          <div className="flex flex-wrap gap-1">
                            {['#FFFFFF', '#F5F5DC', '#D4AF37', '#C0C0C0', '#8B4513', '#654321', '#000000', '#FFB6C1', '#E8E8E8', '#F0E68C'].map(color => (
                              <button
                                key={color}
                                onClick={() => {
                                  const updated = chairSpecs.map(c => c.id === chair.id ? { ...c, color } : c);
                                  setChairSpecs(updated);
                                  setChairSpecsState(updated);
                                }}
                                className={`w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110 ${chair.color === color ? 'border-amber-500 ring-2 ring-amber-200' : 'border-gray-300'}`}
                                style={{ backgroundColor: color }}
                                title={color}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Inventory */}
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <h5 className="font-medium text-green-700 mb-3 flex items-center gap-2">
                          📦 Inventory Management
                        </h5>
                        <div className="flex flex-wrap gap-3 items-center">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="9999"
                              value={chair.inventoryCount ?? ''}
                              onChange={(e) => {
                                const value = e.target.value === '' ? undefined : parseInt(e.target.value);
                                const updated = chairSpecs.map(c => c.id === chair.id ? { ...c, inventoryCount: value } : c);
                                setChairSpecs(updated);
                                setChairSpecsState(updated);
                              }}
                              className="w-24 px-3 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-center"
                              placeholder="∞"
                            />
                            <span className="text-sm text-green-600 font-medium">
                              {chair.inventoryCount === undefined ? 'Unlimited' : `chairs available`}
                            </span>
                          </div>
                          {chair.inventoryCount !== undefined && (
                            <button
                              onClick={() => {
                                const updated = chairSpecs.map(c => c.id === chair.id ? { ...c, inventoryCount: undefined } : c);
                                setChairSpecs(updated);
                                setChairSpecsState(updated);
                              }}
                              className="px-3 py-1.5 bg-green-200 text-green-700 rounded-lg hover:bg-green-300 transition-colors text-sm"
                            >
                              Set Unlimited
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Images */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <h5 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                          📷 Reference Images
                        </h5>
                        <MultiImageUpload
                          images={chair.images || []}
                          onChange={(images) => {
                            const updated = chairSpecs.map(c => c.id === chair.id ? { ...c, images } : c);
                            setChairSpecs(updated);
                            setChairSpecsState(updated);
                          }}
                          maxImages={4}
                          itemName="chair"
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => showSuccess('Chair saved!')}
                          className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all font-medium shadow-sm"
                        >
                          ✓ Save Chair
                        </button>
                        <button
                          onClick={() => {
                            const newChair: ChairSpec = {
                              ...chair,
                              id: `chair-${Date.now()}` as ChairType,
                              name: `${chair.name} (Copy)`
                            };
                            const updated = [...chairSpecs, newChair];
                            setChairSpecs(updated);
                            setChairSpecsState(updated);
                            showSuccess('Chair duplicated!');
                          }}
                          className="px-4 py-2.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium"
                        >
                          📋 Duplicate
                        </button>
                      </div>
                    </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Empty State */}
              {chairSpecs.filter(c => c.id !== 'none').length === 0 && (
                <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-amber-300">
                  <div className="text-6xl mb-4">🪑</div>
                  <h4 className="text-xl font-bold text-gray-700 mb-2">No Chair Types Yet</h4>
                  <p className="text-gray-500 mb-6">Add chair types to use in your layouts</p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => {
                        const newChair: ChairSpec = {
                          id: `chair-${Date.now()}` as ChairType,
                          name: 'New Chair',
                          color: '#FFFFFF',
                          width: 1.5,
                          depth: 1.5,
                          icon: '🪑'
                        };
                        const updated = [...chairSpecs, newChair];
                        setChairSpecs(updated);
                        setChairSpecsState(updated);
                        setExpandedChairs(new Set([newChair.id]));
                      }}
                      className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all font-medium shadow-sm"
                    >
                      ➕ Add Chair Type
                    </button>
                    <button
                      onClick={() => {
                        const defaultChairs: ChairSpec[] = [
                          { id: 'white-plastic' as ChairType, name: 'White Resin', color: '#FFFFFF', width: 1.5, depth: 1.5, icon: '⬜' },
                          { id: 'chiavari-gold' as ChairType, name: 'Chiavari Gold', color: '#D4AF37', width: 1.5, depth: 1.5, icon: '✨' },
                          { id: 'chiavari-silver' as ChairType, name: 'Chiavari Silver', color: '#C0C0C0', width: 1.5, depth: 1.5, icon: '🪑' },
                          { id: 'crossback' as ChairType, name: 'Cross Back Wood', color: '#8B4513', width: 1.5, depth: 1.5, icon: '🪵' },
                          { id: 'ghost' as ChairType, name: 'Ghost Chair', color: '#E8E8E8', width: 1.5, depth: 1.5, icon: '💎' },
                          { id: 'folding-white' as ChairType, name: 'Folding White', color: '#F8F8F8', width: 1.5, depth: 1.5, icon: '🪑' },
                          { id: 'padded-ceremony' as ChairType, name: 'Padded Ceremony', color: '#F5F5DC', width: 1.5, depth: 1.5, icon: '💺' },
                          { id: 'vineyard' as ChairType, name: 'Vineyard Oak', color: '#A0522D', width: 1.5, depth: 1.5, icon: '🌳' }
                        ];
                        setChairSpecs([...chairSpecs, ...defaultChairs]);
                        setChairSpecsState([...chairSpecs, ...defaultChairs]);
                        showSuccess('Added 8 default chair types!');
                      }}
                      className="px-5 py-2.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors font-medium"
                    >
                      🎨 Load Defaults
                    </button>
                  </div>
                </div>
              )}

              {/* Tips */}
              <BrandedTips
                title="Tips for Managing Chair Types"
                config={config}
                tips={[
                  { icon: '📐', title: 'Dimensions', description: 'Standard chairs are typically 1.5\' × 1.5\'. Larger throne chairs may be 2\' × 2\'.' },
                  { icon: '🎨', title: 'Colors', description: 'Match chair colors to your wedding theme. Use the color picker or enter exact hex codes.' },
                  { icon: '📦', title: 'Inventory', description: 'Set inventory limits to prevent over-booking. Leave blank for unlimited.' },
                  { icon: '📷', title: 'Images', description: 'Upload photos of actual chairs for client reference during planning.' },
                  { icon: '✨', title: 'Presets', description: 'Use quick add presets to quickly add popular chair styles like Chiavari and Ghost chairs.' }
                ]}
              />
            </div>
    </div>
  );
}
