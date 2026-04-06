import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class MarkAttendanceDto {
  @IsDateString()
  date: string; // ISO date string e.g. "2024-06-01"
}
