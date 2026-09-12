import type {
  CalendarEvent,
  Child,
  Facility,
  Message,
  MessageTemplate,
  NurseryClass,
  NotebookEntry,
  Notice,
  User,
} from './types'

export const facilities: Facility[] = [
  { id: 'f1', slug: 'nijiiro', name: 'にじいろ保育園', logoColor: 'oklch(0.67 0.13 158)' },
  { id: 'f2', slug: 'himawari', name: 'ひまわり保育園', logoColor: 'oklch(0.78 0.13 75)' },
]

export const messageTemplates: MessageTemplate[] = [
  {
    id: 'template-f1-daily-update',
    facilityId: 'f1',
    name: '本日の様子',
    text: '本日も元気に過ごしています。園での様子について、気になることがありましたらお知らせください。',
  },
  {
    id: 'template-f1-health-check',
    facilityId: 'f1',
    name: '体調確認',
    text: '本日、少し体調が気になる様子がありました。ご家庭でも様子を見ていただき、変化がありましたらお知らせください。',
  },
  {
    id: 'template-f1-belongings',
    facilityId: 'f1',
    name: '持ち物のお願い',
    text: '園で使用する持ち物についてご確認をお願いします。次回登園時にお持ちいただけますと助かります。',
  },
]

export const nurseryClasses: NurseryClass[] = [
  { id: 'class-f1-umi', facilityId: 'f1', name: 'うみ組（0歳児）', schoolYear: 2026 },
  { id: 'class-f1-hoshi', facilityId: 'f1', name: 'ほし組（1歳児）', schoolYear: 2026 },
  { id: 'class-f1-tsuki', facilityId: 'f1', name: 'つき組（2歳児）', schoolYear: 2026 },
  { id: 'class-f1-kaze', facilityId: 'f1', name: 'かぜ組（3歳児）', schoolYear: 2026 },
  { id: 'class-f1-sora', facilityId: 'f1', name: 'そら組（4歳児）', schoolYear: 2026 },
  { id: 'class-f1-niji', facilityId: 'f1', name: 'にじ組（5歳児）', schoolYear: 2026 },
]

const baseChildren: Child[] = [
  {
    id: 'c1',
    classId: 'class-f1-sora',
    name: '田中 ひなた',
    kana: 'たなか ひなた',
    facilityId: 'f1',
    className: 'そら組（4歳児）',
    birthday: '2021-06-15',
    avatarColor: 'oklch(0.8 0.11 30)',
    allergies: ['卵', '乳'],
    notes: '午睡はうつ伏せになりやすいので見守りをお願いします。',
  },
  {
    id: 'c2',
    classId: 'class-f1-tsuki',
    name: '田中 あおい',
    kana: 'たなか あおい',
    facilityId: 'f1',
    className: 'つき組（2歳児）',
    birthday: '2023-11-02',
    avatarColor: 'oklch(0.72 0.12 250)',
    allergies: [],
    notes: '人見知りが少しあります。だっこが好きです。',
  },
  {
    id: 'c3',
    classId: 'class-f1-sora',
    name: '佐藤 はると',
    kana: 'さとう はると',
    facilityId: 'f1',
    className: 'そら組（4歳児）',
    birthday: '2021-03-08',
    avatarColor: 'oklch(0.7 0.13 200)',
    allergies: ['そば'],
    notes: '外遊びが大好きです。',
  },
  {
    id: 'c4',
    classId: 'class-f1-niji',
    name: '鈴木 めい',
    kana: 'すずき めい',
    facilityId: 'f1',
    className: 'にじ組（5歳児）',
    birthday: '2020-09-20',
    avatarColor: 'oklch(0.75 0.12 330)',
    allergies: [],
    notes: 'お絵かきが得意です。',
  },
]

const classTargets = [
  { classId: 'class-f1-umi', className: 'うみ組（0歳児）', age: 0, count: 6 },
  { classId: 'class-f1-hoshi', className: 'ほし組（1歳児）', age: 1, count: 8 },
  { classId: 'class-f1-tsuki', className: 'つき組（2歳児）', age: 2, count: 10 },
  { classId: 'class-f1-kaze', className: 'かぜ組（3歳児）', age: 3, count: 12 },
  { classId: 'class-f1-sora', className: 'そら組（4歳児）', age: 4, count: 12 },
  { classId: 'class-f1-niji', className: 'にじ組（5歳児）', age: 5, count: 12 },
]

