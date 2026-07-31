export interface ExtendedObjectCard {
  slug: string;
  whatIsIt: string;
  whyWatchIt: string;
  whatNext: string;
}

export interface ObjectRelationSeed {
  sourceSlug: string;
  targetSlug: string;
  sortOrder: number;
}

export const extendedObjectCards: ExtendedObjectCard[] = [
  {
    slug: "earth",
    whatIsIt: "地球是太阳系第三颗行星，也是目前已知唯一存在生命的天体。它有厚度适中的大气层、液态水和活跃的地质循环。",
    whyWatchIt: "地球本身不是夜空中的观测目标，但从月球或深空视角看地球，可以理解行星相位、云层和反照率如何改变天体外观。",
    whatNext: "可以继续观察月球，比较地球与月球在大小、亮度和表面结构上的差异。",
  },
  {
    slug: "mercury",
    whatIsIt: "水星是距离太阳最近、体积最小的太阳系行星，表面布满撞击坑，几乎没有能够长期保留的稠密大气。",
    whyWatchIt: "水星离太阳角距离很小，只能在日落后西方低空或日出前东方低空的短暂暮光时段寻找，观测窗口比其他行星更受限制。",
    whatNext: "观察水星时不要把手机或望远镜对准太阳；可以把它和同一时段的金星、月牙一起比较。",
  },
  {
    slug: "neptune",
    whatIsIt: "海王星是太阳系最外侧的八大行星之一，属于冰巨星，蓝色外观主要与大气中的甲烷吸收有关。",
    whyWatchIt: "海王星视星等较暗，肉眼不可见，通常需要望远镜和星图定位；它在望远镜中更像一颗细小的蓝色圆盘，而不是亮星。",
    whatNext: "可以先在星图中定位海王星，再用连续几晚的观测确认它相对于背景恒星的缓慢移动。",
  },
  {
    slug: "uranus",
    whatIsIt: "天王星是一颗冰巨星，淡青绿色外观来自其大气对红光的吸收；它的自转轴倾角非常大，像侧躺着绕太阳运行。",
    whyWatchIt: "天王星接近肉眼可见极限，城市环境通常无法直接看到，需要暗空、双筒望远镜或望远镜配合星图。",
    whatNext: "找到天王星后，可以把它与海王星、土星的颜色和视直径进行比较，理解行星观测中亮度与距离的关系。",
  },
  {
    slug: "sun",
    whatIsIt: "太阳是距离地球最近的恒星，提供地球生命所需的主要光和热，也是太阳系引力中心。",
    whyWatchIt: "太阳只能使用经过认证的太阳滤镜观测。它的黑子、日珥和日食具有很高的观测价值，但裸眼或普通相机直视太阳会造成永久性伤害。",
    whatNext: "夜间可以转而观察月球和行星；任何太阳观测都必须先确认滤镜安装牢固，并避免使用未经认证的自制滤镜。",
  },
  {
    slug: "andromeda-galaxy",
    whatIsIt: "仙女座星系（M31）是距离银河系最近的大型螺旋星系，距离约 250 万光年，拥有明显的盘面和伴星系。",
    whyWatchIt: "在远离城市的暗空中，M31 可能呈现为一团淡淡的椭圆光斑；肉眼看到的主要是中心明亮部分，不会像摄影作品那样显出完整旋臂。",
    whatNext: "可以继续寻找三角座星系，或用双筒望远镜观察 M31 周围的伴星系 M32 和 M110。",
  },
  {
    slug: "triangulum-galaxy",
    whatIsIt: "三角座星系（M33）是本星系群中的大型螺旋星系，距离约 270 万光年，盘面朝向我们，拥有丰富的恒星形成区。",
    whyWatchIt: "M33 的总星等不算极暗，但光线分散在很大的盘面上，表面亮度低，因此比 M31 更依赖透明、无月光的暗空。",
    whatNext: "可以先用仙女座星系建立定位参照，再向三角座方向寻找 M33；双筒望远镜比裸眼更容易确认它。",
  },
  {
    slug: "whirlpool-galaxy",
    whatIsIt: "涡状星系（M51）是一对正在相互作用的星系，主星系的旋臂受到伴星系引力扰动，形成很有辨识度的结构。",
    whyWatchIt: "M51 视星等约 8 等，肉眼不可见，即使用望远镜也常先看到模糊光斑；摄影中的清晰旋臂需要长时间曝光。",
    whatNext: "可以把 M51 与草帽星系、半人马座 A 放在一起比较，认识不同类型星系在望远镜和摄影中的差异。",
  },
  {
    slug: "sombrero-galaxy",
    whatIsIt: "草帽星系（M104）是一座近乎侧向面对我们的螺旋星系，中央核球和横贯盘面的尘埃带构成它最著名的外观。",
    whyWatchIt: "M104 位于室女座附近，视星等约 8 等，需要望远镜和较暗的天空；肉眼不会看到摄影图中的清晰黑色尘埃带。",
    whatNext: "可以沿室女座和后发座方向继续探索室女座星系团，比较单个星系与星系群的尺度。",
  },
  {
    slug: "centaurus-a",
    whatIsIt: "半人马座 A 是一座具有明显尘埃带的活动星系，也是距离银河系较近的射电星系之一。",
    whyWatchIt: "它位于南天，适合中国南部低纬度地区在南方低空尝试，北方地区往往会被地平线和大气吸收严重影响。",
    whatNext: "可以把它与南天的半人马座欧米伽星团一起观察，感受南方天区不同深空对象的视位置差异。",
  },
  {
    slug: "large-magellanic-cloud",
    whatIsIt: "大麦哲伦云是绕银河系运行的不规则矮星系，距离约 16 万光年，内部包含大量恒星形成区。",
    whyWatchIt: "它位于南天高纬区域，在中国大部分地区都非常低，通常无法获得稳定的观测高度；南半球暗空更适合观察。",
    whatNext: "可以继续了解小麦哲伦云，并比较两个麦哲伦云与银河系的形态和位置关系。",
  },
  {
    slug: "small-magellanic-cloud",
    whatIsIt: "小麦哲伦云是不规则矮星系，位于南天，和大麦哲伦云一起构成最著名的银河系伴星系组合。",
    whyWatchIt: "它的面积较大但表面亮度低，需要南半球的暗空；在中国境内即使升起，高度也通常很低，容易被地平线遮挡。",
    whatNext: "可以将它与大麦哲伦云并看，进一步理解肉眼深空目标的可见性不仅取决于总亮度，也取决于表面亮度和地理纬度。",
  },
  {
    slug: "orion-nebula",
    whatIsIt: "猎户座大星云（M42）是距离地球约 1300 光年的巨大恒星形成区，内部正在形成新恒星。",
    whyWatchIt: "在冬季暗空中，M42 可以在猎户座腰带下方看到朦胧光斑；双筒望远镜能显著增强它的形状和亮度。",
    whatNext: "可以顺着猎户座腰带和剑部继续观察，比较肉眼轮廓、双筒视野和长曝光摄影之间的差异。",
  },
  {
    slug: "lagoon-nebula",
    whatIsIt: "礁湖星云（M8）是人马座方向的大型发射星云和恒星形成区，内部有明亮的气体云与年轻恒星。",
    whyWatchIt: "它位于银河中心方向，夏季南方低空的暗空中更容易看到；双筒望远镜和窄带滤镜可以表现更多结构。",
    whatNext: "可以在同一片人马座天区寻找三叶星云和其他银河深空对象，建立银河中心的区域感。",
  },
  {
    slug: "crab-nebula",
    whatIsIt: "蟹状星云（M1）是公元 1054 年超新星爆发留下的超新星遗迹，中心有一颗高速旋转的脉冲星。",
    whyWatchIt: "M1 的视星等约 8 等，肉眼不可见，望远镜中通常呈现为淡淡的椭圆雾斑；摄影图中的细丝结构需要长时间曝光。",
    whatNext: "可以把蟹状星云与环状星云、哑铃星云比较，区分超新星遗迹和行星状星云。",
  },
  {
    slug: "ring-nebula",
    whatIsIt: "环状星云（M57）是天琴座中的行星状星云，一颗类似太阳的恒星在晚年抛出的外层气体形成了环状结构。",
    whyWatchIt: "它的角直径很小，望远镜中更容易确认，低倍率时像一个小烟圈；摄影作品中的颜色和细节不能直接等同于肉眼观感。",
    whatNext: "可以继续观察哑铃星云，比较两个行星状星云的形状、大小和所在天区。",
  },
  {
    slug: "dumbbell-nebula",
    whatIsIt: "哑铃星云（M27）是狐狸座中的行星状星云，来自一颗恒星在演化末期抛出的外层气体。",
    whyWatchIt: "它比环状星云面积更大，双筒望远镜或小型望远镜在暗空中就可能显示出模糊的双叶轮廓。",
    whatNext: "可以把它和环状星云、猎户座大星云放在一起比较，理解不同类型星云的形态来源。",
  },
  {
    slug: "pleiades",
    whatIsIt: "昴星团（M45）是金牛座中的年轻疏散星团，距离约 440 光年，肉眼通常能看到其中最亮的几颗恒星。",
    whyWatchIt: "它是非常适合肉眼和双筒望远镜观察的星团，几颗亮星组成紧凑的小勺形或小车形轮廓。",
    whatNext: "可以继续寻找毕星团，比较年轻、紧凑的昴星团与更疏松的毕星团。",
  },
  {
    slug: "hyades",
    whatIsIt: "毕星团是距离太阳最近的疏散星团之一，位于金牛座，成员星在天空中构成明显的 V 形。",
    whyWatchIt: "它的范围较大，适合用肉眼或低倍率双筒望远镜观察；金牛座的毕宿五位于同一视线方向，但并不属于这个星团。",
    whatNext: "可以把毕星团与昴星团放在一起观察，认识视场大小、成员密度和距离造成的外观差异。",
  },
  {
    slug: "beehive-cluster",
    whatIsIt: "蜂巢星团（M44）是巨蟹座中的疏散星团，距离约 600 光年，古代观测者常把它描述为一团朦胧云气。",
    whyWatchIt: "在远离城市的夜空中，M44 可能只呈现为模糊斑点；双筒望远镜能把它分解成许多颗星，显示出蜂巢般的密集结构。",
    whatNext: "可以比较 M44 与昴星团的大小和星点分布，再回到巨蟹座区域寻找它的准确位置。",
  },
  {
    slug: "double-cluster",
    whatIsIt: "双星团由英仙座方向的 NGC 869 和 NGC 884 两个疏散星团组成，彼此在天空中靠得很近。",
    whyWatchIt: "它是北天非常适合双筒望远镜的目标，两个星团在同一视野内形成成片的星点聚集。",
    whatNext: "可以沿仙后座的 W 形轮廓向英仙座移动，把双星团作为星座间跳转的深空目标。",
  },
  {
    slug: "hercules-globular-cluster",
    whatIsIt: "武仙座球状星团（M13）是由数十万颗恒星组成的古老球状星团，距离地球约 2.5 万光年。",
    whyWatchIt: "M13 的总星等约 5.8 等，在极暗的天空中可能勉强肉眼可见为小雾斑；双筒或望远镜能更稳定地确认它。",
    whatNext: "可以把 M13 与半人马座欧米伽星团比较，了解球状星团与疏散星团在年龄和结构上的区别。",
  },
  {
    slug: "omega-centauri",
    whatIsIt: "半人马座欧米伽星团是银河系中最大、最明亮的球状星团之一，包含数百万颗恒星，距离约 1.6 万光年。",
    whyWatchIt: "它位于南天，在中国南部低空才有机会看到，越往南观测高度越高；暗空下可呈现明显的朦胧光团。",
    whatNext: "可以继续观察半人马座 A，比较同一南天区域里的球状星团和星系。",
  },
];

