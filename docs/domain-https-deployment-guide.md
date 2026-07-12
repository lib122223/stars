# Echo of Photons 域名、IIS 反向代理与 HTTPS 部署总结

## 1. 这份文档是解决什么问题的

这份文档总结了把 `Echo of Photons` 从本地开发状态推进到公网可访问状态的完整链路，覆盖：

- 域名解析到服务器
- IIS 接管 `80/443` 入口
- IIS 反向代理到 Next.js `3000` 端口
- 通过阿里云证书把网站切到 HTTPS
- 定位、朝向等浏览器权限为什么依赖 HTTPS
- 常见故障如何分层排查

这是一份基于本项目真实部署过程整理出来的实战文档。

---

## 2. 最终访问架构

### 2.1 访问链路

```text
用户浏览器
  -> DNS 解析 echoofphotons.top
  -> 47.96.255.101
  -> IIS 监听 80/443
  -> URL Rewrite + ARR
  -> http://127.0.0.1:3000
  -> Next.js 应用
```

### 2.2 为什么要这么做

Next.js 应用本身跑在 `3000`，但公网用户通常通过标准 Web 端口访问：

- HTTP：`80`
- HTTPS：`443`

所以需要 IIS 作为前置入口，负责：

- 监听标准端口
- 绑定域名
- 挂载 SSL 证书
- 把请求转发给 Next.js

---

## 3. 这次涉及到的关键组件

### 3.1 域名

本次使用域名：

- `echoofphotons.top`
- `www.echoofphotons.top`

作用：

- 不再直接让用户访问 IP
- 给 HTTPS 提供可绑定的站点身份
- 为定位、朝向等安全上下文能力提供基础条件

### 3.2 DNS

DNS 负责把域名解析到公网 IP。

本次解析关系：

```text
echoofphotons.top -> 47.96.255.101
www.echoofphotons.top -> 47.96.255.101
```

### 3.3 ECS

ECS 是阿里云服务器，本次同时承担两层职责：

- 运行 Next.js 应用
- 运行 IIS 作为前置 Web 服务

### 3.4 Next.js

应用本体默认运行在：

```text
http://127.0.0.1:3000
```

它负责：

- 页面渲染
- API 路由
- 数据读取
- 星图与业务逻辑

它不直接负责：

- 域名绑定
- HTTPS 证书
- 80/443 标准端口接入

### 3.5 IIS

IIS 是 Windows Server 自带 Web 服务。

本次负责：

- 监听 `80/443`
- 接收 `echoofphotons.top` 和 `www.echoofphotons.top` 请求
- 反向代理到 `127.0.0.1:3000`
- 绑定 SSL 证书

### 3.6 ARR

ARR 全称 `Application Request Routing`。

作用：

- 给 IIS 提供代理能力
- 支持把请求优雅转发到 Next.js

### 3.7 URL Rewrite

URL Rewrite 用来定义请求如何被重写和转发。

本次核心规则：

```text
收到 echoofphotons.top 的请求
-> Rewrite 到 http://127.0.0.1:3000/{R:1}
```

注意必须是 `Rewrite`，不是 `Redirect`。

### 3.8 SSL 证书

SSL 证书用于让域名具备 HTTPS 身份。

本次做法：

- 阿里云签发证书
- 下载 `IIS / PFX` 格式
- 导入 IIS 并绑定 `443`

### 3.9 W3SVC

`W3SVC` 是 IIS 的核心发布服务。

如果它不启动：

- IIS 不会真正监听 `80/443`
- 域名访问会失败
- 即使规则和证书都配对了，也进不来

---

## 4. 这些专有名词之间的关系

```text
域名
  -> 依赖 DNS
  -> 指向 ECS 公网 IP

ECS
  -> 跑 IIS
  -> 跑 Next.js

IIS
  -> 监听 80/443
  -> 绑定域名
  -> 加载证书
  -> 通过 ARR + URL Rewrite 转发到 Next.js

Next.js
  -> 跑在 3000
  -> 返回真实页面与 API

HTTPS
  -> 依赖域名 + 证书 + IIS 443 绑定
  -> 影响浏览器是否信任站点
  -> 影响定位、朝向等浏览器权限
```

一句话总结：

