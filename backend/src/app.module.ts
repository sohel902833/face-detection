import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AttendanceModule } from './attendance/attendance.module';
import { FaceModule } from './face/face.module';

@Module({
  imports: [
    PrismaModule,
    FaceModule,
    AuthModule,
    AttendanceModule,
  ],
})
export class AppModule {}
