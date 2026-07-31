# API 契约：Echo of Photons

## 文档目的

本文件用于定义 Echo of Photons 第一阶段的 API 契约。
它服务于前端实现、内聚式后端实现、数据访问层实现，以及后续代码审查。

第一阶段 API 采用克制策略：
- 只支撑 MVP 主闭环
- 保持统一返回结构
- 不提前引入重用户系统、重后台系统、重推荐引擎
- 明确区分“正式契约”和“预契约”两类接口成熟度

---

## 统一返回结构

### 成功

```json
{
  "code": 0,
  "data": {},
  "message": "ok"
}
```

### 失败

```json
{
  "code": 4001,
  "data": null,
  "message": "invalid query params"
}
```

### 错误码

| 错误码 | 含义 |
|---|---|
| `0` | 成功 |
| `4001` | 请求参数不合法 |
| `4041` | 对象不存在 |
| `5001` | 服务端内部错误 |

---

## 契约分层

### 正式契约

以下接口已经足够稳定，可以直接进入第一阶段实现：

- `GET /api/recommendations`
- `GET /api/objects/[slug]`
- `GET /api/tools/observation-summary`

### 预契约

以下接口的职责已经锁定，但部分具体输入字段仍依赖第一轮星图 PoC 结果：

- `GET /api/sky-map/resolve`

---

## 1. 获取首页推荐

### 契约级别

**正式契约**

### 接口

`GET /api/recommendations`

### 作用

返回首页第一屏的结构化推荐结果，用于回答“今天先看什么”。

它在第一阶段不是一个通用推荐列表接口，而是直接服务于我们已经锁定的首页结构：
- 主推荐
- 条件层
- 辅推荐

### 第一阶段规则

- 支持位置上下文，但不能依赖定位权限才能工作。
- 缺少定位信息时，系统仍需返回基于时间的通用推荐。
- 位置数据在第一阶段只作为轻量增强因素。
- 首页第一屏的结构由后端直接组织。
- 前端不负责自己决定谁是主推荐、谁是辅推荐。

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `lat` | number | 否 | 用户纬度 |
| `lng` | number | 否 | 用户经度 |

### 筛选优先级

1. 先按当前时间有效性筛选。
2. 如果传入 `lat/lng`，基于真实位置和天气数据生成观测判断。
4. 如果缺少场景或位置上下文，回退到通用推荐。
5. 返回首页第一屏结构化结果，而不是平铺数组。

### 成功返回结构

#### `primaryRecommendation`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | number | 推荐 id |
| `title` | string | 主推荐标题 |
| `reason` | string | 主推荐理由 |
| `recommendationType` | string | 类型，如 `object`、`direction`、`location`、`time_window` |
| `targetRef` | string \| null | 推荐目标引用 |
| `primaryAction.label` | string | 主动作文案，第一阶段固定为星图入口文案 |
| `primaryAction.type` | string | 主动作类型，第一阶段固定为 `open_sky_map` |
| `secondaryAction.label` | string | 次动作文案 |
| `secondaryAction.type` | string | 次动作类型，第一阶段固定为 `open_object_detail` |
| `secondaryAction.targetRef` | string \| null | 次动作目标引用 |

#### `conditionSummary`

| 字段 | 类型 | 说明 |
|---|---|---|
| `basis` | string | 客观条件描述 |
| `actionHint` | string | 行动层建议 |

#### `secondaryRecommendation`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | number | 推荐 id |
| `text` | string | 一行式同主题补充入口 |
| `recommendationType` | string | 类型，如 `object`、`direction`、`location`、`time_window` |
| `targetRef` | string \| null | 推荐目标引用 |

#### 共享可见性字段

当请求包含有效 `lat/lng` 时，响应同时返回：

