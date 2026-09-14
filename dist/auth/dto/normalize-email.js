"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeEmail = normalizeEmail;
function normalizeEmail({ value }) {
    return typeof value === 'string' ? value.trim().toLowerCase() : value;
}
//# sourceMappingURL=normalize-email.js.map