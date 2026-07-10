-- Echo of Photons MVP 最小种子数据
-- 覆盖行星(5)、亮星(4)、星座(2)，共 11 条

INSERT INTO celestial_objects (slug, name_zh, name_en, object_type) VALUES
  ('jupiter',    '木星',   'Jupiter',    'planet'),
  ('venus',      '金星',   'Venus',      'planet'),
  ('mars',       '火星',   'Mars',       'planet'),
  ('saturn',     '土星',   'Saturn',     'planet'),
  ('moon',       '月球',   'Moon',       'planet'),
  ('vega',       '织女星', 'Vega',       'bright_star'),
  ('sirius',     '天狼星', 'Sirius',     'bright_star'),
  ('betelgeuse', '参宿四', 'Betelgeuse', 'bright_star'),
  ('polaris',    '北极星', 'Polaris',    'bright_star'),
  ('orion',      '猎户座', 'Orion',      'constellation'),
  ('ursa-major', '大熊座', 'Ursa Major', 'constellation')
ON CONFLICT (slug) DO NOTHING;

-- 解释卡片种子（10 条，覆盖 StarCanvas 全部可点击对象）
-- jupiter / orion / vega / venus / mars / saturn / moon / sirius / betelgeuse / polaris

INSERT INTO object_cards (object_id, what_is_it, why_watch_it, what_next)
SELECT id, '木星是太阳系中体积最大的行星，也是夜空中最容易辨认的明亮目标之一。', '它通常足够明亮，位置也比较明显，很适合作为新手从看到走向认出的第一步。', '认出木星后，可以继续观察它周围的天空区域，尝试再找一颗亮星或另一颗容易辨认的行星。' FROM celestial_objects WHERE slug = 'jupiter' ON CONFLICT (object_id) DO NOTHING;

INSERT INTO object_cards (object_id, what_is_it, why_watch_it, what_next)
SELECT id, '猎户座是北半球冬季夜空中最引人注目的星座之一，以腰带上的三颗亮星最为著名。', '它的形状清晰易辨，而且包含参宿四和参宿七两颗亮星，是新手开始认星座的最佳起点之一。', '认出猎户座后，可以沿腰带连线往东南方向寻找天狼星，这是夜空中最亮的恒星。' FROM celestial_objects WHERE slug = 'orion' ON CONFLICT (object_id) DO NOTHING;

INSERT INTO object_cards (object_id, what_is_it, why_watch_it, what_next)
SELECT id, '织女星是夏季夜空中最亮的恒星之一，也是夏季大三角的顶点之一。', '它位于天琴座，在夏季和初秋的夜空非常显眼，是辨认夏季星空的关键锚点。', '找到织女星后，可以向东南方向寻找牛郎星（河鼓二）和天津四，这三颗亮星一起构成夏季大三角。' FROM celestial_objects WHERE slug = 'vega' ON CONFLICT (object_id) DO NOTHING;

INSERT INTO object_cards (object_id, what_is_it, why_watch_it, what_next)
SELECT id, '金星是夜空中除月球之外最亮的天体，通常在日落后或日出前出现在地平线附近，被称为"启明星"或"长庚星"。', '它亮度极高，甚至在城市中也很难错过，非常适合作为从亮目标开始认星的第一步。', '认出金星后，可以尝试在它附近寻找木星，这两颗行星常常在傍晚的西方天空相伴出现。' FROM celestial_objects WHERE slug = 'venus' ON CONFLICT (object_id) DO NOTHING;

INSERT INTO object_cards (object_id, what_is_it, why_watch_it, what_next)
SELECT id, '火星因其表面氧化铁呈现出明显的橙红色，是夜空中最容易从颜色上辨认的行星。', '它独特的红色让它一眼就能从恒星中区分出来，即使对新手来说也几乎不可能认错。', '认出火星后，可以留意它旁边的亮星，尝试判断哪些是恒星、哪些是行星。' FROM celestial_objects WHERE slug = 'mars' ON CONFLICT (object_id) DO NOTHING;

INSERT INTO object_cards (object_id, what_is_it, why_watch_it, what_next)
SELECT id, '土星以壮观的光环闻名，呈现稳定的淡黄色光芒，它是太阳系中仅次于木星的第二大行星。', '它的颜色温和而独特，亮度适中且稳定，在夜空中的位置变化较慢，适合作为长期跟踪目标。', '认出土星后，可以找一个双筒望远镜尝试观察，即使是小型望远镜也有可能看到它的光环。' FROM celestial_objects WHERE slug = 'saturn' ON CONFLICT (object_id) DO NOTHING;

INSERT INTO object_cards (object_id, what_is_it, why_watch_it, what_next)
SELECT id, '月球是地球唯一的天然卫星，也是夜空中最容易观测到的天体，每晚位置和形状都会变化。', '它是新手最友好的起点——不需要任何知识，抬头就能看到。月相变化是理解天体运行规律的天然教材。', '今晚看过月球后，试着在它周围找一颗亮星，比较它们的亮度，这就是理解"视星等"概念的第一步。' FROM celestial_objects WHERE slug = 'moon' ON CONFLICT (object_id) DO NOTHING;

INSERT INTO object_cards (object_id, what_is_it, why_watch_it, what_next)
SELECT id, '天狼星是夜空中最亮的恒星，位于大犬座，名字来源于希腊语"灼热的"。', '它的亮度在恒星中排名第一，即使城市中也很容易看到，是新手认星的地标。', '认出天狼星后，向西北方向寻找猎户座，天狼星与猎户座的位置关系是辨认冬季星空的关键线索。' FROM celestial_objects WHERE slug = 'sirius' ON CONFLICT (object_id) DO NOTHING;

INSERT INTO object_cards (object_id, what_is_it, why_watch_it, what_next)
SELECT id, '参宿四是猎户座中第二亮的恒星，也是夜空中最明亮的红超巨星之一，体积极其巨大。', '它明显的橙红色让它在猎户座的蓝白亮星中格外突出，作为变星其亮度会有周期性变化。', '认出参宿四后，在猎户座另一角寻找蓝白色的参宿七，比较两颗星的颜色，这是理解恒星温度与颜色关系的最好例子。' FROM celestial_objects WHERE slug = 'betelgeuse' ON CONFLICT (object_id) DO NOTHING;

INSERT INTO object_cards (object_id, what_is_it, why_watch_it, what_next)
SELECT id, '北极星位于小熊座尾巴末端，由于地球自转轴几乎指向它，它在夜空中几乎保持不动，所有恒星似乎都围绕它旋转。', '找到北极星就等于知道了正北方向，它"定点不动"的性质让它成为认星过程中最重要的锚点之一。', '找到北极星后，观察一段时间，你会看到北斗七星等星座似乎围绕它缓慢转动——这就是地球自转的直接证据。' FROM celestial_objects WHERE slug = 'polaris' ON CONFLICT (object_id) DO NOTHING;
