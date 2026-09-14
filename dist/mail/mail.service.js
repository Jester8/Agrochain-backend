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
var MailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const resend_1 = require("resend");
const otp_email_template_1 = require("./otp-email.template");
let MailService = MailService_1 = class MailService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(MailService_1.name);
        const apiKey = this.configService.get('mail.resendApiKey');
        this.resend = apiKey ? new resend_1.Resend(apiKey) : null;
        this.from = this.configService.get('mail.from');
    }
    async sendOtp(email, code, purpose) {
        const subject = purpose === 'signup' ? 'Verify your AgroChain account' : 'Reset your AgroChain password';
        const html = (0, otp_email_template_1.buildOtpEmailHtml)({ code, purpose });
        if (!this.resend) {
            this.logger.warn(`[DEV MODE - no RESEND_API_KEY] OTP for ${email} (${purpose}): ${code}`);
            return;
        }
        await this.resend.emails.send({
            from: this.from,
            to: email,
            subject,
            html,
        });
    }
};
exports.MailService = MailService;
exports.MailService = MailService = MailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MailService);
//# sourceMappingURL=mail.service.js.map