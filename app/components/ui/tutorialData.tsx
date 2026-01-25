import { ShieldCheck, UploadCloud, Tags, PieChart, Music, Mic, Sparkles, Disc, Rocket, TrendingUp, Coins, Trophy, Users, LineChart, Zap, Wallet } from 'lucide-react';
import { SlideData } from './InfoModal';

// ✅ [Clean Version] 텍스트 내의 [cite] 태그 완전 제거
export const INVEST_GUIDE_DATA: SlideData[] = [
    {
        id: 0,
        icon: <LineChart size={40} className="text-blue-400" />,
        title: {
            ko: "가격 형성 원리: 본딩 커브",
            en: "Price Mechanics: Bonding Curve",
            ja: "価格形成の原理：ボンディングカーブ",
            zh: "价格形成原理：联合曲线",
            es: "Mecánica de Precios: Curva de Vinculación"
        },
        desc: {
            ko: "이곳의 가격은 사람들이 사면 오르고, 팔면 내리는\n'수학적 알고리즘'에 의해 자동으로 결정됩니다.\n남들보다 일찍 발견하는 것이 핵심입니다.",
            en: "Prices are set by math, not people.\nThe price goes up as people buy and down as they sell.\nThe key is to discover hidden gems early.",
            ja: "価格は人が決めるのではなく、売買に応じて変動する\n「数学的アルゴリズム」によって自動的に決定されます。\n誰よりも早く原石を見つけることが鍵となります。",
            zh: "价格由数学算法自动决定，而非人为设定。\n买的人多价格就涨，卖的人多价格就跌。\n关键在于比别人更早发现隐藏的宝石。",
            es: "Los precios se establecen por matemáticas, no por personas.\nEl precio sube cuando la gente compra y baja cuando vende.\nLa clave es descubrir joyas ocultas temprano."
        }
    },
    {
        id: 1,
        icon: <Coins size={40} className="text-yellow-400" />,
        title: {
            ko: "두 가지 수익 파이프라인",
            en: "Two Revenue Streams",
            ja: "2つの収益パイプライン",
            zh: "两种收益渠道",
            es: "Dos Flujos de Ingresos"
        },
        desc: {
            ko: "1. 트레이딩 보상: 다른 사람들이 이 곡을 \n사고팔 때마다 발생하는 수수료\n2. 저작권료: 스트리밍 실적에 따른 정산금\n보유한 지분(Share)만큼 지갑으로 자동 분배됩니다.",
            en: "1. Trading Fees: Earn whenever others trade.\n2. Royalties: Earn from streaming performance.\nProfits are distributed automatically to your wallet.",
            ja: "1. 取引手数料：他者が売買するたびに発生\n2. 著作権使用料：ストリーミング実績による収益\n保有する持分(Share)に応じてウォレットに自動分配されます。",
            zh: "1. 交易手续费：每当他人交易时产生\n2. 版权税：根据流媒体播放量结算\n收益将根据您持有的份额自动分配到钱包。",
            es: "1. Tarifas de negociación: Gana cuando otros operan.\n2. Regalías: Gana por el rendimiento de streaming.\nLos beneficios se distribuyen automáticamente a su billetera."
        }
    },
    {
        id: 2,
        icon: <Trophy size={40} className="text-purple-400" />,
        title: {
            ko: "잭팟(Jackpot) 시스템",
            en: "The Jackpot System",
            ja: "ジャックポットシステム",
            zh: "大奖(Jackpot)系统",
            es: "El Sistema de Jackpot"
        },
        desc: {
            ko: "눈치 게임의 승자가 되어보세요!\n마지막 매수 이후 일정 시간 동안 거래가 없으면,\n쌓인 적립금의 50%를 '마지막 투자자'가 독식합니다.\n하락장에서도 수익을 낼 수 있는 기회입니다.",
            en: "Winner takes it all!\nIf no trades happen for a set time,\nthe 'Last Buyer' takes 50% of the accumulated pot.",
            ja: "勝者総取りのチャンス！\n一定時間取引がない場合、積立金の50%を\n「最後の購入者」が独占します。\n下落相場でも利益を出せるチャンスです。",
            zh: "赢家通吃！\n如果最后一次购买后一段时间内没有新交易，\n“最后的买家”将独占累积奖金的50%。",
            es: "¡El ganador se lo lleva todo!\nSi no hay operaciones por un tiempo,\nel 'Último Comprador' se lleva el 50% del bote acumulado."
        }
    },
    {
        id: 3,
        icon: <Wallet size={40} className="text-zinc-300" />,
        title: {
            ko: "STEP 1: 지갑 연결 & MLD 준비",
            en: "STEP 1: Prepare MLD Token",
            ja: "STEP 1: ウォレット接続 & MLD準備",
            zh: "第一步：连接钱包 & 准备 MLD",
            es: "PASO 1: Conectar Billetera y Preparar MLD"
        },
        desc: {
            ko: "투자를 위해선 MLD 토큰이 필요합니다.\n지갑을 연결하고 거래소에서 MLD를 충전하세요.\n준비가 되었다면 마켓에서 유망한 곡을 찾아보세요.",
            en: "You need MLD tokens to invest.\nConnect your wallet and top up MLD.\nReady? Find a promising track in the market.",
            ja: "投資にはMLDトークンが必要です。\nウォレットを接続し、取引所でMLDをチャージしてください。\n準備ができたら、マーケットで有望な曲を探しましょう。",
            zh: "你需要 MLD 代币进行投资。\n连接钱包并充值 MLD。\n准备好了吗？在市场上寻找有潜力的歌曲吧。",
            es: "Necesitas tokens MLD para invertir.\nConecta tu billetera y recarga MLD.\n¿Listo? Encuentra una pista prometedora en el mercado."
        }
    },
    {
        id: 4,
        icon: <Zap size={40} className="text-cyan-400" />,
        title: {
            ko: "STEP 2: 매수와 시뮬레이션",
            en: "STEP 2: Buy & Simulate",
            ja: "STEP 2: 購入とシミュレーション",
            zh: "第二步：购买与模拟",
            es: "PASO 2: Comprar y Simular"
        },
        desc: {
            ko: "'Trade' 버튼을 누르고 매수할 수량을 입력하세요.\n우측 패널의 'Profit Simulator'를 통해\n가격 상승 시 나의 예상 수익을 미리 계산해볼 수 있습니다.",
            en: "Click 'Trade' and enter the amount.\nUse the 'Profit Simulator' on the right panel\nto estimate your potential returns.",
            ja: "「Trade」ボタンを押し、購入数量を入力します。\n右パネルの「Profit Simulator」を使って、\n価格上昇時の予想収益を事前に計算できます。",
            zh: "点击“Trade”并输入数量。\n使用右侧面板的“Profit Simulator”\n预估价格上涨时的潜在收益。",
            es: "Haz clic en 'Trade' e ingresa la cantidad.\nUsa el 'Profit Simulator' en el panel derecho\npara estimar tus ganancias potenciales."
        }
    },
    {
        id: 5,
        icon: <TrendingUp size={40} className="text-green-400" />,
        title: {
            ko: "STEP 3: 바이럴 효과 만들기",
            en: "STEP 3: Create Viral Effect",
            ja: "STEP 3: バイラル効果を生み出す",
            zh: "第三步：创造病毒式传播",
            es: "PASO 3: Crear Efecto Viral"
        },
        desc: {
            ko: "이제 곡의 주인이 되었다면, 곡을 여기저기 공유하며 더 많은 재생과, 투자를 유도해보세요.",
            en: "Now that you're the owner, share the track so more people can buy and play it.",
            ja: "曲のオーナーになったら、SNSなどで共有し、\nより多くの再生と投資を呼び込みましょう。",
            zh: "既然成为了歌曲的主人，就到处分享它，\n吸引更多的播放和投资吧。",
            es: "Ahora que eres el dueño, comparte la pista\npara que más gente la compre y la escuche."
        }
    },
    {
        id: 6,
        icon: <TrendingUp size={40} className="text-green-400" />,
        title: {
            ko: "STEP 4: 매도 및 차익 실현",
            en: "STEP 4: Sell & Realize Profit",
            ja: "STEP 4: 売却と利益確定",
            zh: "第四步：出售与获利",
            es: "PASO 4: Vender y Realizar Ganancias"
        },
        desc: {
            ko: "목표 수익률에 도달했나요?\n언제든 즉시 매도하여 현금화할 수 있습니다.\n물론, 평생 보유하며 연금처럼 저작권료를 받아도 됩니다.",
            en: "Reached your target?\nYou can sell instantly to cash out anytime.\nOr, hold forever to earn passive royalties.",
            ja: "目標利益に達しましたか？\nいつでも即座に売却して現金化できます。\nもちろん、永久に保有して著作権収入を得続けることも可能です。",
            zh: "达到目标收益了吗？\n你可以随时出售变现。\n或者，永久持有并像领取养老金一样获得版权税。",
            es: "¿Alcanzaste tu objetivo?\nPuedes vender al instante para retirar efectivo.\nO mantenerla para siempre y ganar regalías pasivas."
        }
    }
];