| 字段 | 类型 | 说明 |
|---|---|---|
| `visibleSky.observationTime` | ISO datetime | 本次“今晚可见”计算参考时间 |
| `visibleSky.limitingMagnitude` | number | 综合夜光、天气和月光估算的肉眼极限星等 |
| `visibleSky.objects` | array | 完整实际可见目录，按推荐价值排序 |
| `visibleSky.recommended` | array | `objects` 的前四项，必须与首页四项一致 |
| `lightPollution.darknessScore` | number | NASA 夜间灯光邻域推导的相对暗夜分数，0-100 |
| `lightPollution.available` | boolean | 本次是否成功读取卫星夜光数据 |

### 成功示例

```json
{
  "code": 0,
  "data": {
    "primaryRecommendation": {
      "id": 101,
      "title": "今晚先看木星",
      "reason": "当前亮度高，位置明显，适合新手先认。",
      "recommendationType": "object",
      "targetRef": "jupiter",
      "primaryAction": {
        "label": "去星图找它",
        "type": "open_sky_map"
      },
      "secondaryAction": {
        "label": "先了解一下",
        "type": "open_object_detail",
        "targetRef": "jupiter"
      }
    },
    "conditionSummary": {
      "basis": "天空较晴，月光影响中等",
      "actionHint": "今晚适合先从明亮目标开始认星"
    },
    "secondaryRecommendation": {
      "id": 102,
      "text": "也可以先看：织女星，更容易先抓住一个点",
      "recommendationType": "object",
      "targetRef": "vega"
    }
  },
  "message": "ok"
}
```

### 通用回退示例

```json
{
  "code": 0,
  "data": {
    "primaryRecommendation": {
      "id": 201,
      "title": "今晚先从最亮的目标开始",
      "reason": "即使没有定位信息，也适合先认最容易观察到的明亮目标。",
      "recommendationType": "direction",
      "targetRef": "brightest-visible-target",
      "primaryAction": {
        "label": "去星图找它",
        "type": "open_sky_map"
      },
      "secondaryAction": {
        "label": "先了解一下",
        "type": "open_object_detail",
        "targetRef": null
      }
    },
    "conditionSummary": {
      "basis": "未获取定位信息，先按通用夜空条件推荐",
      "actionHint": "先从最明显的亮目标开始建立参照"
    },
    "secondaryRecommendation": {
      "id": 202,
      "text": "也可以先看：今晚最容易辨认的亮星",
      "recommendationType": "object",
      "targetRef": "bright-star-entry"
    }
  },
  "message": "ok"
}
```

### 失败场景

- 参数类型不合法 -> `4001`
- 推荐选择内部失败 -> `5001`

---

## 2. 承接星图对象映射

### 契约级别

**预契约**

### 接口

`GET /api/sky-map/resolve`

### 作用

把嵌入式星图能力返回的对象信息，映射到我们自己的本地对象系统中。

它是“选定的星图能力”和“我们自己的详情页流程”之间的桥梁。

### 第一阶段规则

- 这个接口的职责已经锁定，但最终输入字段形态还没有彻底锁死。
- 第一阶段当前优先假设 `name` 是首要映射输入。
- 如果选定的星图能力返回 `type`，也应接入。
- 未匹配结果属于业务结果，不属于系统报错。
- 最终请求字段集合要在第一轮星图 PoC 后确认。

### 已锁定职责

- 接收星图对象点击结果
- 尝试映射到本地 `celestial_objects`
- 返回 matched / unmatched 状态
- 匹配成功时返回本地对象摘要

### 当前最小输入假设

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `name` | string | 是，当前假设 | 星图能力返回的对象名称 |
| `type` | string | 否 | 星图能力若提供对象类型，则一起接收 |

### 目前尚未锁定的字段

以下字段当前有意不写入主契约：
- `ra`
- `dec`
- `catalogId`
- `magnitude`
- `aliases`
- 第三方原始 payload 的其他片段

这些字段只有在第一轮候选能力验证出它们稳定且有价值时，才进入最终正式契约。

