FROM node:20-alpine as builder

WORKDIR /app

COPY package*.json yarn.lock* ./

RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile; else npm ci; fi

COPY . .

RUN npm run build || yarn build

FROM node:20-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package*.json ./

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
