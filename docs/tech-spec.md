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

### 4.2 当前已落地的对象数据表

第一阶段迁移已将星体基础信息、亮星详情、星座成员与连线关系写入 PostgreSQL。实时方位、仰角和行星轨道仍由天文计算代码按时间和地点实时计算，不保存为静态快照。

#### `celestial_objects`

用于表示产品承接的对象实体。

建议字段：

- `id`
- `slug`
- `name_zh`
- `name_en`
- `object_type`
- `ra_hours`：恒星 J2000 赤经；行星等动态对象可为空
- `dec_deg`：恒星 J2000 赤纬；行星等动态对象可为空
- `magnitude`
- `visual_size`：深空对象在平面总览中的显示尺寸
- `display_color`：深空对象显示色
- `search_aliases`
- `is_detail_ready`
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

#### `object_relations`

用于保存详情页“下一步可以探索”的有向对象关系，不再把推荐关系写在 API 代码中。

- `id`
- `source_object_id`
- `target_object_id`
- `relation_type`：当前为 `next_explore`
- `sort_order`
- `created_at` / `updated_at`

当前已覆盖 168 个对象详情卡片和 49 条下一步探索关系。

#### `constellations`

用于保存星座说明、缩写和视图锚点。它通过 `object_id` 关联 `celestial_objects` 中同 slug 的星座对象。

- `id`
- `object_id`
- `abbreviation`
- `description`
- `anchor_slug`
- `created_at`
- `updated_at`

#### `constellation_members`

用于保存星座与恒星的多对多关系及显示顺序。

- `constellation_id`
- `object_id`
- `sort_order`
- `created_at`

#### `constellation_lines`

用于保存星座连线的两个端点和绘制顺序。

- `constellation_id`
- `from_object_id`
- `to_object_id`
- `sort_order`
- `created_at`

### 4.3 数据迁移命令

- `npm run db:migrate`：创建或扩展表结构和索引，不删除业务数据
- `npm run db:seed`：执行已有基础种子并同步 129 颗亮星、18 个深空对象、11 个星座、168 个详情卡片、49 条对象关系、成员关系、连线和媒体；可重复执行

第二阶段新增 `GET /api/astronomy/catalog`，星图页面加载后使用该目录作为搜索、2D 星图、观察模式和 AR 星点的统一稳定数据源。数据库不可用时才使用本地目录降级。

### 4.4 天象事件数据表

#### `astronomy_events`

用于未来天象日历和工具页的近期可关注天象，当前已迁移流星雨数据。

已落地字段：

- `id` / `slug`
- `event_type`：`meteor_shower` 等
- `name_zh` / `name_en`
- `active_start_date` / `active_end_date` / `peak_date`
- `zhr` / `intensity_level`
- `summary` / `is_active` / `created_at` / `updated_at`

#### `event_observation_notes`

用于中国境内观测说明和区域建议。

已落地字段：

- `id`
- `event_id`
- `recommended_time_window` / `observation_tip`
- `ideal_location_type` / `better_region_summary`
- `created_at` / `updated_at`

当前 seed 已迁移 8 场流星雨和 8 条观测说明。跨年事件按完整日期保存，避免只保存 `MM-DD` 导致查询和排序错误。

#### `media_assets`

用于画廊、对象详情和后续天象事件的媒体目录。媒体文件不存入 PostgreSQL，数据库只保存存储位置、外部降级地址和版权元数据。

已落地字段：

- `id` / `asset_key`
- `media_type`：`gallery` / `object_reference` / `event_reference`
- `gallery_category`
- `object_id`：可空，绑定 `celestial_objects`
- `event_slug`：为后续事件参考图预留
- `title` / `description` / `alt_text`
- `storage_bucket` / `storage_path`
- `external_url`
- `source_url` / `credit` / `location` / `captured_at` / `equipment` / `license`
- `sort_order` / `is_active` / `created_at` / `updated_at`

当前 seed 已迁移 12 条画廊媒体和 12 条对象详情媒体。用户观测照片使用独立的 `observation_photos` 表保存元数据，文件放在 Supabase Storage 的私有 `observation-photos` bucket；服务端使用 `SUPABASE_SERVICE_ROLE_KEY` 生成临时签名地址，浏览器不接触服务密钥。画廊和详情参考图当前仍可使用 `external_url`，后续再按需上传到 Storage 并填写 `storage_bucket`、`storage_path`。

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

### 4.4 当前用户与观测记录表

#### `users`

- `id`：主键
- `email`：统一小写，唯一登录标识
- `password_hash`：Argon2id 哈希，不保存明文密码
- `email_verified_at`：预留邮箱验证状态
- `created_at` / `updated_at`

#### `user_sessions`

- `id`：主键
- `user_id`：所属用户，用户删除时级联删除
- `token_hash`：浏览器 Session Token 的 SHA-256 摘要
- `expires_at`：30 天有效期
- `created_at` / `last_seen_at`

