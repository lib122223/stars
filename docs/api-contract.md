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
| `sceneType` | string | 否 | 观测场景，如 `urban`、`balcony`、`open_space` |

### 筛选优先级

1. 先按当前时间有效性筛选。
2. 如果传入 `sceneType`，优先匹配场景。
3. 如果传入 `lat/lng`，作为轻量位置上下文参与增强。
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

## 第一阶段契约说明

当前 API 契约有意保留了项目真实成熟度分层：
- 首页推荐、详情聚合、工具摘要已经可以直接实现
- 星图对象映射的职责已经清楚，但具体输入形态仍依赖 PoC 后确认

后续实现与代码审查都应保留这个分层意识。
不要把预契约接口当成一个字段形态已经被完全验证过的正式接口。
