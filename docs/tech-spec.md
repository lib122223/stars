# 技术规格：Echo of Photons

## 文档目的

本文档用于明确 Echo of Photons 当前阶段的技术主线、系统结构、关键数据模型、API 边界与后续演进方向。

---

## 1. 技术路线总览【A】

### 1.1 当前技术主线

项目当前采用以下唯一技术主线：

- 前端框架：Next.js App Router + React + TypeScript
- 后端形态：Next.js 内聚式 API Route
- 数据库：PostgreSQL
- 数据访问：`pg` 连接池
- 天文计算：本地计算 + 本地对象数据层 + 现有星图画布层

### 1.2 为什么继续沿用这条线

这条路线适合当前项目，原因是：

1. 现有代码已经稳定落在 Next.js 全栈模式中
2. 首页、星图、详情、工具页与接口层耦合度高，拆独立后端收益不高
3. 当前产品更依赖迭代速度和交互闭环，而不是高并发复杂服务治理
4. PostgreSQL 已经接好，足以支撑内容、事件、区域比较和后续用户计划能力

### 1.3 为什么当前不切 Python

当前不建议切到 Python，原因不是 Python 不行，而是：

- 当前现有接口全部是 Next.js `app/api/*/route.ts`
- 前后端都已采用 TypeScript，切换会带来额外维护成本
- 当前主要任务是把产品主链路做对，不是重建技术栈
- 下一阶段需要长出来的是数据能力，而不是语言替换

### 1.4 当前后端定位

当前后端属于：`内容型 + 计算型轻后端`

已承担的职责：

- 首页推荐结果输出
- 星图对象映射与解析
- 详情页聚合
- 工具页观测摘要
- 健康检查

还未承担的职责：

- 天象事件中心
- 区域观测比较缓存
- 观测参考图内容层
- 用户收藏、计划与记录体系

---

## 2. 架构概览【A】

### 2.1 系统分层

```text
[Client UI]
  |- 首页
  |- 2D 星图模式
  |- 观察模式
  |- 详情页
  |- 工具页
  |- 未来天象日历页

        |
        v

[Application Layer]
  |- 推荐逻辑
  |- 目标承接逻辑
  |- 时间上下文
  |- 区域比较逻辑
  |- 事件展示逻辑
  |- 观测参考图承接逻辑

        |
        v

[Next.js API Layer]
  |- GET /api/recommendations
  |- GET /api/sky-map/resolve
  |- GET /api/objects/[slug]
  |- GET /api/tools/observation-summary
  |- GET /api/health
  |- 后续事件/区域/媒体接口

        |
        v

[Data Layer]
  |- PostgreSQL
  |- 本地天文对象数据层
  |- 本地计算能力
  |- 未来事件与区域比较缓存
```

### 2.2 页面职责与技术含义

- 首页：行动入口与轻结论页
- 2D 星图模式：参考星图视图
- 观察模式：基于实时朝向和时间上下文的天空视窗
- 详情页：对象理解与参考内容承接页
- 工具页：观测条件判断与计划入口页
- 未来天象日历页：长期事件浏览页

---

## 3. 项目结构【C】

### 3.1 当前关键目录

```text
app/
  api/
  objects/
  sky-map/
  tools/
features/
  home/
  objects/
  sky-map/
  tools/
data-access/
  db.ts
  schema.sql
  seed.sql
lib/
  api-response.ts
  env.ts
  time-context.ts
  astronomy/
docs/
```

### 3.2 当前关键文件角色

- `app/api/*/route.ts`：服务端接口入口
- `data-access/db.ts`：PostgreSQL 连接池
- `lib/api-response.ts`：统一接口响应结构
- `lib/astronomy/*`：天文对象与事件数据层的自然落点
- `features/sky-map/star-canvas.tsx`：当前星图主舞台
- `features/sky-map/search-data.ts`：当前搜索对象池

---

## 4. 数据库设计【A】

### 4.1 当前数据库角色

当前数据库主要承接：

- 天体对象数据
- 详情卡片数据
- 推荐承接所需的稳定对象数据

下一阶段数据库重点应扩到三层：