### 当前成功返回字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `matched` | boolean | 是否成功匹配 |
| `object.slug` | string | 本地对象 slug |
| `object.nameZh` | string | 中文名称 |
| `object.nameEn` | string | 英文名称 |
| `object.objectType` | string | 本地对象类型 |
| `detailUrl` | string \| null | 匹配成功时的本地详情页地址 |

### 成功示例：匹配成功

```json
{
  "code": 0,
  "data": {
    "matched": true,
    "object": {
      "slug": "jupiter",
      "nameZh": "木星",
      "nameEn": "Jupiter",
      "objectType": "planet"
    },
    "detailUrl": "/objects/jupiter"
  },
  "message": "ok"
}
```

### 成功示例：未匹配

```json
{
  "code": 0,
  "data": {
    "matched": false,
    "object": null,
    "detailUrl": null
  },
  "message": "ok"
}
```

### 失败场景

- 缺少当前最小必需字段 -> `4001`
- 内部映射失败 -> `5001`

### PoC 后确认清单

在这个接口从“预契约”升级成“正式契约”之前，第一轮星图 PoC 必须确认：

1. `name` 是否一定可拿到
2. `type` 是否足够稳定，值得纳入正式输入
3. 是否存在值得接入的额外第三方标识
4. 名称直连是否足够，还是需要极少量兜底映射层

---

## 3. 获取对象详情

### 契约级别

**正式契约**

### 接口

`GET /api/objects/[slug]`

### 作用

返回单个对象详情页所需的完整数据。

### 第一阶段规则

- 这是一个聚合接口。
- 一次返回对象摘要和解释卡片内容。
- 第一阶段前端不应自己分开请求对象信息和卡片信息。

### 路径参数

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `slug` | string | 是 | 本地唯一对象标识 |

### 成功返回字段

#### `object`

| 字段 | 类型 | 说明 |
|---|---|---|
| `slug` | string | 对象 slug |
| `nameZh` | string | 中文名 |
| `nameEn` | string | 英文名 |
| `objectType` | string | 对象类型 |

#### `stellarProfile`（`bright_star`、`star`、`planet`）

恒星、太阳系行星和月球对象会额外返回以下字段；其他对象为 `null` 或不返回：

| 字段 | 类型 | 说明 |
|---|---|---|
| `magnitude` | number | 视星等，数值越小越亮 |
| `brightnessLabel` | string | 亮度等级，如“极亮恒星（负星等）”“一等亮星”“二等星” |
| `brightnessDefinition` | string | 当前等级的视星等区间定义 |
| `brightnessGuide` | string | 面向普通用户的实际观感解释 |
| `nakedEyeVisibility` | string | 在一般观测条件下的肉眼可见性说明 |
| `visualColorLabel` | string | 常见肉眼颜色，如“蓝白色”“橙红色” |
| `visualColorHex` | string | 用于详情页色点展示的近似颜色 |
| `visualColorDescription` | string | 颜色来源和肉眼观感说明 |

#### `card`

| 字段 | 类型 | 说明 |
|---|---|---|
| `whatIsIt` | string | 它是什么 |
| `whyWatchIt` | string | 为什么值得看 |
| `whatNext` | string | 下一步看什么 |

### 成功示例

```json
{
  "code": 0,
  "data": {
    "object": {
      "slug": "jupiter",
      "nameZh": "木星",
      "nameEn": "Jupiter",
      "objectType": "planet"
    },
    "card": {
      "whatIsIt": "木星是太阳系中体积最大的行星。",
      "whyWatchIt": "它通常足够明亮，很适合新手辨认。",
      "whatNext": "认出木星后，可以继续观察附近更容易形成参照的亮星。"
    }
  },
  "message": "ok"
}
```

### 失败场景

- 对象不存在 -> `4041`
- 内部查询失败 -> `5001`

---

## 4. 获取观测摘要

### 契约级别

**正式契约**

### 接口

`GET /api/tools/observation-summary`

### 作用

返回工具页所需的轻量观测摘要。

### 第一阶段规则

