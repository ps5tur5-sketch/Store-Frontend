export interface Product {
  seller_count?: number;
  default_provider?: string;
  default_offer_id?: string;
  offers?: SellerOffer[];
  sku: string;
  name: string;
  type: 'topup' | 'key' | 'subscription' | 'giftcard';
  price: number;
  currency: string;
  available: number;
  image?: string;
  description: string;
  features: string[];
}

export interface Order {
  id: string;
  sku: string;
  name: string;
  amount: number;
  currency: string;
  status: string;
  payment_state: string;
  provider?: string;
  code?: string;
  delivery_attempts: Array<Record<string, unknown>>;
}

export interface Supplier {
  display_name: string;
  requests_per_minute: number;
  provider: string;
  mode: string;
  failure_rate: number;
  timeout_rate: number;
  min_delay_ms: number;
  timeout_delay_ms: number;
}

export interface InventorySummary {
  reserved: number;
  sku: string;
  name: string;
  provider: string;
  available: number;
  issued: number;
  total: number;
}

export interface InventoryKey {
  offer_id: string;
  offer_name: string;
  reserved_order_id?: string;
  status_label: string;
  code: string;
  provider: string;
  sku: string;
  claimed_by?: string;
  claimed_at?: string;
}

export interface AccountUser {
  can_buy: boolean;
  can_sell: boolean;
  can_become_seller: boolean;
  role: 'buyer' | 'seller' | 'admin';
  seller_id: string | null;
  banned_at?: string | null;
  ban_reason?: string | null;
  id: string;
  username: string;
  points_balance: number;
  created_at: string;
}

export interface CartItem extends Product {
  offer_id: string;
  offer_name: string;
  demo_notice?: string | null;
  provider: string;
  seller_name: string;
  seller_flag: 'red' | 'none';
  purchasable: boolean;
  quantity: number;
  line_total: number;
  created_at: string;
  updated_at: string;
}

export interface Cart {
  items: CartItem[];
  item_count: number;
  total_points: number;
}

export interface CartQuote {
  external_to_pay?: number;
  code?: string | null;
  code_status: 'none' | 'valid' | 'not_found' | 'used';
  code_value_points: number;
  code_source_sku?: string;
  code_source_name?: string;
  code_applied_points: number;
  points_to_charge: number;
  total_points: number;
  item_count: number;
  balance_before: number;
  balance_after: number;
  can_checkout: boolean;
  error?: string;
}

export interface Purchase {
  assigned_offer_id?: string;
  offer_name?: string;
  refund_destination?: string;
  seller_name?: string;
  seller?: Seller;
  can_review?: boolean;
  review?: { rating: number; comment: string } | null;
  group_id?: string;
  image?: string;
  id: string;
  sku: string;
  name: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  payment_state: string;
  created_at: string;
  delivered_at?: string;
  provider?: string;
  code?: string;
  description?: string;
  features?: string[];
}

export interface PaymentCode {
  code: string;
  value_points: number;
  source_sku?: string;
  source_name?: string;
  used_at?: string;
  created_at: string;
  used_by_username?: string;
}

export interface OrderGroup {
  refund_details?: { revoked_keys: number; unissued_items: number };
  payment_id?: string | null;
  payment_method?: string;
  checkout_status?: string;
  refund_destination?: string;
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_state: string;
  terminal: boolean;
  created_at: string;
  money: {
    paid: number;
    delivered: number;
    refunded: number;
    pending: number;
    balanced: boolean;
    settled: boolean;
  };
  progress: { total: number; completed: number; delivered: number; refunded: number; queued: number };
  items: Purchase[];
}
export interface CheckoutResult {
  checkout_id: string;
  order_id: string;
  order_ids: string[];
  order: OrderGroup;
  total_points: number;
  balance_after: number;
  points_charged: number;
  code_applied_points: number;
}
export interface QueueReport {
  providers: {
    provider: string;
    queued: number;
    processing: number;
    delivered: number;
    refunded: number;
    next_attempt_at: string | null;
  }[];
  limits: { provider: string; requests_per_minute: number; requests_last_minute: number }[];
  unpaid: number;
}

export interface Seller {
  demo_scenario?: string | null;
  demo_notice?: string | null;
  banned_at?: string | null;
  ban_reason?: string | null;
  id: string;
  name: string;
  rating: number | null;
  review_count: number;
  confirmed_incidents: number;
  recent_incidents: number;
  delivered: number;
  refunded: number;
  flag: 'red' | 'none';
  flag_reasons: string[];
  reputation_note: string;
  evidence: { id: number; kind: string; created_at: string; proof: Record<string, unknown> }[];
  reviews: {
    rating: number;
    comment: string;
    created_at: string;
    buyer: string;
    verified_purchase: boolean;
  }[];
}
export interface SellerOffer {
  offer_id: string;
  offer_name: string;
  purchasable?: boolean;
  purchase_disabled_reason?: string | null;
  provider: string;
  price: number;
  currency: string;
  available: number;
  seller: Seller;
}

export interface PaymentMethod {
  id: 'balance' | 'sbp' | 'crypto';
  name: string;
  description: string;
  external: boolean;
}
export interface PaymentIntent {
  id: string;
  purpose: 'checkout' | 'wallet_topup';
  group_id: string | null;
  method: 'sbp' | 'crypto';
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired';
  can_confirm: boolean;
  can_retry: boolean;
  is_demo: boolean;
  created_at: string;
  expires_at: string;
  refunded_amount: number;
  username?: string;
  details: {
    title: string;
    instructions: string;
    reference?: string;
    asset?: string;
    network?: string;
    crypto_amount?: string;
    address?: string;
  };
}

export interface Withdrawal {
  id: string;
  method: 'card' | 'crypto';
  amount: number;
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired';
  created_at: string;
  expires_at: string;
  can_confirm: boolean;
  is_demo: boolean;
  username?: string;
  recipient: {
    display: string;
    card_last4?: string;
    address?: string;
    asset?: string;
    network?: string;
    crypto_amount?: string;
  };
}
