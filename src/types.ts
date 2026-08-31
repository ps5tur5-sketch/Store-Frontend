export interface Product {
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
  provider: 'A' | 'B';
  mode: string;
  failure_rate: number;
  timeout_rate: number;
  min_delay_ms: number;
  timeout_delay_ms: number;
}

export interface InventorySummary {
  sku: string;
  name: string;
  provider: string;
  available: number;
  issued: number;
  total: number;
}

export interface InventoryKey {
  code: string;
  provider: string;
  sku: string;
  claimed_by?: string;
  claimed_at?: string;
}

export interface AccountUser {
  id: string;
  username: string;
  points_balance: number;
  created_at: string;
}

export interface CartItem extends Product {
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
  code?: string;
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
