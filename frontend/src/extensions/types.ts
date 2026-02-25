export interface SubscriptionInfo {
  [key: string]: unknown;
}

export interface PlanInfo {
  [key: string]: unknown;
}

export interface CheckoutResponse {
  checkout_url: string;
}

export interface PortalResponse {
  portal_url: string;
}
