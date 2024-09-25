FROM node:21-alpine

RUN apk update && apk add --no-cache git; npm i -g npm@latest @nestjs/cli

# Create and set the working directory
RUN mkdir -p /src/app
WORKDIR /src/app

# Copy package.json and package-lock.json
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the rest of the application files
COPY . .

RUN npm run build

# Start the application
CMD ["npm", "run", "start:prod"]
