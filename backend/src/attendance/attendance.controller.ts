import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AttendanceService } from './attendance.service';
import { MarkAttendanceDto } from './attendance.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  @Post('mark')
  @UseInterceptors(FileInterceptor('photo', {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
        return cb(new BadRequestException('Only image files are allowed'), false);
      }
      cb(null, true);
    },
  }))
  async markAttendance(
    @Request() req,
    @Body() dto: MarkAttendanceDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.attendanceService.markAttendance(req.user.id, dto, file);
  }

  @Get('my')
  async getMyAttendance(
    @Request() req,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.attendanceService.getMyAttendance(
      req.user.id,
      parseInt(page),
      parseInt(limit),
    );
  }

  @Get('stats')
  async getStats(@Request() req) {
    return this.attendanceService.getStats(req.user.id);
  }

  @Get('all')
  async getAllAttendance(
    @Query('page') page = '1',
    @Query('limit') limit = '30',
    @Query('date') date?: string,
  ) {
    return this.attendanceService.getAllAttendance(
      parseInt(page),
      parseInt(limit),
      date,
    );
  }
}