**域名负责找到服务器，IIS 负责接住请求，ARR/Rewrite 负责转给 Next，证书负责把 HTTP 升级成 HTTPS。**

---

## 5. 这次部署的正确顺序

### 5.1 先确认应用本身能跑

```powershell
npm install
npm run build
npm start
```

验证：

```powershell
curl.exe http://127.0.0.1:3000
```

如果这里没有返回 HTML，先修应用本身，不要先折腾 IIS。

### 5.2 配置数据库连接

本项目依赖 `DATABASE_URL`。

本次使用的是 Supabase Postgres，注意：

- 连接串不能多空格
- 密码里的特殊字符必须 URL 编码

例如：

- `!` -> `%21`
- `#` -> `%23`

否则会导致 `/api/objects/[slug]`、`/api/sky-map/resolve` 等接口 500。

### 5.3 配置域名 DNS

控制台设置：

- `@ -> 47.96.255.101`
- `www -> 47.96.255.101`

验证：

```powershell
nslookup echoofphotons.top
nslookup www.echoofphotons.top
```

### 5.4 打开公网端口

涉及端口：

- `3000`：Next.js 应用端口
- `80`：HTTP
- `443`：HTTPS

需要同时放行：

1. 应用监听
2. Windows 防火墙
3. 阿里云安全组

### 5.5 安装 IIS 扩展

需要安装：

- URL Rewrite
- ARR

然后在 IIS 中启用：

- `Enable proxy`

### 5.6 配置 IIS 绑定

HTTP：

- `http 80 echoofphotons.top`
- `http 80 www.echoofphotons.top`

HTTPS：

- `https 443 echoofphotons.top`
- `https 443 www.echoofphotons.top`

### 5.7 配置反向代理规则

核心规则：

- 匹配：`(.*)`
- Action：`Rewrite`
- URL：`http://127.0.0.1:3000/{R:1}`

### 5.8 启动 IIS 核心服务

验证：

```powershell
Get-Service W3SVC
```

如果是 `Stopped`，IIS 实际上没工作。

### 5.9 配置 HTTPS

流程：

1. 申请阿里云证书
2. 下载 `IIS / PFX`
3. 导入 IIS
4. 增加 `https 443` 绑定
5. 打开 `443`

---

## 6. 最重要的排障顺序

### 6.1 先查应用层

```powershell
curl.exe http://127.0.0.1:3000
```

- 有 HTML：Next.js 正常
- 没返回：先修应用

### 6.2 再查 IIS 是否监听 80

```powershell
netstat -ano | findstr :80
Get-Service W3SVC
```

如果 `W3SVC` 没启动，先启它。

### 6.3 再查 IIS 是否正确转发给 Next

```powershell
curl.exe -I -H "Host: echoofphotons.top" http://127.0.0.1
```

如果返回：

```text
HTTP/1.1 200 OK
X-Powered-By: Next.js
X-Powered-By: ARR/3.0
```

说明 IIS -> ARR -> Next 链路已经通。

### 6.4 再查公网入口是否放行

```powershell
curl.exe -I http://echoofphotons.top
```

如果服务器内一切正常但外网超时，重点查：

- Windows 防火墙
- 阿里云安全组

### 6.5 再查 DNS 是否生效

```powershell
nslookup echoofphotons.top
```

### 6.6 最后查 HTTPS 与浏览器权限

浏览器能打开站点，不等于定位和朝向权限一定可用。

这些能力强依赖 HTTPS：

- `navigator.geolocation`
- `DeviceOrientationEvent`
- iPhone 上的方向权限申请

所以：

- `localhost` 能定位，不代表公网 HTTP 也能
- 正式测试应在 `https://echoofphotons.top` 下进行

---

## 7. 这次踩过的典型坑

### 7.1 不是代码坏了，而是数据库连接串坏了

症状：

- `/api/objects/[slug]` 500
- `/api/sky-map/resolve` 500
- 页面显示加载失败

原因：

- `DATABASE_URL` 格式错误
- 含空格
- 特殊字符未编码

### 7.2 不是代理坏了，而是 `W3SVC` 没启动

症状：

- `3000` 正常
- 域名不通
- `curl -H Host ... http://127.0.0.1` 也不通

### 7.3 直接访问 `127.0.0.1` 的 404 不一定是错