const familyNames = [
  ['伊藤', 'いとう'],
  ['渡辺', 'わたなべ'],
  ['山本', 'やまもと'],
  ['中村', 'なかむら'],
  ['小林', 'こばやし'],
  ['加藤', 'かとう'],
  ['吉田', 'よしだ'],
  ['山田', 'やまだ'],
  ['佐々木', 'ささき'],
  ['山口', 'やまぐち'],
  ['松本', 'まつもと'],
  ['井上', 'いのうえ'],
  ['木村', 'きむら'],
  ['林', 'はやし'],
] as const

const givenNames = [
  ['りく', 'りく'],
  ['ゆい', 'ゆい'],
  ['そうた', 'そうた'],
  ['ひまり', 'ひまり'],
] as const

const avatarColors = [
  'oklch(0.8 0.11 30)',
  'oklch(0.72 0.12 250)',
  'oklch(0.7 0.13 200)',
  'oklch(0.75 0.12 330)',
  'oklch(0.78 0.12 80)',
  'oklch(0.72 0.13 155)',
]

let generatedChildIndex = 0
const additionalChildren = classTargets.flatMap((target) => {
  const existingCount = baseChildren.filter((child) => child.classId === target.classId).length
  return Array.from({ length: target.count - existingCount }, (_, index): Child => {
    const identityIndex = generatedChildIndex++
    const familyName = familyNames[identityIndex % familyNames.length]
    const givenName =
      givenNames[
        (identityIndex + Math.floor(identityIndex / familyNames.length)) % givenNames.length
      ]
    const month = 4 + ((identityIndex * 2) % 9)
    const day = 2 + ((identityIndex * 5) % 25)
    return {
      id: `seed-child-${target.age}-${index + 1}`,
      classId: target.classId,
      name: `${familyName[0]} ${givenName[0]}`,
      kana: `${familyName[1]} ${givenName[1]}`,
      facilityId: 'f1',
      className: target.className,
      birthday: `${2025 - target.age}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      avatarColor: avatarColors[identityIndex % avatarColors.length],
      allergies: identityIndex % 11 === 0 ? ['卵'] : [],
      notes: '',
    }
  })
})

export const children: Child[] = [...baseChildren, ...additionalChildren]

export const users: User[] = [
  {
    id: 'u1',
    role: 'parent',
    name: '田中 さくら',
    facilityId: 'f1',
    facilitySlug: 'nijiiro',
    email: 'sakura@example.com',
    childIds: ['c1', 'c2'],
  },
  {
    id: 'u2',
    role: 'teacher',
    name: '山田 めぐみ',
    facilityId: 'f1',
    facilitySlug: 'nijiiro',
    email: 'yamada@nijiiro.ed.jp',
    jobTitle: 'そら組 担任',
    canManageFacility: true,
  },
]

const today = '2026-09-12'
const yesterday = '2026-09-11'
const twoDaysAgo = '2026-09-10'

export const notebookEntries: NotebookEntry[] = [
  {
    id: 'n1',
    childId: 'c1',
    date: today,
    author: 'teacher',
    authorName: '山田 めぐみ',
    mood: 'good',
    temperature: '36.5',
    meals: '給食は完食しました。おかわりもしています。',
    nap: '12:40〜14:30 ぐっすり眠れました。',
    toilet: '午前2回・午後1回、自分でトイレに行けました。',
    note: 'お友だちと積み木で大きなお城を作って大喜びでした。片付けも進んでできました。',
    photo: '/nursery-kids-playing-with-blocks.png',
  },
  {
    id: 'n2',
    childId: 'c1',
    date: today,
    author: 'parent',
    authorName: '田中 さくら',
    mood: 'good',
    temperature: '36.4',
    meals: '朝ごはんはパンとバナナを食べました。',
    nap: '21:00〜6:30',
    toilet: '朝は快便でした。',
    note: '昨夜は少し咳が出ていました。今日は元気ですが、様子を見ていただけると助かります。',
  },
  {
    id: 'n3',
    childId: 'c1',
    date: yesterday,
    author: 'teacher',
    authorName: '山田 めぐみ',
    mood: 'normal',
    temperature: '36.6',
    meals: '野菜を少し残しましたが、お肉はよく食べました。',
    nap: '13:00〜14:20',
    toilet: '順調でした。',
    note: '園庭でかけっこをたくさん楽しみました。',
  },
  {
    id: 'n4',
    childId: 'c2',
    date: today,
    author: 'teacher',
    authorName: '加藤 ゆり',
    mood: 'normal',
    temperature: '36.7',
    meals: 'おかずをスプーンで頑張って食べていました。',
    nap: '12:30〜15:00',
    toilet: 'おむつ交換 午前2回・午後2回。',
    note: '水遊びで水面をぱしゃぱしゃ叩いて笑っていました。',
    photo: '/toddler-water-play-summer.png',
  },
  {
    id: 'n5',
    childId: 'c3',
    date: today,
    author: 'teacher',
    authorName: '山田 めぐみ',
    mood: 'bad',
    temperature: '36.8',
    meals: '完食しました。',
    nap: '12:45〜14:40',
    toilet: '順調です。',
    note: '午前中たくさん走ったので、午後は少しお疲れモードでした。',
  },
]

export const notices: Notice[] = [
  {
    id: 'no1',
    facilityId: 'f1',
    title: '【重要】9月の運動会について',
    body: '9月28日（土）に運動会を開催します。雨天の場合は翌日に順延です。持ち物や集合時間の詳細は配布資料をご確認ください。',
    date: today,
    category: 'イベント',
    pinned: true,
  },
  {
    id: 'no2',
    facilityId: 'f1',
    title: '感染症の流行について',
    body: '園内で発熱によるお休みが増えています。朝の検温と体調確認をお願いいたします。',
    date: yesterday,
    category: '保健',
  },
  {
    id: 'no3',
    facilityId: 'f1',
    title: '9月の献立表を掲載しました',
    body: '今月の給食・おやつの献立表を「資料」からご確認いただけます。アレルギー対応についてはお気軽にご相談ください。',
    date: twoDaysAgo,
    category: '給食',
  },
  {
    id: 'no4',
    facilityId: 'f1',
    title: '衣替えのお願い',
    body: '朝晩が涼しくなってきました。長袖の着替えを1枚多めにご用意ください。',
    date: '2026-09-08',
    category: 'お願い',
  },
]

export const messages: Message[] = [
  {
    id: 'm1',
    childId: 'c1',
    sender: 'parent',
    senderName: '田中 さくら',
    text: 'いつもお世話になっております。明日は祖母がお迎えに行く予定です。よろしくお願いします。',
    time: '2026-09-11T18:20:00',
  },
  {
    id: 'm2',
    childId: 'c1',
    sender: 'teacher',
    senderName: '山田 めぐみ',
    text: '承知しました。お迎えの方のお名前を教えていただけますか？',
    time: '2026-09-11T18:35:00',
  },
  {
    id: 'm3',
    childId: 'c1',
    sender: 'parent',
    senderName: '田中 さくら',
    text: '田中 花子です。16時ごろの予定です。',
    time: '2026-09-11T18:40:00',
  },
  {
    id: 'm4',
    childId: 'c1',
    sender: 'teacher',
    senderName: '山田 めぐみ',
    text: 'かしこまりました。お待ちしております。ひなたちゃん、今日も元気いっぱいでしたよ！',
    time: '2026-09-11T18:42:00',
  },
  {
    id: 'm5',
    childId: 'c2',
    sender: 'teacher',
    senderName: '加藤 ゆり',
    text: 'あおいちゃん、今日はお昼寝の前に少しぐずりましたが、その後はぐっすり眠れました。',
    time: '2026-09-12T15:10:00',
  },
]

export const calendarEvents: CalendarEvent[] = [
  {
    id: 'e1',
    facilityId: 'f1',
    date: '2026-09-15',
    title: '身体測定',
    type: '健診',
    time: '10:00',
    memo: '全クラス対象',
  },
  {
    id: 'e2',
    facilityId: 'f1',
    date: '2026-09-18',
    title: 'お誕生日会',
    type: '行事',
    time: '10:30',
  },
  {
    id: 'e3',
    facilityId: 'f1',
    date: '2026-09-24',
    title: '個人面談（そら組）',
    type: '面談',
    time: '15:00',
    memo: '希望制・15分入替',
  },
  {
    id: 'e4',
    facilityId: 'f1',
    date: '2026-09-28',
    title: '運動会',
    type: '行事',
    time: '9:00',
    memo: '雨天順延',
  },
  {
    id: 'e5',
    facilityId: 'f1',
    date: '2026-09-21',
    title: '敬老の日（休園）',
    type: '休園',
  },
  {
    id: 'e6',
    facilityId: 'f1',
    date: '2026-09-12',
    title: '避難訓練',
    type: '行事',
    time: '10:00',
  },
]
