// ─────────────────────────────────────────────
// API wrappers
// ─────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export interface PagedResponse<T> {
  content: T[];
  number: number;
  currentPage?: number;
  size: number;
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
  first?: boolean;
  suggestions?: string[];
  correctedQuery?: string | null;
}

// ─────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────
export type UserRole = 'CUSTOMER' | 'VENDOR' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  vendorId: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: User;
}

// ─────────────────────────────────────────────
// Products
// ─────────────────────────────────────────────
export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  brand: string;
  sku?: string;
  tags?: string[];
  price: number;
  unitPrice?: number;
  totalPrice?: number;
  discountedPrice?: number;
  stock: number;
  imageUrls: string[];
  vendorId: string;
  vendorName: string;
  averageRating: number;
  totalReviews: number;
  featured: boolean;
  active?: boolean; 
  flashSalePrice?: number;
  flashSaleEnd?: string;
  createdAt: string;
}

export type CategoryStatus = 'ACTIVE' | 'PENDING';

export interface Category {
  id: string;
  name: string;
  slug: string;
  status: CategoryStatus;
  requestedByVendorId?: string;
  createdAt: string;
}

// ─────────────────────────────────────────────
// Cart
// ─────────────────────────────────────────────
export interface CartItem {
  productId: string;
  productName: string;
  imageUrl: string;
  price: number;
  unitPrice?: number;
  discountedPrice?: number;
  quantity: number;
  stock: number;
  vendorName: string;
}

export interface Cart {
  items: CartItem[];
  totalAmount: number;
}

// ─────────────────────────────────────────────
// Orders
// ─────────────────────────────────────────────
export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  name?: string;
  imageUrl: string;
  quantity: number;
  qty?: number;
  price: number;
  unitPrice?: number;
  totalPrice?: number;
  vendorName: string;
  vendorId: string;
  returnRequested?: boolean;
}

export interface Address {
  id: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
}

/**
 * One vendor's isolated portion of a multi-vendor order. Mirrors the backend
 * VendorOrder sub-document. On vendor-facing endpoints (GET /api/vendor/orders,
 * GET /api/orders/:id as a vendor) `Order.vendorOrders` contains EXACTLY ONE
 * entry — the authenticated vendor's own portion. On customer/admin endpoints
 * it contains one entry per vendor represented in the order.
 */
export interface VendorOrder {
  id: string;
  vendorId: string;
  vendorName: string;
  parentOrderId?: string;
  items: OrderItem[];
  status: OrderStatus;
  cancellationReason?: string;
  confirmedAt?: string;

  // Shipping / tracking — vendor-specific
  trackingId?: string;
  courierName?: string;
  shippedDate?: string;
  deliveredAt?: string;

  // OTP-based delivery verification — vendor-specific
  otpVerified?: boolean;
  otpGeneratedAt?: string;

  // Revenue — computed only from this vendor's items
  subtotal: number;
  commissionAmount?: number;
  vendorEarnings?: number;
}

export interface Order {
  id: string;
  customerId?: string;
  customerName?: string;
  items: OrderItem[];
  /**
   * Per-vendor breakdown. Full list (one entry per vendor) on customer/admin
   * views; exactly one entry (the caller's own) on vendor views. Use this —
   * not the flat top-level `status`/`trackingId`/etc, which reflect only the
   * legacy single-vendor/aggregate view — for anything vendor-scoped.
   */
  vendorOrders: VendorOrder[];
  shippingAddress: Address;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  walletAmountUsed: number;
  razorpayAmount: number;
  total: number;
  totalAmount: number;
  couponCode?: string;
  trackingId?: string;
  placedAt?: string;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;

  // OTP-Based Delivery Verification
  deliveryOtpGenerated?: boolean;
  otpVerified?: boolean;
  otpGeneratedAt?: string;
  deliveredAt?: string;
  processingAt?: string;

  // Shipping Information
  courierName?: string;
  shippedDate?: string;

  // Revenue and Commission Tracking
  commissionAmount?: number;
  vendorEarnings?: number;
}

export interface CheckoutResponse {
  orderId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  key: string;
}

export interface DeliveryOtpResponse {
  orderId: string;
  otps: Array<{
    vendorId: string;
    vendorName: string;
    otp: string;
    generatedAt?: string;
    expiresAt?: string;
  }>;
}

// ─────────────────────────────────────────────
// Returns
// ─────────────────────────────────────────────
export type ReturnStatus = 
  | 'RETURN_REQUESTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PICKUP_SCHEDULED'
  | 'PICKED_UP'
  | 'RECEIVED_AT_WAREHOUSE'
  | 'QUALITY_CHECK'
  | 'REFUND_INITIATED'
  | 'REFUNDED'
  | 'APPEAL_REQUESTED'
  | 'ADMIN_REVIEW'
  | 'FINAL_APPROVED'
  | 'FINAL_REJECTED'
  | 'REJECTED_POST_QUALITY_CHECK';