1. 天象事件层
2. 区域观测条件层
3. 观测参考内容层

### 4.2 当前表设计方向

当前至少包含两类核心对象：

#### `celestial_objects`

用于表示产品承接的对象实体。

建议字段：

- `id`
- `slug`
- `name_zh`
- `name_en`
- `object_type`
- `ra_hours`
- `dec_deg`
- `is_active`
- `created_at`
- `updated_at`

#### `object_cards`

用于对象详情与解释卡片。

建议字段：

- `id`
- `object_id`
- `what_is_it`
- `why_watch_it`
- `what_next`
- `created_at`
- `updated_at`

### 4.3 下一阶段新增表建议

#### `astronomy_events`

用于未来天象日历和近期可关注天象。

建议字段：

- `id`
- `slug`
- `event_type`：`meteor_shower` 等
- `name_zh`
- `name_en`
- `start_at`
- `end_at`
- `peak_at`
- `intensity_level`
- `summary`
- `is_active`
- `created_at`
- `updated_at`

#### `event_observation_notes`

用于中国境内观测说明。

建议字段：

- `id`
- `event_id`
- `recommended_time_window`
- `observation_tip`
- `ideal_location_type`
- `better_region_summary`
- `created_at`
- `updated_at`

#### `observation_media`

用于观测参考图。

建议字段：

- `id`
- `target_type`：`object` / `event`
- `target_slug`
- `media_type`：`naked_eye_reference` / `photography_reference`
- `image_url`
- `caption`
- `photographer_name`
- `shot_location`
- `shot_time`
- `equipment_note`
- `license_note`
- `source_url`
- `is_active`
- `created_at`
- `updated_at`

#### `region_observation_snapshots`

用于附近更优区域结果缓存或预计算结果。

建议字段：

- `id`
- `region_key`
- `region_name`
- `lat`
- `lng`
- `cloud_score`
- `rain_risk`
- `moon_interference`
- `clarity_level`
- `observation_score`
- `snapshot_time`
- `created_at`

### 4.4 更后续的用户层表

这部分不是当前优先级，但应预留方向：

- `users`
- `favorite_targets`
- `observation_plans`
- `observation_logs`
- `user_equipment_profiles`

---

## 5. API 接口设计【A】

### 5.1 当前已落地接口

#### `GET /api/recommendations`

职责：

- 返回首页推荐结果
- 承接定位成功和定位失败两种上下文
- 未来可扩展到真实位置与时间驱动的推荐

#### `GET /api/sky-map/resolve`

职责：

- 把星图点击对象或搜索目标映射到产品对象
- 承接 `target` / `source` 链路

#### `GET /api/objects/[slug]`

职责：

- 聚合对象详情
- 返回解释内容
- 后续可接入观测参考图与动态观测状态

#### `GET /api/tools/observation-summary`

职责：

- 返回工具页轻摘要
- 后续可逐步升级为更完整的条件工具承接

#### `GET /api/health`

职责：

- 健康检查
- 部署排障

### 5.2 下一阶段新增接口建议

#### `GET /api/events/upcoming`

职责：

- 返回近期可关注天象
- 无结果时返回空数组，由前端决定隐藏模块

#### `GET /api/events/calendar`

职责：

- 返回未来一年流星雨总览
- 支持按月份组织数据

#### `GET /api/events/[slug]`

职责：

- 返回单个天象事件详情
- 可承接参考图与更优区域建议

#### `GET /api/tools/better-region`

职责：

- 根据当前位置，返回最近的显著更优区域
- 若无显著差异，返回“附近整体条件接近”结论

#### `GET /api/media/by-target`

职责：

- 返回对象或事件绑定的参考图
- 默认先返回肉眼参考，再返回摄影参考

### 5.3 接口返回结构

统一使用现有响应结构：

成功：

```json
{
  "code": 0,
  "data": {},
  "message": "ok"
}
```

失败：

```json
{
  "code": 4001,
  "data": null,
  "message": "error message"
}
```

---

## 6. 数据模型与产品能力对应【B】

### 6.1 首页能力

