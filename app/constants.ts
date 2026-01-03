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

  // Billboard & Trendy
  'Modern Pop', 'Synthwave', 'Future Bass', 'Trap Soul', 'Alternative R&B',
  'K-Pop', 'Pop Rock', 'Disco Pop', 'Deep House', 'Afrobeat', 'Hyperpop',

  // Expanded: Pop / Modern Pop / Hyperpop related
  'Indie Pop', 'Electro Pop', 'Dance Pop', 'Teen Pop', 'Adult Contemporary',
  'Pop Rap', 'Pop Soul', 'Bedroom Pop', 'Art Pop', 'Alt Pop', 'Dream Pop',
  'Bubblegum Pop', 'Power Pop', 'Sad Pop', 'Anthem Pop', 'Festival Pop',
  'PC Music', 'Digicore', 'Glitch Pop',

  // Expanded: Hip-Hop related
  'Boom Bap', 'East Coast Hip-Hop', 'West Coast Hip-Hop', 'Southern Hip-Hop',
  'Trap', 'Drill', 'UK Drill', 'Jersey Club Rap', 'Cloud Rap', 'Emo Rap',
  'Melodic Rap', 'Conscious Hip-Hop', 'Hardcore Hip-Hop', 'G-Funk',
  'Experimental Hip-Hop', 'Alternative Hip-Hop',

  // Expanded: R&B / Alternative R&B / Trap Soul related
  'Contemporary R&B', 'Neo-Soul', 'Soul', 'Funk', 'Quiet Storm',
  'Progressive R&B', 'Electro R&B', 'RnBass', 'PBR&B',

  // Expanded: Electronic / House / Future Bass / Synthwave related
  'EDM', 'Electro House', 'Progressive House', 'Tech House', 'Bass House',
  'Tropical House', 'Future House', 'Slap House', 'G-House',
  'Techno', 'Melodic Techno', 'Minimal Techno',
  'Trance', 'Progressive Trance', 'Psytrance',
  'Dubstep', 'Melodic Dubstep', 'Brostep',
  'Drum & Bass', 'Liquid DnB', 'Jungle', 'Breakbeat',
  'Garage', 'UK Garage', 'Future Garage',
  'Electro', 'IDM', 'Glitch', 'Chillwave', 'Vaporwave', 'Retrowave',

  // Expanded: Rock / Pop Rock related
  'Alternative Rock', 'Indie Rock', 'Post-Punk', 'Punk Rock', 'Pop Punk',
  'Hard Rock', 'Garage Rock', 'Post-Rock', 'Shoegaze', 'Grunge',
  'Emo', 'Metal', 'Indie Folk',

  // Expanded: Jazz related
  'Smooth Jazz', 'Bebop', 'Hard Bop', 'Cool Jazz', 'Fusion',
  'Jazz Funk', 'Jazz Hop', 'Bossa Nova', 'Swing',

  // Expanded: Lo-Fi / Chill / Study related
  'Lo-Fi Hip-Hop', 'Chillhop', 'Study Beats', 'Chillout', 'Downtempo',
  'Trip-Hop', 'Instrumental Hip-Hop',

  // Expanded: Classical / Cinematic / Orchestral related
  'Orchestral', 'Cinematic', 'Film Score', 'Neo-Classical', 'Contemporary Classical',
  'Chamber Music', 'Piano Solo', 'String Quartet',

  // Expanded: Ambient related
  'Ambient Pop', 'Dark Ambient', 'Drone', 'Space Ambient', 'Meditation',
  'Soundscape', 'New Age',

  // Expanded: K-Pop / Global Pop ecosystems
  'K-R&B', 'K-Hip-Hop', 'J-Pop', 'City Pop', 'Latin Pop',

  // Expanded: Afrobeat related
  'Afrobeats', 'Afro Pop', 'Amapiano', 'Afro House', 'Dancehall',

  // Extra: widely used modern tags
  'House', 'Electropop', 'Synth Pop', 'Indietronica', 'Chill R&B'
];

