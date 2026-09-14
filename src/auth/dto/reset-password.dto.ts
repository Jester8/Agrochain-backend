import { IsString, Matches } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  resetToken!: string;

  @IsString()
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, {
    message: 'Password must be at least 8 characters and include a letter and a number.',
  })
  newPassword!: string;
}
