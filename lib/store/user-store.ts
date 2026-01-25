import { makeAutoObservable, runInAction } from "mobx";
import { getApiBase } from "../api-base";

export interface User {
    id: string;
    name: string;
    avatar?: string;
}

class UserStore {
    currentUser: User | null = null;
    users: User[] = [];
    isLoading: boolean = false;
    error: string | null = null;

    constructor() {
        makeAutoObservable(this);
        if (typeof window !== 'undefined') {
            this.loadUsers().then(() => {
                this.loadSession();
            });
        }
    }

    async loadUsers() {
        this.isLoading = true;
        try {
            const res = await fetch(`${getApiBase()}/users`);
            if (res.ok) {
                const data = await res.json();
                runInAction(() => {
                    this.users = data.users || [];
                });
            }
        } catch (e) {
            console.error("Failed to load users", e);
        } finally {
            runInAction(() => {
                this.isLoading = false;
            });
        }
    }

    loadSession() {
        if (typeof window !== 'undefined') {
            const savedId = localStorage.getItem('CURRENT_USER_ID');
            if (savedId) {
                const user = this.users.find(u => u.id === savedId);
                if (user) {
                    this.currentUser = user;
                }
            }
            // Fallback for demo: if no user but users exist, use first one? 
            // Better to stay logged out if no session.
        }
    }

    async login(username: string, password: string): Promise<boolean> {
        this.isLoading = true;
        this.error = null;
        try {
            const res = await fetch(`${getApiBase()}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'login', username, password })
            });

            const data = await res.json();
            
            if (res.ok && data.user) {
                runInAction(() => {
                    this.currentUser = data.user;
                });
                if (typeof window !== 'undefined') {
                    localStorage.setItem('CURRENT_USER_ID', data.user.id);
                }
                // Reload to refresh project/history context
                window.location.reload();
                return true;
            } else {
                runInAction(() => {
                    this.error = data.error || 'Login failed';
                });
                return false;
            }
        } catch {
            runInAction(() => {
                this.error = 'Network error';
            });
            return false;
        } finally {
            runInAction(() => {
                this.isLoading = false;
            });
        }
    }

    async register(username: string, password: string): Promise<boolean> {
        this.isLoading = true;
        this.error = null;
        try {
            const res = await fetch(`${getApiBase()}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'register', username, password })
            });

            const data = await res.json();
            
            if (res.ok && data.user) {
                runInAction(() => {
                    this.currentUser = data.user;
                    this.users.push(data.user);
                });
                if (typeof window !== 'undefined') {
                    localStorage.setItem('CURRENT_USER_ID', data.user.id);
                }
                window.location.reload();
                return true;
            } else {
                runInAction(() => {
                    this.error = data.error || 'Registration failed';
                });
                return false;
            }
        } catch {
            runInAction(() => {
                this.error = 'Network error';
            });
            return false;
        } finally {
            runInAction(() => {
                this.isLoading = false;
            });
        }
    }

    async updateProfile(updates: { name?: string; avatar?: string; password?: string }) {
        if (!this.currentUser) return false;
        
        this.isLoading = true;
        try {
            const res = await fetch(`${getApiBase()}/users`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: this.currentUser.id, ...updates })
            });

            const data = await res.json();
            
            if (res.ok && data.user) {
                runInAction(() => {
                    this.currentUser = data.user;
                    // Update local list too
                    const idx = this.users.findIndex(u => u.id === data.user.id);
                    if (idx > -1) {
                        this.users[idx] = data.user;
                    }
                });
                return true;
            }
            return false;
        } catch (e) {
            console.error(e);
            return false;
        } finally {
            runInAction(() => {
                this.isLoading = false;
            });
        }
    }

    logout() {
        this.currentUser = null;
        if (typeof window !== 'undefined') {
            localStorage.removeItem('CURRENT_USER_ID');
        }
        window.location.reload();
    }
}

export const userStore = new UserStore();
