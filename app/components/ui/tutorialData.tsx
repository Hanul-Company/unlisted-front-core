import { TrendingUp, Coins, Trophy, Users } from 'lucide-react';
import { SlideData } from './InfoModal'; // 경로에 맞게 수정

export const INVEST_GUIDE_DATA: SlideData[] = [
    {
        id: 0,
        icon: <Users size={40} className="text-cyan-400" />,
        title: {
            ko: "팬이 주주가 되는 세상",
            en: "Fans Become Shareholders"
        },
        desc: {
            ko: "좋아하는 아티스트의 곡에 투자하고\n공동 주인이 되어보세요.\n단순한 후원을 넘어선 진정한 파트너십입니다.",
            en: "Invest in your favorite artist's tracks\nand become a co-owner.\nIt's more than support, it's a partnership."
        }
    },
    {
        id: 1,
        icon: <Coins size={40} className="text-yellow-400" />,
        title: {
            ko: "저작권료와 거래 수수료",
            en: "Earn Royalties & Fees"
        },
        desc: {
            ko: "내가 투자한 곡이 재생되거나 거래될 때마다\n지분에 비례하여 수익을 분배받습니다.\n곡의 인기가 오를수록 내 수익도 커집니다.",
            en: "Earn a share of revenue whenever\nthe track is played or traded.\nAs popularity grows, so does your income."
        }
    },
    {
        id: 2,
        icon: <TrendingUp size={40} className="text-green-400" />,
        title: {
            ko: "가치 상승과 시세 차익",
            en: "Capital Appreciation"
        },
        desc: {
            ko: "초기에 저렴하게 투자하고,\n가치가 올랐을 때 지분을 판매하여\n시세 차익을 남길 수 있습니다.",
            en: "Invest early at a low price,\nand sell your shares when the value goes up\nto make a profit."
        }
    },
    {
        id: 3,
        icon: <Trophy size={40} className="text-purple-400" />,
        title: {
            ko: "최고의 투자자가 되세요",
            en: "Become a Top Investor"
        },
        desc: {
            ko: "성공적인 투자로 랭킹을 올리고\n커뮤니티에서 명성을 얻으세요.\n숨겨진 명곡을 발굴하는 즐거움이 기다립니다!",
            en: "Climb the leaderboard with successful investments.\nDiscover hidden gems and\nenjoy the thrill of the market!"
        }
    }
];