export interface ReturnRequest {
  id: string;
  orderId: string;
  orderItemId?: string;
  vendorId?: string;
  productId: string;
  productName: string;
  // Fix D: customerId is sent by the backend (AdminService.toReturnResponse sets it)
  // but was absent from this type, making it invisible to TypeScript consumers
  // such as the admin returns table "Customer" column.
  customerId: string;
  reason: string;
  description?: string;
  quantityToReturn?: number;
  status: ReturnStatus;
  rejectionReason?: string;
  refundAmount?: number;
  resolvedAt?: string;
  updatedAt?: string;
  createdAt: string;
  pickupDate?: string;
  pickupAddress?: string;
  trackingNumber?: string;
  refundMethod?: string;
  razorpayRefundId?: string;
  appealReason?: string;
  adminResolutionReason?: string;
  qualityCheckPassed?: boolean | null;
  qualityCheckNotes?: string;
  // Enriched fields added for the vendor return-detail view.
  productImage?: string;
  quantity?: number;
  unitPrice?: number;
  customerName?: string;
  customerEmail?: string;
  evidenceImages?: string[];
}

// ─────────────────────────────────────────────
// Reviews
// ─────────────────────────────────────────────
export interface Review {
  id: string;
  productId: string;
  customerId: string;
  customerName: string;
  orderId: string;
  rating: number;
  title: string;
  comment: string;
  imageUrls?: string[];
  createdAt: string;
}

// ─────────────────────────────────────────────
// Wallet
// ─────────────────────────────────────────────
export interface WalletTransaction {
  id: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  description: string;
  createdAt: string;
}

export interface Wallet {
  balance: number;
  transactions: PagedResponse<WalletTransaction>;
}

export interface WalletTopupOrderResponse {
  topupOrderId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  key: string;
}

// ─────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────
export interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

// ─────────────────────────────────────────────
// Coupons (public — no code field)
// ─────────────────────────────────────────────
export type DiscountType = 'PERCENTAGE' | 'FLAT';

export interface PublicCoupon {
  id: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount?: number;
  minimumOrderValue: number;
  expiresAt: string;
}

// Authenticated customer view — includes the code (only revealed post-login)
// plus per-user eligibility against their current cart.
export interface MyCoupon {
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount?: number;
  minimumOrderValue: number;
  expiresAt: string;
  eligible: boolean;
  ineligibleReason?: string;
  estimatedDiscount: number;
}

export interface CouponPreview {
  code: string;
  discount: number;
  totalAfterDiscount: number;
}

// ─────────────────────────────────────────────
// Banners
// ─────────────────────────────────────────────
export type BannerPlacement = 'HOME' | 'CATEGORY';

export interface Banner {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  linkUrl?: string;
  link?: string;
  active?: boolean;
  isActive?: boolean;
  displayOrder: number;
  expiresAt?: string;
  placement?: BannerPlacement;
}

// ─────────────────────────────────────────────
// Vendor
// ─────────────────────────────────────────────
export type VendorStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type SubscriptionPlan = 'FREE' | 'BASIC' | 'PREMIUM' | 'ENTERPRISE';

export interface VendorStore {
  id: string;
  storeName: string;
  storeDescription: string;
  ownerName: string;
  ownerEmail: string;
  status: VendorStatus;
  rejectionReason?: string;
  commissionRate: number;
  totalEarnings: number;
  pendingPayout: number;
  nextPayoutDate?: string;   // ISO string; null/absent means no cooldown active
  createdAt: string;
  // ── Subscription fields ────────────────────────────────────────────────────
  subscriptionPlan?: SubscriptionPlan;
  subscriptionValidUntil?: string;
  productLimit?: number;
  subscriptionStatus?: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'FAILED';
}

export interface SubscriptionOrder {
  id: string;
  plan: SubscriptionPlan;
  amount: number;   // INR paise
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'FAILED';
  createdAt: string;
  completedAt?: string;
}

// ─────────────────────────────────────────────
// Admin
// ─────────────────────────────────────────────
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;    // ✅ matches JSON field name Jackson serializes
  createdAt: string;
}

export type CouponUserSegment = 'ALL' | 'NEW' | 'RETURNING';

export interface AdminCoupon {
  id: string;
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount?: number;
  minimumOrderValue: number;
  usageLimit: number;
  usageCount: number;
  active: boolean;
  expiresAt: string;
  // ── Targeting (optional; empty/undefined = no restriction) ──
  applicableCategories?: string[];
  firstOrderOnly?: boolean;
  userSegment?: CouponUserSegment;
}

export interface AdminStats {
  totalUsers: number;
  totalVendors: number;
  pendingVendors: number;
  pendingPayouts: number;
  // Fix B: renamed from approvedPayouts → paidPayouts to match DashboardStats.java.
  // approvePayout() transitions PENDING → PAID directly; APPROVED is never written,
  // so "approvedPayouts" was always 0. The API now serialises this field as "paidPayouts".
  paidPayouts: number;
  totalPayoutAmount: number;
  totalOrders: number;
  totalRevenue: number;
  totalProducts: number;
}

export type PayoutStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';

export interface PayoutRequest {
  id: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  status: PayoutStatus;
  requestedAt: string;
  processedAt?: string;
  processedBy?: string;
  rejectionReason?: string;
}
