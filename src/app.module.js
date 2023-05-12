import { __decorate } from "tslib";
import { Module } from '@nestjs/common';
import { BotModule } from './bot/bot.module';
let AppModule = class AppModule {
};
AppModule = __decorate([
    Module({
        imports: [BotModule],
    })
], AppModule);
export { AppModule };
//# sourceMappingURL=app.module.js.map