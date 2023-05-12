import { __awaiter } from "tslib";
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
function bootstrap() {
    return __awaiter(this, void 0, void 0, function* () {
        const app = yield NestFactory.createApplicationContext(AppModule);
    });
}
bootstrap();
//# sourceMappingURL=main.js.map