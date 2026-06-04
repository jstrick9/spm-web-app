import { useState, useRef, useEffect } from 'react';
import { Venue, User } from '../types';
import { SavedLayout } from '../hooks/useLayoutState';
import { getConfig } from '../config';
import { layoutCategories } from '../data/venueData';
import {
  canAccessAdminPanel,
  canAccessOperationsPanel,
  canManageGuests,
  canPrintLayouts,
} from '../utils/permissions';
import ModalDialog from './ModalDialog';
import Logo from './Logo';
import { emit } from '../utils/appEvents';

export interface HeaderProps {
  currentVenue: Venue;
  venues: Venue[];
  selectedVenueCategories?: string[];
  onChangeVenue: (venueId: string) => void;
  onChangeVenueCategories?: (categories: string[]) => void;
  onSaveLayout: (name: string) => void;
  onSaveMasterLayout?: () => void;
  onClearMasterLayout?: () => void;
  onPrint: () => void;
  onShowTemplates: () => void;
  onShowGuests: () => void;
  onShowAdmin?: () => void;
  onOpenOperations?: () => void;
  onShowWorkspaceHelp?: () => void;
  onLogout: () => void;
  userName: string;
  isAdmin: boolean;
  isStaff?: boolean;
  savedLayouts: SavedLayout[];
  onLoadSavedLayout: (id: string) => void;
  onDeleteSavedLayout: (id: string) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  currentUser?: User | null;
}

