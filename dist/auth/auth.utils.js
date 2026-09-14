"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateOtp = generateOtp;
exports.sha256 = sha256;
const crypto_1 = require("crypto");
function generateOtp() {
    return (0, crypto_1.randomInt)(0, 10000).toString().padStart(4, '0');
}
function sha256(input) {
    return (0, crypto_1.createHash)('sha256').update(input).digest('hex');
}
//# sourceMappingURL=auth.utils.js.map