export type Tier = 'anonymous' | 'authenticated';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider?: string;
}

export interface SessionSnapshot {
  tier: Tier;
  authenticated: boolean;
  user: SessionUser | null;
  loginUrl: string | null;
}