export const CREATE_GUIDE_DATA: SlideData[] = [
    {
        id: 0,
        icon: <Music size={40} className="text-blue-400" />,
        title: {
            ko: "나만의 음악을 만드는 시작점",
            en: "Start Your Musical Journey",
            ja: "自分だけの音楽制作を始める",
            zh: "开启你的音乐创作之旅",
            es: "Comienza Tu Viaje Musical"
        },
        desc: {
            ko: "원하는 스타일의 레퍼런스 곡을 업로드하거나\n장르와 분위기를 선택해 보세요.\nAI가 당신의 취향을 분석하여 기본 멜로디를 생성합니다.",
            en: "Upload a reference track or select a genre.\nAI analyzes your taste to generate\nthe base melody for your track.",
            ja: "好みのリファレンス曲をアップロードするか、\nジャンルとムードを選択してください。\nAIが好みを分析し、基本メロディを生成します。",
            zh: "上传你喜欢的参考曲目或选择流派。\nAI将分析你的口味，生成基础旋律。",
            es: "Sube una pista de referencia o selecciona un género.\nLa IA analiza tus gustos para generar\nla melodía base de tu pista."
        }
    },
    {
        id: 1,
        icon: <Mic size={40} className="text-purple-400" />,
        title: {
            ko: "가사 입력: 아이디어(Idea) 모드",
            en: "Lyrics: Idea Mode",
            ja: "歌詞入力：アイデア(Idea)モード",
            zh: "歌词输入：灵感(Idea)模式",
            es: "Letras: Modo Idea"
        },
        desc: {
            ko: "작사가 어렵다면 'Idea' 모드를 선택하세요.\n주제나 핵심 키워드 몇 개만 던져주면,\nAI가 나머지 가사를 멋지게 완성해줍니다.",
            en: "Stuck on lyrics? Choose 'Idea' mode.\nJust provide a theme or keywords,\nand AI will write the rest for you.",
            ja: "作詞が難しい場合は「Idea」モードを選んでください。\nテーマやキーワードを入力するだけで、\nAIが残りの歌詞を素敵に仕上げてくれます。",
            zh: "作词太难？选择“Idea”模式。\n只需提供主题或关键词，\nAI会帮你完成剩下的部分。",
            es: "¿Atascado con la letra? Elige el modo 'Idea'.\nSolo proporciona un tema o palabras clave,\ny la IA escribirá el resto por ti."
        }
    },
    {
        id: 2,
        icon: <Sparkles size={40} className="text-yellow-400" />,
        title: {
            ko: "가사 입력: 풀(Full) & 오토 라이트",
            en: "Lyrics: Full & Auto-Write",
            ja: "歌詞入力：フル(Full) & オートライト",
            zh: "歌词输入：完整(Full) & 自动写作",
            es: "Letras: Completo y Escritura Automática"
        },
        desc: {
            ko: "직접 쓴 가사가 있다면 'Full' 모드에 입력하세요.\n'Auto Write' 기능을 켜면 당신의 가사를 바탕으로\n더 나은 라임과 흐름으로 다듬어줄 수도 있습니다.",
            en: "Have your own lyrics? Use 'Full' mode.\nEnable 'Auto Write' to polish your draft\nwith better rhymes and flow.",
            ja: "自作の歌詞がある場合は「Full」モードに入力します。\n「Auto Write」を使えば、あなたの歌詞を元に\n韻やリズムを整えてブラッシュアップできます。",
            zh: "有自己的歌词？使用“Full”模式。\n开启“Auto Write”功能，AI会优化你的草稿，\n让韵脚和流畅度更完美。",
            es: "¿Tienes tu propia letra? Usa el modo 'Completo'.\nActiva 'Auto Write' para pulir tu borrador\ncon mejores rimas y fluidez."
        }
    },
    {
        id: 3,
        icon: <Disc size={40} className="text-green-400" />,
        title: {
            ko: "생성 완료 및 미리듣기",
            en: "Generation & Preview",
            ja: "生成完了とプレビュー",
            zh: "生成完成与预览",
            es: "Generación y Vista Previa"
        },
        desc: {
            ko: "설정이 끝나면 'Generate'를 눌러보세요.\n약 30초 후, 세상에 하나뿐인 당신의 곡이 탄생합니다.\n마음에 들지 않으면 언제든 다시 생성할 수 있습니다.",
            en: "Click 'Generate' and wait regarding 30s.\nYour unique track will be ready.\nNot satisfied? You can always regenerate.",
            ja: "設定が終わったら「Generate」を押してください。\n約30秒で、世界に一つだけの曲が誕生します。\n気に入らなければ何度でも再生成できます。",
            zh: "设置完成后点击“Generate”。\n约30秒后，世上独一无二的歌曲即将诞生。\n如果不满意，随时可以重新生成。",
            es: "Haz clic en 'Generate' y espera unos 30s.\nTu pista única estará lista.\n¿No estás satisfecho? Siempre puedes regenerar."
        }
    },
    {
        id: 4,
        icon: <Rocket size={40} className="text-red-400" />,
        title: {
            ko: "즉시 퍼블리싱 & 수익화",
            en: "Instant Publishing & Monetization",
            ja: "即時パブリッシング & 収益化",
            zh: "即时发布 & 变现",
            es: "Publicación Instantánea y Monetización"
        },
        desc: {
            ko: "완성된 곡은 클릭 한 번으로 NFT로 민팅되어\n'Unlisted 마켓'에 즉시 등록됩니다.\n이제 리스너들의 투자와 스트리밍 수익을 기대해보세요!",
            en: "Mint your track as an NFT with one click.\nIt gets listed on the market immediately.\nStart earning from investments and streams!",
            ja: "完成した曲はワンクリックでNFTとして発行され、\n即座にマーケットに登録されます。\n投資やストリーミング収益が期待できます！",
            zh: "只需点击一次，完成的歌曲就会铸造为NFT，\n并立即在市场上架。\n开始期待投资和流媒体收益吧！",
            es: "Acuña tu pista como NFT con un solo clic.\nSe lista en el mercado de inmediato.\n¡Empieza a ganar con inversiones y streams!"
        }
    }
];

