import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  Get,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register-user.dto';
import { User } from './entities/user.entity';
import { FeedService } from '../feed/feed.service';
import { JobsService } from '../jobs/jobs.service';
// import { LoginDto } from './dto/login-user.dto';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';

import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { RoleDecorator } from './decorators/role.decorator';
import { UserRole } from './enums/userRole.enum';
import { RolesGuard } from './guards/role.guard';
import { AuthGuardGuard } from './guards/auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AuthGuard } from '@nestjs/passport';
import { LogInDto } from './dto/loginDto';
import { LogInProvider } from './providers/loginProvider';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  /**
   * Promote a user to admin. Only accessible by super admins.
   */
  @Patch('promote/:userId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @RoleDecorator(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Promote a user to admin (super admin only)' })
  @ApiResponse({ status: 200, description: 'User promoted to admin' })
  @ApiUnauthorizedResponse({ description: 'Only super admins can promote users' })
  @ApiBadRequestResponse({ description: 'Target user does not exist' })
  async promoteToAdmin(@Request() req, @Param('userId') userId: string) {
    const updatedUser = await this.authService.promoteToAdmin(req.user.id, userId);
    return { message: `User ${updatedUser.email} has been promoted to admin.` };
  }

  constructor(
    private readonly authService: AuthService,
    private readonly feedService: FeedService,
    private readonly jobsService: JobsService,
    private readonly logInProvider: LogInProvider,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user as Freelancer or Recruiter' })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    type: User,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed or email already exists',
  })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }


  
 
 
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  
  @RoleDecorator(UserRole.ADMIN)
  @UseGuards(AuthGuardGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, description: 'Login successful, JWT returned' })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async login(@Body() loginDto: LogInDto) {
    const token = await this.logInProvider.Login(loginDto);
    return { access_token: token };
  }

  @Post('request-password-reset')
async requestPasswordReset(@Body('email') email: string) {
  return this.authService.sendPasswordResetEmail(email);
}


  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    return this.authService.resetPassword(body.token, body.newPassword);
  }

  // --- Portfolio Endpoints ---
  @Post('portfolio')
  @UseGuards(AuthGuardGuard)
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/portfolio',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + extname(file.originalname));
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreatePortfolioDto })
  async uploadPortfolio(
    @Request() req,
    @Body() body: CreatePortfolioDto,
    @UploadedFile() file: any,
  ) {
    return this.authService.createPortfolio(req.user.id, body, file);
  }

  @Patch('portfolio/:id')
  @UseGuards(AuthGuardGuard)
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/portfolio',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + extname(file.originalname));
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreatePortfolioDto })
  async updatePortfolio(
    @Request() req,
    @Param('id') id: string,
    @Body() body: Partial<CreatePortfolioDto>,
    @UploadedFile() file?: any,
  ) {
    return this.authService.updatePortfolio(req.user.id, id, body, file);
  }

  @Delete('portfolio/:id')
  @UseGuards(AuthGuardGuard)
  async deletePortfolio(@Request() req, @Param('id') id: string) {
    await this.authService.deletePortfolio(req.user.id, id);
    return { message: 'Portfolio item deleted' };
  }

  @Get('portfolio')
  @UseGuards(AuthGuardGuard)
  async getUserPortfolios(@Request() req) {
    return this.authService.getUserPortfolios(req.user.id);
  }
  @Get('admin/analytics')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @RoleDecorator(UserRole.ADMIN)
  async getAdminAnalytics() {
    const postsStats = await this.feedService.getWeeklyNewPostsCount();
    const jobsStats = await this.jobsService.getWeeklyNewJobsCount();
    const applicationsStats = await this.jobsService.getWeeklyNewApplicationsCount();

    return {
      posts: postsStats,
      jobs: jobsStats,
      applications: applicationsStats,
    };
  }
}
