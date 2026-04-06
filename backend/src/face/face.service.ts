import { Injectable, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import * as FormData from 'form-data';
import fetch from 'node-fetch';

export interface EmbeddingResult {
  success: boolean;
  embedding?: number[];
  message: string;
  face_count: number;
  processing_time_ms: number;
}

export interface MatchResult {
  success: boolean;
  match: boolean;
  similarity: number;
  message: string;
  processing_time_ms: number;
}

@Injectable()
export class FaceService {
  private readonly logger = new Logger(FaceService.name);
  private readonly pythonUrl: string;

  constructor() {
    this.pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8001';
  }

  async detectAndEmbed(imageBuffer: Buffer, mimetype: string, originalname: string): Promise<EmbeddingResult> {
    const formData = new FormData();
    formData.append('file', imageBuffer, {
      filename: originalname,
      contentType: mimetype,
    });

    try {
      const response = await fetch(`${this.pythonUrl}/detect-and-embed`, {
        method: 'POST',
        body: formData,
        timeout: 10000, // 10 second timeout
      } as any);

      if (!response.ok) {
        const err = await response.text();
        throw new InternalServerErrorException(`Python service error: ${err}`);
      }

      const result: EmbeddingResult = await response.json();
      this.logger.log(`Face detection: success=${result.success}, faces=${result.face_count}, time=${result.processing_time_ms}ms`);
      return result;
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;
      this.logger.error(`Face service connection failed: ${err.message}`);
      throw new InternalServerErrorException('Face recognition service is unavailable');
    }
  }

  async matchFace(imageBuffer: Buffer, mimetype: string, originalname: string, storedEmbedding: number[]): Promise<MatchResult> {
    const formData = new FormData();
    formData.append('file', imageBuffer, {
      filename: originalname,
      contentType: mimetype,
    });
    formData.append('stored_embedding', JSON.stringify(storedEmbedding));

    try {
      const response = await fetch(`${this.pythonUrl}/match-face`, {
        method: 'POST',
        body: formData,
        timeout: 8000, // 8 second timeout (target <2s)
      } as any);

      if (!response.ok) {
        const err = await response.text();
        throw new InternalServerErrorException(`Python service error: ${err}`);
      }

      const result: MatchResult = await response.json();
      this.logger.log(`Face match: match=${result.match}, similarity=${result.similarity}, time=${result.processing_time_ms}ms`);
      return result;
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;
      this.logger.error(`Face matching failed: ${err.message}`);
      throw new InternalServerErrorException('Face recognition service is unavailable');
    }
  }
}