export const objectRelationSeeds: ObjectRelationSeed[] = [
  ["jupiter", "venus"], ["jupiter", "saturn"],
  ["venus", "jupiter"], ["venus", "moon"],
  ["mars", "jupiter"], ["mars", "betelgeuse"],
  ["saturn", "jupiter"], ["saturn", "moon"],
  ["moon", "venus"], ["moon", "jupiter"],
  ["vega", "polaris"], ["vega", "sirius"],
  ["sirius", "orion"], ["sirius", "betelgeuse"],
  ["betelgeuse", "orion"], ["betelgeuse", "sirius"],
  ["polaris", "vega"], ["polaris", "orion"],
  ["orion", "sirius"], ["orion", "betelgeuse"],
  ["earth", "moon"], ["earth", "venus"],
  ["mercury", "venus"], ["mercury", "sun"],
  ["uranus", "neptune"], ["uranus", "saturn"],
  ["neptune", "uranus"], ["neptune", "saturn"],
  ["sun", "earth"], ["sun", "mercury"],
  ["andromeda-galaxy", "triangulum-galaxy"],
  ["triangulum-galaxy", "andromeda-galaxy"],
  ["whirlpool-galaxy", "sombrero-galaxy"],
  ["sombrero-galaxy", "centaurus-a"],
  ["centaurus-a", "omega-centauri"],
  ["large-magellanic-cloud", "small-magellanic-cloud"],
  ["small-magellanic-cloud", "large-magellanic-cloud"],
  ["orion-nebula", "crab-nebula"],
  ["orion-nebula", "lagoon-nebula"],
  ["lagoon-nebula", "dumbbell-nebula"],
  ["ring-nebula", "dumbbell-nebula"],
  ["dumbbell-nebula", "ring-nebula"],
  ["pleiades", "hyades"], ["pleiades", "double-cluster"],
  ["hyades", "pleiades"], ["beehive-cluster", "pleiades"],
  ["double-cluster", "pleiades"],
  ["hercules-globular-cluster", "omega-centauri"],
  ["omega-centauri", "hercules-globular-cluster"],
].map(([sourceSlug, targetSlug], index) => ({ sourceSlug, targetSlug, sortOrder: index + 1 }));