- 服务工具页的轻辅助定位。
- 不发展成重天气评分系统或专业观测参数中心。
- 只返回一小组辅助型字段。

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `lat` | number | 否 | 用户纬度 |
| `lng` | number | 否 | 用户经度 |
| `sceneType` | string | 否 | 观测场景 |

### 成功返回字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `summary` | string | 整体观测摘要 |
| `sceneSuggestion` | string | 场景建议 |
| `weatherHint` | string | 轻量天气提示 |

### 成功示例

```json
{
  "code": 0,
  "data": {
    "summary": "今晚云量较低，适合先从明亮目标开始观察。",
    "sceneSuggestion": "如果在阳台，优先寻找亮星和行星。",
    "weatherHint": "第一版先提供轻量天气提示，不提供复杂评分。"
  },
  "message": "ok"
}
```

### 失败场景

- 参数类型不合法 -> `4001`
- 内部摘要生成失败 -> `5001`

---

## 4.1 获取近期天象

### 契约级别

**MVP 正式契约**

### 接口

`GET /api/tools/upcoming-events`

### 作用

返回未来一年内可计划的流星雨事件，供工具页和天象日历共同使用。

### 请求参数

无。

### 成功返回字段

`data.events` 为数组，字段如下：

| 字段 | 类型 | 说明 |
|---|---|---|
| `slug` | string | 事件唯一标识 |
| `nameZh` / `nameEn` | string | 中文名 / 英文名 |
| `peakDate` | string | 峰值日期，`YYYY-MM-DD` |
| `activeStart` / `activeEnd` | string | 活跃期，`MM-DD` |
| `zhr` | number | 理论峰值小时天顶流星数 |
| `recommendedTime` | string | 推荐观测时段 |
| `locationHint` | string | 理想观测地类型 |
| `summary` | string | 事件摘要 |

### 成功示例

```json
{
  "code": 0,
  "data": {
    "events": [
      {
        "slug": "perseids",
        "nameZh": "英仙座流星雨",
        "nameEn": "Perseids",
        "peakDate": "2026-08-13",
        "activeStart": "07-17",
        "activeEnd": "08-24",
        "zhr": 100,
        "recommendedTime": "午夜后至凌晨",
        "locationHint": "远离城市灯光的开阔地",
        "summary": "英仙座流星雨活跃期内均有机会观测"
      }
    ]
  },
  "message": "ok"
}
```

### 数据降级

数据库查询失败时使用本地流星雨目录，接口仍保持 `code: 0`，避免工具页因内容数据库短暂故障而中断。

---

## 第一阶段契约说明

当前 API 契约有意保留了项目真实成熟度分层：
- 首页推荐、详情聚合、工具摘要已经可以直接实现
- 星图对象映射的职责已经清楚，但具体输入形态仍依赖 PoC 后确认

后续实现与代码审查都应保留这个分层意识。
不要把预契约接口当成一个字段形态已经被完全验证过的正式接口。

---

## 5. 观测记录

### 契约级别

**MVP 正式契约**

游客记录通过 `echo_observer_id` 匿名 Cookie 归属当前浏览器。注册或登录后，服务端把该浏览器尚未归属账号的记录绑定到当前用户；登录用户通过 `echo_session` 会话跨设备读取记录。

### 获取记录

`GET /api/observations`

返回当前账号或匿名浏览器最近 100 条观测记录，并在 `account` 字段返回当前用户；游客为 `null`。

### 新增记录

`POST /api/observations`

请求字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `targetName` | string | 是 | 观测目标名称，最多 255 字符 |
| `targetSlug` | string/null | 否 | 已知对象 slug |
| `objectType` | string | 否 | `planet`、`bright_star` 等 |
| `observedAt` | ISO date string | 是 | 观测时间 |
| `latitude` | number/null | 否 | -90 到 90 |
| `longitude` | number/null | 否 | -180 到 180 |
| `locationName` | string/null | 否 | 地点名称 |
| `equipment` | string/null | 否 | 设备 |
| `notes` | string/null | 否 | 最多 4000 字符 |
| `confirmed` | boolean | 否 | 仅确认观测流程传 `true`；写入 `confirmed_at` 并参与成就计算 |

