export interface Vendor {
  id: string;
  name: string;
  category: VendorCategory;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  notes?: string;
  rating?: number; // 1-5 stars
  isPreferred?: boolean;
  contractSigned?: boolean;
  contractAmount?: number;
  depositPaid?: boolean;
  depositAmount?: number;
  finalPaymentPaid?: boolean;
  finalPaymentDue?: string; // ISO date
  createdAt: string;
  updatedAt: string;
}

export type VendorCategory =
  | 'venue'
  | 'catering'
  | 'photography'
  | 'videography'
  | 'florist'
  | 'dj-band'
  | 'officiant'
  | 'cake'
  | 'hair-makeup'
  | 'transportation'
  | 'rentals'
  | 'coordinator'
  | 'security'
  | 'other';

export interface VendorPayment {
  id: string;
  vendorId: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  description: string;
  isPaid: boolean;
}

export const VENDOR_CATEGORIES: { id: VendorCategory; label: string; icon: string }[] = [
  { id: 'venue', label: 'Venue', icon: '🏛️' },
  { id: 'catering', label: 'Catering', icon: '🍽️' },
  { id: 'photography', label: 'Photography', icon: '📸' },
  { id: 'videography', label: 'Videography', icon: '🎬' },
  { id: 'florist', label: 'Florist', icon: '💐' },
  { id: 'dj-band', label: 'DJ/Band', icon: '🎵' },
  { id: 'officiant', label: 'Officiant', icon: '⛪' },
  { id: 'cake', label: 'Cake/Bakery', icon: '🎂' },
  { id: 'hair-makeup', label: 'Hair & Makeup', icon: '💄' },
  { id: 'transportation', label: 'Transportation', icon: '🚗' },
  { id: 'rentals', label: 'Rentals', icon: '🪑' },
  { id: 'coordinator', label: 'Coordinator', icon: '📋' },
  { id: 'security', label: 'Security', icon: '👮🏻‍♂️' },
  { id: 'other', label: 'Other', icon: '📦' },
];