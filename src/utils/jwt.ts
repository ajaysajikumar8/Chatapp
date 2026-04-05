import jwt from "jsonwebtoken";

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
};

export const generateToken = (userId: string) => {
  const options: jwt.SignOptions = {};
  if (process.env.JWT_EXPIRES_IN) {
    options.expiresIn = process.env.JWT_EXPIRES_IN as NonNullable<
      jwt.SignOptions["expiresIn"]
    >;
  }

  return jwt.sign({ userId }, getJwtSecret(), options);
};

export const verifyToken = (token: string): { userId: string } => {
  return jwt.verify(token, getJwtSecret()) as { userId: string };
};