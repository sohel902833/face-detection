import {
  Injectable,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { FaceService } from "../face/face.service";
import { RegisterDto, LoginDto } from "./auth.dto";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private faceService: FaceService,
  ) {}

  async register(dto: RegisterDto, file: Express.Multer.File) {
    // 1. Basic validation - check if user exists
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException("A user with this email already exists");
    }

    if (!file) {
      throw new BadRequestException("A photo is required for registration");
    }

    // 2. Send image to Python for face detection + embedding
    const embeddingResult = await this.faceService.detectAndEmbed(
      file.buffer,
      file.mimetype,
      file.originalname,
    );

    if (!embeddingResult.success || !embeddingResult.embedding) {
      throw new BadRequestException(
        embeddingResult.message || "No face detected in the provided photo",
      );
    }

    // 4. Create user with embedding
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        photoPath: `N/A`,
        faceEmbedding: embeddingResult.embedding,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        photoPath: true,
        createdAt: true,
      },
    });

    this.logger.log(`User registered: ${user.email}`);

    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return { user, token, message: "Registration successful" };
  }

  async login(dto: LoginDto, file: Express.Multer.File) {
    // 1. Check user exists
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new NotFoundException("No account found with this email");
    }

    if (!user.isActive) {
      throw new UnauthorizedException("This account has been deactivated");
    }

    if (!user.faceEmbedding || user.faceEmbedding.length === 0) {
      throw new BadRequestException("No face data registered for this account");
    }

    if (!file) {
      throw new BadRequestException("A face photo is required for login");
    }

    // 2. Match face
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
        `Face verification failed. Similarity: ${(matchResult.similarity * 100).toFixed(1)}%`,
      );
    }

    this.logger.log(
      `User logged in: ${user.email}, similarity: ${matchResult.similarity}`,
    );

    const token = this.jwtService.sign({ sub: user.id, email: user.email });
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        photoPath: user.photoPath,
        createdAt: user.createdAt,
      },
      token,
      similarity: matchResult.similarity,
      message: "Login successful",
    };
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        photoPath: true,
        createdAt: true,
        isActive: true,
      },
    });
  }
}
