import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  // UseInterceptors,
  // UploadedFile,
  Request,
  Get,
  Param,
  Patch,
  Delete,
  Query,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register-user.dto';
import { User } from './entities/user.entity';
import { FeedService } from '../feed/feed.service';
import { JobsService } from '../jobs/jobs.service';
// import { LoginDto } from './dto/login-user.dto';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { GetUsersDto } from './dto/get-users.dto';
import { SuspendUserDto } from './dto/suspend-user.dto';

import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  // ApiConsumes,
  // ApiBody,
} from '@nestjs/swagger';
import { Roles } from './decorators/role.decorator';
import { UserRole } from './enums/userRole.enum';
import { RolesGuard } from './guards/role.guard';
import { AuthGuardGuard } from './guards/auth.guard';
// import { FileInterceptor } from '@nestjs/platform-express';
// import { diskStorage } from 'multer';
// import { extname } from 'path';
import { AuthGuard } from '@nestjs/passport';
import { LogInDto } from './dto/loginDto';
import { LogInProvider } from './providers/loginProvider';
// import { AdminGuard } from './admin.guard';

@ApiTags('auth')
@ApiResponse({ status: 400, description: 'Bad Request' })
@ApiResponse({ status: 401, description: 'Unauthorized' })
@Controller('auth')
export class AuthController {
  /**
   * Promote a user to admin. Only accessible by super admins.
   */
  @Patch('promote/:userId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Promote a user to admin (super admin only)' })
  @ApiResponse({ status: 200, description: 'User promoted to admin' })
  @ApiUnauthorizedResponse({
    description: 'Only super admins can promote users',
  })
  @ApiBadRequestResponse({ description: 'Target user does not exist' })
  async promoteToAdmin(@Request() req, @Param('userId') userId: string) {
    const updatedUser = await this.authService.promoteToAdmin(
      req.user.id,
      userId,
    );
    return { message: `User ${updatedUser.email} has been promoted to admin.` };
  }

  constructor(
    private readonly authService: AuthService,
    private readonly feedService: FeedService,
    private readonly jobsService: JobsService,
    private readonly logInProvider: LogInProvider,
  ) {}

  @Post('verify-email')
  @ApiOperation({ summary: 'Verify user email with token' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string', example: 'a1b2c3d4e5f6g7h8i9j0' },
      },
    },
  })
  async verifyEmail(@Body('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiResponse({ status: 200, description: 'Verification email sent' })
  @ApiResponse({ status: 400, description: 'Email is already verified' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email', example: 'user@example.com' },
      },
    },
  })
  async resendVerificationEmail(@Body('email') email: string) {
    await this.authService.resendVerificationEmail(email);
    return { message: 'Verification email sent successfully' };
  }

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
  @Roles(UserRole.ADMIN)
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
    return await this.authService.sendPasswordResetEmail(email);
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; newPassword: string }) {
    return this.authService.resetPassword(body.token, body.newPassword);
  }

  @Get('users')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiOperation({
    summary: 'Get all users with pagination and filters (admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of users returned successfully',
  })
  @ApiUnauthorizedResponse({
    description: 'Only admins can access this endpoint',
  })
  async getUsers(@Query() getUsersDto: GetUsersDto) {
    const { page = 1, limit = 10, role, isSuspended } = getUsersDto;
    return this.authService.getUsersWithFilters(page, limit, role, isSuspended);
  }

  @Post('suspend')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @ApiOperation({ summary: 'Suspend or unsuspend a user (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User suspension status toggled successfully',
  })
  @ApiUnauthorizedResponse({ description: 'Only admins can suspend users' })
  @ApiBadRequestResponse({
    description: 'Invalid user ID or cannot suspend admin users',
  })
  async suspendUser(@Request() req, @Body() suspendUserDto: SuspendUserDto) {
    const user = await this.authService.suspendUser(
      req.user.id,
      suspendUserDto.userId,
    );
    return {
      message: `User ${user.email} has been ${user.isSuspended ? 'suspended' : 'unsuspended'}.`,
      isSuspended: user.isSuspended,
    };
  }

  @Get('recruiter/:recruiterId/public-profile')
  @ApiOperation({ summary: 'Get public recruiter profile information' })
  @ApiResponse({
    status: 200,
    description: 'Public recruiter profile returned successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'uuid-string' },
        role: { type: 'string', example: 'RECRUITER' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Recruiter not found' })
  async getPublicRecruiterProfile(@Param('recruiterId') recruiterId: string) {
    return this.authService.getPublicRecruiterProfile(recruiterId);
  }
}
