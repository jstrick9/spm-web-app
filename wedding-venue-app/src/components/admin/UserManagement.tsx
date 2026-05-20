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

export function UserManagement(props: AdminCommonProps) {
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
              {/* Header */}
              <BrandedSectionHeader
                icon="👥"
                title="User Management"
                description="Create, manage, and configure user accounts and permissions"
                config={config}
              />

              {/* Quick Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl shadow-sm">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowCreateUserModal(true)}
                    className="px-4 py-2.5 bg-gradient-to-r from-[#4A1942] to-[#6b2a64] text-white rounded-lg hover:shadow-lg transition-all font-medium flex items-center gap-2"
                  >
                    <span className="text-lg">➕</span> Add User
                  </button>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-purple-500 rounded-full"></span> Admin
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-blue-500 rounded-full"></span> Basic
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-gray-300 rounded-full"></span> Inactive
                  </span>
                </div>
              </div>
              
              {/* Direct Messages (Admin) */}
              {user?.role === 'admin' && (() => {
                const masterUsers = users.filter(
                  (u) => u.role === 'basic' && (u.userRole === 'master' || u.isMasterUser),
                );
                const selectedMaster =
                  masterUsers.find((u) => u.id === selectedMessageMasterUserId) || masterUsers[0] || null;
                const selectedEventName = selectedMaster?.eventName || selectedMaster?.department || 'general';
                const threadId = selectedMaster
                  ? buildMessageThreadId(selectedEventName, selectedMaster.id)
                  : '';
                const newMessageCount = masterUsers.reduce((sum, m) => {
                  const eventName = m.eventName || m.department || 'general';
                  const tId = buildMessageThreadId(eventName, m.id);
                  return sum + directMessages.unreadCountForRole(tId, 'admin');
                }, 0);

                return (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowUserDirectMessagesSection(v => !v)}
                      className="w-full px-4 py-3 bg-purple-50 hover:bg-purple-100 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">{showUserDirectMessagesSection ? '▼' : '▶'}</span>
                        <h4 className="text-sm font-semibold text-gray-800">Direct Messages</h4>
                        {newMessageCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                            {newMessageCount} new
                          </span>
                        )}
                      </div>
                    </button>
                    {showUserDirectMessagesSection && (
                      <div className="p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs text-gray-500">Admin ↔ Master Basic User communication thread by event.</p>
                          {masterUsers.length > 0 && (
                            <select
                              value={selectedMaster?.id || ''}
                              onChange={(e) => setSelectedMessageMasterUserId(e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4A1942] focus:border-transparent min-w-[260px]"
                            >
                              {masterUsers.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name} ({m.eventName || m.department || 'General Event'})
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        {selectedMaster && threadId ? (
                          <div className="mt-4">
                            <DirectMessagePanel
                              title={`Chat with ${selectedMaster.name}`}
                              threadId={threadId}
                              currentUserId={user.id}
                              currentUserName={user.name}
                              currentUserRole="admin"
                            />
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-gray-500">
                            No master basic users available yet. Create a Basic User with User Role set to Master.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Pending Approvals (Admin) */}
              {user?.role === 'admin' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowUserPendingApprovalsSection(v => !v)}
                    className="w-full px-4 py-3 bg-amber-50 hover:bg-amber-100 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">{showUserPendingApprovalsSection ? '▼' : '▶'}</span>
                      <h4 className="text-sm font-semibold text-gray-800">Pending Approvals</h4>
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                        {submissionWorkflow.pendingCount}
                      </span>
                    </div>
                  </button>
                  {showUserPendingApprovalsSection && (
                    <div className="p-4">
                      <AdminSubmissionQueue
                        submissions={submissionWorkflow.submissions}
                        pendingCount={submissionWorkflow.pendingCount}
                        adminUserId={user.id}
                        adminName={user.name}
                        onReview={submissionWorkflow.review}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Manage Event Roles (Admin) */}
              {user?.role === 'admin' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowUserEventRolesSection(v => !v)}
                    className="w-full px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">{showUserEventRolesSection ? '▼' : '▶'}</span>
                      <h4 className="text-sm font-semibold text-gray-800">Manage Event Roles</h4>
                    </div>
                  </button>
                  {showUserEventRolesSection && (
                    <div className="p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-gray-500">Create role options used in Basic User Event Role dropdowns.</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newEventRoleName}
                            onChange={(e) => setNewEventRoleName(e.target.value)}
                            placeholder="Add Event Role"
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
                          />
                          <button
                            type="button"
                            onClick={handleAddEventRole}
                            className="px-3 py-2 bg-[#4A1942] text-white rounded-lg text-sm hover:bg-[#3d1a45]"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                      <ul className="mt-3 space-y-2">
                        {eventRoles.map((role) => (
                          <li key={role} className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2">
                            {editingEventRoleName === role ? (
                              <div className="flex-1 flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingEventRoleValue}
                                  onChange={(e) => setEditingEventRoleValue(e.target.value)}
                                  className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={handleSaveEventRoleEdit}
                                  className="px-2 py-1.5 text-xs bg-green-600 text-white rounded-md"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingEventRoleName(null);
                                    setEditingEventRoleValue('');
                                  }}
                                  className="px-2 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-md"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="text-sm text-gray-800">{role}</span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditEventRole(role)}
                                    className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-md"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteEventRole(role)}
                                    className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded-md"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* User Accounts */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowUserAccountsSection(v => !v)}
                  className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">{showUserAccountsSection ? '▼' : '▶'}</span>
                    <h4 className="text-sm font-semibold text-gray-800">User Accounts</h4>
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">{users.length}</span>
                  </div>
                </button>

                {showUserAccountsSection && (
                <div className="p-4 space-y-4">
              {/* User Statistics Dashboard */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <BrandedStatCard
                  value={users.length}
                  label="Total Users"
                  icon="👥"
                  config={config}
                />
                <BrandedStatCard
                  value={users.filter(u => u.role === 'admin').length}
                  label="Administrators"
                  icon="👑"
                  config={config}
                  variant="accent"
                />
                <BrandedStatCard
                  value={users.filter(u => u.role === 'basic').length}
                  label="Basic Users"
                  icon="👤"
                  config={config}
                />
                <BrandedStatCard
                  value={users.filter(u => u.isActive !== false).length}
                  label="Active"
                  icon="✅"
                  config={config}
                  variant="success"
                />
                <BrandedStatCard
                  value={users.filter(u => u.isActive === false).length}
                  label="Inactive"
                  icon="⏸️"
                  config={config}
                />
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-4 text-center hover:shadow-md transition-shadow">
                  <div className="text-3xl font-bold text-gray-700">{users.reduce((sum, u) => sum + (u.loginCount || 0), 0)}</div>
                  <div className="text-xs text-gray-600 font-medium mt-1">Total Logins</div>
                  <div className="mt-2 text-2xl">📊</div>
                </div>
              </div>

              {/* Search and Filter */}
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                    <input
                      type="text"
                      placeholder="Search users by name, username, or email..."
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
                      onChange={() => {
                        // Filter logic - search state could be added
                      }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <select className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-white">
                      <option value="">All Roles</option>
                      <option value="admin">👑 Admins</option>
                      <option value="basic">👤 Basic Users</option>
                    </select>
                    <select className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-white">
                      <option value="">All Status</option>
                      <option value="active">✅ Active</option>
                      <option value="inactive">⏸️ Inactive</option>
                    </select>
                  </div>
                </div>
              </div>
              
              {/* User List */}
              {users.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl shadow-sm">
                  <div className="text-6xl mb-4">👤</div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No Users Yet</h3>
                  <p className="text-gray-500 mb-4">Get started by creating your first user account</p>
                  <button
                    onClick={() => setShowCreateUserModal(true)}
                    className="px-6 py-3 bg-gradient-to-r from-[#4A1942] to-[#6b2a64] text-white rounded-lg hover:shadow-lg transition-all font-medium"
                  >
                    ➕ Create First User
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {users.map(u => {
                    const isExpanded = expandedUsers.has(u.id);
                    const lastLoginDate = u.lastLogin ? new Date(u.lastLogin) : null;
                    const isOnline = lastLoginDate && (Date.now() - lastLoginDate.getTime()) < 86400000; // Within 24h
                    const editUserFieldErrors = getUserFieldErrors({
                      username: u.username,
                      name: u.name,
                      email: u.email,
                      contactPhoneNumber: u.contactPhoneNumber || u.phone,
                      phoneType: u.phoneType,
                      eventRole: u.eventRole || u.jobTitle,
                      eventName: u.eventName || u.department,
                      userRole: u.userRole || (u.role === 'admin' ? 'admin' : 'shared'),
                      eventDate: u.eventDate,
                      preferredCommunication: u.preferredCommunication,
                      allowSharedAccess: u.allowSharedAccess,
                      sharedUserLimit: u.sharedUserLimit,
                    }, false);
                    
                    return (
                      <div key={u.id} className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden transition-all hover:shadow-md ${
                        u.isActive === false ? 'border-gray-300 opacity-60' : 
                        u.role === 'admin' ? 'border-purple-300' : 'border-blue-200'
                      }`}>
                        {/* User Header - Always Visible */}
                        <div 
                          className={`px-4 py-4 flex items-center justify-between cursor-pointer transition-colors ${
                            u.role === 'admin' 
                              ? 'bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-150' 
                              : 'bg-gradient-to-r from-gray-50 to-blue-50 hover:from-gray-100 hover:to-blue-100'
                          }`}
                          onClick={() => {
                            setExpandedUsers(prev => {
                              const next = new Set(prev);
                              if (next.has(u.id)) {
                                next.delete(u.id);
                              } else {
                                next.add(u.id);
                              }
                              return next;
                            });
                          }}
                        >
                          <div className="flex items-center gap-4">
                            <span className={`text-lg transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                            {/* User Avatar with Status Indicator */}
                            <div className="relative">
                              {u.imageUrl ? (
                                <img src={u.imageUrl} alt={u.name} className="w-12 h-12 rounded-full object-cover border-3 border-white shadow-sm" />
                              ) : (
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold shadow-sm ${
                                  u.role === 'admin' 
                                    ? 'bg-gradient-to-br from-purple-400 to-purple-600 text-white' 
                                    : 'bg-gradient-to-br from-blue-400 to-blue-600 text-white'
                                }`}>
                                  {u.name?.charAt(0).toUpperCase() || '?'}
                                </div>
                              )}
                              {/* Online/Status indicator */}
                              <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${
                                u.isActive === false ? 'bg-gray-400' :
                                isOnline ? 'bg-green-500' : 'bg-yellow-500'
                              }`} title={u.isActive === false ? 'Inactive' : isOnline ? 'Recently Active' : 'Away'} />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-800 flex items-center gap-2">
                                {u.name}
                                {u.role === 'admin' && <span className="text-lg" title="Administrator">👑</span>}
                              </div>
                              <div className="text-sm text-gray-500 flex items-center gap-2">
                                <span>@{u.username}</span>
                                {u.email && <span className="text-gray-300">•</span>}
                                {u.email && <span className="text-xs text-gray-400">{u.email}</span>}
                              </div>
                              {u.jobTitle && (
                                <div className="text-xs text-gray-400 mt-0.5">{u.jobTitle}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                            {/* Activity Info */}
                            <div className="hidden md:flex flex-col items-end text-xs text-gray-400">
                              {u.lastLogin && (
                                <span>Last login: {new Date(u.lastLogin).toLocaleDateString()}</span>
                              )}
                              {u.loginCount !== undefined && u.loginCount > 0 && (
                                <span>{u.loginCount} login{u.loginCount !== 1 ? 's' : ''}</span>
                              )}
                            </div>
                            {/* Role Badge - Updated to show RBAC role name */}
							<span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${
							  u.isActive === false 
								? 'bg-gray-100 text-gray-500'
								: allRoles.find(r => r.id === (u.assignedRoles?.[0] || u.role))?.hierarchy && 
								  allRoles.find(r => r.id === (u.assignedRoles?.[0] || u.role))?.hierarchy! >= 90
								  ? 'bg-purple-100 text-purple-700 border border-purple-200'
								  : 'bg-blue-100 text-blue-700 border border-blue-200'
							}`}>
							  {u.isActive === false 
								? '⏸️ Inactive' 
								: allRoles.find(r => r.id === (u.assignedRoles?.[0] || u.role))?.name || u.role}
							</span>
                            {/* Action Buttons */}
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  setExpandedUsers(prev => new Set(prev).add(u.id));
                                }}
                                className="p-2 text-gray-500 hover:bg-white hover:text-[#4A1942] rounded-lg transition-colors"
                                title="Edit user"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u.id, u.name || u.email || u.username)}
                                className="p-2 text-gray-500 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors"
                                title="Delete user"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        {/* User Details - Collapsible */}
                        {isExpanded && (
                          <div className="p-5 border-t-2 border-gray-100 space-y-5 bg-gradient-to-b from-white to-gray-50">
                            {/* Profile Section */}
                            <div className="flex flex-col md:flex-row gap-6 pb-5 border-b border-gray-200">
                              {/* Profile Image */}
                              <div className="flex flex-col items-center">
                                <div className="relative group">
                                  {u.imageUrl ? (
                                    <img src={u.imageUrl} alt={u.name} className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg" />
                                  ) : (
                                    <div className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold shadow-lg ${
                                      u.role === 'admin' 
                                        ? 'bg-gradient-to-br from-purple-400 to-purple-600 text-white' 
                                        : 'bg-gradient-to-br from-blue-400 to-blue-600 text-white'
                                    }`}>
                                      {u.name?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                  )}
                                  <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                    <span className="text-white text-2xl">📷</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const reader = new FileReader();
                                          reader.onload = (event) => {
                                            const imageUrl = event.target?.result as string;
                                            handleSaveUsers(users.map(usr => 
                                              usr.id === u.id ? { ...usr, imageUrl, updatedAt: new Date().toISOString() } : usr
                                            ));
                                          };
                                          reader.readAsDataURL(file);
                                        }
                                      }}
                                    />
                                  </label>
                                </div>
                                {u.imageUrl && (
                                  <button
                                    onClick={() => handleSaveUsers(users.map(usr => 
                                      usr.id === u.id ? { ...usr, imageUrl: '', updatedAt: new Date().toISOString() } : usr
                                    ))}
                                    className="mt-2 text-xs text-red-500 hover:underline"
                                  >
                                    🗑️ Remove Photo
                                  </button>
                                )}
                                <p className="text-xs text-gray-400 mt-2 text-center">Hover to upload</p>
                              </div>
                              
                              {/* Quick Stats */}
                              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 text-center">
                                  <div className="text-2xl mb-1">📅</div>
                                  <div className="text-xs text-gray-500">Member Since</div>
                                  <div className="text-sm font-semibold text-gray-700">
                                    {new Date(u.createdAt).toLocaleDateString()}
                                  </div>
                                </div>
                                <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 text-center">
                                  <div className="text-2xl mb-1">🔐</div>
                                  <div className="text-xs text-gray-500">Last Login</div>
                                  <div className="text-sm font-semibold text-gray-700">
                                    {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}
                                  </div>
                                </div>
                                <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 text-center">
                                  <div className="text-2xl mb-1">📊</div>
                                  <div className="text-xs text-gray-500">Total Logins</div>
                                  <div className="text-sm font-semibold text-gray-700">{u.loginCount || 0}</div>
                                </div>
                                <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 text-center">
                                  <div className="text-2xl mb-1">{u.isActive !== false ? '✅' : '⏸️'}</div>
                                  <div className="text-xs text-gray-500">Status</div>
                                  <div className={`text-sm font-semibold ${u.isActive !== false ? 'text-green-600' : 'text-gray-500'}`}>
                                    {u.isActive !== false ? 'Active' : 'Inactive'}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Personal Information */}
							<div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
							  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
								<span className="text-lg">📋</span> Personal Information
							  </h4>
							  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
								<div>
								  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
									✉️ Email (Login ID)
								  </label>
								  <input
									type="email"
									value={u.email || ''}
									onChange={(e) => handleSaveUsers(users.map(usr => 
									  usr.id === u.id ? { ...usr, email: e.target.value, updatedAt: new Date().toISOString() } : usr
									))}
									className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-gray-50"
									placeholder="user@example.com"
								  />
								  {editUserFieldErrors.email && (
									<p className="mt-1 text-xs text-red-600">{editUserFieldErrors.email}</p>
								  )}
								</div>
								<div>
								  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
									👤 Full Name
								  </label>
								  <input
									type="text"
									value={u.name}
									onChange={(e) => handleSaveUsers(users.map(usr => 
									  usr.id === u.id ? { ...usr, name: e.target.value, updatedAt: new Date().toISOString() } : usr
									))}
									className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-gray-50"
								  />
								  {editUserFieldErrors.name && (
									<p className="mt-1 text-xs text-red-600">{editUserFieldErrors.name}</p>
								  )}
								</div>
								<div>
								  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
									📞 Contact Phone Number
								  </label>
								  <input
									type="tel"
									value={u.contactPhoneNumber || u.phone || ''}
									onChange={(e) => handleSaveUsers(users.map(usr => 
									  usr.id === u.id ? { ...usr, contactPhoneNumber: e.target.value, phone: e.target.value, updatedAt: new Date().toISOString() } : usr
									))}
									className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-gray-50"
									placeholder="(555) 123-4567"
								  />
								</div>
								<div>
								  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
									📱 Phone Type
								  </label>
								  <select
									value={u.phoneType || 'Mobile'}
									onChange={(e) => handleSaveUsers(users.map(usr =>
									  usr.id === u.id ? { ...usr, phoneType: e.target.value as 'Mobile' | 'Home' | 'Work' | 'Other', updatedAt: new Date().toISOString() } : usr
									))}
									className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-gray-50"
								  >
									<option value="Mobile">Mobile</option>
									<option value="Home">Home</option>
									<option value="Work">Work</option>
									<option value="Other">Other</option>
								  </select>
								</div>
								<div>
								  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
									💼 Event Role
								  </label>
								  <select
									value={u.eventRole || u.jobTitle || ''}
									onChange={(e) => handleSaveUsers(users.map(usr => 
									  usr.id === u.id ? { ...usr, eventRole: e.target.value, jobTitle: e.target.value, updatedAt: new Date().toISOString() } : usr
									))}
									className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-gray-50"
								  >
									<option value="">Select Event Role</option>
									{eventRoles.map(role => (
									  <option key={role} value={role}>{role}</option>
									))}
								  </select>
								</div>
								<div>
								  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
									🏛️ Event Name
								  </label>
								  <input
									type="text"
									value={u.eventName || u.department || ''}
									onChange={(e) => handleSaveUsers(users.map(usr => 
									  usr.id === u.id ? { ...usr, eventName: e.target.value, department: e.target.value, updatedAt: new Date().toISOString() } : usr
									))}
									className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-gray-50"
									placeholder="Smith Wedding"
								  />
								</div>
							  </div>
							</div>
                            
                            {/* Account Settings */}
							<div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
							  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
								<span className="text-lg">⚙️</span> Account Settings
							  </h4>
							  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								{/* RBAC Role Selection */}
								<div>
								  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
									🔐 Role (RBAC)
								  </label>
								  <select
									value={u.assignedRoles?.[0] || u.role || 'basic'}
									onChange={(e) => {
									  const roleId = e.target.value;
									  const selectedRole = allRoles.find(r => r.id === roleId);
									  handleSaveUsers(users.map(usr => 
										usr.id === u.id ? { 
										  ...usr, 
										  assignedRoles: [roleId],
										  role: selectedRole?.hierarchy && selectedRole.hierarchy >= 90 ? 'admin' :
												selectedRole?.hierarchy && selectedRole.hierarchy >= 40 ? 'staff' :
												roleId === 'guest' ? 'guest' : 'basic',
										  updatedAt: new Date().toISOString() 
										} : usr
									  ));
									}}
									className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent ${
									  allRoles.find(r => r.id === (u.assignedRoles?.[0] || u.role))?.hierarchy && 
									  allRoles.find(r => r.id === (u.assignedRoles?.[0] || u.role))?.hierarchy! >= 90 
										? 'border-purple-300 bg-purple-50' 
										: 'border-blue-300 bg-blue-50'
									}`}
								  >
									{allRoles.map(role => (
									  <option key={role.id} value={role.id}>
										{role.name} {role.isImmutable ? '(System)' : role.isSystem ? '(Default)' : '(Custom)'}
									  </option>
									))}
								  </select>
								  <p className="text-xs text-gray-500 mt-1">
									{allRoles.find(r => r.id === (u.assignedRoles?.[0] || u.role))?.description}
								  </p>
								</div>
								
								{/* User Status */}
								<div>
								  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
									📊 User Status
								  </label>
								  <select
									value={u.userStatus || (u.isActive === false ? 'disabled' : 'active')}
									onChange={(e) => handleSaveUsers(users.map(usr => 
									  usr.id === u.id ? { 
										...usr, 
										userStatus: e.target.value as 'invited' | 'pending' | 'active' | 'suspended' | 'disabled',
										isActive: !['suspended', 'disabled'].includes(e.target.value),
										updatedAt: new Date().toISOString() 
									  } : usr
									))}
									className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent ${
									  (u.userStatus || (u.isActive === false ? 'disabled' : 'active')) === 'active' ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-gray-100'
									}`}
								  >
									<option value="invited">📨 Invited</option>
									<option value="pending">🕒 Pending</option>
									<option value="active">✅ Active</option>
									<option value="suspended">⏸️ Suspended</option>
									<option value="disabled">⛔ Disabled</option>
								  </select>
								</div>
								
								{/* Change Password */}
								<div>
								  <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1 mb-1">
									🔒 Change Password
								  </label>
								  <div className="flex gap-2">
									<input
									  type="password"
									  placeholder="New password (min 8 chars)"
									  id={`password-${u.id}`}
									  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-gray-50"
									/>
									<button
									  onClick={async () => {
											const input = document.getElementById(`password-${u.id}`) as HTMLInputElement;
											const nextPassword = input.value;
											if (nextPassword.length >= 8) {
											  const passwordRecord = await createPasswordRecord(nextPassword);
											  handleSaveUsers(users.map(usr => 
												usr.id === u.id ? {
												  ...usr,
												  password: '',
												  ...passwordRecord,
												  sessionVersion: ((usr as any).sessionVersion ?? 1) + 1,
												  updatedAt: new Date().toISOString()
												} : usr
											  ));
											  input.value = '';
											  showSuccess('Password updated!');
											} else {
											  showInfo('Password too short', 'Password must be at least 8 characters.', 'warning');
											}
										  }}
									  className="px-4 py-2.5 bg-gradient-to-r from-[#4A1942] to-[#6b2a64] text-white rounded-lg hover:shadow-lg transition-all text-sm font-medium"
									>
									  Update
									</button>
								  </div>
								</div>
							  </div>
							</div>
                            
                            {/* Notes */}
                            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                              <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
                                <span className="text-lg">📝</span> Notes
                              </h4>
                              <textarea
                                value={u.notes || ''}
                                onChange={(e) => handleSaveUsers(users.map(usr => 
                                  usr.id === u.id ? { ...usr, notes: e.target.value, updatedAt: new Date().toISOString() } : usr
                                ))}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent bg-gray-50"
                                rows={3}
                                placeholder="Add any additional notes about this user..."
                              />
                            </div>
                            
                            {/* Permissions (for Basic Users) */}
                            {(u.userRole || (u.role === 'admin' ? 'admin' : 'shared')) !== 'admin' && (
                              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                                <h4 className="text-sm font-semibold text-blue-700 flex items-center gap-2 mb-4">
                                  <span className="text-lg">🔐</span> User Permissions
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                  {[
                                    { key: 'canCreateTemplates', label: 'Create Templates', icon: '📝', desc: 'Can create new layout templates' },
                                    { key: 'canEditTemplates', label: 'Edit Templates', icon: '✏️', desc: 'Can modify existing templates' },
                                    { key: 'canDeleteTemplates', label: 'Delete Templates', icon: '🗑️', desc: 'Can remove templates' },
                                    { key: 'canManageGuests', label: 'Manage Guests', icon: '👥', desc: 'Can add/edit guest lists' },
                                    { key: 'canPrint', label: 'Print Layouts', icon: '🖨️', desc: 'Can print venue layouts' },
                                    { key: 'canExport', label: 'Export Data', icon: '📤', desc: 'Can export layout data' },
                                    { key: 'canViewAllLayouts', label: 'View All Layouts', icon: '👁️', desc: 'Can view layouts from all users' },
                                  ].map(perm => {
                                    const isChecked = u.permissions?.[perm.key as keyof typeof u.permissions] ?? true;
                                    return (
                                      <label 
                                        key={perm.key} 
                                        className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                                          isChecked 
                                            ? 'bg-white border-2 border-blue-300 shadow-sm' 
                                            : 'bg-gray-100 border-2 border-gray-200 opacity-60'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={(e) => handleSaveUsers(users.map(usr => 
                                            usr.id === u.id ? { 
                                              ...usr, 
                                              permissions: { 
                                                ...usr.permissions,
                                                [perm.key]: e.target.checked 
                                              },
                                              updatedAt: new Date().toISOString() 
                                            } : usr
                                          ))}
                                          className="w-5 h-5 accent-[#4A1942] mt-0.5"
                                        />
                                        <div>
                                          <div className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                            <span>{perm.icon}</span> {perm.label}
                                          </div>
                                          <div className="text-xs text-gray-500">{perm.desc}</div>
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                                <div className="mt-3 flex gap-2">
                                  <button
                                    onClick={() => handleSaveUsers(users.map(usr => 
                                      usr.id === u.id ? { 
                                        ...usr, 
                                        permissions: {
                                          canCreateTemplates: true,
                                          canEditTemplates: true,
                                          canDeleteTemplates: true,
                                          canManageGuests: true,
                                          canPrint: true,
                                          canExport: true,
                                          canViewAllLayouts: true,
                                        },
                                        updatedAt: new Date().toISOString() 
                                      } : usr
                                    ))}
                                    className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                  >
                                    Grant All
                                  </button>
                                  <button
                                    onClick={() => handleSaveUsers(users.map(usr => 
                                      usr.id === u.id ? { 
                                        ...usr, 
                                        permissions: {
                                          canCreateTemplates: false,
                                          canEditTemplates: false,
                                          canDeleteTemplates: false,
                                          canManageGuests: false,
                                          canPrint: false,
                                          canExport: false,
                                          canViewAllLayouts: false,
                                        },
                                        updatedAt: new Date().toISOString() 
                                      } : usr
                                    ))}
                                    className="px-3 py-1.5 text-xs bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                                  >
                                    Revoke All
                                  </button>
                                </div>
                              </div>
                            )}
                            
                            {/* Meta Info Footer */}
                            <div className="bg-gray-100 rounded-xl p-3 flex flex-wrap justify-between items-center gap-3 text-xs text-gray-500">
                              <div className="flex flex-wrap gap-4">
                                <span className="flex items-center gap-1">
                                  <span>📅</span> Created: <strong>{new Date(u.createdAt).toLocaleDateString()}</strong>
                                </span>
                                {u.updatedAt && (
                                  <span className="flex items-center gap-1">
                                    <span>✏️</span> Updated: <strong>{new Date(u.updatedAt).toLocaleDateString()}</strong>
                                  </span>
                                )}
                                {u.createdBy && (
                                  <span className="flex items-center gap-1">
                                    <span>👤</span> By: <strong>{users.find(usr => usr.id === u.createdBy)?.name || u.createdBy}</strong>
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    handleDeleteUser(u.id, u.name || u.email || u.username);
                                  }}
                                  className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-1"
                                >
                                  🗑️ Delete User
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
                </div>
                )}
              </div>
              
              {/* Create User Modal */}
			  {showCreateUserModal && (
			    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4">
				  <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
				    <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-[#4A1942] to-[#6b2a64]">
					  <h3 className="text-xl font-bold text-white flex items-center gap-2">
					    ➕ Create New User
					  </h3>
				    </div>
				    <div className="p-6 space-y-4">
					  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					    {/* Email - Primary Login Identifier */}
					    <div className="md:col-span-2">
						  <label className="text-xs font-medium text-gray-500 uppercase">Email Address * (Used for login)</label>
						  <input
						    type="email"
						    value={newUser.email || ''}
						    onChange={(e) => {
							  setNewUser({ ...newUser, email: e.target.value });
							  if (createUserFieldErrors.email) {
							    setCreateUserFieldErrors((prev) => ({ ...prev, email: '' }));
							  }
			  			    }}
						    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent ${createUserFieldErrors.email ? 'border-red-300' : 'border-gray-300'}`}
						    placeholder="user@example.com"
						  />
						  {createUserFieldErrors.email && (
						    <p className="mt-1 text-xs text-red-600">{createUserFieldErrors.email}</p>
						  )}
					      </div>
					  
					    {/* Full Name */}
					    <div>
						  <label className="text-xs font-medium text-gray-500 uppercase">Full Name *</label>
						  <input
						    type="text"
						    value={newUser.name}
						    onChange={(e) => {
							  setNewUser({ ...newUser, name: e.target.value });
							  if (createUserFieldErrors.name) {
							    setCreateUserFieldErrors((prev) => ({ ...prev, name: '' }));
							  }
						    }}
						    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent ${createUserFieldErrors.name ? 'border-red-300' : 'border-gray-300'}`}
						    placeholder="John Smith"
						  />
						  {createUserFieldErrors.name && (
						    <p className="mt-1 text-xs text-red-600">{createUserFieldErrors.name}</p>
						  )}
					    </div>
					  
					    {/* Password */}
					    <div>
						  <label className="text-xs font-medium text-gray-500 uppercase">Password *</label>
						  <input
						    type="password"
						    value={newUser.password}
						    onChange={(e) => {
							  setNewUser({ ...newUser, password: e.target.value });
							  if (createUserFieldErrors.password) {
							    setCreateUserFieldErrors((prev) => ({ ...prev, password: '' }));
							  }
						    }}
						    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent ${createUserFieldErrors.password ? 'border-red-300' : 'border-gray-300'}`}
						    placeholder="••••••••"
						  />
						  {createUserFieldErrors.password && (
						    <p className="mt-1 text-xs text-red-600">{createUserFieldErrors.password}</p>
						  )}
					    </div>
					  
					    {/* RBAC Role Selection */}
					    <div className="md:col-span-2">
						  <label className="text-xs font-medium text-gray-500 uppercase">Role * (Controls access permissions)</label>
						  <select
						    value={newUser.assignedRoles?.[0] || newUser.role || 'basic'}
						    onChange={(e) => {
							  const roleId = e.target.value;
							  const selectedRole = allRoles.find(r => r.id === roleId);
							  setNewUser({
							    ...newUser,
							    assignedRoles: [roleId],
							    role: selectedRole?.hierarchy && selectedRole.hierarchy >= 90 ? 'admin' :
									  selectedRole?.hierarchy && selectedRole.hierarchy >= 40 ? 'staff' :
									  roleId === 'guest' ? 'guest' : 'basic',
							  });
						    }}
						    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
						  >
						    {allRoles.map(role => (
							  <option key={role.id} value={role.id}>
							    {role.name} {role.isImmutable ? '(System)' : role.isSystem ? '(Default)' : '(Custom)'}
							  </option>
						    ))}
						  </select>
						  <p className="text-xs text-gray-500 mt-1">
						    {allRoles.find(r => r.id === (newUser.assignedRoles?.[0] || newUser.role))?.description}
						  </p>
					    </div>
					  
					    {/* Contact Phone */}
					    <div>
						  <label className="text-xs font-medium text-gray-500 uppercase">Contact Phone</label>
						  <input
						    type="tel"
						    value={newUser.contactPhoneNumber || ''}
						    onChange={(e) => setNewUser({ ...newUser, contactPhoneNumber: e.target.value, phone: e.target.value })}
						    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
						    placeholder="(555) 123-4567"
						  />
					    </div>
					  
					    {/* Phone Type */}
					    <div>
						  <label className="text-xs font-medium text-gray-500 uppercase">Phone Type</label>
						  <select
						    value={newUser.phoneType || 'Mobile'}
						    onChange={(e) => setNewUser({
							  ...newUser,
							  phoneType: e.target.value as 'Mobile' | 'Home' | 'Work' | 'Other',
						    })}
						    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
						  >
						    <option value="Mobile">Mobile</option>
						    <option value="Home">Home</option>
						    <option value="Work">Work</option>
						    <option value="Other">Other</option>
						  </select>
					    </div>
					  
					    {/* Event Role */}
					    <div>
						  <label className="text-xs font-medium text-gray-500 uppercase">Event Role</label>
						  <select
						    value={newUser.eventRole || ''}
						    onChange={(e) => setNewUser({ ...newUser, eventRole: e.target.value, jobTitle: e.target.value })}
						    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
						  >
						    <option value="">Select Event Role</option>
						    {eventRoles.map(role => (
							  <option key={role} value={role}>{role}</option>
						    ))}
						  </select>
					    </div>
					  
					    {/* Event Name */}
					    <div>
						  <label className="text-xs font-medium text-gray-500 uppercase">Event Name</label>
						  <input
						    type="text"
						    value={newUser.eventName || ''}
						    onChange={(e) => setNewUser({ ...newUser, eventName: e.target.value, department: e.target.value })}
						    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
						    placeholder="Smith Wedding"
						  />
					    </div>
					  
					    {/* Event Date */}
					    <div>
						  <label className="text-xs font-medium text-gray-500 uppercase">Event Date</label>
						  <input
						    type="date"
						    value={newUser.eventDate || ''}
						    onChange={(e) => setNewUser({ ...newUser, eventDate: e.target.value })}
						    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
						  />
					    </div>
					  
					    {/* User Status */}
					    <div>
						  <label className="text-xs font-medium text-gray-500 uppercase">User Status</label>
						  <select
						    value={newUser.userStatus || 'active'}
						    onChange={(e) => setNewUser({
							  ...newUser,
							  userStatus: e.target.value as 'invited' | 'pending' | 'active' | 'suspended' | 'disabled',
						    })}
						    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
						  >
						    <option value="active">✅ Active</option>
						    <option value="invited">📨 Invited</option>
						    <option value="pending">🕒 Pending</option>
						    <option value="suspended">⏸️ Suspended</option>
						    <option value="disabled">⛔ Disabled</option>
						  </select>
					    </div>
					  </div>
				    </div>
				    <div className="p-4 border-t border-gray-200 flex justify-end gap-2 bg-gray-50">
					  <button
					    onClick={() => {
						  setShowCreateUserModal(false);
						  setCreateUserFieldErrors({});
						  setNewUser({
						    username: '',
						    password: '',
						    name: '',
						    role: 'basic',
						    email: '',
						    phone: '',
						    contactPhoneNumber: '',
						    phoneType: 'Mobile',
						    preferredCommunication: [],
						    eventRole: '',
						    eventName: '',
						    userRole: 'master',
						    isMasterUser: false,
						    parentUserId: undefined,
						    allowSharedAccess: false,
						    sharedUserLimit: 0,
						    userStatus: 'active',
						    eventDate: '',
						    jobTitle: '',
						    department: '',
						    assignedRoles: [],
						  });
					    }}
					    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
					  >
					    Cancel
					  </button>
					  <button
					    onClick={handleCreateUser}
					    className="px-4 py-2 bg-[#4A1942] text-white rounded-lg hover:bg-[#5c2a64] transition-colors font-medium"
					  >
					    Create User
					  </button>
				    </div>
				  </div>
			    </div>
			  )}
              </div>
    </div>
  );
}
