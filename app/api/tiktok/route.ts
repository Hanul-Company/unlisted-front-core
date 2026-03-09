import { NextResponse } from 'next/server';

/**
 * TikTok Video Stats API (oEmbed endpoint - no auth needed)
 * Returns view_count from TikTok's public oEmbed API.
 * 
 * NOTE: TikTok oEmbed only gives CURRENT total views, not daily history.
 * For daily analytics you'd need TikTok Business API with tokens.
 * For now we return a single total view count and let the frontend handle it.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const tiktokId = searchParams.get('tiktokId')?.trim();
    const tiktokUrl = searchParams.get('tiktokUrl')?.trim();

    if (!tiktokId && !tiktokUrl) {
        return NextResponse.json({ error: 'tiktokId or tiktokUrl is required' }, { status: 400 });
    }

    try {
        // Build the video URL for lookups
        const videoUrl = tiktokUrl || `https://www.tiktok.com/@user/video/${tiktokId}`;
        
        // TikTok's official oEmbed no longer returns view counts publicly. 
        // We use a free third-party API (tikwm.com) to get basic video stats.
        const tikwmRes = await fetch(
            `https://www.tikwm.com/api/?url=${encodeURIComponent(videoUrl)}`,
            { cache: 'no-store' } // Avoid caching stale data or 0s
        );

        if (!tikwmRes.ok) {
            return NextResponse.json({ error: 'TikTok API request failed', totalViews: 0 }, { status: 200 });
        }

        const tikwmData = await tikwmRes.json();
        
        let totalViews = 0;
        let title = '';
        let thumbnailUrl = '';

        if (tikwmData.code === 0 && tikwmData.data) {
            totalViews = tikwmData.data.play_count || 0;
            title = tikwmData.data.title || '';
            thumbnailUrl = tikwmData.data.cover || '';
        } else {
             console.error('tikwm API returned error or no data:', tikwmData);
        }

        return NextResponse.json({
            totalViews,
            title,
            thumbnailUrl,
            // Since TikTok doesn't provide daily analytics publicly,
            // return empty arrays. The frontend will handle gracefully.
            dailyViews: [],
            cumulativeViews: totalViews > 0 ? [totalViews] : [],
            dateLabels: totalViews > 0 ? [new Date().toISOString().split('T')[0]] : [],
        });

    } catch (error: any) {
        console.error('TikTok API Error:', error.message || error);
        return NextResponse.json({ 
            error: 'Failed to fetch TikTok data',
            totalViews: 0,
            dailyViews: [],
            cumulativeViews: [],
            dateLabels: [],
        }, { status: 200 }); // Return 200 with empty data so frontend doesn't break
    }
}
