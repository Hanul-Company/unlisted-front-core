import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
        return NextResponse.json({ error: 'videoId is required' }, { status: 400 });
    }

    try {
        const secretsPath = path.join(process.cwd(), 'secrets', 'client_secrets.json');
        const tokenPath1 = path.join(process.cwd(), 'secrets', 'token.json');
        const tokenPath2 = path.join(process.cwd(), 'secrets', 'tokens.json');

        const tokenPath = fs.existsSync(tokenPath1) ? tokenPath1 : tokenPath2;

        if (!fs.existsSync(secretsPath) || !fs.existsSync(tokenPath)) {
            return NextResponse.json({ error: 'YouTube credentials not found. Please add client_secrets.json and token.json (or tokens.json) to the secrets folder.' }, { status: 500 });
        }

        const secretsContent = fs.readFileSync(secretsPath, 'utf-8');
        const tokenContent = fs.readFileSync(tokenPath, 'utf-8');

        const credentials = JSON.parse(secretsContent);
        const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
        
        const oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
        const tokens = JSON.parse(tokenContent);
        oauth2Client.setCredentials(tokens);

        const youtubeAnalytics = google.youtubeAnalytics({
            version: 'v2',
            auth: oauth2Client
        });

        // 1. YouTube Data API (v3) to get TOTAL current views and EXACT published date
        const youtubeData = google.youtube({
            version: 'v3',
            auth: oauth2Client
        });

        let totalViews = 0;
        let publishedAtStr = '2024-01-01T00:00:00Z'; // fallback
        try {
            const stats = await youtubeData.videos.list({
                part: ['statistics', 'snippet'],
                id: [videoId]
            });
            if (stats.data.items && stats.data.items.length > 0) {
                totalViews = parseInt(stats.data.items[0].statistics?.viewCount || '0', 10);
                publishedAtStr = stats.data.items[0].snippet?.publishedAt || publishedAtStr;
            }
        } catch (e) {
            console.error("Failed to get total video stats:", e);
        }

        // Calculate startDate and endDate
        const endDateObj = new Date();
        const endDate = endDateObj.toISOString().split('T')[0];
        
        // Start date is the day the video was published on YouTube
        const startDateObj = new Date(publishedAtStr);
        const startDate = startDateObj.toISOString().split('T')[0];

        // 2. Query Analytics API for the entire lifetime
        let response;
        try {
            response = await youtubeAnalytics.reports.query({
                ids: 'channel==MINE',
                startDate: startDate,
                endDate: endDate,
                metrics: 'views',
                dimensions: 'day',
                filters: `video==${videoId}`
            });
        } catch(e) {
             console.error('Analytics query error. Falling back to empty array.', e);
             response = { data: { rows: [] } };
        }

        // rows format is [ ['YYYY-MM-DD', 150], ... ]
        const rows = response.data.rows || [];
        
        // --- Date Padding Logic: Create a complete timeline from startDate to endDate ---
        // Put the fetched rows into a map Object for quick lookup { 'YYYY-MM-DD': views }
        const viewsMap: Record<string, number> = {};
        rows.forEach((row: any) => {
            viewsMap[row[0]] = parseInt(row[1], 10);
        });

        const dailyViews: number[] = [];
        const dateLabels: string[] = []; // (Optional) for labels
        
        // Iterate through every single day from Start to End
        let currentIterDate = new Date(startDate);
        endDateObj.setHours(23, 59, 59, 999); // ensure loop hits today
        
        while (currentIterDate <= endDateObj) {
            const dateStr = currentIterDate.toISOString().split('T')[0];
            const viewsForDay = viewsMap[dateStr] || 0; // If API returned no data for this day, it means 0 views
            
            dailyViews.push(viewsForDay);
            dateLabels.push(dateStr);
            
            // Increment by 1 day
            currentIterDate.setDate(currentIterDate.getDate() + 1);
        }

        // --- Calculate Cumulative ---
        const sumDaily = dailyViews.reduce((a: number, b: number) => a + b, 0);
        
        // Find discrepancy between realtime data (totalViews) and Analytics (sumDaily)
        const diff = Math.max(0, totalViews - sumDaily);
        
        // Add discrepancy to the last item of dailyViews to make the area under curve exactly match totalViews
        if (dailyViews.length > 0) {
            dailyViews[dailyViews.length - 1] += diff;
        }

        const cumulativeViews: number[] = [];
        let currentTotal = 0;
        for (let i = 0; i < dailyViews.length; i++) {
            currentTotal += dailyViews[i];
            cumulativeViews.push(currentTotal);
        }
        
        // Fallback if loop was completely empty (e.g. video published today)
        if (cumulativeViews.length === 0) {
            cumulativeViews.push(totalViews);
            dailyViews.push(totalViews);
            dateLabels.push(startDate);
        }

        return NextResponse.json({ 
            cumulativeViews: cumulativeViews,
            dailyViews: dailyViews,
            dateLabels: dateLabels, // Sending date labels back for the frontend
            totalViews: totalViews
        });

    } catch (error: any) {
        console.error('Analytics API Error:', error.message || error);
        return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
    }
}
