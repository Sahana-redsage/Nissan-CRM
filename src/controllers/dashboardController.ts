import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';

class DashboardController {
  async getStats(req: AuthRequest, res: Response) {
    try {
      const telecallerId = req.telecaller!.id;

      // Get total customers
      const totalCustomers = await prisma.customer.count();

      // Get total calls made by this telecaller
      const totalCalls = await prisma.callLog.count({
        where: { telecallerId },
      });

      // Get calls by status
      const callsByStatus = await prisma.callLog.groupBy({
        by: ['callStatus'],
        where: { telecallerId },
        _count: true,
      });

      // Get pending follow-ups (future follow-up dates)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const pendingFollowUps = await prisma.callLog.count({
        where: {
          telecallerId,
          followUpRequired: true,
          followUpDate: {
            gte: today,
          },
        },
      });

      // Get overdue follow-ups
      const overdueFollowUps = await prisma.callLog.count({
        where: {
          telecallerId,
          followUpRequired: true,
          followUpDate: {
            lt: today,
          },
        },
      });

      // Get service bookings
      const serviceBookings = await prisma.callLog.count({
        where: {
          telecallerId,
          serviceBooked: true,
        },
      });

      // Get customers with upcoming service (next 30 days)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const upcomingServices = await prisma.customer.count({
        where: {
          nextServiceDueDate: {
            gte: today,
            lte: thirtyDaysFromNow,
          },
        },
      });

      // Get recent calls (last 10)
      const recentCalls = await prisma.callLog.findMany({
        where: { telecallerId },
        include: {
          customer: {
            select: {
              customerName: true,
              vehicleNumber: true,
              vehicleModel: true,
            },
          },
        },
        orderBy: { callDate: 'desc' },
        take: 10,
      });

      // Get call trends (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const callTrends = await prisma.callLog.groupBy({
        by: ['callDate'],
        where: {
          telecallerId,
          callDate: {
            gte: sevenDaysAgo,
          },
        },
        _count: true,
        orderBy: {
          callDate: 'asc',
        },
      });

      // Performance Metrics
      const callsWithFollowUp = await prisma.callLog.count({
        where: { telecallerId, followUpRequired: true },
      });

      const completedFollowUps = await prisma.callLog.count({
        where: {
          telecallerId,
          followUpRequired: true,
          callStatus: 'completed',
        },
      });

      const conversionRate = totalCalls > 0 ? ((serviceBookings / totalCalls) * 100).toFixed(1) : '0.0';
      const followUpSuccessRate = callsWithFollowUp > 0 ? ((completedFollowUps / callsWithFollowUp) * 100).toFixed(1) : '0.0';

      // Time-based Analytics - Calls by hour
      const callsByHour = await prisma.$queryRaw`
        SELECT EXTRACT(HOUR FROM "call_date") as hour, COUNT(*)::int as count
        FROM "call_logs"
        WHERE "telecaller_id" = ${telecallerId}
        GROUP BY EXTRACT(HOUR FROM "call_date")
        ORDER BY hour
      `;

      // Monthly comparison (last 3 months)
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      const monthlyComparison = await prisma.$queryRaw`
        SELECT
          TO_CHAR("call_date", 'Mon YYYY') as month,
          COUNT(*)::int as total_calls,
          SUM(CASE WHEN "service_booked" = true THEN 1 ELSE 0 END)::int as bookings
        FROM "call_logs"
        WHERE "telecaller_id" = ${telecallerId}
          AND "call_date" >= ${threeMonthsAgo}
        GROUP BY TO_CHAR("call_date", 'Mon YYYY'), DATE_TRUNC('month', "call_date")
        ORDER BY DATE_TRUNC('month', "call_date") DESC
      `;

      // Customer Insights - Service frequency distribution
      const serviceFrequency = await prisma.customer.groupBy({
        by: ['vehicleMake'],
        _count: true,
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 5,
      });

      // Telecaller Performance - Get all telecallers stats for leaderboard
      const telecallerPerformance = await prisma.$queryRaw`
        SELECT
          t."full_name" as "fullName",
          COUNT(c.id)::int as total_calls,
          SUM(CASE WHEN c."service_booked" = true THEN 1 ELSE 0 END)::int as bookings,
          ROUND((SUM(CASE WHEN c."service_booked" = true THEN 1 ELSE 0 END)::decimal / NULLIF(COUNT(c.id), 0) * 100), 1) as conversion_rate
        FROM "telecallers" t
        LEFT JOIN "call_logs" c ON t.id = c."telecaller_id"
        GROUP BY t.id, t."full_name"
        ORDER BY conversion_rate DESC NULLS LAST
      `;

      res.json({
        success: true,
        data: {
          overview: {
            totalCustomers,
            totalCalls,
            pendingFollowUps,
            overdueFollowUps,
            serviceBookings,
            upcomingServices,
          },
          callsByStatus: callsByStatus.map((item) => ({
            status: item.callStatus,
            count: item._count,
          })),
          callTrends: callTrends.map((item) => ({
            date: item.callDate,
            count: item._count,
          })),
          recentCalls,
          performance: {
            conversionRate,
            followUpSuccessRate,
            averageResponseTime: '2.5 hrs', // Placeholder
          },
          timeAnalytics: {
            callsByHour,
            monthlyComparison,
          },
          customerInsights: {
            topVehicleMakes: serviceFrequency.map((item) => ({
              make: item.vehicleMake,
              count: item._count,
            })),
          },
          telecallerPerformance,
        },
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard statistics',
      });
    }
  }
}

export default new DashboardController();
