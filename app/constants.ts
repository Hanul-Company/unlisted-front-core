// 아까 배포 로그에서 'UnlistedStock deployed at:' 뒤에 나온 주소
export const UNLISTED_STOCK_ADDRESS = "0x3e8627C1407Cbc043Cb052B9DbaF12c72000eBfD"; 
export const MELODY_TOKEN_ADDRESS = "0x6686Ae3D8e5d0A708F4a1C0ff1194d2a38af1d7b";
export const MELODY_IP_ADDRESS = "0x9dB55f94c3D2EEC0eAcc6911B4Ef845F7638B21e"

// 2. ABI (컨트랙트 사용 설명서)
// 우리가 만든 UnlistedStock.sol의 핵심 함수들입니다.
export const UNLISTED_STOCK_ABI = [
  {
    "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }],
    "name": "buyShares",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }],
    "name": "sellShares", // [추가] 매도 함수
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }],
    "name": "getBuyPrice",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }],
    "name": "getSellPrice", // [추가] 매도 가격 조회
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }, { "internalType": "address", "name": "", "type": "address" }],
    "name": "sharesBalance", // [추가] 내 지분 조회
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "name": "stocks",
    "outputs": [
      { "internalType": "uint256", "name": "totalShares", "type": "uint256" },
      { "internalType": "uint256", "name": "poolBalance", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
] as const;

// 4. [추가됨] Melody 토큰(ERC20) ABI - 승인(Approve)과 발행(Mint)용
export const MELODY_TOKEN_ABI = [
  {
    "inputs": [{ "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }],
    "name": "approve",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "address", "name": "spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }],
    "name": "mint",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }],
    "name": "transfer",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export const MELODY_IP_ABI = [
  {
    "inputs": [
      { "internalType": "string", "name": "_melodyHash", "type": "string" },
      { "internalType": "address[]", "name": "_payees", "type": "address[]" }, // 추가됨
      { "internalType": "uint256[]", "name": "_shares", "type": "uint256[]" }, // 추가됨
      { "internalType": "uint96", "name": "_royaltyBasis", "type": "uint96" },
      { "internalType": "bool", "name": "_derivativeAllowed", "type": "bool" },
      { "internalType": "string", "name": "_metadataURI", "type": "string" }
    ],
    "name": "registerMusic",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

export const MUSIC_GENRES = [
  // Pop & K
  "Pop",
  "K-Pop",
  "K-Hip Hop",
  "R&B",

  // Hip-hop / Chill
  "Hip-hop",
  "Trap",
  "Lo-fi",

  // Rock / Band
  "Rock",
  "Indie Rock",

  // Electronic / Dance
  "EDM",
  "House",
  "Future Bass",

  // Jazz / Acoustic / Film
  "Jazz",
  "Acoustic",
  "Singer-Songwriter",
  "Cinematic",

  // 기타
  "City Pop",
];
export const MUSIC_MOODS = [
  // 기본 무드
  "Happy",
  "Chill",
  "Sad",
  "Romantic",
  "Energetic",
  "Dark",

  // 감정 디테일
  "Melancholic",
  "Uplifting",
  "Dreamy",
  "Nostalgic",

  // 상황 / 용도
  "Focus",
  "Study",
  "Party",
  "Late Night",
  "Groovy",
];

// ✅ [추가] 킬러 시나리오 매트릭스
export const MUSIC_SCENARIOS = [
  { id: 'coding', emoji: '💻', title: 'Deep Focus', tags: ['coding', 'focus', 'lofi'] },
  { id: 'workout', emoji: '💪', title: 'Beast Mode', tags: ['workout', 'gym', 'phonk'] },
  { id: 'drive', emoji: '🌃', title: 'Night Drive', tags: ['drive', 'synthwave', 'night'] },
  { id: 'healing', emoji: '🍂', title: 'Healing', tags: ['healing', 'ballad', 'emotional'] },
  { id: 'cafe', emoji: '☕', title: 'Trendy Cafe', tags: ['cafe', 'rnb', 'groove'] },
  { id: 'retro', emoji: '📻', title: '2000s Vibes', tags: ['nostalgia', 'retro', 'acoustic'] },
  { id: 'romantic', emoji: '🍷', title: 'Red Light', tags: ['romantic', 'slowjam', 'sexy'] },
  { id: 'morning', emoji: '☀️', title: 'Miracle Morning', tags: ['morning', 'acoustic', 'fresh'] },
  { id: 'lounge', emoji: '🏖️', title: 'Luxury Lounge', tags: ['lounge', 'house', 'luxury'] },
  { id: 'sleep', emoji: '😴', title: 'Deep Sleep', tags: ['sleep', 'ambient', 'calm'] },
];

export const MUSIC_TAGS = [
  "coding", "focus", "study", "reading", "writing", "work", "productivity",
  "workout", "gym", "training", "running", "yoga", "meditation", "sleep", "relax",
  "drive", "travel", "commute", "party", "dance", "club", "gaming", "parenting",
  "morning", "afternoon", "evening", "night", "dawn", "sunset", "midnight",
  "weekday", "weekend", "city", "subway", "cafe", "lounge", "bedroom", "home",
  "office", "beach", "roadtrip", "rooftop", "rainy", "afterrain",
  "lofi", "acoustic", "ambient", "electronic", "synthwave", "house", "techno",
  "trap", "phonk", "rnb", "hiphop", "jazz", "jazzhiphop", "ballad", "slowjam",
  "indie", "pop", "citypop", "retro", "vinyl", "analog", "reverb", "distortion",
  "minimal", "orchestral", "japanese", "jpop", "anime", "shibuya", "uk",
  "britpop", "grime", "french", "latin", "korean", "kpop", "focusflow", "energy",
  "groove", "chill", "calm", "healing", "comfort", "emotional", "sentimental",
  "nostalgia", "dreamy", "romantic", "sexy", "sensual", "happy", "uplifting",
  "fresh", "hype", "dark", "moody", "gloomy", "melancholic", "rainvibes",
  "luxury", "trendy", "couple", "love", "breakup", "selfcare", "mindfulness",
  "latevibes", "nightdrive", "urban", "smooth", "warm", "cool"
];