export function Header({
  currentVenue,
  venues,
  selectedVenueCategories = [],
  onChangeVenue,
  onChangeVenueCategories,
  onSaveLayout,
  onSaveMasterLayout,
  onClearMasterLayout,
  onPrint,
  onShowTemplates,
  onShowGuests,
  onShowAdmin,
  onOpenOperations,
  onShowWorkspaceHelp,
  onLogout,
  userName,
  isAdmin,
  isStaff,
  savedLayouts,
  onLoadSavedLayout,
  onDeleteSavedLayout,
  mobileMenuOpen,
  setMobileMenuOpen,
  currentUser,
}: HeaderProps) {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [layoutName, setLayoutName] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showVenueDropdown, setShowVenueDropdown] = useState(false);
  const [showVenueFilter, setShowVenueFilter] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const venueDropdownRef = useRef<HTMLDivElement>(null);
  const venueFilterRef = useRef<HTMLDivElement>(null);

  const config = getConfig();

  const canOpenAdmin = canAccessAdminPanel(currentUser);
  const canOpenOperations = canAccessOperationsPanel(currentUser);
  const canOpenGuests = canManageGuests(currentUser);
  const canPrint = canPrintLayouts(currentUser);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (
        venueDropdownRef.current &&
        !venueDropdownRef.current.contains(event.target as Node)
      ) {
        setShowVenueDropdown(false);
      }
      if (
        venueFilterRef.current &&
        !venueFilterRef.current.contains(event.target as Node)
      ) {
        setShowVenueFilter(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSave = () => {
    if (layoutName.trim()) {
      onSaveLayout(layoutName.trim());
      setLayoutName('');
      setShowSaveModal(false);
    }
  };

  const handleVenueSelect = (venueId: string) => {
    setShowVenueDropdown(false);
    setMobileMenuOpen(false);

    if (venueId !== currentVenue.id) {
      setTimeout(() => {
        onChangeVenue(venueId);
      }, 10);
    }
  };

  const categoryInfo = layoutCategories.find((c) => c.id === currentVenue.category);

  const toggleVenueCategory = (categoryId: string) => {
    if (!onChangeVenueCategories) return;

    const next = selectedVenueCategories.includes(categoryId)
      ? selectedVenueCategories.filter((id) => id !== categoryId)
      : [...selectedVenueCategories, categoryId];

    onChangeVenueCategories(next);
  };

  const clearVenueCategories = () => {
    onChangeVenueCategories?.([]);
  };

  const visibleVenues = venues.filter((v) => isAdmin || v.isMaster !== false);
  const filteredVenues =
    selectedVenueCategories.length > 0
      ? visibleVenues.filter((v) => selectedVenueCategories.includes(v.category))
      : visibleVenues;

  return (
    <>
      <header
        className="text-white shadow-lg"
        style={{
          zIndex: 100,
          position: 'relative',
          background: `linear-gradient(to right, ${config.primaryColor}, ${config.primaryDark})`,
          color: config.headerTextColor,
        }}
      >
        <div className="flex items-center justify-between px-2 md:px-4 py-2 gap-2">
          <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
            {config.logoUrl ? (
              <Logo
                url={config.logoUrl}
                size="md"
                className="rounded flex-shrink-0"
              />
            ) : (
              <span className="text-xl md:text-2xl flex-shrink-0">💒</span>
            )}

            <div className="hidden sm:block min-w-0">
              <h1 className="font-bold text-sm md:text-lg leading-tight text-white truncate">
                {config.venueName}
              </h1>
              <div className="flex items-center gap-1 md:gap-2 text-xs text-white/70">
                <span className="hidden lg:inline">Wedding Layout Planner</span>
                <span className="lg:hidden">Layout Planner</span>

                {config.websiteUrl && (
                  <>
                    <span className="hidden md:inline">•</span>
                    <a
                      href={config.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-white transition-colors hidden md:flex items-center gap-1"
                    >
                      🔗
                    </a>
                  </>
                )}

                {config.supportEmail && (
                  <>
                    <span className="hidden md:inline">•</span>
                    <a
                      href={`mailto:${config.supportEmail}`}
                      className="hover:text-white transition-colors hidden md:flex items-center gap-1"
                    >
                      📧
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 flex-shrink min-w-0">
            <div
              ref={venueDropdownRef}
              className="flex items-center gap-2 bg-white/10 rounded-lg px-2 py-1.5"
            >
              <span className="text-white/70 text-xs whitespace-nowrap">Venue:</span>

              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowVenueDropdown(!showVenueDropdown);
                  }}
                  className="bg-white/20 text-white font-medium border-none outline-none cursor-pointer rounded px-2 py-1 flex items-center gap-1 hover:bg-white/30 transition-colors max-w-[180px] lg:max-w-[250px] xl:max-w-[300px]"
                >
                  <span className="truncate text-sm">{currentVenue.name}</span>
                  <span className="text-xs text-white/70 whitespace-nowrap hidden lg:inline">
                    ({currentVenue.width}'×{currentVenue.height}')
                  </span>
                  {isAdmin && !currentVenue.isMaster && (
                    <span className="text-xs text-yellow-300 whitespace-nowrap">
                      [Draft]
                    </span>
                  )}
                  <span className="text-xs ml-1 flex-shrink-0">
                    {showVenueDropdown ? '▲' : '▼'}
                  </span>
                </button>

                {showVenueDropdown && (
                  <div
                    className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl py-1 min-w-[280px] max-h-[400px] overflow-y-auto"
                    style={{ zIndex: 99999 }}
                  >
                    <div className="px-3 py-2 bg-gray-100 text-gray-600 text-xs font-medium border-b">
                      Select a Venue ({filteredVenues.length} available)
                    </div>

                    {filteredVenues.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleVenueSelect(v.id);
                        }}
                        className={`w-full text-left px-4 py-3 hover:bg-purple-50 transition-colors flex items-center justify-between border-b border-gray-100 last:border-b-0 ${
                          v.id === currentVenue.id
                            ? 'bg-purple-100 text-purple-700'
                            : 'text-gray-800'
                        }`}
                      >
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {v.name}
                            {isAdmin && !v.isMaster && (
                              <span className="text-xs text-orange-600">[Draft]</span>
                            )}
                            {v.isMaster && (
                              <span className="text-xs text-green-600">★</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {v.width}' × {v.height}' • {v.capacity} guests
                          </div>
                        </div>

                        {v.id === currentVenue.id && (
                          <span className="text-purple-600 text-lg">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="relative" ref={venueFilterRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowVenueFilter(!showVenueFilter);
                }}
                className="bg-white/20 hover:bg-white/30 text-white rounded-lg px-2 py-1.5 text-sm flex items-center gap-1 transition-colors"
                title="Filter venues by category"
              >
                <span>🔎</span>
                <span className="hidden lg:inline">Filter</span>
                {selectedVenueCategories.length > 0 && (
                  <span className="bg-white text-[#4A1942] rounded-full px-1.5 text-[10px] font-bold">
                    {selectedVenueCategories.length}
                  </span>
                )}
              </button>

              {showVenueFilter && (
                <div
                  className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl p-3 min-w-[280px]"
                  style={{ zIndex: 99999 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-gray-800">
                      Filter by Venue Category
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        clearVenueCategories();
                      }}
                      className="text-xs text-[#4A1942] hover:underline"
                    >
                      Clear all
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {layoutCategories.map((category) => {
                      const active = selectedVenueCategories.includes(category.id);

                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            toggleVenueCategory(category.id);
                          }}
                          className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                            active
                              ? 'border-[#4A1942] bg-[#4A1942]/10 text-[#4A1942]'
                              : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          <div className="font-medium text-sm flex items-center gap-1">
                            <span>{category.icon}</span>
                            <span>{category.name}</span>
                          </div>
                          <div className="text-[11px] opacity-70 mt-0.5">
                            {category.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {categoryInfo && (
              <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1 whitespace-nowrap flex-shrink-0">
                <span>{categoryInfo.icon}</span>
                <span className="hidden lg:inline">{categoryInfo.name}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {canOpenOperations && onOpenOperations && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onOpenOperations();
                }}
                className="hidden md:flex items-center gap-1 px-2 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              >
                <span>📋</span>
                <span className="hidden lg:inline">Operations</span>
                <span className="lg:hidden">Ops</span>
              </button>
            )}

            {canOpenAdmin && onShowAdmin && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onShowAdmin();
                }}
                className="hidden md:flex items-center gap-1 px-2 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              >
                <span>⚙️</span>
                <span className="hidden lg:inline">Admin Panel</span>
                <span className="lg:hidden">Admin</span>
              </button>
            )}

            {onShowWorkspaceHelp && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onShowWorkspaceHelp();
                }}
                className="hidden md:flex items-center gap-1 px-2 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                title="Open workspace help and keyboard shortcuts"
              >
                <span>❔</span>
                <span className="hidden lg:inline">Workspace Help</span>
                <span className="lg:hidden">Help</span>
              </button>
            )}

            <div className="hidden md:block relative" ref={menuRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setShowMenu(!showMenu);
                }}
                className="flex items-center gap-1 px-2 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
              >
                <span>☰</span>
                <span className="hidden lg:inline">Menu</span>
              </button>

              {showMenu && (
                <div
                  className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl py-1 min-w-[200px]"
                  style={{ zIndex: 99999 }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      onShowTemplates();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    📋 Templates
                  </button>

                  {canOpenGuests && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        onShowGuests();
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      👥 Guest List
                    </button>
                  )}

                  <hr className="my-1" />
				  
				    <button
					  onClick={() => emit('spm_open_vendors')}
					  className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 flex items-center gap-2"
					  title="Vendor Management"
					>
					  🤝 Vendors
					</button>
				  
					<button
				      onClick={() => emit('spm_open_timeline')}
				      className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 flex items-center gap-2"
				      title="Wedding Timeline"
				    >
				      📅 Timeline
				    </button>
				  
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowSaveModal(true);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    💾 Save Layout
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowLoadModal(true);
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    📂 Load Layout
                  </button>

                  {isAdmin && onSaveMasterLayout && (
                    <>
                      <hr className="my-1" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          onSaveMasterLayout();
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-green-700 hover:bg-green-50 flex items-center gap-2"
                      >
                        👑 Save as Master Layout
                      </button>

                      {currentVenue.masterLayout && onClearMasterLayout && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            onClearMasterLayout();
                            setShowMenu(false);
                          }}
                          className="w-full text-left px-4 py-2 text-red-700 hover:bg-red-50 flex items-center gap-2"
                        >
                          🗑️ Clear Master Layout
                        </button>
                      )}
                    </>
                  )}

                  <hr className="my-1" />

                  {canPrint && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        onPrint();
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      🖨️ Print Layout
                    </button>
                  )}

                  <hr className="my-1" />

                  <div className="px-4 py-2 text-xs text-gray-500">
                    Signed in as: {userName} ({isAdmin ? 'Admin' : isStaff ? 'Staff' : 'User'})
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      onLogout();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    🚪 Sign Out
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setMobileMenuOpen(!mobileMenuOpen);
              }}
              className="md:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <span className="text-2xl">{mobileMenuOpen ? '✕' : '☰'}</span>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div
            className="md:hidden bg-[#3d1a45] border-t border-white/20 max-h-[80vh] overflow-y-auto"
            style={{ zIndex: 99998 }}
          >
            <div className="p-4 border-b border-white/10 space-y-3">
              <div>
                <label className="text-white/70 text-xs font-medium block mb-2">
                  FILTER VENUE CATEGORIES
                </label>

                <div className="grid grid-cols-2 gap-2">
                  {layoutCategories.map((category) => {
                    const active = selectedVenueCategories.includes(category.id);

                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          toggleVenueCategory(category.id);
                        }}
                        className={`rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          active
                            ? 'bg-white text-[#4A1942]'
                            : 'bg-white/10 text-white/90 hover:bg-white/20'
                        }`}
                      >
                        <div className="font-medium flex items-center gap-1">
                          <span>{category.icon}</span>
                          <span>{category.name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedVenueCategories.length > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      clearVenueCategories();
                    }}
                    className="mt-2 text-xs text-white/80 underline"
                  >
                    Clear category filters
                  </button>
                )}
              </div>

              <div>
                <label className="text-white/70 text-xs font-medium block mb-2">
                  SELECT VENUE
                </label>

                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {filteredVenues.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleVenueSelect(v.id);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between ${
                        v.id === currentVenue.id
                          ? 'bg-white/30 text-white'
                          : 'bg-white/10 text-white/90 hover:bg-white/20'
                      }`}
                    >
                      <div>
                        <div className="font-medium text-sm">
                          {v.name}
                          {isAdmin && !v.isMaster && (
                            <span className="text-orange-300 ml-1 text-xs">[Draft]</span>
                          )}
                        </div>
                        <div className="text-xs text-white/60">
                          {v.width}' × {v.height}' • {v.capacity} guests
                        </div>
                      </div>

                      {v.id === currentVenue.id && <span className="text-lg">✓</span>}
                    </button>
                  ))}

                  {filteredVenues.length === 0 && (
                    <div className="px-3 py-3 text-sm text-white/70 bg-white/5 rounded-lg">
                      No venues match the selected categories.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 space-y-2">
              {canOpenAdmin && onShowAdmin && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onShowAdmin();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-3 px-4 bg-white/20 hover:bg-white/30 rounded-lg text-left font-medium"
                >
                  ⚙️ Admin Panel
                </button>
              )}

              {canOpenOperations && onOpenOperations && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenOperations();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-3 px-4 bg-white/20 hover:bg-white/30 rounded-lg text-left font-medium"
                >
                  📋 Operations
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onShowTemplates();
                    setMobileMenuOpen(false);
                  }}
                  className="py-3 px-4 bg-white/10 hover:bg-white/20 rounded-lg text-center"
                >
                  📋 Templates
                </button>

                {onShowWorkspaceHelp && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      onShowWorkspaceHelp();
                      setMobileMenuOpen(false);
                    }}
                    className="py-3 px-4 bg-white/10 hover:bg-white/20 rounded-lg text-center"
                  >
                    ❔ Help
                  </button>
                )}

                {canOpenGuests && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      onShowGuests();
                      setMobileMenuOpen(false);
                    }}
                    className="py-3 px-4 bg-white/10 hover:bg-white/20 rounded-lg text-center"
                  >
                    👥 Guests
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowSaveModal(true);
                    setMobileMenuOpen(false);
                  }}
                  className="py-3 px-4 bg-white/10 hover:bg-white/20 rounded-lg text-center"
                >
                  💾 Save
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowLoadModal(true);
                    setMobileMenuOpen(false);
                  }}
                  className="py-3 px-4 bg-white/10 hover:bg-white/20 rounded-lg text-center"
                >
                  📂 Load
                </button>
              </div>

              {isAdmin && onSaveMasterLayout && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onSaveMasterLayout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-3 px-4 bg-green-600/80 hover:bg-green-600 rounded-lg text-center"
                >
                  👑 Save as Master Layout
                </button>
              )}

              {canPrint && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onPrint();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 rounded-lg text-center"
                >
                  🖨️ Print Layout
                </button>
              )}

              <div className="pt-2 border-t border-white/20 mt-2">
                <div className="text-white/60 text-xs mb-2 px-2">
                  Signed in as: {userName} ({isAdmin ? 'Admin' : isStaff ? 'Staff' : 'User'})
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-3 px-4 bg-red-500/80 hover:bg-red-500 rounded-lg text-center"
                >
                  🚪 Sign Out
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {showSaveModal && (
        <ModalDialog
          title="Save Layout"
          description="Save the current layout so you can return to it later."
          onClose={() => setShowSaveModal(false)}
          className="max-w-md"
        >
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Enter layout name..."
              value={layoutName}
              onChange={(e) => setLayoutName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A1942] focus:border-transparent"
              autoFocus
            />

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!layoutName.trim()}
                className="px-4 py-2 bg-[#4A1942] text-white rounded-lg hover:bg-[#5c2a64] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Layout
              </button>
            </div>
          </div>
        </ModalDialog>
      )}

      {showLoadModal && (
        <ModalDialog
          title="Load Layout"
          description="Choose one of your previously saved layouts."
          onClose={() => setShowLoadModal(false)}
          className="max-w-md"
        >
          <div className="space-y-4">
            {savedLayouts.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No saved layouts found.</p>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {savedLayouts.map((layout) => (
                  <div
                    key={layout.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                  >
                    <div>
                      <div className="font-medium text-gray-800">{layout.name}</div>
                      <div className="text-xs text-gray-500">
                        {layout.tables?.length || 0} tables, {layout.fixtures?.length || 0}{' '}
                        fixtures • {new Date(layout.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onLoadSavedLayout(layout.id);
                          setShowLoadModal(false);
                        }}
                        className="px-3 py-1 bg-[#4A1942] text-white rounded text-sm hover:bg-[#5c2a64]"
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteSavedLayout(layout.id)}
                        className="px-3 py-1 bg-red-100 text-red-600 rounded text-sm hover:bg-red-200"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowLoadModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </ModalDialog>
      )}
    </>
  );
}