FROM node:25-trixie-slim as builder

WORKDIR /root/workdir

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --include=dev

COPY src ./src

RUN npm run build

FROM node:25-trixie-slim

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /root/workdir

RUN mkdir /usr/local/share/keyrings/
RUN apt-get update \
    && apt-get install -y wget \
    && wget -q -O /usr/local/share/keyrings/google-chrome.asc https://dl-ssl.google.com/linux/linux_signing_key.pub \
    && sh -c 'echo "deb [arch=amd64 signed-by=/usr/local/share/keyrings/google-chrome.asc] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'
RUN apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-freefont-ttf fonts-noto-cjk fonts-noto-cjk-extra libxss1  \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --omit=dev

COPY resources ./resources
COPY --from=builder /root/workdir/dist ./dist

ENTRYPOINT ["npx", "regulations-generator"]
CMD ["--help"]
