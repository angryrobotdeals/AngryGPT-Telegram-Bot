# AngryGPT-Telegram-Bot
### Telegram bot for ChatGPT API by Angry Robot Deals


## Start bot
Run into development mode:
```bash
npm run start:dev
```

Run into PROD mode:
```bash
npm run build && npm run start:prod
```


Run into Docker:
```bash
docker build -t telegram-gpt-bot . && \
docker run -d --name telegram-gpt-bot telegram-gpt-bot
```

Remove Docker container:
```bash
docker stop telegram-gpt-bot && \
docker rm telegram-gpt-bot
```

## Bot commands
- /start - start bot
- /help - help message
- /setmodel - Set the AI model (either gpt-3.5-turbo or GPT-4)
- /newchat - Start a new chat session
- /images - Start image generation mode


## Deploy server
- clone repo
- rename .env.example to .env
- set your Telegram bot token in .env file
- set your ChatGPT API key in .env file
- set your MongoDB connection string in .env file
- run `npm install`
- run bot
