import { Injectable, OnModuleInit } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { Configuration, OpenAIApi } from 'openai';
import { MongoClient, Collection } from 'mongodb';

@Injectable()
export class BotService implements OnModuleInit {
  private bot: TelegramBot;
  private openai: OpenAIApi;
  private session: Collection;
  private messages: Collection;

  constructor() {
    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

    MongoClient.connect(process.env.MONGO_URI)
      .then((client) => {
        this.session = client.db().collection('telegramSession');
        this.messages = client.db().collection('telegramChat');

        this.initializeBot().then();
      })
      .catch((err) => console.error(err));
  }

  async onModuleInit() {
    const configuration = new Configuration({
      organization: process.env.OPENAI_API_ORGANIZATION,
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.openai = new OpenAIApi(configuration);

    // const response = await openai.listEngines();
    // console.log('listEngines: ', response.data);

    // https://platform.openai.com/docs/api-reference/models
  }

  private async initializeBot(): Promise<void> {
    this.bot.onText(/\/start|\/help/, (msg) => {
      const chatId = msg.chat.id;

      const message = `
      Hello!
      This is the free ChatGPT bot by Pavel Valentov from Angry Robot Deals.
      For using AI you need to set the model first and subscribe to my @angryrobotdeals channel.
      Model GPT-3.5 is fast, but GPT-4 is slow and more powerful.
      Here are the commands you can use:
      /setmodel - Set the AI model (either gpt-3.5-turbo or GPT-4)
      /newchat - Start a new chat session
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

    this.bot.onText(/\/newchat/, async (msg) => {
      const chatId = msg.chat.id;

      await this.session.updateOne({ _id: chatId }, { $set: { chatHistory: '' } }, { upsert: true });

      this.bot.sendMessage(chatId, 'Started a new chat session.');
    });

    this.bot.on('callback_query', async (query) => {
      const chatId = query.message.chat.id;

      await this.session.updateOne({ _id: chatId }, { $set: { model: query.data } }, { upsert: true });

      this.bot.answerCallbackQuery(query.id, { text: `Model set to ${query.data}` });
    });

    this.bot.on('message', async (msg) => {
      if (msg.text?.startsWith('/')) {
        return;
      }

      const chatId = msg.chat.id;
      const session = await this.session.findOne({ _id: chatId });
      const model = session?.model || 'gpt-3.5-turbo'; // default to gpt-3.5-turbo
      const chatHistory = session?.chatHistory || '';

      try {
        // console.log(msg);

        const response = await this.openai.createChatCompletion({
          model,
          messages: [{ role: 'user', content: chatHistory + '\n' + msg.text }],
          max_tokens: 2048,
        });

        await this.messages.insertOne({ ...msg, answer: response.data });
        // console.log(response.data);

        const aiReply = response.data?.choices?.[0]?.message?.content?.trim() || 'Empty answer';
        const updatedChatHistory = chatHistory + '\nUser: ' + msg.text + '\nAI: ' + aiReply;

        await this.session.updateOne({ _id: chatId }, { $set: { chatHistory: updatedChatHistory } }, { upsert: true });

        this.bot.sendMessage(chatId, aiReply);
      } catch (error) {
        if (error.response) {
          console.log(error.response.status);
          console.log(error.response.data);
        } else {
          console.log(error.message);
        }
        this.bot.sendMessage(chatId, `Sorry, something went wrong: ${error.message}`);
      }
    });
  }
}
