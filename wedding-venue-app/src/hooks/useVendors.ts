import { useState, useCallback, useEffect } from 'react';
import { Vendor, VendorCategory, VendorPayment } from '../types/vendor';

const VENDORS_KEY = 'spm_vendors';
const PAYMENTS_KEY = 'spm_vendor_payments';

function loadVendors(): Vendor[] {
  try {
    const raw = localStorage.getItem(VENDORS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveVendors(vendors: Vendor[]): void {
  localStorage.setItem(VENDORS_KEY, JSON.stringify(vendors));
}

function loadPayments(): VendorPayment[] {
  try {
    const raw = localStorage.getItem(PAYMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePayments(payments: VendorPayment[]): void {
  localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
}

export function useVendors() {
  const [vendors, setVendors] = useState<Vendor[]>(() => loadVendors());
  const [payments, setPayments] = useState<VendorPayment[]>(() => loadPayments());

  useEffect(() => {
    saveVendors(vendors);
  }, [vendors]);

  useEffect(() => {
    savePayments(payments);
  }, [payments]);

  const addVendor = useCallback((vendor: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>): Vendor => {
    const newVendor: Vendor = {
      ...vendor,
      id: `vendor-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setVendors(prev => [...prev, newVendor]);
    return newVendor;
  }, []);

  const updateVendor = useCallback((id: string, updates: Partial<Vendor>) => {
    setVendors(prev => prev.map(v => 
      v.id === id ? { ...v, ...updates, updatedAt: new Date().toISOString() } : v
    ));
  }, []);

  const deleteVendor = useCallback((id: string) => {
    setVendors(prev => prev.filter(v => v.id !== id));
    setPayments(prev => prev.filter(p => p.vendorId !== id));
  }, []);

  const getVendorsByCategory = useCallback((category: VendorCategory): Vendor[] => {
    return vendors.filter(v => v.category === category);
  }, [vendors]);

  const getPreferredVendors = useCallback((): Vendor[] => {
    return vendors.filter(v => v.isPreferred);
  }, [vendors]);

  const addPayment = useCallback((payment: Omit<VendorPayment, 'id'>): VendorPayment => {
    const newPayment: VendorPayment = {
      ...payment,
      id: `payment-${Date.now()}`,
    };
    setPayments(prev => [...prev, newPayment]);
    return newPayment;
  }, []);

  const updatePayment = useCallback((id: string, updates: Partial<VendorPayment>) => {
    setPayments(prev => prev.map(p => 
      p.id === id ? { ...p, ...updates } : p
    ));
  }, []);

  const deletePayment = useCallback((id: string) => {
    setPayments(prev => prev.filter(p => p.id !== id));
  }, []);

  const getPaymentsForVendor = useCallback((vendorId: string): VendorPayment[] => {
    return payments.filter(p => p.vendorId === vendorId);
  }, [payments]);

  const getTotalBudget = useCallback((): number => {
    return vendors.reduce((sum, v) => sum + (v.contractAmount || 0), 0);
  }, [vendors]);

  const getTotalPaid = useCallback((): number => {
    return payments.filter(p => p.isPaid).reduce((sum, p) => sum + p.amount, 0);
  }, [payments]);

  const getUpcomingPayments = useCallback((days: number = 30): VendorPayment[] => {
    const future = new Date();
    future.setDate(future.getDate() + days);
    return payments.filter(p => 
      !p.isPaid && new Date(p.dueDate) <= future
    ).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [payments]);

  return {
    vendors,
    payments,
    addVendor,
    updateVendor,
    deleteVendor,
    getVendorsByCategory,
    getPreferredVendors,
    addPayment,
    updatePayment,
    deletePayment,
    getPaymentsForVendor,
    getTotalBudget,
    getTotalPaid,
    getUpcomingPayments,
  };
}