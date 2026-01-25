"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectMongo = connectMongo;
exports.getMongoose = getMongoose;
const mongoose_1 = __importDefault(require("mongoose"));
const DEFAULT_URI = 'mongodb+consul+token://bytedance.bytedoc.lemon8_design_aigc/lemon8_design_aigc?connectTimeoutMS=2000';
let connecting = null;
async function connectMongo() {
    const uri = process.env.MONGODB_URI || DEFAULT_URI;
    const dbName = process.env.MONGODB_DB || 'lemon8_design_aigc';
    if (mongoose_1.default.connection.readyState === 1) {
        return mongoose_1.default;
    }
    if (!connecting) {
        connecting = mongoose_1.default.connect(uri, {
            dbName,
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 3000,
        });
    }
    return connecting;
}
function getMongoose() {
    return mongoose_1.default;
}
