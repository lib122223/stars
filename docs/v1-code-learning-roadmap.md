# Echo of Photons 第一版代码学习路线图 v1

## 文档目的

本路线图不是为了通读整个代码库，而是为了在推进第二版之前，用最低学习成本看懂第一版的主闭环、数据流和常见错误类型。

适用场景：
- 想快速理解第一版是怎么搭起来的
- 想知道第二版改哪里时该看哪些文件
- 想从 Claude Code 的错误里学习如何验收 AI 产出

---

## 学习原则

1. 先看闭环，再看文件夹。
2. 先看页面和 API 怎么连，再看局部实现细节。
3. 每次只回答少量关键问题，不追求一次全懂。
4. 只精读会影响第二版推进的代码。

推荐顺序：

1. 项目总地图
2. 首页推荐闭环
3. 星图承接闭环
4. 详情页与解释卡片闭环
5. 工具页轻辅助闭环
6. 数据库底座
7. Claude Code 错误复盘

---

## 第 0 步：项目总地图

### 建议阅读

- `docs/dev-plan.md`
- `docs/api-contract.md`
- `docs/tech-spec.md`

### 只回答这 4 个问题

1. 第一版一共做了哪 7 个阶段
2. 四个核心页面是什么
3. 四个核心 API 是什么
4. 三张核心表是什么

### 学完目标

- 知道项目是按阶段长出来的
- 知道页面、接口、数据表的总体结构
- 不再把项目看成一堆离散文件

---

## 第 1 步：首页推荐闭环

### 建议阅读

- `app/page.tsx`
- `features/home/primary-card.tsx`
- `features/home/condition-summary.tsx`
- `features/home/secondary-entry.tsx`
- `features/home/loading-card.tsx`
- `features/home/error-card.tsx`
- `app/api/recommendations/route.ts`

### 只回答这 5 个问题

1. 首页为什么不是直接写死文案，而是走 `/api/recommendations`
2. 主推荐、条件层、辅推荐分别由谁渲染
3. 为什么会有 `sceneType`
4. 为什么无定位时还能工作
5. “去星图找它”是怎么把 `target` 带到星图页的

### 这一块会学到

- 页面怎么吃 API
- UI 组件怎么围绕契约组织
- 首页为什么是入口分发页，而不是内容页

### 推荐同步复盘的错误案例

- `targetRef: null` 时曾经差点生成 `/objects/null`
- 学习点：契约字段存在，不等于总是可跳转

---

## 第 2 步：星图承接闭环

这是第一版最重要的一块。

### 建议阅读

- `app/sky-map/page.tsx`
- `features/sky-map/wwt-viewer.tsx`
- `features/sky-map/bottom-drawer.tsx`
- `features/sky-map/object-lookup.ts`
- `app/api/sky-map/resolve/route.ts`

### 只回答这 7 个问题

1. 首页传过来的 `target` 是怎么被星图页读到的
2. `target` 为什么能让 WWT 自动导航到目标区域
3. WWT 点击之后，为什么不会直接得到你自己的对象
4. `lookupByCoord` 在整条链里是干什么的
5. `/api/sky-map/resolve` 在整条链里是干什么的
6. 为什么 `coord-*` 不能进入详情页
7. `resolve` 现在为什么还只是“可支撑 MVP”，不是稳稳的正式契约

### 这一块会学到

- 第三方能力和本地对象系统怎么接起来
- 点击识别、映射、承接之间的关系
- 为什么“有点击结果”不等于“对象闭环完成”

### 推荐同步复盘的错误案例

- `resolve` 只完成了 `name` 匹配，却差点被说成 `name + type` 都完成
- `coord` 曾经会误给详情入口
- 学习点：AI 很容易把“能跑”说成“已收口”

---

## 第 3 步：详情页与解释卡片闭环

### 建议阅读

- `app/objects/[slug]/page.tsx`
- `features/objects/object-summary.tsx`
- `features/objects/exploration-card.tsx`
- `app/api/objects/[slug]/route.ts`

### 配合阅读

- `data-access/schema.sql`
- `data-access/seed.sql`

### 只回答这 6 个问题

1. 详情页为什么一开始是 mock，后来再切 API
2. `object` 和 `card` 为什么要聚合返回
3. `card: null` 为什么不算错误
4. 为什么 `object_cards` 要单独成表
5. 为什么 `object_id` 后来必须加唯一约束
6. 为什么 seed 幂等性这么重要

### 这一块会学到

- 详情页为什么是“理解层”而不是纯展示层
- 数据表怎么和页面契约对齐
- 为什么 schema / seed 也是产品闭环的一部分

### 推荐同步复盘的错误案例

