FROM node:25-trixie-slim AS builder

ENV PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR /root/workdir

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --include=dev

COPY src ./src

RUN npm run build

FROM node:25-trixie-slim

WORKDIR /root/workdir

RUN mkdir /usr/local/share/keyrings/
RUN apt-get update \
    && apt-get install -y ca-certificates wget \
    && wget -q -O /usr/local/share/keyrings/google-chrome.asc https://dl-ssl.google.com/linux/linux_signing_key.pub \
    && sh -c 'echo "deb [arch=amd64 signed-by=/usr/local/share/keyrings/google-chrome.asc] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list'
RUN apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-freefont-ttf fonts-noto-cjk fonts-noto-cjk-extra libxss1 default-jre-headless unzip  \
      --no-install-recommends \
    && wget -q -O /tmp/jing.zip https://storage.googleapis.com/google-code-archive-downloads/v2/code.google.com/jing-trang/jing-20091111.zip \
    && unzip -q /tmp/jing.zip -d /tmp \
    && cp /tmp/jing-20091111/bin/jing.jar ./jing.jar \
    && rm -rf /tmp/jing.zip /tmp/jing-20091111 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json tsconfig.json ./

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

RUN npm ci --omit=dev

COPY resources ./resources
COPY schema ./schema
COPY --from=builder /root/workdir/dist ./dist

RUN npm link

ARG BUILD_GITHUB_REPOSITORY
ARG BUILD_GITHUB_SHA
ARG BUILD_GITHUB_SERVER_URL

ENV BUILD_GITHUB_REPOSITORY=${BUILD_GITHUB_REPOSITORY}
ENV BUILD_GITHUB_SHA=${BUILD_GITHUB_SHA}
ENV BUILD_GITHUB_SERVER_URL=${BUILD_GITHUB_SERVER_URL}

ENTRYPOINT ["regulations-generate"]
CMD ["--help"]
