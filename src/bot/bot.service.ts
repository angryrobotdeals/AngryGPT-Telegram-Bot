import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import OpenAI, { ClientOptions } from 'openai';
import { MongoClient, Collection } from 'mongodb';

@Injectable()
export class BotService implements OnModuleInit {
  private bot: TelegramBot;
  private openai: OpenAI;
  private session: Collection;
  private messages: Collection;
  private log: Collection;
  private images: Collection;

  private mainKeyboard = {
    reply_markup: {
      remove_keyboard: true,
    },
  };
  // private mainKeyboard = {
  //   reply_markup: {
  //     keyboard: [[{ text: 'Menu' }, { text: 'Image generation' }]],
  //     resize_keyboard: true,
  //     one_time_keyboard: false,
  //   },
  // };

  constructor() {
    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

    MongoClient.connect(process.env.MONGO_URI)
      .then((client) => {
        this.session = client.db().collection('telegramSession');
        this.messages = client.db().collection('telegramChat');
        this.log = client.db().collection('telegramLog');
        this.images = client.db().collection('telegramImages');

        this.initializeBot().then();
      })
      .catch((err) => console.error(err));
  }

  async onModuleInit() {
    const configuration: ClientOptions = {
      organization: process.env.OPENAI_API_ORGANIZATION,
      apiKey: process.env.OPENAI_API_KEY,
    };
    this.openai = new OpenAI(configuration);
    // const response = await openai.listEngines();
    // console.log('listEngines: ', response.data);

    // https://platform.openai.com/docs/api-reference/models
  }

  private async initializeBot(): Promise<void> {
    this.bot.onText(/\/start|\/help/, (msg) => {
      const chatId = msg.chat.id;

      const message = `Hello!
This is the free ChatGPT bot by Pavel Valentov from Angry Robot Deals.

For using AI you need to set the model first
Model GPT-4o-mini is fast, but GPT-4o is slow and more powerful.
And you may subscribe to my @angryrobotdeals news channel.

Here are the commands you can use:
/setmodel - Set the AI chat model (either GPT-4o-mini or GPT-4o)
/newchat - Start a new chat session
/images - Start image generation mode
/help - Show this help message`;

      this.bot.sendMessage(chatId, message);
    });

    this.bot.onText(/\/setmodel/, (msg) => {
      const chatId = msg.chat.id;

      const options = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'GPT-4o-mini', callback_data: 'gpt-4o-mini' },
              { text: 'GPT-4o', callback_data: 'gpt-4o' },
            ],
          ],
        },
      };

      this.bot.sendMessage(chatId, 'Choose a model:', options);
    });

    this.bot.onText(/\/newchat/, async (msg) => {
      const chatId = msg.chat.id;

      await this.session.updateOne({ _id: chatId }, { $set: { chatHistory: '', mode: 'text' } }, { upsert: true });

      this.bot.sendMessage(chatId, 'Started a new chat session.');
    });

    this.bot.onText(/\/images/, async (msg) => {
      const chatId = msg.chat.id;

      await this.session.updateOne({ _id: chatId }, { $set: { chatHistory: '', mode: 'image' } }, { upsert: true });
      await this.bot.sendMessage(
        chatId,
        'Switched to image generation mode. Please, provide a prompt for image generation.',
        this.mainKeyboard,
      );
    });

    this.bot.on('callback_query', async (query) => {
      const chatId = query.message.chat.id;

      await this.session.updateOne(
        { _id: chatId },
        { $set: { model: query.data, chatHistory: '', mode: 'text' } },
        { upsert: true },
      );

      this.bot.answerCallbackQuery(query.id, { text: `Model set to ${query.data}` });
    });

    this.bot.on('message', async (msg) => {
      if (msg.text?.startsWith('/')) {
        return;
      }

      const chatId = msg.chat.id;
      const session = await this.session.findOne({ _id: chatId });
      const mode = session?.mode || 'text'; // default to 'text'
      const model = session?.model || 'gpt-4o-mini'; // default to gpt-4o-mini
      const chatHistory = (session?.chatHistory || '').slice(-1024);

      try {
        // console.log(msg);
        if (mode === 'image') {
          const response = await this.openai.images.generate({ model: 'dall-e-3', prompt: msg.text, n: 2 });

          // console.log('image response: ', response.data);

          if (response.data?.length) {
            let i = 0;
            for (const image of response.data) {
              i++;

              const imageUrl = image?.url;
              if (imageUrl) {
                await Promise.all([
                  this.images.insertOne({ ...msg, url: imageUrl }),
                  this.bot.sendPhoto(chatId, imageUrl, { caption: `Here is your generated image #${i}` }),
                  this.bot.sendMessage(
                    chatId,
                    `<a href="${imageUrl}">You can view the full-sized image #${i} here</a>`,
                    {
                      parse_mode: 'HTML',
                    },
                    this.mainKeyboard,
                  ),
                ]);
              }
            }

            // await this.bot.sendPhoto(chatId, imageUrl, { caption: 'Here is your generated image' });
            // // await this.bot.sendMessage(chatId, `You can view the full-sized image here: ${imageUrl}`, this.mainKeyboard);
            // await this.bot.sendMessage(chatId, `<a href="${imageUrl}">You can view the full-sized image here</a>`, {
            //   parse_mode: 'HTML',
            // });
          } else {
            this.bot.sendMessage(chatId, `Empty response received.`);
          }

          return;
        }

        Logger.log(`Request: ${msg?.text}, model: ${model}`, 'BotService');

        // const response = await this.openai.completions.create({
        //   model,
        //   prompt: msg.text,
        //   max_tokens: 1024,
        //   temperature: 0,
        // });
        const response = await this.openai.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: 'You are a helpful assistant' },
            { role: 'user', content: msg.text },
          ],
          // prompt: msg.text,
          max_tokens: 1024,
        });

        await this.messages.insertOne({ ...msg, answer: response });
        console.log(response);

        const aiReply = response?.choices?.[0]?.message?.content?.trim() || 'No answer';
        const updatedChatHistory = chatHistory + '\nUser: ' + msg.text + '\nAI: ' + aiReply;

        await this.session.updateOne({ _id: chatId }, { $set: { chatHistory: updatedChatHistory } }, { upsert: true });

        this.bot.sendMessage(chatId, aiReply);
      } catch (err) {
        const error = err.response?.data?.error?.message || err.response?.data?.error?.code || err.message;

        await this.log.insertOne({ ...msg, error });

        console.error('ERROR:', error);

        this.bot.sendMessage(chatId, `Sorry, something went wrong: ${error}. Try again later.`);
      }
    });
  }
}
