import { writable } from 'svelte/store';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

export const authUser = writable<AuthUser | null>(null);
export const isAuthenticated = writable(false);
