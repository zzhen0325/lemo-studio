"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const gulux_1 = require("@gulux/gulux");
const http_error_1 = require("../utils/http-error");
const db_1 = require("../db");
let UsersService = class UsersService {
    userModel;
    async getUsers(userId) {
        try {
            if (userId) {
                const user = await this.userModel.findById(userId).lean();
                if (!user) {
                    throw new http_error_1.HttpError(404, 'User not found');
                }
                const { password, ...safeUser } = user;
                return { user: { ...safeUser, id: String(user._id) } };
            }
            const users = await this.userModel.find().lean();
            const safeUsers = users.map((u) => {
                const { password, ...rest } = u;
                return { ...rest, id: String(u._id) };
            });
            return { users: safeUsers };
        }
        catch (error) {
            if (error instanceof http_error_1.HttpError)
                throw error;
            console.error('Failed to load users', error);
            throw new http_error_1.HttpError(500, 'Failed to load users');
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async handlePost(body) {
        try {
            const { action } = body;
            if (action === 'register') {
                const { username, password } = body;
                if (!username || !password) {
                    throw new http_error_1.HttpError(400, 'Missing credentials');
                }
                const exists = await this.userModel.findOne({ name: username });
                if (exists) {
                    throw new http_error_1.HttpError(409, 'Username already exists');
                }
                const newUser = await this.userModel.create({
                    name: username,
                    password,
                    avatar: `/avatars/${Math.floor(Math.random() * 5) + 1}.png`,
                    createdAt: new Date().toISOString(),
                });
                const { password: _, ...safeUser } = newUser.toObject();
                return { user: { ...safeUser, id: String(newUser._id) } };
            }
            if (action === 'login') {
                const { username, password } = body;
                const user = await this.userModel.findOne({ name: username, password }).lean();
                if (!user) {
                    throw new http_error_1.HttpError(401, 'Invalid credentials');
                }
                const { password: _, ...safeUser } = user;
                return { user: { ...safeUser, id: String(user._id) } };
            }
            throw new http_error_1.HttpError(400, 'Invalid action');
        }
        catch (error) {
            if (error instanceof http_error_1.HttpError)
                throw error;
            console.error('User POST operation failed', error);
            throw new http_error_1.HttpError(500, 'Operation failed');
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async updateUser(body) {
        try {
            const { id, name, avatar, password } = body;
            if (!id) {
                throw new http_error_1.HttpError(400, 'User ID required');
            }
            const user = await this.userModel.findById(id);
            if (!user) {
                throw new http_error_1.HttpError(404, 'User not found');
            }
            if (name)
                user.name = name;
            if (avatar)
                user.avatar = avatar;
            if (password)
                user.password = password;
            await user.save();
            const { password: _, ...safeUser } = user.toObject();
            return { user: { ...safeUser, id: String(user._id) } };
        }
        catch (error) {
            if (error instanceof http_error_1.HttpError)
                throw error;
            console.error('Update user failed', error);
            throw new http_error_1.HttpError(500, 'Update failed');
        }
    }
};
exports.UsersService = UsersService;
__decorate([
    (0, gulux_1.Inject)(db_1.User),
    __metadata("design:type", Object)
], UsersService.prototype, "userModel", void 0);
exports.UsersService = UsersService = __decorate([
    (0, gulux_1.Injectable)()
], UsersService);
