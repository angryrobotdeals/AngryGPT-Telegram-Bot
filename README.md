# AngryGPT-Telegram-Bot
### Telegram bot for ChatGPT API by Angry Robot Deals

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
docker build -t telegram-gpt-bot . &&
docker run -d --name telegram-gpt-bot telegram-gpt-bot
```

Remove Docker container:
```bash
docker stop telegram-gpt-bot &&
docker rm telegram-gpt-bot
```
