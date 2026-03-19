import { Response } from 'express';
import { securityConfig } from '../config/security';

export const setRefreshTokenCookie = (res: Response, refreshToken: string) => {
    res.cookie('refreshToken', refreshToken, securityConfig.refreshTokenCookieOptions);
};

export const clearRefreshTokenCookie = (res: Response) => {
    res.clearCookie('refreshToken', securityConfig.refreshTokenCookieClearOptions);
};
