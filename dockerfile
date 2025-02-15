FROM node:18-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./

RUN npm ci

RUN npm rebuild bcrypt --build-from-source

COPY . .
RUN npm run build

CMD ["npm", "run", "start"]
