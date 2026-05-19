# DK Theme for XBoard / V2Board

一个基于 React + Vite + TypeScript 的前端主题工程，适用于 XBoard / V2Board 风格面板，可自行修改站点名、后端地址、客服入口与下载链接后重新构建部署。

## 快速开始

```bash
npm install
cp .env.example .env
npm run dev
```

启动后按需修改 `.env` 配置即可。

## 构建

```bash
npm install
cp .env.example .env
npm run build
```

构建产物输出到：
- `dist/`

如需导出独立静态发布目录：

```bash
npm run export:release
```

## 常用配置

主要配置文件：
- `.env`
- `.env.example`
- `src/lib/config.ts`


## 改成你自己的站点

修改站点名：

```env
VITE_APP_NAME=你的站点名
```

改成你自己的后端：

```env
VITE_API_BASE_URL=https://your-domain.com
VITE_ENABLE_MOCK=false
```

修改 `.env` 后，请重启开发服务器或重新构建。

## 部署

### Nginx

```
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```
### Caddy
```
your-domain.com {
    root * /var/www/dist
    encode zstd gzip
    try_files {path} /index.html
    file_server

    reverse_proxy /api/* https://backend.example.com {
        header_up Host {upstream_hostport}
    }
}
```
## 如何确认配置已生效

1. 检查页面标题和侧边栏品牌名是否变化
2. 打开浏览器 Network，确认请求是否发往你自己的 `VITE_API_BASE_URL`
3. 如果仍显示演示数据，请确认 `VITE_ENABLE_MOCK=false`
4. 运行 `npm run build`，确认成功产出 `dist/`

## Demo

<img src="https://pub-56954302827c4850ac0f10fdb853206b.r2.dev/landscape/webp/20260418-2f94ebb2.webp" width="400" />

<img src="https://pub-56954302827c4850ac0f10fdb853206b.r2.dev/landscape/webp/20260418-7aaf7182.webp" width="400" />

<img src="https://pub-56954302827c4850ac0f10fdb853206b.r2.dev/landscape/webp/20260418-7cdc6df1.webp" width="400" />

<img src="https://pub-56954302827c4850ac0f10fdb853206b.r2.dev/landscape/webp/20260418-7debfa7e.webp" width="400" />

---

鸣谢：https://github.com/Nice-Derrick/DK_Theme
