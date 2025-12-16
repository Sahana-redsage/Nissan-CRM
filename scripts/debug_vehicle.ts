
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const insightId = 7; // Based on previous logs
    const insight = await prisma.serviceInsight.findUnique({
        where: { id: insightId },
        include: { customer: true },
    });

    if (!insight) {
        console.log('Insight 7 not found');
        return;
    }

    console.log('--- Customer Record ---');
    console.log(`ID: ${insight.customer.id}`);
    console.log(`Name: ${insight.customer.customerName}`);
    console.log(`Vehicle in DB: ${insight.customer.vehicleMake} ${insight.customer.vehicleModel}`);

    console.log('\n--- Insight Record ---');
    console.log(`Insight ID: ${insight.id}`);

    const json = insight.insightsJson as any;
    // Try to find vehicle info in the JSON if it exists, though usually it's in the text summary or prompt
    console.log('Insight JSON:', JSON.stringify(json, null, 2));
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
