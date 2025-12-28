// 아까 배포 로그에서 'UnlistedStock deployed at:' 뒤에 나온 주소
export const UNLISTED_STOCK_ADDRESS = "0x4aB47f55625FF383b5b3dC01131eC0A97Deff298"; 
export const MELODY_TOKEN_ADDRESS = "0x7D6b411E5f8BB7ab24559262F296931eedF3f04d";
export const MELODY_IP_ADDRESS = "0xeC83eaCF9796a3bD5A1Caaa53bA6ED19989087C1"

// 2. ABI (컨트랙트 사용 설명서)
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
    "name": "sellShares",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
    "name": "claimRewards", // [New] 배당금 수령
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
    "name": "claimJackpot", // [New] 잭팟 수령
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }, { "internalType": "uint256", "name": "amount", "type": "uint256" }],
    "name": "depositRentalRevenue", // [New] 렌탈 수익 입금
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }, { "internalType": "address", "name": "user", "type": "address" }],
    "name": "getPendingReward", // [New] 배당금 조회
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
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
    "name": "getSellPrice",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }, { "internalType": "address", "name": "", "type": "address" }],
    "name": "sharesBalance",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "name": "stocks",
    "outputs": [
      { "internalType": "uint256", "name": "totalShares", "type": "uint256" },
      { "internalType": "uint256", "name": "poolBalance", "type": "uint256" },
      { "internalType": "uint256", "name": "jackpotBalance", "type": "uint256" },
      { "internalType": "uint256", "name": "expiryTime", "type": "uint256" },
      { "internalType": "address", "name": "lastBuyer", "type": "address" },
      { "internalType": "bool", "name": "isJackpotClaimed", "type": "bool" },
      { "internalType": "uint256", "name": "accRewardPerShare", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// 4. [추가됨] Melody 토큰(ERC20) ABI - 승인(Approve)과 발행(Mint)용
export const MELODY_TOKEN_ABI = [
  // --- 기존 함수들 ---
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
  },
  
  // --- ✅ [추가됨] 에러 정의 (ERC20 Standard Errors) ---
  {
    "inputs": [
      { "internalType": "address", "name": "sender", "type": "address" },
      { "internalType": "uint256", "name": "balance", "type": "uint256" },
      { "internalType": "uint256", "name": "needed", "type": "uint256" }
    ],
    "name": "ERC20InsufficientBalance",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "spender", "type": "address" },
      { "internalType": "uint256", "name": "allowance", "type": "uint256" },
      { "internalType": "uint256", "name": "needed", "type": "uint256" }
    ],
    "name": "ERC20InsufficientAllowance",
    "type": "error"
  },
  {
    "inputs": [{ "internalType": "address", "name": "approver", "type": "address" }],
    "name": "ERC20InvalidApprover",
    "type": "error"
  },
  {
    "inputs": [{ "internalType": "address", "name": "receiver", "type": "address" }],
    "name": "ERC20InvalidReceiver",
    "type": "error"
  },
  {
    "inputs": [{ "internalType": "address", "name": "sender", "type": "address" }],
    "name": "ERC20InvalidSender",
    "type": "error"
  },
  {
    "inputs": [{ "internalType": "address", "name": "spender", "type": "address" }],
    "name": "ERC20InvalidSpender",
    "type": "error"
  }
] as const;

