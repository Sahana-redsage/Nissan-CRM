import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { logger } from '../utils/logger';

export const analyticsController = {
    /**
     * UNIFIED ANALYTICS ENDPOINT
     * Handles Summary, By-Telecaller, By-Customer, and Timeseries views
     * Supports filtering by channel, date range, requestor, etc.
     */
    async getUnifiedAnalytics(req: AuthRequest, res: Response) {
        try {
            const {
                channel = 'all',
                view = 'summary', // summary, by-telecaller, by-customer, timeseries
                telecallerId,
                customerId,
                startDate,
                endDate,
                page = '1',
                limit = '50',
                sortBy = 'date',
                sortOrder = 'desc',
                groupBy = 'day'
            } = req.query;

            // Filter Logic:
            // If telecallerId is provided in query, use it.
            // If NOT provided, we give GLOBAL stats (as per user request "give all people").
            // We do NOT strictly enforce req.telecaller!.id unless specific business logic demands it later.
            const filterTelecallerId = telecallerId ? parseInt(telecallerId as string) : undefined;
            const filterCustomerId = customerId ? parseInt(customerId as string) : undefined;

            // Date filtering helper
            // If no date provided, we default to "all time" or specific logic per view
            const start = startDate ? new Date(startDate as string) : undefined;
            const end = endDate ? new Date(endDate as string) : undefined;

            // Base WHERE clauses for raw queries
            const dateClauseEmail = (col: string) => {
                let clause = '';
                if (start) clause += ` AND to_timestamp("${col}" / 1000.0) >= '${start.toISOString()}'::timestamp`;
                if (end) clause += ` AND to_timestamp("${col}" / 1000.0) <= '${end.toISOString()}'::timestamp`;
                return clause;
            };

            const dateClauseSMS = (col: string) => {
                let clause = '';
                if (start) clause += ` AND "${col}" >= '${start.toISOString()}'::timestamp`;
                if (end) clause += ` AND "${col}" <= '${end.toISOString()}'::timestamp`;
                return clause;
            };

            // Telecaller filter clause
            const telecallerClause = (col: string) => {
                if (filterTelecallerId) return ` AND "${col}" = ${filterTelecallerId}`;
                return '';
            };

            // Customer filter clause
            const customerClause = (col: string) => {
                if (filterCustomerId) return ` AND "${col}" = ${filterCustomerId}`;
                return '';
            };

            let data: any = {};

            if (view === 'summary') {
                // --- SUMMARY VIEW ---
                // Parallel execution for efficiency
    // In the getUnifiedAnalytics method, find the email query and update it to:
    const emailPromise = (channel === 'all' || channel === 'email') ? prisma.$queryRawUnsafe<any[]>(`
    SELECT 
        COUNT(*)::int as "totalSent",
        COUNT(DISTINCT "customer_id")::int as "uniqueCustomers"
    FROM "service_emails"
    WHERE 1=1 
    ${telecallerClause('sent_by')} 
    ${customerClause('customer_id')} 
    ${dateClauseEmail('sent_at')}
    `) : Promise.resolve([]);

                const smsPromise = (channel === 'all' || channel === 'sms') ? prisma.$queryRawUnsafe<any[]>(`
          SELECT 
            COUNT(*)::int as "totalSent",
            COUNT(DISTINCT "customer_id")::int as "uniqueCustomers",
            SUM(CASE WHEN "status" = 'delivered' THEN 1 ELSE 0 END)::int as "delivered",
            SUM(CASE WHEN "status" = 'failed' THEN 1 ELSE 0 END)::int as "failed"
          FROM "sms_messages"
          WHERE 1=1 ${telecallerClause('telecaller_id')} ${customerClause('customer_id')} ${dateClauseSMS('sent_at')}
        `) : Promise.resolve([]);

                const whatsappPromise = (channel === 'all' || channel === 'whatsapp') ? prisma.$queryRawUnsafe<any[]>(`
          SELECT 
            COUNT(*)::int as "totalSent",
            COUNT(DISTINCT "customer_id")::int as "uniqueCustomers",
            SUM(CASE WHEN "status" = 'read' THEN 1 ELSE 0 END)::int as "read"
          FROM "whatsapp_messages"
          WHERE 1=1 ${telecallerClause('telecaller_id')} ${customerClause('customer_id')} ${dateClauseSMS('sent_at')}
        `) : Promise.resolve([]);

                // Source metrics (Open rates)
                // We can aggregate this from SourceMetric table or by checking logs if available.
                // Assuming SourceMetric table is the source of truth for Link Opens.
                const linksPromise = prisma.sourceMetric.findMany({
                    where: {
                        source: channel === 'all' ? undefined : channel as any, // 'email' | 'sms'
                        customerId: filterCustomerId,
                        // Note: sourceMetric doesn't store telecallerId trivially unless we join, 
                        // but for summary we might skip telecaller filter on links OR join customers.
                        // For simplicity in "all people" view, we return all relevant opens.
                    }
                });

                const [emailRes, smsRes, whatsappRes, linksRes] = await Promise.all([emailPromise, smsPromise, whatsappPromise, linksPromise]);

                const emailSummary = emailRes[0] || { totalSent: 0, uniqueCustomers: 0 };
                const smsSummary = smsRes[0] || { totalSent: 0, uniqueCustomers: 0 };
                const whatsappSummary = whatsappRes[0] || { totalSent: 0, uniqueCustomers: 0 };

                // Calculate Link Metrics from SourceMetric result
                const emailOpens = linksRes.filter(l => l.source === 'email').reduce((acc, curr) => acc + curr.openCount, 0);
                const smsOpens = linksRes.filter(l => l.source === 'sms').reduce((acc, curr) => acc + curr.openCount, 0);

                                // Compute channel-aware overall totals
                const overallTotal = channel === 'email' ? emailSummary.totalSent :
                                    channel === 'sms' ? smsSummary.totalSent :
                                    channel === 'whatsapp' ? whatsappSummary.totalSent :
                                    (emailSummary.totalSent || 0) + (smsSummary.totalSent || 0) + (whatsappSummary.totalSent || 0);

                const overallUnique = channel === 'email' ? emailSummary.uniqueCustomers :
                                    channel === 'sms' ? smsSummary.uniqueCustomers :
                                    channel === 'whatsapp' ? whatsappSummary.uniqueCustomers :
                                    (emailSummary.uniqueCustomers || 0) + (smsSummary.uniqueCustomers || 0) + (whatsappSummary.uniqueCustomers || 0);
                // In the summary view section, replace the data assignment with:
                const result: any = {
                    overall: {
                        totalMessages: overallTotal,
                        uniqueCustomers: overallUnique
                    }
                };

                // Only include the selected channel in the response
                if (channel === 'all') {
                    result.email = { ...emailSummary, linkOpens: emailOpens };
                    result.sms = { ...smsSummary, linkOpens: smsOpens };
                    result.whatsapp = whatsappSummary;
                } else if (channel === 'email') {
                    result.email = { ...emailSummary, linkOpens: emailOpens };
                } else if (channel === 'sms') {
                    result.sms = { ...smsSummary, linkOpens: smsOpens };
                } else if (channel === 'whatsapp') {
                    result.whatsapp = whatsappSummary;
                }

                data = result;
            } else if (view === 'by-telecaller') {
                // --- BY TELECALLER VIEW ---
                // Get all telecallers and their stats
                // We'll perform one query per channel grouped by telecaller, then merge in JS. 
                // This avoids complex FULL OUTER JOINs in raw SQL across 3 tables.

                const emailStats = await prisma.$queryRawUnsafe<any[]>(`
          SELECT "sent_by" as "id", COUNT(*)::int as "emailCount", COUNT(DISTINCT "customer_id")::int as "emailUnique"
          FROM "service_emails"
          WHERE 1=1 ${dateClauseEmail('sent_at')}
          GROUP BY "sent_by"
        `);

                const smsStats = await prisma.$queryRawUnsafe<any[]>(`
          SELECT "telecaller_id" as "id", COUNT(*)::int as "smsCount", COUNT(DISTINCT "customer_id")::int as "smsUnique"
          FROM "sms_messages"
          WHERE 1=1 ${dateClauseSMS('sent_at')}
          GROUP BY "telecaller_id"
        `);

                const whatsappStats = await prisma.$queryRawUnsafe<any[]>(`
          SELECT "telecaller_id" as "id", COUNT(*)::int as "waCount", COUNT(DISTINCT "customer_id")::int as "waUnique"
          FROM "whatsapp_messages"
          WHERE 1=1 ${dateClauseSMS('sent_at')}
          GROUP BY "telecaller_id"
        `);

                // Fetch telecaller details
                const telecallers = await prisma.telecaller.findMany({
                    where: filterTelecallerId ? { id: filterTelecallerId } : undefined,
                    select: { id: true, fullName: true, username: true }
                });

                // Merge and filter by channel
                data = telecallers.map(t => {
                    const e = emailStats.find(s => s.id === t.id) || { emailCount: 0, emailUnique: 0 };
                    const s = smsStats.find(s => s.id === t.id) || { smsCount: 0, smsUnique: 0 };
                    const w = whatsappStats.find(s => s.id === t.id) || { waCount: 0, waUnique: 0 };
                    
                    const result: any = {
                        telecallerId: t.id,
                        fullName: t.fullName,
                        username: t.username,
                        totalSent: 0
                    };

                    // Only include selected channel's data
                    if (channel === 'all' || channel === 'email') {
                        result.email = { sent: e.emailCount, unique: e.emailUnique };
                        if (channel === 'email') result.totalSent = e.emailCount;
                    }
                    if (channel === 'all' || channel === 'sms') {
                        result.sms = { sent: s.smsCount, unique: s.smsUnique };
                        if (channel === 'sms') result.totalSent = s.smsCount;
                    }
                    if (channel === 'all' || channel === 'whatsapp') {
                        result.whatsapp = { sent: w.waCount, unique: w.waUnique };
                        if (channel === 'whatsapp') result.totalSent = w.waCount;
                    }
                    
                    // Only calculate total if 'all' channels are selected
                    if (channel === 'all') {
                        result.totalSent = e.emailCount + s.smsCount + w.waCount;
                    }
                    
                    return result;
                });

                // Sort
                if (sortBy === 'count') {
                    data.sort((a: any, b: any) => sortOrder === 'desc' ? b.totalSent - a.totalSent : a.totalSent - b.totalSent);
                }

            } else if (view === 'by-customer') {
                // --- BY CUSTOMER VIEW ---
                // Pagination is required here.
                // We query Customers table and lateral join or subquery counts.
                const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

                // 1. Get filtered / paginated customers
                // Optimizing: If we filter by 'channel', we only want customers who HAVE interactions.
                // But for simplicity/robustness, we usually list all relevant customers.
                // If filterTelecallerId is on, we only want customers attached to that telecaller OR contacted by them.
                // Assuming "contacted by them".

                // Query logic: Select customers who appear in any of the messages tables filtered by telecallerId
                // This is complex. Simplified approach: Get all customers, join counts.
                // If performance issue arises, we optimize.

                // Let's use Prisma to get Customer list first
                const whereInput: any = {};
                if (filterCustomerId) whereInput.id = filterCustomerId;

                // If We need to filter customers strictly by who was contacted by FilterTelecallerId
                // We would probably need a raw query or `where: { OR: [ { serviceEmails: { some: { sentBy: id } } } ... ] }`
                // Let's try the Prisma way for readability if possible, else raw.
                if (filterTelecallerId) {
                    whereInput.OR = [
                        { serviceEmails: { some: { sentBy: filterTelecallerId } } },
                        { smsMessages: { some: { telecallerId: filterTelecallerId } } },
                        { whatsappMessages: { some: { telecallerId: filterTelecallerId } } }
                    ];
                }

                const customers = await prisma.customer.findMany({
                    where: whereInput,
                    take: parseInt(limit as string),
                    skip: offset,
                    include: {
                        // Optimization: We could use _count, but we need date filtering which _count doesn't support easily in top level
                        // So we will just fetch basic details and aggregate separately or use raw query.
                        // Using Raw Query for performance with aggregation:
                    }
                });

                // It is better to do a raw query for "Customer + Stats" list
                // Constructing raw query for customer list + counts
                const customerQuery = `
            SELECT 
                c.id, c.customer_name, c.vehicle_number, c.phone, c.email,
                (SELECT COUNT(*) FROM "service_emails" s WHERE s.customer_id = c.id ${telecallerClause('sent_by')} ${dateClauseEmail('sent_at')}) as "emailCount",
                (SELECT MAX(to_timestamp(s.sent_at / 1000.0)) FROM "service_emails" s WHERE s.customer_id = c.id ${telecallerClause('sent_by')}) as "lastEmail",
                (SELECT COUNT(*) FROM "sms_messages" s WHERE s.customer_id = c.id ${telecallerClause('telecaller_id')} ${dateClauseSMS('sent_at')}) as "smsCount",
                (SELECT MAX(s.sent_at) FROM "sms_messages" s WHERE s.customer_id = c.id ${telecallerClause('telecaller_id')}) as "lastSms",
                (SELECT COUNT(*) FROM "whatsapp_messages" w WHERE w.customer_id = c.id ${telecallerClause('telecaller_id')} ${dateClauseSMS('sent_at')}) as "waCount",
                (SELECT MAX(w.sent_at) FROM "whatsapp_messages" w WHERE w.customer_id = c.id ${telecallerClause('telecaller_id')}) as "lastWa"
            FROM "customers" c
            WHERE 1=1 ${customerClause('c.id')}
            -- Optimization: Only show customers with activity if a specific telecaller is selected, 
            -- otherwise we might return thousands of idle customers.
            ${filterTelecallerId ? `
              AND (
                EXISTS (SELECT 1 FROM "service_emails" WHERE customer_id = c.id AND sent_by = ${filterTelecallerId})
                OR EXISTS (SELECT 1 FROM "sms_messages" WHERE customer_id = c.id AND telecaller_id = ${filterTelecallerId})
                OR EXISTS (SELECT 1 FROM "whatsapp_messages" WHERE customer_id = c.id AND telecaller_id = ${filterTelecallerId})
              )
            ` : ''}
            ORDER BY c.id DESC
            LIMIT ${limit} OFFSET ${offset}
         `;

                const customerResults = await prisma.$queryRawUnsafe<any[]>(customerQuery);

                data = customerResults.map(c => {
                    const stats: any = {
                        total: 0,
                        lastContact: null
                    };
                    
                    // Only include selected channel's data
                    if (channel === 'all' || channel === 'email') {
                        stats.email = Number(c.emailCount);
                        if (channel === 'email') stats.total = Number(c.emailCount);
                        if (c.lastEmail) stats.lastContact = c.lastEmail;
                    }
                    if (channel === 'all' || channel === 'sms') {
                        stats.sms = Number(c.smsCount);
                        if (channel === 'sms') stats.total = Number(c.smsCount);
                        if (c.lastSms && (!stats.lastContact || new Date(c.lastSms) > new Date(stats.lastContact))) {
                            stats.lastContact = c.lastSms;
                        }
                    }
                    if (channel === 'all' || channel === 'whatsapp') {
                        stats.whatsapp = Number(c.waCount);
                        if (channel === 'whatsapp') stats.total = Number(c.waCount);
                        if (c.lastWa && (!stats.lastContact || new Date(c.lastWa) > new Date(stats.lastContact))) {
                            stats.lastContact = c.lastWa;
                        }
                    }
                    
                    // Only calculate total if 'all' channels are selected
                    if (channel === 'all') {
                        stats.total = Number(c.emailCount) + Number(c.smsCount) + Number(c.waCount);
                        // Find the most recent contact date
                        const lastContacts = [c.lastEmail, c.lastSms, c.lastWa].filter(d => d);
                        stats.lastContact = lastContacts.length > 0 ? lastContacts.sort().pop() : null;
                    }
                    
                    return {
                        id: c.id,
                        name: c.customer_name,
                        vehicle: c.vehicle_number,
                        contact: { phone: c.phone, email: c.email },
                        stats: stats
                    };
                });

            } else if (view === 'timeseries') {
                // --- TIMESERIES VIEW ---
                // Group by Day/Month
                // Postgres date_trunc
                const trunc = groupBy === 'month' ? 'month' : 'day';

                const emailSeries = await prisma.$queryRawUnsafe<any[]>(`
            SELECT DATE_TRUNC('${trunc}', to_timestamp("sent_at" / 1000.0)) as "date", COUNT(*)::int as "count"
            FROM "service_emails"
            WHERE 1=1 ${telecallerClause('sent_by')} ${customerClause('customer_id')} ${dateClauseEmail('sent_at')}
            GROUP BY 1
          `);

                const smsSeries = await prisma.$queryRawUnsafe<any[]>(`
            SELECT DATE_TRUNC('${trunc}', "sent_at") as "date", COUNT(*)::int as "count"
            FROM "sms_messages"
            WHERE 1=1 ${telecallerClause('telecaller_id')} ${customerClause('customer_id')} ${dateClauseSMS('sent_at')}
            GROUP BY 1
          `);

                const waSeries = await prisma.$queryRawUnsafe<any[]>(`
            SELECT DATE_TRUNC('${trunc}', "sent_at") as "date", COUNT(*)::int as "count"
            FROM "whatsapp_messages"
            WHERE 1=1 ${telecallerClause('telecaller_id')} ${customerClause('customer_id')} ${dateClauseSMS('sent_at')}
            GROUP BY 1
          `);

                // Merge series based on selected channel
                const map = new Map();
                
                const addToMap = (arr: any[], type: string) => {
                    if (channel === 'all' || channel === type) {
                        arr.forEach(row => {
                            const d = new Date(row.date).toISOString().split('T')[0]; // simple date key
                            if (!map.has(d)) {
                                // Initialize with all zeros, but only the selected channel will be populated
                                map.set(d, { 
                                    date: row.date, 
                                    email: channel === 'all' || channel === 'email' ? 0 : undefined,
                                    sms: channel === 'all' || channel === 'sms' ? 0 : undefined,
                                    whatsapp: channel === 'all' || channel === 'whatsapp' ? 0 : undefined
                                });
                            }
                            const entry = map.get(d);
                            if (entry) entry[type] = row.count;
                        });
                    }
                };

                // Only add series for the selected channel(s)
                if (channel === 'all' || channel === 'email') addToMap(emailSeries, 'email');
                if (channel === 'all' || channel === 'sms') addToMap(smsSeries, 'sms');
                if (channel === 'all' || channel === 'whatsapp') addToMap(waSeries, 'whatsapp');

                data = Array.from(map.values()).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
            }

            res.json({
                success: true,
                data: {
                    filters: { channel, view, telecallerId: filterTelecallerId, customerId: filterCustomerId, dateRange: { start, end } },
                    result: data
                }
            });

        } catch (error: any) {
            logger.error('Unified Analytics Error:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch analytics', error: error.message });
        }
    },

    /**
     * CUSTOMER ENGAGEMENT ENDPOINT
     * Detailed breakdown for a single customer
     */
    async getCustomerEngagement(req: AuthRequest, res: Response) {
        try {
            const customerId = parseInt(req.params.customerId);
            if (isNaN(customerId)) return res.status(400).json({ success: false, message: 'Invalid Customer ID' });

            const customer = await prisma.customer.findUnique({
                where: { id: customerId },
                include: {
                    serviceEmails: { orderBy: { sentAt: 'desc' } },
                    smsMessages: { orderBy: { sentAt: 'desc' } },
                    whatsappMessages: { orderBy: { sentAt: 'desc' } }
                }
            });

            if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

            const timeline = [
                ...customer.serviceEmails.map(e => ({ type: 'email', date: new Date(Number(e.sentAt)), data: e })),
                ...customer.smsMessages.map(s => ({ type: 'sms', date: s.sentAt, data: s })),
                ...customer.whatsappMessages.map(w => ({ type: 'whatsapp', date: w.sentAt, data: w }))
            ].sort((a, b) => b.date.getTime() - a.date.getTime());

            const sourceMetrics = await prisma.sourceMetric.findMany({
                where: { customerId }
            });

            res.json({
                success: true,
                data: {
                    customer: { id: customer.id, name: customer.customerName, vehicle: customer.vehicleNumber },
                    engagement: {
                        totalEmails: customer.serviceEmails.length,
                        totalSms: customer.smsMessages.length,
                        totalWhatsapp: customer.whatsappMessages.length,
                        linkOpens: sourceMetrics
                    },
                    timeline
                }
            });

        } catch (error: any) {
            logger.error('Customer Engagement Error:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch customer engagement' });
        }
    },

    /**
     * TRACK LINK OPEN
     * Records when a user clicks a link (Moved from sourceMetricsController)
     */
    async trackLinkOpen(req: AuthRequest, res: Response) {
        try {
            const customerId = parseInt(req.params.customerId);
            const source = req.query.source as string;

            // Validate
            if (isNaN(customerId)) return res.status(400).json({ success: false, message: 'Invalid customer ID' });
            if (!source || !['email', 'sms'].includes(source.toLowerCase())) {
                return res.status(400).json({ success: false, message: 'Invalid source. Must be "email" or "sms"' });
            }

            // Upsert metric
            const sourceMetric = await prisma.sourceMetric.upsert({
                where: {
                    customerId_source: { customerId, source: source.toLowerCase() },
                },
                update: {
                    openCount: { increment: 1 },
                    lastOpenedAt: new Date(),
                },
                create: {
                    customerId,
                    source: source.toLowerCase(),
                    openCount: 1,
                },
            });

            logger.info(`Link opened by customer ${customerId} from source ${source}. count: ${sourceMetric.openCount}`);

            res.json({
                success: true,
                data: {
                    customerId,
                    source: sourceMetric.source,
                    openCount: sourceMetric.openCount,
                    firstOpenedAt: sourceMetric.firstOpenedAt,
                    lastOpenedAt: sourceMetric.lastOpenedAt
                }
            });
        } catch (error: any) {
            logger.error('Tracking Error:', error);
            res.status(500).json({ success: false, message: 'Failed to track link' });
        }
    }
};
