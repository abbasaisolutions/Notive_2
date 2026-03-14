export {};

declare global {
    namespace Express {
        interface Request {
            userId: string;
            userEmail: string;
            userRole?: string;
        }

        interface MulterFileWithLocation extends Multer.File {
            location?: string;
        }
    }
}