- 曾经所有 slug 都渲染成木星
- “重试”按钮曾经只是看起来像能用
- `object_cards` 的异常一开始吞得太宽
- 学习点：页面结构对了，不等于页面行为对了

---

## 第 4 步：工具页轻辅助闭环

### 建议阅读

- `app/tools/page.tsx`
- `features/tools/observation-panel.tsx`
- `features/tools/settings-bar.tsx`
- `app/api/tools/observation-summary/route.ts`

### 只回答这 5 个问题

1. 工具页为什么不能长成重控制台
2. `summary / sceneSuggestion / weatherHint` 为什么刚好够用
3. `sceneType` 为什么要做成轻设置而不是复杂筛选
4. 为什么工具页要保留很低的视觉权重
5. 为什么它要有 API，而不是一直写 mock

### 这一块会学到

- “轻辅助页”在项目里的真正含义
- 一个页面怎么避免功能失控
- 怎么用最少的设置项撑出“有点用”的感觉

### 推荐同步复盘的错误案例

- 曾经有一次汇报说文件已落盘，但真实代码库里并没有
- 学习点：复查必须看真实文件，不看口头描述

---

## 第 5 步：数据库底座

这一部分不用全量精读，但值得通看一遍。

### 建议阅读

- `data-access/db.ts`
- `data-access/schema.sql`
- `data-access/seed.sql`
- `lib/env.ts`
- `lib/api-response.ts`

### 只回答这 5 个问题

1. 数据库连接是怎么初始化的
2. 为什么所有 API 都统一返回 `{ code, data, message }`
3. 三张表各自服务哪个页面
4. 第一版为什么只做最小表集
5. 哪些种子数据在支撑 MVP 演示

### 这一块会学到

- 项目已经有真实数据底座，而不是纯前端演示
- 页面、接口、数据库是怎么一层层连起来的

---

## 第 6 步：专门学习 Claude Code 的错误

如果不想系统啃代码，这一步反而特别有价值。

### 建议记录方式

做一张轻量错误表：

| 错误类型 | 当时它怎么说 | 真实代码是什么 | 你学到什么 |
|---|---|---|---|
| 口径错误 | “详情承接完成” | 实际只是 `/objects/{slug}` 能跳 | 路由成立不等于业务成立 |
| 实现错误 | “重试按钮可用” | 实际没重新 fetch | UI 行为要看真实触发链 |
| 数据层错误 | “seed 已落地” | 当时代码库里没有 seed 文件 | 落库和口头描述必须分开 |

### 建议分类

1. 越界错误
   - 该复查时去改代码
   - 该做 UI 骨架时顺手做 API

2. 口径错误
   - 代码只完成一半，汇报说成闭环完成
   - 路由成立，却说成业务成立

3. 实现错误
   - 重试按钮无效
   - catch 吞太宽
   - seed 不幂等

4. 阶段错误
   - 阶段 4 抢跑阶段 5
   - 阶段 7 还没审完就想收口

### 学习收益

- 你会越来越会判断 AI 的产出哪里扎实、哪里快了半步
- 你会更容易定义“什么叫真的完成”

---

## 最适合当前状态的学习节奏

不建议连着 7 天硬学。

推荐拆成 3 次：

1. 项目地图 + 首页闭环
2. 星图闭环
3. 详情页 + 工具页 + 数据库

每次 30 到 60 分钟即可。

---

## 如果只愿意重点学 3 块

优先看：

1. `features/sky-map/*`
2. `app/api/*`
3. `data-access/*`

原因：
- 这三块决定主闭环怎么成立
- 这三块最影响第二版能往哪里扩
- 这三块也是最容易出工程性问题的地方

---

## 学习时可直接使用的问题模板

以后可以直接围绕这些问题来学：

- 首页推荐这条链从 API 到页面是怎么走的？
- WWT 点击之后，为什么还要 resolve？
- 详情页为什么允许 `card: null`？
- 工具页为什么不能做太重？
- 这段代码在整个闭环里扮演什么角色？

---

## 推荐起始顺序

如果准备真正开始学第一版，建议第一课从这里开始：

- `app/page.tsx`
- `app/api/recommendations/route.ts`
- `app/sky-map/page.tsx`

也就是先学：

**首页推荐闭环 + 星图入口承接**

原因：
- 它是主闭环起点
- 最容易建立整体感
- 最适合为第二版讨论做准备

---

## 当前使用建议

如果当前更大的目标是做出更强、更大的第二版，那么这份路线图建议这样用：

- 主线继续推进第二版讨论
- 遇到卡点时，再按本路线图回看对应模块
- 不做全量学习，只做“够推进下一步”的理解补足

这份路线图的目标不是让你成为第一版维护者，而是让你在推进第二版时，不会被第一版代码拖住。
