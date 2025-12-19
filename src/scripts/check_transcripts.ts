
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
    try {
        console.log("🔍 Checking CallLog table for transcripts...");

        // Check total count
        const totalCount = await prisma.callLog.count();
        console.log(`📊 Total CallLogs: ${totalCount}`);

        // Check logs with recordings but no transcripts
        const withRecordings = await prisma.callLog.count({
            where: { recordingUrl: { not: null } }
        });
        console.log(`⏺️ CallLogs with recording URLs: ${withRecordings}`);

        // Check logs with transcripts
        const transcriptsCount = await prisma.callLog.count({
            where: { transcript: { not: null } }
        });
        console.log(`📝 CallLogs with transcripts: ${transcriptsCount}`);
        const withTranscripts = await prisma.callLog.findMany({
            where: {
                transcript: {
                    not: null
                }
            },
            select: {
                id: true,
                customerId: true,
                callSid: true,
                transcript: true
            },
            take: 5
        });

        console.log(`📝 Logs with transcripts found: ${withTranscripts.length}`);

        withTranscripts.forEach(log => {
            console.log(`--- Log ID: ${log.id} (Customer ID: ${log.customerId}) ---`);
            console.log(`Call SID: ${log.callSid}`);
            console.log(`Transcript Snippet: ${log.transcript?.substring(0, 100)}...`);
            console.log(`Sentiment: ${(log as any).sentimentAnalysis} (Score: ${(log as any).sentimentScore})`);
        });

        if (withTranscripts.length === 0) {
            console.log("⚠️ No transcripts found in the database yet.");
        }

    } catch (error) {
        console.error("❌ Error checking database:", error);
    } finally {
        await prisma.$disconnect();
    }
}

check();