#### `observation_records`

- `observer_id`：游客浏览器匿名身份，始终保留
- `user_id`：可空；注册或登录后由服务端事务认领
- 目标、时间、位置、设备与笔记字段
- 游客只允许访问 `user_id IS NULL` 且 `observer_id` 属于自己的记录
- 登录用户只允许按当前 Session 的 `user_id` 访问记录

#### 成就系列

- `achievement_series`：系列名称、说明、徽章视觉键与排序
- `achievement_series_members`：系列和星体 slug 的多对多成员关系；同一星体可推进多个系列
- `user_achievement_unlocks`：登录用户永久解锁结果，`user_id + series_id` 唯一
- 当前进度由 `observation_records.confirmed_at` 实时计算，不建立重复进度表
- 匿名浏览器只展示临时进度；登录或注册认领记录时补算永久徽章

后续用户层方向仍包括 `favorite_targets`、`observation_plans` 和 `user_equipment_profiles`，本轮不实现。

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

#### `GET /api/gallery`

职责：

- 返回数据库中的画廊媒体目录
- 支持可选 `category` 过滤
- 返回图片地址和来源、授权、拍摄信息

#### `GET /api/media/[assetKey]`

职责：

- 通过数据库媒体键代理读取图片文件
- 优先读取配置的 Storage 公共对象地址，没有 Storage 文件时读取 `external_url`
- 使用同源地址供浏览器加载，减少 Wikimedia 外链、来源策略和本地访问差异

#### `GET /api/objects/[slug]/media`

职责：

- 返回对象详情绑定的参考图
- 默认按媒体排序返回本体影像和完整来源元数据

#### `GET /api/tools/observation-summary`

职责：

- 返回工具页轻摘要
- 后续可逐步升级为更完整的条件工具承接

#### `GET /api/tools/upcoming-events`

职责：

- 返回未来一年内的流星雨事件
- 返回峰值日期、活跃期、ZHR、推荐观测时段和理想观测地
- 数据库不可用时回退到本地流星雨目录

#### `GET /api/health`

职责：

- 健康检查
- 部署排障

#### 账号与观测记录接口

- `POST /api/auth/register`：邮箱注册、创建会话并认领当前浏览器匿名记录
- `POST /api/auth/login`：邮箱密码登录、创建新会话并认领未归属记录
- `POST /api/auth/logout`：删除当前会话并清除 Cookie
- `GET /api/auth/me`：返回当前登录用户或 `null`
- `GET /api/observations`：按当前用户或匿名浏览器返回最近 100 条记录
- `POST /api/observations`：创建记录并写入当前归属
- `DELETE /api/observations/[id]`：校验数据归属后删除
- `GET /api/achievements`：返回当前身份的系列任务、成员进度、徽章状态和账号同步状态

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
- 区分 2D 星图与观察模式的星点密度与可见性策略
- 用于观察模式扩容的本地星表或离线同步星表数据源

补充说明：

- 阶段 5 的重点是把观察模式的几何、可见域、遮挡和输入稳定性做成可信原型。
- 阶段 6 的重点是把这个原型升级为产品态观察模式：地面仰望视角、稳定地景锚点、真实夜空观感。
- 也就是说，阶段 5 先回答“模型是否成立”，阶段 6 再回答“产品读起来是否真像站在地球上看天空”。

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

- 第二原则：

  - 2D 星图与观察模式必须使用不同的星点内容策略
  - 2D 星图负责参考性和结构感，可以克制
  - 观察模式负责真实夜空观感，星点数量和可见性必须明显更高
  - 默认视野中心优先服务真实天空内容，不允许固定星座连线长期抢占中心
  - 这套扩容优先依赖本地星表或离线同步后的本地数据，不依赖实时第三方接口请求

  原因是观察模式属于高频、连续、低延迟的视角系统。
  若把星点内容绑定到实时第三方接口，产品会在延迟、抖动、网络依赖和稳定性上直接受损。

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

不做全国固定观星地排行榜，而做当前位置相关的动态比较。现有选址地图叠加 NASA GIBS `VIIRS Night Lights` 年度夜光图层，并通过同一图层像素邻域估算选中点的相对暗夜分数。

关键逻辑：

- 长期夜光与当晚天气分别计算、分别展示，不能把卫星夜光伪装成实时光污染
- `lib/observation-snapshot.ts` 是地图、首页可见星表和首页推荐的共享计算入口
- 极限星等综合暗夜分数、天气观星指数、月相与月球高度
- 可见星表使用 `astronomy-engine` 计算行星/月球位置，亮星使用本地 J2000 赤经赤纬转当日坐标
- 首页四个目标只能取 `visibleSky.objects` 排序后的前四项
- NASA 图层不可用时按中等夜光保守估算，并在返回结果中标记数据不可用

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