// [Optional] Genre Normalization Map (Sub-genre -> Parent Genre)
// GPT 분석 후 저장 시, 또는 추천 알고리즘에서 가중치 계산 시 사용
export const GENRE_MAPPING: Record<string, string> = {
  'Trap': 'Hip-Hop', 'Drill': 'Hip-Hop', 'Boom Bap': 'Hip-Hop',
  'Electro Pop': 'Pop', 'Indie Pop': 'Pop', 'K-Pop': 'Pop',
  'Deep House': 'Electronic', 'Techno': 'Electronic', 'Dubstep': 'Electronic', 'EDM': 'Electronic',
  'Alternative Rock': 'Rock', 'Indie Rock': 'Rock',
  'Neo-Soul': 'R&B', 'Trap Soul': 'R&B',
  'Lo-Fi Hip-Hop': 'Lo-Fi', 'Chillhop': 'Lo-Fi',
  'Afrobeats': 'Afrobeat', 'Amapiano': 'Afrobeat'
};


// ==============================================================================
// 2. MUSIC MOODS (Expanded)
// ==============================================================================
export const MUSIC_MOODS = [
  // Basic
  'Happy', 'Chill', 'Sad', 'Energetic', 'Focus', 'Romantic', 'Dark', 'Dreamy',

  // Added from Seed
  'Sexy', 'Groovy',

  // Expanded: Happy
  'Joyful', 'Uplifting', 'Playful', 'Cheerful', 'Bright', 'Carefree',
  'Optimistic', 'Hopeful', 'Feel-Good', 'Bubbly', 'Sunny', 'Fun',

  // Expanded: Chill
  'Calm', 'Relaxed', 'Laid-Back', 'Smooth', 'Warm', 'Cozy',
  'Mellow', 'Easygoing', 'Gentle', 'Peaceful', 'Soothing', 'Comforting',

  // Expanded: Sad
  'Melancholic', 'Heartbroken', 'Emotional', 'Bittersweet', 'Lonely',
  'Wistful', 'Somber', 'Blue', 'Crying', 'Regretful', 'Nostalgic',

  // Expanded: Energetic
  'Hype', 'High Energy', 'Intense', 'Powerful', 'Explosive', 'Driving',
  'Up-Tempo', 'Fast-Paced', 'Adrenaline', 'Aggressive', 'Punchy',

  // Expanded: Focus
  'Concentration', 'Study', 'Work', 'Deep Focus', 'Minimal',
  'Steady', 'Non-Distracting', 'Flow State', 'Productive', 'Analytical',

  // Expanded: Romantic
  'Love', 'Tender', 'Sweet', 'Sentimental', 'Intimate',
  'Passionate', 'Soft', 'Candlelit', 'Date Night', 'Warmhearted',

  // Expanded: Dark
  'Moody', 'Gritty', 'Mysterious', 'Eerie', 'Sinister',
  'Tense', 'Brooding', 'Menacing', 'Haunting', 'Noir', 'Dystopian',

  // Expanded: Dreamy
  'Ethereal', 'Floating', 'Airy', 'Surreal', 'Cosmic',
  'Ambient Dream', 'Hazy', 'Lush', 'Shimmering', 'Celestial',

  // Expanded: Sexy
  'Sultry', 'Sensual', 'Flirty', 'Seductive', 'Alluring',
  'Late Night', 'Hot', 'Smooth Sexy', 'Bedroom', 'Intimate Groove',

  // Expanded: Groovy
  'Funky', 'Bouncy', 'Rhythmic', 'Swinging', 'Danceable',
  'Pocket', 'Feel the Groove', 'Rolling', 'Slinky', 'Upbeat Groove'
];

// [Optional] Mood Normalization Map (Synonym -> Parent Mood)
export const MOOD_MAPPING: Record<string, string> = {
  'Joyful': 'Happy', 'Uplifting': 'Happy', 'Cheerful': 'Happy',
  'Calm': 'Chill', 'Relaxed': 'Chill', 'Mellow': 'Chill',
  'Melancholic': 'Sad', 'Heartbroken': 'Sad', 'Lonely': 'Sad',
  'Hype': 'Energetic', 'Intense': 'Energetic', 'Powerful': 'Energetic',
  'Concentration': 'Focus', 'Study': 'Focus', 'Deep Focus': 'Focus',
  'Love': 'Romantic', 'Intimate': 'Romantic', 'Passionate': 'Romantic',
  'Moody': 'Dark', 'Eerie': 'Dark', 'Sinister': 'Dark',
  'Ethereal': 'Dreamy', 'Surreal': 'Dreamy', 'Cosmic': 'Dreamy',
  'Sultry': 'Sexy', 'Seductive': 'Sexy',
  'Funky': 'Groovy', 'Bouncy': 'Groovy'
};


