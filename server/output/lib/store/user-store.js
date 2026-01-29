"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userStore = void 0;
const mobx_1 = require("mobx");
const api_base_1 = require("../api-base");
class UserStore {
    currentUser = null;
    users = [];
    isLoading = false;
    error = null;
    constructor() {
        (0, mobx_1.makeAutoObservable)(this);
        if (typeof window !== 'undefined') {
            this.loadUsers().then(() => {
                this.loadSession();
            });
        }
    }
    async loadUsers() {
        this.isLoading = true;
        try {
            const res = await fetch(`${(0, api_base_1.getApiBase)()}/users`);
            if (res.ok) {
                const data = await res.json();
                (0, mobx_1.runInAction)(() => {
                    this.users = data.users || [];
                });
            }
        }
        catch (e) {
            console.error("Failed to load users", e);
        }
        finally {
            (0, mobx_1.runInAction)(() => {
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
    async login(username, password) {
        this.isLoading = true;
        this.error = null;
        try {
            const res = await fetch(`${(0, api_base_1.getApiBase)()}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'login', username, password })
            });
            const data = await res.json();
            if (res.ok && data.user) {
                (0, mobx_1.runInAction)(() => {
                    this.currentUser = data.user;
                });
                if (typeof window !== 'undefined') {
                    localStorage.setItem('CURRENT_USER_ID', data.user.id);
                }
                // Reload to refresh project/history context
                window.location.reload();
                return true;
            }
            else {
                (0, mobx_1.runInAction)(() => {
                    this.error = data.error || 'Login failed';
                });
                return false;
            }
        }
        catch {
            (0, mobx_1.runInAction)(() => {
                this.error = 'Network error';
            });
            return false;
        }
        finally {
            (0, mobx_1.runInAction)(() => {
                this.isLoading = false;
            });
        }
    }
    async register(username, password) {
        this.isLoading = true;
        this.error = null;
        try {
            const res = await fetch(`${(0, api_base_1.getApiBase)()}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'register', username, password })
            });
            const data = await res.json();
            if (res.ok && data.user) {
                (0, mobx_1.runInAction)(() => {
                    this.currentUser = data.user;
                    this.users.push(data.user);
                });
                if (typeof window !== 'undefined') {
                    localStorage.setItem('CURRENT_USER_ID', data.user.id);
                }
                window.location.reload();
                return true;
            }
            else {
                (0, mobx_1.runInAction)(() => {
                    this.error = data.error || 'Registration failed';
                });
                return false;
            }
        }
        catch {
            (0, mobx_1.runInAction)(() => {
                this.error = 'Network error';
            });
            return false;
        }
        finally {
            (0, mobx_1.runInAction)(() => {
                this.isLoading = false;
            });
        }
    }
    async updateProfile(updates) {
        if (!this.currentUser)
            return false;
        this.isLoading = true;
        try {
            const res = await fetch(`${(0, api_base_1.getApiBase)()}/users`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: this.currentUser.id, ...updates })
            });
            const data = await res.json();
            if (res.ok && data.user) {
                (0, mobx_1.runInAction)(() => {
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
        }
        catch (e) {
            console.error(e);
            return false;
        }
        finally {
            (0, mobx_1.runInAction)(() => {
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
exports.userStore = new UserStore();