如果站点绑定的是域名，直接访问 `http://127.0.0.1` 可能因为 Host 不匹配而返回 404。

正确验证方式是：

```powershell
curl.exe -I -H "Host: echoofphotons.top" http://127.0.0.1
```

### 7.4 服务器自带浏览器不适合做最终判断

Windows Server 浏览器常带增强安全策略，会拦资源。

更可靠的是：

- `curl.exe`
- 本机浏览器
- 手机浏览器

### 7.5 HTTP 环境下权限不工作并不意外

公网域名如果还是 HTTP，浏览器很可能不给定位或朝向权限。

---

## 8. 一套稳定的知识框架

### 8.1 网站能访问，是多层一起成立

```text
浏览器 -> DNS -> 公网 IP -> 防火墙/安全组 -> IIS -> ARR/Rewrite -> Next.js -> 数据库
```

任何一层出问题，用户体感都只是“网站打不开”。

### 8.2 本地可用不等于公网可用

`localhost:3000` 能打开，只说明：

- Node 正常
- Next 正常

不代表：

- 域名可用
- HTTPS 正常
- 浏览器权限正常

### 8.3 公网可用也不等于浏览器能力完整

站点能打开，只说明页面能访问。

定位、朝向等权限还依赖 HTTPS。

---

## 9. 对本项目最重要的结论

### 9.1 后续手机能力测试必须优先在 HTTPS 域名下进行

特别是：

- 定位
- 观察模式中的朝向权限
- 真实手机端观测体验

### 9.2 后续常规更新尽量只动应用层

现在已经打通的层：

- DNS
- IIS 反代
- 80/443
- 域名绑定
- 证书

后续版本更新应优先只处理：

- 代码
- `npm run build`
- `npm start`

减少重复折腾域名层。

### 9.3 排障要按层来，不要混着猜

推荐顺序固定为：

1. `curl.exe http://127.0.0.1:3000`
2. `Get-Service W3SVC`
3. `netstat -ano | findstr :80`
4. `curl.exe -I -H "Host: echoofphotons.top" http://127.0.0.1`
5. `nslookup echoofphotons.top`
6. `curl.exe -I http://echoofphotons.top`
7. 最后再看 HTTPS 和浏览器权限

---

## 10. 最简检查清单

### 应用层

- [ ] `npm install` 成功
- [ ] `npm run build` 成功
- [ ] `npm start` 成功
- [ ] `curl.exe http://127.0.0.1:3000` 返回 HTML

### 数据层

- [ ] `DATABASE_URL` 正确
- [ ] 特殊字符已编码
- [ ] 详情页和 resolve 接口不再 500

### 域名层

- [ ] `@` 已解析到 ECS IP
- [ ] `www` 已解析到 ECS IP
- [ ] `nslookup` 返回正确 IP

### IIS 层

- [ ] URL Rewrite 已安装
- [ ] ARR 已安装
- [ ] `Enable proxy` 已开启
- [ ] 站点绑定了正确域名
- [ ] 规则是 `Rewrite` 而不是 `Redirect`
- [ ] `W3SVC` 是 `Running`
- [ ] `80/443` 正在监听

### 网络层

- [ ] Windows 防火墙已放行 `80/443`
- [ ] 阿里云安全组已放行 `80/443`

### HTTPS 层

- [ ] 证书已签发
- [ ] 证书已导入 IIS
- [ ] `443` 已绑定
- [ ] `https://echoofphotons.top` 可访问

### 浏览器能力层

- [ ] 地址栏不再显示不安全
- [ ] 定位权限可申请
- [ ] 朝向权限可测试

---

## 11. 最后一段话

这次你搭起来的不只是一个能打开的域名站点，而是一套完整的部署认知：

- 域名怎么找到服务器
- IIS 怎么接入口
- ARR/Rewrite 怎么转发
- Next.js 怎么作为应用本体运行
- HTTPS 为什么会影响真实手机能力
- 问题该怎么分层排

以后不管你部署的是 Next.js、Node、Python 还是别的 Web 项目，主线都会回到同一个结构：

**域名 -> DNS -> 入口服务器 -> 反向代理 -> 应用 -> 数据库 -> HTTPS -> 浏览器权限**