// ==============================================================================
// 3. MUSIC TAGS (Expanded Context & Texture)
// ==============================================================================
export const MUSIC_TAGS = [
  // --- Situational / Functional (Basic) ---
  "coding", "focus", "study", "reading", "writing", "work", "productivity",
  "workout", "gym", "training", "running", "yoga", "meditation", "sleep", "relax",
  "drive", "travel", "commute", "party", "dance", "club", "gaming", "parenting",
  "morning", "afternoon", "evening", "night", "dawn", "sunset", "midnight",
  "weekday", "weekend", "city", "subway", "cafe", "lounge", "bedroom", "home",
  "office", "beach", "roadtrip", "rooftop", "rainy", "afterrain", "summer",

  // --- Vibe & Quality ---
  "Chart topping", "Radio ready", "Viral hit", "Billboard top 100",
  "High fidelity", "Modern mix", "Catchy hook", "Heavy bass",
  "Club banger", "Summer vibe", "Late night drive", "TikTok viral",
  "Mainstream appeal", "Dynamic production",

  // --- Vocal Styles ---
  "Female Vocals", "Male Vocals",
  "Airy", "Breathy", "Emotional", "Narrative",
  "Gritty", "Raspy", "Vibrato",
  "Soulful", "Powerful", "Diva", "Belting",
  "Falsetto", "Smooth", "High-register",
  "Bright", "Polished", "Trendy", "Youthful", "Clean",

  // --- Energy / Tempo / Intensity ---
  "low energy", "mid energy", "high energy",
  "slow tempo", "mid tempo", "up-tempo",
  "driving", "punchy", "aggressive", "soft", "gentle",
  "build-up", "drop", "anthemic", "minimal", "maximal",

  // --- Groove / Rhythm feel ---
  "four-on-the-floor", "shuffle", "swing", "syncopated",
  "bounce", "rolling groove", "funk groove", "tight pocket",
  "breakbeat", "half-time", "double-time",

  // --- Production / Sound design ---
  "lo-fi texture", "tape warmth", "vinyl crackle",
  "glossy", "crisp", "dirty", "raw", "gritty mix",
  "wide stereo", "mono vibe", "big reverb", "dry mix",
  "sidechain", "compressed", "open dynamics",
  "glitchy", "distorted", "saturated", "airy top",
  "sub bass", "808", "rumbling low-end",

  // --- Instrumentation & Arrangement ---
  "piano-led", "guitar-led", "synth-led", "string section", "orchestral",
  "acoustic", "electric guitar", "funk guitar", "bass guitar",
  "live drums", "drum machine", "trap hats", "claps", "percussion",
  "brass", "sax", "flute", "pads", "arpeggio", "pluck synth",

  // --- Vocal processing & performance ---
  "autotune", "vocal chops", "vocal stack", "lush harmonies",
  "whispery", "spoken", "rap-sung", "ad-libs", "runs",
  "reverb vocals", "dry vocals", "intimate vocals", "arena vocals",

  // --- Songwriting / Structure ---
  "verse-pre-chorus-chorus", "pre-chorus lift", "big chorus",
  "hook-first", "repetitive mantra", "bridge moment", "breakdown",
  "short form", "long build", "instant hook",

  // --- Era / Reference flavors ---
  "80s", "90s", "00s", "2010s", "2020s",
  "retro", "modern", "futuristic", "classic vibe", "throwback",

  // --- Emotional color ---
  "uplifting", "feel-good", "nostalgic", "bittersweet",
  "moody", "mysterious", "romantic", "sensual",
  "dark noir", "dreamlike", "spacey", "cozy",

  // --- Setting / Aesthetic micro-context ---
  "neon city", "late night", "sunrise", "golden hour",
  "rainy window", "ocean breeze", "road lights", "afterparty",
  "minimal workspace", "coffee shop buzz"
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