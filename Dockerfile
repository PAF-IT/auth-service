FROM node:lts-alpine

COPY . .
RUN npm install -g pnpm@latest
RUN CI=1 pnpm install