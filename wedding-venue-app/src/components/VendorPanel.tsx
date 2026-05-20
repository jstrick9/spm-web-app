import React, { useState, useMemo } from 'react';
import { useVendors } from '../hooks/useVendors';
import { Vendor, VendorCategory, VENDOR_CATEGORIES } from '../types/vendor';

interface VendorPanelProps {
  onClose: () => void;
}

export function VendorPanel({ onClose }: VendorPanelProps) {
  const {
    vendors,
    addVendor,
    updateVendor,
    deleteVendor,
    getVendorsByCategory,
    getTotalBudget,
    getTotalPaid,
  } = useVendors();

  const [activeTab, setActiveTab] = useState<'list' | 'add' | 'budget'>('list');
  const [filterCategory, setFilterCategory] = useState<VendorCategory | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  const [newVendor, setNewVendor] = useState({
    name: '',
    category: 'other' as VendorCategory,
    contactName: '',
    email: '',
    phone: '',
    website: '',
    notes: '',
    contractAmount: 0,
  });

  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const matchesCategory = filterCategory === 'all' || v.category === filterCategory;
      const matchesSearch = !searchTerm || 
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.contactName?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [vendors, filterCategory, searchTerm]);

  const getCategoryInfo = (category: VendorCategory) => {
    return VENDOR_CATEGORIES.find(c => c.id === category) || VENDOR_CATEGORIES[VENDOR_CATEGORIES.length - 1];
  };

  const handleAddVendor = () => {
    if (!newVendor.name.trim()) return;
    addVendor({
      name: newVendor.name.trim(),
      category: newVendor.category,
      contactName: newVendor.contactName || undefined,
      email: newVendor.email || undefined,
      phone: newVendor.phone || undefined,
      website: newVendor.website || undefined,
      notes: newVendor.notes || undefined,
      contractAmount: newVendor.contractAmount || undefined,
    });
    setNewVendor({
      name: '',
      category: 'other',
      contactName: '',
      email: '',
      phone: '',
      website: '',
      notes: '',
      contractAmount: 0,
    });
    setActiveTab('list');
  };

  const totalBudget = getTotalBudget();
  const totalPaid = getTotalPaid();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
      <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#4A1942] to-[#3d1a45] text-white p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">🤝 Vendor Management</h2>
            <p className="text-sm text-white/70">{vendors.length} vendor(s) tracked</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {[
            { id: 'list', label: '📋 Vendors', count: vendors.length },
            { id: 'add', label: '➕ Add Vendor' },
            { id: 'budget', label: '💰 Budget' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-[#4A1942] text-[#4A1942]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label} {tab.count !== undefined && `(${tab.count})`}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {/* Vendor List */}
          {activeTab === 'list' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex gap-3">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search vendors..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value as VendorCategory | 'all')}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="all">All Categories</option>
                  {VENDOR_CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Vendor Cards */}
              {filteredVendors.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-4xl mb-2">🤝</div>
                  <p>No vendors found. Add your first vendor!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredVendors.map(vendor => {
                    const catInfo = getCategoryInfo(vendor.category);
                    return (
                      <div
                        key={vendor.id}
                        className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{catInfo.icon}</span>
                            <div>
                              <h3 className="font-semibold text-gray-800">{vendor.name}</h3>
                              <p className="text-xs text-gray-500">{catInfo.label}</p>
                            </div>
                          </div>
                          {vendor.isPreferred && (
                            <span className="text-yellow-500" title="Preferred Vendor">⭐</span>
                          )}
                        </div>

                        {vendor.contactName && (
                          <p className="text-sm text-gray-600 mb-1">👤 {vendor.contactName}</p>
                        )}
                        {vendor.email && (
                          <p className="text-sm text-gray-600 mb-1">✉️ {vendor.email}</p>
                        )}
                        {vendor.phone && (
                          <p className="text-sm text-gray-600 mb-1">📞 {vendor.phone}</p>
                        )}
                        {vendor.contractAmount && (
                          <p className="text-sm font-medium text-green-600 mb-1">
                            💰 ${vendor.contractAmount.toLocaleString()}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
                          {vendor.contractSigned ? (
                            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                              ✓ Contract Signed
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">
                              Pending Contract
                            </span>
                          )}
                          {vendor.depositPaid && (
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                              Deposit Paid
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => setEditingVendor(vendor)}
                            className="flex-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs transition-colors"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete ${vendor.name}?`)) {
                                deleteVendor(vendor.id);
                              }
                            }}
                            className="px-3 py-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg text-xs transition-colors"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Add Vendor Form */}
          {activeTab === 'add' && (
            <div className="max-w-lg mx-auto space-y-4">
              <h3 className="text-lg font-semibold">Add New Vendor</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Name *</label>
                <input
                  type="text"
                  value={newVendor.name}
                  onChange={e => setNewVendor(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Elegant Flowers"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={newVendor.category}
                  onChange={e => setNewVendor(prev => ({ ...prev, category: e.target.value as VendorCategory }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {VENDOR_CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={newVendor.contactName}
                    onChange={e => setNewVendor(prev => ({ ...prev, contactName: e.target.value }))}
                    placeholder="Optional"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={newVendor.phone}
                    onChange={e => setNewVendor(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Optional"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={newVendor.email}
                  onChange={e => setNewVendor(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Optional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contract Amount ($)</label>
                <input
                  type="number"
                  value={newVendor.contractAmount || ''}
                  onChange={e => setNewVendor(prev => ({ ...prev, contractAmount: parseFloat(e.target.value) || 0 }))}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={newVendor.notes}
                  onChange={e => setNewVendor(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional notes..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <button
                onClick={handleAddVendor}
                disabled={!newVendor.name.trim()}
                className="w-full py-3 bg-[#4A1942] text-white rounded-lg font-medium hover:bg-[#3b1435] disabled:opacity-50 transition-colors"
              >
                Add Vendor
              </button>
            </div>
          )}

          {/* Budget View */}
          {activeTab === 'budget' && (
            <div className="space-y-6">
              {/* Budget Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    ${totalBudget.toLocaleString()}
                  </div>
                  <div className="text-sm text-blue-800">Total Budget</div>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    ${totalPaid.toLocaleString()}
                  </div>
                  <div className="text-sm text-green-800">Total Paid</div>
                </div>
                <div className="bg-amber-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-amber-600">
                    ${(totalBudget - totalPaid).toLocaleString()}
                  </div>
                  <div className="text-sm text-amber-800">Remaining</div>
                </div>
              </div>

              {/* Breakdown by Category */}
              <div>
                <h4 className="font-semibold mb-3">Budget by Category</h4>
                <div className="space-y-2">
                  {VENDOR_CATEGORIES.map(cat => {
                    const catVendors = getVendorsByCategory(cat.id);
                    const catTotal = catVendors.reduce((sum, v) => sum + (v.contractAmount || 0), 0);
                    if (catTotal === 0) return null;
                    const percentage = totalBudget > 0 ? (catTotal / totalBudget) * 100 : 0;
                    return (
                      <div key={cat.id} className="flex items-center gap-3">
                        <span className="text-xl w-8">{cat.icon}</span>
                        <div className="flex-1">
                          <div className="flex justify-between text-sm mb-1">
                            <span>{cat.label}</span>
                            <span className="font-medium">${catTotal.toLocaleString()}</span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#4A1942] rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 w-12 text-right">
                          {percentage.toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VendorPanel;