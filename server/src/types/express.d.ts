declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: {
        id: string;
        username: string;
        email: string;
      };
    }
  }
}

export {};