export const UPLOAD_GUIDE_DATA: SlideData[] = [
    {
        id: 0,
        icon: <UploadCloud size={40} className="text-blue-400" />,
        title: {
            ko: "음원 업로드 시작하기",
            en: "Upload Your Master Track",
            ja: "音源アップロードを開始",
            zh: "开始上传音频",
            es: "Subir Tu Pista Maestra"
        },
        desc: {
            ko: "가장 먼저 MP3나 WAV 파일을 올려주세요.\n커버 이미지는 없어도 괜찮아요.\nAI가 앨범 아트를 자동으로 만들어 줄 수도 있거든요!",
            en: "Start by uploading your MP3 or WAV file.\nNo cover art? No problem.\nOur AI can generate one for you!",
            ja: "まずはMP3またはWAVファイルをアップロードしてください。\nカバー画像がなくても大丈夫です。\nAIがアルバムアートを自動生成してくれます！",
            zh: "首先上传 MP3 或 WAV 文件。\n没有封面图也没关系。\nAI 可以为你自动生成专辑封面！",
            es: "Empieza subiendo tu archivo MP3 o WAV.\n¿Sin portada? No hay problema.\n¡Nuestra IA puede generar una para ti!"
        }
    },
    {
        id: 1,
        icon: <Tags size={40} className="text-purple-400" />,
        title: {
            ko: "곡의 DNA 입력하기 (장르/무드)",
            en: "Define Track DNA",
            ja: "曲のDNAを入力 (ジャンル/ムード)",
            zh: "输入歌曲DNA (流派/情绪)",
            es: "Definir el ADN de la Pista"
        },
        desc: {
            ko: "이 곡이 어떤 스타일인지 알려주세요.\nGenres(장르)와 Moods(분위기)를 정확히 선택할수록\n취향이 맞는 리스너들에게 더 잘 추천됩니다.",
            en: "Tell us about your track's style.\nAccurate Genres and Moods help\nour AI recommend your music to the right listeners.",
            ja: "この曲のスタイルを教えてください。\nジャンルとムードを正確に選ぶほど、\n好みの合うリスナーに推薦されやすくなります。",
            zh: "告诉我们要上传歌曲的风格。\n准确选择流派和情绪，\n有助于AI将其推荐给合适的听众。",
            es: "Cuéntanos sobre el estilo de tu pista.\nGéneros y estados de ánimo precisos ayudan\na nuestra IA a recomendar tu música a los oyentes adecuados."
        }
    },
    {
        id: 2,
        icon: <PieChart size={40} className="text-cyan-400" />,
        title: {
            ko: "투자자 지분 설정 (Investor Share)",
            en: "Set Investor Share",
            ja: "投資家シェア設定 (Investor Share)",
            zh: "设定投资者份额 (Investor Share)",
            es: "Configurar Participación del Inversor"
        },
        desc: {
            ko: "이 곡의 미래 수익 중 얼마를 투자자에게 줄지 정하세요.\n비율이 높을수록(Aggressive) 투자를 받기 쉽지만,\n내가 가져가는 몫은 줄어듭니다. (초기 설정: 30% 추천)",
            en: "Decide how much future revenue to share.\nHigher share attracts more investors,\nbut leaves less for you. (30% recommended)",
            ja: "将来の収益のどれだけを投資家に分配するか決めましょう。\n比率が高いほど投資を受けやすくなりますが、\n自分の取り分は減ります。（推奨：30%）",
            zh: "决定将多少未来收益分给投资者。\n比例越高越容易获得投资，\n但保留给自己的份额会减少。（建议初始：30%）",
            es: "Decide cuántos ingresos futuros compartir.\nUna mayor participación atrae a más inversores,\npero deja menos para ti. (30% recomendado)"
        }
    },
    {
        id: 3,
        icon: <Users size={40} className="text-green-400" />,
        title: {
            ko: "팀원 수익 분배 (Revenue Split)",
            en: "Split Revenue with Team",
            ja: "チーム収益分配 (Revenue Split)",
            zh: "团队收益分配 (Revenue Split)",
            es: "Dividir Ingresos con el Equipo"
        },
        desc: {
            ko: "함께 작업한 동료가 있나요?\n지갑 주소를 추가해 수익을 자동으로 나누세요.\n투자자 몫을 제외한 나머지 수익을 우리끼리 나눕니다.",
            en: "Collaborated with others?\nAdd their wallets to split earnings automatically.\nYou share the revenue remaining after the investor cut.",
            ja: "共同作業者はいますか？\nウォレットアドレスを追加して収益を自動分配しましょう。\n投資家分を除いた残りの収益をチームで分け合います。",
            zh: "有合作伙伴吗？\n添加他们的钱包地址以自动分配收益。\n你们将分享扣除投资者份额后的剩余收益。",
            es: "¿Colaboraste con otros?\nAñade sus billeteras para dividir las ganancias automáticamente.\nComparten los ingresos restantes después del corte del inversor."
        }
    },
    {
        id: 4,
        icon: <ShieldCheck size={40} className="text-amber-400" />,
        title: {
            ko: "저작권 보호와 표절 방지 (Song DNA)",
            en: "Copyright Protection & Song DNA",
            ja: "著作権保護と盗作防止 (Song DNA)",
            zh: "版权保护与防剽窃 (Song DNA)",
            es: "Protección de Derechos de Autor y ADN"
        },
        desc: {
            ko: "업로드 즉시 곡의 DNA가 추출되어 블록체인에 박제됩니다.\n'먼저 올린 사람'이 원작자라는 불변의 기록이 남으므로,\n추후 표절 분쟁에서 가장 강력한 권리를 가집니다.",
            en: "Your track's DNA is minted on-chain instantly.\nThis immutable 'First-to-Upload' record proves you are\nthe original creator, protecting you against plagiarism.",
            ja: "アップロードと同時に曲のDNAがブロックチェーンに記録されます。\n「先にアップロードした者」が原作者であるという不変の記録により、\n盗作紛争において強力な権利を持ちます。",
            zh: "上传即提取歌曲DNA并铸造上链。\n这一不可篡改的“首次上传”记录证明你是\n原创者，在未来的剽窃纠纷中拥有最强有力的权利。",
            es: "El ADN de tu pista se acuña en la cadena al instante.\nEste registro inmutable de 'Primero en Subir' prueba que eres\nel creador original, protegiéndote contra el plagio."
        }
    },
    {
        id: 5,
        icon: <Rocket size={40} className="text-red-400" />,
        title: {
            ko: "발매 및 민팅 (Publish & Mint)",
            en: "Publish & Mint",
            ja: "発行とミンティング (Publish & Mint)",
            zh: "发布与铸造 (Publish & Mint)",
            es: "Publicar y Acuñar (Mint)"
        },
        desc: {
            ko: "모든 준비가 끝났다면 'Publish'를 누르세요.\n곡이 블록체인에 등록(Minting)되고 마켓에 리스팅됩니다.\n이제 당신의 음악 자산이 거래되기 시작합니다!",
            en: "Ready? Hit 'Publish'.\nYour track will be minted and listed on the market.\nNow your musical asset is open for trading!",
            ja: "準備ができたら「Publish」を押してください。\n曲がブロックチェーンに登録され、マーケットに並びます。\nあなたの音楽資産の取引が始まります！",
            zh: "准备好了吗？点击“Publish”。\n歌曲将铸造上链并在市场上市。\n现在，你的音乐资产可以开始交易了！",
            es: "¿Listo? Dale a 'Publish'.\nTu pista será acuñada y listada en el mercado.\n¡Ahora tu activo musical está abierto al comercio!"
        }
    }
];