export const MELODY_IP_ABI = [
  // ... (기존 표준 ERC1155 함수들은 생략하거나 유지) ...
  {
    "inputs": [
      { "internalType": "string", "name": "_melodyHash", "type": "string" },
      { "internalType": "address[]", "name": "_payees", "type": "address[]" },
      { "internalType": "uint256[]", "name": "_shares", "type": "uint256[]" },
      { "internalType": "uint96", "name": "_royaltyBasis", "type": "uint96" },
      { "internalType": "bool", "name": "_derivativeAllowed", "type": "bool" },
      { "internalType": "string", "name": "_metadataURI", "type": "string" },
      { "internalType": "uint96", "name": "_investorShare", "type": "uint96" } // [New] 추가됨
    ],
    "name": "registerMusic",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_id", "type": "uint256" }],
    "name": "getInvestorShare", // [New] 조회용
    "outputs": [{ "internalType": "uint96", "name": "", "type": "uint96" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_id", "type": "uint256" }],
    "name": "getPayees",
    "outputs": [{ "internalType": "address[]", "name": "", "type": "address[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "_id", "type": "uint256" }],
    "name": "getShares",
    "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
     "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
     "name": "tracks", // 구조체가 바뀌었으므로 출력도 바뀜
     "outputs": [
       { "internalType": "string", "name": "melodyHash", "type": "string" },
       { "internalType": "uint96", "name": "royaltyBasis", "type": "uint96" },
       { "internalType": "bool", "name": "derivativeAllowed", "type": "bool" },
       { "internalType": "string", "name": "metadataURI", "type": "string" },
       { "internalType": "string", "name": "algoVersion", "type": "string" },
       { "internalType": "uint96", "name": "investorShare", "type": "uint96" }
     ],
     "stateMutability": "view",
     "type": "function"
  }
] as const;

export const MUSIC_GENRES = [
  // Basic
  'Pop', 'Hip-Hop', 'R&B', 'Electronic', 'Rock', 'Jazz', 'Lo-Fi', 'Classical', 'Ambient',
  // Billboard & Trendy (Added from Seed)
  'Modern Pop', 'Synthwave', 'Future Bass', 'Trap Soul', 'Alternative R&B',
  'K-Pop', 'Pop Rock', 'Disco Pop', 'Deep House', 'Afrobeat', 'Hyperpop'
];

export const MUSIC_MOODS = [
  // Basic
  'Happy', 'Chill', 'Sad', 'Energetic', 'Focus', 'Romantic', 'Dark', 'Dreamy',
  // Added from Seed
  'Sexy', 'Groovy'
  // Note: 'Melancholic' will be mapped to 'Sad'
];

export const MUSIC_TAGS = [
  // --- Situational / Functional (Basic) ---
  "coding", "focus", "study", "reading", "writing", "work", "productivity",
  "workout", "gym", "training", "running", "yoga", "meditation", "sleep", "relax",
  "drive", "travel", "commute", "party", "dance", "club", "gaming", "parenting",
  "morning", "afternoon", "evening", "night", "dawn", "sunset", "midnight",
  "weekday", "weekend", "city", "subway", "cafe", "lounge", "bedroom", "home",
  "office", "beach", "roadtrip", "rooftop", "rainy", "afterrain", "summer",

  // --- Vibe & Quality (Added from Seed) ---
  "Chart topping", "Radio ready", "Viral hit", "Billboard top 100",
  "High fidelity", "Modern mix", "Catchy hook", "Heavy bass",
  "Club banger", "Summer vibe", "Late night drive", "TikTok viral",
  "Mainstream appeal", "Dynamic production",

  // --- Vocal Styles (Added from Seed) ---
  "Female Vocals", "Male Vocals",
  "Airy", "Breathy", "Emotional", "Narrative", // Taylor style
  "Gritty", "Raspy", "Vibrato", // Post Malone style
  "Soulful", "Powerful", "Diva", "Belting", // Beyonce style
  "Falsetto", "Smooth", "High-register", // The Weeknd style
  "Bright", "Polished", "Trendy", "Youthful", "Clean" // K-Pop style
];

// (Scenario List Keep or Update as needed - 기존 유지)
export const MUSIC_SCENARIOS = [
  { id: 'coding', emoji: '💻', title: 'Deep Focus Coding', tags: ['coding', 'focus', 'electronic'] },
  { id: 'workout', emoji: '💪', title: 'High Intensity Workout', tags: ['workout', 'gym', 'phonk'] },
  { id: 'drive', emoji: '🚗', title: 'Night City Drive', tags: ['drive', 'night', 'synthwave'] },
  { id: 'cafe', emoji: '☕', title: 'Sunday Morning Cafe', tags: ['cafe', 'morning', 'acoustic'] },
  { id: 'lounge', emoji: '🏖️', title: 'Luxury Lounge', tags: ['lounge', 'house', 'luxury'] },
  { id: 'sleep', emoji: '😴', title: 'Deep Sleep', tags: ['sleep', 'ambient', 'calm'] },
];