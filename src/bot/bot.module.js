import { __decorate } from "tslib";
import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
let BotModule = class BotModule {
};
BotModule = __decorate([
    Module({
        providers: [BotService]
    })
], BotModule);
export { BotModule };
//# sourceMappingURL=bot.module.js.map