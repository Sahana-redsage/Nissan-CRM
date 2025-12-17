
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Debugging Customer 102 ---');
    const customer = await prisma.customer.findUnique({
        where: { id: 102 }
    });
    console.log(`[DEBUG_SCRIPT] ID: ${customer?.id}, Name: ${customer?.customerName}, Phone: ${customer?.phone}, Alt: ${customer?.alternatePhone}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