成功响应中的 `newlyUnlocked` 返回本次新解锁的系列数组；游客或未完成系列时为空数组。

### 删除记录

`DELETE /api/observations/:id`

登录用户只允许删除当前 `user_id` 所属记录；游客只允许删除当前 `observer_id` 且尚未绑定用户的记录。不存在或不属于当前身份时统一返回 `4041`。

### 错误场景

- 请求字段不合法 -> `4001`
- 记录不存在或不属于当前浏览器 -> `4041`
- 数据库不可用 -> `5001`

---

## 6. ISS 过境预测

### 契约级别

**MVP 正式契约**

### 接口

`GET /api/tools/satellite-passes`

### 作用

根据用户当前位置、CelesTrak 最新 ISS 轨道根数和 Open-Meteo 云量，返回未来 24 小时 ISS 过境及可见性判断。预测为站内提醒，不承诺网页关闭后的系统推送。

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `lat` | number | 是 | 用户纬度，范围 -90 到 90 |
| `lng` | number | 是 | 用户经度，范围 -180 到 180 |

### 成功返回字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `satellite` | object | 卫星名称和 NORAD 编号 |
| `generatedAt` | ISO date string | 本次预测生成时间 |
| `tleEpoch` | ISO date string | 使用的轨道根数历元 |
| `window` | object | 预测起止时间和小时数 |
| `passes` | array | 仰角达到 10° 以上的过境列表 |

每个 `pass` 包含：

| 字段 | 类型 | 说明 |
|---|---|---|
| `start` | object | 出现时间、方位角、中文方向 |
| `peak` | object | 最高点时间、方位、仰角、距离 |
| `end` | object | 离开时间、方位角、中文方向 |
| `durationMinutes` | number | 10° 仰角以上持续分钟数 |
| `illuminatedDuringPass` | boolean | 过境期间 ISS 是否受到阳光照射 |
| `observerSunAltitude` | number | 可见性评估时观察地太阳高度 |
| `cloudCover` | number/null | 最接近该时段的预测云量 |
| `visibility` | object | `easy`、`possible`、`difficult` 及具体原因 |

### 成功示例

```json
{
  "code": 0,
  "data": {
    "satellite": { "name": "ISS (ZARYA)", "noradId": 25544 },
    "generatedAt": "2026-07-22T10:00:00.000Z",
    "tleEpoch": "2026-07-22T03:40:37.501Z",
    "window": {
      "start": "2026-07-22T10:00:00.000Z",
      "end": "2026-07-23T10:00:00.000Z",
      "hours": 24
    },
    "passes": [
      {
        "id": "2026-07-22T12:18:20.000Z",
        "start": { "time": "2026-07-22T12:18:20.000Z", "azimuth": 226.4, "direction": "西南" },
        "peak": { "time": "2026-07-22T12:22:00.000Z", "azimuth": 181.2, "direction": "南", "elevation": 48.6, "rangeKm": 568 },
        "end": { "time": "2026-07-22T12:25:40.000Z", "azimuth": 132.8, "direction": "东南" },
        "durationMinutes": 7,
        "illuminatedDuringPass": true,
        "observerSunAltitude": -12.4,
        "cloudCover": 24,
        "visibility": {
          "level": "easy",
          "label": "容易看见",
          "reason": "ISS 受阳光照亮，最高可观测仰角 49°，预计云量 24%。"
        }
      }
    ]
  },
  "message": "ok"
}
```

### 失败场景

- 缺少坐标或坐标越界 -> HTTP `400` / `4001`
- CelesTrak 首次请求失败且无缓存 -> HTTP `500` / `5001`

---

## 7. 邮箱账号认证

### 契约级别

**MVP 正式契约**

