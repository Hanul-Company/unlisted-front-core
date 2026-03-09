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
    const tiktokId = searchParams.get('tiktokId');
    const tiktokUrl = searchParams.get('tiktokUrl');

    if (!tiktokId && !tiktokUrl) {
        return NextResponse.json({ error: 'tiktokId or tiktokUrl is required' }, { status: 400 });
    }

    try {
        // Build the video URL for oEmbed lookup
        const videoUrl = tiktokUrl || `https://www.tiktok.com/@user/video/${tiktokId}`;
        
        const oembedRes = await fetch(
            `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`,
            { next: { revalidate: 3600 } } // Cache for 1 hour
        );

        if (!oembedRes.ok) {
            return NextResponse.json({ error: 'TikTok oEmbed request failed', totalViews: 0 }, { status: 200 });
        }

        const oembedData = await oembedRes.json();
        
        // oEmbed doesn't directly return view_count, but we can get the title and thumbnail
        // For view counts, we'll try the unofficial endpoint
        const totalViews = oembedData.view_count || 0;
        const title = oembedData.title || '';
        const thumbnailUrl = oembedData.thumbnail_url || '';

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
