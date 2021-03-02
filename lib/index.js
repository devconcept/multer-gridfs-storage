"use strict";
/**
 * Module entry point
 * @module multer-gridfs-storage
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GridFsStorage = void 0;
const gridfs_1 = require("./gridfs");
__exportStar(require("./cache"), exports);
__exportStar(require("./types"), exports);
exports.GridFsStorage = gridfs_1.GridFsStorageCtr;
//# sourceMappingURL=index.js.map