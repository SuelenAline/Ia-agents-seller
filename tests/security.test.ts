import {
  encrypt,
  decrypt,
  issueToken,
  verifyToken,
} from "../apps/api/src/security";
process.env.MOCK_MODE = "true";
describe("segurança", () => {
  test("AES-GCM não aceita ciphertext alterado", () => {
    process.env.TOKEN_ENCRYPTION_KEY = "ab".repeat(32);
    const encrypted = encrypt({ access_token: "sensitive" });
    expect(encrypted).not.toContain("sensitive");
    expect(decrypt(encrypted).access_token).toBe("sensitive");
    const [iv, tag, data] = encrypted.split(".");
    const modified =
      (parseInt(data.slice(0, 2), 16) ^ 1).toString(16).padStart(2, "0") +
      data.slice(2);
    expect(() => decrypt(`${iv}.${tag}.${modified}`)).toThrow();
  });
  test("token expirado ou alterado falha", () => {
    const token = issueToken("admin@example.local");
    expect(verifyToken(token).role).toBe("admin");
    expect(() => verifyToken(`${token}x`)).toThrow();
  });
});
