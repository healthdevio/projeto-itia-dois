import { createServer } from 'node:http';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

const issuer = 'https://issuer.test/';
const audience = 'chat-back-test';
const keyId = 'chat-back-test-key';
const { privateKey, publicKey } = await generateKeyPair('RS256');
const publicJwk = await exportJWK(publicKey);
publicJwk.kid = keyId;
publicJwk.alg = 'RS256';
publicJwk.use = 'sig';

const jwksServer = createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ keys: [publicJwk] }));
});

await new Promise<void>((resolve, reject) => {
  jwksServer.once('error', reject);
  jwksServer.listen(0, '127.0.0.1', resolve);
});
jwksServer.unref();

const address = jwksServer.address();
if (!address || typeof address === 'string') {
  throw new Error('Não foi possível iniciar o servidor JWKS de teste');
}

process.env.OIDC_ISSUER = issuer;
process.env.OIDC_AUDIENCE = audience;
process.env.OIDC_JWKS_URL = `http://127.0.0.1:${address.port}/jwks`;

export async function authorizationHeaders(subject = 'ana') {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: keyId })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(subject)
    .setExpirationTime('5m')
    .sign(privateKey);

  return { Authorization: `Bearer ${token}` };
}
