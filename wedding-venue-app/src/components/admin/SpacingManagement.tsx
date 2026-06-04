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

export function SpacingManagement(props: AdminCommonProps) {
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
                icon="📐" 
                title="Spacing & Collision Settings" 
                description="Configure minimum spacing between items to ensure proper guest and server flow"
                config={config}
              />

              {/* Quick Presets */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                <h4 className="font-bold text-lg text-gray-800 mb-3 flex items-center gap-2">
                  ⚡ Quick Presets
                </h4>
                <p className="text-sm text-gray-500 mb-4">Apply recommended spacing settings for common event types</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { name: 'Intimate', icon: '💕', table: 2.5, wall: 1.5, fixture: 3, item: 2, desc: 'Cozy seating, close tables' },
                    { name: 'Standard', icon: '🎉', table: 3.5, wall: 2, fixture: 4, item: 2.5, desc: 'Balanced spacing for most events' },
                    { name: 'Comfortable', icon: '✨', table: 4, wall: 3, fixture: 5, item: 3, desc: 'Extra room for easy movement' },
                    { name: 'Accessible', icon: '♿', table: 5, wall: 4, fixture: 6, item: 4, desc: 'ADA-compliant spacing' }
                  ].map(preset => (
                    <button
                      key={preset.name}
                      onClick={() => {
                        const updated = { 
                          ...spacingSettings, 
                          minTableSpacing: preset.table,
                          minWallSpacing: preset.wall,
                          minFixtureSpacing: preset.fixture,
                          minItemSpacing: preset.item,
                          enableCollisionDetection: true
                        };
                        setSpacingSettings(updated);
                        setSpacingSettingsState(updated);
                        showSuccess(`Applied "${preset.name}" spacing preset!`);
                      }}
                      className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl hover:border-[#4A1942] hover:shadow-md transition-all text-left group"
                    >
                      <div className="text-2xl mb-2">{preset.icon}</div>
                      <div className="font-semibold text-gray-800 group-hover:text-[#4A1942]">{preset.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{preset.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Toggle */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${spacingSettings.enableCollisionDetection ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                      {spacingSettings.enableCollisionDetection ? '🛡️' : '⚠️'}
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-gray-800">Collision Detection</h4>
                      <p className="text-sm text-gray-500">Prevent items from being placed too close together</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={spacingSettings.enableCollisionDetection}
                      onChange={(e) => {
                        const updated = { ...spacingSettings, enableCollisionDetection: e.target.checked };
                        setSpacingSettings(updated);
                        setSpacingSettingsState(updated);
                        showSuccess(e.target.checked ? 'Collision detection enabled!' : 'Collision detection disabled!');
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#4A1942]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-[#4A1942]"></div>
                    <span className="ml-3 text-sm font-medium text-gray-700">{spacingSettings.enableCollisionDetection ? 'ON' : 'OFF'}</span>
                  </label>
                </div>

                {/* Warning Toggle */}
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🔔</span>
                    <div>
                      <span className="font-medium text-gray-700">Show Warning Messages</span>
                      <p className="text-xs text-gray-500">Alert users when items can't be placed</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={spacingSettings.showCollisionWarnings !== false}
                      onChange={(e) => {
                        const updated = { ...spacingSettings, showCollisionWarnings: e.target.checked };
                        setSpacingSettings(updated);
                        setSpacingSettingsState(updated);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#4A1942]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4A1942]"></div>
                  </label>
                </div>
              </div>

              {/* Spacing Controls Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Table-to-Table Spacing */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-xl">🪑</div>
                    <div>
                      <h4 className="font-bold text-gray-800">Table-to-Table Spacing</h4>
                      <p className="text-xs text-gray-500">Space between tables (includes chairs)</p>
                    </div>
                  </div>
                  
                  {/* Visual Diagram */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <svg viewBox="0 0 200 80" className="w-full h-20">
                      {/* Table 1 */}
                      <rect x="20" y="20" width="50" height="40" rx="25" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="1"/>
                      <circle cx="45" cy="40" r="8" fill="#6B7280"/>
                      <text x="45" y="44" textAnchor="middle" fill="white" fontSize="8">T1</text>
                      
                      {/* Spacing Arrow */}
                      <line x1="73" y1="40" x2="127" y2="40" stroke="#4A1942" strokeWidth="2" markerEnd="url(#arrowhead)"/>
                      <line x1="73" y1="40" x2="127" y2="40" stroke="#4A1942" strokeWidth="2" markerStart="url(#arrowhead)"/>
                      <text x="100" y="25" textAnchor="middle" fill="#4A1942" fontSize="10" fontWeight="bold">{spacingSettings.minTableSpacing || 3}ft</text>
                      
                      {/* Table 2 */}
                      <rect x="130" y="20" width="50" height="40" rx="25" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="1"/>
                      <circle cx="155" cy="40" r="8" fill="#6B7280"/>
                      <text x="155" y="44" textAnchor="middle" fill="white" fontSize="8">T2</text>
                      
                      <defs>
                        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                          <polygon points="0 0, 10 3.5, 0 7" fill="#4A1942"/>
                        </marker>
                      </defs>
                    </svg>
                  </div>
                  
                  {/* Value Input + Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-gray-600">Minimum spacing:</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="1"
                          value={Math.max(0, Math.min(10, Math.round(spacingSettings.minTableSpacing || 3)))}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(10, Math.round(Number(e.target.value) || 0)));
                            const updated = { ...spacingSettings, minTableSpacing: val };
                            setSpacingSettings(updated);
                            setSpacingSettingsState(updated);
                          }}
                          className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm text-right"
                        />
                        <span className="text-sm text-gray-500">ft</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="1"
                      value={Math.max(0, Math.min(10, Math.round(spacingSettings.minTableSpacing || 3)))}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(10, Math.round(Number(e.target.value) || 0)));
                        const updated = { ...spacingSettings, minTableSpacing: val };
                        setSpacingSettings(updated);
                        setSpacingSettingsState(updated);
                      }}
                      className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#4A1942]"
                    />
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>0 ft</span>
                      <span>5 ft</span>
                      <span>10 ft</span>
                    </div>
                  </div>
                  
                  {/* Quick Buttons */}
                  <div className="flex gap-2 mt-3">
                    {[0, 1, 2, 3, 4, 5, 8, 10].map(val => (
                      <button
                        key={val}
                        onClick={() => {
                          const updated = { ...spacingSettings, minTableSpacing: val };
                          setSpacingSettings(updated);
                          setSpacingSettingsState(updated);
                        }}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          (spacingSettings.minTableSpacing || 3) === val 
                            ? 'bg-[#4A1942] text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {val}ft
                      </button>
                    ))}
                  </div>
                </div>

                {/* Wall Spacing */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-xl">🧱</div>
                    <div>
                      <h4 className="font-bold text-gray-800">Wall Spacing</h4>
                      <p className="text-xs text-gray-500">Minimum distance from venue walls</p>
                    </div>
                  </div>
                  
                  {/* Visual Diagram */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <svg viewBox="0 0 200 80" className="w-full h-20">
                      {/* Wall */}
                      <rect x="10" y="10" width="10" height="60" fill="#92400E" rx="2"/>
                      <text x="15" y="75" textAnchor="middle" fill="#92400E" fontSize="6">WALL</text>
                      
                      {/* Spacing Arrow */}
                      <line x1="25" y1="40" x2="60" y2="40" stroke="#4A1942" strokeWidth="2"/>
                      <text x="42" y="30" textAnchor="middle" fill="#4A1942" fontSize="10" fontWeight="bold">{spacingSettings.minWallSpacing || 2}ft</text>
                      
                      {/* Table with chairs */}
                      <rect x="65" y="20" width="60" height="40" rx="20" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="1"/>
                      <circle cx="95" cy="40" r="10" fill="#6B7280"/>
                      <text x="95" y="44" textAnchor="middle" fill="white" fontSize="10">🪑</text>
                      
                      {/* Chairs indicators */}
                      <circle cx="55" cy="30" r="5" fill="#D1D5DB"/>
                      <circle cx="55" cy="50" r="5" fill="#D1D5DB"/>
                    </svg>
                  </div>
                  
                  {/* Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Minimum spacing:</span>
                      <span className="font-bold text-[#4A1942] text-lg">{spacingSettings.minWallSpacing || 2} ft</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="8"
                      step="0.5"
                      value={spacingSettings.minWallSpacing || 2}
                      onChange={(e) => {
                        const updated = { ...spacingSettings, minWallSpacing: parseFloat(e.target.value) };
                        setSpacingSettings(updated);
                        setSpacingSettingsState(updated);
                      }}
                      className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#4A1942]"
                    />
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>0 ft</span>
                      <span>4 ft</span>
                      <span>8 ft</span>
                    </div>
                  </div>
                  
                  {/* Quick Buttons */}
                  <div className="flex gap-2 mt-3">
                    {[1, 2, 3, 4, 5].map(val => (
                      <button
                        key={val}
                        onClick={() => {
                          const updated = { ...spacingSettings, minWallSpacing: val };
                          setSpacingSettings(updated);
                          setSpacingSettingsState(updated);
                        }}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          (spacingSettings.minWallSpacing || 2) === val 
                            ? 'bg-[#4A1942] text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {val}ft
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fixture Spacing */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-xl">💃</div>
                    <div>
                      <h4 className="font-bold text-gray-800">Fixture Spacing</h4>
                      <p className="text-xs text-gray-500">Space around dance floor, bar, buffet, etc.</p>
                    </div>
                  </div>
                  
                  {/* Visual Diagram */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <svg viewBox="0 0 200 80" className="w-full h-20">
                      {/* Dance Floor */}
                      <rect x="60" y="15" width="80" height="50" fill="#D8B4FE" stroke="#A855F7" strokeWidth="2" rx="4"/>
                      <text x="100" y="45" textAnchor="middle" fill="#7E22CE" fontSize="10" fontWeight="bold">💃 Dance Floor</text>
                      
                      {/* Spacing indicators */}
                      <line x1="50" y1="40" x2="60" y2="40" stroke="#4A1942" strokeWidth="2" strokeDasharray="2,2"/>
                      <line x1="140" y1="40" x2="150" y2="40" stroke="#4A1942" strokeWidth="2" strokeDasharray="2,2"/>
                      
                      {/* Tables nearby */}
                      <circle cx="30" cy="40" r="12" fill="#E5E7EB" stroke="#9CA3AF"/>
                      <circle cx="170" cy="40" r="12" fill="#E5E7EB" stroke="#9CA3AF"/>
                      
                      {/* Label */}
                      <text x="100" y="75" textAnchor="middle" fill="#4A1942" fontSize="9">{spacingSettings.minFixtureSpacing || 4}ft clearance</text>
                    </svg>
                  </div>
                  
                  {/* Slider */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Minimum spacing:</span>
                      <span className="font-bold text-[#4A1942] text-lg">{spacingSettings.minFixtureSpacing || 4} ft</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="12"
                      step="0.5"
                      value={spacingSettings.minFixtureSpacing || 4}
                      onChange={(e) => {
                        const updated = { ...spacingSettings, minFixtureSpacing: parseFloat(e.target.value) };
                        setSpacingSettings(updated);
                        setSpacingSettingsState(updated);
                      }}
                      className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#4A1942]"
                    />
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>1 ft</span>
                      <span>6 ft</span>
                      <span>12 ft</span>
                    </div>
                  </div>
                  
                  {/* Quick Buttons */}
                  <div className="flex gap-2 mt-3">
                    {[3, 4, 5, 6, 8].map(val => (
                      <button
                        key={val}
                        onClick={() => {
                          const updated = { ...spacingSettings, minFixtureSpacing: val };
                          setSpacingSettings(updated);
                          setSpacingSettingsState(updated);
                        }}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          (spacingSettings.minFixtureSpacing || 4) === val 
                            ? 'bg-[#4A1942] text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {val}ft
                      </button>
                    ))}
                  </div>
                </div>

                {/* General Item Spacing */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-xl">📦</div>
                    <div>
                      <h4 className="font-bold text-gray-800">General Item Spacing</h4>
                      <p className="text-xs text-gray-500">Default spacing for all other items</p>
                    </div>
                  </div>
                  
                  {/* Slider */}
                  <div className="space-y-2 mt-8">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Minimum spacing:</span>
                      <span className="font-bold text-[#4A1942] text-lg">{spacingSettings.minItemSpacing || 2} ft</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="6"
                      step="0.5"
                      value={spacingSettings.minItemSpacing || 2}
                      onChange={(e) => {
                        const updated = { ...spacingSettings, minItemSpacing: parseFloat(e.target.value) };
                        setSpacingSettings(updated);
                        setSpacingSettingsState(updated);
                      }}
                      className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#4A1942]"
                    />
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>0 ft</span>
                      <span>3 ft</span>
                      <span>6 ft</span>
                    </div>
                  </div>
                  
                  {/* Quick Buttons */}
                  <div className="flex gap-2 mt-3">
                    {[1, 1.5, 2, 2.5, 3].map(val => (
                      <button
                        key={val}
                        onClick={() => {
                          const updated = { ...spacingSettings, minItemSpacing: val };
                          setSpacingSettings(updated);
                          setSpacingSettingsState(updated);
                        }}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                          (spacingSettings.minItemSpacing || 2) === val 
                            ? 'bg-[#4A1942] text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {val}ft
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Current Settings Summary */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-5 rounded-xl border border-blue-200">
                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  📋 Current Settings Summary
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-white p-3 rounded-lg shadow-sm text-center">
                    <div className="text-2xl mb-1">🪑↔️🪑</div>
                    <div className="text-xl font-bold text-[#4A1942]">{spacingSettings.minTableSpacing || 3}ft</div>
                    <div className="text-xs text-gray-500">Table to Table</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm text-center">
                    <div className="text-2xl mb-1">🧱↔️🪑</div>
                    <div className="text-xl font-bold text-[#4A1942]">{spacingSettings.minWallSpacing || 2}ft</div>
                    <div className="text-xs text-gray-500">Wall to Item</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm text-center">
                    <div className="text-2xl mb-1">💃↔️🪑</div>
                    <div className="text-xl font-bold text-[#4A1942]">{spacingSettings.minFixtureSpacing || 4}ft</div>
                    <div className="text-xs text-gray-500">Fixture to Item</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg shadow-sm text-center">
                    <div className="text-2xl mb-1">📦↔️📦</div>
                    <div className="text-xl font-bold text-[#4A1942]">{spacingSettings.minItemSpacing || 2}ft</div>
                    <div className="text-xs text-gray-500">General Items</div>
                  </div>
                </div>
              </div>

              {/* Best Practices Guide */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                <h4 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
                  💡 Spacing Best Practices
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <h5 className="font-semibold text-blue-800 mb-2">🍽️ Dining Areas</h5>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• <strong>3-4 feet</strong> between tables for server access</li>
                      <li>• <strong>18 inches</strong> behind chairs for guests to sit</li>
                      <li>• <strong>36 inches</strong> main aisles for wheelchair access</li>
                    </ul>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                    <h5 className="font-semibold text-purple-800 mb-2">💃 Dance Floor</h5>
                    <ul className="text-sm text-purple-700 space-y-1">
                      <li>• <strong>4-6 feet</strong> clearance around dance floor</li>
                      <li>• <strong>9 sq ft</strong> per dancer (standing)</li>
                      <li>• <strong>2 feet</strong> buffer from speakers</li>
                    </ul>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                    <h5 className="font-semibold text-amber-800 mb-2">🍰 Buffet & Bar</h5>
                    <ul className="text-sm text-amber-700 space-y-1">
                      <li>• <strong>5-6 feet</strong> in front for queue lines</li>
                      <li>• <strong>3 feet</strong> behind for staff access</li>
                      <li>• <strong>8 feet</strong> wide aisles for two-way flow</li>
                    </ul>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                    <h5 className="font-semibold text-green-800 mb-2">♿ Accessibility</h5>
                    <ul className="text-sm text-green-700 space-y-1">
                      <li>• <strong>36 inches</strong> minimum aisle width</li>
                      <li>• <strong>60 inches</strong> for wheelchair turning</li>
                      <li>• <strong>48 inches</strong> at table ends for access</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <button
                  onClick={() => showSuccess('Spacing settings saved successfully!')}
                  className="px-8 py-3 bg-gradient-to-r from-[#4A1942] to-[#6B2C5F] text-white rounded-xl hover:opacity-90 transition-all font-semibold shadow-lg flex items-center gap-2"
                >
                  ✓ Save Spacing Settings
                </button>
              </div>
            </div>
    </div>
  );
}
