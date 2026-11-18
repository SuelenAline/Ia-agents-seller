import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import {
  createHmac,
  timingSafeEqual,
  scryptSync,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { mockMode } from "./store";
function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    if (!mockMode()) throw new Error("AUTH_SECRET exige 32 caracteres");
    return "mock-only-local-secret-no-production-access";
  }
  return s;
}
export function issueToken(email: string) {
  const body = Buffer.from(
    JSON.stringify({ email, role: "admin", exp: Date.now() + 3600000 }),
  ).toString("base64url");
  return `${body}.${createHmac("sha256", secret()).update(body).digest("base64url")}`;
}
export function verifyToken(token: string) {
  const [body, signature] = token.split(".");
  if (!body || !signature) throw new UnauthorizedException();
  const actual = Buffer.from(signature);
  const expected = Buffer.from(
    createHmac("sha256", secret()).update(body).digest("base64url"),
  );
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new UnauthorizedException();
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp < Date.now() || payload.role !== "admin") throw new Error();
    return payload;
  } catch {
    throw new UnauthorizedException();
  }
}
export function passwordMatches(input: string, expected: string) {
  const salt = "seller-auth-v1";
  return timingSafeEqual(
    scryptSync(input, salt, 64),
    scryptSync(expected, salt, 64),
  );
}
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const token = req.headers.authorization?.replace(/^Bearer /, "");
    if (!token) throw new UnauthorizedException();
    req.user = verifyToken(token);
    if (req.method !== "GET" && req.user.role !== "admin")
      throw new ForbiddenException();
    return true;
  }
}
function encryptionKey() {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY || "", "hex");
  if (key.length !== 32)
    throw new Error("TOKEN_ENCRYPTION_KEY deve conter 64 dígitos hexadecimais");
  return key;
}
export function encrypt(value: unknown) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [
    iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    encrypted.toString("hex"),
  ].join(".");
}
export function decrypt(value: string) {
  const [iv, tag, data] = value.split(".");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "hex"),
  );
  cipher.setAuthTag(Buffer.from(tag, "hex"));
  return JSON.parse(
    Buffer.concat([
      cipher.update(Buffer.from(data, "hex")),
      cipher.final(),
    ]).toString(),
  );
}