首页需要的核心数据：

- 推荐目标
- 观测条件短结论
- 最佳观察时间
- 附近更优区域轻提示
- 近期可关注天象轻提示

### 6.2 2D 星图模式

需要的数据：

- 搜索对象池
- 目标映射
- 位置与标签层
- `target` / `source` / `timeContext`

### 6.3 观察模式

需要的数据和计算：

- 当前时间
- 当前定位
- 设备朝向
- 天空窗口投影逻辑
- 目标轻引导状态
- 时间滑动的天空条件变化逻辑
- 星座辅助显隐逻辑

### 6.4 工具页

需要的数据：

- 今晚结论
- 影响因素
- 区域比较结果
- 近期天象入口

### 6.5 未来天象日历页

需要的数据：

- 未来一年流星雨事件表
- 每场事件的中国境内观察说明
- 区域级更优建议
- 参考图内容

### 6.6 详情页

需要的数据：

- 对象基础信息
- 解释卡片
- 动态观测状态
- 肉眼参考图
- 摄影参考图

---

## 7. 关键实现细节【B】

### 7.1 观察模式的技术原则

观察模式不能继续沿用“整张 2D 图跟着动”的心智模型。

第一原则：

- 天空固定
- 设备朝向改变视窗
- 屏幕中心代表当前视野中心

这意味着技术实现不能只是平移或旋转整个平面图，而应围绕“天空窗口”建立独立投影逻辑。

### 7.2 时间滑动的技术原则

时间滑动属于观察模式，并且是 `真实模拟为主，产品辅助为辅`。

实现上至少要支持：

- 今晚时间线
- 背景亮度变化
- 星体可见性变化
- 目标状态变化
- 星座辅助强弱变化

第一版不需要自由拖全夜 24 小时，但必须能提供清晰的“再晚一点会更好”的反馈。

### 7.3 更优区域提示的技术原则

第一版不做全国固定观星地推荐，而做当前位置相关的动态比较。

关键逻辑：

- 从近到远扩圈
- 找最近的显著更优区域
- 优先依据天气条件判断
- 不轻易因为轻微差异推荐用户换地方

### 7.4 观测参考图的技术原则

参考图不是普通素材图。

它必须：

- 能绑定对象或事件
- 区分肉眼参考与摄影参考
- 带来源与版权说明
- 能被详情页和事件页稳定调用

### 7.5 后端下一阶段优先级

按当前产品路线，后端优先级建议为：

#### P1 必须先长

- 天象事件数据层
- 流星雨事件表
- 区域观测条件比较能力

#### P2 明显升级产品

- 观测参考图内容层
- 图片与对象 / 事件绑定
- 简单内容管理能力

#### P3 后续再做

- 收藏
- 观测计划
- 观测记录
- 设备配置

---

## 8. 中间件与依赖速查【C】

### 8.1 当前关键依赖

- `next`
- `react`
- `typescript`
- `pg`
- 本地天文计算依赖与本地数据层

### 8.2 当前关键环境变量

- `DATABASE_URL`

### 8.3 当前关键后端文件

- [db.ts](D:/aiproject/stars/data-access/db.ts)
- [env.ts](D:/aiproject/stars/lib/env.ts)
- [api-response.ts](D:/aiproject/stars/lib/api-response.ts)
- [recommendations route](D:/aiproject/stars/app/api/recommendations/route.ts)
- [resolve route](D:/aiproject/stars/app/api/sky-map/resolve/route.ts)
- [objects route](D:/aiproject/stars/app/api/objects/[slug]/route.ts)
- [observation-summary route](D:/aiproject/stars/app/api/tools/observation-summary/route.ts)

---

## 9. 当前结论【A/B】

当前技术主线已经足以支撑产品下一轮正确演进，重点不在换栈，而在按产品优先级补足三类能力：

1. 观察模式的真实天空窗口体验
2. 工具页的区域比较与事件数据能力
3. 详情页 / 事件页的参考图内容能力

因此下一阶段最合理的做法不是重做技术栈，而是在现有 Next.js + TypeScript + PostgreSQL 架构上继续增量推进。
