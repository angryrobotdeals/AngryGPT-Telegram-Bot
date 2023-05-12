import { __awaiter, __decorate, __metadata } from 'tslib';
import { Injectable } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { Configuration, OpenAIApi } from 'openai';
import { MongoClient } from 'mongodb';
let BotService = class BotService {
  constructor() {
    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
    MongoClient.connect(process.env.MONGO_URI)
      .then((client) => {
        this.telegramSession = client.db().collection('telegramSession');
      })
      .catch((err) => console.error(err));
  }
  onModuleInit() {
    return __awaiter(this, void 0, void 0, function* () {
      const configuration = new Configuration({
        organization: process.env.OPENAI_API_ORGANIZATION,
        apiKey: process.env.OPENAI_API_KEY,
      });
      const openai = new OpenAIApi(configuration);
      const response = yield openai.listEngines();
      console.log('listEngines: ', response.data);
      // https://platform.openai.com/docs/api-reference/models
      yield this.initializeBot();
    });
  }
  initializeBot() {
    return __awaiter(this, void 0, void 0, function* () {
      this.bot.onText(/\/start|\/help/, (msg) => {
        const chatId = msg.chat.id;
        const message = `
      Hello! Here are the commands you can use:
      /setmodel - Set the AI model (either gpt-3.5-turbo or text-davinci-002)
      /help - Show this help message
      `;
        this.bot.sendMessage(chatId, message);
      });
      this.bot.onText(/\/setmodel/, (msg) => {
        const chatId = msg.chat.id;
        const options = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: 'GPT-3.5', callback_data: 'gpt-3.5-turbo' },
                { text: 'GPT-4', callback_data: 'gpt-4-0314' },
              ],
            ],
          },
        };
        this.bot.sendMessage(chatId, 'Choose a model:', options);
      });
      this.bot.on('callback_query', (query) =>
        __awaiter(this, void 0, void 0, function* () {
          const chatId = query.message.chat.id;
          yield this.telegramSession.updateOne({ _id: chatId }, { $set: { model: query.data } }, { upsert: true });
          this.bot.answerCallbackQuery(query.id, { text: `Model set to ${query.data}` });
        })
      );
      this.bot.on('message', (msg) =>
        __awaiter(this, void 0, void 0, function* () {
          if (msg.text?.startsWith('/')) {
            return;
          }
          const chatId = msg.chat.id;
          const session = yield this.telegramSession.findOne({ _id: chatId });
          const model = (session === null || session === void 0 ? void 0 : session.model) || 'gpt-3.5-turbo'; // default to gpt-3.5-turbo
          try {
            const response = yield this.openai.createCompletion({
              model: model,
              prompt: msg.text,
              max_tokens: 60,
            });
            this.bot.sendMessage(chatId, response.data.choices[0].text.trim());
          } catch (err) {
            console.error(err);
            this.bot.sendMessage(chatId, 'Sorry, something went wrong.');
          }
        })
      );
    });
  }
};
BotService = __decorate([Injectable(), __metadata('design:paramtypes', [])], BotService);
export { BotService };
//# sourceMappingURL=bot.service.js.map