### 注册

`POST /api/auth/register`

请求：

```json
{ "email": "observer@example.com", "password": "至少8个字符" }
```

成功返回用户与本次认领记录数，并设置 30 天有效的 `HttpOnly; SameSite=Lax` Session Cookie：

```json
{
  "code": 0,
  "data": {
    "user": {
      "id": 1,
      "email": "observer@example.com",
      "emailVerified": false,
      "createdAt": "2026-07-22T12:00:00.000Z"
    },
    "claimedRecords": 2
  },
  "message": "account created"
}
```

失败：邮箱或密码格式错误 -> `4001`；邮箱已注册 -> `4091`；数据库错误 -> `5001`。

### 登录

`POST /api/auth/login`

请求字段与注册相同。成功返回 `user` 与 `claimedRecords` 并轮换新会话；邮箱或密码错误统一返回 HTTP `401` / `4011`，不说明具体是哪一项错误。15 分钟内同一来源和邮箱连续失败 5 次后返回 HTTP `429` / `4291`。

### 当前用户

`GET /api/auth/me`

已登录返回用户对象，游客或会话过期返回 `{ "user": null }`。响应禁止缓存。

### 退出

`POST /api/auth/logout`

删除当前数据库会话并清空 Session Cookie。即使数据库暂时不可用，仍清空浏览器 Cookie。

### 安全约束

- 密码使用 Argon2id 哈希，内存成本 19 MiB、2 次迭代
- Session Token 使用 32 字节密码学随机数，数据库仅保存 SHA-256 摘要
- Session Cookie 不可被前端 JavaScript 读取，生产 HTTPS 环境启用 `Secure`
- 当前版本不包含邮箱验证和密码找回，`email_verified_at` 仅预留结构

---

## 8. 系列观测成就

### 获取成就中心

`GET /api/achievements`

按当前登录账号或匿名浏览器返回：

- `confirmedCount`：确认观测总次数
- `uniqueTargetCount`：确认过的不同目标数
- `completedSeriesCount` / `totalSeriesCount`：徽章完成概览
- `account`：登录邮箱；游客为 `null`
- `series`：系列名称、说明、徽章键、进度、解锁时间和成员状态

成员状态包含 `slug`、名称、是否确认、最近确认时间和观测次数。同一目标重复确认只增加观测次数，不重复增加系列进度；同一目标可以同时推进多个系列。

### 解锁规则

- 只有 `confirmed_at IS NOT NULL` 的记录参与计算
- 系列全部成员均确认后完成
- 登录用户写入 `user_achievement_unlocks`，删除原观测记录后徽章仍保留
- 匿名用户按当前浏览器记录实时计算，登录或注册认领记录时补发永久解锁
- 数据库不可用或未执行最新迁移 -> HTTP `500` / `5001`

---

## 9. 附近暗夜评估与今晚可见星表

### 接口

`GET /api/tools/site-conditions`

### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `lat` | number | 是 | 评估点纬度，-90 到 90 |
| `lng` | number | 是 | 评估点经度，-180 到 180 |

### 成功返回字段

- `days`：今天/今晚与明天的看星、晚霞、早霞天气评分
- `lightPollution`：NASA VIIRS 夜间灯光的可用状态、暗夜分数、标签、摘要和来源年份
- `visibleSky`：参考时间、极限星等、月光信息、完整可见目标和首页前四项
- `visibleSky.objects[]`：`slug`、名称、对象类型、方向、方位角、仰角、视星等和可见难度

`visibleSky.recommended` 必须严格等于 `visibleSky.objects.slice(0, 4)`；同一经纬度下，`GET /api/recommendations` 必须使用这四项组织首页推荐。

### 失败场景

- 经纬度缺失或越界 -> HTTP `400` / `4001`
- 天气数据无法获取 -> HTTP `500` / `5001`
- NASA 夜光图层暂时不可用 -> 接口仍成功，`lightPollution.available = false`，按中等夜光保守估算
