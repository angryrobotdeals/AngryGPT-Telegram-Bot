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

      const message = `Hello!
This is the free ChatGPT bot by Pavel Valentov from Angry Robot Deals.

For using AI you need to set the model first
Model GPT-3.5 is fast, but GPT-4 is slow and more powerful.
And you may subscribe to my @angryrobotdeals news channel.

Here are the commands you can use:
/setmodel - Set the AI model (either gpt-3.5-turbo or GPT-4)
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
              { text: 'GPT-3.5', callback_data: 'gpt-3.5-turbo' },
              { text: 'GPT-4-32k', callback_data: 'gpt-4-32k' },
              { text: 'GPT-4', callback_data: 'gpt-4' },
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
        this.mainKeyboard
      );
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
      const mode = session?.mode || 'text'; // default to 'text'
      const model = session?.model || 'gpt-3.5-turbo'; // default to gpt-3.5-turbo
      const chatHistory = (session?.chatHistory || '').slice(-1024);

      try {
        // console.log(msg);
        if (mode === 'image') {
          const response = await this.openai.createImage({
            prompt: msg.text,
            n: 2,
            size: '1024x1024',
          });

          // console.log('image response: ', response.data);

          if (response.data.data?.length) {
            let i = 0;
            for (const image of response.data.data) {
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
                    this.mainKeyboard
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

        console.log('Answer: ', model, chatHistory + '\n' + msg.text);
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
      } catch (err) {
        const error = err.response?.data?.error?.message || err.response?.data?.error?.code || err.message;

        await this.log.insertOne({ ...msg, error });

        console.error('ERROR:', error);

        this.bot.sendMessage(chatId, `Sorry, something went wrong: ${error}. Try again later.`);
      }
    });
  }
}
