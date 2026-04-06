import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FaceService } from "../face/face.service";
import { MarkAttendanceDto } from "./attendance.dto";
@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);
  constructor(
    private prisma: PrismaService,
    private faceService: FaceService,
  ) {}

  async markAttendance(
    userId: string,
    dto: MarkAttendanceDto,
    file: Express.Multer.File,
  ) {
    // 1. Load user with embedding
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.faceEmbedding || user.faceEmbedding.length === 0) {
      throw new BadRequestException("User face data not found");
    }

    if (!file) {
      throw new BadRequestException("A photo is required to mark attendance");
    }

    // 2. Parse date - normalize to start of day UTC
    const attendanceDate = new Date(dto.date);
    attendanceDate.setUTCHours(0, 0, 0, 0);

    // 3. Check if attendance already marked for this date
    const existing = await this.prisma.attendance.findUnique({
      where: { userId_date: { userId, date: attendanceDate } },
    });
    if (existing) {
      throw new ConflictException(
        `Attendance already marked for ${attendanceDate.toDateString()}`,
      );
    }

    // 4. Face matching
    const matchResult = await this.faceService.matchFace(
      file.buffer,
      file.mimetype,
      file.originalname,
      user.faceEmbedding,
    );

    if (!matchResult.success) {
      throw new BadRequestException(matchResult.message);
    }

    if (!matchResult.match) {
      throw new UnauthorizedException(
        `Face verification failed. Similarity: ${(matchResult.similarity * 100).toFixed(1)}%. Please try again with better lighting.`,
      );
    }
    // 6. Record attendance
    const attendance = await this.prisma.attendance.create({
      data: {
        userId,
        date: attendanceDate,
        similarity: matchResult.similarity,
        photoPath: `N/A`,
        status: "PRESENT",
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    this.logger.log(
      `Attendance marked: user=${user.email}, date=${attendanceDate.toDateString()}, similarity=${matchResult.similarity}`,
    );

    return {
      attendance,
      similarity: matchResult.similarity,
      processingTimeMs: matchResult.processing_time_ms,
      message: "Attendance marked successfully",
    };
  }

  async getMyAttendance(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where: { userId },
        orderBy: { date: "desc" },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.attendance.count({ where: { userId } }),
    ]);

    return {
      records,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAllAttendance(page = 1, limit = 30, dateFilter?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (dateFilter) {
      const d = new Date(dateFilter);
      d.setUTCHours(0, 0, 0, 0);
      where.date = d;
    }

    const [records, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        orderBy: [{ date: "desc" }, { checkedInAt: "desc" }],
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, email: true, photoPath: true },
          },
        },
      }),
      this.prisma.attendance.count({ where }),
    ]);

    return {
      records,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getStats(userId: string) {
    const total = await this.prisma.attendance.count({ where: { userId } });

    // This month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = await this.prisma.attendance.count({
      where: { userId, date: { gte: monthStart } },
    });

    // Last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const thisWeek = await this.prisma.attendance.count({
      where: { userId, date: { gte: weekAgo } },
    });

    // Recent 10
    const recent = await this.prisma.attendance.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 10,
      select: { date: true, status: true, similarity: true, checkedInAt: true },
    });

    return { total, thisMonth, thisWeek, recent };
  }
}
